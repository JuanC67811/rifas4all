import { z } from 'zod'

/**
 * Variables de entorno públicas del frontend, validadas al arrancar.
 * Si falta una o tiene un formato incorrecto, la app falla de inmediato con un mensaje claro
 * en lugar de romperse más tarde en una llamada a Supabase.
 */
const envSchema = z.object({
  VITE_SUPABASE_URL: z.url({ message: 'VITE_SUPABASE_URL debe ser una URL válida' }),
  VITE_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, 'Falta VITE_SUPABASE_PUBLISHABLE_KEY')
    .refine((key) => !key.startsWith('sb_secret_'), {
      message:
        'VITE_SUPABASE_PUBLISHABLE_KEY contiene una clave SECRETA. Nunca la expongas en el frontend.',
    }),
})

export type Env = {
  supabaseUrl: string
  supabasePublishableKey: string
}

export function parseEnv(source: Record<string, unknown>): Env {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    const details = result.error.issues.map((issue) => `- ${issue.message}`).join('\n')
    throw new Error(`Configuración inválida. Revisa tu archivo .env.local:\n${details}`)
  }
  return {
    supabaseUrl: result.data.VITE_SUPABASE_URL,
    supabasePublishableKey: result.data.VITE_SUPABASE_PUBLISHABLE_KEY,
  }
}
