# Rifas4All

[![CI](https://github.com/JuanC67811/rifas4all/actions/workflows/ci.yml/badge.svg)](https://github.com/JuanC67811/rifas4all/actions/workflows/ci.yml)

Aplicación web gratuita y mobile-first para administrar **rifas pequeñas de 100 números** (familiares, escolares, de barrio) entre una persona organizadora y hasta 12 colaboradores que **no necesitan registrarse**.

> 🚧 **En desarrollo.** Fase actual: **3 — Cuenta del creador y gestión de rifas**. La base de datos (fase 2) está completa. Ver [plan por fases](#estado-del-proyecto).

## Cómo funciona

1. La persona organizadora crea una cuenta y una rifa (00–99).
2. Agrega de 1 a 12 colaboradores; el sistema reparte los 100 números de forma equitativa, en orden o al azar.
3. Cada colaborador recibe un enlace personal (y un PIN opcional) que la organizadora copia y comparte por donde quiera.
4. Cada colaborador gestiona solo sus números: compradores, reservas y pagos.
5. Todos ven el tablero en tiempo real, sin ver los datos de los compradores de otros.
6. Cada acción queda en un log que no se puede modificar, y la organizadora recibe un resumen diario por correo.

## Tecnologías

React 19 · TypeScript (estricto) · Vite · Tailwind CSS 4 · Zod · Supabase (PostgreSQL, Auth, Realtime, Row Level Security, Edge Functions) · Vitest · Testing Library · Playwright · oxlint · Prettier · GitHub Actions

## Principios de diseño

- **La base de datos es la que protege.** Los permisos se aplican con Row Level Security y funciones SQL, no ocultando botones.
- **Privacidad entre colaboradores.** El estado público de cada número y los datos privados del comprador viven en tablas separadas.
- **Integridad ante concurrencia.** Un número nunca puede tener dos ventas activas, aunque se pulse dos veces o se edite desde dos teléfonos.
- **Sin sobreingeniería.** Cada abstracción y cada dependencia está justificada en el documento de diseño o en un ADR.

## Documentación

| Documento                                                           | Contenido                                                                                      |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [Diseño técnico](docs/rifas4all-diseno-tecnico.md)                  | Alcance, permisos, flujos, máquinas de estado, modelo de datos, RLS, seguridad, pruebas, fases |
| [Revisión crítica de v0.1](docs/rifas4all-revision-critica-v0.1.md) | Vulnerabilidades y problemas encontrados en el primer diseño y cómo se corrigieron             |
| [Decisiones de arquitectura (ADR)](docs/adr/)                       | Una decisión importante por archivo, con alternativas y consecuencias                          |

## Ejecutar en local

Requisitos:

- Node.js 24 (ver `.nvmrc`).
- Docker Desktop (solo para la base de datos local de Supabase; en Windows usa WSL 2).

```bash
git clone https://github.com/JuanC67811/rifas4all.git
cd rifas4all
npm install
cp .env.example .env.local
npm run dev
```

| Comando                        | Qué hace                                                        |
| ------------------------------ | --------------------------------------------------------------- |
| `npm run dev`                  | Servidor de desarrollo en http://localhost:5173                 |
| `npm run check`                | Lint + formato + tipos + tests (lo mismo que la CI)             |
| `npm run test`                 | Tests unitarios y de componentes en modo observador             |
| `npm run test:coverage`        | Tests con informe de cobertura                                  |
| `npm run test:e2e`             | Pruebas end-to-end con Playwright (móvil y escritorio)          |
| `npm run lint`                 | Linter (oxlint)                                                 |
| `npm run format`               | Formatea el código con Prettier                                 |
| `npm run build`                | Compila la versión de producción en `dist/`                     |
| `npm run db:start` / `db:stop` | Levanta o detiene Supabase local (requiere Docker)              |
| `npm run db:reset`             | Recrea la base de datos local con migraciones y datos de prueba |
| `npm run db:types`             | Regenera los tipos de TypeScript desde la base de datos         |
| `npm run db:test`              | Pruebas de la base de datos con pgTAP                           |

## Base de datos

Las reglas que protegen los datos viven en PostgreSQL, no en React. Ejemplos de lo que la base de datos rechaza aunque el código de la aplicación tuviera un error:

| Regla                                                        | Cómo se garantiza                                                                                                                        |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Un número nunca tiene dos ventas activas                     | Índice único parcial sobre `sales (raffle_id, number) WHERE status <> cancelled`                                                         |
| Un colaborador solo vende sus propios números                | Clave foránea compuesta `(raffle_id, number, collaborator_id)`                                                                           |
| El estado público del número coincide con su venta           | Se deriva por trigger desde `sales`                                                                                                      |
| Máximo 12 colaboradores y 5 rifas por cuenta                 | `CHECK` de posición 1–12 + `UNIQUE`; trigger con bloqueo de fila                                                                         |
| El log no se puede modificar ni contiene datos del comprador | Trigger contra `UPDATE`/`TRUNCATE` + `CHECK` sobre `details`                                                                             |
| Nada es accesible desde la API sin permiso explícito         | Permisos revocados por defecto, esquema `private`, RLS en todas las tablas ([ADR 0002](docs/adr/0002-permisos-denegados-por-defecto.md)) |

### Quién puede leer qué (Row Level Security)

| Quién                                     | Qué ve                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Creador                                   | Todo lo de **sus** rifas; nada de otras cuentas                                                              |
| Colaborador (enlace activado)             | El tablero completo de su rifa (número y estado), pero **solo los compradores y eventos de su propia lista** |
| Colaborador pausado o con sesión revocada | Nada, desde la siguiente petición                                                                            |
| Visitante sin sesión                      | Nada                                                                                                         |

Nadie escribe directamente en las tablas: las escrituras pasarán por funciones SQL que validan permisos y estados. Las políticas se prueban con 8 perfiles de usuario, incluido un usuario anónimo que intenta hacerse pasar por creador. Además, se comprobó que al abrir a propósito una política, las pruebas fallan.

### Cómo se escribe: solo mediante funciones SQL

Los clientes no pueden escribir en ninguna tabla. Cada acción (crear una rifa, repartir los números, activar un acceso, vender, confirmar un pago…) es una función de PostgreSQL que, en una sola transacción, valida quién actúa, bloquea el número, comprueba la versión para detectar cambios simultáneos, valida la transición de estado y registra el evento en el log ([ADR 0003](docs/adr/0003-escrituras-mediante-funciones-sql.md)).

- **Doble toque o reintento:** cada operación lleva un `request_id`; si llega dos veces, la segunda devuelve el estado actual sin repetir nada.
- **Dos pestañas o dos personas a la vez:** la fila del número se bloquea y la versión obsoleta recibe `R4A_CONFLICT`. Verificado con dos sesiones simultáneas.
- **PIN:** 5 intentos fallidos bloquean el acceso 15 minutos; cada intento queda en el log, nunca el PIN.
- **Dispositivos:** como máximo 2 por colaborador; el tercero reemplaza al usado hace más tiempo.

### Tareas programadas (pg_cron)

| Cada       | Tarea                                                                                                                                                                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 15 minutos | Marca como vencidos los pagos pasada la fecha límite · cierra las rifas 2 días después del sorteo (solo lectura) · borra por completo las rifas 4 días después del sorteo · encola el resumen diario de cada creador tras su medianoche |
| Día        | Elimina los usuarios anónimos (navegadores de colaboradores) sin sesión activa                                                                                                                                                          |

Todas son idempotentes: si se ejecutan dos veces, la segunda no cambia nada. Además, las funciones de venta comprueban la hora de cierre por su cuenta, así que nunca se puede vender después del cierre aunque la tarea se retrase.

Todo esto está cubierto por pruebas pgTAP en `supabase/tests/`, que la CI ejecuta en cada push.

## Datos de ejemplo

`npm run db:reset` recrea la base de datos local con una cuenta de demostración:

| Correo                 | Contraseña       |
| ---------------------- | ---------------- |
| `demo@rifas4all.local` | `rifas4all-demo` |

Incluye una rifa activa ("Canasta Navideña", 3 colaboradores, 7 ventas en distintos estados) y una rifa en borrador. Estas credenciales solo existen en la base de datos local. Los enlaces de los colaboradores se consultan en Supabase Studio (la consulta está al final de `supabase/seed.sql`).

## Estructura

```
├── docs/                 # Diseño técnico, revisión crítica y ADRs
├── e2e/                  # Pruebas end-to-end (Playwright)
├── supabase/             # Configuración local, migraciones, pruebas pgTAP y Edge Functions
└── src/
    ├── domain/           # Reglas del negocio en TypeScript puro (sin React ni Supabase)
    ├── lib/              # Infraestructura compartida: variables de entorno, cliente, errores
    ├── test/             # Configuración de las pruebas
    └── App.tsx
```

## Estado del proyecto

| Fase | Contenido                                                            | Estado |
| ---- | -------------------------------------------------------------------- | ------ |
| 1    | Repositorio, herramientas, TypeScript estricto, pruebas, CI          | ✅     |
| 2    | Migraciones, restricciones, funciones SQL, Row Level Security, pgTAP | ✅     |
| 3    | Cuenta del creador y gestión de rifas                                | ⏳     |
| 4    | Colaboradores, reparto de números, enlaces y PIN                     | ⏳     |
| 5    | Tablero, compradores, estados, concurrencia y tiempo real            | ⏳     |
| 6    | Vencimientos, recordatorios y resumen diario por correo              | ⏳     |
| 7    | Panel, log, estadísticas y ciclo de vida de la rifa                  | ⏳     |
| 8    | Seguridad, accesibilidad, rendimiento y publicación                  | ⏳     |

## Limitaciones conocidas

- La app identifica **accesos**, no personas: si un colaborador comparte su enlace y su PIN, las acciones se registrarán a su nombre. Se advierte claramente al activar el acceso.
- No procesa pagos ni realiza el sorteo: solo ayuda a coordinar la venta y el cobro.

## Autor

**Juan Carlos Martínez** · [GitHub](https://github.com/JuanC67811)
