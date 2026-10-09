import { useRef, useState, type FormEvent } from 'react'
import { formatMoney, type Currency } from '@/domain/money'
import { formatPhone } from '@/domain/phone'
import {
  isDestructive,
  NUMBER_STATUS_INFO,
  saleActionLabel,
  saleActions,
  validateBuyer,
  type BoardCell,
  type BuyerFormValues,
  type BuyerInput,
  type NewSaleStatus,
  type SaleAction,
} from '@/domain/sale'
import { toAppError } from '@/lib/errors'
import { Alert } from '@/ui/Alert'
import { Button } from '@/ui/Button'
import { TextAreaField, TextField } from '@/ui/fields'
import type { Sale } from './api'
import { useSaleMutation } from './useBoard'

type Props = {
  raffleId: string
  cell: BoardCell
  sale: Sale | undefined
  salesLoading: boolean
  /** Puede escribir: es el organizador o el dueño del número, y la rifa está activa. */
  canEdit: boolean
  readOnlyReason: string | null
  ownerName: string | null
  priceMinor: number
  currency: Currency
}

/**
 * Identificador de operación para la idempotencia (diseño §28): se reutiliza si la
 * persona reintenta lo mismo sobre la misma versión (por ejemplo, tras un corte de
 * red). Cualquier cambio de versión o de acción genera uno nuevo.
 */
function useOperation(version: number) {
  const ref = useRef<{ key: string; id: string } | null>(null)
  return (intent: string) => {
    const key = `${intent}@${version}`
    if (ref.current?.key !== key) ref.current = { key, id: crypto.randomUUID() }
    return { expectedVersion: version, requestId: ref.current.id }
  }
}

export function NumberSheet({
  raffleId,
  cell,
  sale,
  salesLoading,
  canEdit,
  readOnlyReason,
  ownerName,
  priceMinor,
  currency,
}: Props) {
  const mutation = useSaleMutation(raffleId)
  const operation = useOperation(cell.version)
  const [mode, setMode] = useState<'view' | 'edit-buyer' | SaleAction>('view')
  const info = NUMBER_STATUS_INFO[cell.status]

  const errorMessage = mutation.error ? toAppError(mutation.error).message : null

  function run(input: Parameters<typeof mutation.mutate>[0]) {
    mutation.mutate(input, { onSuccess: () => setMode('view') })
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 font-medium">
          <span aria-hidden="true">{info.icon}</span>
          {info.label}
        </span>
        {ownerName && <span className="text-muted">Lista de {ownerName}</span>}
      </p>

      {/* Anunciado al lector de pantalla cuando la operación termina o falla. */}
      <div aria-live="polite">
        {errorMessage && <Alert tone="error">{errorMessage}</Alert>}
        {mutation.isSuccess && mode === 'view' && !errorMessage && (
          <Alert tone="success">Guardado.</Alert>
        )}
      </div>

      {!canEdit && (
        <p className="text-muted">
          {readOnlyReason ??
            (cell.status === 'available'
              ? `Este número es de ${ownerName ?? 'otro colaborador'}.`
              : 'Los datos del comprador solo los ve quien vendió el número.')}
        </p>
      )}

      {/* Número libre: registrar comprador ------------------------------------- */}
      {canEdit && cell.status === 'available' && (
        <BuyerForm
          submitting={mutation.isPending}
          submitOptions={[
            { status: 'pending_payment', label: 'Vendido, pendiente de pago', primary: true },
            { status: 'paid', label: 'Vendido y pagado' },
            { status: 'reserved', label: 'Solo reservar (apartado)' },
          ]}
          hint={`Precio: ${formatMoney(priceMinor, currency)}`}
          onSubmit={(buyer, status) =>
            run({
              kind: 'register',
              number: cell.number,
              status,
              buyer,
              operation: operation(`register:${status}`),
            })
          }
        />
      )}

      {/* Número ocupado: datos del comprador y acciones ------------------------ */}
      {canEdit && cell.status !== 'available' && salesLoading && !sale && (
        <p className="text-muted">Cargando los datos del comprador…</p>
      )}

      {canEdit && cell.status !== 'available' && sale && mode === 'view' && (
        <>
          <BuyerDetails sale={sale} />
          <div className="flex flex-col gap-2">
            {saleActions(cell.status).map((action) => (
              <Button
                key={action}
                variant={isDestructive(action) ? 'secondary' : 'primary'}
                fullWidth
                loading={mutation.isPending}
                onClick={() =>
                  isDestructive(action)
                    ? setMode(action)
                    : run({
                        kind: 'action',
                        number: cell.number,
                        action,
                        operation: operation(action),
                      })
                }
              >
                {saleActionLabel(action, cell.status)}
              </Button>
            ))}
            <Button variant="ghost" onClick={() => setMode('edit-buyer')}>
              Corregir datos del comprador
            </Button>
          </div>
        </>
      )}

      {canEdit && sale && (mode === 'cancel' || mode === 'revert_payment') && (
        <ConfirmAction
          action={mode}
          statusLabel={saleActionLabel(mode, cell.status)}
          buyerName={sale.buyerName}
          submitting={mutation.isPending}
          onCancel={() => setMode('view')}
          onConfirm={(reason) =>
            run({
              kind: 'action',
              number: cell.number,
              action: mode,
              operation: operation(mode),
              reason,
            })
          }
        />
      )}

      {canEdit && sale && mode === 'edit-buyer' && (
        <BuyerForm
          initial={{
            buyerName: sale.buyerName,
            buyerPhone: formatPhone(sale.buyerPhone),
            buyerAlias: sale.buyerAlias ?? '',
            note: sale.note ?? '',
          }}
          submitting={mutation.isPending}
          submitOptions={[{ status: null, label: 'Guardar cambios', primary: true }]}
          onCancel={() => setMode('view')}
          onSubmit={(buyer) =>
            run({ kind: 'buyer', number: cell.number, buyer, operation: operation('buyer') })
          }
        />
      )}
    </div>
  )
}

