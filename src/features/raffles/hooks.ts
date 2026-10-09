import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { RaffleInput } from '@/domain/raffle'
import { queryKeys } from '@/lib/query'
import {
  closeRaffle,
  createRaffle,
  deleteRaffle,
  getRaffle,
  listRaffles,
  raffleChanges,
  updateRaffle,
  type Raffle,
} from './api'

export function useRaffles() {
  return useQuery({ queryKey: queryKeys.raffles, queryFn: listRaffles })
}

export function useRaffle(id: string) {
  return useQuery({ queryKey: queryKeys.raffle(id), queryFn: () => getRaffle(id) })
}

export function useCreateRaffle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ input, timeZone }: { input: RaffleInput; timeZone: string }) =>
      createRaffle(input, timeZone),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.raffles }),
  })
}

export function useUpdateRaffle(original: Raffle) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: RaffleInput) => {
      const changes = raffleChanges(original, input)
      if (Object.keys(changes).length > 0) await updateRaffle(original.id, changes)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.raffles }),
  })
}

export function useCloseRaffle(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => closeRaffle(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.raffles }),
  })
}

export function useDeleteRaffle(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (confirmationName: string) => deleteRaffle(id, confirmationName),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.raffle(id) })
      return queryClient.invalidateQueries({ queryKey: queryKeys.raffles })
    },
  })
}
