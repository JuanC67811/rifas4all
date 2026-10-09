/**
 * Recuerda la última rifa en la que este navegador entró como colaborador, para
 * ofrecer "Volver a mis números" en la página de inicio. Es solo una comodidad:
 * si el navegador bloquea el almacenamiento, la app funciona igual.
 */
const KEY = 'rifas4all:ultima-rifa'

export function rememberLastRaffle(raffleId: string) {
  try {
    localStorage.setItem(KEY, raffleId)
  } catch {
    // Almacenamiento no disponible (modo privado, bloqueado…).
  }
}

export function lastRaffle(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function forgetLastRaffle() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nada que hacer.
  }
}
