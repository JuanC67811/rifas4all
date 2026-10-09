import { accessMessage, accessUrl, tokenFromHash } from './access'

const TOKEN = 'a'.repeat(21) + '-_' + 'B'.repeat(20)

describe('enlace de acceso', () => {
  it('pone el token en el fragmento, no en la ruta ni en la consulta', () => {
    expect(accessUrl('https://rifas4all.app', TOKEN)).toBe(`https://rifas4all.app/i#${TOKEN}`)
  })

  it('lee un token válido del fragmento', () => {
    expect(tokenFromHash(`#${TOKEN}`)).toBe(TOKEN)
  })

  it.each(['', '#', '#corto', `#${TOKEN}x`, '#<script>'])('rechaza el fragmento "%s"', (hash) => {
    expect(tokenFromHash(hash)).toBeNull()
  })
})

describe('accessMessage', () => {
  it('incluye el PIN cuando el acceso lo usa', () => {
    const message = accessMessage({
      collaboratorName: 'Carlos',
      raffleName: 'Canasta Navideña',
      url: 'https://rifas4all.app/i#abc',
      pin: '4827',
    })

    expect(message).toBe(
      [
        'Hola, Carlos. Has sido añadido como colaborador en la rifa Canasta Navideña.',
        '',
        'Enlace de acceso: https://rifas4all.app/i#abc',
        'PIN: 4827',
        '',
        'Este acceso es personal. Las acciones realizadas aparecerán registradas a tu nombre.',
      ].join('\n'),
    )
  })

  it('omite la línea del PIN cuando no hay', () => {
    const message = accessMessage({
      collaboratorName: 'María',
      raffleName: 'Canasta',
      url: 'https://x/i#abc',
      pin: null,
    })

    expect(message).not.toContain('PIN')
  })
})
