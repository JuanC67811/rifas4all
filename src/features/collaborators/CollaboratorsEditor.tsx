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

/** Lista de 1 a 12 colaboradores de un borrador: nombre, teléfono opcional y PIN. */
export function CollaboratorsEditor({ raffleId, saved, onDirtyChange }: Props) {
  const [rows, setRows] = useState<CollaboratorRow[]>(() =>
    saved.length > 0 ? rowsFromCollaborators(saved) : [emptyRow()],
  )
  const [errors, setErrors] = useState<Record<string, RowErrors>>({})
  const save = useSaveCollaborators(raffleId)

  function change(nextRows: CollaboratorRow[]) {
    setRows(nextRows)
    onDirtyChange(rowsChanged(nextRows, saved))
  }

  function updateRow(key: string, patch: Partial<CollaboratorRow>) {
    change(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const result = validateRows(rows)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    save.mutate(result.drafts, { onSuccess: () => onDirtyChange(false) })
  }

  return (
    <Card>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <div>
          <h2 className="text-lg font-semibold">Colaboradores</h2>
          <p className="text-muted">
            Las personas que venderán los números ({rows.length} de {MAX_COLLABORATORS}). El nombre
            es el que aparecerá en el registro de actividad.
          </p>
        </div>

        {save.error && <Alert tone="error">{toAppError(save.error).message}</Alert>}

        <ol className="flex flex-col gap-3">
          {rows.map((row, index) => (
            <li key={row.key} className="flex flex-col gap-3 rounded-xl bg-surface-muted p-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Colaborador {index + 1}</span>
                {rows.length > 1 && (
                  <button
                    type="button"
                    className="min-h-11 rounded-lg px-3 text-danger hover:bg-surface"
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
