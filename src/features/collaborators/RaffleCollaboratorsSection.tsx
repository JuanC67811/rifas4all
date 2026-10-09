import { useState } from 'react'
import type { Raffle } from '@/features/raffles/api'
import { toAppError } from '@/lib/errors'
import { Alert } from '@/ui/Alert'
import { Loading } from '@/ui/layout'
import { CollaboratorsEditor } from './CollaboratorsEditor'
import { DistributionPanel } from './DistributionPanel'
import { useCollaborators } from './hooks'

/**
 * Configuración de un borrador: 1. colaboradores, 2. reparto y activación.
 * Con la rifa activa o cerrada se usa el panel con pestañas (RaffleDashboard).
 */
export function RaffleCollaboratorsSection({ raffle }: { raffle: Raffle }) {
  const collaborators = useCollaborators(raffle.id)
  const [dirty, setDirty] = useState(false)

  if (collaborators.isPending) return <Loading label="Cargando colaboradores…" />
  if (collaborators.error) {
    return <Alert tone="error">{toAppError(collaborators.error).message}</Alert>
  }

  const saved = collaborators.data
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
