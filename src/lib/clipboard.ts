/**
 * Copia texto al portapapeles. La API moderna exige HTTPS (o localhost) y un gesto
 * de la persona, y algunos navegadores internos (como el de WhatsApp) la bloquean.
 * Si falla, se intenta el método antiguo; si también falla, devuelve false y la
 * interfaz deja el texto visible para copiarlo a mano.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Se intenta el método alternativo.
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    textarea.remove()
    return copied
  } catch {
    return false
  }
}
