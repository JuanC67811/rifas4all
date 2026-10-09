import {
  countByStatus,
  isDestructive,
  matchesFilter,
  saleActionLabel,
  saleActions,
  validateBuyer,
  type BoardCell,
} from './sale'

describe('máquina de estados (espejo de la base de datos)', () => {
  it('ofrece las transiciones válidas de cada estado', () => {
    expect(saleActions('available')).toEqual([])
    expect(saleActions('reserved')).toEqual(['commit', 'confirm_payment', 'cancel'])
    expect(saleActions('pending_payment')).toEqual(['confirm_payment', 'cancel'])
    expect(saleActions('overdue')).toEqual(['confirm_payment', 'cancel'])
    // Una venta pagada no se cancela directamente: primero se revierte el pago.
    expect(saleActions('paid')).toEqual(['revert_payment'])
  })

  it('nombra la acción según el estado', () => {
    expect(saleActionLabel('cancel', 'reserved')).toBe('Cancelar la reserva')
    expect(saleActionLabel('cancel', 'overdue')).toBe('Liberar el número')
    expect(saleActionLabel('confirm_payment', 'overdue')).toBe('Registrar pago tardío')
  })

  it('pide confirmación para cancelar o revertir', () => {
    expect(isDestructive('cancel')).toBe(true)
    expect(isDestructive('revert_payment')).toBe(true)
    expect(isDestructive('confirm_payment')).toBe(false)
  })
})

describe('filtros del tablero', () => {
  const cells: BoardCell[] = [
    { number: 0, status: 'available', collaboratorId: 'carlos', version: 1 },
    { number: 1, status: 'paid', collaboratorId: 'carlos', version: 3 },
    { number: 2, status: 'paid', collaboratorId: 'maria', version: 3 },
  ]

  it('filtra por dueño y por estado', () => {
    expect(cells.filter((c) => matchesFilter(c, 'mine', 'carlos')).map((c) => c.number)).toEqual([
      0, 1,
    ])
    expect(cells.filter((c) => matchesFilter(c, 'paid')).map((c) => c.number)).toEqual([1, 2])
    expect(cells.filter((c) => matchesFilter(c, 'all'))).toHaveLength(3)
  })

  it('cuenta los números por estado', () => {
    expect(countByStatus(cells)).toEqual({
      available: 1,
      reserved: 0,
      pending_payment: 0,
      paid: 2,
      overdue: 0,
    })
  })
})

describe('validateBuyer', () => {
  it('normaliza el teléfono y vacía los opcionales', () => {
    expect(
      validateBuyer({ buyerName: ' Ana ', buyerPhone: '7000-1111', buyerAlias: '', note: ' ' }),
    ).toEqual({
      ok: true,
      data: { buyerName: 'Ana', buyerPhone: '+50670001111', buyerAlias: null, note: null },
    })
  })

  it('exige nombre y teléfono válidos', () => {
    expect(validateBuyer({ buyerName: '', buyerPhone: '123', buyerAlias: '', note: '' })).toEqual({
      ok: false,
      errors: {
        buyerName: 'Escribe el nombre del comprador.',
        buyerPhone: 'Teléfono no válido. Ejemplo: 8888 7777.',
      },
    })
  })
})
