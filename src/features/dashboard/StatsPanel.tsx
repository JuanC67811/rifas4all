import { browserTimeZone, daysBetween, formatDate, todayIn } from '@/domain/dates'
import { formatMoney } from '@/domain/money'
import { closingDate, deletionDate } from '@/domain/raffle'
import { countByStatus, type BoardCell } from '@/domain/sale'
import type { Collaborator } from '@/features/collaborators/api'
import type { Raffle } from '@/features/raffles/api'
import { Card } from '@/ui/layout'

function drawText(raffle: Raffle) {
  const days = daysBetween(todayIn(raffle.timeZone ?? browserTimeZone()), raffle.drawDate)
  if (days > 1) return `Faltan ${days} días para el sorteo (${formatDate(raffle.drawDate)})`
  if (days === 1) return `El sorteo es mañana (${formatDate(raffle.drawDate)})`
  if (days === 0) return 'El sorteo es hoy'
  return `El sorteo fue el ${formatDate(raffle.drawDate)}. La rifa se cierra el ${formatDate(closingDate(raffle.drawDate))} y se borra el ${formatDate(deletionDate(raffle.drawDate))}.`
}

/**
 * Resumen del organizador: avance general, dinero y avance por lista.
 * El avance por lista se muestra en el orden de los colaboradores, sin ranking:
 * es para coordinar, no para evaluar a nadie (diseño §19).
 */
export function StatsPanel({
  raffle,
  cells,
  collaborators,
}: {
  raffle: Raffle
  cells: BoardCell[]
  collaborators: Collaborator[]
}) {
  const counts = countByStatus(cells)
  const taken = 100 - counts.available
  const debt = counts.pending_payment + counts.overdue

  return (
    <>
      <Card>
        <h2 className="text-lg font-semibold">Resumen</h2>
        <p>{drawText(raffle)}</p>
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-sm">
            <span>Números vendidos o apartados</span>
            <span className="font-semibold tabular-nums">{taken} de 100</span>
          </div>
          <progress
            className="h-3 w-full overflow-hidden rounded-full accent-brand"
            max={100}
            value={taken}
            aria-label={`${taken} de 100 números vendidos o apartados`}
          />
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            ['Pagados', counts.paid],
            ['Por cobrar', debt],
            ['Vencidos', counts.overdue],
            ['Reservados', counts.reserved],
            ['Disponibles', counts.available],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-surface-muted p-3">
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="text-xl font-bold tabular-nums">{value}</dd>
            </div>
          ))}
          <div className="rounded-xl bg-surface-muted p-3">
            <dt className="text-sm text-muted">Recaudado</dt>
            <dd className="text-xl font-bold">
              {formatMoney(counts.paid * raffle.priceMinor, raffle.currency)}
            </dd>
          </div>
        </dl>
        <p className="text-sm text-muted">
          Pendiente de cobro: {formatMoney(debt * raffle.priceMinor, raffle.currency)}.
        </p>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Avance por lista</h2>
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-md text-left">
            <caption className="sr-only">
              Números vendidos, pagados y por cobrar de cada lista
            </caption>
            <thead className="text-sm text-muted">
              <tr>
                <th scope="col" className="py-2 pr-2 font-medium">
                  Colaborador
                </th>
                <th scope="col" className="px-2 font-medium">
                  Vendidos
                </th>
                <th scope="col" className="px-2 font-medium">
                  Pagados
                </th>
                <th scope="col" className="px-2 font-medium">
                  Por cobrar
                </th>
                <th scope="col" className="pl-2 font-medium">
                  Recaudado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular-nums">
              {collaborators.map((collaborator) => {
                const mine = countByStatus(
                  cells.filter((c) => c.collaboratorId === collaborator.id),
                )
                const total = cells.filter((c) => c.collaboratorId === collaborator.id).length
                return (
                  <tr key={collaborator.id}>
                    <th scope="row" className="py-2 pr-2 font-semibold">
                      {collaborator.displayName}
                    </th>
                    <td className="px-2">
                      {total - mine.available} / {total}
                    </td>
                    <td className="px-2">{mine.paid}</td>
                    <td className="px-2">{mine.pending_payment + mine.overdue}</td>
                    <td className="pl-2">
                      {formatMoney(mine.paid * raffle.priceMinor, raffle.currency)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
