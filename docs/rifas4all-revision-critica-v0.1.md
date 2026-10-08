# Rifas4All — Revisión crítica del diseño v0.1

> Revisión hecha con el rol de responsable de seguridad y mantenimiento.
> Documento revisado: `docs/archivo/rifas4all-diseno-tecnico-v0.1.md`.
> Resultado: `docs/rifas4all-diseno-tecnico.md` (v0.2).
> Severidad: 🔴 alta · 🟠 media · 🟡 baja.

## 0. Decisiones nuevas tuyas que cambian el diseño

| Decisión | Impacto |
|---|---|
| Sin integración con WhatsApp: la página genera el texto y la persona lo copia y lo pega donde quiera | Se eliminan `wa.me` y Web Share. Solo "Copiar". **Lo apliqué también al recordatorio de pago** (antes abría WhatsApp). Si para el recordatorio sí quieres el botón de WhatsApp, dímelo. |
| No importa que el texto copiado contenga el enlace y el PIN | Desaparece la contradicción C2. Además permite replantear C1 (ver H-12). |
| P1 confirmada | Reservado = apartado sin deuda; Pendiente = deuda con fecha, recordatorio y vencimiento. |
| P2: el dominio se comprará después | Se puede desarrollar todo, pero **la publicación abierta queda bloqueada hasta tener el dominio** (ver H-20). |
| P3: el colaborador marca pagado **y puede revertir pagos de sus números** | Nueva regla en la máquina de estados. |
| Máximo **2 dispositivos** por colaborador | Ver H-14: el navegador interno de WhatsApp y Chrome cuentan como dos. |
| Anonimización **15 días** después de archivar | Ver H-22: hace falta archivado automático o la retención nunca empieza. |

## 1. Vulnerabilidades

| ID | Sev. | Hallazgo | Corrección en v0.2 |
|---|---|---|---|
| H-01 | 🔴 | **PostgreSQL concede `EXECUTE` a `PUBLIC` por defecto en toda función nueva**, y PostgREST expone por RPC las funciones del esquema `public`. Con v0.1, cualquiera con la clave publicable podría llamar `claim_notifications`, `process_due_payments` o los helpers de RLS. | Dos esquemas: `public` (solo tablas y RPC pensadas para el cliente) y `private` (helpers, jobs, secretos; no expuesto). `REVOKE EXECUTE … FROM PUBLIC` + `ALTER DEFAULT PRIVILEGES` en la primera migración; `GRANT` explícito función por función. Test pgTAP que lista funciones ejecutables por `anon`/`authenticated` y falla si aparece una no autorizada. |
| H-02 | 🔴 | **Un usuario anónimo de Supabase tiene el rol `authenticated`.** Cualquiera puede llamar `signInAnonymously()` y obtener ese rol. En v0.1 no se dejó explícito que toda función o política para "creadores" debe excluir anónimos. Ejemplo: `create_raffle` sin esa comprobación permitiría a un anónimo crear rifas y generar correos. | Helper `private.require_creator()` que exige `is_anonymous = false` en el JWT, usado en toda RPC de creador. Regla de revisión: prohibido `USING (true)` y prohibido cualquier política que solo diga `TO authenticated`. Test por rol "anónimo sin sesión de colaborador". |
| H-03 | 🔴 | **Agotamiento de cuota de correo compartida.** El plan gratuito del proveedor (~100/día en Resend) es **global para toda la app**. Un colaborador (o un atacante con un enlace) puede alternar reservar/cancelar en bucle y dejar sin correos a todos los creadores. | Límite de correos por rifa y día (contado sobre la outbox, sin tabla extra). Al superarlo: no se envían más ese día y el panel lo muestra. Vencimientos y recordatorios pasan a **un resumen por rifa y día** (H-19). |
| H-04 | 🟠 | **Inyección de HTML en correos**: nombre del comprador, alias, nota y nombre de la rifa son texto libre que iba a insertarse en una plantilla HTML (enlaces de phishing en la bandeja del creador). | Correos **solo en texto plano** en el MVP; saltos de línea eliminados de campos usados en el asunto. Más simple y elimina la clase de fallo. |
| H-05 | 🟠 | Los colaboradores podían leer la tabla `raffles` completa (incluye `owner_id`, plantilla, configuración). RLS filtra filas, no columnas. | La tabla `raffles` es solo del creador. El colaborador recibe una vista reducida mediante `get_collaborator_home()` (función que devuelve solo los campos necesarios). |
| H-06 | 🟠 | Fuerza bruta del PIN como **denegación de servicio**: con el enlace, alguien puede fallar el PIN a propósito; v0.1 escalaba hasta un bloqueo definitivo, que es justo lo que quiere el atacante. | Solo bloqueo temporal (5 fallos → 15 min), sin bloqueo definitivo; el creador ve los intentos en el log. |
| H-07 | 🟠 | La Edge Function de correo es una URL pública; si la validación del secreto falla, cualquiera la dispara. | Secreto en Vault, comparación en tiempo constante, y la función solo procesa lo que ya está en la outbox (no acepta contenido del llamante). |
| H-08 | 🟡 | `pg_graphql` viene activo en Supabase y expone las tablas por otro endpoint (con las mismas políticas RLS). Superficie innecesaria. | Desactivar la extensión `pg_graphql`. |
| H-09 | 🟡 | Clave de idempotencia sin comprobar el contenido: reutilizar un `request_id` con datos distintos devolvía la respuesta de otra operación. | La idempotencia se apoya en el log (H-17) y se valida que `action` y `number` coincidan; si no, error. |

