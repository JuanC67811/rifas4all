import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { responsibilityNotice, tokenFromHash } from '@/domain/access'
import { formatDate } from '@/domain/dates'
import { formatMoney } from '@/domain/money'
import { RAFFLE_STATUS_LABELS } from '@/domain/raffle'
import { formatNumberList } from '@/domain/raffle-number'
import { useAuth } from '@/features/auth/auth-context'
import { Board } from '@/features/board/Board'
import { toAppError } from '@/lib/errors'
import { queryKeys } from '@/lib/query'
import { Alert } from '@/ui/Alert'
import { Button } from '@/ui/Button'
import { TextField } from '@/ui/fields'
import { Card, Loading, Page, PageTitle } from '@/ui/layout'
import { useDocumentTitle } from '@/ui/useDocumentTitle'
import { activateAccess, getCollaboratorHome, getInvitationPreview } from './api'
import { forgetLastRaffle, rememberLastRaffle } from './last-raffle'

const timeOnly = new Intl.DateTimeFormat('es-CR', { timeStyle: 'short' })

// -----------------------------------------------------------------------------
// /i#token — activar el acceso
// -----------------------------------------------------------------------------
export function InvitationPage() {
  useDocumentTitle('Tu acceso')
  const navigate = useNavigate()
  const { session: creatorSession, loading: authLoading } = useAuth()

  // El token se lee una sola vez del fragmento y se borra de la barra de direcciones.
  const [token] = useState(() => tokenFromHash(window.location.hash))
  useEffect(() => {
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname)
  }, [])

  const preview = useQuery({
    queryKey: queryKeys.invitation(token ?? ''),
    queryFn: () => getInvitationPreview(token ?? ''),
    enabled: token !== null && !creatorSession,
    retry: false,
    staleTime: Infinity,
  })

  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState<string | undefined>()
  const [showNotMe, setShowNotMe] = useState(false)

  const activation = useMutation({
    mutationFn: () => activateAccess(token ?? '', preview.data?.requiresPin ? pin : null),
    onSuccess: (result) => {
      if (result.ok) {
        rememberLastRaffle(result.raffleId)
        navigate(`/r/${result.raffleId}`, { replace: true })
        return
      }
      setPin('')
      setPinError(
        result.error === 'PIN_INCORRECT'
          ? `PIN incorrecto. Te quedan ${result.attemptsLeft} ${result.attemptsLeft === 1 ? 'intento' : 'intentos'}.`
          : `Demasiados intentos. Vuelve a probar después de las ${timeOnly.format(new Date(result.lockedUntil))} o pide un PIN nuevo al organizador.`,
      )
    },
  })

  if (!token) {
    return (
      <Page>
        <PageTitle title="Enlace incompleto" />
        <Alert tone="error">
          No pudimos leer tu enlace. Vuelve a abrirlo desde el mensaje que te enviaron, sin cambiar
          nada.
        </Alert>
      </Page>
    )
  }
  if (authLoading) return <Loading />
  if (creatorSession) {
    return (
      <Page>
        <PageTitle title="Estás conectado como organizador" />
        <Alert tone="info">
          Este enlace es para un colaborador. Ábrelo en otro navegador o en una ventana de incógnito
          para no cerrar tu sesión.
        </Alert>
      </Page>
    )
  }
  if (preview.isPending) return <Loading label="Revisando tu enlace…" />
  if (preview.error || !preview.data) {
    return (
      <Page>
        <PageTitle title="Enlace no válido" />
        <Alert tone="error">{toAppError(preview.error).message}</Alert>
      </Page>
    )
  }

  const { raffleName, collaboratorName, requiresPin, pinLockedUntil } = preview.data

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (requiresPin && !/^\d{4}$/.test(pin)) {
      setPinError('Escribe los 4 dígitos del PIN.')
      return
    }
    setPinError(undefined)
    activation.mutate()
  }

  return (
    <Page>
      <PageTitle title={`¿Eres ${collaboratorName}?`} subtitle={`Rifa: ${raffleName}`} />
      <Alert tone="info">{responsibilityNotice(collaboratorName)}</Alert>

      <Card>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          {activation.error && <Alert tone="error">{toAppError(activation.error).message}</Alert>}
          {pinLockedUntil && !pinError && (
            <Alert tone="error">
              Acceso bloqueado por intentos fallidos hasta las{' '}
              {timeOnly.format(new Date(pinLockedUntil))}.
            </Alert>
          )}
          {requiresPin && (
            <TextField
              label="PIN de 4 dígitos"
              hint="Te lo enviaron junto con el enlace."
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={4}
              className="tracking-[0.5em]"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              error={pinError}
            />
          )}
          <Button type="submit" fullWidth loading={activation.isPending} loadingText="Entrando…">
            Sí, soy {collaboratorName}
          </Button>
        </form>
        <Button variant="ghost" onClick={() => setShowNotMe((value) => !value)}>
          No soy {collaboratorName}
        </Button>
        {showNotMe && (
          <p className="text-muted">
            Este enlace es personal. Pide al organizador de la rifa tu propio enlace.
          </p>
        )}
      </Card>
    </Page>
  )
}

