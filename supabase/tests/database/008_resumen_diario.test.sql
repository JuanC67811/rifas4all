-- Resumen diario: contenido, permisos, reserva para envío y reintentos.
begin;
create extension if not exists pgtap with schema extensions;

-- Cada archivo parte de una base vacía. Los datos del seed vuelven con el rollback final.
delete from auth.users;

select plan(16);

create function pg_temp.as_user(p_user_id uuid, p_is_anonymous boolean)
returns void
language sql
as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'is_anonymous', p_is_anonymous)::text,
    true);
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'creadora@test.local'),
  ('00000000-0000-0000-0000-0000000000c2', 'sin.correos@test.local');
insert into auth.users (id, is_anonymous) values ('00000000-0000-0000-0000-0000000000a1', true);
update public.profiles set time_zone = 'America/Costa_Rica';
update public.profiles set digest_enabled = false where id = '00000000-0000-0000-0000-0000000000c2';

-- Rifa activa con la fecha límite dentro de 2 días y una venta pendiente.
insert into public.raffles (id, owner_id, name, price_minor, currency, draw_date, payment_deadline,
                            status, distribution_method, distribution_confirmed_at, activated_at)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'Canasta',
        200000, 'CRC', '2026-12-20', '2026-12-16', 'active', 'ordered', now(), now());
insert into public.collaborators (id, raffle_id, position, display_name)
values ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 1, 'Carlos');
insert into public.raffle_numbers (raffle_id, number, collaborator_id)
select '10000000-0000-0000-0000-000000000001', n, '20000000-0000-0000-0000-00000000000a'
  from generate_series(0, 99) as n;
insert into public.sales (id, raffle_id, number, collaborator_id, status, buyer_name, buyer_phone_e164,
                          price_minor, currency, committed_at, created_by_actor, created_by_user_id)
values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 7,
        '20000000-0000-0000-0000-00000000000a', 'pending_payment', 'Ana Mora', '+50670001111',
        200000, 'CRC', now(), 'creator', '00000000-0000-0000-0000-0000000000c1');

-- Un movimiento el 14/12 (hora de Costa Rica) y otro el 15/12, que no debe aparecer.
insert into public.audit_events (raffle_id, occurred_at, actor_type, actor_user_id, actor_label,
                                 collaborator_id, action, number, sale_id, to_status) values
  ('10000000-0000-0000-0000-000000000001', '2026-12-14 10:00 -06', 'creator',
   '00000000-0000-0000-0000-0000000000c1', 'Administrador', '20000000-0000-0000-0000-00000000000a',
   'sale.sold', 7, '30000000-0000-0000-0000-000000000001', 'pending_payment'),
  ('10000000-0000-0000-0000-000000000001', '2026-12-15 10:00 -06', 'creator',
   '00000000-0000-0000-0000-0000000000c1', 'Administrador', '20000000-0000-0000-0000-00000000000a',
   'sale.payment_confirmed', 7, '30000000-0000-0000-0000-000000000001', 'paid');

-- -----------------------------------------------------------------------------
-- Contenido
-- -----------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1', false);
set local role authenticated;

select is(
  jsonb_array_length(public.get_daily_digest('2026-12-14') -> 'raffles' -> 0 -> 'movements'),
  1,
  'el resumen incluye solo los movimientos de ese día en la zona del creador'
);
select is(
  public.get_daily_digest('2026-12-14') -> 'raffles' -> 0 -> 'movements' -> 0 ->> 'buyer_phone',
  '+50670001111',
  'incluye el teléfono del comprador si el creador lo permite'
);
select is(
  (public.get_daily_digest('2026-12-14') -> 'raffles' -> 0 ->> 'deadline_in_days')::int,
  1,
  'calcula los días que faltan para la fecha límite desde el día en que se lee'
);
select is(
  jsonb_array_length(public.get_daily_digest('2026-12-14') -> 'raffles' -> 0 -> 'to_collect'),
  1,
  'lista los cobros pendientes cuando la fecha límite está a 3 días o menos'
);
select is(
  jsonb_array_length(public.get_daily_digest('2026-12-01') -> 'raffles' -> 0 -> 'to_collect'),
  0,
  'con la fecha límite lejos, no lista cobros por vencer'
);

