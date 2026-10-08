-- Accesos de colaboradores: credenciales, vista previa del enlace, activación,
-- PIN con bloqueo temporal, límite de 2 dispositivos, pausa y regeneración.
begin;
create extension if not exists pgtap with schema extensions;

select plan(34);

create function pg_temp.as_user(p_user_id uuid, p_is_anonymous boolean)
returns void
language sql
as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'is_anonymous', p_is_anonymous)::text,
    true);
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'creadora.a@test.local'),
  ('00000000-0000-0000-0000-0000000000c2', 'creador.b@test.local');
insert into auth.users (id, is_anonymous) values
  ('00000000-0000-0000-0000-0000000000a1', true),  -- teléfono de Carlos
  ('00000000-0000-0000-0000-0000000000a2', true),  -- teléfono de María
  ('00000000-0000-0000-0000-0000000000a3', true),  -- segundo dispositivo de Carlos
  ('00000000-0000-0000-0000-0000000000a4', true);  -- tercer dispositivo de Carlos

-- Rifa activa creada por la creadora con las funciones reales.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1', false);
set local role authenticated;
select public.create_raffle('Canasta Navideña', 200000, 'CRC', current_date + 30, current_date + 20) as raffle_id \gset
select public.set_collaborators(:'raffle_id', '[
  {"display_name": "Carlos", "pin_enabled": true},
  {"display_name": "María", "pin_enabled": false}
]');
select public.preview_distribution(:'raffle_id', 'ordered');
select public.confirm_distribution(:'raffle_id');

reset role;
select c.id as carlos_id, s.token as carlos_token, s.pin as carlos_pin
  from public.collaborators c join private.collaborator_secrets s on s.collaborator_id = c.id
 where c.raffle_id = :'raffle_id' and c.display_name = 'Carlos' \gset
select c.id as maria_id, s.token as maria_token
  from public.collaborators c join private.collaborator_secrets s on s.collaborator_id = c.id
 where c.raffle_id = :'raffle_id' and c.display_name = 'María' \gset
-- Un PIN que seguro es incorrecto.
select case when :'carlos_pin' = '9999' then '8888' else '9999' end as wrong_pin \gset

-- -----------------------------------------------------------------------------
-- Credenciales (solo la creadora)
-- -----------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1', false);
set local role authenticated;
select results_eq(
  format($$ select c ->> 'display_name', c ->> 'token', c ->> 'pin'
              from public.get_access_credentials(%L) as c $$, :'carlos_id'),
  format($$ values ('Carlos', %L, %L) $$, :'carlos_token', :'carlos_pin'),
  'la creadora obtiene el enlace y el PIN de Carlos cuando quiera'
);

reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2', false);
set local role authenticated;
select throws_ok(
  format($$ select public.get_access_credentials(%L) $$, :'carlos_id'),
  'P0001', 'R4A_NOT_FOUND', 'otro creador no obtiene las credenciales'
);

-- -----------------------------------------------------------------------------
-- Vista previa del enlace (visitante sin sesión)
-- -----------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;
select results_eq(
  format($$ select p ->> 'raffle_name', p ->> 'collaborator_name', (p ->> 'requires_pin')::boolean
              from public.get_invitation_preview(%L) as p $$, :'carlos_token'),
  $$ values ('Canasta Navideña', 'Carlos', true) $$,
  'el enlace muestra la rifa, el nombre asignado y si pide PIN'
);
select throws_ok(
  $$ select public.get_invitation_preview('token-que-no-existe-aaaaaaaaaaaaaaaaaaaaaaa') $$,
  'P0001', 'R4A_INVALID_LINK', 'un token inexistente da un error genérico'
);
select throws_ok(
  format($$ select public.activate_access(%L, null) $$, :'maria_token'),
  '42501', null, 'sin sesión de dispositivo no se puede activar'
);

-- -----------------------------------------------------------------------------
-- Activación
-- -----------------------------------------------------------------------------
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1', false);
set local role authenticated;
select throws_ok(
  format($$ select public.activate_access(%L, null) $$, :'maria_token'),
  'P0001', 'R4A_CREATOR_SESSION', 'con la sesión de creadora no se activa un acceso de colaborador'
);

reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;

select is(
  public.activate_access(:'carlos_token', :'wrong_pin'),
  '{"ok": false, "error": "PIN_INCORRECT", "attempts_left": 4}'::jsonb,
  'PIN incorrecto: avisa cuántos intentos quedan'
);
select is(public.activate_access(:'carlos_token', :'wrong_pin') ->> 'attempts_left', '3', 'segundo intento fallido');
select is(public.activate_access(:'carlos_token', :'wrong_pin') ->> 'attempts_left', '2', 'tercer intento fallido');
select is(public.activate_access(:'carlos_token', :'wrong_pin') ->> 'attempts_left', '1', 'cuarto intento fallido');
select is(
  public.activate_access(:'carlos_token', :'wrong_pin') ->> 'error',
  'PIN_LOCKED',
  'al quinto fallo el acceso se bloquea temporalmente'
);
select is(
  public.activate_access(:'carlos_token', :'carlos_pin') ->> 'error',
  'PIN_LOCKED',
  'durante el bloqueo ni siquiera el PIN correcto entra'
);

