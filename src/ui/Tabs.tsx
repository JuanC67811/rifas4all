import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

export type TabItem = { id: string; label: string; content: ReactNode }

/**
 * Pestañas accesibles (patrón WAI-ARIA): role tablist/tab/tabpanel, flechas
 * izquierda/derecha e Inicio/Fin para moverse, y solo la pestaña activa en el orden
 * del tabulador. El contenido inactivo no se monta.
 */
export function Tabs({ label, items }: { label: string; items: TabItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? '')
  const baseId = useId()
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})

  function focusTab(index: number) {
    const item = items[(index + items.length) % items.length]
    if (!item) return
    setActive(item.id)
    refs.current[item.id]?.focus()
  }

  function handleKeyDown(event: KeyboardEvent, index: number) {
    if (event.key === 'ArrowRight') focusTab(index + 1)
    else if (event.key === 'ArrowLeft') focusTab(index - 1)
    else if (event.key === 'Home') focusTab(0)
    else if (event.key === 'End') focusTab(items.length - 1)
    else return
    event.preventDefault()
  }

  const current = items.find((item) => item.id === active) ?? items[0]

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label={label}
        className="flex gap-1 overflow-x-auto rounded-full bg-surface-muted p-1 ring-1 ring-hairline"
      >
        {items.map((item, index) => {
          const selected = item.id === current?.id
          return (
            <button
              key={item.id}
              ref={(element) => {
                refs.current[item.id] = element
              }}
              id={`${baseId}-tab-${item.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(item.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={[
                'min-h-11 flex-1 whitespace-nowrap rounded-full px-3 text-[15px] font-semibold transition',
                'focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-brand',
                selected ? 'bg-cta text-cta-ink' : 'text-body hover:bg-surface hover:text-text',
              ].join(' ')}
            >
              {item.label}
            </button>
          )
        })}
      </div>
      {current && (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${current.id}`}
          aria-labelledby={`${baseId}-tab-${current.id}`}
          className="flex flex-col gap-6"
        >
          {current.content}
        </div>
      )}
    </div>
  )
}
