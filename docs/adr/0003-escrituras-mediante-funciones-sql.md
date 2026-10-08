# ADR 0003 — Escrituras solo mediante funciones SQL

- **Estado:** aceptada
- **Fecha:** 2026-10-09

## Contexto

Una venta implica varias cosas que deben ocurrir juntas o no ocurrir: comprobar quién actúa, que el número sea suyo, que nadie lo haya cambiado mientras tanto, que la transición de estado sea válida, actualizar el tablero público y registrar el evento en el log. Si el frontend hiciera estas escrituras por separado, una conexión que se corta a mitad dejaría datos inconsistentes, y cualquiera podría saltarse las reglas llamando directamente a la API.

## Decisión

- Los clientes **no tienen permisos de INSERT, UPDATE ni DELETE** sobre ninguna tabla.
- Cada acción es una función `SECURITY DEFINER` en `public` (por ejemplo `register_sale`, `change_sale_status`, `activate_access`), con `search_path` vacío y un `GRANT EXECUTE` explícito.
- Todas las funciones que tocan un número siguen el mismo orden de comprobaciones:
  1. Actor válido (creador dueño o colaborador con sesión activa).
  2. La rifa acepta cambios (activa y antes de la hora de cierre).
  3. Bloqueo de la fila del número (`FOR UPDATE`).
  4. Propiedad: un colaborador solo toca sus números. Se comprueba **antes** que la versión, para no revelar nada de números ajenos.
  5. Idempotencia: si el `request_id` ya se aplicó, se devuelve el estado actual sin repetir nada.
  6. Versión esperada: si no coincide, `R4A_CONFLICT`.
  7. Transición válida según la máquina de estados.
- El log se escribe **en la misma transacción** que el cambio. Si una parte falla, no queda nada a medias.
- Los errores de negocio usan `SQLSTATE P0001` y un código estable (`R4A_CONFLICT`, `R4A_FORBIDDEN`…) que el frontend traduce en un solo lugar.
- Excepción deliberada: un PIN incorrecto **no** lanza error. La función devuelve `{ok: false}`, porque una excepción desharía el contador de intentos y el registro en el log.

## Alternativas consideradas

| Alternativa                                                 | Por qué no                                                                                                                       |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Políticas RLS de INSERT/UPDATE y escribir desde el frontend | RLS decide si una fila se puede escribir, pero no puede validar transiciones, versiones ni escribir el log en la misma operación |
| Edge Functions con la clave secreta                         | Toda la lógica correría saltándose RLS, y la consistencia dependería de varias llamadas sin transacción común                    |

## Consecuencias

- La lógica de negocio crítica está en SQL y se prueba con pgTAP: 200 pruebas, incluidas transiciones válidas e inválidas, doble envío, versión obsoleta y rifa cerrada.
- La concurrencia real se verificó con dos sesiones simultáneas vendiendo el mismo número: una gana y la otra recibe `R4A_CONFLICT`.
- Los tipos de TypeScript de todas las funciones se generan desde la base de datos (`npm run db:types`), así que el frontend no puede llamarlas con parámetros equivocados sin que falle la compilación.