## 2. Permisos mal definidos

| ID | Sev. | Hallazgo | Corrección |
|---|---|---|---|
| H-10 | 🟠 | No estaba definido quién puede **editar los datos del comprador** (corregir un teléfono mal escrito). | Dueño de la lista y creador, mientras la venta no esté cancelada. Se registra en el log *qué campos* cambiaron, no sus valores. |
| H-11 | 🟠 | Reglas de pago incoherentes con tu respuesta P3. Además `pagado → disponible` (solo creador) era cosmético: cualquiera puede revertir y después cancelar en dos pasos. | `pagado → pendiente` (dueño o creador, motivo obligatorio). Se elimina `pagado → disponible`: para liberar un número pagado hay que revertir primero. Una sola regla, sin falsas garantías. |
| — | 🟡 | El estado **Cancelada** de la rifa y la opción de **desarchivar** no aportaban nada frente a "Archivar" y chocaban con la anonimización. | Estados: Borrador → Activa → Cerrada → Archivada. Archivar es definitivo. Un borrador sin ventas se puede eliminar. |
| — | 🟡 | v0.1 mandaba correo al creador cuando **él mismo** bloqueaba o restablecía un acceso. | Esos eventos solo van al log; el correo de accesos queda desactivado por defecto. |

## 3. Formas de ver datos de otros colaboradores

Revisé cada camino de lectura disponible para un colaborador:

| Camino | ¿Fuga? | Nota |
|---|---|---|
| `SELECT` directo a `sales` | No | RLS por `collaborator_id`, que pone el servidor y nunca el cliente. |
| Embedding de PostgREST (`raffle_numbers?select=*,sales(*)`) | No, pero hay que probarlo | El recurso embebido también aplica RLS. **Test explícito añadido.** |
| `collaborators` | **Sí en v0.1** si alguna política era amplia: contiene teléfonos de colaboradores | Solo el creador lee la tabla; el colaborador lee los nombres permitidos vía función. |
| `raffles` | Sí (columnas de más) | H-05. |
| `audit_events.before/after` | **Riesgo real** | Si una función guarda la fila de venta completa "por comodidad", filtra datos personales a quien lea ese evento. → los `before/after` se construyen con **lista blanca de campos** en un único helper; test que verifica que ningún evento contiene claves `buyer_*`/`note`. |
| Respuesta de error `CONFLICTO` con "estado actual" | Posible | Se valida la propiedad **antes** que la versión: sobre un número ajeno siempre responde `PROHIBIDO`, sin detalles. |
| Realtime | No | Solo `raffle_numbers` (sin datos personales) en la publicación. `sales` no se publica. |
| `collaborator_id` visible en el tablero aunque los nombres estén ocultos | Mínima | Permite agrupar números por vendedor anónimo. Aceptado y documentado. |

## 4. Riesgos de duplicación de ventas o correos

| ID | Sev. | Hallazgo | Corrección |
|---|---|---|---|
| H-15 | 🟠 | Dos versiones (de número y de venta) para el mismo control → confusión y posibles validaciones contra la versión equivocada. | Una sola `version` en `raffle_numbers`; toda mutación de la venta la incrementa (trigger). |
| H-16 | 🟠 | `dedupe_key = sale.paid:<id>:<version>` dependía de una versión que podía no cambiar en algunas rutas. | **Un correo por evento del log**: `outbox.audit_event_id UNIQUE`. Si el evento existe, el correo es único por construcción. |
| H-17 | 🟡 | Tabla `idempotency_keys` aparte: otra tabla, otro job de limpieza, otra fuente de verdad. | `audit_events.request_id` con índice único `(actor_user_id, request_id)`. El reintento choca con el índice → se responde "ya aplicado" con el estado actual. |
| H-18 | 🟡 | Ejecuciones solapadas del worker de correo (cron cada minuto + envío lento). | Ya lo cubrían `FOR UPDATE SKIP LOCKED` + `locked_until`; se añade que el worker termina antes de 50 s. La idempotencia del proveedor se trata como defensa extra, **no** como garantía (verificar su soporte en la Fase 6). |
| H-19 | 🔴 | **Pico de correos por diseño:** con una sola fecha límite por rifa, *todas* las ventas pendientes entran en la ventana de 3 días el mismo día → hasta 100 correos de recordatorio de golpe (y otros 100 al vencer). Supera la cuota diaria. | **Un correo de resumen por rifa**: "Faltan 3 días: 12 pagos pendientes (lista)". Lo mismo para vencimientos. Tabla `raffle_reminders (raffle_id, due_date)` como clave única. Las alertas por número siguen en la app. |

