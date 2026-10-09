// Se ejecuta antes de pintar la página para evitar un destello del tema equivocado.
// Archivo externo (no en línea) para cumplir la CSP "script-src 'self'".
;(function () {
  var theme = null
  try {
    theme = localStorage.getItem('rifas4all-tema')
  } catch {
    // Almacenamiento bloqueado: se usa el tema del sistema.
  }
  if (theme !== 'light' && theme !== 'dark') {
    theme =
      window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
  }
  document.documentElement.classList.toggle('dark', theme === 'dark')
})()