function BuyerDetails({ sale }: { sale: Sale }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl bg-surface-muted p-3">
      <dt className="text-muted">Comprador</dt>
      <dd className="font-semibold">
        {sale.buyerName}
        {sale.buyerAlias && <span className="font-normal text-muted"> ({sale.buyerAlias})</span>}
      </dd>
      <dt className="text-muted">Teléfono</dt>
      <dd>
        <a
          href={`tel:${sale.buyerPhone}`}
          className="text-brand underline-offset-4 hover:underline"
        >
          {formatPhone(sale.buyerPhone)}
        </a>
      </dd>
      {sale.note && (
        <>
          <dt className="text-muted">Nota</dt>
          <dd>{sale.note}</dd>
        </>
      )}
      <dt className="text-muted">Monto</dt>
      <dd>{formatMoney(sale.priceMinor, sale.currency)}</dd>
      {sale.paidLate && (
        <>
          <dt className="text-muted">Pago</dt>
          <dd>Registrado después de la fecha límite</dd>
        </>
      )}
    </dl>
  )
}

function ConfirmAction({
  action,
  statusLabel,
  buyerName,
  submitting,
  onCancel,
  onConfirm,
}: {
  action: 'cancel' | 'revert_payment'
  statusLabel: string
  buyerName: string
  submitting: boolean
  onCancel: () => void
  onConfirm: (reason: string | undefined) => void
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | undefined>()
  const reasonRequired = action === 'revert_payment'

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (reasonRequired && reason.trim() === '') {
      setError('Escribe el motivo. Quedará en el registro de actividad.')
      return
    }
    onConfirm(reason.trim() === '' ? undefined : reason.trim())
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-border p-3"
      onSubmit={handleSubmit}
    >
      <p className="font-semibold">¿{statusLabel}?</p>
      <p className="text-muted">
        {action === 'cancel'
          ? `El número vuelve a estar disponible. La venta a ${buyerName} queda en el historial.`
          : `La venta a ${buyerName} vuelve a quedar pendiente de pago.`}
      </p>
      <TextAreaField
        label={reasonRequired ? 'Motivo' : 'Motivo (opcional)'}
        maxLength={140}
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        error={error}
      />
      <Button type="submit" variant="danger" fullWidth loading={submitting}>
        Sí, {statusLabel.toLowerCase()}
      </Button>
      <Button variant="ghost" onClick={onCancel}>
        No, volver
      </Button>
    </form>
  )
}

const EMPTY_BUYER: BuyerFormValues = { buyerName: '', buyerPhone: '', buyerAlias: '', note: '' }

function BuyerForm<S extends NewSaleStatus | null>({
  initial = EMPTY_BUYER,
  submitOptions,
  submitting,
  hint,
  onSubmit,
  onCancel,
}: {
  initial?: BuyerFormValues
  submitOptions: { status: S; label: string; primary?: boolean }[]
  submitting: boolean
  hint?: string
  onSubmit: (buyer: BuyerInput, status: S) => void
  onCancel?: () => void
}) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<Partial<Record<keyof BuyerFormValues, string>>>({})
  const statusRef = useRef<S | undefined>(submitOptions[0]?.status)

  function update(field: keyof BuyerFormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const result = validateBuyer(values)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    onSubmit(result.data, statusRef.current as S)
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit} noValidate>
      <TextField
        label="Nombre del comprador"
        autoComplete="off"
        maxLength={60}
        value={values.buyerName}
        onChange={(e) => update('buyerName', e.target.value)}
        error={errors.buyerName}
      />
      <TextField
        label="Teléfono"
        type="tel"
        inputMode="tel"
        autoComplete="off"
        value={values.buyerPhone}
        onChange={(e) => update('buyerPhone', e.target.value)}
        error={errors.buyerPhone}
      />
      <TextField
        label="Alias (opcional)"
        autoComplete="off"
        maxLength={30}
        value={values.buyerAlias}
        onChange={(e) => update('buyerAlias', e.target.value)}
        error={errors.buyerAlias}
      />
      <TextAreaField
        label="Nota (opcional)"
        hint="No escribas datos sensibles."
        maxLength={140}
        rows={2}
        value={values.note}
        onChange={(e) => update('note', e.target.value)}
        error={errors.note}
      />
      {hint && <p className="text-muted">{hint}</p>}
      {submitOptions.map((option) => (
        <Button
          key={option.label}
          type="submit"
          variant={option.primary ? 'primary' : 'secondary'}
          fullWidth
          loading={submitting}
          onClick={() => {
            statusRef.current = option.status
          }}
        >
          {option.label}
        </Button>
      ))}
      {onCancel && (
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      )}
    </form>
  )
}
