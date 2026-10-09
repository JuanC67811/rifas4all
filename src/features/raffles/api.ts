import type { Currency } from '@/domain/money'
import type { RaffleInput, RaffleStatus } from '@/domain/raffle'
import { AppError, unwrap } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

/**
 * Acceso a datos de rifas. Las lecturas van a la tabla (filtrada por RLS: cada
 * organizador solo ve las suyas); las escrituras, a las funciones SQL.
 */
export type Raffle = {
  id: string
  name: string
  description: string | null
  status: RaffleStatus
  priceMinor: number
  currency: Currency
  drawDate: string
  paymentDeadline: string
  timeZone: string
  distributionMethod: DistributionMethod | null
  createdAt: string
}

export type DistributionMethod = 'ordered' | 'random'

const COLUMNS =
  'id, name, description, status, price_minor, currency, draw_date, payment_deadline, time_zone, distribution_method, created_at'

type RaffleRow = {
  id: string
  name: string
  description: string | null
  status: RaffleStatus
  price_minor: number
  currency: string
  draw_date: string
  payment_deadline: string
  time_zone: string
  distribution_method: DistributionMethod | null
  created_at: string
}

function toRaffle(row: RaffleRow): Raffle {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    priceMinor: row.price_minor,
    currency: row.currency as Currency,
    drawDate: row.draw_date,
    paymentDeadline: row.payment_deadline,
    timeZone: row.time_zone,
    distributionMethod: row.distribution_method,
    createdAt: row.created_at,
  }
}

export async function listRaffles(): Promise<Raffle[]> {
  const rows = unwrap(
    await supabase.from('raffles').select(COLUMNS).order('created_at', { ascending: false }),
  )
  return (rows ?? []).map(toRaffle)
}

export async function getRaffle(id: string): Promise<Raffle> {
  const row = unwrap(await supabase.from('raffles').select(COLUMNS).eq('id', id).maybeSingle())
  if (!row) throw new AppError('R4A_NOT_FOUND')
  return toRaffle(row)
}

export async function createRaffle(input: RaffleInput, timeZone: string): Promise<string> {
  const id = unwrap(
    await supabase.rpc('create_raffle', {
      p_name: input.name,
      p_description: input.description ?? undefined,
      p_price_minor: input.priceMinor,
      p_currency: input.currency,
      p_draw_date: input.drawDate,
      p_payment_deadline: input.paymentDeadline,
      p_time_zone: timeZone,
    }),
  )
  if (!id) throw new AppError('UNKNOWN')
  return id
}

/** Envía solo los campos que cambiaron respecto a la rifa original. */
export function raffleChanges(original: Raffle, input: RaffleInput): Record<string, unknown> {
  const changes: Record<string, unknown> = {}
  if (input.name !== original.name) changes.name = input.name
  if (input.description !== original.description) changes.description = input.description ?? ''
  if (input.priceMinor !== original.priceMinor) changes.price_minor = input.priceMinor
  if (input.currency !== original.currency) changes.currency = input.currency
  if (input.drawDate !== original.drawDate) changes.draw_date = input.drawDate
  if (input.paymentDeadline !== original.paymentDeadline) {
    changes.payment_deadline = input.paymentDeadline
  }
  return changes
}

export async function updateRaffle(id: string, changes: Record<string, unknown>) {
  unwrap(await supabase.rpc('update_raffle', { p_raffle_id: id, p_changes: changes as never }))
}

export async function closeRaffle(id: string) {
  unwrap(await supabase.rpc('close_raffle', { p_raffle_id: id }))
}

export async function deleteRaffle(id: string, confirmationName: string) {
  unwrap(
    await supabase.rpc('delete_raffle', {
      p_raffle_id: id,
      p_confirmation_name: confirmationName,
    }),
  )
}
