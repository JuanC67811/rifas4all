import { useState } from 'react'
import { formatNumberList } from '@/domain/raffle-number'
import type { DistributionMethod } from '@/features/raffles/api'
import { toAppError } from '@/lib/errors'
import { Alert } from '@/ui/Alert'
import { Button } from '@/ui/Button'
import { Card } from '@/ui/layout'
import type { DistributionEntry } from './api'
import { useConfirmDistribution, useDistribution, usePreviewDistribution } from './hooks'

const METHODS: { value: DistributionMethod; title: string; description: string }[] = [
  {
    value: 'ordered',
    title: 'En orden',
    description: 'Cada colaborador recibe un bloque seguido. Ej.: 00–33, 34–66, 67–99.',
  },
  {
    value: 'random',
    title: 'Al azar',
    description: 'Los números se mezclan antes de repartirlos. Puedes volver a sortear.',
  },
]

/** Lista de números por colaborador. La usan la vista previa y la rifa activa. */
export function DistributionList({ entries }: { entries: DistributionEntry[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {entries.map((entry) => (
        <li key={entry.collaboratorId} className="rounded-card bg-surface-muted p-3">
          <p className="font-semibold">
            {entry.displayName}
            {entry.isOrganizer && ' (tú)'} · {entry.count} números
          </p>
          <p className="break-words text-muted tabular-nums">{formatNumberList(entry.numbers)}</p>
        </li>
      ))}
    </ul>
  )
}

/** Paso 2 del borrador: elegir método, ver la vista previa y confirmar (activa la rifa). */
export function DistributionPanel({
  raffleId,
  savedMethod,
}: {
  raffleId: string
  savedMethod: DistributionMethod | null
}) {
  const [method, setMethod] = useState<DistributionMethod>(savedMethod ?? 'ordered')
  const [confirming, setConfirming] = useState(false)
  const distribution = useDistribution(raffleId, savedMethod !== null)
  const preview = usePreviewDistribution(raffleId)
  const confirm = useConfirmDistribution(raffleId)

  const entries = distribution.data ?? []
  const hasPreview = savedMethod !== null && entries.length > 0
  const previewIsCurrent = hasPreview && savedMethod === method
  const error = preview.error ?? confirm.error

  return (
    <Card>
      <div>
        <h2 className="text-lg font-semibold">Reparto de los 100 números</h2>
        <p className="text-muted">
          Todos reciben la misma cantidad. Si no se puede dividir exacto, los primeros de la lista
          reciben uno más.
        </p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">¿Cómo repartirlos?</legend>
        {METHODS.map((option) => (
          <div
            key={option.value}
            className="grid grid-cols-[auto_1fr] gap-x-3 rounded-card ring-1 ring-hairline p-3 has-checked:ring-2 has-checked:ring-brand"
          >
            <input
              id={`metodo-${option.value}`}
              type="radio"
              name="distribution-method"
              className="mt-1 size-5 accent-brand"
              value={option.value}
              checked={method === option.value}
              aria-describedby={`metodo-${option.value}-ayuda`}
              onChange={() => {
                setMethod(option.value)
                setConfirming(false)
              }}
            />
            <label htmlFor={`metodo-${option.value}`} className="cursor-pointer font-semibold">
              {option.title}
            </label>
            <p id={`metodo-${option.value}-ayuda`} className="col-start-2 text-sm text-muted">
              {option.description}
            </p>
          </div>
        ))}
      </fieldset>

      {error && <Alert tone="error">{toAppError(error).message}</Alert>}

      <Button
        variant={previewIsCurrent ? 'secondary' : 'primary'}
        fullWidth
        loading={preview.isPending}
        loadingText="Repartiendo…"
        onClick={() => {
          setConfirming(false)
          preview.mutate(method)
        }}
      >
        {previewIsCurrent && method === 'random' ? 'Volver a sortear' : 'Ver el reparto'}
      </Button>

      {previewIsCurrent && (
        <>
          <h3 className="font-semibold">Vista previa</h3>
          <DistributionList entries={entries} />

          {confirming ? (
            <div className="flex flex-col gap-3 rounded-card ring-1 ring-hairline p-3">
              <p>
                Al confirmar, la rifa queda <strong>activa</strong> y se generan los accesos. Ya no
                podrás cambiar los colaboradores ni el reparto.
              </p>
              <Button
                fullWidth
                loading={confirm.isPending}
                loadingText="Activando…"
                onClick={() => confirm.mutate()}
              >
                Sí, confirmar y activar
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                No, volver
              </Button>
            </div>
          ) : (
            <Button fullWidth onClick={() => setConfirming(true)}>
              Confirmar reparto y activar la rifa
            </Button>
          )}
        </>
      )}
    </Card>
  )
}
