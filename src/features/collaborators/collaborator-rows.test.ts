import type { Collaborator } from './api'
import { rowsChanged, validateRows, type CollaboratorRow } from './collaborator-rows'

const row = (
  key: string,
  displayName: string,
  phone = '',
  pinEnabled = false,
): CollaboratorRow => ({
  key,
  displayName,
  phone,
  pinEnabled,
})

describe('validateRows', () => {
  it('normaliza nombres y teléfonos', () => {
    expect(validateRows([row('a', '  Carlos ', '8888-7777', true), row('b', 'María')])).toEqual({
      ok: true,
      drafts: [
        { displayName: 'Carlos', phone: '+50688887777', pinEnabled: true },
        { displayName: 'María', phone: null, pinEnabled: false },
      ],
    })
  })

  it('marca cada fila con su error', () => {
    const result = validateRows([row('a', ''), row('b', 'José', '123'), row('c', 'jose')])

    expect(result).toEqual({
      ok: false,
      errors: {
        a: { displayName: 'Escribe el nombre.' },
        b: { phone: 'Teléfono no válido. Ejemplo: 8888 7777.' },
        c: { displayName: 'Ese nombre ya está en la lista.' },
      },
    })
  })
})

describe('rowsChanged', () => {
  const saved: Collaborator[] = [
    {
      id: '1',
      position: 1,
      displayName: 'Carlos',
      phone: '+50688887777',
      pinEnabled: true,
      isPaused: false,
      firstActivatedAt: null,
      lastActivityAt: null,
      activeDevices: 0,
    },
  ]

  it('no detecta cambios si el teléfono se escribe con otro formato', () => {
    expect(rowsChanged([row('1', 'Carlos', '8888 7777', true)], saved)).toBe(false)
  })

  it('detecta un nombre, PIN o fila distintos', () => {
    expect(rowsChanged([row('1', 'Carla', '8888 7777', true)], saved)).toBe(true)
    expect(rowsChanged([row('1', 'Carlos', '8888 7777', false)], saved)).toBe(true)
    expect(rowsChanged([], saved)).toBe(true)
  })
})
