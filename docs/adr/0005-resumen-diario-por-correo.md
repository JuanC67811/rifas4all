# ADR 0005 — Un resumen diario por correo, calculado desde el log

- **Estado:** aceptada
- **Fecha:** 2026-10-09

## Contexto

El organizador quiere enterarse de las ventas y los pagos sin abrir la app. Los planes gratuitos de los proveedores de correo tienen límites diarios bajos (unos 100 correos al día en Resend, a verificar). Un correo por cada venta podía agotar la cuota de toda la app con una sola rifa activa, e incluso un colaborador malintencionado podría hacerlo a propósito reservando y cancelando sin parar.

## Decisión

- **Un solo correo por organizador y día**, a la medianoche de su zona horaria, con lo ocurrido el día anterior: totales, movimientos (con comprador y motivo de las reversiones), cobros que vencen en 3 días o menos y aviso de rifas cerradas que se borrarán.
- **El contenido se calcula desde el log al enviar** (`private.digest_content`). No hay una cola con copias de datos personales: la tabla `daily_digests` solo guarda el estado del envío.
- **Texto plano**, sin HTML: los nombres los escriben personas y no deben poder inyectar enlaces o formato.
- **Flujo:** `pg_cron` encola el resumen tras la medianoche de cada organizador y llama a la Edge Function `send-digests` con un secreto guardado en Vault. La función reserva lotes (`FOR UPDATE SKIP LOCKED`), envía con Resend (clave de idempotencia por organizador y fecha) y registra el resultado: enviado, vacío, reintento con espera creciente (5, 15, 60 y 180 min) o fallido tras 5 intentos.
- **Interruptor `EMAIL_ENABLED`.** Mientras no haya dominio propio, la función no envía nada y el mismo resumen se lee en la app ("Resumen de ayer"), formateado con el **mismo código** que el correo.
- Las funciones que usa la Edge Function solo las puede ejecutar el rol `service_role`; ningún cliente puede reservar ni marcar resúmenes.

## Alternativas consideradas

| Alternativa                                                          | Por qué no                                                                                       |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Un correo por cada venta                                             | Agota la cuota gratuita y permite abusar de ella                                                 |
| Outbox con el contenido de cada correo                               | Guarda copias de datos personales que hay que vaciar después                                     |
| Enviar desde la base de datos con `pg_net` directamente al proveedor | Las respuestas de `pg_net` son asíncronas: manejar reintentos e idempotencia en SQL sería frágil |

## Consecuencias

- La venta nunca espera al correo y un proveedor caído no pierde nada: el resumen se reintenta y, mientras tanto, se ve en la app.
- El correo de cada venta es ahora un resumen nocturno: un cambio deliberado respecto al requisito inicial, aprobado por el responsable del producto.
- Para producción hace falta: dominio verificado en Resend, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_ENABLED=true`, `DIGEST_FUNCTION_SECRET` y los dos secretos de Vault (ver `docs/despliegue.md`).
