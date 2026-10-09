import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { browserTimeZone, formatDate } from '@/domain/dates'
import { formatMoney, minorToInput } from '@/domain/money'
import {
  allowedRaffleActions,
  closingDate,
  deletionDate,
  MAX_RAFFLES_PER_ACCOUNT,
  type RaffleFormValues,
} from '@/domain/raffle'
import { RaffleCollaboratorsSection } from '@/features/collaborators/RaffleCollaboratorsSection'
import { toAppError } from '@/lib/errors'
import { Alert } from '@/ui/Alert'
import { Button, ButtonLink } from '@/ui/Button'
import { TextField } from '@/ui/fields'
import { Card, Loading, Page, PageTitle } from '@/ui/layout'
import { useDocumentTitle } from '@/ui/useDocumentTitle'
import type { Raffle } from './api'
import { RaffleForm } from './RaffleForm'
import { RaffleStatusBadge } from './RaffleStatusBadge'
import {
  useCloseRaffle,
  useCreateRaffle,
  useDeleteRaffle,
  useRaffle,
  useRaffles,
  useUpdateRaffle,
} from './hooks'

function errorMessage(error: unknown): string | null {
  return error ? toAppError(error).message : null
}

// -----------------------------------------------------------------------------
// Mis rifas
// -----------------------------------------------------------------------------
export function RafflesPage() {
  useDocumentTitle('Mis rifas')
  const { data: raffles, isPending, error } = useRaffles()

  if (isPending) return <Loading label="Cargando tus rifas…" />

  const count = raffles?.length ?? 0
  const atLimit = count >= MAX_RAFFLES_PER_ACCOUNT

  return (
    <Page>
      <PageTitle
        title="Mis rifas"
        subtitle={`${count} de ${MAX_RAFFLES_PER_ACCOUNT} rifas en tu cuenta`}
      />
      {error && <Alert tone="error">{errorMessage(error)}</Alert>}

      {atLimit ? (
        <Alert tone="info">
          Llegaste al máximo de {MAX_RAFFLES_PER_ACCOUNT} rifas. Elimina una para crear otra; las
          rifas se borran solas 4 días después del sorteo.
        </Alert>
      ) : (
        <ButtonLink to="/rifas/nueva" fullWidth>
          + Nueva rifa
        </ButtonLink>
      )}

      {count === 0 ? (
        <Card>
          <p className="text-muted">
            Todavía no tienes rifas. Crea la primera: solo necesitas un nombre, el precio y las
            fechas.
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {raffles?.map((raffle) => (
            <li key={raffle.id}>
              <RaffleCard raffle={raffle} />
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}

function RaffleCard({ raffle }: { raffle: Raffle }) {
  return (
    <Link
      to={`/rifas/${raffle.id}`}
      className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 transition hover:border-brand focus-visible:outline-3 focus-visible:outline-brand"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold">{raffle.name}</h2>
        <RaffleStatusBadge status={raffle.status} />
      </div>
      <p className="text-muted">
        Sorteo: {formatDate(raffle.drawDate)} · {formatMoney(raffle.priceMinor, raffle.currency)}{' '}
        por número
      </p>
    </Link>
  )
}

// -----------------------------------------------------------------------------
// Nueva rifa
// -----------------------------------------------------------------------------
const EMPTY_FORM: RaffleFormValues = {
  name: '',
  description: '',
  price: '',
  currency: 'CRC',
  drawDate: '',
  paymentDeadline: '',
}

export function NewRafflePage() {
  useDocumentTitle('Nueva rifa')
  const navigate = useNavigate()
  const createRaffle = useCreateRaffle()
  const timeZone = browserTimeZone()

  return (
    <Page>
      <PageTitle
        title="Nueva rifa"
        subtitle="Se guarda como borrador. Los colaboradores y el reparto se agregan después."
      />
      <Card>
        <RaffleForm
          initialValues={EMPTY_FORM}
          timeZone={timeZone}
          submitLabel="Crear rifa"
          submitting={createRaffle.isPending}
          serverError={errorMessage(createRaffle.error)}
          onSubmit={(input) =>
            createRaffle.mutate(
              { input, timeZone },
              { onSuccess: (id) => navigate(`/rifas/${id}`, { replace: true }) },
            )
          }
        />
      </Card>
      <Link to="/rifas" className="text-center text-brand underline-offset-4 hover:underline">
        Cancelar
      </Link>
    </Page>
  )
}

// -----------------------------------------------------------------------------
// Detalle de una rifa
// -----------------------------------------------------------------------------
export function RaffleDetailPage() {
  const { raffleId = '' } = useParams()
  const { data: raffle, isPending, error } = useRaffle(raffleId)
  useDocumentTitle(raffle?.name ?? 'Rifa')

  if (isPending) return <Loading />
  if (error || !raffle) {
    return (
      <Page>
        <Alert tone="error">{errorMessage(error) ?? 'No encontramos esta rifa.'}</Alert>
        <ButtonLink to="/rifas" variant="secondary">
          Volver a mis rifas
        </ButtonLink>
      </Page>
    )
  }

  const actions = allowedRaffleActions(raffle.status)

  return (
    <Page>
      <div className="flex flex-col gap-3">
        <Link to="/rifas" className="text-brand underline-offset-4 hover:underline">
          ← Mis rifas
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{raffle.name}</h1>
          <RaffleStatusBadge status={raffle.status} />
        </div>
        {raffle.description && <p className="text-muted">{raffle.description}</p>}
      </div>

      <Card>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <dt className="text-muted">Precio</dt>
          <dd className="font-medium">
            {formatMoney(raffle.priceMinor, raffle.currency)} por número
          </dd>
          <dt className="text-muted">Sorteo</dt>
          <dd className="font-medium">{formatDate(raffle.drawDate)}</dd>
          <dt className="text-muted">Límite de pago</dt>
          <dd className="font-medium">{formatDate(raffle.paymentDeadline)}</dd>
          <dt className="text-muted">Zona horaria</dt>
          <dd className="font-medium">{raffle.timeZone}</dd>
        </dl>
      </Card>

      <Alert tone="info">
        {raffle.status === 'closed'
          ? `Rifa cerrada: solo se puede consultar. Se borrará por completo el ${formatDate(deletionDate(raffle.drawDate))}.`
          : `Se cerrará el ${formatDate(closingDate(raffle.drawDate))} y se borrará por completo el ${formatDate(deletionDate(raffle.drawDate))}, con todos sus datos.`}
      </Alert>

      <RaffleCollaboratorsSection raffle={raffle} />

      <div className="flex flex-col gap-3">
        {actions.edit && (
          <ButtonLink to={`/rifas/${raffle.id}/editar`} variant="secondary" fullWidth>
            Editar datos
          </ButtonLink>
        )}
        {actions.close && <CloseRaffleSection raffle={raffle} />}
        {actions.delete && <DeleteRaffleSection raffle={raffle} />}
      </div>
    </Page>
  )
}

/** Cerrar es irreversible: se pide confirmación explícita en la misma pantalla. */
function CloseRaffleSection({ raffle }: { raffle: Raffle }) {
  const [confirming, setConfirming] = useState(false)
  const closeRaffle = useCloseRaffle(raffle.id)

  if (!confirming) {
    return (
      <Button variant="secondary" fullWidth onClick={() => setConfirming(true)}>
        Cerrar la rifa ahora
      </Button>
    )
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold">¿Cerrar la rifa ahora?</h2>
      <p>
        Nadie podrá registrar ventas ni pagos. La rifa seguirá visible hasta el{' '}
        {formatDate(deletionDate(raffle.drawDate))}. Esta acción no se puede deshacer.
      </p>
      {closeRaffle.error && <Alert tone="error">{errorMessage(closeRaffle.error)}</Alert>}
      <Button
        variant="danger"
        fullWidth
        loading={closeRaffle.isPending}
        loadingText="Cerrando…"
        onClick={() => closeRaffle.mutate()}
      >
        Sí, cerrar la rifa
      </Button>
      <Button variant="ghost" onClick={() => setConfirming(false)}>
        No, volver
      </Button>
    </Card>
  )
}

/** Eliminar exige escribir el nombre exacto, como en la base de datos. */
function DeleteRaffleSection({ raffle }: { raffle: Raffle }) {
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [typedName, setTypedName] = useState('')
  const deleteRaffle = useDeleteRaffle(raffle.id)

  if (!confirming) {
    return (
      <Button variant="ghost" onClick={() => setConfirming(true)}>
        Eliminar la rifa
      </Button>
    )
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    deleteRaffle.mutate(typedName, { onSuccess: () => navigate('/rifas', { replace: true }) })
  }

  return (
    <Card>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <h2 className="text-lg font-semibold">Eliminar la rifa</h2>
        <p>
          Se borrará todo: colaboradores, números, ventas y el registro de actividad. No se puede
          deshacer.
        </p>
        {deleteRaffle.error && <Alert tone="error">{errorMessage(deleteRaffle.error)}</Alert>}
        <TextField
          label={`Escribe "${raffle.name}" para confirmar`}
          value={typedName}
          autoComplete="off"
          onChange={(e) => setTypedName(e.target.value)}
        />
        <Button
          type="submit"
          variant="danger"
          fullWidth
          disabled={typedName.trim() !== raffle.name}
          loading={deleteRaffle.isPending}
          loadingText="Eliminando…"
        >
          Eliminar definitivamente
        </Button>
        <Button variant="ghost" onClick={() => setConfirming(false)}>
          No, volver
        </Button>
      </form>
    </Card>
  )
}

// -----------------------------------------------------------------------------
// Editar rifa
// -----------------------------------------------------------------------------
export function EditRafflePage() {
  const { raffleId = '' } = useParams()
  const { data: raffle, isPending, error } = useRaffle(raffleId)
  useDocumentTitle('Editar rifa')

  if (isPending) return <Loading />
  if (error || !raffle) {
    return (
      <Page>
        <Alert tone="error">{errorMessage(error) ?? 'No encontramos esta rifa.'}</Alert>
      </Page>
    )
  }
  if (!allowedRaffleActions(raffle.status).edit) {
    return (
      <Page>
        <Alert tone="info">Una rifa cerrada ya no se puede editar.</Alert>
        <ButtonLink to={`/rifas/${raffle.id}`} variant="secondary">
          Volver a la rifa
        </ButtonLink>
      </Page>
    )
  }
  return <EditRaffleForm raffle={raffle} />
}

function EditRaffleForm({ raffle }: { raffle: Raffle }) {
  const navigate = useNavigate()
  const updateRaffle = useUpdateRaffle(raffle)

  return (
    <Page>
      <PageTitle title="Editar rifa" subtitle={raffle.name} />
      <Card>
        <RaffleForm
          initialValues={{
            name: raffle.name,
            description: raffle.description ?? '',
            price: minorToInput(raffle.priceMinor),
            currency: raffle.currency,
            drawDate: raffle.drawDate,
            paymentDeadline: raffle.paymentDeadline,
          }}
          timeZone={raffle.timeZone}
          submitLabel="Guardar cambios"
          currencyLocked={!allowedRaffleActions(raffle.status).changeCurrency}
          unchangedDates={{ drawDate: raffle.drawDate, paymentDeadline: raffle.paymentDeadline }}
          submitting={updateRaffle.isPending}
          serverError={errorMessage(updateRaffle.error)}
          onSubmit={(input) =>
            updateRaffle.mutate(input, {
              onSuccess: () => navigate(`/rifas/${raffle.id}`, { replace: true }),
            })
          }
        />
      </Card>
      <Link
        to={`/rifas/${raffle.id}`}
        className="text-center text-brand underline-offset-4 hover:underline"
      >
        Cancelar
      </Link>
    </Page>
  )
}
