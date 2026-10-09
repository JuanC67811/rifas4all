import type { Currency } from '@/domain/money'
import type { BoardCell, BuyerInput, NewSaleStatus, NumberStatus, SaleAction } from '@/domain/sale'
import { AppError, unwrap } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

/**
 * Tablero y ventas. Lo usan el organizador y el colaborador: la base de datos (RLS)
 * decide qué ventas ve cada uno. El colaborador solo recibe las de su lista.
 */
export type Sale = {
  id: string
  number: number
  collaboratorId: string
  status: Exclude<NumberStatus, 'available'>
  buyerName: string
  buyerAlias: string | null
  buyerPhone: string
  note: string | null
  priceMinor: number
  currency: Currency
  paidAt: string | null
  paidLate: boolean
  createdAt: string
}

/** Respuesta de las funciones de venta: estado público del número tras la operación. */
export type NumberResult = {
  number: number
  status: NumberStatus
  version: number
  replayed: boolean
}

export async function listBoard(raffleId: string): Promise<BoardCell[]> {
  const rows = unwrap(
    await supabase
      .from('raffle_numbers')
      .select('number, status, collaborator_id, version')
      .eq('raffle_id', raffleId)
      .order('number'),
  )
  return (rows ?? []).map((row) => ({
    number: row.number,
    status: row.status,
    collaboratorId: row.collaborator_id,
    version: row.version,
  }))
}

export async function listActiveSales(raffleId: string): Promise<Sale[]> {
  const rows = unwrap(
    await supabase
      .from('sales')
      .select(
        'id, number, collaborator_id, status, buyer_name, buyer_alias, buyer_phone_e164, note, price_minor, currency, paid_at, paid_late, created_at',
      )
      .eq('raffle_id', raffleId)
      .neq('status', 'cancelled'),
  )
  return (rows ?? []).map((row) => ({
    id: row.id,
    number: row.number,
    collaboratorId: row.collaborator_id,
    status: row.status as Sale['status'],
    buyerName: row.buyer_name,
    buyerAlias: row.buyer_alias,
    buyerPhone: row.buyer_phone_e164,
    note: row.note,
    priceMinor: row.price_minor,
    currency: row.currency as Currency,
    paidAt: row.paid_at,
    paidLate: row.paid_late,
    createdAt: row.created_at,
  }))
}

function toNumberResult(value: unknown): NumberResult {
  if (!value) throw new AppError('UNKNOWN')
  return value as NumberResult
}

/** Identificador de la operación (idempotencia): se reutiliza en los reintentos. */
export type Operation = { expectedVersion: number; requestId: string }

export async function registerSale(
  raffleId: string,
  number: number,
  status: NewSaleStatus,
  buyer: BuyerInput,
  operation: Operation,
) {
  return toNumberResult(
    unwrap(
      await supabase.rpc('register_sale', {
        p_raffle_id: raffleId,
        p_number: number,
        p_status: status,
        p_buyer_name: buyer.buyerName,
        p_buyer_phone_e164: buyer.buyerPhone,
        p_buyer_alias: buyer.buyerAlias ?? undefined,
        p_note: buyer.note ?? undefined,
        p_expected_version: operation.expectedVersion,
        p_request_id: operation.requestId,
      }),
    ),
  )
}

export async function changeSaleStatus(
  raffleId: string,
  number: number,
  action: SaleAction,
  operation: Operation,
  reason?: string,
) {
  return toNumberResult(
    unwrap(
      await supabase.rpc('change_sale_status', {
        p_raffle_id: raffleId,
        p_number: number,
        p_action: action,
        p_expected_version: operation.expectedVersion,
        p_request_id: operation.requestId,
        p_reason: reason,
      }),
    ),
  )
}

export async function updateBuyer(
  raffleId: string,
  number: number,
  buyer: BuyerInput,
  operation: Operation,
) {
  return toNumberResult(
    unwrap(
      await supabase.rpc('update_buyer', {
        p_raffle_id: raffleId,
        p_number: number,
        p_buyer_name: buyer.buyerName,
        p_buyer_phone_e164: buyer.buyerPhone,
        p_buyer_alias: buyer.buyerAlias ?? undefined,
        p_note: buyer.note ?? undefined,
        p_expected_version: operation.expectedVersion,
        p_request_id: operation.requestId,
      }),
    ),
  )
}
