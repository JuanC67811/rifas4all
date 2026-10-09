import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AppError } from '@/lib/errors'
import { signIn } from './api'
import { AuthContext, type AuthState } from './auth-context'
import { LoginPage } from './pages'
import { RequireAuth } from './RequireAuth'

// Las pruebas de componentes no tocan Supabase: se reemplaza la capa de datos.
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  signIn: vi.fn<typeof import('./api').signIn>(),
}))

function renderAt(path: string, auth: AuthState = { loading: false, session: null }) {
  const router = createMemoryRouter(
    [
      { path: '/entrar', element: <LoginPage /> },
      {
        element: <RequireAuth />,
        children: [{ path: '/rifas', element: <h1>Mis rifas</h1> }],
      },
    ],
    { initialEntries: [path] },
  )
  render(
    <AuthContext value={auth}>
      <RouterProvider router={router} />
    </AuthContext>,
  )
  return router
}

describe('LoginPage', () => {
  // Con llaves: si beforeEach devuelve una función, Vitest la ejecuta como limpieza.
  beforeEach(() => {
    vi.mocked(signIn).mockReset()
  })

  it('valida los campos antes de llamar al servidor', async () => {
    renderAt('/entrar')

    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(screen.getByLabelText('Correo')).toHaveAccessibleDescription('Escribe tu correo.')
    expect(screen.getByLabelText('Contraseña')).toHaveAccessibleDescription(
      'Escribe tu contraseña.',
    )
    expect(signIn).not.toHaveBeenCalled()
  })

  it('muestra un mensaje claro si las credenciales no son correctas', async () => {
    vi.mocked(signIn).mockImplementation(async () => {
      throw new AppError('AUTH_INVALID_CREDENTIALS')
    })
    renderAt('/entrar')

    await userEvent.type(screen.getByLabelText('Correo'), 'demo@rifas4all.local')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'incorrecta')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El correo o la contraseña no son correctos.',
    )
  })

  it('al entrar, lleva a "Mis rifas"', async () => {
    vi.mocked(signIn).mockResolvedValue()
    const router = renderAt('/entrar')

    await userEvent.type(screen.getByLabelText('Correo'), 'demo@rifas4all.local')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'rifas4all-demo')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(signIn).toHaveBeenCalledWith('demo@rifas4all.local', 'rifas4all-demo')
    // Sin sesión real, RequireAuth lo devuelve a /entrar: lo importante es que se intentó ir a /rifas.
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/entrar'))
    expect(router.state.location.state).toEqual({ from: '/rifas' })
  })
})

describe('RequireAuth', () => {
  it('sin sesión, redirige a Entrar recordando adónde iba', async () => {
    const router = renderAt('/rifas')

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(router.state.location.state).toEqual({ from: '/rifas' })
  })

  it('con sesión de organizador, muestra la página', async () => {
    renderAt('/rifas', { loading: false, session: {} as AuthState['session'] })

    expect(await screen.findByRole('heading', { name: 'Mis rifas' })).toBeInTheDocument()
  })
})