reset role;
update public.profiles set digest_include_phone = false where id = '00000000-0000-0000-0000-0000000000c1';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1', false);
set local role authenticated;
select is(
  public.get_daily_digest('2026-12-14') -> 'raffles' -> 0 -> 'movements' -> 0 ->> 'buyer_phone',
  null,
  'sin permiso del creador, el teléfono no se incluye'
);

reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select throws_ok(
  $$ select public.get_daily_digest('2026-12-14') $$,
  'P0001', 'R4A_FORBIDDEN', 'un colaborador no puede pedir resúmenes'
);
select throws_ok(
  $$ select * from public.claim_daily_digests(10) $$,
  '42501', null, 'un cliente no puede reservar resúmenes (solo la Edge Function)'
);

-- -----------------------------------------------------------------------------
-- Reserva y resultado del envío (como la Edge Function: rol service_role)
-- -----------------------------------------------------------------------------
reset role;
insert into public.daily_digests (user_id, digest_date) values
  ('00000000-0000-0000-0000-0000000000c1', '2026-12-14'),
  ('00000000-0000-0000-0000-0000000000c2', '2026-12-14');

set local role service_role;
select results_eq(
  $$ select user_id::text, email from public.claim_daily_digests(10) $$,
  $$ values ('00000000-0000-0000-0000-0000000000c1', 'creadora@test.local') $$,
  'reserva los pendientes con el correo del creador, salvo quien desactivó los resúmenes'
);
select is_empty(
  $$ select * from public.claim_daily_digests(10) $$,
  'un resumen reservado no se vuelve a reservar mientras se envía'
);

select public.complete_daily_digest('00000000-0000-0000-0000-0000000000c1', '2026-12-14', 'retry', null, 'HTTP 503');
select results_eq(
  $$ select status::text, attempts::int, next_attempt_at > now(), last_error from public.daily_digests
      where user_id = '00000000-0000-0000-0000-0000000000c1' $$,
  $$ values ('pending', 1, true, 'HTTP 503') $$,
  'un error temporal vuelve a pendiente y espera antes de reintentar'
);

reset role;
update public.daily_digests set attempts = 5 where user_id = '00000000-0000-0000-0000-0000000000c1';
set local role service_role;
select public.complete_daily_digest('00000000-0000-0000-0000-0000000000c1', '2026-12-14', 'retry', null, 'HTTP 503');
select is(
  (select status::text from public.daily_digests where user_id = '00000000-0000-0000-0000-0000000000c1'),
  'failed',
  'tras 5 intentos, el resumen queda como fallido'
);

reset role;
update public.daily_digests set status = 'pending', attempts = 0, next_attempt_at = now()
 where user_id = '00000000-0000-0000-0000-0000000000c1';
set local role service_role;
select * from public.claim_daily_digests(10);
select public.complete_daily_digest('00000000-0000-0000-0000-0000000000c1', '2026-12-14', 'sent', 're_123', null);
select results_eq(
  $$ select status::text, sent_at is not null, provider_message_id from public.daily_digests
      where user_id = '00000000-0000-0000-0000-0000000000c1' $$,
  $$ values ('sent', true, 're_123') $$,
  'un envío correcto guarda la fecha y el id del proveedor'
);

-- -----------------------------------------------------------------------------
-- Llamada programada
-- -----------------------------------------------------------------------------
reset role;
select is(
  private.trigger_digest_sender(),
  false,
  'sin la URL y el secreto en Vault, no se llama a la Edge Function'
);
select ok(
  (private.run_frequent_jobs() ? 'digest_sender_called'),
  'las tareas cada 15 minutos incluyen el envío del resumen'
);
select ok(
  not has_function_privilege('authenticated', 'public.complete_daily_digest(uuid, date, text, text, text)', 'execute'),
  'un cliente no puede marcar resúmenes como enviados'
);

select * from finish();
rollback;
