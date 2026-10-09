# Despliegue de Rifas4All

Guía para publicar la app. El código ya está listo; estos pasos requieren crear cuentas a nombre del responsable del proyecto, por eso no están automatizados.

Coste: 0 USD con los planes gratuitos, más el dominio (~10–15 USD al año) cuando se active el correo.

## 1. Proyecto de Supabase

1. Crear una cuenta en <https://supabase.com> y un proyecto nuevo (región cercana, por ejemplo `us-east-1`). Guardar la contraseña de la base de datos en un gestor de contraseñas.
2. Desde la carpeta del proyecto, en una terminal:

   ```bash
   npx supabase login
   npx supabase link --project-ref <REF_DEL_PROYECTO>
   npx supabase db push
   ```

   `db push` aplica todas las migraciones (tablas, RLS, funciones y tareas de `pg_cron`). **El seed no se aplica en producción**, así que la cuenta de demo no existe allí.

3. En el panel de Supabase → **Authentication**:
   - **Sign In / Providers → Email:** activar "Confirm email". La contraseña debe tener al menos 8 caracteres.
   - **Sign In / Providers → Anonymous sign-ins:** activado (lo usan los colaboradores).
   - **Rate limits:** revisar el límite de inicios anónimos por IP (30 por hora es un buen comienzo).
   - **URL Configuration:** _Site URL_ = la URL pública de la app; _Redirect URLs_ = `https://<tu-dominio>/**`.
4. En **Settings → API**, copiar la _Project URL_ y la clave **publicable** (`sb_publishable_…`). Nunca uses la clave secreta en el frontend: la app se niega a arrancar si la detecta.
5. Ejecutar el **Security Advisor** del panel (Advisors → Security) y confirmar que no hay alertas críticas.

## 2. Frontend (Cloudflare Pages o Netlify)

Ambos leen `public/_headers` (CSP estricta y cabeceras de seguridad) y `public/_redirects` (rutas de la SPA).

| Ajuste                          | Valor                        |
| ------------------------------- | ---------------------------- |
| Comando de build                | `npm run build`              |
| Carpeta de salida               | `dist`                       |
| Versión de Node                 | 24                           |
| `VITE_SUPABASE_URL`             | URL del proyecto de Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave publicable             |

Al conectar el repositorio de GitHub, cada push a `main` publica una versión nueva. GitHub Pages **no** se recomienda aquí porque no permite configurar cabeceras HTTP (CSP, `frame-ancestors`).

Después de publicar, volver a Supabase → Authentication → URL Configuration y poner la URL definitiva.

## 3. Correo (cuando haya dominio propio)

Sin este paso todo funciona igual. Los resúmenes diarios se ven en la app ("Resumen de ayer"), pero no se envían. Lo que sí queda limitado es la confirmación de cuentas y la recuperación de contraseñas: el SMTP integrado de Supabase solo sirve para pruebas.

1. Comprar un dominio y verificarlo en <https://resend.com> (registros SPF, DKIM y DMARC).
2. **Correos de autenticación:** Supabase → Authentication → Emails → SMTP Settings con los datos SMTP de Resend.
3. **Resumen diario:**

   ```bash
   npx supabase functions deploy send-digests --no-verify-jwt
   npx supabase secrets set RESEND_API_KEY=re_... EMAIL_FROM="Rifas4All <resumen@tudominio.com>" EMAIL_ENABLED=true DIGEST_FUNCTION_SECRET=<secreto-largo-aleatorio>
   ```

   Y en el **SQL Editor** de Supabase, con el mismo secreto:

   ```sql
   select vault.create_secret('https://<REF>.supabase.co/functions/v1/send-digests', 'digest_function_url');
   select vault.create_secret('<secreto-largo-aleatorio>', 'digest_function_secret');
   ```

   A partir de ahí, `pg_cron` llama a la función cada 15 minutos. Se puede comprobar en Database → Cron Jobs y en Edge Functions → Logs.

## 4. Verificación después de publicar

- [ ] Registrarse con un correo real, confirmar y entrar.
- [ ] Crear una rifa, agregar colaboradores, repartir y activar.
- [ ] Abrir un enlace de colaborador en otro teléfono (Chrome de Android y Safari de iOS) y activarlo con PIN.
- [ ] Vender un número desde el colaborador y verlo en vivo en el panel del organizador.
- [ ] Revisar en las herramientas del navegador que la CSP no bloquee nada (consola sin errores).
- [ ] Recuperar la contraseña (requiere el SMTP propio).
- [ ] Eliminar la rifa de prueba.

## Límites del plan gratuito a vigilar

| Servicio          | Límite aproximado (verificar en su web)                   | Impacto                                                                    |
| ----------------- | --------------------------------------------------------- | -------------------------------------------------------------------------- |
| Supabase          | Pausa tras ~7 días sin actividad; 500 MB de base de datos | Reactivar el proyecto desde el panel si se pausa                           |
| Supabase Realtime | Conexiones simultáneas limitadas                          | De sobra para rifas de 13 personas                                         |
| Resend            | ~100 correos al día, ~3 000 al mes                        | Un resumen diario por organizador: alcanza para ~100 organizadores activos |
