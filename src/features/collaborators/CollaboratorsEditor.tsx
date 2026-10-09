import { useState, type FormEvent } from 'react'
import { toAppError } from '@/lib/errors'
import { Alert } from '@/ui/Alert'
import { Button } from '@/ui/Button'
import { TextField } from '@/ui/fields'
import { Card } from '@/ui/layout'
import type { Collaborator } from './api'
import {
  emptyRow,
  MAX_COLLABORATORS,
  rowsChanged,
  rowsFromCollaborators,
  validateRows,
  type CollaboratorRow,
  type RowErrors,
} from './collaborator-rows'
import { useSaveCollaborators } from './hooks'

type Props = {
  raffleId: string
  saved: Collaborator[]
  /** Avisa si hay cambios sin guardar (el reparto se oculta mientras tanto). */
  onDirtyChange: (dirty: boolean) => void
}

/**
 * Quién vende los números de un borrador: el propio organizador (opcional, activado
 * por defecto) y de 0 a 12 colaboradores con nombre, teléfono opcional y PIN.
 */
export function CollaboratorsEditor({ raffleId, saved, onDirtyChange }: Props) {
  const [rows, setRows] = useState<CollaboratorRow[]>(() => rowsFromCollaborators(saved))
  const [organizerSells, setOrganizerSells] = useState(
    () => saved.length === 0 || saved.some((collaborator) => collaborator.isOrganizer),
  )
  const [errors, setErrors] = useState<Record<string, RowErrors>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const save = useSaveCollaborators(raffleId)

  function change(nextRows: CollaboratorRow[], nextOrganizerSells = organizerSells) {
    setRows(nextRows)
    setOrganizerSells(nextOrganizerSells)
    setFormError(null)
    onDirtyChange(rowsChanged(nextRows, nextOrganizerSells, saved))
  }

  function updateRow(key: string, patch: Partial<CollaboratorRow>) {
    change(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!organizerSells && rows.length === 0) {
      setFormError('Agrega al menos un colaborador, o marca que tú también vendes números.')
      return
    }
    const result = validateRows(rows)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    save.mutate(
      { drafts: result.drafts, organizerSells },
      { onSuccess: () => onDirtyChange(false) },
    )
  }

  return (
    <Card>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <div>
          <h2 className="text-lg font-semibold">Quién vende los números</h2>
          <p className="text-muted">
            Los 100 números se reparten en partes iguales entre las personas que venden. El nombre
            de cada una aparecerá en el registro de actividad.
          </p>
        </div>

        {save.error && <Alert tone="error">{toAppError(save.error).message}</Alert>}
        {formError && <Alert tone="error">{formError}</Alert>}

        <div className="grid grid-cols-[auto_1fr] gap-x-3 rounded-card ring-1 ring-hairline p-3">
          <input
            id="organizador-vende"
            type="checkbox"
            className="mt-0.5 size-5 accent-brand"
            checked={organizerSells}
            aria-describedby="organizador-vende-ayuda"
            onChange={(e) => change(rows, e.target.checked)}
          />
          <label htmlFor="organizador-vende" className="cursor-pointer font-semibold">
            Yo también vendo números
          </label>
          <p id="organizador-vende-ayuda" className="col-start-2 text-sm text-muted">
            Recibes tu propia lista. Sin colaboradores, te quedas con los 100 números.
          </p>
        </div>

        <h3 className="font-semibold">
          Colaboradores ({rows.length} de {MAX_COLLABORATORS})
        </h3>
        {rows.length === 0 && (
          <p className="text-muted">
            Ninguno todavía. Cada colaborador recibe un enlace personal y no necesita cuenta.
          </p>
        )}

        <ol className="flex flex-col gap-3">
          {rows.map((row, index) => (
            <li key={row.key} className="flex flex-col gap-3 rounded-card bg-surface-muted p-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Colaborador {index + 1}</span>
                {(rows.length > 1 || organizerSells) && (
                  <button
                    type="button"
                    className="min-h-11 rounded-full px-4 font-semibold text-danger hover:bg-surface"
                    aria-label={`Quitar al colaborador ${index + 1}${row.displayName ? ` (${row.displayName})` : ''}`}
                    onClick={() => change(rows.filter((other) => other.key !== row.key))}
                  >
                    Quitar
                  </button>
                )}
              </div>
              <TextField
                label="Nombre"
                maxLength={40}
                autoComplete="off"
                value={row.displayName}
                onChange={(e) => updateRow(row.key, { displayName: e.target.value })}
                error={errors[row.key]?.displayName}
              />
              <TextField
                label="Teléfono (opcional)"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                hint="Solo para que tú lo identifiques."
                value={row.phone}
                onChange={(e) => updateRow(row.key, { phone: e.target.value })}
                error={errors[row.key]?.phone}
              />
              <label className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  className="size-5 accent-brand"
                  checked={row.pinEnabled}
                  onChange={(e) => updateRow(row.key, { pinEnabled: e.target.checked })}
                />
                <span>Proteger su acceso con un PIN de 4 dígitos</span>
              </label>
            </li>
          ))}
        </ol>

        {rows.length < MAX_COLLABORATORS && (
          <Button variant="secondary" fullWidth onClick={() => change([...rows, emptyRow()])}>
            + Agregar colaborador
          </Button>
        )}
        <Button type="submit" fullWidth loading={save.isPending}>
          Guardar colaboradores
        </Button>
      </form>
    </Card>
  )
}
