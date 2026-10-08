-- =============================================================================
-- Ventas y pagos (diseño §15, §16, §21 y §28)
-- =============================================================================
-- Toda escritura sobre un número sigue el mismo orden de comprobaciones:
--   1. Actor válido (creador dueño o colaborador con sesión activa).
--   2. Rifa que acepta cambios (activa y antes del cierre).
--   3. Bloqueo de la fila del número (FOR UPDATE): serializa pestañas, dispositivos
--      y al creador con el colaborador.
--   4. Propiedad: un colaborador solo toca sus números. Se comprueba ANTES que la
--      versión para no revelar nada de números ajenos.
--   5. Idempotencia: si este request_id ya se aplicó, se devuelve el estado actual.
--   6. Versión esperada: si el número cambió desde que el usuario lo vio, CONFLICTO.
--   7. Transición válida según la máquina de estados.

-- -----------------------------------------------------------------------------
-- Pasos comunes
-- -----------------------------------------------------------------------------
create function private.lock_number(
  p_raffle_id uuid,
  p_number smallint,
  p_actor private.actor
)
returns public.raffle_numbers
language plpgsql
set search_path = ''
as $$
declare
  v_raffle public.raffles;
  v_number public.raffle_numbers;
begin
  -- FOR SHARE: impide que la rifa se cierre o se borre a mitad de la operación.
  select * into v_raffle from public.raffles where id = p_raffle_id for share;
  if not private.raffle_accepts_changes(v_raffle) then
    perform private.fail('R4A_RAFFLE_STATE', 'La rifa ya no acepta cambios.');
  end if;

  select * into v_number
    from public.raffle_numbers
   where raffle_id = p_raffle_id
     and number = p_number
     for update;

  if not found then
    perform private.fail('R4A_NOT_FOUND', 'Ese número no existe en esta rifa.');
  end if;
  if p_actor.actor_type = 'collaborator' and v_number.collaborator_id <> p_actor.collaborator_id then
    perform private.fail('R4A_FORBIDDEN', 'Ese número no es de tu lista.');
  end if;

  return v_number;
end;
$$;

create function private.already_applied(p_actor private.actor, p_request_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
      from public.audit_events
     where actor_user_id = p_actor.user_id
       and request_id = p_request_id
  );
$$;

create function private.check_version(p_number public.raffle_numbers, p_expected_version integer)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_expected_version is distinct from p_number.version then
    perform private.fail('R4A_CONFLICT', 'Este número cambió mientras lo editabas. Revisa su estado actual.');
  end if;
end;
$$;

-- Respuesta común: estado público del número después de la operación.
create function private.number_result(p_raffle_id uuid, p_number smallint, p_replayed boolean)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
           'number', number,
           'status', status,
           'version', version,
           'replayed', p_replayed
         )
    from public.raffle_numbers
   where raffle_id = p_raffle_id
     and number = p_number;
$$;

