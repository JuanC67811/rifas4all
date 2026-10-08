-- Tareas programadas: vencimientos, cierre (sorteo + 2), borrado total (sorteo + 4),
-- cola del resumen diario y limpieza de usuarios anónimos. Todas idempotentes.
-- Las fechas se desplazan varios días para no depender de la hora UTC frente a la local.
begin;
create extension if not exists pgtap with schema extensions;

-- Cada archivo parte de una base vacía. Los datos del seed vuelven con el rollback final.
delete from auth.users;

select plan(23);

create function pg_temp.as_user(p_user_id uuid, p_is_anonymous boolean)
returns void
language sql
as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'is_anonymous', p_is_anonymous)::text,
    true);
$$;

-- Rifa activa de prueba con un colaborador dueño de los 100 números.
create function pg_temp.active_raffle(p_id uuid, p_owner uuid, p_draw date, p_deadline date)
returns void
language plpgsql
as $$
begin
  insert into public.raffles (id, owner_id, name, price_minor, currency, draw_date, payment_deadline,
                              status, distribution_method, distribution_confirmed_at, activated_at)
  values (p_id, p_owner, 'Rifa ' || left(p_id::text, 8), 100000, 'CRC', p_draw, p_deadline,
          'active', 'ordered', now(), now());
  insert into public.collaborators (id, raffle_id, position, display_name)
  values (p_id, p_id, 1, 'Carlos');  -- mismo uuid para simplificar
  insert into public.raffle_numbers (raffle_id, number, collaborator_id)
  select p_id, n, p_id from generate_series(0, 99) as n;
end;
$$;

create function pg_temp.pending_sale(p_raffle_id uuid, p_number smallint)
returns void
language sql
as $$
  insert into public.sales (raffle_id, number, collaborator_id, status, buyer_name, buyer_phone_e164,
                            price_minor, currency, committed_at, created_by_actor, created_by_user_id)
  values (p_raffle_id, p_number, p_raffle_id, 'pending_payment', 'Ana', '+50670001111',
          100000, 'CRC', now(), 'creator', (select owner_id from public.raffles where id = p_raffle_id));
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'creadora.a@test.local'),
  ('00000000-0000-0000-0000-0000000000c2', 'creador.sin.rifas@test.local'),
  ('00000000-0000-0000-0000-0000000000c3', 'creador.sin.correos@test.local');

-- R1: fecha límite vencida hace días, sorteo en el futuro.
select pg_temp.active_raffle('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1',
                             current_date + 10, current_date - 3);
-- R2: sorteo hace 3 días → debe cerrarse (sorteo + 2), aún no borrarse.
select pg_temp.active_raffle('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000c1',
                             current_date - 3, current_date - 4);
-- R3: sorteo hace 6 días → debe borrarse por completo (sorteo + 4).
select pg_temp.active_raffle('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000c1',
                             current_date - 6, current_date - 7);
-- R4: sorteo en el futuro y sin deudas vencidas → nada que hacer.
select pg_temp.active_raffle('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000c3',
                             current_date + 10, current_date + 5);
update public.profiles set digest_enabled = false where id = '00000000-0000-0000-0000-0000000000c3';

select pg_temp.pending_sale('10000000-0000-0000-0000-000000000001', 5::smallint);
select pg_temp.pending_sale('10000000-0000-0000-0000-000000000004', 5::smallint);

-- -----------------------------------------------------------------------------
-- Vencimientos
-- -----------------------------------------------------------------------------
select is(private.process_due_payments(), 1, 'una venta pendiente pasada de fecha se marca vencida');
select is(
  (select status::text from public.raffle_numbers
    where raffle_id = '10000000-0000-0000-0000-000000000001' and number = 5),
  'overdue',
  'el tablero muestra el número como vencido'
);
select results_eq(
  $$ select actor_type::text, actor_label, action, number::int from public.audit_events
      where raffle_id = '10000000-0000-0000-0000-000000000001' $$,
  $$ values ('system', 'Sistema', 'sale.overdue', 5) $$,
  'el vencimiento queda en el log a nombre del Sistema'
);
select is(private.process_due_payments(), 0, 'ejecutarlo de nuevo no cambia nada');
select is(
  (select status::text from public.sales
    where raffle_id = '10000000-0000-0000-0000-000000000004' and number = 5),
  'pending_payment',
  'una venta con la fecha límite en el futuro sigue pendiente'
);

