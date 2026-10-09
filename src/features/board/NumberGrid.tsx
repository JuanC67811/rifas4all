import { formatRaffleNumber } from '@/domain/raffle-number'
import { NUMBER_STATUS_INFO, type BoardCell, type NumberStatus } from '@/domain/sale'

const CELL_STYLES: Record<NumberStatus, string> = {
  available: 'border-border bg-surface text-text',
  reserved: 'border-st-reserved bg-st-reserved-soft text-text',
  pending_payment: 'border-st-pending bg-st-pending-soft text-text',
  paid: 'border-st-paid bg-st-paid-soft text-text',
  overdue: 'border-st-overdue bg-st-overdue-soft text-text',
}

type Props = {
  cells: BoardCell[]
  /** Colaborador que mira el tablero (para marcar "tuyo"). Sin valor: organizador. */
  myCollaboratorId?: string
  ownerName: (collaboratorId: string) => string | null
  onSelect: (number: number) => void
}

/**
 * Cuadrícula de números: 5 columnas en el teléfono (botones de ~60 px), 10 en
 * pantallas anchas. Cada botón anuncia número, estado y dueño al lector de pantalla.
 */
export function NumberGrid({ cells, myCollaboratorId, ownerName, onSelect }: Props) {
  if (cells.length === 0) {
    return <p className="py-6 text-center text-muted">Ningún número coincide con este filtro.</p>
  }

  return (
    <ul className="grid grid-cols-5 gap-2 sm:grid-cols-10">
      {cells.map((cell) => {
        const info = NUMBER_STATUS_INFO[cell.status]
        const mine = myCollaboratorId !== undefined && cell.collaboratorId === myCollaboratorId
        const notMine = myCollaboratorId !== undefined && !mine
        const owner = ownerName(cell.collaboratorId)
        const label = [
          `Número ${formatRaffleNumber(cell.number)}`,
          info.label,
          mine ? 'tuyo' : owner ? `de ${owner}` : null,
        ]
          .filter(Boolean)
          .join(', ')

        return (
          <li key={cell.number}>
            <button
              type="button"
              aria-label={label}
              title={label}
              onClick={() => onSelect(cell.number)}
              className={[
                'relative flex aspect-square w-full flex-col items-center justify-center rounded-xl border-2',
                'text-lg font-bold tabular-nums transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand',
                CELL_STYLES[cell.status],
                mine ? 'ring-2 ring-brand ring-offset-2 ring-offset-surface' : '',
                notMine ? 'opacity-60' : '',
              ].join(' ')}
            >
              {formatRaffleNumber(cell.number)}
              <span aria-hidden="true" className="text-xs font-semibold leading-none">
                {info.icon}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** Leyenda: qué significa cada icono y color. */
export function StatusLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
      {(Object.keys(NUMBER_STATUS_INFO) as NumberStatus[]).map((status) => (
        <li key={status} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`inline-flex size-5 items-center justify-center rounded border-2 text-xs ${CELL_STYLES[status]}`}
          >
            {NUMBER_STATUS_INFO[status].icon}
          </span>
          {NUMBER_STATUS_INFO[status].label}
        </li>
      ))}
    </ul>
  )
}
