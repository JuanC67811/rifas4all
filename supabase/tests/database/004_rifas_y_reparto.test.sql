-- Rifas, colaboradores y reparto de números, a través de las funciones RPC
-- y con la identidad real de cada usuario (rol authenticated + JWT simulado).
begin;
create extension if not exists pgtap with schema extensions;

select plan(42);

create function pg_temp.as_user(p_user_id uuid, p_is_anonymous boolean)
returns void
language sql
as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'is_anonymous', p_is_anonymous)::text,
    true);
$$;

-- Lista de N colaboradores en el formato que espera set_collaborators.
create function pg_temp.collaborators(p_count integer)
returns jsonb
language sql
as $$
  select jsonb_agg(jsonb_build_object('display_name', 'Colaborador ' || i, 'pin_enabled', i = 1) order by i)
    from generate_series(1, p_count) as i;
$$;

-- Tamaño de la lista de cada colaborador, en orden de posición.
create function pg_temp.sizes(p_raffle_id uuid)
returns integer[]
language sql
as $$
  select array_agg(total order by position)
    from (select c.position, count(n.number)::int as total
            from public.collaborators c
            left join public.raffle_numbers n on n.collaborator_id = c.id
           where c.raffle_id = p_raffle_id
           group by c.position) as t;
$$;

-- Las utilidades temporales se ejecutan también con el rol authenticated.
grant execute on function pg_temp.collaborators(integer) to authenticated;
grant execute on function pg_temp.sizes(uuid) to authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'creadora.a@test.local'),
  ('00000000-0000-0000-0000-0000000000c2', 'creador.b@test.local');
insert into auth.users (id, is_anonymous) values ('00000000-0000-0000-0000-0000000000a1', true);

-- -----------------------------------------------------------------------------
-- Crear rifa
-- -----------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select throws_ok(
  $$ select public.create_raffle('Rifa pirata', 100, 'CRC', current_date + 30, current_date + 20) $$,
  'P0001', 'R4A_FORBIDDEN', 'un usuario anónimo no puede crear rifas'
);

reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1', false);
set local role authenticated;

select isnt(
  public.create_raffle('Canasta Navideña', 200000, 'crc', current_date + 30, current_date + 20),
  null,
  'la creadora crea una rifa'
);
select throws_ok(
  $$ select public.create_raffle('Rifa vieja', 100, 'CRC', current_date - 1, current_date - 2) $$,
  'P0001', 'R4A_VALIDATION', 'no se crea una rifa con el sorteo en el pasado'
);

reset role;
select id as raffle_id from public.raffles where name = 'Canasta Navideña' \gset

select results_eq(
  $$ select status::text, currency::text from public.raffles where name = 'Canasta Navideña' $$,
  $$ values ('draft', 'CRC') $$,
  'la rifa nace en borrador y la moneda se normaliza a mayúsculas'
);
select is(
  (select count(*)::int from public.audit_events where raffle_id = :'raffle_id' and action = 'raffle.created'),
  1, 'la creación queda en el log'
);

-- Otro creador no puede tocar la rifa.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2', false);
set local role authenticated;
select throws_ok(
  format($$ select public.update_raffle(%L, '{"name": "Robada"}') $$, :'raffle_id'),
  'P0001', 'R4A_NOT_FOUND', 'otro creador no puede editar la rifa'
);
select throws_ok(
  format($$ select public.set_collaborators(%L, pg_temp.collaborators(2)) $$, :'raffle_id'),
  'P0001', 'R4A_NOT_FOUND', 'otro creador no puede cambiar sus colaboradores'
);
select is(
  public.get_distribution_summary(:'raffle_id'),
  '[]'::jsonb,
  'otro creador no ve el reparto'
);

-- -----------------------------------------------------------------------------
-- Colaboradores
-- -----------------------------------------------------------------------------
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1', false);
set local role authenticated;

