import { useEffect } from 'react'

/**
 * Título de la pestaña por pantalla. Además de orientar, es lo primero que anuncia
 * un lector de pantalla al cambiar de página en una SPA.
 */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Rifas4All` : 'Rifas4All'
  }, [title])
}