create function private.require_request_id(p_request_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_request_id is null then
    perform private.fail('R4A_VALIDATION', 'Falta el identificador de la operación.');
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Registrar una venta (reserva, venta pendiente o venta pagada)
-- -----------------------------------------------------------------------------
create function public.register_sale(
  p_raffle_id uuid,
  p_number smallint,
  p_status public.sale_status,
  p_buyer_name text,
  p_buyer_phone_e164 text,
  p_expected_version integer,
  p_request_id uuid,
  p_buyer_alias text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor private.actor;
  v_raffle public.raffles;
  v_number public.raffle_numbers;
  v_status public.sale_status;
  v_sale_id uuid;
  v_paid_late boolean := false;
begin
  perform private.require_request_id(p_request_id);
  v_actor := private.resolve_sale_actor(p_raffle_id);
  v_number := private.lock_number(p_raffle_id, p_number, v_actor);

  if private.already_applied(v_actor, p_request_id) then
    return private.number_result(p_raffle_id, p_number, true);
  end if;
  perform private.check_version(v_number, p_expected_version);

  if v_number.status <> 'available' then
    perform private.fail('R4A_INVALID_TRANSITION', 'Ese número ya está ocupado.');
  end if;
  if p_status not in ('reserved', 'pending_payment', 'paid') then
    perform private.fail('R4A_VALIDATION', 'Estado inicial no válido.');
  end if;

  select * into v_raffle from public.raffles where id = p_raffle_id;

  -- Una venta pendiente registrada después de la fecha límite nace vencida.
  v_status := case when p_status = 'pending_payment' then private.debt_status(v_raffle) else p_status end;
  if p_status = 'paid' then
    v_paid_late := now() >= private.end_of_local_day(v_raffle.payment_deadline, v_raffle.time_zone);
  end if;

  insert into public.sales (
    raffle_id, number, collaborator_id, status, buyer_name, buyer_alias, buyer_phone_e164, note,
    price_minor, currency, reserved_at, committed_at, paid_at, paid_late,
    created_by_actor, created_by_user_id
  )
  values (
    p_raffle_id, p_number, v_number.collaborator_id, v_status,
    btrim(p_buyer_name), nullif(btrim(p_buyer_alias), ''), btrim(p_buyer_phone_e164),
    nullif(btrim(p_note), ''),
    v_raffle.price_minor, v_raffle.currency,
    case when v_status = 'reserved' then now() end,
    case when v_status <> 'reserved' then now() end,
    case when v_status = 'paid' then now() end,
    v_paid_late,
    v_actor.actor_type, v_actor.user_id
  )
  returning id into v_sale_id;

  perform private.log_event(
    p_raffle_id, v_actor,
    case when v_status = 'reserved' then 'sale.reserved' else 'sale.sold' end,
    p_collaborator_id => v_number.collaborator_id,
    p_number => p_number,
    p_sale_id => v_sale_id,
    p_from_status => 'available',
    p_to_status => v_status::text,
    p_details => jsonb_build_object('price_minor', v_raffle.price_minor, 'currency', v_raffle.currency,
                                    'paid_late', v_paid_late),
    p_request_id => p_request_id
  );

  return private.number_result(p_raffle_id, p_number, false);
end;
$$;

-- -----------------------------------------------------------------------------
-- Cambiar el estado de una venta
-- -----------------------------------------------------------------------------
-- Acciones:
--   commit           reservado → pendiente (o vencido si ya pasó la fecha límite)
--   confirm_payment  reservado | pendiente | vencido → pagado
--   revert_payment   pagado → pendiente (o vencido). Motivo obligatorio.
--   cancel           reservado | pendiente | vencido → número libre
create function public.change_sale_status(
  p_raffle_id uuid,
  p_number smallint,
  p_action text,
  p_expected_version integer,
  p_request_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor private.actor;
  v_raffle public.raffles;
  v_number public.raffle_numbers;
  v_sale public.sales;
  v_to public.sale_status;
  v_reason text := nullif(btrim(p_reason), '');
  v_paid_late boolean;
  v_action_logged text;
begin
  perform private.require_request_id(p_request_id);
  v_actor := private.resolve_sale_actor(p_raffle_id);
  v_number := private.lock_number(p_raffle_id, p_number, v_actor);

  if private.already_applied(v_actor, p_request_id) then
    return private.number_result(p_raffle_id, p_number, true);
  end if;
  perform private.check_version(v_number, p_expected_version);

  select * into v_sale from public.sales where id = v_number.current_sale_id for update;
  if not found then
    perform private.fail('R4A_INVALID_TRANSITION', 'Ese número no tiene una venta.');
  end if;
  if char_length(v_reason) > 140 then
    perform private.fail('R4A_VALIDATION', 'El motivo admite como máximo 140 caracteres.');
  end if;

  select * into v_raffle from public.raffles where id = p_raffle_id;

  case p_action
    when 'commit' then
      if v_sale.status <> 'reserved' then
        perform private.fail('R4A_INVALID_TRANSITION', 'Solo una reserva se puede confirmar como compra.');
      end if;
      v_to := private.debt_status(v_raffle);
      update public.sales set status = v_to, committed_at = now() where id = v_sale.id;
      v_action_logged := 'sale.committed';

    when 'confirm_payment' then
      if v_sale.status not in ('reserved', 'pending_payment', 'overdue') then
        perform private.fail('R4A_INVALID_TRANSITION', 'Esta venta no tiene un pago pendiente.');
      end if;
      v_to := 'paid';
      v_paid_late := now() >= private.end_of_local_day(v_raffle.payment_deadline, v_raffle.time_zone);
      update public.sales
         set status = 'paid',
             paid_at = now(),
             paid_late = v_paid_late,
             committed_at = coalesce(committed_at, now())
       where id = v_sale.id;
      v_action_logged := 'sale.payment_confirmed';

    when 'revert_payment' then
      if v_sale.status <> 'paid' then
        perform private.fail('R4A_INVALID_TRANSITION', 'Solo se puede revertir un pago registrado.');
      end if;
      if v_reason is null then
        perform private.fail('R4A_VALIDATION', 'Indica el motivo para revertir el pago.');
      end if;
      v_to := private.debt_status(v_raffle);
      update public.sales
         set status = v_to, paid_at = null, paid_late = false
       where id = v_sale.id;
      v_action_logged := 'sale.payment_reverted';

    when 'cancel' then
      if v_sale.status not in ('reserved', 'pending_payment', 'overdue') then
        perform private.fail('R4A_INVALID_TRANSITION',
          'Una venta pagada no se cancela directamente: primero revierte el pago.');
      end if;
      v_to := 'cancelled';
      update public.sales
         set status = 'cancelled',
             ended_at = now(),
             end_reason = case when v_sale.status = 'overdue' then 'released' else 'cancelled' end
       where id = v_sale.id;
      v_action_logged := case when v_sale.status = 'overdue' then 'sale.released' else 'sale.cancelled' end;

    else
      perform private.fail('R4A_VALIDATION', 'Acción no reconocida.');
  end case;

  perform private.log_event(
    p_raffle_id, v_actor, v_action_logged,
    p_collaborator_id => v_number.collaborator_id,
    p_number => p_number,
    p_sale_id => v_sale.id,
    p_from_status => v_sale.status::text,
    p_to_status => v_to::text,
    p_details => jsonb_strip_nulls(jsonb_build_object('reason', v_reason, 'paid_late', v_paid_late)),
    p_request_id => p_request_id
  );

  return private.number_result(p_raffle_id, p_number, false);
end;
$$;

-- -----------------------------------------------------------------------------
-- Corregir los datos del comprador
-- -----------------------------------------------------------------------------
-- En el log se registran solo los NOMBRES de los campos cambiados.
create function public.update_buyer(
  p_raffle_id uuid,
  p_number smallint,
  p_buyer_name text,
  p_buyer_phone_e164 text,
  p_expected_version integer,
  p_request_id uuid,
  p_buyer_alias text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor private.actor;
  v_number public.raffle_numbers;
  v_sale public.sales;
  v_fields text[] := '{}';
  v_name text := btrim(p_buyer_name);
  v_phone text := btrim(p_buyer_phone_e164);
  v_alias text := nullif(btrim(p_buyer_alias), '');
  v_note text := nullif(btrim(p_note), '');
begin
  perform private.require_request_id(p_request_id);
  v_actor := private.resolve_sale_actor(p_raffle_id);
  v_number := private.lock_number(p_raffle_id, p_number, v_actor);

  if private.already_applied(v_actor, p_request_id) then
    return private.number_result(p_raffle_id, p_number, true);
  end if;
  perform private.check_version(v_number, p_expected_version);

  select * into v_sale from public.sales where id = v_number.current_sale_id for update;
  if not found then
    perform private.fail('R4A_INVALID_TRANSITION', 'Ese número no tiene una venta.');
  end if;

  if v_name is distinct from v_sale.buyer_name then v_fields := array_append(v_fields, 'buyer_name'); end if;
  if v_phone is distinct from v_sale.buyer_phone_e164 then v_fields := array_append(v_fields, 'buyer_phone'); end if;
  if v_alias is distinct from v_sale.buyer_alias then v_fields := array_append(v_fields, 'buyer_alias'); end if;
  if v_note is distinct from v_sale.note then v_fields := array_append(v_fields, 'buyer_note'); end if;

  if cardinality(v_fields) = 0 then
    return private.number_result(p_raffle_id, p_number, false);
  end if;

  update public.sales
     set buyer_name = v_name, buyer_phone_e164 = v_phone, buyer_alias = v_alias, note = v_note
   where id = v_sale.id;

  perform private.log_event(
    p_raffle_id, v_actor, 'sale.buyer_updated',
    p_collaborator_id => v_number.collaborator_id,
    p_number => p_number,
    p_sale_id => v_sale.id,
    p_details => jsonb_build_object('fields', to_jsonb(v_fields)),
    p_request_id => p_request_id
  );

  return private.number_result(p_raffle_id, p_number, false);
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos de ejecución (lista blanca, ADR 0002)
-- -----------------------------------------------------------------------------
grant execute on function public.update_profile(text, text, boolean, boolean) to authenticated;
grant execute on function public.create_raffle(text, bigint, text, date, date, text, text, boolean, text) to authenticated;
grant execute on function public.update_raffle(uuid, jsonb) to authenticated;
grant execute on function public.close_raffle(uuid) to authenticated;
grant execute on function public.delete_raffle(uuid, text) to authenticated;
grant execute on function public.set_collaborators(uuid, jsonb) to authenticated;
grant execute on function public.update_collaborator(uuid, text, text) to authenticated;
grant execute on function public.preview_distribution(uuid, public.distribution_method) to authenticated;
grant execute on function public.get_distribution_summary(uuid) to authenticated;
grant execute on function public.confirm_distribution(uuid) to authenticated;
grant execute on function public.get_access_credentials(uuid) to authenticated;
grant execute on function public.set_collaborator_paused(uuid, boolean) to authenticated;
grant execute on function public.regenerate_access(uuid) to authenticated;
grant execute on function public.activate_access(text, text) to authenticated;
grant execute on function public.register_sale(uuid, smallint, public.sale_status, text, text, integer, uuid, text, text) to authenticated;
grant execute on function public.change_sale_status(uuid, smallint, text, integer, uuid, text) to authenticated;
grant execute on function public.update_buyer(uuid, smallint, text, text, integer, uuid, text, text) to authenticated;

-- La vista previa del enlace es lo único disponible sin sesión.
grant execute on function public.get_invitation_preview(text) to anon, authenticated;
