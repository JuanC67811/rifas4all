import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min'

/**
 * Teléfonos. Se guardan en formato internacional E.164 (+50688887777), que es el
 * que exige la base de datos. La persona puede escribirlos como quiera: "8888-7777",
 * "8888 7777" o "+506 8888 7777". Sin prefijo, se asume Costa Rica.
 */
export const DEFAULT_COUNTRY: CountryCode = 'CR'

/** Devuelve el teléfono en E.164, o null si no es un número válido. */
export function normalizePhone(
  input: string,
  country: CountryCode = DEFAULT_COUNTRY,
): string | null {
  const trimmed = input.trim()
  if (trimmed === '') return null
  const phone = parsePhoneNumberFromString(trimmed, country)
  return phone?.isValid() ? phone.number : null
}

/** +50688887777 → "8888 7777" en Costa Rica; con prefijo internacional en otros países. */
export function formatPhone(e164: string, country: CountryCode = DEFAULT_COUNTRY): string {
  const phone = parsePhoneNumberFromString(e164)
  if (!phone) return e164
  return phone.country === country ? phone.formatNational() : phone.formatInternational()
}
