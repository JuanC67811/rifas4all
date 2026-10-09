import type { RouteObject } from 'react-router'
import { GuestOnly, RequireAuth } from '@/features/auth/RequireAuth'
import { AppShell } from './AppShell'
import { HomePage, NotFoundPage } from './HomePage'

/**
 * Rutas de la aplicación (en español, como las verá quien use la app).
 * /i y /r/:id son del colaborador: sin cuenta, con la sesión de su dispositivo.
 *
 * Cada pantalla se carga bajo demanda (`lazy`): quien abre su enlace de
 * colaborador en el teléfono no descarga las pantallas del organizador.
 */
const authPages = () => import('@/features/auth/pages')
const rafflePages = () => import('@/features/raffles/pages')
const collaboratorPages = () => import('@/features/collaborator/pages')

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      {
        element: <GuestOnly />,
        children: [
          { path: 'entrar', lazy: async () => ({ Component: (await authPages()).LoginPage }) },
          { path: 'registro', lazy: async () => ({ Component: (await authPages()).RegisterPage }) },
          {
            path: 'recuperar',
            lazy: async () => ({ Component: (await authPages()).ForgotPasswordPage }),
          },
        ],
      },
      // Fuera de GuestOnly: al volver del correo de recuperación ya hay sesión.
      {
        path: 'restablecer',
        lazy: async () => ({ Component: (await authPages()).ResetPasswordPage }),
      },
      {
        element: <RequireAuth />,
        children: [
          { path: 'rifas', lazy: async () => ({ Component: (await rafflePages()).RafflesPage }) },
          {
            path: 'rifas/nueva',
            lazy: async () => ({ Component: (await rafflePages()).NewRafflePage }),
          },
          {
            path: 'rifas/:raffleId',
            lazy: async () => ({ Component: (await rafflePages()).RaffleDetailPage }),
          },
          {
            path: 'rifas/:raffleId/editar',
            lazy: async () => ({ Component: (await rafflePages()).EditRafflePage }),
          },
          {
            path: 'cuenta',
            lazy: async () => ({
              Component: (await import('@/features/account/AccountPage')).AccountPage,
            }),
          },
        ],
      },
      {
        path: 'i',
        lazy: async () => ({ Component: (await collaboratorPages()).InvitationPage }),
      },
      {
        path: 'r/:raffleId',
        lazy: async () => ({ Component: (await collaboratorPages()).CollaboratorHomePage }),
      },
      {
        path: 'privacidad',
        lazy: async () => ({ Component: (await import('./LegalPage')).PrivacyPage }),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
