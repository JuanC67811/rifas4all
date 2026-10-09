/**
 * El resumen diario se formatea con el mismo código que usa la Edge Function para
 * el correo: así lo que se ve en la app y lo que llega por correo es idéntico.
 */
export {
  digestHasContent,
  formatDigest,
  type DigestContent,
} from '../../supabase/functions/_shared/digest-format.ts'
