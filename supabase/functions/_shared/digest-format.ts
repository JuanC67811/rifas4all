/**
 * Texto del resumen diario (diseño §19). Sin dependencias: lo usan la Edge Function
 * (Deno) para el correo y la app (Vite) para mostrar el resumen en pantalla, así
 * ambos dicen exactamente lo mismo.
 *
 * Texto plano a propósito: un correo HTML con nombres escritos por personas abriría
 * la puerta a inyectar enlaces o formato (revisión crítica H-04).
 */
export type DigestMovement = {
  at: string
  action: string
  actor: string
  collaborator: string | null
  number: number | null
  to_status: string | null
  reason: string | null
  buyer_name: string | null
  buyer_alias: string | null
  buyer_phone: string | null
}

export type DigestToCollect = {
  number: number
  status: 'pending_payment' | 'overdue'
  collaborator: string
  buyer_name: string
  buyer_alias: string | null
  buyer_phone: string | null
}

export type DigestRaffle = {
  name: string
  status: 'active' | 'closed'
  currency: string
  price_minor: number
  draw_date: string
  payment_deadline: string
  deadline_in_days: number
  closes_on: string
  deleted_on: string
  totals: Partial<Record<'available' | 'reserved' | 'pending_payment' | 'paid' | 'overdue', number>>
  movements: DigestMovement[]
  to_collect: DigestToCollect[]
}

export type DigestContent = {
  date: string
  time_zone: string
  raffles: DigestRaffle[]
}

// {n} se reemplaza por el número de la rifa ("07").
const ACTIONS: Record<string, string> = {
  'sale.reserved': 'reservó el número {n}',
  'sale.sold': 'vendió el número {n}',
  'sale.committed': 'confirmó la compra del número {n}',
  'sale.payment_confirmed': 'registró el pago del número {n}',
  'sale.payment_reverted': 'REVIRTIÓ el pago del número {n}',
  'sale.cancelled': 'canceló la venta del número {n}',
  'sale.released': 'liberó el número {n}',
  'sale.overdue': 'marcó como vencido el número {n}',
  'sale.reopened': 'reabrió el cobro del número {n}',
  'sale.buyer_updated': 'corrigió los datos del comprador del número {n}',
  'access.activated': 'activó su acceso',
  'access.pin_locked': 'bloqueó su acceso por PIN incorrecto',
  'raffle.auto_closed': 'cerró la rifa (2 días después del sorteo)',
}

function two(n: number) {
  return n.toString().padStart(2, '0')
}

function dmy(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

function money(minor: number, currency: string) {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'CRC' ? 0 : 2,
    minimumFractionDigits: currency === 'CRC' ? 0 : 2,
  }).format(minor / 100)
}

function time(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('es-CR', { timeStyle: 'short', timeZone }).format(new Date(iso))
}

function buyer(item: {
  buyer_name: string | null
  buyer_alias: string | null
  buyer_phone: string | null
}) {
  if (!item.buyer_name) return ''
  const alias = item.buyer_alias ? ` (${item.buyer_alias})` : ''
  const phone = item.buyer_phone ? `, ${item.buyer_phone}` : ''
  return ` — ${item.buyer_name}${alias}${phone}`
}

/** ¿Hay algo que contar? Si no, no se envía correo. */
export function digestHasContent(content: DigestContent): boolean {
  return content.raffles.some(
    (raffle) =>
      raffle.movements.length > 0 || raffle.to_collect.length > 0 || raffle.status === 'closed',
  )
}

export function formatDigest(content: DigestContent): { subject: string; text: string } {
  const lines: string[] = [`Resumen de tus rifas del ${dmy(content.date)}`, '']

  for (const raffle of content.raffles) {
    const totals = raffle.totals
    const paid = totals.paid ?? 0
    const debt = (totals.pending_payment ?? 0) + (totals.overdue ?? 0)
    const sold = paid + debt + (totals.reserved ?? 0)

    lines.push(`== ${raffle.name} ==`)
    lines.push(
      `Vendidos o apartados: ${sold} de 100 · Pagados: ${paid} · Por cobrar: ${debt}` +
        (totals.overdue ? ` (${totals.overdue} vencidos)` : ''),
    )
    lines.push(
      `Recaudado: ${money(paid * raffle.price_minor, raffle.currency)} · ` +
        `Pendiente: ${money(debt * raffle.price_minor, raffle.currency)}`,
    )

    if (raffle.status === 'closed') {
      lines.push(
        `Rifa cerrada. Se borrará por completo el ${dmy(raffle.deleted_on)} con todos sus datos.`,
      )
    }

    if (raffle.movements.length > 0) {
      lines.push('', 'Movimientos:')
      for (const movement of raffle.movements) {
        const phrase = (ACTIONS[movement.action] ?? movement.action).replace(
          '{n}',
          movement.number === null ? '' : two(movement.number),
        )
        const reason = movement.reason ? ` (motivo: ${movement.reason})` : ''
        lines.push(
          `- ${time(movement.at, content.time_zone)} ${movement.actor} ${phrase}${buyer(movement)}${reason}`,
        )
      }
    }

    if (raffle.to_collect.length > 0) {
      const when =
        raffle.deadline_in_days < 0
          ? `la fecha límite (${dmy(raffle.payment_deadline)}) ya pasó`
          : raffle.deadline_in_days === 0
            ? 'la fecha límite es HOY'
            : `vence en ${raffle.deadline_in_days} ${raffle.deadline_in_days === 1 ? 'día' : 'días'} (${dmy(raffle.payment_deadline)})`
      lines.push('', `Por cobrar — ${when}:`)
      for (const item of raffle.to_collect) {
        const status = item.status === 'overdue' ? ' [vencido]' : ''
        lines.push(`- ${two(item.number)} · ${item.collaborator}${buyer(item)}${status}`)
      }
    }

    lines.push('')
  }

  lines.push('Revisa el detalle en Rifas4All. Este correo no contiene enlaces de acceso.')

  return {
    subject: `Rifas4All · Resumen del ${dmy(content.date)}`.replace(/[\r\n]+/g, ' '),
    text: lines.join('\n'),
  }
}
