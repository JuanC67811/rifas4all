import { normalizePhone } from '@/domain/phone'
import type { Collaborator, CollaboratorDraft } from './api'

/** Fila editable del formulario de colaboradores (los valores tal como se escriben). */
export type CollaboratorRow = {
  key: string
  displayName: string
  phone: string
  pinEnabled: boolean
}

export type RowErrors = { displayName?: string; phone?: string }

export const MAX_COLLABORATORS = 12

let nextKey = 0
export function emptyRow(): CollaboratorRow {
  nextKey += 1
  return { key: `nuevo-${nextKey}`, displayName: '', phone: '', pinEnabled: false }
}

export function rowsFromCollaborators(collaborators: Collaborator[]): CollaboratorRow[] {
  return collaborators.map((collaborator) => ({
    key: collaborator.id,
    displayName: collaborator.displayName,
    phone: collaborator.phone ?? '',
    pinEnabled: collaborator.pinEnabled,
  }))
}

/**
 * Valida las filas: nombre obligatorio (1–40), teléfono opcional pero válido y
 * nombres sin repetir (en el log, "Carlos" debe identificar a una sola persona).
 */
export function validateRows(
  rows: CollaboratorRow[],
): { ok: true; drafts: CollaboratorDraft[] } | { ok: false; errors: Record<string, RowErrors> } {
  const errors: Record<string, RowErrors> = {}
  const drafts: CollaboratorDraft[] = []
  const seen = new Set<string>()

  for (const row of rows) {
    const rowErrors: RowErrors = {}
    const name = row.displayName.trim()
    // "José" y "jose" cuentan como el mismo nombre: sin mayúsculas ni tildes.
    const normalized = name
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLocaleLowerCase('es')

    if (name === '') rowErrors.displayName = 'Escribe el nombre.'
    else if (name.length > 40) rowErrors.displayName = 'Máximo 40 caracteres.'
    else if (seen.has(normalized)) rowErrors.displayName = 'Ese nombre ya está en la lista.'
    seen.add(normalized)

    const phone = row.phone.trim() === '' ? null : normalizePhone(row.phone)
    if (row.phone.trim() !== '' && phone === null) {
      rowErrors.phone = 'Teléfono no válido. Ejemplo: 8888 7777.'
    }

    if (rowErrors.displayName || rowErrors.phone) errors[row.key] = rowErrors
    drafts.push({ displayName: name, phone, pinEnabled: row.pinEnabled })
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, drafts }
}

/** ¿Las filas difieren de lo guardado? (si es así, la vista previa del reparto no vale). */
export function rowsChanged(rows: CollaboratorRow[], saved: Collaborator[]): boolean {
  if (rows.length !== saved.length) return true
  return rows.some((row, index) => {
    const original = saved[index]
    return (
      !original ||
      row.displayName.trim() !== original.displayName ||
      (row.phone.trim() === '' ? null : normalizePhone(row.phone)) !== original.phone ||
      row.pinEnabled !== original.pinEnabled
    )
  })
}
