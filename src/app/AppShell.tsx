import { useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router'
import { signOut } from '@/features/auth/api'
import { useAuth } from '@/features/auth/auth-context'
import { Brand } from '@/ui/layout'
import { ThemeToggle } from '@/ui/ThemeToggle'

const NAV_LINK =
  'flex min-h-11 items-center rounded-full px-4 font-semibold text-text hover:bg-surface-muted ' +
  'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand'

/** Estructura común: encabezado con la marca, el tema y, con sesión, Cuenta y Salir. */
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
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-full focus:bg-cta focus:px-5 focus:py-3 focus:font-semibold focus:text-cta-ink"
      >
        Saltar al contenido
      </a>
      <header className="sticky top-0 z-10 border-b border-hairline bg-page/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-2 px-4 py-3">
          <Brand />
          <nav aria-label="Cuenta" className="flex items-center gap-1">
            {session && (
              <>
                <Link to="/cuenta" className={NAV_LINK}>
                  Cuenta
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className={NAV_LINK}
                >
                  {signingOut ? 'Saliendo…' : 'Salir'}
                </button>
              </>
            )}
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <div id="contenido" className="flex-1">
        <Outlet />
      </div>
      <footer className="border-t border-hairline">
        <div className="mx-auto flex w-full max-w-xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted">
          <span>Rifas4All · rifas de barrio, sin enredos</span>
          <Link
            to="/privacidad"
            className="font-semibold text-text underline decoration-2 underline-offset-4"
          >
            Privacidad y condiciones
          </Link>
        </div>
      </footer>
    </div>
  )
}
