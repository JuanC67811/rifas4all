import {
  allowedRaffleActions,
  closingDate,
  deletionDate,
  validateRaffleForm,
  type RaffleFormValues,
} from './raffle'

const NOW = new Date('2026-10-09T15:00:00Z')
const TZ = 'America/Costa_Rica'

const valid: RaffleFormValues = {
  name: '  Canasta Navideña ',
  description: '',
  price: '2 000',
  currency: 'CRC',
  drawDate: '2026-12-20',
  paymentDeadline: '2026-12-18',
  reminderTemplate: '',
}

describe('validateRaffleForm', () => {
  it('devuelve los datos normalizados cuando todo es válido', () => {
    expect(validateRaffleForm(valid, TZ, NOW)).toEqual({
      ok: true,
      data: {
        name: 'Canasta Navideña',
        description: null,
        priceMinor: 200000,
        currency: 'CRC',
        drawDate: '2026-12-20',
        paymentDeadline: '2026-12-18',
        reminderTemplate: null,
      },
    })
  })

  it('marca cada campo inválido con un mensaje en español', () => {
    const result = validateRaffleForm(
      { ...valid, name: 'R', price: '0', drawDate: '2026-01-01' },
      TZ,
      NOW,
    )

    expect(result).toMatchObject({
      ok: false,
      errors: {
        name: expect.stringMatching(/al menos 3/),
        price: expect.stringMatching(/mayor que cero/),
        drawDate: expect.stringMatching(/pasado/),
      },
    })
  })

  it('rechaza una fecha límite de pago posterior al sorteo', () => {
    const result = validateRaffleForm({ ...valid, paymentDeadline: '2026-12-21' }, TZ, NOW)

    expect(result).toMatchObject({
      ok: false,
      errors: { paymentDeadline: expect.stringMatching(/posterior al sorteo/) },
    })
  })

  it('al editar, acepta fechas pasadas que no se modificaron', () => {
    const past = { ...valid, drawDate: '2026-10-20', paymentDeadline: '2026-10-01' }

    expect(validateRaffleForm(past, TZ, NOW).ok).toBe(false)
    expect(
      validateRaffleForm(past, TZ, NOW, { drawDate: '2026-10-20', paymentDeadline: '2026-10-01' })
        .ok,
    ).toBe(true)
  })

  it('permite el sorteo hoy', () => {
    const result = validateRaffleForm(
      { ...valid, drawDate: '2026-10-09', paymentDeadline: '2026-10-09' },
      TZ,
      NOW,
    )
    expect(result.ok).toBe(true)
  })
})

describe('ciclo de vida', () => {
  it('cierra 2 días después del sorteo y borra 4 días después', () => {
    expect(closingDate('2026-12-20')).toBe('2026-12-22')
    expect(deletionDate('2026-12-20')).toBe('2026-12-24')
  })

  it('ofrece las acciones permitidas en cada estado', () => {
    expect(allowedRaffleActions('draft')).toEqual({
      edit: true,
      close: false,
      delete: true,
      changeCurrency: true,
    })
    expect(allowedRaffleActions('active')).toMatchObject({ edit: true, close: true, delete: false })
    expect(allowedRaffleActions('closed')).toMatchObject({
      edit: false,
      close: false,
      delete: true,
    })
  })
})