select throws_ok(
  format($$ select public.set_collaborators(%L, '[]') $$, :'raffle_id'),
  'P0001', 'R4A_VALIDATION', 'no se aceptan 0 colaboradores'
);
select throws_ok(
  format($$ select public.set_collaborators(%L, pg_temp.collaborators(13)) $$, :'raffle_id'),
  'P0001', 'R4A_VALIDATION', 'no se aceptan 13 colaboradores'
);
select throws_ok(
  format($$ select public.confirm_distribution(%L) $$, :'raffle_id'),
  'P0001', 'R4A_VALIDATION', 'no se confirma sin vista previa'
);

-- -----------------------------------------------------------------------------
-- Reparto en orden
-- -----------------------------------------------------------------------------
select lives_ok(
  format($$ select public.set_collaborators(%L, pg_temp.collaborators(1)) $$, :'raffle_id'),
  'un solo colaborador'
);
select lives_ok(
  format($$ select public.preview_distribution(%L, 'ordered') $$, :'raffle_id'),
  'vista previa con un colaborador'
);
select is(pg_temp.sizes(:'raffle_id'), array[100], '1 colaborador: recibe los 100 números');

select lives_ok(
  format($$ select public.set_collaborators(%L, pg_temp.collaborators(3)) $$, :'raffle_id'),
  'tres colaboradores'
);
select is(
  (select count(*)::int from public.raffle_numbers where raffle_id = :'raffle_id'),
  0,
  'cambiar los colaboradores descarta la vista previa anterior'
);
select lives_ok(
  format($$ select public.preview_distribution(%L, 'ordered') $$, :'raffle_id'),
  'vista previa en orden con tres colaboradores'
);
select results_eq(
  format($$ select c.position::int, min(n.number)::int, max(n.number)::int, count(*)::int
              from public.raffle_numbers n
              join public.collaborators c on c.id = n.collaborator_id
             where n.raffle_id = %L
             group by c.position
             order by c.position $$, :'raffle_id'),
  $$ values (1, 0, 33, 34), (2, 34, 66, 33), (3, 67, 99, 33) $$,
  '3 colaboradores en orden: 00–33, 34–66, 67–99 (el sobrante va al primero)'
);

select lives_ok(
  format($$ select public.set_collaborators(%L, pg_temp.collaborators(7)) $$, :'raffle_id'),
  'siete colaboradores'
);
select lives_ok(format($$ select public.preview_distribution(%L, 'ordered') $$, :'raffle_id'), 'vista previa con 7');
select is(
  pg_temp.sizes(:'raffle_id'),
  array[15, 15, 14, 14, 14, 14, 14],
  '7 colaboradores: los 2 sobrantes van a los dos primeros'
);

select lives_ok(
  format($$ select public.set_collaborators(%L, pg_temp.collaborators(12)) $$, :'raffle_id'),
  'doce colaboradores'
);
select lives_ok(format($$ select public.preview_distribution(%L, 'ordered') $$, :'raffle_id'), 'vista previa con 12');
select is(
  pg_temp.sizes(:'raffle_id'),
  array[9, 9, 9, 9, 8, 8, 8, 8, 8, 8, 8, 8],
  '12 colaboradores: cuatro con 9 números y ocho con 8'
);

-- -----------------------------------------------------------------------------
-- Reparto aleatorio
-- -----------------------------------------------------------------------------
select lives_ok(
  format($$ select public.set_collaborators(%L, pg_temp.collaborators(3)) $$, :'raffle_id'),
  'de nuevo tres colaboradores'
);
select is(
  jsonb_array_length(public.preview_distribution(:'raffle_id', 'random')),
  3,
  'la vista previa aleatoria devuelve el resumen de los 3 colaboradores'
);
select is(pg_temp.sizes(:'raffle_id'), array[34, 33, 33], 'aleatorio: mismos tamaños que en orden');
select is(
  (select count(distinct number)::int from public.raffle_numbers where raffle_id = :'raffle_id'),
  100,
  'aleatorio: los 100 números, sin repetir'
);
select isnt(
  (select array_agg(n.number order by n.number)
     from public.raffle_numbers n
     join public.collaborators c on c.id = n.collaborator_id
    where n.raffle_id = :'raffle_id' and c.position = 1),
  (select array_agg(i::smallint order by i) from generate_series(0, 33) as i),
  'aleatorio: la lista del primero no es el bloque 00–33'
);