reset role;
select is(
  (select count(*)::int from public.audit_events
    where raffle_id = :'raffle_id' and action = 'access.pin_failed' and result = 'pin_failed'),
  5,
  'cada fallo de PIN queda en el log aunque la función no lance error'
);
select is(
  (select count(*)::int from public.audit_events
    where raffle_id = :'raffle_id' and details::text like '%' || :'carlos_pin' || '%'),
  0,
  'el log nunca contiene el PIN'
);

-- Pasan los 15 minutos.
update private.collaborator_secrets set pin_locked_until = now() - interval '1 second'
 where collaborator_id = :'carlos_id';

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select is(
  public.activate_access(:'carlos_token', :'carlos_pin') ->> 'ok',
  'true',
  'con el PIN correcto, Carlos activa su acceso'
);
select is((select count(*)::int from public.raffle_numbers), 100, 'Carlos ya ve el tablero');
select is(
  public.activate_access(:'carlos_token', :'carlos_pin') ->> 'ok',
  'true',
  'volver a abrir el enlace en el mismo teléfono funciona'
);

reset role;
select is(
  (select count(*)::int from public.collaborator_sessions
    where collaborator_id = :'carlos_id' and revoked_at is null),
  1,
  'reabrir el enlace en el mismo teléfono no crea otro dispositivo'
);

-- -----------------------------------------------------------------------------
-- Un navegador = un colaborador por rifa
-- -----------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', true);
set local role authenticated;
select is(public.activate_access(:'maria_token', null) ->> 'ok', 'true', 'María activa sin PIN');
select is(
  public.activate_access(:'carlos_token', :'carlos_pin') ->> 'ok',
  'true',
  'en el teléfono de María se abre el enlace de Carlos'
);
select is(
  public.get_collaborator_home(:'raffle_id') -> 'me' ->> 'display_name',
  'Carlos',
  'ese navegador ahora actúa como Carlos'
);

reset role;
select is(
  (select revoked_reason from public.collaborator_sessions
    where collaborator_id = :'maria_id' and auth_user_id = '00000000-0000-0000-0000-0000000000a2'),
  'replaced_on_this_device',
  'la sesión de María en ese navegador se reemplaza'
);

-- -----------------------------------------------------------------------------
-- Máximo 2 dispositivos
-- -----------------------------------------------------------------------------
-- Carlos ya tiene 2 (a1 y a2). El teléfono a1 es el usado hace más tiempo.
update public.collaborator_sessions set last_seen_at = now() - interval '1 day'
 where auth_user_id = '00000000-0000-0000-0000-0000000000a1';

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a4', true);
set local role authenticated;
select is(public.activate_access(:'carlos_token', :'carlos_pin') ->> 'ok', 'true', 'Carlos entra desde un tercer dispositivo');

reset role;
select is(
  (select count(*)::int from public.collaborator_sessions
    where collaborator_id = :'carlos_id' and revoked_at is null),
  2,
  'nunca hay más de 2 dispositivos activos'
);
select is(
  (select revoked_reason from public.collaborator_sessions
    where auth_user_id = '00000000-0000-0000-0000-0000000000a1' and collaborator_id = :'carlos_id'),
  'replaced_by_new_device',
  'se revoca el dispositivo usado hace más tiempo'
);

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select is((select count(*)::int from public.raffle_numbers), 0, 'el dispositivo revocado deja de ver el tablero');

-- -----------------------------------------------------------------------------
-- Pausar, reanudar y regenerar
-- -----------------------------------------------------------------------------
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1', false);
set local role authenticated;
select public.set_collaborator_paused(:'carlos_id', true);

reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a4', true);
set local role authenticated;
select is((select count(*)::int from public.raffle_numbers), 0, 'pausado: deja de ver el tablero de inmediato');
select throws_ok(
  format($$ select public.get_invitation_preview(%L) $$, :'carlos_token'),
  'P0001', 'R4A_INVALID_LINK', 'pausado: el enlace deja de funcionar'
);
select throws_ok(
  format($$ select public.get_access_credentials(%L) $$, :'carlos_id'),
  'P0001', 'R4A_FORBIDDEN', 'un colaborador no puede pedir credenciales'
);
select throws_ok(
  format($$ select public.regenerate_access(%L) $$, :'carlos_id'),
  'P0001', 'R4A_FORBIDDEN', 'un colaborador no puede regenerar accesos'
);

reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1', false);
set local role authenticated;
select public.set_collaborator_paused(:'carlos_id', false);
select public.regenerate_access(:'carlos_id');

reset role;
select is(
  (select count(*)::int from public.collaborator_sessions
    where collaborator_id = :'carlos_id' and revoked_at is null),
  0,
  'nuevo acceso: se cierran todas las sesiones de Carlos'
);
select isnt(
  (select token from private.collaborator_secrets where collaborator_id = :'carlos_id'),
  :'carlos_token',
  'nuevo acceso: el token cambia'
);

select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;
select throws_ok(
  format($$ select public.get_invitation_preview(%L) $$, :'carlos_token'),
  'P0001', 'R4A_INVALID_LINK', 'nuevo acceso: el enlace anterior ya no sirve'
);

reset role;
select is(
  (select count(*)::int from public.audit_events
    where raffle_id = :'raffle_id' and details::text like '%' || :'carlos_token' || '%'),
  0,
  'el log nunca contiene el token'
);

select * from finish();
rollback;
