-- =============================================================================
-- Rifas, perfil y colaboradores (acciones del creador)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Perfil
-- -----------------------------------------------------------------------------
create function public.update_profile(
  p_display_name text,
  p_time_zone text,
  p_digest_enabled boolean,
  p_digest_include_phone boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor private.actor := private.require_creator();
begin
  update public.profiles
     set display_name = btrim(coalesce(p_display_name, '')),
         time_zone = p_time_zone,
         digest_enabled = p_digest_enabled,
         digest_include_phone = p_digest_include_phone
   where id = v_actor.user_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Crear rifa (en borrador)
-- -----------------------------------------------------------------------------
create function public.create_raffle(
  p_name text,
  p_price_minor bigint,
  p_currency text,
  p_draw_date date,
  p_payment_deadline date,
  p_time_zone text default 'America/Costa_Rica',
  p_description text default null,
  p_show_collaborator_names boolean default true,
  p_reminder_template text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor private.actor := private.require_creator();
  v_raffle_id uuid;
begin
  if not private.is_valid_time_zone(p_time_zone) then
    perform private.fail('R4A_VALIDATION', 'Zona horaria no válida.');
  end if;
  if p_draw_date < private.local_today(p_time_zone) then
    perform private.fail('R4A_VALIDATION', 'La fecha del sorteo no puede estar en el pasado.');
  end if;
  if p_payment_deadline < private.local_today(p_time_zone) then
    perform private.fail('R4A_VALIDATION', 'La fecha límite de pago no puede estar en el pasado.');
  end if;

  -- El límite de 5 rifas por cuenta lo aplica el trigger raffles_enforce_limit.
  insert into public.raffles (
    owner_id, name, description, price_minor, currency, draw_date, payment_deadline,
    time_zone, show_collaborator_names, reminder_template
  )
  values (
    v_actor.user_id, btrim(p_name), nullif(btrim(p_description), ''), p_price_minor,
    upper(p_currency), p_draw_date, p_payment_deadline, p_time_zone,
    coalesce(p_show_collaborator_names, true), nullif(btrim(p_reminder_template), '')
  )
  returning id into v_raffle_id;

  perform private.log_event(v_raffle_id, v_actor, 'raffle.created');
  return v_raffle_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Editar rifa
-- -----------------------------------------------------------------------------
-- Recibe solo los campos que cambian, por ejemplo {"name": "…", "draw_date": "…"}.
-- Qué se puede cambiar depende del estado (diseño §20):
--   Borrador: todo.
--   Activa:   nombre, descripción, fechas (sorteo solo a futuro), nombres visibles,
--             plantilla; precio solo si aún no hay ventas. Nunca moneda ni zona horaria.
--   Cerrada:  nada.
create function public.update_raffle(p_raffle_id uuid, p_changes jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor private.actor := private.require_creator();
  v_raffle public.raffles := private.lock_owned_raffle(p_raffle_id);
  v_allowed text[] := array[
    'name', 'description', 'price_minor', 'currency', 'draw_date', 'payment_deadline',
    'time_zone', 'show_collaborator_names', 'reminder_template'
  ];
  v_keys text[];
  v_has_sales boolean;
begin
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' or p_changes = '{}'::jsonb then
    perform private.fail('R4A_VALIDATION', 'No hay cambios.');
  end if;

  select array_agg(k order by k) into v_keys from jsonb_object_keys(p_changes) as k;
  if not v_keys <@ v_allowed then
    perform private.fail('R4A_VALIDATION', 'Campos no permitidos.');
  end if;

  if v_raffle.status = 'closed' then
    perform private.fail('R4A_RAFFLE_STATE', 'Una rifa cerrada no se puede modificar.');
  end if;

  if v_raffle.status = 'active' then
    if p_changes ?| array['currency', 'time_zone'] then
      perform private.fail('R4A_RAFFLE_STATE', 'La moneda y la zona horaria no cambian con la rifa activa.');
    end if;

    if p_changes ? 'price_minor' then
      select exists (select 1 from public.sales where raffle_id = p_raffle_id) into v_has_sales;
      if v_has_sales then
        perform private.fail('R4A_RAFFLE_STATE', 'El precio no cambia después de la primera venta.');
      end if;
    end if;
  end if;

  if p_changes ? 'draw_date'
     and (p_changes ->> 'draw_date')::date
         < private.local_today(coalesce(p_changes ->> 'time_zone', v_raffle.time_zone)) then
    perform private.fail('R4A_VALIDATION', 'La nueva fecha del sorteo no puede estar en el pasado.');
  end if;

  update public.raffles
     set name = case when p_changes ? 'name' then btrim(p_changes ->> 'name') else name end,
         description = case when p_changes ? 'description'
                            then nullif(btrim(p_changes ->> 'description'), '') else description end,
         price_minor = case when p_changes ? 'price_minor'
                            then (p_changes ->> 'price_minor')::bigint else price_minor end,
         currency = case when p_changes ? 'currency'
                         then upper(p_changes ->> 'currency') else currency end,
         draw_date = case when p_changes ? 'draw_date'
                          then (p_changes ->> 'draw_date')::date else draw_date end,
         payment_deadline = case when p_changes ? 'payment_deadline'
                                 then (p_changes ->> 'payment_deadline')::date else payment_deadline end,
         time_zone = case when p_changes ? 'time_zone' then p_changes ->> 'time_zone' else time_zone end,
         show_collaborator_names = case when p_changes ? 'show_collaborator_names'
                                        then (p_changes ->> 'show_collaborator_names')::boolean
                                        else show_collaborator_names end,
         reminder_template = case when p_changes ? 'reminder_template'
                                  then nullif(btrim(p_changes ->> 'reminder_template'), '')
                                  else reminder_template end
   where id = p_raffle_id;

  -- Se registran los NOMBRES de los campos cambiados, no sus valores.
  perform private.log_event(p_raffle_id, v_actor, 'raffle.updated',
                            p_details => jsonb_build_object('fields', to_jsonb(v_keys)));
end;
$$;

-- -----------------------------------------------------------------------------
-- Cerrar y eliminar
-- -----------------------------------------------------------------------------
-- Cierre manual anticipado: la rifa queda en solo lectura. El borrado sigue
-- siendo en sorteo + 4 días (diseño §20).
create function public.close_raffle(p_raffle_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor private.actor := private.require_creator();
  v_raffle public.raffles := private.lock_owned_raffle(p_raffle_id);
begin
  if v_raffle.status <> 'active' then
    perform private.fail('R4A_RAFFLE_STATE', 'Solo se puede cerrar una rifa activa.');
  end if;

  update public.raffles set status = 'closed', closed_at = now() where id = p_raffle_id;
  perform private.log_event(p_raffle_id, v_actor, 'raffle.closed', p_from_status => 'active', p_to_status => 'closed');
end;
$$;

-- Eliminación total (rifa, colaboradores, sesiones, números, ventas y log).
-- Exige escribir el nombre de la rifa. Una rifa activa hay que cerrarla antes.
create function public.delete_raffle(p_raffle_id uuid, p_confirmation_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_raffle public.raffles := private.lock_owned_raffle(p_raffle_id);
begin
  perform private.require_creator();

  if v_raffle.status = 'active' then
    perform private.fail('R4A_RAFFLE_STATE', 'Cierra la rifa antes de eliminarla.');
  end if;
  if btrim(coalesce(p_confirmation_name, '')) <> v_raffle.name then
    perform private.fail('R4A_VALIDATION', 'El nombre escrito no coincide con el de la rifa.');
  end if;

  delete from public.raffles where id = p_raffle_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Colaboradores
-- -----------------------------------------------------------------------------
-- Guarda la lista completa de colaboradores de un borrador (1 a 12), en el orden
-- recibido. Formato: [{"display_name": "Carlos", "phone_e164": "+506…", "pin_enabled": true}, …]
-- Cambiar la lista descarta la vista previa del reparto.
create function public.set_collaborators(p_raffle_id uuid, p_collaborators jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor private.actor := private.require_creator();
  v_raffle public.raffles := private.lock_owned_raffle(p_raffle_id);
  v_count integer;
begin
  if v_raffle.status <> 'draft' then
    perform private.fail('R4A_RAFFLE_STATE', 'Los colaboradores solo se cambian en borrador.');
  end if;
  if p_collaborators is null or jsonb_typeof(p_collaborators) <> 'array' then
    perform private.fail('R4A_VALIDATION', 'Lista de colaboradores no válida.');
  end if;

  v_count := jsonb_array_length(p_collaborators);
  if v_count < 1 or v_count > 12 then
    perform private.fail('R4A_VALIDATION', 'Una rifa tiene entre 1 y 12 colaboradores.');
  end if;

  delete from public.raffle_numbers where raffle_id = p_raffle_id;
  delete from public.collaborators where raffle_id = p_raffle_id;

  insert into public.collaborators (raffle_id, position, display_name, phone_e164, pin_enabled)
  select p_raffle_id,
         item.ordinality,
         btrim(item.value ->> 'display_name'),
         nullif(btrim(item.value ->> 'phone_e164'), ''),
         coalesce((item.value ->> 'pin_enabled')::boolean, false)
    from jsonb_array_elements(p_collaborators) with ordinality as item(value, ordinality);

  update public.raffles set distribution_method = null where id = p_raffle_id;

  perform private.log_event(p_raffle_id, v_actor, 'collaborator.list_saved',
                            p_details => jsonb_build_object('count', v_count));
end;
$$;

-- Cambiar nombre o teléfono de un colaborador (borrador o activa).
create function public.update_collaborator(
  p_collaborator_id uuid,
  p_display_name text,
  p_phone_e164 text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor private.actor := private.require_creator();
  v_raffle_id uuid;
  v_raffle public.raffles;
begin
  select raffle_id into v_raffle_id from public.collaborators where id = p_collaborator_id;
  v_raffle := private.lock_owned_raffle(v_raffle_id);

  if v_raffle.status = 'closed' then
    perform private.fail('R4A_RAFFLE_STATE', 'Una rifa cerrada no se puede modificar.');
  end if;

  update public.collaborators
     set display_name = btrim(p_display_name),
         phone_e164 = nullif(btrim(p_phone_e164), '')
   where id = p_collaborator_id;

  perform private.log_event(v_raffle.id, v_actor, 'collaborator.updated', p_collaborator_id => p_collaborator_id);
end;
$$;
