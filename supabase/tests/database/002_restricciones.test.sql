-- Restricciones del modelo de datos: estados imposibles que la base de datos
-- rechaza aunque el código de la aplicación tenga un error.
-- Se ejecuta como `postgres`, sin RLS: aquí solo se prueba la integridad.
begin;
create extension if not exists pgtap with schema extensions;

select plan(36);

-- Datos de partida ----------------------------------------------------------------
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-0000000000c1', 'creadora@test.local');
insert into auth.users (id, is_anonymous)
values ('00000000-0000-0000-0000-0000000000a1', true);

-- Perfiles ---------------------------------------------------------------------------
select is(
  (select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000000c1'),
  1,
  'al registrarse un creador se crea su perfil'
);
select is(
  (select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  0,
  'un usuario anónimo (colaborador) no recibe perfil'
);
select throws_ok(
  $$ update public.profiles set time_zone = 'Marte/Olympus' where id = '00000000-0000-0000-0000-0000000000c1' $$,
  '23514', null,
  'rechaza una zona horaria inexistente'
);

-- Rifas --------------------------------------------------------------------------------
insert into public.raffles (id, owner_id, name, price_minor, currency, draw_date, payment_deadline)
values (
  '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1',
  'Canasta Navideña', 200000, 'CRC', '2026-12-20', '2026-12-18'
);

select throws_ok(
  $$ insert into public.raffles (owner_id, name, price_minor, currency, draw_date, payment_deadline)
     values ('00000000-0000-0000-0000-0000000000c1', 'Rifa', 0, 'CRC', '2026-12-20', '2026-12-18') $$,
  '23514', null, 'rechaza un precio de 0'
);
select throws_ok(
  $$ insert into public.raffles (owner_id, name, price_minor, currency, draw_date, payment_deadline)
     values ('00000000-0000-0000-0000-0000000000c1', 'Rifa', 100, 'EUR', '2026-12-20', '2026-12-18') $$,
  '23514', null, 'rechaza una moneda no permitida'
);
select throws_ok(
  $$ insert into public.raffles (owner_id, name, price_minor, currency, draw_date, payment_deadline)
     values ('00000000-0000-0000-0000-0000000000c1', 'Rifa', 100, 'CRC', '2026-12-20', '2026-12-21') $$,
  '23514', null, 'rechaza una fecha límite de pago posterior al sorteo'
);
select throws_ok(
  $$ insert into public.raffles (owner_id, name, price_minor, currency, draw_date, payment_deadline)
     values ('00000000-0000-0000-0000-0000000000c1', 'R', 100, 'CRC', '2026-12-20', '2026-12-18') $$,
  '23514', null, 'rechaza un nombre de menos de 3 caracteres'
);
select throws_ok(
  $$ update public.raffles set status = 'active' where id = '10000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'una rifa no puede activarse sin reparto confirmado'
);
select throws_ok(
  $$ update public.raffles set number_count = 50 where id = '10000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'en el MVP toda rifa tiene exactamente 100 números'
);

-- Límite de 5 rifas por cuenta -------------------------------------------------------------
insert into public.raffles (owner_id, name, price_minor, currency, draw_date, payment_deadline)
select '00000000-0000-0000-0000-0000000000c1', 'Rifa ' || n, 100, 'CRC', '2026-12-20', '2026-12-18'
  from generate_series(2, 5) as n;

select is(
  (select count(*)::int from public.raffles where owner_id = '00000000-0000-0000-0000-0000000000c1'),
  5,
  'una cuenta puede tener 5 rifas'
);
select throws_ok(
  $$ insert into public.raffles (owner_id, name, price_minor, currency, draw_date, payment_deadline)
     values ('00000000-0000-0000-0000-0000000000c1', 'Rifa 6', 100, 'CRC', '2026-12-20', '2026-12-18') $$,
  'P0001', 'R4A_RAFFLE_LIMIT', 'la sexta rifa se rechaza'
);

-- Colaboradores ------------------------------------------------------------------------------
insert into public.collaborators (id, raffle_id, position, display_name, phone_e164) values
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 1, 'Carlos', '+50688887777'),
  ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001', 2, 'María', null);

select throws_ok(
  $$ insert into public.collaborators (raffle_id, position, display_name)
     values ('10000000-0000-0000-0000-000000000001', 13, 'José') $$,
  '23514', null, 'no puede haber un colaborador en la posición 13'
);
select throws_ok(
  $$ insert into public.collaborators (raffle_id, position, display_name)
     values ('10000000-0000-0000-0000-000000000001', 1, 'José') $$,
  '23505', null, 'dos colaboradores no pueden compartir posición'
);
select throws_ok(
  $$ insert into public.collaborators (raffle_id, position, display_name, phone_e164)
     values ('10000000-0000-0000-0000-000000000001', 3, 'José', '8888-7777') $$,
  '23514', null, 'el teléfono debe estar en formato E.164'
);
select throws_ok(
  $$ insert into public.collaborators (raffle_id, position, display_name)
     values ('10000000-0000-0000-0000-000000000001', 3, '   ') $$,
  '23514', null, 'el nombre del colaborador no puede estar vacío'
);

-- Secretos y sesiones ----------------------------------------------------------------------------
select throws_ok(
  $$ insert into private.collaborator_secrets (collaborator_id, token)
     values ('20000000-0000-0000-0000-00000000000a', 'corto') $$,
  '23514', null, 'el token debe tener 43 caracteres base64url'
);
select throws_ok(
  $$ insert into private.collaborator_secrets (collaborator_id, token, pin)
     values ('20000000-0000-0000-0000-00000000000a', repeat('a', 43), '12a4') $$,
  '23514', null, 'el PIN son exactamente 4 dígitos'
);

insert into public.collaborator_sessions (raffle_id, collaborator_id, auth_user_id)
values (
  '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-00000000000a',
  '00000000-0000-0000-0000-0000000000a1'
);
select throws_ok(
  $$ insert into public.collaborator_sessions (raffle_id, collaborator_id, auth_user_id)
     values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-00000000000b',
             '00000000-0000-0000-0000-0000000000a1') $$,
  '23505', null, 'un navegador solo actúa como un colaborador por rifa'
);