-- El creador mueve la fecha límite hacia adelante con la función real.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1', false);
set local role authenticated;
select lives_ok(
  format($$ select public.update_raffle(%L, '{"payment_deadline": "%s"}') $$,
         '10000000-0000-0000-0000-000000000001', current_date + 5),
  'la creadora extiende la fecha límite'
);
reset role;
select is(
  (select status::text from public.sales
    where raffle_id = '10000000-0000-0000-0000-000000000001' and number = 5),
  'pending_payment',
  'al extender la fecha, la venta vencida vuelve a pendiente en la misma operación'
);
select is(
  (select count(*)::int from public.audit_events
    where raffle_id = '10000000-0000-0000-0000-000000000001' and action = 'sale.reopened'),
  1,
  'la reapertura queda en el log'
);

-- -----------------------------------------------------------------------------
-- Cierre y borrado
-- -----------------------------------------------------------------------------
select is(private.close_finished_raffles(), 2, 'se cierran las rifas cuyo sorteo + 2 días ya pasó (R2 y R3)');
select is(
  (select status::text from public.raffles where id = '10000000-0000-0000-0000-000000000002'),
  'closed',
  'R2 queda cerrada (solo lectura)'
);
select is(
  (select count(*)::int from public.audit_events
    where raffle_id = '10000000-0000-0000-0000-000000000002' and action = 'raffle.auto_closed'),
  1,
  'el cierre automático queda en el log'
);
select is(private.close_finished_raffles(), 0, 'cerrar de nuevo no cambia nada');

select is(private.delete_expired_raffles(), 1, 'se borra la rifa cuyo sorteo + 4 días ya pasó (R3)');
select is(
  (select count(*)::int from public.raffles where id = '10000000-0000-0000-0000-000000000003')
  + (select count(*)::int from public.raffle_numbers where raffle_id = '10000000-0000-0000-0000-000000000003')
  + (select count(*)::int from public.audit_events where raffle_id = '10000000-0000-0000-0000-000000000003'),
  0,
  'el borrado elimina la rifa, sus números y su log'
);
select is(
  (select count(*)::int from public.raffles where owner_id = '00000000-0000-0000-0000-0000000000c1'),
  2,
  'el borrado libera uno de los cupos de la cuenta'
);
select is(private.delete_expired_raffles(), 0, 'borrar de nuevo no cambia nada');

-- -----------------------------------------------------------------------------
-- Cola del resumen diario
-- -----------------------------------------------------------------------------
select is(private.enqueue_daily_digests(), 2, 'se encolan los resúmenes de ayer y anteayer de la creadora');
select is(private.enqueue_daily_digests(), 0, 'no se duplican');
select results_eq(
  $$ select user_id::text, status::text from public.daily_digests order by digest_date $$,
  $$ values ('00000000-0000-0000-0000-0000000000c1', 'pending'),
            ('00000000-0000-0000-0000-0000000000c1', 'pending') $$,
  'ni el creador sin rifas ni el que desactivó los correos reciben resumen'
);

-- -----------------------------------------------------------------------------
-- Limpieza de usuarios anónimos
-- -----------------------------------------------------------------------------
insert into auth.users (id, is_anonymous, created_at) values
  ('00000000-0000-0000-0000-0000000000a1', true, now() - interval '3 days'),  -- con sesión activa
  ('00000000-0000-0000-0000-0000000000a2', true, now() - interval '3 days'),  -- sesión revocada
  ('00000000-0000-0000-0000-0000000000a3', true, now() - interval '3 days'),  -- nunca activó
  ('00000000-0000-0000-0000-0000000000a4', true, now());                       -- recién creado
insert into public.collaborator_sessions (raffle_id, collaborator_id, auth_user_id, revoked_at, revoked_reason) values
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-0000000000a1', null, null),
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-0000000000a2', now(), 'access_regenerated');

select is(private.cleanup_anonymous_users(), 2, 'se borran los anónimos sin sesión activa con más de un día');
select set_eq(
  $$ select id::text from auth.users where is_anonymous $$,
  array['00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a4'],
  'se conservan el que tiene sesión activa y el recién creado'
);
select is(
  (select count(*)::int from auth.users where not is_anonymous),
  3,
  'nunca se borran cuentas de creadores'
);

-- -----------------------------------------------------------------------------
-- Programación
-- -----------------------------------------------------------------------------
select results_eq(
  $$ select jobname, schedule from cron.job where jobname like 'rifas4all-%' order by jobname $$,
  $$ values ('rifas4all-cada-15-minutos', '*/15 * * * *'), ('rifas4all-diario', '0 3 * * *') $$,
  'las tareas están programadas en pg_cron'
);

select * from finish();
rollback;
