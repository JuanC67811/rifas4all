import { useQuery } from '@tanstack/react-query'
import { addDays, browserTimeZone, todayIn } from '@/domain/dates'
import { digestHasContent, formatDigest } from '@/domain/digest'
import { getDailyDigest } from './api'

/**
 * "Resumen de ayer": el mismo texto que el correo de medianoche. Sirve aunque el
 * correo todavía no esté configurado (sin dominio propio) y para revisarlo de día.
 */
export function DigestCard() {
  const yesterday = addDays(todayIn(browserTimeZone()), -1)
  const digest = useQuery({
    queryKey: ['digest', yesterday],
    queryFn: () => getDailyDigest(yesterday),
  })

  if (!digest.data || !digestHasContent(digest.data)) return null
  const { text } = formatDigest(digest.data)

  return (
    <details className="rounded-card ring-1 ring-hairline bg-surface p-4">
      <summary className="min-h-11 cursor-pointer font-semibold">Resumen de ayer</summary>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm">{text}</p>
    </details>
  )
}
