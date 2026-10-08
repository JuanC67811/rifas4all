-- =============================================================================
-- Accesos de colaboradores: enlace, PIN y sesiones de dispositivo (diseño §11–12, §26–27)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Acciones del creador
-- -----------------------------------------------------------------------------
-- Credenciales para armar el mensaje que el creador copia y comparte.
-- Se pueden pedir cuantas veces haga falta: cada consulta queda en el log.
create function public.get_access_credentials(p_collaborator_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor private.actor := private.require_creator();
  v_raffle public.raffles;
  v_result jsonb;
begin
  select r.* into v_raffle
    from public.raffles r
    join public.collaborators c on c.raffle_id = r.id
   where c.id = p_collaborator_id
     and r.owner_id = v_actor.user_id;

  if not found then
    perform private.fail('R4A_NOT_FOUND', 'El colaborador no existe o no es de tus rifas.');
  end if;
  if v_raffle.status <> 'active' then
    perform private.fail('R4A_RAFFLE_STATE', 'Los accesos solo se comparten con la rifa activa.');
  end if;

  select jsonb_build_object(
           'raffle_name', v_raffle.name,
           'display_name', c.display_name,
           'token', s.token,
           'pin', s.pin
         )
    into v_result
    from public.collaborators c
    join private.collaborator_secrets s on s.collaborator_id = c.id
   where c.id = p_collaborator_id;

  perform private.log_event(v_raffle.id, v_actor, 'access.message_copied', p_collaborator_id => p_collaborator_id);
  return v_result;
end;
$$;

-- Pausar o reanudar: el efecto es inmediato porque las políticas RLS consultan
-- `is_paused` en cada petición. No toca enlace, PIN ni sesiones.
create function public.set_collaborator_paused(p_collaborator_id uuid, p_paused boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor private.actor := private.require_creator();
  v_raffle public.raffles;
begin
  v_raffle := private.lock_owned_raffle(
    (select raffle_id from public.collaborators where id = p_collaborator_id)
  );
  if v_raffle.status <> 'active' then
    perform private.fail('R4A_RAFFLE_STATE', 'Solo se pueden pausar accesos de una rifa activa.');
  end if;

  update public.collaborators set is_paused = p_paused where id = p_collaborator_id;

  perform private.log_event(v_raffle.id, v_actor,
                            case when p_paused then 'access.paused' else 'access.resumed' end,
                            p_collaborator_id => p_collaborator_id);
end;
$$;

-- Nuevo acceso: nuevo enlace, nuevo PIN (si lo usa) y cierre de todas las sesiones.
-- Para teléfono perdido o enlace filtrado. Ventas e historial no cambian.
create function public.regenerate_access(p_collaborator_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor private.actor := private.require_creator();
  v_raffle public.raffles;
  v_revoked integer;
begin
  v_raffle := private.lock_owned_raffle(
    (select raffle_id from public.collaborators where id = p_collaborator_id)
  );
  if v_raffle.status <> 'active' then
    perform private.fail('R4A_RAFFLE_STATE', 'Solo se pueden regenerar accesos de una rifa activa.');
  end if;

  update private.collaborator_secrets s
     set token = private.new_access_token(),
         pin = case when c.pin_enabled then private.new_pin() end,
         pin_failed_attempts = 0,
         pin_locked_until = null,
         rotated_at = now()
    from public.collaborators c
   where c.id = s.collaborator_id
     and s.collaborator_id = p_collaborator_id;

  update public.collaborator_sessions
     set revoked_at = now(), revoked_reason = 'access_regenerated'
   where collaborator_id = p_collaborator_id
     and revoked_at is null;
  get diagnostics v_revoked = row_count;

  perform private.log_event(v_raffle.id, v_actor, 'access.regenerated',
                            p_collaborator_id => p_collaborator_id,
                            p_details => jsonb_build_object('sessions_revoked', v_revoked));
end;
$$;

-- -----------------------------------------------------------------------------
-- Flujo del colaborador
-- -----------------------------------------------------------------------------
-- Vista previa del enlace: lo único que puede consultar un visitante sin sesión.
-- Ante cualquier problema (token inexistente, regenerado, pausado, rifa no activa)
-- responde con el MISMO error genérico, para no revelar qué tokens existieron.
create function public.get_invitation_preview(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
           'raffle_name', r.name,
           'collaborator_name', c.display_name,
           'requires_pin', c.pin_enabled,
           'pin_locked_until', case when s.pin_locked_until > now() then s.pin_locked_until end
         )
    into v_result
    from private.collaborator_secrets s
    join public.collaborators c on c.id = s.collaborator_id
    join public.raffles r on r.id = c.raffle_id
   where s.token = p_token
     and not c.is_paused
     and private.raffle_accepts_changes(r);

  if v_result is null then
    perform private.fail('R4A_INVALID_LINK', 'Este enlace no es válido. Pide uno nuevo al organizador.');
  end if;

  return v_result;
end;
$$;

-- Activación: liga el navegador (usuario anónimo de Supabase) al colaborador.
--
-- Un PIN incorrecto NO lanza una excepción: la excepción desharía el contador de
-- intentos y el registro en el log (diseño §27). Devuelve {ok: false, error: …}.
create function public.activate_access(p_token text, p_pin text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_secret private.collaborator_secrets;
  v_collaborator public.collaborators;
  v_raffle public.raffles;
  v_actor private.actor;
  v_existing public.collaborator_sessions;
  v_oldest uuid;
begin
  if v_user_id is null then
    perform private.fail('R4A_FORBIDDEN', 'Falta la sesión del dispositivo.');
  end if;
  if private.is_creator() then
    perform private.fail('R4A_CREATOR_SESSION',
      'Estás conectado como organizador. Abre el enlace en otro navegador o en modo incógnito.');
  end if;

  -- Bloquear el secreto serializa activaciones simultáneas del mismo colaborador.
  select * into v_secret from private.collaborator_secrets where token = p_token for update;
  if found then
    select * into v_collaborator from public.collaborators where id = v_secret.collaborator_id;
    select * into v_raffle from public.raffles where id = v_collaborator.raffle_id;
  end if;

  if v_secret is null or v_collaborator.is_paused or not private.raffle_accepts_changes(v_raffle) then
    perform private.fail('R4A_INVALID_LINK', 'Este enlace no es válido. Pide uno nuevo al organizador.');
  end if;

  v_actor := row('collaborator'::public.actor_type, v_user_id, v_collaborator.id,
                 v_collaborator.display_name)::private.actor;

  -- PIN ------------------------------------------------------------------------
  if v_collaborator.pin_enabled then
    if v_secret.pin_locked_until > now() then
      return jsonb_build_object('ok', false, 'error', 'PIN_LOCKED',
                                'locked_until', v_secret.pin_locked_until);
    end if;

    if p_pin is distinct from v_secret.pin then
      v_secret.pin_failed_attempts := v_secret.pin_failed_attempts + 1;

      perform private.log_event(v_raffle.id, v_actor, 'access.pin_failed',
                                p_collaborator_id => v_collaborator.id, p_result => 'pin_failed');

      if v_secret.pin_failed_attempts >= 5 then
        update private.collaborator_secrets
           set pin_failed_attempts = 0, pin_locked_until = now() + interval '15 minutes'
         where collaborator_id = v_collaborator.id;
        perform private.log_event(v_raffle.id, v_actor, 'access.pin_locked',
                                  p_collaborator_id => v_collaborator.id);
        return jsonb_build_object('ok', false, 'error', 'PIN_LOCKED',
                                  'locked_until', now() + interval '15 minutes');
      end if;

      update private.collaborator_secrets
         set pin_failed_attempts = v_secret.pin_failed_attempts
       where collaborator_id = v_collaborator.id;
      return jsonb_build_object('ok', false, 'error', 'PIN_INCORRECT',
                                'attempts_left', 5 - v_secret.pin_failed_attempts);
    end if;

    update private.collaborator_secrets
       set pin_failed_attempts = 0, pin_locked_until = null
     where collaborator_id = v_collaborator.id;
  end if;

  -- Sesión del dispositivo ---------------------------------------------------------
  select * into v_existing
    from public.collaborator_sessions
   where raffle_id = v_raffle.id
     and auth_user_id = v_user_id
     and revoked_at is null
     for update;

  if found and v_existing.collaborator_id = v_collaborator.id then
    -- El mismo navegador vuelve a abrir su enlace: no es un dispositivo nuevo.
    update public.collaborator_sessions set last_seen_at = now() where id = v_existing.id;
    return jsonb_build_object('ok', true, 'raffle_id', v_raffle.id, 'collaborator_id', v_collaborator.id);
  end if;

  if found then
    -- Este navegador actuaba como otro colaborador de la misma rifa: se reemplaza.
    update public.collaborator_sessions
       set revoked_at = now(), revoked_reason = 'replaced_on_this_device'
     where id = v_existing.id;
    perform private.log_event(v_raffle.id, v_actor, 'access.device_replaced',
                              p_collaborator_id => v_existing.collaborator_id,
                              p_details => jsonb_build_object('reason', 'replaced_on_this_device'));
  end if;

  -- Máximo 2 dispositivos: el tercero reemplaza al usado hace más tiempo.
  if (select count(*) from public.collaborator_sessions
       where collaborator_id = v_collaborator.id and revoked_at is null) >= 2 then
    select id into v_oldest
      from public.collaborator_sessions
     where collaborator_id = v_collaborator.id
       and revoked_at is null
     order by last_seen_at asc
     limit 1;

    update public.collaborator_sessions
       set revoked_at = now(), revoked_reason = 'replaced_by_new_device'
     where id = v_oldest;
    perform private.log_event(v_raffle.id, v_actor, 'access.device_replaced',
                              p_collaborator_id => v_collaborator.id,
                              p_details => jsonb_build_object('reason', 'replaced_by_new_device'));
  end if;

  insert into public.collaborator_sessions (raffle_id, collaborator_id, auth_user_id)
  values (v_raffle.id, v_collaborator.id, v_user_id);

  update public.collaborators
     set first_activated_at = coalesce(first_activated_at, now()),
         last_activity_at = now()
   where id = v_collaborator.id;

  perform private.log_event(v_raffle.id, v_actor, 'access.activated', p_collaborator_id => v_collaborator.id);

  return jsonb_build_object('ok', true, 'raffle_id', v_raffle.id, 'collaborator_id', v_collaborator.id);
end;
$$;
