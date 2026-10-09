# Despliegue de Rifas4All

## Estado actual (2026-10-09)

| Pieza                                 | Dónde                                                                             | Estado                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| App (frontend)                        | Cloudflare Workers, archivos estáticos: <https://rifas4all.rifas4all.workers.dev> | ✅ Publicada, con cabeceras de seguridad                        |
| Base de datos y Auth                  | Supabase, proyecto `rifas4all` (`jbaapnhfcvlodsyqgduj`, us-east-1)                | ✅ 12 migraciones aplicadas, `db lint` limpio, `pg_cron` activo |
| Correo propio (SMTP y resumen diario) | Resend + dominio                                                                  | ⏳ Pendiente de comprar el dominio                              |

## Cómo se publica una versión nueva

Desde la carpeta del proyecto (con sesión iniciada en `npx supabase login` y `npx wrangler login`):

```bash
npx supabase db push
npm run deploy
```

- `db push` aplica las migraciones nuevas (si las hay). Pide la contraseña de la base de datos, que está en `.env.produccion.local` (archivo local, nunca se sube a GitHub).
- `npm run deploy` compila con `.env.production.local` (URL y clave **publicable** de producción; también local) y sube `dist` a Cloudflare.

`wrangler.jsonc` sirve `dist` en modo SPA (las rutas como `/rifas` o `/i` responden con `index.html`) y aplica `public/_headers`: CSP estricta, sin iframes, sin referrer, HSTS y caché inmutable para los archivos con hash.

## Configuración de Supabase versionada

La configuración de Auth de producción está en `supabase/config.toml`, en la sección `[remotes.produccion]`, y se aplica con:

```bash
npx supabase config push
```

Qué fija esa sección:

- La dirección de la app y las URLs de redirección.
- La confirmación de correo obligatoria.
- Los inicios de sesión anónimos activados (los usan los colaboradores), con un límite de 30 por hora por IP.
- Las contraseñas de al menos 8 caracteres.
- Valores más estrictos que los del desarrollo local para el envío de correos y los códigos OTP.

`config push` muestra los cambios y pide confirmar cada servicio. Storage no se usa: no hace falta confirmarlo.

## Pendiente: correo con dominio propio

Hasta este paso, **el SMTP integrado de Supabase solo envía correos a los miembros del equipo del proyecto**, con un límite muy bajo por hora. Por eso, por ahora solo el dueño de la cuenta puede registrarse y confirmar su correo. Para abrir el registro al público:

1. Comprar un dominio y verificarlo en <https://resend.com> (registros SPF, DKIM y DMARC).
2. **Correos de autenticación:** Supabase → Authentication → Emails → SMTP Settings, con los datos SMTP de Resend.
3. **Resumen diario:**

   ```bash
   npx supabase functions deploy send-digests --no-verify-jwt
   npx supabase secrets set RESEND_API_KEY=re_... EMAIL_FROM="Rifas4All <resumen@tudominio.com>" EMAIL_ENABLED=true DIGEST_FUNCTION_SECRET=<secreto-largo-aleatorio>
   ```

   Y en el **SQL Editor** de Supabase, con el mismo secreto:

   ```sql
   select vault.create_secret('https://jbaapnhfcvlodsyqgduj.supabase.co/functions/v1/send-digests', 'digest_function_url');
   select vault.create_secret('<secreto-largo-aleatorio>', 'digest_function_secret');
   ```

4. Opcional: usar el dominio también para la app. Se configura en Cloudflare → Workers → rifas4all → Domains, y después hay que actualizar `site_url` en `[remotes.produccion.auth]` y aplicarlo con `config push`.

## Verificación después de publicar

- [x] Rutas y cabeceras de seguridad en producción (200 en `/`, `/rifas`, `/i` y `/privacidad`; CSP, HSTS, `X-Frame-Options`).
- [x] La app en Cloudflare consulta a Supabase en la nube sin errores de CSP. Un enlace de acceso inventado responde "Enlace no válido", y el token se borra de la barra de direcciones.
- [ ] Registrarse con el correo del dueño de la cuenta de Supabase, confirmar y entrar.
- [ ] Crear una rifa, agregar colaboradores, repartir y activar.
- [ ] Abrir un enlace de colaborador en otro teléfono (Chrome de Android y Safari de iOS) y activarlo con PIN.
- [ ] Vender un número desde el colaborador y verlo en vivo en el panel del organizador.
- [ ] Con el SMTP propio: recuperar la contraseña y recibir el resumen diario.

## Límites del plan gratuito a vigilar

| Servicio                       | Límite aproximado (verificar en su web)                   | Impacto                                                                    |
| ------------------------------ | --------------------------------------------------------- | -------------------------------------------------------------------------- |
| Supabase                       | Pausa tras ~7 días sin actividad; 500 MB de base de datos | Reactivar el proyecto desde el panel si se pausa                           |
| Cloudflare Workers (estáticos) | Las peticiones a archivos estáticos son gratuitas         | Ninguno para este uso                                                      |
| Resend                         | ~100 correos al día, ~3 000 al mes                        | Un resumen diario por organizador: alcanza para ~100 organizadores activos |
