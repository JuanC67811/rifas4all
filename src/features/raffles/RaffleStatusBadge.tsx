import { RAFFLE_STATUS_LABELS, type RaffleStatus } from '@/domain/raffle'

const STYLES: Record<RaffleStatus, { icon: string; className: string }> = {
  draft: { icon: '✎', className: 'border-border bg-surface-muted text-text' },
  active: { icon: '●', className: 'border-success bg-success-soft text-text' },
  closed: { icon: '🔒', className: 'border-border bg-surface-muted text-muted' },
}

/** Estado de la rifa con icono y texto: nunca se distingue solo por color. */
export function RaffleStatusBadge({ status }: { status: RaffleStatus }) {
  const { icon, className } = STYLES[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${className}`}
    >
      <span aria-hidden="true">{icon}</span>
      {RAFFLE_STATUS_LABELS[status]}
    </span>
  )
}
