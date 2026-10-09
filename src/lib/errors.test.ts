import { AppError, toAppError, unwrap } from './errors'

describe('toAppError', () => {
  it('traduce un error de negocio de PostgreSQL por su código', () => {
    const error = toAppError({ code: 'P0001', message: 'R4A_CONFLICT', details: '' })

    expect(error.code).toBe('R4A_CONFLICT')
    expect(error.message).toMatch(/cambió mientras lo editabas/)
  })

  it('usa el detalle del servidor cuando explica mejor una validación', () => {
    const error = toAppError({
      code: 'P0001',
      message: 'R4A_VALIDATION',
      details: 'La fecha del sorteo no puede estar en el pasado.',
    })

    expect(error.message).toBe('La fecha del sorteo no puede estar en el pasado.')
  })

  it('traduce errores de Supabase Auth', () => {
    expect(toAppError({ code: 'invalid_credentials', message: 'Invalid login' }).code).toBe(
      'AUTH_INVALID_CREDENTIALS',
    )
    expect(toAppError({ code: 'user_already_exists' }).code).toBe('AUTH_EMAIL_TAKEN')
  })

  it('reconoce la falta de conexión', () => {
    expect(toAppError(new TypeError('Failed to fetch')).code).toBe('NETWORK')
  })

  it('trata las restricciones de la base de datos como datos inválidos', () => {
    expect(toAppError({ code: '23514', message: 'violates check constraint' }).code).toBe(
      'R4A_VALIDATION',
    )
  })

  it('nunca muestra mensajes técnicos desconocidos', () => {
    const error = toAppError({ code: 'XX000', message: 'internal error at line 42' })

    expect(error.code).toBe('UNKNOWN')
    expect(error.message).not.toMatch(/line 42/)
  })

  it('no inventa códigos que no existen', () => {
    expect(toAppError({ code: 'P0001', message: 'R4A_INVENTADO' }).code).toBe('UNKNOWN')
  })
})

describe('unwrap', () => {
  it('devuelve los datos si no hay error', () => {
    expect(unwrap({ data: [1, 2], error: null })).toEqual([1, 2])
  })

  it('lanza un AppError si hay error', () => {
    expect(() =>
      unwrap({ data: null, error: { code: 'P0001', message: 'R4A_FORBIDDEN' } }),
    ).toThrow(AppError)
  })
})
