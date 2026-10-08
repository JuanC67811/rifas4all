/**
 * Números de la rifa. En el MVP toda rifa tiene exactamente 100 números (00–99)
 * y siempre se muestran con dos dígitos: el 0 es "00", el 7 es "07".
 */
export const RAFFLE_SIZE = 100

export function isRaffleNumber(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < RAFFLE_SIZE
}

/** Convierte 7 en "07". Lanza un error si el número no pertenece a la rifa. */
export function formatRaffleNumber(value: number): string {
  if (!isRaffleNumber(value)) {
    throw new RangeError(`Número de rifa fuera de rango: ${value}`)
  }
  return value.toString().padStart(2, '0')
}

/** Los 100 números de la rifa en orden: [0, 1, …, 99]. */
export function allRaffleNumbers(): number[] {
  return Array.from({ length: RAFFLE_SIZE }, (_, index) => index)
}
