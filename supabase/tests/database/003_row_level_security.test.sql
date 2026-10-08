-- Row Level Security probado con cada perfil de usuario (diseño §25).
-- Cada bloque cambia de identidad simulando el JWT que enviaría Supabase Auth.
begin;
create extension if not exists pgtap with schema extensions;

select plan(37);

-- -----------------------------------------------------------------------------
-- Utilidad: simular el JWT de un usuario (se llama siendo `postgres`)
-- -----------------------------------------------------------------------------
create function pg_temp.as_user(p_user_id uuid, p_is_anonymous boolean)
returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', p_user_id,
      'role', 'authenticated',
      'is_anonymous', p_is_anonymous
    )::text,
    true
  );
$$;

-- -----------------------------------------------------------------------------
-- Escenario
-- -----------------------------------------------------------------------------
-- Creadora A (dueña de R1) y creador B (dueño de R2).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'creadora.a@test.local'),
  ('00000000-0000-0000-0000-0000000000c2', 'creador.b@test.local');

-- Navegadores de colaboradores (usuarios anónimos).
insert into auth.users (id, is_anonymous) values
  ('00000000-0000-0000-0000-0000000000a1', true),  -- Carlos (R1)
  ('00000000-0000-0000-0000-0000000000a2', true),  -- María (R1)
  ('00000000-0000-0000-0000-0000000000a3', true),  -- Pedro (R1, pausado)
  ('00000000-0000-0000-0000-0000000000a4', true),  -- sesión revocada de Carlos
  ('00000000-0000-0000-0000-0000000000a5', true),  -- Lucía (R2)
  ('00000000-0000-0000-0000-0000000000a6', true);  -- anónimo sin ninguna sesión

insert into public.raffles (id, owner_id, name, price_minor, currency, draw_date, payment_deadline,
                            status, distribution_method, distribution_confirmed_at, activated_at) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'Canasta Navideña',
   200000, 'CRC', '2026-12-20', '2026-12-18', 'active', 'ordered', now(), now()),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000c2', 'Rifa del Kínder',
   100000, 'CRC', '2026-12-20', '2026-12-18', 'active', 'ordered', now(), now());

insert into public.collaborators (id, raffle_id, position, display_name, phone_e164, is_paused) values
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 1, 'Carlos', '+50688880001', false),
  ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001', 2, 'María', '+50688880002', false),
  ('20000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-000000000001', 3, 'Pedro', null, true),
  ('20000000-0000-0000-0000-00000000000d', '10000000-0000-0000-0000-000000000002', 1, 'Lucía', null, false);

insert into public.collaborator_sessions (raffle_id, collaborator_id, auth_user_id, revoked_at, revoked_reason) values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', null, null),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000a2', null, null),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000000a3', null, null),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a4', now(), 'access_regenerated'),
  ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-0000000000a5', null, null);

insert into public.raffle_numbers (raffle_id, number, collaborator_id) values
  ('10000000-0000-0000-0000-000000000001', 0, '20000000-0000-0000-0000-00000000000a'),
  ('10000000-0000-0000-0000-000000000001', 1, '20000000-0000-0000-0000-00000000000b'),
  ('10000000-0000-0000-0000-000000000001', 2, '20000000-0000-0000-0000-00000000000c'),
  ('10000000-0000-0000-0000-000000000002', 0, '20000000-0000-0000-0000-00000000000d');

insert into public.sales (raffle_id, number, collaborator_id, status, buyer_name, buyer_phone_e164,
                          price_minor, currency, reserved_at, created_by_actor, created_by_user_id) values
  ('10000000-0000-0000-0000-000000000001', 0, '20000000-0000-0000-0000-00000000000a', 'reserved',
   'Ana (compradora de Carlos)', '+50670000001', 200000, 'CRC', now(), 'collaborator', '00000000-0000-0000-0000-0000000000a1'),
  ('10000000-0000-0000-0000-000000000001', 1, '20000000-0000-0000-0000-00000000000b', 'reserved',
   'Beto (comprador de María)', '+50670000002', 200000, 'CRC', now(), 'collaborator', '00000000-0000-0000-0000-0000000000a2'),
  ('10000000-0000-0000-0000-000000000002', 0, '20000000-0000-0000-0000-00000000000d', 'reserved',
   'Cata (compradora de Lucía)', '+50670000003', 100000, 'CRC', now(), 'collaborator', '00000000-0000-0000-0000-0000000000a5');

