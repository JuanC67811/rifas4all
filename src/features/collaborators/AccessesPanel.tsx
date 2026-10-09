import { useState } from 'react'
import { accessMessage, accessUrl } from '@/domain/access'
import { formatPhone } from '@/domain/phone'
import { formatNumberList } from '@/domain/raffle-number'
import { toAppError } from '@/lib/errors'
import { Alert } from '@/ui/Alert'
import { Button } from '@/ui/Button'
import { CopyButton } from '@/ui/CopyButton'
import { Card } from '@/ui/layout'
import type { AccessCredentials, Collaborator, DistributionEntry } from './api'
import { useAccessCredentials, useRegenerateAccess, useSetPaused } from './hooks'

const dateTime = new Intl.DateTimeFormat('es-CR', { dateStyle: 'short', timeStyle: 'short' })

function accessStatus(collaborator: Collaborator): { icon: string; text: string } {
  if (collaborator.isPaused) return { icon: '⏸', text: 'Acceso pausado' }
  if (collaborator.activeDevices === 0) {
    return collaborator.firstActivatedAt
      ? { icon: '○', text: 'Sin dispositivos activos' }
      : { icon: '○', text: 'Todavía no abrió su enlace' }
  }
  const devices = collaborator.activeDevices === 1 ? '1 dispositivo' : '2 dispositivos'
  return { icon: '●', text: `Activo en ${devices}` }
}

/**
 * Accesos de una rifa activa: compartir el mensaje (enlace + PIN), pausar o
 * generar un acceso nuevo. Con la rifa cerrada, solo consulta.
 */
