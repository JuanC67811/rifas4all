-- =============================================================================
-- Triggers de integridad
-- =============================================================================
-- Reglas que no se pueden expresar con CHECK/UNIQUE pero deben cumplirse siempre,
-- venga el cambio de la función que venga.

-- -----------------------------------------------------------------------------
-- Perfil automático para cada creador
-- -----------------------------------------------------------------------------
-- Los usuarios anónimos (colaboradores) no reciben perfil: no son creadores.
create function private.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(new.is_anonymous, false) then
    insert into public.profiles (id) values (new.id);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.create_profile_for_new_user();

-- -----------------------------------------------------------------------------
-- updated_at automático en rifas
-- -----------------------------------------------------------------------------
create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger raffles_touch_updated_at
  before update on public.raffles
  for each row execute function private.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Máximo 5 rifas por cuenta, en cualquier estado (diseño §20)
-- -----------------------------------------------------------------------------
-- Se bloquea la fila del perfil antes de contar: si dos pestañas crean la 5.ª y
-- la 6.ª a la vez, la segunda espera a la primera y luego ve 5 rifas.
create function private.enforce_raffle_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  existing integer;
begin
  perform 1 from public.profiles where id = new.owner_id for update;

  select count(*) into existing from public.raffles where owner_id = new.owner_id;

  if existing >= 5 then
    raise exception using
      errcode = 'P0001',
      message = 'R4A_RAFFLE_LIMIT',
      detail = 'Una cuenta puede tener como máximo 5 rifas. Elimina una para crear otra.';
  end if;

  return new;
end;
$$;

create trigger raffles_enforce_limit
  before insert on public.raffles
  for each row execute function private.enforce_raffle_limit();

-- -----------------------------------------------------------------------------
-- El estado del número se deriva de su venta
-- -----------------------------------------------------------------------------
-- `sales` es la fuente de verdad; `raffle_numbers` es la proyección pública.
-- Al derivarla aquí, ambas tablas no pueden quedar en desacuerdo, y cada cambio
-- de una venta incrementa la versión del número (concurrencia optimista).
create function private.sync_number_from_sale()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'cancelled' then
    update public.raffle_numbers
       set status = 'available',
           current_sale_id = null,
           version = version + 1,
           updated_at = now()
     where raffle_id = new.raffle_id
       and number = new.number
       and current_sale_id = new.id;
  else
    update public.raffle_numbers
       set status = new.status::text::public.number_status,
           current_sale_id = new.id,
           version = version + 1,
           updated_at = now()
     where raffle_id = new.raffle_id
       and number = new.number;
  end if;

  return new;
end;
$$;

create trigger sales_sync_number
  after insert or update on public.sales
  for each row execute function private.sync_number_from_sale();

-- Una venta cancelada no se reabre: para volver a vender se crea otra venta.
create function private.forbid_reopening_cancelled_sale()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'cancelled' then
    raise exception using
      errcode = 'P0001',
      message = 'R4A_INVALID_TRANSITION',
      detail = 'Una venta cancelada no se puede modificar.';
  end if;
  return new;
end;
$$;

create trigger sales_forbid_reopening
  before update on public.sales
  for each row execute function private.forbid_reopening_cancelled_sale();

-- -----------------------------------------------------------------------------
-- Log append-only
-- -----------------------------------------------------------------------------
-- Ningún rol puede modificar un evento ya registrado. El borrado no se bloquea con
-- trigger porque impediría el borrado en cascada al eliminar una rifa o una cuenta
-- (revisión crítica H-21); los clientes simplemente no tienen permiso de DELETE.
create function private.forbid_audit_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = 'P0001',
    message = 'R4A_AUDIT_IMMUTABLE',
    detail = 'El log de auditoría no se puede modificar.';
end;
$$;

create trigger audit_events_forbid_update
  before update on public.audit_events
  for each row execute function private.forbid_audit_changes();

create trigger audit_events_forbid_truncate
  before truncate on public.audit_events
  for each statement execute function private.forbid_audit_changes();
