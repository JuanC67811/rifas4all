# ADR 0001 — Stack y arquitectura base

- **Estado:** aceptada
- **Fecha:** 2026-10-08

## Contexto

Rifas4All necesita cuentas para el creador, acceso sin registro para hasta 12 colaboradores, privacidad entre colaboradores, tiempo real, tareas programadas (vencimientos y resumen diario por correo) y un log que no se pueda alterar. Debe poder empezar gratis y mantenerse por una sola persona.

## Decisión

- **Frontend:** React + TypeScript estricto + Vite + Tailwind CSS (mismo stack que Sopa4All).
- **Backend:** Supabase (PostgreSQL, Auth, Realtime, Edge Functions, `pg_cron`). No se escribe un servidor propio.
- **La lógica crítica vive en PostgreSQL.** El cliente solo lee (filtrado por Row Level Security) y solo escribe llamando a funciones de la base de datos que validan permisos, estados y versiones, y registran el log en la misma transacción.
- **Herramientas:** oxlint (linter, como en Sopa4All), Prettier (formato), Vitest + Testing Library (unitarias y componentes), pgTAP (base de datos, Fase 2), Playwright (end-to-end), GitHub Actions (CI).
- **Validación:** Zod, empezando por las variables de entorno.

## Alternativas consideradas

| Alternativa                                 | Por qué no                                                                                                                                                 |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Servidor propio (Node/Express) + PostgreSQL | Más código que mantener (auth, sesiones, websockets, despliegue) sin ventaja real para el alcance                                                          |
| Firebase                                    | Reglas de seguridad menos expresivas que SQL + RLS para "solo los números de tu lista"; sin transacciones relacionales ni restricciones `UNIQUE` parciales |
| Lógica en el frontend con tablas abiertas   | Cualquiera podría saltarse las reglas llamando a la API directamente                                                                                       |

## Consecuencias

- Las reglas de negocio se prueban principalmente con pgTAP, no solo en TypeScript.
- El desarrollo local requiere **Docker** (la CLI de Supabase levanta los servicios en contenedores).
- El plan gratuito de Supabase pausa los proyectos tras ~1 semana sin actividad; hay que tenerlo en cuenta para la demo.
- Diseño completo: [`docs/rifas4all-diseno-tecnico.md`](../rifas4all-diseno-tecnico.md).
