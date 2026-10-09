import { useInfiniteQuery } from '@tanstack/react-query'
import { describeEvent, type ActivityEvent } from '@/domain/activity'
import { toAppError, unwrap } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { Alert } from '@/ui/Alert'
import { Button } from '@/ui/Button'
import { Card, Loading } from '@/ui/layout'

const PAGE_SIZE = 30

/**
 * Página del log, de la más reciente a la más antigua. La base de datos (RLS)
 * decide qué eventos se reciben: el organizador ve todos; el colaborador, solo
 * los de su lista. Se pagina por id (cursor) en lugar de por desplazamiento,
 * así los eventos nuevos no desordenan las páginas.
 */
async function fetchEvents(raffleId: string, beforeId: number | null): Promise<ActivityEvent[]> {
  let query = supabase
    .from('audit_events')
    .select(
      'id, occurred_at, actor_type, actor_label, collaborator_id, action, number, to_status, details, result',
    )
    .eq('raffle_id', raffleId)
    .order('id', { ascending: false })
    .limit(PAGE_SIZE)
  if (beforeId !== null) query = query.lt('id', beforeId)

  const rows = unwrap(await query) ?? []
  return rows.map((row) => ({
    id: row.id,
    occurredAt: row.occurred_at,
    actorType: row.actor_type,
    actorLabel: row.actor_label,
    collaboratorId: row.collaborator_id,
    action: row.action,
    number: row.number,
    toStatus: row.to_status,
    details: (row.details ?? {}) as Record<string, unknown>,
    result: row.result as ActivityEvent['result'],
  }))
}

const dateTime = new Intl.DateTimeFormat('es-CR', { dateStyle: 'short', timeStyle: 'short' })

export function ActivityLog({
  raffleId,
  title = 'Actividad',
  collaboratorNames,
}: {
  raffleId: string
  title?: string
  collaboratorNames: Map<string, string>
}) {
  const events = useInfiniteQuery({
    queryKey: ['activity', raffleId],
    queryFn: ({ pageParam }) => fetchEvents(raffleId, pageParam),
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) =>
      lastPage.length === PAGE_SIZE ? (lastPage.at(-1)?.id ?? null) : null,
  })

  if (events.isPending) return <Loading label="Cargando la actividad…" />
  if (events.error) return <Alert tone="error">{toAppError(events.error).message}</Alert>

  const items = events.data.pages.flat()
  const nameOf = (id: string | null) => (id ? (collaboratorNames.get(id) ?? null) : null)

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Button variant="ghost" onClick={() => void events.refetch()}>
          Actualizar
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-muted">Todavía no hay actividad.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-border">
          {items.map((event) => (
            <li key={event.id} className="flex flex-col gap-0.5 py-2">
              <span>{describeEvent(event, nameOf)}</span>
              <time dateTime={event.occurredAt} className="text-sm text-muted">
                {dateTime.format(new Date(event.occurredAt))}
              </time>
            </li>
          ))}
        </ol>
      )}
      {events.hasNextPage && (
        <Button
          variant="secondary"
          fullWidth
          loading={events.isFetchingNextPage}
          loadingText="Cargando…"
          onClick={() => void events.fetchNextPage()}
        >
          Ver actividad anterior
        </Button>
      )}
      <p className="text-sm text-muted">
        El registro no se puede modificar ni borrar desde la app, y no guarda datos de los
        compradores.
      </p>
    </Card>
  )
}
