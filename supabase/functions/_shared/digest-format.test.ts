import {
  digestHasContent,
  formatDigest,
  type DigestContent,
  type DigestRaffle,
} from './digest-format'

const raffle: DigestRaffle = {
  name: 'Canasta Navideña',
  status: 'active',
  currency: 'CRC',
  price_minor: 200000,
  draw_date: '2026-12-20',
  payment_deadline: '2026-12-18',
  deadline_in_days: 3,
  closes_on: '2026-12-22',
  deleted_on: '2026-12-24',
  totals: { available: 90, reserved: 2, pending_payment: 3, paid: 4, overdue: 1 },
  movements: [
    {
      at: '2026-12-14T15:30:00Z',
      action: 'sale.sold',
      actor: 'Carlos',
      collaborator: 'Carlos',
      number: 7,
      to_status: 'pending_payment',
      reason: null,
      buyer_name: 'Ana Mora',
      buyer_alias: 'Anita',
      buyer_phone: '+50670001111',
    },
    {
      at: '2026-12-14T18:00:00Z',
      action: 'sale.payment_reverted',
      actor: 'Administrador (Juan)',
      collaborator: 'María',
      number: 60,
      to_status: 'pending_payment',
      reason: 'error al marcar',
      buyer_name: 'Beto',
      buyer_alias: null,
      buyer_phone: null,
    },
  ],
  to_collect: [
    {
      number: 7,
      status: 'pending_payment',
      collaborator: 'Carlos',
      buyer_name: 'Ana Mora',
      buyer_alias: 'Anita',
      buyer_phone: '+50670001111',
    },
  ],
}

const content: DigestContent = {
  date: '2026-12-14',
  time_zone: 'America/Costa_Rica',
  raffles: [raffle],
}

describe('formatDigest', () => {
  const { subject, text } = formatDigest(content)

  it('pone la fecha en el asunto', () => {
    expect(subject).toBe('Rifas4All · Resumen del 14/12/2026')
  })

  it('resume totales y montos de cada rifa', () => {
    expect(text).toContain('== Canasta Navideña ==')
    expect(text).toContain(
      'Vendidos o apartados: 10 de 100 · Pagados: 4 · Por cobrar: 4 (1 vencidos)',
    )
    expect(text).toMatch(/Recaudado: ₡\s?8\s?000 · Pendiente: ₡\s?8\s?000/)
  })

  it('lista los movimientos con hora local, comprador y motivo', () => {
    // 15:30 UTC = 9:30 en Costa Rica.
    expect(text).toMatch(/- 9:30.* Carlos vendió el número 07 — Ana Mora \(Anita\), \+50670001111/)
    expect(text).toContain('REVIRTIÓ el pago del número 60 — Beto (motivo: error al marcar)')
  })

  it('avisa de los cobros por vencer', () => {
    expect(text).toContain('Por cobrar — vence en 3 días (18/12/2026):')
    expect(text).toContain('- 07 · Carlos — Ana Mora (Anita), +50670001111')
  })

  it('nunca incluye enlaces de acceso', () => {
    expect(text).not.toMatch(/\/i#/)
  })
})

describe('digestHasContent', () => {
  it('no envía correo si no hubo movimientos ni cobros pendientes', () => {
    const quiet = { ...content, raffles: [{ ...raffle, movements: [], to_collect: [] }] }
    expect(digestHasContent(quiet)).toBe(false)
    expect(digestHasContent(content)).toBe(true)
  })

  it('siempre avisa de una rifa cerrada (se borrará pronto)', () => {
    const closed = {
      ...content,
      raffles: [{ ...raffle, status: 'closed' as const, movements: [], to_collect: [] }],
    }
    expect(digestHasContent(closed)).toBe(true)
    expect(formatDigest(closed).text).toContain('Se borrará por completo el 24/12/2026')
  })
})