-- Números ------------------------------------------------------------------------------------------
insert into public.raffle_numbers (raffle_id, number, collaborator_id) values
  ('10000000-0000-0000-0000-000000000001', 0, '20000000-0000-0000-0000-00000000000a'),
  ('10000000-0000-0000-0000-000000000001', 1, '20000000-0000-0000-0000-00000000000b');

select throws_ok(
  $$ insert into public.raffle_numbers (raffle_id, number, collaborator_id)
     values ('10000000-0000-0000-0000-000000000001', 100, '20000000-0000-0000-0000-00000000000a') $$,
  '23514', null, 'no existe el número 100'
);
select throws_ok(
  $$ insert into public.raffle_numbers (raffle_id, number, collaborator_id)
     values ('10000000-0000-0000-0000-000000000001', 0, '20000000-0000-0000-0000-00000000000b') $$,
  '23505', null, 'un número no puede pertenecer a dos colaboradores'
);
select throws_ok(
  $$ update public.raffle_numbers set status = 'paid'
      where raffle_id = '10000000-0000-0000-0000-000000000001' and number = 0 $$,
  '23514', null, 'un número no puede estar ocupado sin una venta'
);

-- Ventas --------------------------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.sales (raffle_id, number, collaborator_id, status, buyer_name, buyer_phone_e164,
                               price_minor, currency, reserved_at, created_by_actor, created_by_user_id)
     values ('10000000-0000-0000-0000-000000000001', 0, '20000000-0000-0000-0000-00000000000b',
             'reserved', 'Ana', '+50670001111', 200000, 'CRC', now(), 'collaborator',
             '00000000-0000-0000-0000-0000000000a1') $$,
  '23503', null, 'un colaborador no puede vender un número ajeno'
);

insert into public.sales (id, raffle_id, number, collaborator_id, status, buyer_name, buyer_phone_e164,
                          price_minor, currency, reserved_at, created_by_actor, created_by_user_id)
values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 0,
        '20000000-0000-0000-0000-00000000000a', 'reserved', 'Ana', '+50670001111', 200000, 'CRC',
        now(), 'collaborator', '00000000-0000-0000-0000-0000000000a1');

select results_eq(
  $$ select status::text, current_sale_id, version from public.raffle_numbers
      where raffle_id = '10000000-0000-0000-0000-000000000001' and number = 0 $$,
  $$ values ('reserved', '30000000-0000-0000-0000-000000000001'::uuid, 2) $$,
  'al reservar, el número pasa a reservado, apunta a la venta y sube de versión'
);

