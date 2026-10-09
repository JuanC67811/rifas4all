import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { BoardCell, BuyerInput, NewSaleStatus, SaleAction } from '@/domain/sale'
import { supabase } from '@/lib/supabase'
import {
  changeSaleStatus,
  listActiveSales,
  listBoard,
  registerSale,
  updateBuyer,
  type NumberResult,
  type Operation,
} from './api'

export const boardKeys = {
  board: (raffleId: string) => ['board', raffleId] as const,
  sales: (raffleId: string) => ['board', raffleId, 'sales'] as const,
}

export function useBoard(raffleId: string) {
  return useQuery({ queryKey: boardKeys.board(raffleId), queryFn: () => listBoard(raffleId) })
}

export function useSales(raffleId: string) {
  return useQuery({ queryKey: boardKeys.sales(raffleId), queryFn: () => listActiveSales(raffleId) })
}

/** Aplica un cambio a la caché solo si es más nuevo (las respuestas pueden llegar desordenadas). */
function applyCell(
  cells: BoardCell[] | undefined,
  change: Pick<BoardCell, 'number' | 'status' | 'version'> & Partial<BoardCell>,
) {
  return cells?.map((cell) =>
    cell.number === change.number && change.version > cell.version
      ? { ...cell, status: change.status, version: change.version }
      : cell,
  )
}

export type LiveStatus = 'connecting' | 'live' | 'reconnecting'

/**
 * Tiempo real (diseño §29): Supabase avisa de cada cambio en el tablero de esta rifa.
 * El aviso es solo una SEÑAL: actualiza la celda y vuelve a pedir las ventas, que la
 * base de datos filtra por permisos. La verdad está siempre en el servidor.
 */
export function useLiveBoard(raffleId: string): LiveStatus {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<LiveStatus>('connecting')

  useEffect(() => {
    let hasConnected = false
    const channel = supabase
      .channel(`tablero-${raffleId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'raffle_numbers',
          filter: `raffle_id=eq.${raffleId}`,
        },
        (payload) => {
          const row = payload.new as {
            number: number
            status: BoardCell['status']
            version: number
          }
          queryClient.setQueryData<BoardCell[]>(boardKeys.board(raffleId), (cells) =>
            applyCell(cells, row),
          )
          void queryClient.invalidateQueries({ queryKey: boardKeys.sales(raffleId) })
          void queryClient.invalidateQueries({ queryKey: ['activity', raffleId] })
        },
      )
      .subscribe((state) => {
        if (state === 'SUBSCRIBED') {
          // Al reconectar se pudieron perder avisos: se recarga todo una vez.
          if (hasConnected) void queryClient.invalidateQueries({ queryKey: ['board', raffleId] })
          hasConnected = true
          setStatus('live')
        } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
          setStatus('reconnecting')
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [raffleId, queryClient])

  return status
}

type SaleMutation =
  | {
      kind: 'register'
      number: number
      status: NewSaleStatus
      buyer: BuyerInput
      operation: Operation
    }
  | { kind: 'action'; number: number; action: SaleAction; operation: Operation; reason?: string }
  | { kind: 'buyer'; number: number; buyer: BuyerInput; operation: Operation }

/** Todas las escrituras sobre un número. Tras cada una se actualiza la celda y las ventas. */
export function useSaleMutation(raffleId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: SaleMutation): Promise<NumberResult> => {
      switch (input.kind) {
        case 'register':
          return registerSale(raffleId, input.number, input.status, input.buyer, input.operation)
        case 'action':
          return changeSaleStatus(
            raffleId,
            input.number,
            input.action,
            input.operation,
            input.reason,
          )
        case 'buyer':
          return updateBuyer(raffleId, input.number, input.buyer, input.operation)
      }
    },
    onSuccess: (result) => {
      queryClient.setQueryData<BoardCell[]>(boardKeys.board(raffleId), (cells) =>
        applyCell(cells, result),
      )
      void queryClient.invalidateQueries({ queryKey: ['activity', raffleId] })
      return queryClient.invalidateQueries({ queryKey: boardKeys.sales(raffleId) })
    },
    onError: () =>
      // Ante un conflicto (u otro error), se recarga para mostrar el estado real.
      queryClient.invalidateQueries({ queryKey: ['board', raffleId] }),
  })
}
