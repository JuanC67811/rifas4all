import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { browserTimeZone } from '@/domain/dates'
import { toAppError } from '@/lib/errors'
import { Alert } from '@/ui/Alert'
import { Button } from '@/ui/Button'
import { SelectField, TextField } from '@/ui/fields'
import { Card, Loading, Page, PageTitle } from '@/ui/layout'
import { useDocumentTitle } from '@/ui/useDocumentTitle'
import { getProfile, updateProfile, type Profile } from './api'

// Zonas frecuentes para el público inicial; se añade la del navegador si no está.
const COMMON_TIME_ZONES = [
  'America/Costa_Rica',
  'America/Panama',
  'America/Managua',
  'America/Tegucigalpa',
  'America/El_Salvador',
  'America/Guatemala',
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Caracas',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/New_York',
  'Europe/Madrid',
]

export function AccountPage() {
  useDocumentTitle('Cuenta')
  const profile = useQuery({ queryKey: ['profile'], queryFn: getProfile })

  if (profile.isPending) return <Loading />
  if (profile.error) {
    return (
      <Page>
        <Alert tone="error">{toAppError(profile.error).message}</Alert>
      </Page>
    )
  }
  return <AccountForm initial={profile.data} />
}

function AccountForm({ initial }: { initial: Profile }) {
  const queryClient = useQueryClient()
  const [values, setValues] = useState(initial)
  const save = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  })
  const zones = Array.from(new Set([values.timeZone, browserTimeZone(), ...COMMON_TIME_ZONES]))

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    save.mutate({ ...values, displayName: values.displayName.trim() })
  }

  return (
    <Page>
      <PageTitle title="Cuenta" subtitle="Tu nombre y el resumen diario por correo." />
      <Card>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div aria-live="polite">
            {save.error && <Alert tone="error">{toAppError(save.error).message}</Alert>}
            {save.isSuccess && <Alert tone="success">Cambios guardados.</Alert>}
          </div>
          <TextField
            label="Tu nombre (opcional)"
            hint='Aparece en el registro de actividad como "Administrador (tu nombre)".'
            maxLength={60}
            value={values.displayName}
            onChange={(e) => setValues({ ...values, displayName: e.target.value })}
          />
          <SelectField
            label="Tu zona horaria"
            hint="El resumen diario llega a la medianoche de esta zona."
            value={values.timeZone}
            onChange={(e) => setValues({ ...values, timeZone: e.target.value })}
          >
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replaceAll('_', ' ')}
              </option>
            ))}
          </SelectField>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-medium">Resumen diario por correo</legend>
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                className="size-5 accent-brand"
                checked={values.digestEnabled}
                onChange={(e) => setValues({ ...values, digestEnabled: e.target.checked })}
              />
              <span>Recibir un resumen de los movimientos del día anterior</span>
            </label>
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                className="size-5 accent-brand"
                checked={values.digestIncludePhone}
                disabled={!values.digestEnabled}
                onChange={(e) => setValues({ ...values, digestIncludePhone: e.target.checked })}
              />
              <span>Incluir los teléfonos de los compradores en el correo</span>
            </label>
          </fieldset>
          <Button type="submit" fullWidth loading={save.isPending}>
            Guardar
          </Button>
        </form>
      </Card>
    </Page>
  )
}
