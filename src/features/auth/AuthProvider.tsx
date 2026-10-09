import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { AuthContext, type AuthState } from './auth-context'

function creatorSession(session: Session | null): Session | null {
  return session && !session.user.is_anonymous ? session : null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>({ loading: true, session: null })

  useEffect(() => {
    let active = true

    void supabase.auth.getSession().then(({ data }) => {
      if (active) setState({ loading: false, session: creatorSession(data.session) })
    })

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      // Al cerrar sesión se descarta la caché: el siguiente usuario no debe ver datos ajenos.
      if (event === 'SIGNED_OUT') queryClient.clear()
      setState({ loading: false, session: creatorSession(session) })
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [queryClient])

  return <AuthContext value={state}>{children}</AuthContext>
}
