import type { ReactNode } from 'react'

type Tone = 'error' | 'success' | 'info'

const TONES: Record<Tone, string> = {
  error: 'border-danger bg-danger-soft text-text',
  success: 'border-success bg-success-soft text-text',
  info: 'border-border bg-surface-muted text-text',
}

const ICONS: Record<Tone, string> = { error: '⚠', success: '✓', info: 'ℹ' }

/**
 * Mensaje destacado. Los errores usan role="alert" para que el lector de
 * pantalla los anuncie de inmediato; el resto, role="status".
 * El tono nunca se comunica solo con color: lleva icono y texto.
 */
export function Alert({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex gap-3 rounded-[10px] border-l-4 px-4 py-3 ${TONES[tone]}`}
    >
      <span aria-hidden="true" className="font-bold">
        {ICONS[tone]}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
