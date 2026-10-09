import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { DistributionMethod } from '@/features/raffles/api'
import { queryKeys } from '@/lib/query'
import {
  confirmDistribution,
  getAccessCredentials,
  getDistribution,
  listCollaborators,
  previewDistribution,
  regenerateAccess,
  saveCollaborators,
  setCollaboratorPaused,
  type CollaboratorDraft,
} from './api'

export function useCollaborators(raffleId: string) {
  return useQuery({
    queryKey: queryKeys.collaborators(raffleId),
    queryFn: () => listCollaborators(raffleId),
  })
}

export function useDistribution(raffleId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.distribution(raffleId),
    queryFn: () => getDistribution(raffleId),
    enabled,
  })
}

/** Invalida todo lo de una rifa (sus claves empiezan por ['raffles', id]). */
function useInvalidateRaffle(raffleId: string) {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.raffle(raffleId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.raffles, exact: true }),
    ])
}

export function useSaveCollaborators(raffleId: string) {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateRaffle(raffleId)
  return useMutation({
    mutationFn: ({
      drafts,
      organizerSells,
    }: {
      drafts: CollaboratorDraft[]
      organizerSells: boolean
    }) => saveCollaborators(raffleId, drafts, organizerSells),
    onSuccess: () => {
      // Guardar la lista descarta la vista previa del reparto en el servidor.
      queryClient.setQueryData(queryKeys.distribution(raffleId), [])
      return invalidate()
    },
  })
}

export function usePreviewDistribution(raffleId: string) {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateRaffle(raffleId)
  return useMutation({
    mutationFn: (method: DistributionMethod) => previewDistribution(raffleId, method),
    onSuccess: (summary) => {
      queryClient.setQueryData(queryKeys.distribution(raffleId), summary)
      return invalidate()
    },
  })
}

export function useConfirmDistribution(raffleId: string) {
  const invalidate = useInvalidateRaffle(raffleId)
  return useMutation({ mutationFn: () => confirmDistribution(raffleId), onSuccess: invalidate })
}

export function useAccessCredentials() {
  return useMutation({ mutationFn: getAccessCredentials })
}

export function useSetPaused(raffleId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ collaboratorId, paused }: { collaboratorId: string; paused: boolean }) =>
      setCollaboratorPaused(collaboratorId, paused),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.collaborators(raffleId) }),
  })
}

export function useRegenerateAccess(raffleId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: regenerateAccess,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.collaborators(raffleId) }),
  })
}
