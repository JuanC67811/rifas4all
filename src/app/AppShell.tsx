import { useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router'
import { signOut } from '@/features/auth/api'
import { useAuth } from '@/features/auth/auth-context'
import { Brand } from '@/ui/layout'

/** Estructura común: encabezado con la marca y, con sesión, el botón "Salir". */
export function AppShell() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
    } catch {
      // Aunque el servidor falle (por ejemplo, la sesión ya expiró), la sesión local
      // se descarta igual: se lleva a la persona a Entrar en cualquier caso.
    } finally {
      setSigningOut(false)
      navigate('/entrar', { replace: true })
    }
  }

  return (
    <div className="min-h-dvh">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2"
      >
        Saltar al contenido
      </a>
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-4 px-4 py-3">
          <Brand />
          {session && (
            <div className="flex items-center gap-3">
              <span className="hidden max-w-48 truncate text-sm text-muted sm:inline">
                {session.user.email}
              </span>
              <Link
                to="/cuenta"
                className="flex min-h-11 items-center rounded-lg px-3 font-medium text-brand hover:bg-surface-muted"
              >
                Cuenta
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="min-h-11 rounded-lg px-3 font-medium text-brand hover:bg-surface-muted"
              >
                {signingOut ? 'Saliendo…' : 'Salir'}
              </button>
            </div>
          )}
        </div>
      </header>
      <div id="contenido">
        <Outlet />
      </div>
      <footer className="mx-auto w-full max-w-xl px-4 py-8 text-center text-sm text-muted">
        <Link to="/privacidad" className="underline-offset-4 hover:underline">
          Privacidad y condiciones
        </Link>
      </footer>
    </div>
  )
}
