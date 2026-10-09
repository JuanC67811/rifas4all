import { useAuth } from '@/features/auth/auth-context'
import { lastRaffle } from '@/features/collaborator/last-raffle'
import { ButtonLink } from '@/ui/Button'
import { Page } from '@/ui/layout'
import { useDocumentTitle } from '@/ui/useDocumentTitle'

const STEPS = [
  { title: 'Crea tu rifa', text: '100 números, del 00 al 99. Precio, fecha del sorteo y listo.' },
  {
    title: 'Reparte los números',
    text: 'Véndela tú o suma hasta 12 colaboradores: todos reciben la misma cantidad.',
  },
  {
    title: 'Comparte un enlace',
    text: 'Cada colaborador entra con su enlace personal. Nadie más necesita cuenta.',
  },
  {
    title: 'Mira todo en vivo',
    text: 'Ventas, pagos y recordatorios de cobro, al instante en todos los teléfonos.',
  },
]

const GUARANTEES = [
  'Un número nunca se vende dos veces, aunque dos personas toquen a la vez.',
  'Cada colaborador ve solo los compradores de su lista.',
  'Todo queda registrado en un historial que nadie puede alterar.',
  'Cuatro días después del sorteo se borran todos los datos.',
]

// Ilustración del tablero (decorativa): algunos números ya vendidos.
const PREVIEW: { n: string; tone: string }[] = [
  { n: '00', tone: 'bg-surface ring-1 ring-hairline' },
  { n: '01', tone: 'bg-cta text-cta-ink' },
  { n: '02', tone: 'bg-surface ring-1 ring-hairline' },
  { n: '03', tone: 'bg-forest text-forest-ink' },
  { n: '04', tone: 'bg-surface ring-1 ring-hairline' },
  { n: '05', tone: 'bg-forest text-forest-ink' },
  { n: '06', tone: 'bg-surface ring-1 ring-hairline' },
  { n: '07', tone: 'bg-cta text-cta-ink' },
  { n: '08', tone: 'bg-forest text-forest-ink' },
  { n: '09', tone: 'bg-surface ring-1 ring-hairline' },
]

export function HomePage() {
  useDocumentTitle('')
  const { session } = useAuth()
  const collaboratorRaffle = session ? null : lastRaffle()

  return (
    <div className="animate-rise">
      {/* Portada ------------------------------------------------------------- */}
      <Page>
        <section className="flex flex-col gap-6 pt-2">
          <p className="w-fit rounded-full bg-wash px-4 py-1.5 text-sm font-semibold text-forest dark:text-brand">
            Gratis · desde el teléfono
          </p>
          <h1 className="display text-[3.4rem] text-text sm:text-7xl">
            Organiza tu rifa <span className="text-brand">sin enredos</span>
          </h1>
          <p className="text-lg leading-relaxed text-body">
            Para rifas familiares, escolares y de barrio. Reparte los números, comparte un enlace
            con tus colaboradores y sigue cada venta en vivo, sin hojas de cálculo ni mensajes
            perdidos.
          </p>

          {collaboratorRaffle && (
            <ButtonLink to={`/r/${collaboratorRaffle}`} fullWidth>
              Volver a mis números
            </ButtonLink>
          )}

          {session ? (
            <ButtonLink to="/rifas" variant={collaboratorRaffle ? 'secondary' : 'primary'}>
              Ir a mis rifas
            </ButtonLink>
          ) : (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <ButtonLink
                to="/registro"
                variant={collaboratorRaffle ? 'secondary' : 'primary'}
                className="px-8"
              >
                Crear cuenta gratis
              </ButtonLink>
              <ButtonLink to="/entrar" variant="ghost">
                Ya tengo cuenta
              </ButtonLink>
            </div>
          )}

          <div aria-hidden="true" className="grid grid-cols-5 gap-2 pt-2">
            {PREVIEW.map((cell) => (
              <div
                key={cell.n}
                className={`flex aspect-square items-center justify-center rounded-[10px] text-lg font-black tabular-nums ${cell.tone}`}
              >
                {cell.n}
              </div>
            ))}
          </div>
        </section>
      </Page>

      {/* Franja verde clara: cómo funciona ------------------------------------- */}
      <section aria-labelledby="como-funciona" className="bg-wash">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-12">
          <h2 id="como-funciona" className="display text-4xl text-forest dark:text-brand">
            Cómo funciona
          </h2>
          <ol className="flex flex-col gap-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-4 rounded-card bg-surface p-4">
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-forest text-lg font-black text-forest-ink"
                >
                  {index + 1}
                </span>
                <span>
                  <span className="block text-lg font-bold text-text">{step.title}</span>
                  <span className="text-body">{step.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Sección verde bosque: garantías -------------------------------------- */}
      <section aria-labelledby="garantias" className="px-4 py-12">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-5 rounded-panel bg-forest p-7 text-forest-ink">
          <h2 id="garantias" className="display text-4xl text-cta">
            Hecha para confiar
          </h2>
          <ul className="flex flex-col gap-3 text-lg">
            {GUARANTEES.map((item) => (
              <li key={item} className="flex gap-3">
                <span aria-hidden="true" className="font-black text-cta">
                  ✓
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="w-fit rounded-full bg-forest-ink px-4 py-2 font-semibold text-forest">
            100 números · hasta 13 listas · en vivo
          </p>
        </div>
      </section>
    </div>
  )
}

export function NotFoundPage() {
  useDocumentTitle('Página no encontrada')
  return (
    <Page>
      <p className="display text-8xl text-brand" aria-hidden="true">
        404
      </p>
      <h1 className="text-3xl font-extrabold tracking-tight">Página no encontrada</h1>
      <p className="text-body">El enlace no existe o se escribió mal.</p>
      <ButtonLink to="/" variant="secondary">
        Ir al inicio
      </ButtonLink>
    </Page>
  )
}