insert into public.audit_events (raffle_id, actor_type, actor_user_id, actor_collaborator_id, actor_label, collaborator_id, action) values
  ('10000000-0000-0000-0000-000000000001', 'creator', '00000000-0000-0000-0000-0000000000c1', null, 'Administrador', null, 'raffle.activated'),
  ('10000000-0000-0000-0000-000000000001', 'collaborator', '00000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-00000000000a', 'Carlos', '20000000-0000-0000-0000-00000000000a', 'sale.reserved'),
  ('10000000-0000-0000-0000-000000000001', 'collaborator', '00000000-0000-0000-0000-0000000000a2', '20000000-0000-0000-0000-00000000000b', 'María', '20000000-0000-0000-0000-00000000000b', 'sale.reserved'),
  ('10000000-0000-0000-0000-000000000002', 'collaborator', '00000000-0000-0000-0000-0000000000a5', '20000000-0000-0000-0000-00000000000d', 'Lucía', '20000000-0000-0000-0000-00000000000d', 'sale.reserved');

insert into public.daily_digests (user_id, digest_date) values
  ('00000000-0000-0000-0000-0000000000c1', '2026-12-01'),
  ('00000000-0000-0000-0000-0000000000c2', '2026-12-01');

-- -----------------------------------------------------------------------------
-- Creadora A: ve todo lo de SU rifa y nada de la de B
-- -----------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1', false);
set local role authenticated;

select results_eq(
  'select id::text from public.profiles',
  array['00000000-0000-0000-0000-0000000000c1'],
  'creadora: lee solo su propio perfil'
);
select results_eq(
  'select name from public.raffles',
  array['Canasta Navideña'],
  'creadora: lee solo sus rifas'
);
select is((select count(*)::int from public.collaborators), 3, 'creadora: lee sus 3 colaboradores');
select is((select count(*)::int from public.collaborator_sessions), 4, 'creadora: lee las sesiones de su rifa');
select is((select count(*)::int from public.raffle_numbers), 3, 'creadora: lee el tablero de su rifa');
select set_eq(
  'select buyer_name from public.sales',
  array['Ana (compradora de Carlos)', 'Beto (comprador de María)'],
  'creadora: lee todas las ventas de su rifa y ninguna ajena'
);
select is((select count(*)::int from public.audit_events), 3, 'creadora: lee todo el log de su rifa');
select is((select count(*)::int from public.daily_digests), 1, 'creadora: lee solo sus resúmenes diarios');

-- -----------------------------------------------------------------------------
-- Creador B: no ve nada de R1
-- -----------------------------------------------------------------------------
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2', false);
set local role authenticated;

select results_eq('select name from public.raffles', array['Rifa del Kínder'], 'creador B: solo ve su rifa');
select results_eq(
  'select buyer_name from public.sales',
  array['Cata (compradora de Lucía)'],
  'creador B: no ve compradores de otras cuentas'
);
select is(
  (select count(*)::int from public.collaborators where raffle_id = '10000000-0000-0000-0000-000000000001'),
  0,
  'creador B: no ve colaboradores de rifas ajenas'
);

-- -----------------------------------------------------------------------------
-- Carlos (colaborador activo de R1)
-- -----------------------------------------------------------------------------
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;

select is((select count(*)::int from public.raffles), 0, 'Carlos: no lee la tabla de rifas directamente');
select is((select count(*)::int from public.collaborators), 0, 'Carlos: no lee teléfonos de colaboradores');
select is((select count(*)::int from public.collaborator_sessions), 0, 'Carlos: no lee sesiones');
select is((select count(*)::int from public.profiles), 0, 'Carlos: no tiene perfil ni lee perfiles');
select results_eq(
  'select number::int from public.raffle_numbers order by number',
  array[0, 1, 2],
  'Carlos: ve el tablero completo de R1 y nada de R2'
);
select results_eq(
  'select buyer_name from public.sales',
  array['Ana (compradora de Carlos)'],
  'Carlos: solo ve los compradores de sus números'
);
select is(
  (select count(*)::int
     from public.raffle_numbers n
     join public.sales s on s.id = n.current_sale_id),
  1,
  'Carlos: unir tablero y ventas no revela compradores ajenos'
);
select results_eq(
  'select actor_label from public.audit_events',
  array['Carlos'],
  'Carlos: solo ve los eventos de su lista'
);
select is((select count(*)::int from public.daily_digests), 0, 'Carlos: no ve resúmenes de correo');

