import { useEffect, useId, useRef, type ReactNode } from 'react'

/**
 * Panel inferior en el teléfono, ventana centrada en pantallas grandes.
 * Usa <dialog> nativo con showModal(): el navegador atrapa el foco dentro, cierra
 * con Escape y deja inerte el resto de la página para el lector de pantalla.
 */
export function BottomSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      // jsdom (pruebas) no implementa showModal: se abre como diálogo simple.
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
    }
  }, [open])

  return (
    // Tocar el fondo oscuro es solo un atajo para ratón o dedo: con teclado, <dialog>
    // se cierra con Escape y además hay un botón "Cerrar" visible.
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90dvh] w-full max-w-none overflow-y-auto rounded-t-2xl bg-surface p-0 text-text backdrop:bg-black/60 sm:inset-0 sm:m-auto sm:max-w-lg sm:rounded-2xl"
    >
      {open && (
        <div className="flex flex-col gap-4 p-4 pb-6">
          <header className="flex items-center justify-between gap-3">
            <h2 id={titleId} className="text-xl font-bold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-lg px-3 font-medium text-brand hover:bg-surface-muted"
            >
              Cerrar
            </button>
          </header>
          {children}
        </div>
      )}
    </dialog>
  )
}
