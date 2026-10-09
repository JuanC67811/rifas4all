import { deadlineStatus, renderReminder } from './reminder'

const values = {
  buyerName: 'María',
  number: '27',
  raffleName: 'Canasta Navideña',
  deadline: '2026-10-18',
  amount: '₡2 000',
}

describe('renderReminder', () => {
  it('usa la plantilla por defecto del diseño', () => {
    expect(renderReminder(null, values)).toBe(
      'Hola, María. Te recordamos que está pendiente el pago del número 27 de la rifa ' +
        'Canasta Navideña. La fecha límite es el 18/10/2026. Monto: ₡2 000. Muchas gracias.',
    )
  })

  it('aplica la plantilla del organizador, incluso con variables repetidas', () => {
    expect(
      renderReminder('¡{nombre}! El {numero} vence el {fecha}. {nombre}, gracias.', values),
    ).toBe('¡María! El 27 vence el 18/10/2026. María, gracias.')
  })

  it('una plantilla vacía vuelve a la de por defecto', () => {
    expect(renderReminder('   ', values)).toContain('Te recordamos')
  })
})

describe('deadlineStatus', () => {
  it.each([
    ['2026-10-18', '2026-10-10', 'Vence en 8 días (18/10/2026)', false],
    ['2026-10-18', '2026-10-15', 'Vence en 3 días (18/10/2026)', true],
    ['2026-10-18', '2026-10-17', 'Vence mañana', true],
    ['2026-10-18', '2026-10-18', 'Vence hoy', true],
    ['2026-10-18', '2026-10-20', 'Venció el 18/10/2026', true],
  ])('límite %s visto el %s: "%s"', (deadline, today, text, urgent) => {
    expect(deadlineStatus(deadline, today)).toEqual({ text, urgent })
  })
})
