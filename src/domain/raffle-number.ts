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

/**
 * Lista compacta para mostrar un reparto: los tramos consecutivos se agrupan.
 * [0, 1, 2, 3, 7, 9, 10, 11] → "00–03, 07, 09–11".
 * Un reparto en orden se ve como un solo tramo ("00–33"); uno aleatorio, como una lista.
 */
export function formatNumberList(numbers: readonly number[]): string {
  const sorted = [...numbers].sort((a, b) => a - b)
  const parts: string[] = []

  let start = sorted[0]
  let previous = start
  for (const current of [...sorted.slice(1), Number.NaN]) {
    if (start === undefined || previous === undefined) break
    if (current === previous + 1) {
      previous = current
      continue
    }
    // Dos números seguidos se escriben separados ("07, 08"); tres o más, como tramo.
    if (previous - start >= 2) {
      parts.push(`${formatRaffleNumber(start)}–${formatRaffleNumber(previous)}`)
    } else {
      for (let n = start; n <= previous; n++) parts.push(formatRaffleNumber(n))
    }
    start = current
    previous = current
  }

  return parts.join(', ')
}
