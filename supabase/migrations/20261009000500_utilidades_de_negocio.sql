-- =============================================================================
-- Utilidades compartidas por las funciones de negocio
-- =============================================================================
-- Todo vive en `private`: ningún cliente puede llamarlas directamente. Las usan las
-- funciones RPC (SECURITY DEFINER), que se ejecutan con los privilegios de su dueño.

-- -----------------------------------------------------------------------------
-- Errores tipados
-- -----------------------------------------------------------------------------
-- Todas las reglas de negocio fallan con SQLSTATE P0001 y un código estable en el
-- mensaje (R4A_CONFLICT, R4A_FORBIDDEN…). El frontend traduce el código a un texto
-- en español en un único lugar (diseño §28).
create function private.fail(p_code text, p_detail text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = 'P0001',
    message = p_code,
    detail = coalesce(p_detail, '');
end;
$$;

-- -----------------------------------------------------------------------------
-- Fechas de la rifa (siempre en la zona horaria de la rifa)
-- -----------------------------------------------------------------------------
-- Hoy, en la zona horaria indicada.
create function private.local_today(p_time_zone text)
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone p_time_zone)::date;
$$;

-- Instante en que termina un día civil local (00:00 del día siguiente).
create function private.end_of_local_day(p_day date, p_time_zone text)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select ((p_day + 1)::timestamp) at time zone p_time_zone;
$$;

-- La rifa se cierra al empezar el día sorteo + 2 (diseño §20).
create function private.raffle_closes_at(p_raffle public.raffles)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select ((p_raffle.draw_date + 2)::timestamp) at time zone p_raffle.time_zone;
$$;

-- …y se borra por completo al empezar el día sorteo + 4.
create function private.raffle_deleted_at(p_raffle public.raffles)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select ((p_raffle.draw_date + 4)::timestamp) at time zone p_raffle.time_zone;
$$;

-- ¿Se pueden registrar ventas y pagos? Solo con la rifa activa y antes del cierre.
-- Se comprueba la hora además del estado: el job de cierre corre cada 15 minutos
-- y no debe existir una ventana en la que se pueda vender después del cierre.
create function private.raffle_accepts_changes(p_raffle public.raffles)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_raffle.status = 'active' and now() < private.raffle_closes_at(p_raffle);
$$;

-- Estado de una deuda según la fecha límite de pago: pendiente o ya vencida.
create function private.debt_status(p_raffle public.raffles)
returns public.sale_status
language sql
stable
set search_path = ''
as $$
  select case
           when now() >= private.end_of_local_day(p_raffle.payment_deadline, p_raffle.time_zone)
             then 'overdue'::public.sale_status
           else 'pending_payment'::public.sale_status
         end;
$$;

-- -----------------------------------------------------------------------------
-- Actor: quién realiza la acción
-- -----------------------------------------------------------------------------
create type private.actor as (
  actor_type public.actor_type,
  user_id uuid,
  collaborator_id uuid,
  label text
);

-- El creador autenticado, o error. Etiqueta para el log: "Administrador (Juan)".
create function private.require_creator()
returns private.actor
language plpgsql
stable
set search_path = ''
as $$
declare
  v_name text;
begin
  if not private.is_creator() then
    perform private.fail('R4A_FORBIDDEN', 'Esta acción requiere una cuenta de organizador.');
  end if;

  select nullif(btrim(p.display_name), '') into v_name
    from public.profiles p
   where p.id = auth.uid();

  return row(
    'creator'::public.actor_type,
    auth.uid(),
    null::uuid,
    case when v_name is null then 'Administrador' else 'Administrador (' || v_name || ')' end
  )::private.actor;
end;
$$;

-- Bloquea la rifa (FOR UPDATE) y comprueba que pertenece al creador autenticado.
-- Bloquearla serializa los cambios estructurales sobre una misma rifa.
create function private.lock_owned_raffle(p_raffle_id uuid)
returns public.raffles
language plpgsql
set search_path = ''
as $$
declare
  v_raffle public.raffles;
begin
  select * into v_raffle
    from public.raffles
   where id = p_raffle_id
     and owner_id = auth.uid()
     for update;

  -- Mismo error si no existe o es de otra cuenta: no se revela qué rifas existen.
  if not found or not private.is_creator() then
    perform private.fail('R4A_NOT_FOUND', 'La rifa no existe o no es tuya.');
  end if;

  return v_raffle;