// -----------------------------------------------------------------------------
// /r/:raffleId — inicio del colaborador
// -----------------------------------------------------------------------------
export function CollaboratorHomePage() {
  const { raffleId = '' } = useParams()
  const home = useQuery({
    queryKey: queryKeys.collaboratorHome(raffleId),
    queryFn: () => getCollaboratorHome(raffleId),
    retry: false,
  })
  useDocumentTitle(home.data?.raffle.name ?? 'Mi lista')

  useEffect(() => {
    if (home.error) forgetLastRaffle()
  }, [home.error])

  if (home.isPending) return <Loading label="Cargando tu lista…" />
  if (home.error || !home.data) {
    return (
      <Page>
        <PageTitle title="Tu acceso no está activo" />
        <Alert tone="error">
          Puede que el organizador lo haya pausado o renovado, o que la rifa ya terminó. Pídele un
          enlace nuevo si lo necesitas.
        </Alert>
      </Page>
    )
  }

  const { raffle, me, myNumbers, collaborators } = home.data

  return (
    <Page>
      <PageTitle
        title={`Hola, ${me.displayName}`}
        subtitle={`${raffle.name} · ${RAFFLE_STATUS_LABELS[raffle.status]}`}
      />
      {raffle.status === 'closed' && (
        <Alert tone="info">La rifa está cerrada: solo puedes consultar.</Alert>
      )}
      <Card>
        <h2 className="text-lg font-semibold">Tus números ({myNumbers.length})</h2>
        <p className="text-xl font-semibold tabular-nums">{formatNumberList(myNumbers)}</p>
      </Card>
      <Card>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <dt className="text-muted">Precio</dt>
          <dd className="font-medium">{formatMoney(raffle.priceMinor, raffle.currency)}</dd>
          <dt className="text-muted">Sorteo</dt>
          <dd className="font-medium">{formatDate(raffle.drawDate)}</dd>
          <dt className="text-muted">Límite de pago</dt>
          <dd className="font-medium">{formatDate(raffle.paymentDeadline)}</dd>
        </dl>
      </Card>
      <Board
        raffleId={raffle.id}
        raffleName={raffle.name}
        priceMinor={raffle.priceMinor}
        currency={raffle.currency}
        paymentDeadline={raffle.paymentDeadline}
        timeZone={raffle.timeZone}
        reminderTemplate={raffle.reminderTemplate}
        acceptsChanges={raffle.status === 'active'}
        myCollaboratorId={me.id}
        collaboratorNames={new Map(collaborators.map((c) => [c.id, c.displayName]))}
      />
    </Page>
  )
}
