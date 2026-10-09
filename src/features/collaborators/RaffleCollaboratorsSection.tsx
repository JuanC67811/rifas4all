import { useState } from 'react'
import { Board } from '@/features/board/Board'
import type { Raffle } from '@/features/raffles/api'
import { toAppError } from '@/lib/errors'
import { Alert } from '@/ui/Alert'
import { Loading } from '@/ui/layout'
import { AccessesPanel } from './AccessesPanel'
import { CollaboratorsEditor } from './CollaboratorsEditor'
import { DistributionPanel } from './DistributionPanel'
import { useCollaborators, useDistribution } from './hooks'

/**
 * Sección de colaboradores en el detalle de la rifa:
 *   Borrador → 1. editar colaboradores, 2. reparto y activación.
 *   Activa   → tablero de números + compartir y gestionar accesos.
 *   Cerrada  → tablero y accesos, solo consulta.
 */
export function RaffleCollaboratorsSection({ raffle }: { raffle: Raffle }) {
  const collaborators = useCollaborators(raffle.id)
  const distribution = useDistribution(raffle.id, raffle.status !== 'draft')
  const [dirty, setDirty] = useState(false)

  if (collaborators.isPending) return <Loading label="Cargando colaboradores…" />
  if (collaborators.error) {
    return <Alert tone="error">{toAppError(collaborators.error).message}</Alert>
  }

  const saved = collaborators.data

  if (raffle.status === 'draft') {
    return (
      <>
        <CollaboratorsEditor raffleId={raffle.id} saved={saved} onDirtyChange={setDirty} />
        {saved.length > 0 &&
          (dirty ? (
            <Alert tone="info">Guarda los colaboradores para repartir los números.</Alert>
          ) : (
            <DistributionPanel raffleId={raffle.id} savedMethod={raffle.distributionMethod} />
          ))}
      </>
    )
  }

  return (
    <>
      <Board
        raffleId={raffle.id}
        priceMinor={raffle.priceMinor}
        currency={raffle.currency}
        acceptsChanges={raffle.status === 'active'}
        collaboratorNames={new Map(saved.map((c) => [c.id, c.displayName]))}
      />
      <AccessesPanel
        raffleId={raffle.id}
        collaborators={saved}
        distribution={distribution.data ?? []}
        readOnly={raffle.status === 'closed'}
      />
    </>
  )
}