-- -----------------------------------------------------------------------------
-- Confirmar y activar
-- -----------------------------------------------------------------------------
select lives_ok(format($$ select public.confirm_distribution(%L) $$, :'raffle_id'), 'se confirma el reparto');

reset role;
select results_eq(
  format($$ select status::text, distribution_method::text from public.raffles where id = %L $$, :'raffle_id'),
  $$ values ('active', 'random') $$,
  'la rifa queda activa con el método confirmado'
);
select results_eq(
  format($$ select c.position::int, length(s.token), s.pin ~ '^[0-9]{4}$'
              from private.collaborator_secrets s
              join public.collaborators c on c.id = s.collaborator_id
             where c.raffle_id = %L
             order by c.position $$, :'raffle_id'),
  $$ values (1, 43, true), (2, 43, null), (3, 43, null) $$,
  'cada colaborador recibe un token de 43 caracteres; el PIN solo si lo pidió'
);

-- -----------------------------------------------------------------------------
-- Cambios con la rifa activa
-- -----------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1', false);
set local role authenticated;

select throws_ok(
  format($$ select public.preview_distribution(%L, 'ordered') $$, :'raffle_id'),
  'P0001', 'R4A_RAFFLE_STATE', 'el reparto no cambia con la rifa activa'
);
select throws_ok(
  format($$ select public.update_raffle(%L, '{"currency": "USD"}') $$, :'raffle_id'),
  'P0001', 'R4A_RAFFLE_STATE', 'la moneda no cambia con la rifa activa'
);
select throws_ok(
  format($$ select public.update_raffle(%L, '{"owner_id": "00000000-0000-0000-0000-0000000000c2"}') $$, :'raffle_id'),
  'P0001', 'R4A_VALIDATION', 'no se aceptan campos fuera de la lista'
);
select lives_ok(
  format($$ select public.update_raffle(%L, '{"name": "Canasta Navideña 2026"}') $$, :'raffle_id'),
  'el nombre sí se puede cambiar'
);

-- -----------------------------------------------------------------------------
-- Cerrar y eliminar
-- -----------------------------------------------------------------------------
select throws_ok(
  format($$ select public.delete_raffle(%L, 'Canasta Navideña 2026') $$, :'raffle_id'),
  'P0001', 'R4A_RAFFLE_STATE', 'una rifa activa no se elimina sin cerrarla'
);
select lives_ok(format($$ select public.close_raffle(%L) $$, :'raffle_id'), 'se cierra la rifa');
select throws_ok(
  format($$ select public.update_raffle(%L, '{"name": "Otra"}') $$, :'raffle_id'),
  'P0001', 'R4A_RAFFLE_STATE', 'una rifa cerrada no se modifica'
);
select throws_ok(
  format($$ select public.delete_raffle(%L, 'otro nombre') $$, :'raffle_id'),
  'P0001', 'R4A_VALIDATION', 'eliminar exige escribir el nombre exacto'
);
select lives_ok(
  format($$ select public.delete_raffle(%L, 'Canasta Navideña 2026') $$, :'raffle_id'),
  'con el nombre correcto, se elimina'
);

reset role;
select is(
  (select count(*)::int from public.raffles where id = :'raffle_id')
  + (select count(*)::int from public.audit_events where raffle_id = :'raffle_id'),
  0,
  'la rifa y su log desaparecen por completo'
);

select * from finish();
rollback;
