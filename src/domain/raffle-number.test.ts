import { allRaffleNumbers, formatRaffleNumber, isRaffleNumber, RAFFLE_SIZE } from './raffle-number'

describe('formatRaffleNumber', () => {
  it.each([
    [0, '00'],
    [7, '07'],
    [10, '10'],
    [99, '99'],
  ])('muestra %i como "%s"', (value, expected) => {
    expect(formatRaffleNumber(value)).toBe(expected)
  })

  it.each([-1, 100, 3.5, Number.NaN])('rechaza %d', (value) => {
    expect(() => formatRaffleNumber(value)).toThrow(RangeError)
  })
})

describe('isRaffleNumber', () => {
  it('acepta los extremos 0 y 99', () => {
    expect(isRaffleNumber(0)).toBe(true)
    expect(isRaffleNumber(99)).toBe(true)
  })

  it('rechaza valores fuera de 00–99', () => {
    expect(isRaffleNumber(100)).toBe(false)
    expect(isRaffleNumber(-1)).toBe(false)
  })
})

describe('allRaffleNumbers', () => {
  it('devuelve los 100 números en orden y sin repetidos', () => {
    const numbers = allRaffleNumbers()

    expect(numbers).toHaveLength(RAFFLE_SIZE)
    expect(numbers[0]).toBe(0)
    expect(numbers.at(-1)).toBe(99)
    expect(new Set(numbers).size).toBe(RAFFLE_SIZE)
  })
})
