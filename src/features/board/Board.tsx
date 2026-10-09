import { useState } from 'react'
import { formatMoney, type Currency } from '@/domain/money'
import { formatRaffleNumber } from '@/domain/raffle-number'
import { countByStatus, matchesFilter, type BoardFilter } from '@/domain/sale'
import { toAppError } from '@/lib/errors'
import { Alert } from '@/ui/Alert'
import { BottomSheet } from '@/ui/BottomSheet'
import { Card, Loading } from '@/ui/layout'
import { BoardFilters } from './BoardFilters'
import { NumberGrid, StatusLegend } from './NumberGrid'
import { NumberSheet } from './NumberSheet'
import { useBoard, useLiveBoard, useSales, type LiveStatus } from './useBoard'

type Props = {
  raffleId: string
  priceMinor: number
  currency: Currency
  /** La rifa acepta cambios (activa). Cerrada: solo consulta. */
  acceptsChanges: boolean
  /** Colaborador que mira; sin valor, es el organizador (puede editar todo). */
  myCollaboratorId?: string
  /** Nombres de colaboradores visibles para quien mira. */
  collaboratorNames: Map<string, string>
}

const LIVE_LABELS: Record<LiveStatus, { icon: string; text: string }> = {
  connecting: { icon: '○', text: 'Conectando…' },
  live: { icon: '●', text: 'En vivo' },
  reconnecting: { icon: '◌', text: 'Reconectando… los cambios se verán al volver' },
}

export function Board({
  raffleId,
  priceMinor,
  currency,
  acceptsChanges,
  myCollaboratorId,
  collaboratorNames,
}: Props) {
  const board = useBoard(raffleId)
  const sales = useSales(raffleId)
  const live = useLiveBoard(raffleId)
  const [filter, setFilter] = useState<BoardFilter>(myCollaboratorId ? 'mine' : 'all')
  const [selected, setSelected] = useState<number | null>(null)

  const cells = board.data ?? []
  const isCollaborator = myCollaboratorId !== undefined
  const relevant = isCollaborator
    ? cells.filter((c) => c.collaboratorId === myCollaboratorId)
    : cells
  const counts = countByStatus(cells)
  const myCounts = countByStatus(relevant)
  const visible = cells.filter((cell) => matchesFilter(cell, filter, myCollaboratorId))

  if (board.isPending) return <Loading label="Cargando el tablero…" />
  if (board.error) return <Alert tone="error">{toAppError(board.error).message}</Alert>

  const selectedCell = cells.find((cell) => cell.number === selected)
  const selectedSale = sales.data?.find((sale) => sale.number === selected)
  const ownerName = (id: string) => collaboratorNames.get(id) ?? null
  const isMine = (collaboratorId: string) => !isCollaborator || collaboratorId === myCollaboratorId

  const collected = myCounts.paid * priceMinor
  const pending = (myCounts.pending_payment + myCounts.overdue) * priceMinor
  const liveLabel = LIVE_LABELS[live]

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {isCollaborator ? 'Tablero' : 'Tablero de números'}
        </h2>
        <p className="text-sm text-muted" aria-live="polite">
          <span aria-hidden="true">{liveLabel.icon}</span> {liveLabel.text}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-surface-muted p-3">
          <dt className="text-sm text-muted">
            {isCollaborator ? 'Recaudado por ti' : 'Recaudado'}
          </dt>
          <dd className="text-lg font-bold">{formatMoney(collected, currency)}</dd>
        </div>
        <div className="rounded-xl bg-surface-muted p-3">
          <dt className="text-sm text-muted">Pendiente de cobro</dt>
          <dd className="text-lg font-bold">{formatMoney(pending, currency)}</dd>
        </div>
      </dl>

      {!acceptsChanges && (
        <Alert tone="info">La rifa está cerrada: el tablero es solo de consulta.</Alert>
      )}

      <BoardFilters
        value={filter}
        onChange={setFilter}
        counts={counts}
        total={cells.length}
        mineCount={isCollaborator ? relevant.length : undefined}
      />
      <NumberGrid
        cells={visible}
        myCollaboratorId={myCollaboratorId}
        ownerName={ownerName}
        onSelect={setSelected}
      />
      <StatusLegend />

      <BottomSheet
        open={selectedCell !== undefined}
        title={selectedCell ? `Número ${formatRaffleNumber(selectedCell.number)}` : ''}
        onClose={() => setSelected(null)}
      >
        {selectedCell && (
          <NumberSheet
            // Al cambiar de número se reinicia el estado interno del panel.
            key={selectedCell.number}
            raffleId={raffleId}
            cell={selectedCell}
            sale={selectedSale}
            salesLoading={sales.isPending}
            canEdit={acceptsChanges && isMine(selectedCell.collaboratorId)}
            readOnlyReason={
              acceptsChanges ? null : 'La rifa está cerrada: solo se puede consultar.'
            }
            ownerName={ownerName(selectedCell.collaboratorId)}
            priceMinor={priceMinor}
            currency={currency}
          />
        )}
      </BottomSheet>
    </Card>
  )
}
