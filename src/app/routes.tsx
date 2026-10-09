import type { RouteObject } from 'react-router'
import { GuestOnly, RequireAuth } from '@/features/auth/RequireAuth'
import {
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
} from '@/features/auth/pages'
import {
  EditRafflePage,
  NewRafflePage,
  RaffleDetailPage,
  RafflesPage,
} from '@/features/raffles/pages'
import { AccountPage } from '@/features/account/AccountPage'
import { CollaboratorHomePage, InvitationPage } from '@/features/collaborator/pages'
import { AppShell } from './AppShell'
import { HomePage, NotFoundPage } from './HomePage'

/**
 * Rutas de la aplicación (en español, como las verá quien use la app).
 * /i y /r/:id son del colaborador: sin cuenta, con la sesión de su dispositivo.
 */
export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      {
        element: <GuestOnly />,
        children: [
          { path: 'entrar', element: <LoginPage /> },
          { path: 'registro', element: <RegisterPage /> },
          { path: 'recuperar', element: <ForgotPasswordPage /> },
        ],
      },
      // Fuera de GuestOnly: al volver del correo de recuperación ya hay sesión.
      { path: 'restablecer', element: <ResetPasswordPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: 'rifas', element: <RafflesPage /> },
          { path: 'rifas/nueva', element: <NewRafflePage /> },
          { path: 'rifas/:raffleId', element: <RaffleDetailPage /> },
          { path: 'rifas/:raffleId/editar', element: <EditRafflePage /> },
          { path: 'cuenta', element: <AccountPage /> },
        ],
      },
      { path: 'i', element: <InvitationPage /> },
      { path: 'r/:raffleId', element: <CollaboratorHomePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
