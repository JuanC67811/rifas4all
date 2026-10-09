/**
 * Fechas civiles ("2026-12-20"), como las guarda la base de datos y las devuelve
 * un <input type="date">. Se manejan como texto para no introducir desfases de
 * zona horaria al convertirlas en objetos Date.
 */
export type IsoDate = string

export const DEFAULT_TIME_ZONE = 'America/Costa_Rica'

/** Zona horaria del navegador, o la de Costa Rica si no se puede detectar. */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE
  } catch {
    return DEFAULT_TIME_ZONE
  }
}

/** Fecha de hoy en una zona horaria, en formato ISO (YYYY-MM-DD). */
export function todayIn(timeZone: string, now: Date = new Date()): IsoDate {
  // en-CA formatea las fechas como YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function isIsoDate(value: string): value is IsoDate {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

/** "2026-12-20" → "20/12/2026". */
export function formatDate(value: IsoDate): string {
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

/** Suma días a una fecha civil: ("2026-12-20", 2) → "2026-12-22". */
export function addDays(value: IsoDate, days: number): IsoDate {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Días completos de `from` a `to` (puede ser negativo). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)
  return Math.round(ms / 86_400_000)
}
