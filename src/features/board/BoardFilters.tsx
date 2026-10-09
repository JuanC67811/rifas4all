import {
  NUMBER_STATUSES,
  NUMBER_STATUS_INFO,
  type BoardFilter,
  type NumberStatus,
} from '@/domain/sale'

type Props = {
  value: BoardFilter
  onChange: (filter: BoardFilter) => void
  counts: Record<NumberStatus, number>
  total: number
  /** Solo para el colaborador: cuántos números son suyos. */
  mineCount?: number
}

/** Filtros rápidos como botones de alternancia (aria-pressed), con su cantidad. */
export function BoardFilters({ value, onChange, counts, total, mineCount }: Props) {
  const options: { filter: BoardFilter; label: string; count: number }[] = [
    { filter: 'all', label: 'Todos', count: total },
    ...(mineCount !== undefined
      ? [{ filter: 'mine' as const, label: 'Mis números', count: mineCount }]
      : []),
    ...NUMBER_STATUSES.map((status) => ({
      filter: status,
      label: NUMBER_STATUS_INFO[status].plural,
      count: counts[status],
    })),
  ]

  return (
    <fieldset className="-mx-4 min-w-0 overflow-x-auto px-4">
      <legend className="sr-only">Filtrar números</legend>
      <div className="flex w-max gap-2 pb-1">
        {options.map((option) => {
          const pressed = option.filter === value
          return (
            <button
              key={option.filter}
              type="button"
              aria-pressed={pressed}
              onClick={() => onChange(option.filter)}
              className={[
                'min-h-11 whitespace-nowrap rounded-full border px-4 font-medium transition',
                'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand',
                pressed
                  ? 'border-forest bg-forest text-forest-ink'
                  : 'border-input-border bg-surface text-text hover:bg-surface-muted',
              ].join(' ')}
            >
              {option.label} <span className="tabular-nums">({option.count})</span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
