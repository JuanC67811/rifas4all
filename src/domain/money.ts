/**
 * Dinero. La base de datos guarda los montos en unidades menores (céntimos) como
 * enteros, para evitar los errores de redondeo de los números decimales:
 * ₡2 000 se guarda como 200000.
 */
export const CURRENCIES = ['CRC', 'USD'] as const
export type Currency = (typeof CURRENCIES)[number]

export const CURRENCY_LABELS: Record<Currency, string> = {
  CRC: 'Colones (₡)',
  USD: 'Dólares ($)',
}

// En colones no se usan céntimos en la práctica; en dólares sí.
const DISPLAY_DECIMALS: Record<Currency, number> = { CRC: 0, USD: 2 }

export function isCurrency(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value)
}

/**
 * Convierte lo que escribe la persona ("2000", "2 000", "2.000", "12,50") en
 * unidades menores. Devuelve null si no es un monto válido y positivo.
 *
 * Regla para separadores: si el último separador tiene exactamente 1 o 2 dígitos
 * después, es el separador decimal ("12,5" o "12.50"). Si tiene 3, es de miles ("2.000").
 */
export function parseMoneyInput(input: string): number | null {
  const compact = input.trim().replace(/[\s₡$]/g, '')
  if (!/^\d[\d.,]*$/.test(compact)) return null

  const lastSeparator = Math.max(compact.lastIndexOf('.'), compact.lastIndexOf(','))
  const decimals = lastSeparator === -1 ? '' : compact.slice(lastSeparator + 1)
  const hasDecimals = lastSeparator !== -1 && decimals.length >= 1 && decimals.length <= 2

  // "12.345.6" es ambiguo: el separador decimal no puede repetirse en la parte entera.
  if (hasDecimals && compact.slice(0, lastSeparator).includes(compact.charAt(lastSeparator))) {
    return null
  }

  const integerPart = (hasDecimals ? compact.slice(0, lastSeparator) : compact).replace(/[.,]/g, '')
  const decimalPart = hasDecimals ? decimals.padEnd(2, '0') : '00'
  if (integerPart === '' || /[.,]/.test(decimalPart)) return null

  const minor = Number(integerPart) * 100 + Number(decimalPart)
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null
}

/** 200000 en CRC → "₡2000" con el formato local (es-CR). */
export function formatMoney(minor: number, currency: Currency): string {
  const decimals = DISPLAY_DECIMALS[currency]
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(minor / 100)
}

/** Valor para rellenar un campo de texto al editar: 200000 → "2000". */
export function minorToInput(minor: number): string {
  return minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2)
}
