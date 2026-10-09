import { AppError, unwrap } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { DistributionMethod } from '@/features/raffles/api'

/**
 * Colaboradores, reparto y accesos, vistos por el ORGANIZADOR.
 * Lecturas filtradas por RLS; escrituras mediante funciones SQL.
 */
export type Collaborator = {
  id: string
  position: number
  displayName: string
  phone: string | null
  pinEnabled: boolean
  isPaused: boolean
  firstActivatedAt: string | null
  lastActivityAt: string | null
  /** Dispositivos con sesión activa (máximo 2). */
  activeDevices: number
}

export type CollaboratorDraft = {
  displayName: string
  phone: string | null
  pinEnabled: boolean
}

export type DistributionEntry = {
  collaboratorId: string
  displayName: string
  position: number
  count: number
  numbers: number[]
}

export type AccessCredentials = {
  raffleName: string
  displayName: string
  token: string
  pin: string | null
}

export async function listCollaborators(raffleId: string): Promise<Collaborator[]> {
  const [collaborators, sessions] = await Promise.all([
    supabase
      .from('collaborators')
      .select(
        'id, position, display_name, phone_e164, pin_enabled, is_paused, first_activated_at, last_activity_at',
      )
      .eq('raffle_id', raffleId)
      .order('position'),
    supabase
      .from('collaborator_sessions')
      .select('collaborator_id')
      .eq('raffle_id', raffleId)
      .is('revoked_at', null),
  ])

  const devices = new Map<string, number>()
  for (const session of unwrap(sessions) ?? []) {
    devices.set(session.collaborator_id, (devices.get(session.collaborator_id) ?? 0) + 1)
  }

  return (unwrap(collaborators) ?? []).map((row) => ({
    id: row.id,
    position: row.position,
    displayName: row.display_name,
    phone: row.phone_e164,
    pinEnabled: row.pin_enabled,
    isPaused: row.is_paused,
    firstActivatedAt: row.first_activated_at,
    lastActivityAt: row.last_activity_at,
    activeDevices: devices.get(row.id) ?? 0,
  }))
}

export async function saveCollaborators(raffleId: string, drafts: CollaboratorDraft[]) {
  unwrap(
    await supabase.rpc('set_collaborators', {
      p_raffle_id: raffleId,
      p_collaborators: drafts.map((draft) => ({
        display_name: draft.displayName,
        phone_e164: draft.phone,
        pin_enabled: draft.pinEnabled,
      })),
    }),
  )
}

type SummaryRow = {
  collaborator_id: string
  display_name: string
  position: number
  count: number
  numbers: number[]
}

function toDistribution(value: unknown): DistributionEntry[] {
  return ((value as SummaryRow[] | null) ?? []).map((row) => ({
    collaboratorId: row.collaborator_id,
    displayName: row.display_name,
    position: row.position,
    count: row.count,
    numbers: row.numbers,
  }))
}

export async function getDistribution(raffleId: string): Promise<DistributionEntry[]> {
  return toDistribution(
    unwrap(await supabase.rpc('get_distribution_summary', { p_raffle_id: raffleId })),
  )
}

export async function previewDistribution(
  raffleId: string,
  method: DistributionMethod,
): Promise<DistributionEntry[]> {
  return toDistribution(
    unwrap(await supabase.rpc('preview_distribution', { p_raffle_id: raffleId, p_method: method })),
  )
}

export async function confirmDistribution(raffleId: string) {
  unwrap(await supabase.rpc('confirm_distribution', { p_raffle_id: raffleId }))
}

export async function getAccessCredentials(collaboratorId: string): Promise<AccessCredentials> {
  const data = unwrap(
    await supabase.rpc('get_access_credentials', { p_collaborator_id: collaboratorId }),
  ) as { raffle_name: string; display_name: string; token: string; pin: string | null } | null
  if (!data) throw new AppError('UNKNOWN')
  return {
    raffleName: data.raffle_name,
    displayName: data.display_name,
    token: data.token,
    pin: data.pin,
  }
}

export async function setCollaboratorPaused(collaboratorId: string, paused: boolean) {
  unwrap(
    await supabase.rpc('set_collaborator_paused', {
      p_collaborator_id: collaboratorId,
      p_paused: paused,
    }),
  )
}

export async function regenerateAccess(collaboratorId: string) {
  unwrap(await supabase.rpc('regenerate_access', { p_collaborator_id: collaboratorId }))
}
