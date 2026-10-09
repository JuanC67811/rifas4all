import { z } from 'zod'
import { toAppError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

/**
 * Cuenta del organizador (correo + contraseña con Supabase Auth).
 * Los colaboradores NO usan estas funciones: entran con su enlace (fase 4).
 */
export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Escribe tu correo.')
  .pipe(z.email('Escribe un correo válido, por ejemplo nombre@correo.com.'))

export const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(72, 'La contraseña admite como máximo 72 caracteres.')

function redirectUrl(path: string) {
  return `${window.location.origin}${path}`
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw toAppError(error)
}

/**
 * Crea la cuenta. Si el proyecto exige confirmar el correo (producción), no hay
 * sesión todavía y se pide revisar la bandeja. Por privacidad, la respuesta es la
 * misma exista o no una cuenta con ese correo.
 */
export async function signUp(
  email: string,
  password: string,
): Promise<{ needsConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirectUrl('/rifas') },
  })
  if (error) throw toAppError(error)
  return { needsConfirmation: data.session === null }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw toAppError(error)
}

/** Envía el enlace de recuperación. Nunca revela si el correo tiene cuenta. */
export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl('/restablecer'),
  })
  if (error) {
    const appError = toAppError(error)
    // Solo se informa el límite de envíos; cualquier otro detalle se oculta.
    if (appError.code === 'AUTH_RATE_LIMIT' || appError.code === 'NETWORK') throw appError
  }
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw toAppError(error)
}
