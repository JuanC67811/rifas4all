import { parseEnv } from './env'

const valid = {
  VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc123',
}

describe('parseEnv', () => {
  it('devuelve la configuración cuando las variables son válidas', () => {
    expect(parseEnv(valid)).toEqual({
      supabaseUrl: 'http://127.0.0.1:54321',
      supabasePublishableKey: 'sb_publishable_abc123',
    })
  })

  it('falla con un mensaje claro si falta una variable', () => {
    expect(() => parseEnv({ VITE_SUPABASE_URL: valid.VITE_SUPABASE_URL })).toThrow(
      /Configuración inválida/,
    )
  })

  it('falla si la URL no es válida', () => {
    expect(() => parseEnv({ ...valid, VITE_SUPABASE_URL: 'no-es-una-url' })).toThrow(/URL válida/)
  })

  it('impide usar una clave secreta en el frontend', () => {
    expect(() =>
      parseEnv({ ...valid, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_no_deberia_estar_aqui' }),
    ).toThrow(/clave SECRETA/)
  })
})
