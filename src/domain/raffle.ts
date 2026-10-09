import { z } from 'zod'
import { addDays, isIsoDate, todayIn, type IsoDate } from './dates'
import { CURRENCIES, parseMoneyInput, type Currency } from './money'

/**
 * Rifa: estados, reglas de su ciclo de vida y validación del formulario.
 * La base de datos aplica las mismas reglas; aquí se validan antes de enviar
 * para dar mensajes claros sin esperar al servidor.
 */
export type RaffleStatus = 'draft' | 'active' | 'closed'

export const RAFFLE_STATUS_LABELS: Record<RaffleStatus, string> = {
  draft: 'Borrador',
  active: 'Activa',
  closed: 'Cerrada',
}

export const MAX_RAFFLES_PER_ACCOUNT = 5

/** La rifa se cierra (solo lectura) al empezar el día sorteo + 2. */
export function closingDate(drawDate: IsoDate): IsoDate {
  return addDays(drawDate, 2)
}

/** …y se borra por completo al empezar el día sorteo + 4. */
export function deletionDate(drawDate: IsoDate): IsoDate {
  return addDays(drawDate, 4)
}

/** Qué acciones ofrece la interfaz según el estado (la base de datos lo vuelve a comprobar). */
export function allowedRaffleActions(status: RaffleStatus) {
  return {
    edit: status !== 'closed',
    close: status === 'active',
    delete: status !== 'active',
    changeCurrency: status === 'draft',
  }
}

// -----------------------------------------------------------------------------
// Formulario
// -----------------------------------------------------------------------------
export type RaffleFormValues = {
  name: string
  description: string
  price: string
  currency: Currency
  drawDate: string
  paymentDeadline: string
}

export type RaffleInput = {
  name: string
  description: string | null
  priceMinor: number
  currency: Currency
  drawDate: IsoDate
  paymentDeadline: IsoDate
}

/**
 * @param unchanged Fechas que ya tenía la rifa al editarla. Si no se modifican, se
 *   aceptan aunque ya hayan pasado (por ejemplo, una fecha límite de pago vencida).
 */
export function raffleFormSchema(
  timeZone: string,
  now: Date = new Date(),
  unchanged: { drawDate?: string; paymentDeadline?: string } = {},
) {
  const today = todayIn(timeZone, now)

  return z
    .object({
      name: z
        .string()
        .trim()
        .min(3, 'El nombre debe tener al menos 3 caracteres.')
        .max(80, 'El nombre admite como máximo 80 caracteres.'),
      description: z.string().trim().max(280, 'La descripción admite como máximo 280 caracteres.'),
      price: z.string().refine((value) => parseMoneyInput(value) !== null, {
        message: 'Escribe un precio mayor que cero, por ejemplo 2000.',
      }),
      currency: z.enum(CURRENCIES, { message: 'Elige una moneda.' }),
      drawDate: z
        .string()
        .refine(isIsoDate, 'Elige la fecha del sorteo.')
        .refine(
          (value) => value >= today || value === unchanged.drawDate,
          'La fecha del sorteo no puede estar en el pasado.',
        ),
      paymentDeadline: z
        .string()
        .refine(isIsoDate, 'Elige la fecha límite de pago.')
        .refine(
          (value) => value >= today || value === unchanged.paymentDeadline,
          'La fecha límite no puede estar en el pasado.',
        ),
    })
    .refine((values) => values.paymentDeadline <= values.drawDate, {
      path: ['paymentDeadline'],
      message: 'La fecha límite de pago no puede ser posterior al sorteo.',
    })
    .transform((values): RaffleInput => ({
      name: values.name,
      description: values.description === '' ? null : values.description,
      priceMinor: parseMoneyInput(values.price) ?? 0,
      currency: values.currency,
      drawDate: values.drawDate,
      paymentDeadline: values.paymentDeadline,
    }))
}

export type FieldErrors<T> = Partial<Record<keyof T, string>>

/** Valida el formulario y devuelve los datos listos o un error por campo. */
export function validateRaffleForm(
  values: RaffleFormValues,
  timeZone: string,
  now: Date = new Date(),
  unchanged: { drawDate?: string; paymentDeadline?: string } = {},
): { ok: true; data: RaffleInput } | { ok: false; errors: FieldErrors<RaffleFormValues> } {
  const result = raffleFormSchema(timeZone, now, unchanged).safeParse(values)
  if (result.success) return { ok: true, data: result.data }

  const errors: FieldErrors<RaffleFormValues> = {}
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof RaffleFormValues | undefined
    if (field && !errors[field]) errors[field] = issue.message
  }
  return { ok: false, errors }
}
