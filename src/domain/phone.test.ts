import { formatPhone, normalizePhone } from './phone'

describe('normalizePhone', () => {
  it.each(['8888-7777', '8888 7777', '88887777', '+506 8888 7777', '(506) 8888-7777'])(
    'normaliza "%s" a E.164',
    (input) => {
      expect(normalizePhone(input)).toBe('+50688887777')
    },
  )

  it('acepta números de otros países con prefijo', () => {
    expect(normalizePhone('+1 415 555 2671')).toBe('+14155552671')
  })

  it.each(['', '123', '8888-77', 'abc'])('rechaza "%s"', (input) => {
    expect(normalizePhone(input)).toBeNull()
  })
})

describe('formatPhone', () => {
  it('muestra los números de Costa Rica en formato local', () => {
    expect(formatPhone('+50688887777')).toBe('8888 7777')
  })

  it('muestra los extranjeros con su prefijo', () => {
    expect(formatPhone('+14155552671')).toMatch(/^\+1 /)
  })
})
