import { allRaffleNumbers, formatRaffleNumber } from '@/domain/raffle-number'

/**
 * Pantalla provisional de la Fase 1: comprueba que React, Tailwind, los tokens de diseño
 * y el dominio están conectados. Se sustituirá por el router en la Fase 3.
 */
export function App() {
  const preview = allRaffleNumbers().slice(0, 10)

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-10">
      <header>
        <h1 className="text-3xl font-bold text-brand">Rifas4All</h1>
        <p className="mt-2 text-muted">
          Administra rifas de 100 números con tus colaboradores, sin que tengan que registrarse.
        </p>
      </header>

      <section aria-labelledby="preview-title">
        <h2 id="preview-title" className="mb-3 text-lg font-semibold">
          Vista previa de la cuadrícula
        </h2>
        <ul className="grid grid-cols-5 gap-2">
          {preview.map((number) => (
            <li
              key={number}
              className="flex min-h-12 items-center justify-center rounded-lg border border-border bg-surface-muted text-lg font-semibold tabular-nums"
            >
              {formatRaffleNumber(number)}
            </li>
          ))}
        </ul>
      </section>

      <p className="text-sm text-muted">En construcción · Fase 1: fundaciones del proyecto.</p>
    </main>
  )
}