select throws_ok(
  $$ insert into public.sales (raffle_id, number, collaborator_id, status, buyer_name, buyer_phone_e164,
                               price_minor, currency, reserved_at, created_by_actor, created_by_user_id)
     values ('10000000-0000-0000-0000-000000000001', 0, '20000000-0000-0000-0000-00000000000a',
             'reserved', 'Luis', '+50670002222', 200000, 'CRC', now(), 'collaborator',
             '00000000-0000-0000-0000-0000000000a1') $$,
  '23505', null, 'un número no puede tener dos ventas activas'
);
select throws_ok(
  $$ update public.sales set status = 'paid' where id = '30000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'una venta pagada necesita fecha de pago'
);
select throws_ok(
  $$ update public.sales set status = 'pending_payment' where id = '30000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'una venta pendiente necesita fecha de compromiso'
);
select throws_ok(
  $$ update public.sales set buyer_phone_e164 = '7000-1111' where id = '30000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'el teléfono del comprador debe estar en formato E.164'
);
select throws_ok(
  $$ update public.sales set status = 'cancelled' where id = '30000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'una venta cancelada necesita fecha y motivo'
);

update public.sales
   set status = 'paid', paid_at = now()
 where id = '30000000-0000-0000-0000-000000000001';

select results_eq(
  $$ select status::text, version from public.raffle_numbers
      where raffle_id = '10000000-0000-0000-0000-000000000001' and number = 0 $$,
  $$ values ('paid', 3) $$,
  'al pagar, el número pasa a pagado y vuelve a subir de versión'
);

update public.sales
   set status = 'cancelled', paid_at = null, ended_at = now(), end_reason = 'cancelled'
 where id = '30000000-0000-0000-0000-000000000001';

select results_eq(
  $$ select status::text, current_sale_id from public.raffle_numbers
      where raffle_id = '10000000-0000-0000-0000-000000000001' and number = 0 $$,
  $$ values ('available', null::uuid) $$,
  'al cancelar, el número vuelve a estar libre y sin venta'
);
select throws_ok(
  $$ update public.sales set note = 'reabrir' where id = '30000000-0000-0000-0000-000000000001' $$,
  'P0001', 'R4A_INVALID_TRANSITION', 'una venta cancelada no se puede modificar'
);
select lives_ok(
  $$ insert into public.sales (raffle_id, number, collaborator_id, status, buyer_name, buyer_phone_e164,
                               price_minor, currency, reserved_at, created_by_actor, created_by_user_id)
     values ('10000000-0000-0000-0000-000000000001', 0, '20000000-0000-0000-0000-00000000000a',
             'reserved', 'Luis', '+50670002222', 200000, 'CRC', now(), 'collaborator',
             '00000000-0000-0000-0000-0000000000a1') $$,
  'un número cancelado se puede volver a vender (nueva fila de venta)'
);

-- Log de auditoría --------------------------------------------------------------------------------------
insert into public.audit_events (raffle_id, actor_type, actor_user_id, actor_label, action)
values ('10000000-0000-0000-0000-000000000001', 'creator', '00000000-0000-0000-0000-0000000000c1',
        'Administrador', 'raffle.created');

select throws_ok(
  $$ insert into public.audit_events (raffle_id, actor_type, actor_user_id, actor_label, action, details)
     values ('10000000-0000-0000-0000-000000000001', 'creator', '00000000-0000-0000-0000-0000000000c1',
             'Administrador', 'sale.sold', '{"buyer_phone_e164": "+50670001111"}') $$,
  '23514', null, 'el log rechaza datos personales del comprador'
);
select throws_ok(
  $$ update public.audit_events set action = 'raffle.deleted' $$,
  'P0001', 'R4A_AUDIT_IMMUTABLE', 'el log no se puede modificar'
);
select throws_ok(
  $$ truncate public.audit_events $$,
  'P0001', 'R4A_AUDIT_IMMUTABLE', 'el log no se puede vaciar'
);

-- Borrado total de una rifa ------------------------------------------------------------------------------
delete from public.raffles where id = '10000000-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from public.audit_events where raffle_id = '10000000-0000-0000-0000-000000000001')
  + (select count(*)::int from public.sales where raffle_id = '10000000-0000-0000-0000-000000000001')
  + (select count(*)::int from public.raffle_numbers where raffle_id = '10000000-0000-0000-0000-000000000001')
  + (select count(*)::int from public.collaborators where raffle_id = '10000000-0000-0000-0000-000000000001'),
  0,
  'eliminar una rifa borra en cascada colaboradores, números, ventas y log'
);

select * from finish();
rollback;