## 5. Problemas con enlaces, sesiones y PIN

| ID | Sev. | Hallazgo | Corrección |
|---|---|---|---|
| H-12 | 🟠 | **Hashear token y PIN protegía de una amenaza que aquí no existe y empeoraba la usabilidad.** Un hash protege si alguien lee la base de datos; pero quien lee la base de datos ya tiene todos los nombres y teléfonos y puede escribir. Mientras tanto, "mostrar una sola vez" obligaba a regenerar accesos (y expulsar dispositivos) solo para reenviar un mensaje perdido. Y el PIN de 4 dígitos hasheado se rompe en segundos. La única razón fuerte para hashear un PIN es que la gente **reutiliza PINs** (el del banco). | **El PIN siempre lo genera el sistema** (nadie escribe el suyo, así que no hay reutilización). Token y PIN se guardan en `private.collaborator_secrets` (sin permisos para nadie salvo funciones). El creador puede **copiar el mensaje de acceso cuando quiera** (`get_access_message`, solo dueño, queda en el log). Justificación en un ADR. Esto cumple tu cláusula "salvo que propongas un mecanismo seguro diferente y lo justifiques". |
| H-13 | 🟠 | Tres acciones de recuperación en v0.1 (bloquear, rotar sin revocar, restablecer) → la persona no sabe cuál usar, y "rotar sin revocar" dejaba dentro a quien ya hubiera usado el enlace filtrado. | Dos botones: **Pausar/Reanudar** y **Nuevo acceso** (nuevo token + nuevo PIN + cierra todas las sesiones). |
| H-14 | 🟠 | Máximo de 2 dispositivos: abrir el enlace dentro de WhatsApp y luego en Chrome ya consume los dos. Si el tercero se rechaza, Carlos queda bloqueado al cambiar de teléfono; si se acepta revocando el más antiguo, quien tenga el enlace puede expulsar a Carlos. | Se acepta revocando la sesión **menos usada recientemente**; queda en el log y en el panel ("Carlos: 2 dispositivos, uno nuevo hoy"). Con 2 como máximo, el daño de un enlace filtrado queda acotado y visible. La pantalla de activación sugiere "abre en tu navegador" (sin forzarlo). |
| — | 🟡 | v0.1 permitía que un dispositivo tuviera **varios colaboradores en la misma rifa**, con un selector "¿con qué acceso trabajas?". Complejo para algo casi inexistente. | Un dispositivo = un colaborador **por rifa** (sí puede estar en rifas distintas). Activar otro acceso de la misma rifa en ese dispositivo reemplaza el anterior, con aviso. |
| — | 🟡 | Dos clientes de Supabase (creador y dispositivo) para que el creador pudiera abrir enlaces de colaborador en su propio navegador. | Si hay sesión de creador, la página de invitación dice "Estás conectado como organizador. Abre este enlace en otro navegador o en modo incógnito". Un solo cliente. |
| — | 🟡 | El portapapeles (`navigator.clipboard`) exige HTTPS y un gesto del usuario, y en algunos navegadores internos falla. | Siempre se muestra el texto en un cuadro seleccionable además del botón "Copiar". |

## 6. Inconsistencias en el log

| ID | Sev. | Hallazgo | Corrección |
|---|---|---|---|
| H-21 | 🔴 | **El trigger que impide `DELETE` en el log también impediría borrar la cuenta** (el borrado en cascada falla). Contradicción con el derecho de supresión. | Trigger solo contra `UPDATE`. Contra `DELETE`: sin permisos para clientes y un único camino de borrado (`private.delete_account`). |
| — | 🟠 | El campo `result` prometía registrar acciones fallidas, pero una excepción revierte la transacción y el registro se pierde. | `result` queda solo para lo que realmente puede registrarse: `success`, `pin_failed`, `email_failed`. Lo documenté así en lugar de prometer lo que no se cumple. |
| — | 🟡 | Registrar cada correo enviado duplicaba el volumen del log. | El estado de cada correo vive en la outbox (visible al creador). Al log solo van los fallos definitivos. |
| — | 🟡 | `now()` es la hora de inicio de la transacción: varios eventos de una misma operación comparten la misma hora. | Se ordena por `id` (identidad creciente), no por fecha. |
| — | 🟡 | `before/after` sin forma definida → la interfaz no sabría mostrarlos. | Forma fija por `action`, definida en TS y validada en el helper SQL (lista blanca). |
| — | 🟡 | `reminder.whatsapp_opened` ya no tiene sentido (no se abre WhatsApp). | Eliminado. No se registra el copiado de recordatorios (no prueba nada). Sí se registra `access.message_copied` (el creador obtuvo credenciales). |

