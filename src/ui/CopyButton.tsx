import { useState } from 'react'
import { copyText } from '@/lib/clipboard'
import { Button } from './Button'

type Status = 'idle' | 'copied' | 'failed'

/**
 * Botón "Copiar" con confirmación anunciada al lector de pantalla.
 * Si el navegador no permite copiar, lo dice para que la persona seleccione el texto.
 */
export function CopyButton({
  text,
  label,
  variant = 'secondary',
}: {
  text: string
  label: string
  variant?: 'primary' | 'secondary'
}) {
  const [status, setStatus] = useState<Status>('idle')

  async function handleCopy() {
    const copied = await copyText(text)
    setStatus(copied ? 'copied' : 'failed')
    if (copied) window.setTimeout(() => setStatus('idle'), 2500)
  }

  return (
    <div className="flex flex-col gap-1">
      <Button variant={variant} fullWidth onClick={handleCopy}>
        {status === 'copied' ? '✓ Copiado' : label}
      </Button>
      <p aria-live="polite" className="text-center text-sm text-muted">
        {status === 'failed' && 'No se pudo copiar. Selecciona el texto y cópialo a mano.'}
      </p>
    </div>
  )
}
