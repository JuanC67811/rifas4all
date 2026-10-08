# ADR 0002 — Permisos denegados por defecto y esquema privado

- **Estado:** aceptada
- **Fecha:** 2026-10-09

## Contexto

Supabase expone por API REST todo lo que hay en el esquema `public`. Por defecto:

- Concede a los roles `anon` y `authenticated` permisos sobre las tablas nuevas de `public`.
- PostgreSQL concede `EXECUTE` a `PUBLIC` sobre cualquier función nueva.
- Un usuario **anónimo** de Supabase (como el que usarán los colaboradores) tiene el rol `authenticated`.

Si no se cambia este comportamiento, una función interna (por ejemplo, la tarea que borra rifas vencidas) quedaría disponible para cualquiera que tenga la clave pública de la app.

## Decisión

1. La primera migración revoca esos permisos por defecto. Las tablas y funciones nacen **sin acceso** para los clientes.
2. Cada permiso se concede de forma explícita, objeto por objeto, en la migración que lo necesita.
3. Se crea un esquema `private` (no expuesto por la API) para helpers de seguridad, tareas programadas y secretos de acceso.
4. Row Level Security se activa en **todas** las tablas desde su creación, incluso antes de tener políticas.
5. Se desactiva `pg_graphql`: no se usa, y sería una segunda vía de acceso a las mismas tablas.
6. Una prueba pgTAP mantiene una **lista blanca** de funciones ejecutables por los clientes y falla si aparece una que no esté en ella.

## Alternativas consideradas

| Alternativa                                                | Por qué no                                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Mantener los permisos por defecto y confiar solo en RLS    | RLS protege las tablas, pero no las funciones. Un olvido se convierte en una vulnerabilidad |
| Revocar permisos función por función a medida que se crean | Depende de no olvidarse nunca. La revocación por defecto falla en el lado seguro            |

## Consecuencias

- Toda funcionalidad nueva necesita un `GRANT` explícito. Es más trabajo, pero queda visible en la revisión de la migración.
- Las pruebas de privilegios forman parte de la CI (`supabase test db`).
