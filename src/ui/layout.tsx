import type { ReactNode } from 'react'
import { Link } from 'react-router'

/** Contenedor de página mobile-first: una columna legible también en escritorio. */
export function Page({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-xl animate-rise flex-col gap-6 px-4 py-8">
      {children}
    </main>
  )
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <header className="flex flex-col gap-2">
      <h1 className="text-3xl font-extrabold tracking-tight text-text">{title}</h1>
      {subtitle && <p className="text-lg text-body">{subtitle}</p>}
    </header>
  )
}

/** Tarjeta estilo Wise: plana, con un filo fino en lugar de sombra. */
export function Card({ children }: { children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-card bg-surface p-5 ring-1 ring-hairline">
      {children}
    </section>
  )
}

/**
 * Sección oscura verde bosque (radio 28 px): para la cifra o el mensaje más
 * importante de una pantalla. Dentro, la lima puede usarse como texto.
 */
export function ForestPanel({ children }: { children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-panel bg-forest p-6 text-forest-ink">
      {children}
    </section>
  )
}

/**
 * Logo de la familia 4All: un boleto lima sobre verde bosque, con su línea de
 * corte y el 4. Mismo dibujo que public/favicon.svg.
 */
export function Logo({ className = 'size-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect width="32" height="32" rx="9" fill="#163300" />
      <path
        d="M7 10.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.2a2.6 2.6 0 0 0 0 5.2v2.6a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-2.6a2.6 2.6 0 0 0 0-5.2z"
        fill="#9fe870"
      />
      <path d="M19 9.5v13" stroke="#163300" strokeWidth="1.4" strokeDasharray="1.6 1.6" />
      <text
        x="13"
        y="19.4"
        textAnchor="middle"
        fontSize="8.5"
        fontWeight="900"
        fill="#163300"
        fontFamily="Inter Variable, Inter, sans-serif"
      >
        4
      </text>
    </svg>
  )
}

export function Brand() {
  return (
    <Link
      to="/"
      className="flex items-center gap-2.5 rounded-full text-xl font-black tracking-tight text-text focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-brand"
    >
      <Logo />
      <span>
        Rifas<span className="text-brand">4All</span>
      </span>
    </Link>
  )
}

/** Mensaje de carga. <output> tiene rol "status": los lectores de pantalla lo anuncian. */
export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return <output className="block py-8 text-center text-muted">{label}</output>
}