end;
$$;

-- Quién actúa sobre una venta: el creador dueño de la rifa o el colaborador con
-- sesión válida. Registra además la actividad del colaborador (como mucho una
-- escritura cada 5 minutos para no generar carga innecesaria).
create function private.resolve_sale_actor(p_raffle_id uuid)
returns private.actor
language plpgsql
set search_path = ''
as $$
declare
  v_collaborator_id uuid;
  v_label text;
begin
  if private.owns_raffle(p_raffle_id) then
    return private.require_creator();
  end if;

  v_collaborator_id := private.current_collaborator_id(p_raffle_id);
  if v_collaborator_id is null then
    perform private.fail('R4A_FORBIDDEN', 'No tienes un acceso válido a esta rifa.');
  end if;

  update public.collaborators
     set last_activity_at = now()
   where id = v_collaborator_id
     and (last_activity_at is null or last_activity_at < now() - interval '5 minutes')
  returning display_name into v_label;

  update public.collaborator_sessions
     set last_seen_at = now()
   where raffle_id = p_raffle_id
     and auth_user_id = auth.uid()
     and revoked_at is null
     and last_seen_at < now() - interval '5 minutes';

  if v_label is null then
    select display_name into v_label from public.collaborators where id = v_collaborator_id;
  end if;

  return row('collaborator'::public.actor_type, auth.uid(), v_collaborator_id, v_label)::private.actor;
end;
$$;

-- -----------------------------------------------------------------------------
-- Log de auditoría
-- -----------------------------------------------------------------------------
-- Único punto de escritura del log. `details` nunca debe llevar datos del comprador
-- ni credenciales: la tabla lo rechaza con un CHECK como segunda barrera.
create function private.log_event(
  p_raffle_id uuid,
  p_actor private.actor,
  p_action text,
  p_collaborator_id uuid default null,
  p_number smallint default null,
  p_sale_id uuid default null,
  p_from_status text default null,
  p_to_status text default null,
  p_details jsonb default '{}'::jsonb,
  p_request_id uuid default null,
  p_result text default 'success'
)
returns bigint
language sql
set search_path = ''
as $$
  insert into public.audit_events (
    raffle_id, actor_type, actor_user_id, actor_collaborator_id, actor_label,
    collaborator_id, action, number, sale_id, from_status, to_status, details,
    request_id, result
  )
  values (
    p_raffle_id, p_actor.actor_type, p_actor.user_id, p_actor.collaborator_id, p_actor.label,
    p_collaborator_id, p_action, p_number, p_sale_id, p_from_status, p_to_status,
    coalesce(p_details, '{}'::jsonb), p_request_id, p_result
  )
  returning id;
$$;

-- Actor "Sistema" para los jobs programados.
create function private.system_actor()
returns private.actor
language sql
immutable
set search_path = ''
as $$
  select row('system'::public.actor_type, null::uuid, null::uuid, 'Sistema')::private.actor;
$$;

-- -----------------------------------------------------------------------------
-- Credenciales de acceso
-- -----------------------------------------------------------------------------
-- Token: 32 bytes aleatorios criptográficamente seguros, en base64url sin relleno
-- (43 caracteres). Imposible de adivinar o enumerar.
create function private.new_access_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select translate(rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='), '+/', '-_');
$$;

-- PIN de 4 dígitos generado por el sistema, evitando combinaciones obvias.
create function private.new_pin()
returns char(4)
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_bytes bytea;
  v_pin text;
begin
  loop
    v_bytes := extensions.gen_random_bytes(2);
    v_pin := lpad(((get_byte(v_bytes, 0) * 256 + get_byte(v_bytes, 1)) % 10000)::text, 4, '0');
    exit when v_pin !~ '^(\d)\1{3}$'  -- 0000, 1111…
      and v_pin not in ('0123', '1234', '2345', '3456', '4567', '5678', '6789',
                        '9876', '8765', '7654', '6543', '5432', '4321', '3210',
                        '1212', '1122', '2580', '1004', '2000', '1010');
  end loop;
  return v_pin;
end;
$$;
