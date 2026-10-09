import { ActivityLog } from '@/features/activity/ActivityLog'
import { Board } from '@/features/board/Board'
import { useBoard } from '@/features/board/useBoard'
import { AccessesPanel } from '@/features/collaborators/AccessesPanel'
import { useCollaborators, useDistribution } from '@/features/collaborators/hooks'
import type { Raffle } from '@/features/raffles/api'
import { toAppError } from '@/lib/errors'
import { Alert } from '@/ui/Alert'
import { Loading } from '@/ui/layout'
import { Tabs } from '@/ui/Tabs'
import { StatsPanel } from './StatsPanel'

/** Panel del organizador para una rifa activa o cerrada, organizado en pestañas. */
export function RaffleDashboard({ raffle }: { raffle: Raffle }) {
  const collaborators = useCollaborators(raffle.id)
  const distribution = useDistribution(raffle.id, true)
  const board = useBoard(raffle.id)

  if (collaborators.isPending) return <Loading />
  if (collaborators.error) {
    return <Alert tone="error">{toAppError(collaborators.error).message}</Alert>
  }

  const names = new Map(collaborators.data.map((c) => [c.id, c.displayName]))
  const organizerList = collaborators.data.find((c) => c.isOrganizer)

  return (
    <Tabs
      label="Secciones de la rifa"
      items={[
        {
          id: 'tablero',
          label: 'Tablero',
          content: (
            <Board
              raffleId={raffle.id}
              raffleName={raffle.name}
              priceMinor={raffle.priceMinor}
              currency={raffle.currency}
              paymentDeadline={raffle.paymentDeadline}
              timeZone={raffle.timeZone}
              reminderTemplate={raffle.reminderTemplate}
              acceptsChanges={raffle.status === 'active'}
              collaboratorNames={names}
              myCollaboratorId={organizerList?.id}
              canEditAll
            />
          ),
        },
        {
          id: 'resumen',
          label: 'Resumen',
          content: (
            <StatsPanel
              raffle={raffle}
              cells={board.data ?? []}
              collaborators={collaborators.data}
            />
          ),
        },
        {
          id: 'colaboradores',
          label: 'Colaboradores',
          content: (
            <AccessesPanel
              raffleId={raffle.id}
              collaborators={collaborators.data}
              distribution={distribution.data ?? []}
              readOnly={raffle.status === 'closed'}
            />
          ),
        },
        {
          id: 'actividad',
          label: 'Actividad',
          content: <ActivityLog raffleId={raffle.id} collaboratorNames={names} />,
        },
      ]}
    />
  )
}
