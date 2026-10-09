import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export type AuthState = {
  /** true hasta que se sabe si hay sesión guardada en el navegador. */
  loading: boolean
  /** Sesión de ORGANIZADOR. Una sesión anónima de colaborador no cuenta aquí. */
  session: Session | null
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return context
}
