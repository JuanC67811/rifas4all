# Rifas4All

[![CI](https://github.com/JuanC67811/rifas4all/actions/workflows/ci.yml/badge.svg)](https://github.com/JuanC67811/rifas4all/actions/workflows/ci.yml)

Aplicación web gratuita y mobile-first para administrar **rifas pequeñas de 100 números** (familiares, escolares, de barrio) entre una persona organizadora y hasta 12 colaboradores que **no necesitan registrarse**.

> 🚧 **En desarrollo.** Fase actual: **1 — Fundaciones** (herramientas, TypeScript estricto, pruebas y CI). Ver [plan por fases](#estado-del-proyecto).

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
| `npm run db:test`              | Pruebas de la base de datos con pgTAP                           |

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

| Fase | Contenido                                                            | Estado      |
| ---- | -------------------------------------------------------------------- | ----------- |
| 1    | Repositorio, herramientas, TypeScript estricto, pruebas, CI          | 🔄 En curso |
| 2    | Migraciones, restricciones, funciones SQL, Row Level Security, pgTAP | ⏳          |
| 3    | Cuenta del creador y gestión de rifas                                | ⏳          |
| 4    | Colaboradores, reparto de números, enlaces y PIN                     | ⏳          |
| 5    | Tablero, compradores, estados, concurrencia y tiempo real            | ⏳          |
| 6    | Vencimientos, recordatorios y resumen diario por correo              | ⏳          |
| 7    | Panel, log, estadísticas y ciclo de vida de la rifa                  | ⏳          |
| 8    | Seguridad, accesibilidad, rendimiento y publicación                  | ⏳          |

## Limitaciones conocidas

- La app identifica **accesos**, no personas: si un colaborador comparte su enlace y su PIN, las acciones se registrarán a su nombre. Se advierte claramente al activar el acceso.
- No procesa pagos ni realiza el sorteo: solo ayuda a coordinar la venta y el cobro.

## Autor

**Juan Carlos Martínez** · [GitHub](https://github.com/JuanC67811)
