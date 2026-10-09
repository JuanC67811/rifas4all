import { formatMoney, minorToInput, parseMoneyInput } from './money'

describe('parseMoneyInput', () => {
  it.each([
    ['2000', 200000],
    ['2 000', 200000],
    ['₡2.000', 200000],
    ['1,000,000', 100000000],
    ['12,50', 1250],
    ['12.5', 1250],
    ['0.99', 99],
  ])('convierte "%s" en %i unidades menores', (input, expected) => {
    expect(parseMoneyInput(input)).toBe(expected)
  })

  it.each(['', 'abc', '0', '-5', '12.345.6', '1e5'])('rechaza "%s"', (input) => {
    expect(parseMoneyInput(input)).toBeNull()
  })
})

describe('formatMoney', () => {
  it('muestra colones sin decimales', () => {
    expect(formatMoney(200000, 'CRC')).toMatch(/₡\s?2\s?000$/)
  })

  it('muestra dólares con dos decimales', () => {
    expect(formatMoney(1250, 'USD')).toContain('12,50')
  })
})

describe('minorToInput', () => {
  it('omite los decimales cuando son cero', () => {
    expect(minorToInput(200000)).toBe('2000')
  })

  it('conserva los céntimos cuando existen', () => {
    expect(minorToInput(1250)).toBe('12.50')
  })
})
