import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { parseEnv } from './env'

const env = parseEnv(import.meta.env)

/**
 * Cliente único de Supabase. Usa solo la clave PUBLICABLE: lo que cada persona
 * puede leer o escribir lo deciden Row Level Security y las funciones SQL.
 *
 * `flowType: 'pkce'`: los enlaces de recuperación de contraseña llevan un código
 * de un solo uso en la URL, que se canjea por una sesión al volver a la app.
 */
export const supabase = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})
