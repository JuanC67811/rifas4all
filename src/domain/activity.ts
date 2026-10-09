import { formatRaffleNumber } from './raffle-number'

/**
 * Registro de actividad en lenguaje natural (diseño §31):
 * "Carlos vendió el número 27", "Administrador (Juan) revirtió el pago del número 12".
 * El log nunca guarda datos del comprador, así que las frases tampoco los muestran.
 */
export type ActivityEvent = {
  id: number
  occurredAt: string
  actorType: 'creator' | 'collaborator' | 'system'
  actorLabel: string
  collaboratorId: string | null
  action: string
  number: number | null
  toStatus: string | null
  details: Record<string, unknown>
  result: 'success' | 'pin_failed'
}

const FIELD_LABELS: Record<string, string> = {
  name: 'nombre',
  description: 'descripción',
  price_minor: 'precio',
  currency: 'moneda',
  draw_date: 'fecha del sorteo',
  payment_deadline: 'fecha límite de pago',
  time_zone: 'zona horaria',
  show_collaborator_names: 'nombres visibles',
  reminder_template: 'mensaje de recordatorio',
  buyer_name: 'nombre',
  buyer_phone: 'teléfono',
  buyer_alias: 'alias',
  buyer_note: 'nota',
}

function fields(details: Record<string, unknown>): string {
  const list = Array.isArray(details.fields) ? (details.fields as string[]) : []
  return list.map((field) => FIELD_LABELS[field] ?? field).join(', ')
}

export function describeEvent(
  event: ActivityEvent,
  collaboratorName: (id: string | null) => string | null,
): string {
  const actor = event.actorLabel
  const who = collaboratorName(event.collaboratorId) ?? 'un colaborador'
  const n = event.number === null ? '' : formatRaffleNumber(event.number)
  const reason =
    typeof event.details.reason === 'string' ? ` · Motivo: ${event.details.reason}` : ''
  const method = event.details.method === 'random' ? 'al azar' : 'en orden'

  switch (event.action) {
    case 'raffle.created':
      return `${actor} creó la rifa`
    case 'raffle.updated':
      return `${actor} editó la rifa (${fields(event.details)})`
    case 'raffle.activated':
      return `${actor} activó la rifa`
    case 'raffle.closed':
      return `${actor} cerró la rifa`
    case 'raffle.auto_closed':
      return 'La rifa se cerró automáticamente (2 días después del sorteo)'
    case 'collaborator.list_saved':
      return `${actor} guardó la lista de colaboradores (${String(event.details.count ?? '')})`
    case 'collaborator.updated':
      return `${actor} actualizó los datos de ${who}`
    case 'distribution.previewed':
      return `${actor} generó una vista previa del reparto ${method}`
    case 'distribution.confirmed':
      return `${actor} confirmó el reparto ${method}`
    case 'access.message_copied':
      return `${actor} copió el mensaje de acceso de ${who}`
    case 'access.activated':
      return `${actor} activó su acceso en un dispositivo`
    case 'access.device_replaced':
      return `Se reemplazó un dispositivo del acceso de ${who}`
    case 'access.pin_failed':
      return `PIN incorrecto en el acceso de ${who}`
    case 'access.pin_locked':
      return `El acceso de ${who} se bloqueó 15 minutos por intentos fallidos`
    case 'access.paused':
      return `${actor} pausó el acceso de ${who}`
    case 'access.resumed':
      return `${actor} reanudó el acceso de ${who}`
    case 'access.regenerated':
      return `${actor} generó un acceso nuevo para ${who}`
    case 'sale.reserved':
      return `${actor} reservó el número ${n}`
    case 'sale.sold':
      return `${actor} vendió el número ${n}${event.toStatus === 'paid' ? ' (pagado)' : ''}`
    case 'sale.committed':
      return `${actor} confirmó la compra del número ${n}`
    case 'sale.payment_confirmed':
      return `${actor} registró el pago del número ${n}${event.details.paid_late ? ' (tardío)' : ''}`
    case 'sale.payment_reverted':
      return `${actor} revirtió el pago del número ${n}${reason}`
    case 'sale.cancelled':
      return `${actor} canceló la venta del número ${n}${reason}`
    case 'sale.released':
      return `${actor} liberó el número ${n}${reason}`
    case 'sale.overdue':
      return `El pago del número ${n} venció`
    case 'sale.reopened':
      return `El cobro del número ${n} volvió a pendiente (nueva fecha límite)`
    case 'sale.buyer_updated':
      return `${actor} corrigió el ${fields(event.details)} del comprador del número ${n}`
    default:
      return `${actor}: ${event.action}`
  }
}
