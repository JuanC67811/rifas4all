import type { DigestContent } from '@/domain/digest'
import { AppError, unwrap } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

export type Profile = {
  displayName: string
  timeZone: string
  digestEnabled: boolean
  digestIncludePhone: boolean
}

export async function getProfile(): Promise<Profile> {
  const row = unwrap(
    await supabase
      .from('profiles')
      .select('display_name, time_zone, digest_enabled, digest_include_phone')
      .maybeSingle(),
  )
  if (!row) throw new AppError('R4A_NOT_FOUND')
  return {
    displayName: row.display_name,
    timeZone: row.time_zone,
    digestEnabled: row.digest_enabled,
    digestIncludePhone: row.digest_include_phone,
  }
}

export async function updateProfile(profile: Profile) {
  unwrap(
    await supabase.rpc('update_profile', {
      p_display_name: profile.displayName,
      p_time_zone: profile.timeZone,
      p_digest_enabled: profile.digestEnabled,
      p_digest_include_phone: profile.digestIncludePhone,
    }),
  )
}

export async function getDailyDigest(date: string): Promise<DigestContent | null> {
  const data = unwrap(await supabase.rpc('get_daily_digest', { p_date: date }))
  return (data as DigestContent | null) ?? null
}
