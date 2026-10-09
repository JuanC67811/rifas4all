// Edge Function: envía los resúmenes diarios pendientes (diseño §19 y §30).
//
// La llama pg_cron (vía pg_net) cada 15 minutos con el encabezado x-digest-secret.
// Variables de entorno (supabase secrets set …):
//   DIGEST_FUNCTION_SECRET  secreto compartido con Vault (digest_function_secret)
//   EMAIL_ENABLED           "true" para enviar; cualquier otro valor = no enviar
//   RESEND_API_KEY          clave del proveedor (solo en el servidor)
//   EMAIL_FROM              remitente verificado, ej. "Rifas4All <resumen@tudominio.com>"
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY las provee Supabase automáticamente.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { digestHasContent, formatDigest, type DigestContent } from '../_shared/digest-format.ts'

const BATCH_SIZE = 20

/** Comparación en tiempo constante: no revela cuántos caracteres coinciden. */
function safeEqual(a: string, b: string) {
  const left = new TextEncoder().encode(a)
  const right = new TextEncoder().encode(b)
  if (left.length !== right.length) return false
  let diff = 0
  for (let i = 0; i < left.length; i++) diff |= left[i]! ^ right[i]!
  return diff === 0
}

type Outcome = 'sent' | 'empty' | 'retry' | 'failed'

async function sendEmail(to: string, subject: string, text: string, idempotencyKey: string) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
      // Si el proceso se cae después de enviar pero antes de marcarlo, el reintento
      // con la misma clave no duplica el correo.
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ from: Deno.env.get('EMAIL_FROM'), to: [to], subject, text }),
  })

  if (response.ok) {
    const body = (await response.json()) as { id?: string }
    return { outcome: 'sent' as Outcome, providerId: body.id ?? null, error: null }
  }
  // 429 y 5xx son temporales; el resto (datos inválidos, remitente no verificado) no mejora reintentando.
  const temporary = response.status === 429 || response.status >= 500
  return {
    outcome: (temporary ? 'retry' : 'failed') as Outcome,
    providerId: null,
    error: `HTTP ${response.status}`,
  }
}

Deno.serve(async (request) => {
  const expected = Deno.env.get('DIGEST_FUNCTION_SECRET') ?? ''
  const received = request.headers.get('x-digest-secret') ?? ''
  if (!expected || !safeEqual(received, expected)) {
    return new Response('No autorizado', { status: 401 })
  }

  if (Deno.env.get('EMAIL_ENABLED') !== 'true') {
    // Sin dominio ni proveedor configurados: los resúmenes quedan visibles en la app.
    return Response.json({ skipped: 'EMAIL_ENABLED no es "true"' })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  const { data: claimed, error } = await supabase.rpc('claim_daily_digests', {
    p_limit: BATCH_SIZE,
  })
  if (error) return new Response('No se pudieron reservar los resúmenes', { status: 500 })

  const results: Record<Outcome, number> = { sent: 0, empty: 0, retry: 0, failed: 0 }

  for (const digest of claimed ?? []) {
    let outcome: Outcome = 'failed'
    let providerId: string | null = null
    let errorText: string | null = null

    try {
      const { data: content } = await supabase.rpc('digest_content_for', {
        p_user_id: digest.user_id,
        p_date: digest.digest_date,
      })
      if (!content || !digestHasContent(content as DigestContent)) {
        outcome = 'empty'
      } else {
        const { subject, text } = formatDigest(content as DigestContent)
        const result = await sendEmail(
          digest.email,
          subject,
          text,
          `digest-${digest.user_id}-${digest.digest_date}`,
        )
        outcome = result.outcome
        providerId = result.providerId
        errorText = result.error
      }
    } catch (cause) {
      // Error de red u otro imprevisto: se reintenta. Solo se registra el tipo de error.
      outcome = 'retry'
      errorText = cause instanceof Error ? cause.name : 'Error'
    }

    await supabase.rpc('complete_daily_digest', {
      p_user_id: digest.user_id,
      p_date: digest.digest_date,
      p_outcome: outcome,
      p_provider_message_id: providerId,
      p_error: errorText,
    })
    results[outcome] += 1
  }

  return Response.json(results)
})