select is(
  public.get_collaborator_home('10000000-0000-0000-0000-000000000001') -> 'me' ->> 'display_name',
  'Carlos',
  'Carlos: su vista identifica su acceso'
);
select is(
  jsonb_array_length(public.get_collaborator_home('10000000-0000-0000-0000-000000000001') -> 'collaborators'),
  3,
  'Carlos: ve los nombres de los colaboradores si el creador lo permite'
);
select ok(
  not (public.get_collaborator_home('10000000-0000-0000-0000-000000000001')::text like '%+506%'),
  'Carlos: su vista no contiene teléfonos'
);
select throws_ok(
  $$ select public.get_collaborator_home('10000000-0000-0000-0000-000000000002') $$,
  'P0001', 'R4A_FORBIDDEN',
  'Carlos: no puede abrir la vista de otra rifa'
);
select throws_ok(
  $$ update public.raffle_numbers set version = 99 $$,
  '42501', null,
  'Carlos: no puede modificar el tablero directamente'
);
select throws_ok(
  $$ insert into public.audit_events (raffle_id, actor_type, actor_user_id, actor_label, action)
     values ('10000000-0000-0000-0000-000000000001', 'creator', '00000000-0000-0000-0000-0000000000a1', 'Falso', 'raffle.created') $$,
  '42501', null,
  'Carlos: no puede escribir en el log'
);

-- -----------------------------------------------------------------------------
-- María: solo su lista
-- -----------------------------------------------------------------------------
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', true);
set local role authenticated;

select results_eq(
  'select buyer_name from public.sales',
  array['Beto (comprador de María)'],
  'María: solo ve los compradores de sus números'
);

-- -----------------------------------------------------------------------------
-- Accesos sin validez: pausado, revocado, sin sesión
-- -----------------------------------------------------------------------------
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3', true);
set local role authenticated;
select is(
  (select count(*)::int from public.raffle_numbers) + (select count(*)::int from public.sales),
  0,
  'Pedro (pausado): no ve nada'
);

reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a4', true);
set local role authenticated;
select is(
  (select count(*)::int from public.raffle_numbers) + (select count(*)::int from public.sales),
  0,
  'sesión revocada: no ve nada'
);

reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a6', true);
set local role authenticated;
select is(
  (select count(*)::int from public.raffle_numbers) + (select count(*)::int from public.raffles),
  0,
  'anónimo sin sesión: no ve nada'
);

-- Un JWT anónimo con el id de la creadora no obtiene permisos de creadora (H-02).
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1', true);
set local role authenticated;
select is(
  (select count(*)::int from public.raffles) + (select count(*)::int from public.sales),
  0,
  'un usuario anónimo nunca se trata como creador'
);

-- -----------------------------------------------------------------------------
-- Visitante sin sesión (rol anon)
-- -----------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;
select throws_ok('select * from public.raffles', '42501', null, 'anon: no puede leer rifas');
select throws_ok('select * from public.sales', '42501', null, 'anon: no puede leer ventas');
select throws_ok(
  $$ select public.get_collaborator_home('10000000-0000-0000-0000-000000000001') $$,
  '42501', null,
  'anon: no puede llamar a la vista del colaborador'
);

-- -----------------------------------------------------------------------------
-- Cambios de configuración de la rifa
-- -----------------------------------------------------------------------------
reset role;
update public.raffles set show_collaborator_names = false where id = '10000000-0000-0000-0000-000000000001';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select results_eq(
  $$ select jsonb_array_elements(public.get_collaborator_home('10000000-0000-0000-0000-000000000001') -> 'collaborators') ->> 'display_name' $$,
  array['Carlos'],
  'Carlos: si el creador oculta los nombres, solo se ve a sí mismo'
);

reset role;
update public.raffles set status = 'closed', closed_at = now() where id = '10000000-0000-0000-0000-000000000001';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select is((select count(*)::int from public.raffle_numbers), 3, 'Carlos: con la rifa cerrada sigue pudiendo consultar');

-- -----------------------------------------------------------------------------
-- Tiempo real: solo el tablero público se difunde
-- -----------------------------------------------------------------------------
reset role;
select set_eq(
  $$ select tablename::text from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' $$,
  array['raffle_numbers'],
  'Realtime solo publica el tablero, nunca las ventas'
);

select * from finish();
rollback;
