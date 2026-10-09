import { describeEvent, type ActivityEvent } from './activity'

const base: ActivityEvent = {
  id: 1,
  occurredAt: '2026-12-14T15:00:00Z',
  actorType: 'collaborator',
  actorLabel: 'Carlos',
  collaboratorId: 'c1',
  action: 'sale.sold',
  number: 7,
  toStatus: 'pending_payment',
  details: {},
  result: 'success',
}
const names = (id: string | null) => (id === 'c1' ? 'Carlos' : null)

describe('describeEvent', () => {
  it.each<[Partial<ActivityEvent>, string]>([
    [{}, 'Carlos vendió el número 07'],
    [{ toStatus: 'paid' }, 'Carlos vendió el número 07 (pagado)'],
    [
      {
        actorType: 'creator',
        actorLabel: 'Administrador (Juan)',
        action: 'sale.payment_reverted',
        details: { reason: 'error' },
      },
      'Administrador (Juan) revirtió el pago del número 07 · Motivo: error',
    ],
    [
      { action: 'sale.payment_confirmed', details: { paid_late: true } },
      'Carlos registró el pago del número 07 (tardío)',
    ],
    [
      { actorType: 'system', actorLabel: 'Sistema', action: 'sale.overdue' },
      'El pago del número 07 venció',
    ],
    [
      { action: 'sale.buyer_updated', details: { fields: ['buyer_phone'] } },
      'Carlos corrigió el teléfono del comprador del número 07',
    ],
    [
      { actorType: 'creator', actorLabel: 'Administrador', action: 'access.paused', number: null },
      'Administrador pausó el acceso de Carlos',
    ],
    [
      {
        actorType: 'creator',
        actorLabel: 'Administrador',
        action: 'raffle.updated',
        number: null,
        details: { fields: ['draw_date', 'name'] },
      },
      'Administrador editó la rifa (fecha del sorteo, nombre)',
    ],
  ])('%o → "%s"', (patch, expected) => {
    expect(describeEvent({ ...base, ...patch }, names)).toBe(expected)
  })

  it('no inventa frases para acciones desconocidas', () => {
    expect(describeEvent({ ...base, action: 'algo.nuevo' }, names)).toBe('Carlos: algo.nuevo')
  })
})
