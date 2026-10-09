import { z } from 'zod'
import { normalizePhone } from './phone'

/**
 * Estados de los números y ventas (diseño §21). La base de datos aplica la máquina
 * de estados; este archivo es su espejo para decidir qué botones mostrar.
 * Si alguna vez divergieran, la base de datos rechazaría la acción con un mensaje claro.
 */
export type NumberStatus = 'available' | 'reserved' | 'pending_payment' | 'paid' | 'overdue'

export const NUMBER_STATUSES: readonly NumberStatus[] = [
  'available',
  'reserved',
  'pending_payment',
  'paid',
  'overdue',
]

/** Cada estado tiene texto e icono propios: nunca se distingue solo por el color. */
export const NUMBER_STATUS_INFO: Record<
  NumberStatus,
  { label: string; plural: string; icon: string }
> = {
  available: { label: 'Disponible', plural: 'Disponibles', icon: '○' },
  reserved: { label: 'Reservado', plural: 'Reservados', icon: '◔' },
  pending_payment: { label: 'Pendiente de pago', plural: 'Pendientes', icon: '◑' },
  paid: { label: 'Pagado', plural: 'Pagados', icon: '✓' },
  overdue: { label: 'Vencido', plural: 'Vencidos', icon: '!' },
}

/** Estado con el que se registra una venta nueva. */
export type NewSaleStatus = 'reserved' | 'pending_payment' | 'paid'

export type SaleAction = 'commit' | 'confirm_payment' | 'revert_payment' | 'cancel'

const ACTIONS_BY_STATUS: Record<NumberStatus, SaleAction[]> = {
  available: [],
  reserved: ['commit', 'confirm_payment', 'cancel'],
  pending_payment: ['confirm_payment', 'cancel'],
  overdue: ['confirm_payment', 'cancel'],
  paid: ['revert_payment'],
}

export function saleActions(status: NumberStatus): SaleAction[] {
  return ACTIONS_BY_STATUS[status]
}

export function saleActionLabel(action: SaleAction, status: NumberStatus): string {
  switch (action) {
    case 'commit':
      return 'Confirmar compra (pendiente de pago)'
    case 'confirm_payment':
      return status === 'overdue' ? 'Registrar pago tardío' : 'Marcar como pagado'
    case 'revert_payment':
      return 'Revertir el pago'
    case 'cancel':
      return status === 'reserved'
        ? 'Cancelar la reserva'
        : status === 'overdue'
          ? 'Liberar el número'
          : 'Cancelar la venta'
  }
}

/** Acciones que dejan el número libre o deshacen un pago: piden confirmación. */
export function isDestructive(action: SaleAction): boolean {
  return action === 'cancel' || action === 'revert_payment'
}

// -----------------------------------------------------------------------------
// Filtros del tablero
// -----------------------------------------------------------------------------
export type BoardFilter = 'all' | 'mine' | NumberStatus

export type BoardCell = {
  number: number
  status: NumberStatus
  collaboratorId: string
  version: number
}

export function matchesFilter(cell: BoardCell, filter: BoardFilter, myCollaboratorId?: string) {
  if (filter === 'all') return true
  if (filter === 'mine') return cell.collaboratorId === myCollaboratorId
  return cell.status === filter
}

export function countByStatus(cells: readonly BoardCell[]): Record<NumberStatus, number> {
  const counts: Record<NumberStatus, number> = {
    available: 0,
    reserved: 0,
    pending_payment: 0,
    paid: 0,
    overdue: 0,
  }
  for (const cell of cells) counts[cell.status] += 1
  return counts
}

// -----------------------------------------------------------------------------
// Datos del comprador
// -----------------------------------------------------------------------------
export type BuyerFormValues = {
  buyerName: string
  buyerPhone: string
  buyerAlias: string
  note: string
}

export type BuyerInput = {
  buyerName: string
  buyerPhone: string
  buyerAlias: string | null
  note: string | null
}

const buyerSchema = z
  .object({
    buyerName: z
      .string()
      .trim()
      .min(1, 'Escribe el nombre del comprador.')
      .max(60, 'Máximo 60 caracteres.'),
    buyerPhone: z.string().refine((value) => normalizePhone(value) !== null, {
      message: 'Teléfono no válido. Ejemplo: 8888 7777.',
    }),
    buyerAlias: z.string().trim().max(30, 'Máximo 30 caracteres.'),
    note: z.string().trim().max(140, 'Máximo 140 caracteres.'),
  })
  .transform((values): BuyerInput => ({
    buyerName: values.buyerName,
    buyerPhone: normalizePhone(values.buyerPhone) ?? '',
    buyerAlias: values.buyerAlias === '' ? null : values.buyerAlias,
    note: values.note === '' ? null : values.note,
  }))

export function validateBuyer(
  values: BuyerFormValues,
):
  | { ok: true; data: BuyerInput }
  | { ok: false; errors: Partial<Record<keyof BuyerFormValues, string>> } {
  const result = buyerSchema.safeParse(values)
  if (result.success) return { ok: true, data: result.data }

  const errors: Partial<Record<keyof BuyerFormValues, string>> = {}
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof BuyerFormValues | undefined
    if (field && !errors[field]) errors[field] = issue.message
  }
  return { ok: false, errors }
}
