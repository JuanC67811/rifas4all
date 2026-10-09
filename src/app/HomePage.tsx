import { useAuth } from '@/features/auth/auth-context'
import { ButtonLink } from '@/ui/Button'
import { Card, Page } from '@/ui/layout'
import { useDocumentTitle } from '@/ui/useDocumentTitle'

const STEPS = [
  'Crea tu rifa de 100 números (00 a 99).',
  'Agrega hasta 12 colaboradores: el sistema reparte los números.',
  'Comparte a cada uno su enlace. No necesitan crear cuenta.',
  'Sigue las ventas y los pagos en tiempo real.',
]

export function HomePage() {
  useDocumentTitle('')
  const { session } = useAuth()

  return (
    <Page>
      <section className="flex flex-col gap-3 pt-4">
        <h1 className="text-3xl font-bold leading-tight">
          Organiza tu rifa con tus colaboradores, sin hojas de cálculo.
        </h1>
        <p className="text-lg text-muted">
          Para rifas familiares, escolares y de barrio. Gratis y desde el teléfono.
        </p>
      </section>

      {session ? (
        <ButtonLink to="/rifas" fullWidth>
          Ir a mis rifas
        </ButtonLink>
      ) : (
        <div className="flex flex-col gap-3">
          <ButtonLink to="/registro" fullWidth>
            Crear cuenta gratis
          </ButtonLink>
          <ButtonLink to="/entrar" variant="secondary" fullWidth>
            Ya tengo cuenta
          </ButtonLink>
        </div>
      )}

      <Card>
        <h2 className="text-lg font-semibold">Cómo funciona</h2>
        <ol className="flex flex-col gap-2">
          {STEPS.map((step, index) => (
            <li key={step} className="flex gap-3">
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand font-semibold text-brand-contrast"
              >
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </Card>
    </Page>
  )
}

export function NotFoundPage() {
  useDocumentTitle('Página no encontrada')
  return (
    <Page>
      <h1 className="text-2xl font-bold">Página no encontrada</h1>
      <p className="text-muted">El enlace no existe o se escribió mal.</p>
      <ButtonLink to="/" variant="secondary">
        Ir al inicio
      </ButtonLink>
    </Page>
  )
}