export function AccessesPanel({
  raffleId,
  collaborators,
  distribution,
  readOnly,
}: {
  raffleId: string
  collaborators: Collaborator[]
  distribution: DistributionEntry[]
  readOnly: boolean
}) {
  return (
    <Card>
      <div>
        <h2 className="text-lg font-semibold">Colaboradores y accesos</h2>
        {!readOnly && (
          <p className="text-muted">
            Copia el mensaje de cada colaborador y envíaselo por donde prefieras (WhatsApp, SMS…).
            Puedes volver a copiarlo cuando quieras.
          </p>
        )}
      </div>
      <ul className="flex flex-col gap-3">
        {collaborators.map((collaborator) => (
          <li key={collaborator.id}>
            {collaborator.isOrganizer ? (
              <article className="flex flex-col gap-1 rounded-card bg-surface-muted p-3">
                <h3 className="font-semibold">{collaborator.displayName} (tú)</h3>
                <p className="text-sm text-muted">
                  Tu propia lista:{' '}
                  <span className="tabular-nums">
                    {formatNumberList(
                      distribution.find((entry) => entry.collaboratorId === collaborator.id)
                        ?.numbers ?? [],
                    )}
                  </span>
                  . No necesita enlace: entras con tu cuenta.
                </p>
              </article>
            ) : (
              <CollaboratorAccess
                raffleId={raffleId}
                collaborator={collaborator}
                numbers={
                  distribution.find((entry) => entry.collaboratorId === collaborator.id)?.numbers ??
                  []
                }
                readOnly={readOnly}
              />
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}

function CollaboratorAccess({
  raffleId,
  collaborator,
  numbers,
  readOnly,
}: {
  raffleId: string
  collaborator: Collaborator
  numbers: number[]
  readOnly: boolean
}) {
  const [panel, setPanel] = useState<'none' | 'share' | 'regenerate'>('none')
  const credentials = useAccessCredentials()
  const setPaused = useSetPaused(raffleId)
  const regenerate = useRegenerateAccess(raffleId)
  const status = accessStatus(collaborator)
  const error = credentials.error ?? setPaused.error ?? regenerate.error

  function openShare() {
    setPanel('share')
    credentials.mutate(collaborator.id)
  }

  return (
    <article className="flex flex-col gap-3 rounded-card bg-surface-muted p-3">
      <header>
        <h3 className="font-semibold">{collaborator.displayName}</h3>
        <p className="text-sm text-muted">
          {numbers.length} números:{' '}
          <span className="tabular-nums">{formatNumberList(numbers)}</span>
        </p>
        <p className="text-sm">
          <span aria-hidden="true">{status.icon}</span> {status.text}
          {collaborator.pinEnabled && ' · con PIN'}
          {collaborator.phone && ` · ${formatPhone(collaborator.phone)}`}
        </p>
        {collaborator.lastActivityAt && (
          <p className="text-sm text-muted">
            Última actividad: {dateTime.format(new Date(collaborator.lastActivityAt))}
          </p>
        )}
      </header>

      {error && <Alert tone="error">{toAppError(error).message}</Alert>}

      {!readOnly && panel === 'none' && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button onClick={openShare}>Compartir acceso</Button>
          <Button
            variant="secondary"
            loading={setPaused.isPending}
            loadingText={collaborator.isPaused ? 'Reanudando…' : 'Pausando…'}
            onClick={() =>
              setPaused.mutate({ collaboratorId: collaborator.id, paused: !collaborator.isPaused })
            }
          >
            {collaborator.isPaused ? 'Reanudar acceso' : 'Pausar acceso'}
          </Button>
          <Button variant="ghost" className="sm:col-span-2" onClick={() => setPanel('regenerate')}>
            Generar un acceso nuevo
          </Button>
        </div>
      )}

      {panel === 'share' && (
        <SharePanel
          credentials={credentials.data}
          loading={credentials.isPending}
          onClose={() => setPanel('none')}
        />
      )}

      {panel === 'regenerate' && (
        <div className="flex flex-col gap-3 rounded-card ring-1 ring-hairline bg-surface p-3">
          <p>
            Úsalo si {collaborator.displayName} perdió el teléfono o el enlace llegó a otra persona.
            El enlace y el PIN actuales dejarán de funcionar y se cerrará su sesión en todos los
            dispositivos. <strong>Sus números y ventas no cambian.</strong>
          </p>
          <Button
            variant="danger"
            fullWidth
            loading={regenerate.isPending}
            loadingText="Generando…"
            onClick={() => regenerate.mutate(collaborator.id, { onSuccess: openShare })}
          >
            Sí, generar acceso nuevo
          </Button>
          <Button variant="ghost" onClick={() => setPanel('none')}>
            No, volver
          </Button>
        </div>
      )}
    </article>
  )
}

function SharePanel({
  credentials,
  loading,
  onClose,
}: {
  credentials: AccessCredentials | undefined
  loading: boolean
  onClose: () => void
}) {
  if (loading || !credentials) {
    return <p className="text-muted">Preparando el mensaje…</p>
  }

  const url = accessUrl(window.location.origin, credentials.token)
  const message = accessMessage({
    collaboratorName: credentials.displayName,
    raffleName: credentials.raffleName,
    url,
    pin: credentials.pin,
  })

  return (
    <div className="flex flex-col gap-3 rounded-card ring-1 ring-hairline bg-surface p-3">
      <label className="flex flex-col gap-1.5">
        <span className="font-medium">Mensaje para {credentials.displayName}</span>
        <textarea
          readOnly
          rows={8}
          className="w-full rounded-card ring-1 ring-hairline bg-surface-muted p-3 text-base"
          value={message}
          onFocus={(e) => e.currentTarget.select()}
        />
      </label>
      <CopyButton text={message} label="Copiar mensaje" variant="primary" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <CopyButton text={url} label="Copiar solo el enlace" />
        {credentials.pin && <CopyButton text={credentials.pin} label="Copiar solo el PIN" />}
      </div>
      <p className="text-sm text-muted">
        Si compartes el enlace en un grupo, envía el PIN por separado.
      </p>
      <Button variant="ghost" onClick={onClose}>
        Cerrar
      </Button>
    </div>
  )
}
