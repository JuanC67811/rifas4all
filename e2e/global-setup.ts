import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'

/**
 * Antes de las pruebas end-to-end: elimina las rifas de prueba que hayan quedado
 * de una ejecución anterior interrumpida, para no chocar con el límite de 5 rifas
 * de la cuenta de demo. Usa la cuenta de demo y las mismas funciones que la app
 * (ninguna clave secreta).
 */
const TEST_PREFIXES = ['Rifa E2E', 'Rifa accesos']

function localEnv(name: string): string | undefined {
  if (process.env[name]) return process.env[name]
  if (!existsSync('.env.local')) return undefined
  const line = readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .find((entry) => entry.startsWith(`${name}=`))
  return line?.slice(name.length + 1).trim()
}

export default async function globalSetup() {
  const url = localEnv('VITE_SUPABASE_URL')
  const key = localEnv('VITE_SUPABASE_PUBLISHABLE_KEY')
  if (!url || !key) throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY')

  const supabase = createClient(url, key, { auth: { persistSession: false } })
  const { error: loginError } = await supabase.auth.signInWithPassword({
    email: 'demo@rifas4all.local',
    password: 'rifas4all-demo',
  })
  if (loginError) {
    throw new Error(
      `No se pudo entrar con la cuenta de demo (${loginError.message}). ¿Corriste npm run db:reset?`,
    )
  }

  const { data: raffles } = await supabase.from('raffles').select('id, name, status')
  for (const raffle of raffles ?? []) {
    if (!TEST_PREFIXES.some((prefix) => raffle.name.startsWith(prefix))) continue
    if (raffle.status === 'active') {
      await supabase.rpc('close_raffle', { p_raffle_id: raffle.id })
    }
    await supabase.rpc('delete_raffle', {
      p_raffle_id: raffle.id,
      p_confirmation_name: raffle.name,
    })
  }

  await supabase.auth.signOut()
}
