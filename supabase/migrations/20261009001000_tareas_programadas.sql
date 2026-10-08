-- =============================================================================
-- Tareas programadas (diseño §17, §19 y §20)
-- =============================================================================
-- Todas son idempotentes: ejecutarlas dos veces seguidas no cambia nada la segunda
-- vez. Así, si pg_cron se retrasa o se repite, el resultado es el mismo.

-- -----------------------------------------------------------------------------
-- Vencimientos de pago
-- -----------------------------------------------------------------------------
-- Pendiente → vencido cuando termina el día de la fecha límite (zona de la rifa).
-- Vencido → pendiente si el creador movió la fecha límite hacia adelante.
-- Con p_raffle_id se recalcula solo esa rifa (lo usa update_raffle).
create function private.process_due_payments(p_raffle_id uuid default null)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_sale record;
  v_changed integer := 0;
begin
  for v_sale in
    select s.id, s.raffle_id, s.number, s.collaborator_id, s.status,
           case when s.status = 'pending_payment' then 'overdue' else 'pending_payment' end
             ::public.sale_status as new_status
      from public.sales s
      join public.raffles r on r.id = s.raffle_id
     where r.status = 'active'
       and (p_raffle_id is null or r.id = p_raffle_id)
       and (
         (s.status = 'pending_payment'
            and now() >= private.end_of_local_day(r.payment_deadline, r.time_zone))
         or (s.status = 'overdue'
            and now() < private.end_of_local_day(r.payment_deadline, r.time_zone))
       )
     order by s.raffle_id, s.number
     for update of s
  loop
    update public.sales set status = v_sale.new_status where id = v_sale.id;

    perform private.log_event(
      v_sale.raffle_id, private.system_actor(),
      case when v_sale.new_status = 'overdue' then 'sale.overdue' else 'sale.reopened' end,
      p_collaborator_id => v_sale.collaborator_id,
      p_number => v_sale.number,
      p_sale_id => v_sale.id,
      p_from_status => v_sale.status::text,
      p_to_status => v_sale.new_status::text
    );
    v_changed := v_changed + 1;
  end loop;

  return v_changed;
end;
$$;

-- -----------------------------------------------------------------------------
-- Cierre automático: sorteo + 2 días (solo lectura)
-- -----------------------------------------------------------------------------
create function private.close_finished_raffles()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_raffle record;
  v_closed integer := 0;
begin
  for v_raffle in
    select r.id
      from public.raffles r
     where r.status = 'active'
       and now() >= private.raffle_closes_at(r)
       for update
  loop
    update public.raffles set status = 'closed', closed_at = now() where id = v_raffle.id;
    perform private.log_event(v_raffle.id, private.system_actor(), 'raffle.auto_closed',
                              p_from_status => 'active', p_to_status => 'closed');
    v_closed := v_closed + 1;
  end loop;

  return v_closed;
end;
$$;

-- -----------------------------------------------------------------------------
-- Borrado total: sorteo + 4 días
-- -----------------------------------------------------------------------------
-- Borra la rifa completa en cascada (colaboradores, sesiones, números, ventas y
-- log) y libera uno de los 5 cupos de la cuenta. Incluye borradores abandonados
-- cuya fecha de sorteo ya pasó, para que no ocupen cupo para siempre.
create function private.delete_expired_raffles()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.raffles r
   where now() >= private.raffle_deleted_at(r);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- -----------------------------------------------------------------------------
-- Cola del resumen diario
-- -----------------------------------------------------------------------------
-- Crea la fila del resumen de "ayer" (en la zona horaria de cada creador) cuando
-- ya pasó su medianoche. Incluye anteayer para recuperar un día si el job estuvo
-- caído. La clave (user_id, digest_date) impide duplicados. El envío y el contenido
-- llegan en la fase 6; si no hubo movimientos, el resumen quedará como 'empty'.
create function private.enqueue_daily_digests()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_created integer;
begin
  insert into public.daily_digests (user_id, digest_date)
  select p.id, private.local_today(p.time_zone) - d.days_back
    from public.profiles p
    cross join (values (1), (2)) as d (days_back)
   where p.digest_enabled
     and exists (
       select 1 from public.raffles r
        where r.owner_id = p.id
          and r.status in ('active', 'closed')
     )
  on conflict (user_id, digest_date) do nothing;

  get diagnostics v_created = row_count;
  return v_created;
end;
$$;

-- -----------------------------------------------------------------------------
-- Limpieza de usuarios anónimos
-- -----------------------------------------------------------------------------
-- Navegadores de colaboradores sin ninguna sesión activa (rifa borrada, acceso
-- regenerado, dispositivo reemplazado) o que nunca llegaron a activar un acceso.
-- Se espera un día de margen para no borrar a alguien a mitad de la activación.
create function private.cleanup_anonymous_users()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from auth.users u
   where u.is_anonymous
     and u.created_at < now() - interval '1 day'
     and not exists (
       select 1
         from public.collaborator_sessions s
        where s.auth_user_id = u.id
          and s.revoked_at is null
     );
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- -----------------------------------------------------------------------------
-- Puntos de entrada de pg_cron
-- -----------------------------------------------------------------------------
-- El orden importa: primero vencimientos (con la rifa aún activa), luego cierre,
-- luego borrado y por último la cola del resumen.
create function private.run_frequent_jobs()
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_overdue integer := private.process_due_payments();
  v_closed integer := private.close_finished_raffles();
  v_deleted integer := private.delete_expired_raffles();
  v_digests integer := private.enqueue_daily_digests();
begin
  return jsonb_build_object(
    'payments_updated', v_overdue,
    'raffles_closed', v_closed,
    'raffles_deleted', v_deleted,
    'digests_enqueued', v_digests
  );
end;
$$;

create function private.run_daily_jobs()
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  return jsonb_build_object('anonymous_users_deleted', private.cleanup_anonymous_users());
end;
$$;

-- -----------------------------------------------------------------------------
-- update_raffle: recalcular vencimientos al cambiar la fecha límite
-- -----------------------------------------------------------------------------
-- Si el creador mueve la fecha límite, los números vencidos vuelven a pendientes
-- (o al revés) en la misma transacción, sin esperar al job.
create function private.after_raffle_deadline_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform private.process_due_payments(new.id);
  return new;
end;
$$;

create trigger raffles_recompute_payments
  after update of payment_deadline on public.raffles
  for each row
  when (old.payment_deadline is distinct from new.payment_deadline and new.status = 'active')
  execute function private.after_raffle_deadline_change();

-- -----------------------------------------------------------------------------
-- Programación
-- -----------------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;

-- Cada 15 minutos: el cierre y el borrado ocurren como mucho 15 minutos después de
-- su hora. Las funciones de venta comprueban además la hora de cierre, así que
-- nunca se puede vender después del cierre aunque el job se retrase.
select cron.schedule('rifas4all-cada-15-minutos', '*/15 * * * *', 'select private.run_frequent_jobs()');
-- Una vez al día (03:00 UTC): limpieza de usuarios anónimos.
select cron.schedule('rifas4all-diario', '0 3 * * *', 'select private.run_daily_jobs()');
