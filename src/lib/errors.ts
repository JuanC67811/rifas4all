/**
 * Manejo centralizado de errores (diseño §28).
 *
 * Cualquier error (de la base de datos, de Supabase Auth, de red o inesperado) se
 * convierte en un AppError con un código conocido y un mensaje en español listo
 * para mostrar. Ninguna pantalla interpreta errores por su cuenta.
 */
export type AppErrorCode =
  // Reglas de negocio (funciones SQL, SQLSTATE P0001)
  | 'R4A_CONFLICT'
  | 'R4A_FORBIDDEN'
  | 'R4A_NOT_FOUND'
  | 'R4A_VALIDATION'
  | 'R4A_INVALID_TRANSITION'
  | 'R4A_RAFFLE_STATE'
  | 'R4A_RAFFLE_LIMIT'
  | 'R4A_INVALID_LINK'
  | 'R4A_CREATOR_SESSION'
  | 'R4A_AUTH_REQUIRED'
  // Autenticación
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_EMAIL_TAKEN'
  | 'AUTH_WEAK_PASSWORD'
  | 'AUTH_EMAIL_NOT_CONFIRMED'
  | 'AUTH_RATE_LIMIT'
  | 'AUTH_SESSION_EXPIRED'
  // Generales
  | 'NETWORK'
  | 'UNKNOWN'

const MESSAGES: Record<AppErrorCode, string> = {
  R4A_CONFLICT: 'Este número cambió mientras lo editabas. Revisa su estado actual.',
  R4A_FORBIDDEN: 'No tienes permiso para hacer esto.',
  R4A_NOT_FOUND: 'No encontramos lo que buscas. Puede que se haya eliminado.',
  R4A_VALIDATION: 'Revisa los datos ingresados.',
  R4A_INVALID_TRANSITION: 'Esa acción no es posible en el estado actual.',
  R4A_RAFFLE_STATE: 'La rifa no permite este cambio en su estado actual.',
  R4A_RAFFLE_LIMIT: 'Ya tienes 5 rifas. Elimina una para crear otra.',
  R4A_INVALID_LINK: 'Este enlace no es válido. Pide uno nuevo al organizador.',
  R4A_CREATOR_SESSION:
    'Estás conectado como organizador. Abre este enlace en otro navegador o en modo incógnito.',
  R4A_AUTH_REQUIRED: 'Tu sesión terminó. Vuelve a iniciar sesión.',
  AUTH_INVALID_CREDENTIALS: 'El correo o la contraseña no son correctos.',
  AUTH_EMAIL_TAKEN: 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.',
  AUTH_WEAK_PASSWORD: 'La contraseña es muy débil. Usa al menos 8 caracteres.',
  AUTH_EMAIL_NOT_CONFIRMED: 'Confirma tu correo con el enlace que te enviamos antes de entrar.',
  AUTH_RATE_LIMIT: 'Demasiados intentos seguidos. Espera unos minutos y vuelve a probar.',
  AUTH_SESSION_EXPIRED: 'El enlace expiró o ya se usó. Solicita uno nuevo.',
  NETWORK: 'No hay conexión. Revisa tu internet y vuelve a intentarlo.',
  UNKNOWN: 'Algo salió mal. Vuelve a intentarlo en un momento.',
}

// Códigos de negocio cuyo detalle (escrito en SQL) es más útil que el mensaje genérico.
const USE_SERVER_DETAIL = new Set<AppErrorCode>([
  'R4A_VALIDATION',
  'R4A_RAFFLE_STATE',
  'R4A_INVALID_TRANSITION',
])

export class AppError extends Error {
  readonly code: AppErrorCode

  constructor(code: AppErrorCode, message: string = MESSAGES[code]) {
    super(message)
    this.name = 'AppError'
    this.code = code
  }
}

type ErrorLike = { code?: unknown; message?: unknown; details?: unknown; status?: unknown }

function isErrorLike(value: unknown): value is ErrorLike {
  return typeof value === 'object' && value !== null
}

const AUTH_CODES: Record<string, AppErrorCode> = {
  invalid_credentials: 'AUTH_INVALID_CREDENTIALS',
  user_already_exists: 'AUTH_EMAIL_TAKEN',
  email_exists: 'AUTH_EMAIL_TAKEN',
  weak_password: 'AUTH_WEAK_PASSWORD',
  email_not_confirmed: 'AUTH_EMAIL_NOT_CONFIRMED',
  over_request_rate_limit: 'AUTH_RATE_LIMIT',
  over_email_send_rate_limit: 'AUTH_RATE_LIMIT',
  otp_expired: 'AUTH_SESSION_EXPIRED',
  flow_state_expired: 'AUTH_SESSION_EXPIRED',
  session_not_found: 'AUTH_SESSION_EXPIRED',
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error

  // Sin conexión: fetch lanza TypeError ("Failed to fetch").
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return new AppError('NETWORK')
  }

  if (!isErrorLike(error)) return new AppError('UNKNOWN')

  const code = typeof error.code === 'string' ? error.code : ''
  const message = typeof error.message === 'string' ? error.message : ''
  const details = typeof error.details === 'string' ? error.details.trim() : ''

  // Errores de negocio de PostgreSQL: SQLSTATE P0001 con el código en el mensaje.
  if (code === 'P0001' && message.startsWith('R4A_') && message in MESSAGES) {
    const appCode = message as AppErrorCode
    return new AppError(appCode, USE_SERVER_DETAIL.has(appCode) && details ? details : undefined)
  }
  // Restricciones de la base de datos (CHECK, UNIQUE): datos inválidos.
  if (code === '23514' || code === '23505' || code === '22P02' || code === '22007') {
    return new AppError('R4A_VALIDATION')
  }
  // Sin permiso a nivel de base de datos (falta GRANT o JWT inválido).
  if (code === '42501' || code === 'PGRST301') return new AppError('R4A_AUTH_REQUIRED')

  if (code in AUTH_CODES) return new AppError(AUTH_CODES[code] ?? 'UNKNOWN')

  return new AppError('UNKNOWN')
}

/** Desempaqueta la respuesta de supabase-js: devuelve los datos o lanza un AppError. */
export function unwrap<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw toAppError(result.error)
  return result.data
}
