-- Estructura del esquema y privilegios: nada debe ser accesible desde la API
-- salvo lo que una migración conceda explícitamente (revisión crítica H-01, H-08).
begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

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
-- Los clientes solo pueden LEER (filtrado por RLS) las tablas públicas. Ningún
-- INSERT/UPDATE/DELETE directo, nada para `anon` y nada en el esquema privado.
select set_eq(
  $$
    select grantee || ' → ' || table_schema || '.' || table_name || ' (' || privilege_type || ')'
      from information_schema.role_table_grants
     where table_schema in ('public', 'private')
       and grantee in ('anon', 'authenticated', 'PUBLIC')
  $$,
  array[
    'authenticated → public.profiles (SELECT)',
    'authenticated → public.raffles (SELECT)',
    'authenticated → public.collaborators (SELECT)',
    'authenticated → public.collaborator_sessions (SELECT)',
    'authenticated → public.raffle_numbers (SELECT)',
    'authenticated → public.sales (SELECT)',
    'authenticated → public.audit_events (SELECT)',
    'authenticated → public.daily_digests (SELECT)'
  ],
  'los clientes solo tienen SELECT sobre las tablas públicas'
);

select ok(
  not has_schema_privilege('anon', 'private', 'usage'),
  'un visitante sin sesión no puede usar el esquema privado'
);

-- Lista blanca de funciones ejecutables por los clientes. Cada fase que añade
-- una función accesible tiene que añadirla aquí de forma consciente.
select set_eq(
  $$
    select n.nspname || '.' || p.proname || '(' || oidvectortypes(p.proargtypes) || ')'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private')
       and has_function_privilege('authenticated', p.oid, 'execute')
  $$,
  array[
    -- Helpers usados por las políticas RLS (fase 2.2)
    'private.is_creator()',
    'private.owns_raffle(uuid)',
    'private.current_collaborator_id(uuid)',
    -- RPC: lectura
    'public.get_collaborator_home(uuid)',
    'public.get_distribution_summary(uuid)',
    'public.get_daily_digest(date)',
    'public.get_invitation_preview(text)',
    -- RPC: creador (fase 2.3)
    'public.update_profile(text, text, boolean, boolean)',
    'public.create_raffle(text, bigint, text, date, date, text, text, boolean, text)',
    'public.update_raffle(uuid, jsonb)',
    'public.close_raffle(uuid)',
    'public.delete_raffle(uuid, text)',
    'public.set_collaborators(uuid, jsonb, boolean)',
    'public.update_collaborator(uuid, text, text)',
    'public.preview_distribution(uuid, distribution_method)',
    'public.confirm_distribution(uuid)',
    'public.get_access_credentials(uuid)',
    'public.set_collaborator_paused(uuid, boolean)',
    'public.regenerate_access(uuid)',
    -- RPC: colaborador y ventas (fase 2.3)
    'public.activate_access(text, text)',
    'public.register_sale(uuid, smallint, sale_status, text, text, integer, uuid, text, text)',
    'public.change_sale_status(uuid, smallint, text, integer, uuid, text)',
    'public.update_buyer(uuid, smallint, text, text, integer, uuid, text, text)'
  ],
  'solo las funciones de la lista blanca son ejecutables por authenticated'
);

select set_eq(
  $$
    select n.nspname || '.' || p.proname || '(' || oidvectortypes(p.proargtypes) || ')'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private')
       and has_function_privilege('anon', p.oid, 'execute')
  $$,
  array['public.get_invitation_preview(text)'],
  'un visitante sin sesión solo puede consultar la vista previa de un enlace'
);

-- Las funciones con privilegios elevados deben fijar search_path.
select is_empty(
  $$
    select n.nspname || '.' || p.proname || '(' || oidvectortypes(p.proargtypes) || ')'
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
