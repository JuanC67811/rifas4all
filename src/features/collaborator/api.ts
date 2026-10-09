import type { Currency } from '@/domain/money'
import type { RaffleStatus } from '@/domain/raffle'
import { AppError, toAppError, unwrap } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

/**
 * Lado del COLABORADOR: no tiene cuenta. Su navegador obtiene un usuario anónimo de
 * Supabase que la base de datos liga a su acceso al activar el enlace (+PIN).
 */
export type InvitationPreview = {
  raffleName: string
  collaboratorName: string
  requiresPin: boolean
  pinLockedUntil: string | null
}

export async function getInvitationPreview(token: string): Promise<InvitationPreview> {
  const data = unwrap(await supabase.rpc('get_invitation_preview', { p_token: token })) as {
    raffle_name: string
    collaborator_name: string
    requires_pin: boolean
    pin_locked_until: string | null
  } | null
  if (!data) throw new AppError('R4A_INVALID_LINK')
  return {
    raffleName: data.raffle_name,
    collaboratorName: data.collaborator_name,
    requiresPin: data.requires_pin,
    pinLockedUntil: data.pin_locked_until,
  }
}

/**
 * Sesión del dispositivo. Se crea SOLO cuando la persona confirma "Sí, soy…",
 * así las vistas previas de enlaces o los bots no crean usuarios.
 * Con una sesión de organizador abierta no se continúa: la cerraría.
 */
async function ensureDeviceSession() {
  const { data } = await supabase.auth.getSession()
  if (data.session && !data.session.user.is_anonymous) throw new AppError('R4A_CREATOR_SESSION')
  if (data.session) return

  const { error } = await supabase.auth.signInAnonymously()
  if (error) throw toAppError(error)
}

export type ActivationResult =
  | { ok: true; raffleId: string }
  | { ok: false; error: 'PIN_INCORRECT'; attemptsLeft: number }
  | { ok: false; error: 'PIN_LOCKED'; lockedUntil: string }

export async function activateAccess(token: string, pin: string | null): Promise<ActivationResult> {
  await ensureDeviceSession()

  const data = unwrap(
    await supabase.rpc('activate_access', { p_token: token, p_pin: pin ?? undefined }),
  ) as {
    ok: boolean
    raffle_id?: string
    error?: 'PIN_INCORRECT' | 'PIN_LOCKED'
    attempts_left?: number
    locked_until?: string
  } | null

  if (data?.ok && data.raffle_id) return { ok: true, raffleId: data.raffle_id }
  if (data?.error === 'PIN_INCORRECT') {
    return { ok: false, error: 'PIN_INCORRECT', attemptsLeft: data.attempts_left ?? 0 }
  }
  if (data?.error === 'PIN_LOCKED' && data.locked_until) {
    return { ok: false, error: 'PIN_LOCKED', lockedUntil: data.locked_until }
  }
  throw new AppError('UNKNOWN')
}

export type CollaboratorHome = {
  raffle: {
    id: string
    name: string
    description: string | null
    status: RaffleStatus
    drawDate: string
    paymentDeadline: string
    timeZone: string
    priceMinor: number
    currency: Currency
  }
  me: { id: string; displayName: string; position: number }
  collaborators: { id: string; displayName: string }[]
  myNumbers: number[]
}

type HomeResponse = {
  raffle: {
    id: string
    name: string
    description: string | null
    status: RaffleStatus
    draw_date: string
    payment_deadline: string
    time_zone: string
    price_minor: number
    currency: Currency
  }
  me: { id: string; display_name: string; position: number }
  collaborators: { id: string; display_name: string }[]
}

export async function getCollaboratorHome(raffleId: string): Promise<CollaboratorHome> {
  const home = unwrap(
    await supabase.rpc('get_collaborator_home', { p_raffle_id: raffleId }),
  ) as HomeResponse | null
  if (!home) throw new AppError('R4A_FORBIDDEN')

  const numbers = unwrap(
    await supabase
      .from('raffle_numbers')
      .select('number')
      .eq('raffle_id', raffleId)
      .eq('collaborator_id', home.me.id)
      .order('number'),
  )

  return {
    raffle: {
      id: home.raffle.id,
      name: home.raffle.name,
      description: home.raffle.description,
      status: home.raffle.status,
      drawDate: home.raffle.draw_date,
      paymentDeadline: home.raffle.payment_deadline,
      timeZone: home.raffle.time_zone,
      priceMinor: home.raffle.price_minor,
      currency: home.raffle.currency,
    },
    me: { id: home.me.id, displayName: home.me.display_name, position: home.me.position },
    collaborators: home.collaborators.map((c) => ({ id: c.id, displayName: c.display_name })),
    myNumbers: (numbers ?? []).map((row) => row.number),
  }
}
