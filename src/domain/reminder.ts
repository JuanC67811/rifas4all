import { daysBetween, formatDate, type IsoDate } from './dates'

/**
 * Recordatorio de pago para el comprador (diseño §18). La app solo arma el texto:
 * la persona lo copia y lo envía por donde quiera. Nada se envía automáticamente.
 */
export const DEFAULT_REMINDER_TEMPLATE =
  'Hola, {nombre}. Te recordamos que está pendiente el pago del número {numero} de la rifa {rifa}. ' +
  'La fecha límite es el {fecha}. Monto: {monto}. Muchas gracias.'

export const REMINDER_VARIABLES = ['{nombre}', '{numero}', '{rifa}', '{fecha}', '{monto}'] as const

export type ReminderValues = {
  /** Alias si existe; si no, el nombre del comprador. */
  buyerName: string
  number: string
  raffleName: string
  deadline: IsoDate
  amount: string
}

export function renderReminder(template: string | null, values: ReminderValues): string {
  return (template?.trim() || DEFAULT_REMINDER_TEMPLATE)
    .replaceAll('{nombre}', values.buyerName)
    .replaceAll('{numero}', values.number)
    .replaceAll('{rifa}', values.raffleName)
    .replaceAll('{fecha}', formatDate(values.deadline))
    .replaceAll('{monto}', values.amount)
}

/** Cuánto falta para la fecha límite, en palabras, y si conviene destacarlo. */
export function deadlineStatus(
  deadline: IsoDate,
  today: IsoDate,
): { text: string; urgent: boolean } {
  const days = daysBetween(today, deadline)
  if (days < 0) return { text: `Venció el ${formatDate(deadline)}`, urgent: true }
  if (days === 0) return { text: 'Vence hoy', urgent: true }
  if (days === 1) return { text: 'Vence mañana', urgent: true }
  return { text: `Vence en ${days} días (${formatDate(deadline)})`, urgent: days <= 3 }
}
