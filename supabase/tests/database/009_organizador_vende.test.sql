-- El organizador también puede vender: su propia lista en el reparto, sin enlace ni PIN.
begin;
create extension if not exists pgtap with schema extensions;

-- Cada archivo parte de una base vacía. Los datos del seed vuelven con el rollback final.
delete from auth.users;

select plan(11);

create function pg_temp.as_user(p_user_id uuid, p_is_anonymous boolean)
returns void
language sql
as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated', 'is_anonymous', p_is_anonymous)::text,
    true);
$$;

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
grant execute on function pg_temp.sizes(uuid) to authenticated;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c1', 'juan@test.local');
update public.profiles set display_name = 'Juan' where id = '00000000-0000-0000-0000-0000000000c1';

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1', false);
set local role authenticated;
select public.create_raffle('Rifa de Juan', 100000, 'CRC', current_date + 30, current_date + 20) as raffle_id \gset

-- Solo el organizador ---------------------------------------------------------------
select lives_ok(
  format($$ select public.set_collaborators(%L, '[]', true) $$, :'raffle_id'),
  'el organizador puede llevar la rifa solo'
);
select results_eq(
  format($$ select display_name, is_organizer, position::int from public.collaborators where raffle_id = %L $$, :'raffle_id'),
  $$ values ('Juan', true, 1) $$,
  'su lista lleva su nombre y va en la primera posición'
);
select lives_ok(format($$ select public.preview_distribution(%L, 'ordered') $$, :'raffle_id'), 'vista previa');
select is(pg_temp.sizes(:'raffle_id'), array[100], 'solo, el organizador recibe los 100 números');

-- Organizador + 1 colaborador -----------------------------------------------------------
select lives_ok(
  format($$ select public.set_collaborators(%L, '[{"display_name": "Carlos", "pin_enabled": true}]', true) $$, :'raffle_id'),
  'el organizador y un colaborador'
);
select lives_ok(format($$ select public.preview_distribution(%L, 'random') $$, :'raffle_id'), 'vista previa al azar');
select is(pg_temp.sizes(:'raffle_id'), array[50, 50], 'con un colaborador, 50 y 50');
select is(
  (select (entry ->> 'is_organizer')::boolean
     from jsonb_array_elements(public.get_distribution_summary(:'raffle_id')) as entry
    where entry ->> 'display_name' = 'Juan'),
  true,
  'el resumen del reparto identifica la lista del organizador'
);
select lives_ok(format($$ select public.confirm_distribution(%L) $$, :'raffle_id'), 'se activa la rifa');

reset role;
select results_eq(
  format($$ select c.display_name from private.collaborator_secrets s
              join public.collaborators c on c.id = s.collaborator_id
             where c.raffle_id = %L $$, :'raffle_id'),
  $$ values ('Carlos') $$,
  'solo el colaborador externo recibe enlace y PIN'
);

-- Límites ---------------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1', false);
set local role authenticated;
select public.create_raffle('Otra rifa', 100000, 'CRC', current_date + 30, current_date + 20) as other_id \gset
select throws_ok(
  format($$ select public.set_collaborators(%L, '[]', false) $$, :'other_id'),
  'P0001', 'R4A_VALIDATION',
  'sin colaboradores, el organizador tiene que vender'
);

select * from finish();
rollback;