## 7. Sobreingeniería

| Elemento de v0.1 | Por qué sobra | v0.2 |
|---|---|---|
| Semilla + PRNG SHA-256 + versión de algoritmo para la distribución aleatoria | Reproducir solo sirve si un tercero verifica, y en una rifa de barrio nadie lo hará. El resultado ya queda guardado y en el log inmutable. | Barajado del servidor con `gen_random_uuid()`; se guarda el resultado. |
| `idempotency_keys` | Duplicaba el log | `audit_events.request_id` |
| `notification_preferences` por rifa | Pocas casillas | Preferencias por creador en `profiles` |
| `email_daily_usage` | Se puede contar en la outbox | Eliminada |
| Fecha límite propia por venta | Complejidad en recordatorios, vencimientos y permisos | Solo fecha de la rifa. El vencido **no libera** el número, así que no hace falta "extender" por venta. |
| `version` en `raffles` | Solo el creador edita la configuración | Última escritura gana, con log |
| Bloqueo progresivo del PIN | Ayudaba al atacante (H-06) | Bloqueo fijo de 15 min |
| Etiqueta de dispositivo e inactividad de 60 días | Datos y jobs extra | Solo `created_at`/`last_seen_at`; las sesiones mueren al archivar |
| Realtime de `collaborators` | El creador puede volver a consultar | Solo `raffle_numbers` |
| PWA y Turnstile en el MVP | No son necesarios para lanzar | Ideas futuras / "si aparece abuso" |
| Correos HTML | Riesgo H-04 y más trabajo | Texto plano |
| Pruebas de RLS duplicadas en pgTAP y en Vitest | Doble mantenimiento | pgTAP para RLS/funciones; Vitest de integración solo para concurrencia real |

## 8. Funciones que deberían salir del MVP

- Abrir WhatsApp / Web Share → **eliminado** (tu decisión).
- Desarchivar y rifa "Cancelada" → eliminados.
- Fecha límite por venta → eliminada.
- Correo por cada recordatorio y por cada vencimiento → reemplazados por un resumen por rifa.
- Correo de activación, bloqueo y restablecimiento de accesos → solo log (opción de correo apagada por defecto).
- Selector de varios colaboradores por dispositivo → eliminado.
- Vista "sesiones por dispositivo" detallada → reducida a "N dispositivos, último uso".

## 9. Riesgos operativos que v0.1 no resolvía

| ID | Sev. | Hallazgo | Corrección |
|---|---|---|---|
| H-20 | 🔴 | **Sin dominio no hay registro público.** El SMTP integrado de Supabase Auth solo entrega a miembros del equipo del proyecto y con un límite muy bajo por hora. Un desconocido que se registre no recibiría la confirmación ni podría recuperar su contraseña. Los proveedores de correo, sin dominio verificado, solo envían a tu propia dirección. | Desarrollo completo con el capturador de correos local de la CLI de Supabase. Notificaciones detrás de un interruptor `EMAIL_ENABLED`. **Hito explícito: "comprar dominio + SMTP" antes de abrir el registro.** Hasta entonces la app funciona como demo de portafolio con cuentas tuyas. |
| H-22 | 🟠 | "Anonimizar 15 días después de archivar" depende de que el creador archive. Si nunca lo hace, los teléfonos se guardan para siempre. | **[SUP]** Archivado automático 30 días después de la fecha del sorteo (con aviso en el panel desde 7 días antes). Anonimización 15 días después. Al archivar se avisa: "En 15 días se borrarán nombres y teléfonos de compradores". |
| H-23 | 🟡 | El plan gratuito de Supabase pausa el proyecto tras ~1 semana sin actividad, y una demo de portafolio puede pasar tiempo sin visitas. | Documentado en el README. Reactivarlo es manual; no merece infraestructura extra. |

## 10. Lo que **no** cambio (sigue siendo correcto)

Escrituras solo mediante funciones; separación `raffle_numbers` (pública) / `sales` (privada); índice único de venta activa; bloqueo de fila + versión; outbox; log escrito en la misma transacción; token en el fragmento `#`; activación solo tras "Sí, soy Carlos"; fallos de PIN registrados sin lanzar excepción; tiempo real como señal y la base de datos como fuente de verdad.
