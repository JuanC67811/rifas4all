-- Estructura del esquema y privilegios: nada debe ser accesible desde la API
-- salvo lo que una migración conceda explícitamente (revisión crítica H-01, H-08).
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

-- Esquemas y tablas ------------------------------------------------------------
select has_schema('private', 'existe el esquema privado');

select tables_are(
  'public',
  array[
    'profiles', 'raffles', 'collaborators', 'collaborator_sessions',
    'raffle_numbers', 'sales', 'audit_events', 'daily_digests'
  ],
  'public contiene exactamente las tablas del diseño'
);

select tables_are(
  'private',
  array['collaborator_secrets'],
  'los secretos de acceso viven en el esquema privado'
);

select enum_has_labels('public', 'raffle_status', array['draft', 'active', 'closed']);
select enum_has_labels(
  'public', 'number_status',
  array['available', 'reserved', 'pending_payment', 'paid', 'overdue']
);
select enum_has_labels(
  'public', 'sale_status',
  array['reserved', 'pending_payment', 'paid', 'overdue', 'cancelled']
);

select hasnt_extension('pg_graphql', 'GraphQL está desactivado');

-- Row Level Security -----------------------------------------------------------
select is_empty(
  $$
    select c.relname::text
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname in ('public', 'private')
       and c.relkind = 'r'
       and not c.relrowsecurity
  $$,
  'RLS está activo en todas las tablas de public y private'
);

-- Privilegios de los clientes ---------------------------------------------------
select is_empty(
  $$
    select grantee || ' → ' || table_schema || '.' || table_name || ' (' || privilege_type || ')'
      from information_schema.role_table_grants
     where table_schema in ('public', 'private')
       and grantee in ('anon', 'authenticated', 'PUBLIC')
  $$,
  'anon y authenticated no tienen permisos sobre ninguna tabla'
);

select ok(
  not has_schema_privilege('anon', 'private', 'usage')
    and not has_schema_privilege('authenticated', 'private', 'usage'),
  'los clientes no pueden usar el esquema privado'
);

-- Lista blanca de funciones ejecutables por los clientes. Hoy está vacía;
-- las fases siguientes la amplían función por función.
select is_empty(
  $$
    select p.oid::regprocedure::text
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private')
       and (
         has_function_privilege('anon', p.oid, 'execute')
         or has_function_privilege('authenticated', p.oid, 'execute')
       )
  $$,
  'ninguna función de public/private es ejecutable por anon o authenticated'
);

-- Las funciones con privilegios elevados deben fijar search_path.
select is_empty(
  $$
    select p.oid::regprocedure::text
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private')
       and p.prosecdef
       and not exists (
         select 1 from unnest(coalesce(p.proconfig, '{}')) as cfg where cfg like 'search_path=%'
       )
  $$,
  'toda función SECURITY DEFINER fija search_path'
);

-- Índices clave -----------------------------------------------------------------
select has_index(
  'public', 'sales', 'sales_one_active_per_number_idx',
  'existe el índice que impide dos ventas activas por número'
);
select has_index(
  'public', 'audit_events', 'audit_events_request_idx',
  'existe el índice de idempotencia del log'
);

select * from finish();
rollback;
