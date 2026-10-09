import type { ReactNode } from 'react'
import { Link } from 'react-router'

/** Contenedor de página mobile-first: una columna legible también en escritorio. */
export function Page({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-6">{children}</main>
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-bold">{title}</h1>
      {subtitle && <p className="text-muted">{subtitle}</p>}
    </header>
  )
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
      {children}
    </section>
  )
}

export function Brand() {
  return (
    <Link to="/" className="text-xl font-bold text-brand">
      Rifas4All
    </Link>
  )
}

/** Mensaje de carga. <output> tiene rol "status": los lectores de pantalla lo anuncian. */
export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return <output className="block py-8 text-center text-muted">{label}</output>
}
