import { todayIn } from '@/domain/dates'
import { formatMoney, type Currency } from '@/domain/money'
import { formatPhone } from '@/domain/phone'
import { formatRaffleNumber } from '@/domain/raffle-number'
import { deadlineStatus, renderReminder } from '@/domain/reminder'
import { NUMBER_STATUS_INFO } from '@/domain/sale'
import { Alert } from '@/ui/Alert'
import { CopyButton } from '@/ui/CopyButton'
import type { Sale } from './api'

type Props = {
  sales: Sale[]
  raffleName: string
  paymentDeadline: string
  timeZone: string
  reminderTemplate: string | null
  currency: Currency
  ownerName: (collaboratorId: string) => string | null
}

/**
 * Pagos por cobrar con su recordatorio listo para copiar (diseño §18).
 * La alerta de "vence en 3 días" se calcula aquí, al mostrar la pantalla:
 * no depende de ninguna tarea programada.
 */
export function ToCollect({
  sales,
  raffleName,
  paymentDeadline,
  timeZone,
  reminderTemplate,
  currency,
  ownerName,
}: Props) {
  const debts = sales
    .filter((sale) => sale.status === 'pending_payment' || sale.status === 'overdue')
    .sort((a, b) => a.number - b.number)
  if (debts.length === 0) return null

  const deadline = deadlineStatus(paymentDeadline, todayIn(timeZone))
  const total = debts.reduce((sum, sale) => sum + sale.priceMinor, 0)

  return (
    <section aria-labelledby="por-cobrar" className="flex flex-col gap-3">
      <h3 id="por-cobrar" className="text-lg font-semibold">
        Por cobrar ({debts.length}) · {formatMoney(total, currency)}
      </h3>
      {deadline.urgent ? (
        <Alert tone="error">{deadline.text}: envía un recordatorio a quienes no han pagado.</Alert>
      ) : (
        <p className="text-muted">{deadline.text}.</p>
      )}
      <ul className="flex flex-col gap-2">
        {debts.map((sale) => {
          const message = renderReminder(reminderTemplate, {
            buyerName: sale.buyerAlias ?? sale.buyerName,
            number: formatRaffleNumber(sale.number),
            raffleName,
            deadline: paymentDeadline,
            amount: formatMoney(sale.priceMinor, sale.currency),
          })
          const owner = ownerName(sale.collaboratorId)
          return (
            <li key={sale.id} className="flex flex-col gap-2 rounded-card bg-surface-muted p-3">
              <p>
                <span className="font-bold tabular-nums">{formatRaffleNumber(sale.number)}</span> ·{' '}
                {sale.buyerName}
                {sale.status === 'overdue' && (
                  <span className="font-semibold">
                    {' '}
                    · <span aria-hidden="true">{NUMBER_STATUS_INFO.overdue.icon}</span> Vencido
                  </span>
                )}
                {owner && <span className="text-muted"> · {owner}</span>}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <CopyButton text={message} label="Copiar recordatorio" />
                <CopyButton text={formatPhone(sale.buyerPhone)} label="Copiar teléfono" />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
