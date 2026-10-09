import { Navigate, Outlet, useLocation } from 'react-router'
import { Loading } from '@/ui/layout'
import { useAuth } from './auth-context'

/**
 * Rutas del organizador. Sin sesión, redirige a "Entrar" recordando adónde iba.
 * Es solo comodidad de navegación: la protección real de los datos está en RLS.
 */
export function RequireAuth() {
  const { loading, session } = useAuth()
  const location = useLocation()

  if (loading) return <Loading />
  if (!session) {
    return <Navigate to="/entrar" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

/** Rutas de invitado (entrar, registrarse): con sesión, van directo a "Mis rifas". */
export function GuestOnly() {
  const { loading, session } = useAuth()

  if (loading) return <Loading />
  if (session) return <Navigate to="/rifas" replace />
  return <Outlet />
}
