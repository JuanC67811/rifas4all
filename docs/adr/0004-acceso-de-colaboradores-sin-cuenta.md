# ADR 0004 — Acceso de colaboradores sin cuenta

- **Estado:** aceptada
- **Fecha:** 2026-10-09

## Contexto

Los colaboradores (hasta 12 por rifa) son familiares, vecinos o compañeros que solo quieren vender números. Pedirles correo y contraseña haría que muchos no participaran. Aun así, la base de datos necesita saber **quién** actúa para aplicar los permisos ("solo tus números") y registrar el log a su nombre.

## Decisión

1. **Enlace personal + PIN opcional.** El organizador copia un mensaje con el enlace (`/i#token`) y, si lo activó, un PIN de 4 dígitos, y lo pega donde quiera. La app no se integra con WhatsApp ni envía mensajes.
2. **El token va en el fragmento (`#`) de la URL**, que el navegador no envía al servidor ni a los registros del hosting. La página lo lee una vez y lo borra de la barra de direcciones.
3. **Sesión anónima de Supabase por dispositivo.** Al confirmar "Sí, soy Carlos" (no antes, para que las vistas previas de enlaces no creen usuarios), el navegador obtiene un usuario anónimo y la función `activate_access` lo liga a Carlos en `collaborator_sessions`. Desde ahí, RLS y las funciones reconocen a Carlos con un JWT real.
4. **Máximo 2 dispositivos por colaborador.** El tercero reemplaza al usado hace más tiempo, y queda en el log.
5. **Pausar y "Nuevo acceso".** Pausar corta el acceso en la siguiente petición. "Nuevo acceso" cambia el token y el PIN y cierra todas las sesiones. En ningún caso cambian números ni ventas.
6. **Credenciales recuperables por el organizador.** El token y el PIN se guardan legibles en el esquema `private` (sin permisos para ningún cliente), para que el organizador pueda volver a copiar el mensaje cuando lo necesite.

## Por qué guardar el PIN legible (y no un hash)

Un hash protege si alguien llega a leer la base de datos. Pero quien la lee ya tiene todos los nombres y teléfonos, y podría escribir directamente. Además, un PIN de 4 dígitos hasheado se descifra en segundos. La razón de peso para hashear un PIN es que la gente **reutiliza** sus PIN (el del banco); aquí el PIN **siempre lo genera el sistema**, así que ese riesgo no existe. A cambio, el organizador puede reenviar el mensaje sin expulsar a nadie. La protección real del PIN es otra: no sirve sin el token, y tras 5 fallos el acceso se bloquea 15 minutos.

## Alternativas consideradas

| Alternativa                                      | Por qué no                                                                                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Cuentas para colaboradores                       | Fricción alta para el público objetivo                                                                                               |
| Token propio de sesión y todo vía Edge Functions | Se perdería RLS como defensa: toda la lógica correría con la clave secreta                                                           |
| JWT firmados a mano con el secreto del proyecto  | Gestión delicada de claves; un error expone todo el proyecto                                                                         |
| Token de un solo uso                             | El navegador interno de WhatsApp y Safari borran almacenamiento: el colaborador quedaría fuera y dependería del organizador cada vez |

## Consecuencias

- La app identifica **accesos**, no personas. Si Carlos comparte su enlace y su PIN, las acciones se registran a su nombre. La pantalla de activación lo advierte de forma explícita.
- Si el organizador abre un enlace de colaborador en su propio navegador, la app lo detiene y le pide usar otro navegador, porque activar el acceso cerraría su sesión de organizador.
- En producción hay que revisar el límite de inicios de sesión anónimos por IP en el panel de Supabase, y considerar CAPTCHA si aparece abuso.
