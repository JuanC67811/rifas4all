-- =============================================================================
-- Privilegios por defecto y esquemas
-- =============================================================================
-- Supabase concede por defecto a los roles `anon` y `authenticated` permisos sobre
-- todo lo que se crea en `public`, y PostgreSQL concede EXECUTE a PUBLIC en toda
-- función nueva. Aquí se invierte ese comportamiento: nada es accesible desde la
-- API hasta que una migración lo conceda explícitamente (ver revisión crítica, H-01).

-- Lo que se cree a partir de ahora en `public` nace sin permisos para los clientes.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- Ninguna función nueva, en ningún esquema, es ejecutable por PUBLIC por defecto.
alter default privileges for role postgres
  revoke execute on functions from public;

-- Esquema privado: helpers de seguridad, tareas programadas y secretos.
-- PostgREST no lo expone, y además los clientes no tienen ningún permiso sobre él.
create schema private;
revoke all on schema private from public, anon, authenticated;

-- GraphQL expondría las mismas tablas por un segundo endpoint. No se usa (H-08).
drop extension if exists pg_graphql;
