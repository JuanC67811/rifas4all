import { useRef, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { todayIn } from '@/domain/dates'
import { CURRENCIES, CURRENCY_LABELS } from '@/domain/money'
import {
  validateRaffleForm,
  type FieldErrors,
  type RaffleFormValues,
  type RaffleInput,
} from '@/domain/raffle'
import { Alert } from '@/ui/Alert'
import { Button } from '@/ui/Button'
import { SelectField, TextAreaField, TextField } from '@/ui/fields'

type Props = {
  initialValues: RaffleFormValues
  timeZone: string
  submitLabel: string
  /** Con la rifa activa la moneda ya no se puede cambiar. */
  currencyLocked?: boolean
  /** Al editar: fechas originales que se aceptan aunque ya hayan pasado. */
  unchangedDates?: { drawDate?: string; paymentDeadline?: string }
  submitting: boolean
  serverError: string | null
  onSubmit: (input: RaffleInput) => void
}

/**
 * Formulario de rifa, compartido por "Nueva rifa" y "Editar rifa".
 * Valida en el cliente para dar mensajes inmediatos; la base de datos vuelve
 * a validar todo al guardar.
 */
export function RaffleForm({
  initialValues,
  timeZone,
  submitLabel,
  currencyLocked = false,
  unchangedDates,
  submitting,
  serverError,
  onSubmit,
}: Props) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<FieldErrors<RaffleFormValues>>({})
  const formRef = useRef<HTMLFormElement>(null)
  const today = todayIn(timeZone)

  function update<K extends keyof RaffleFormValues>(field: K, value: RaffleFormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const result = validateRaffleForm(values, timeZone, new Date(), unchangedDates)
    if (!result.ok) {
      // Se pinta el error y el foco va al primer campo inválido (teclado y lector de pantalla).
      flushSync(() => setErrors(result.errors))
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      return
    }
    setErrors({})
    onSubmit(result.data)
  }

  return (
    <form ref={formRef} className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      {serverError && <Alert tone="error">{serverError}</Alert>}

      <TextField
        label="Nombre de la rifa"
        placeholder="Ej.: Canasta Navideña"
        maxLength={80}
        value={values.name}
        onChange={(e) => update('name', e.target.value)}
        error={errors.name}
      />
      <TextAreaField
        label="Descripción (opcional)"
        hint="Qué se rifa o para qué es lo recaudado. Máximo 280 caracteres."
        maxLength={280}
        value={values.description}
        onChange={(e) => update('description', e.target.value)}
        error={errors.description}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Precio por número"
          inputMode="decimal"
          placeholder="2000"
          value={values.price}
          onChange={(e) => update('price', e.target.value)}
          error={errors.price}
        />
        <SelectField
          label="Moneda"
          value={values.currency}
          disabled={currencyLocked}
          hint={currencyLocked ? 'No cambia con la rifa activa.' : undefined}
          onChange={(e) => update('currency', e.target.value as RaffleFormValues['currency'])}
          error={errors.currency}
        >
          {CURRENCIES.map((currency) => (
            <option key={currency} value={currency}>
              {CURRENCY_LABELS[currency]}
            </option>
          ))}
        </SelectField>
      </div>
      <TextField
        label="Fecha del sorteo"
        type="date"
        min={unchangedDates ? undefined : today}
        value={values.drawDate}
        onChange={(e) => update('drawDate', e.target.value)}
        error={errors.drawDate}
        hint="La rifa se cierra 2 días después del sorteo y se borra por completo 2 días más tarde."
      />
      <TextField
        label="Fecha límite de pago"
        type="date"
        min={unchangedDates ? undefined : today}
        max={values.drawDate || undefined}
        value={values.paymentDeadline}
        onChange={(e) => update('paymentDeadline', e.target.value)}
        error={errors.paymentDeadline}
        hint="Hasta cuándo pueden pagar los compradores. No puede ser después del sorteo."
      />
      <p className="text-sm text-muted">Zona horaria: {timeZone}</p>

      <Button type="submit" fullWidth loading={submitting}>
        {submitLabel}
      </Button>
    </form>
  )
}
