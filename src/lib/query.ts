import { QueryClient } from '@tanstack/react-query'
import { AppError } from './errors'

/**
 * Caché de datos del servidor. Reintenta solo los fallos de red; un error de
 * negocio o de permisos no mejora por reintentarlo.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) =>
          error instanceof AppError && error.code === 'NETWORK' && failureCount < 3,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

/** Claves de caché centralizadas para invalidar sin errores de tipeo. */
export const queryKeys = {
  raffles: ['raffles'] as const,
  raffle: (id: string) => ['raffles', id] as const,
  collaborators: (raffleId: string) => ['raffles', raffleId, 'collaborators'] as const,
  distribution: (raffleId: string) => ['raffles', raffleId, 'distribution'] as const,
  invitation: (token: string) => ['invitation', token] as const,
  collaboratorHome: (raffleId: string) => ['collaborator', raffleId] as const,
}
