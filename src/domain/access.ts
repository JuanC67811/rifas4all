/**
 * Acceso de un colaborador: el enlace y el mensaje que el organizador copia y
 * pega donde quiera (WhatsApp, SMS, en persona…). La app no envía nada por sí sola.
 *
 * El token va en el FRAGMENTO de la URL (#): el navegador no lo envía al servidor,
 * no queda en los registros del hosting y las vistas previas de enlaces no lo ven.
 */
export function accessUrl(origin: string, token: string): string {
  return `${origin}/i#${token}`
}

/** Lee el token del fragmento de la URL ("#abc…" → "abc…"). */
export function tokenFromHash(hash: string): string | null {
  const token = hash.replace(/^#/, '').trim()
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null
}

export type AccessMessageInput = {
  collaboratorName: string
  raffleName: string
  url: string
  pin: string | null
}

export function accessMessage({ collaboratorName, raffleName, url, pin }: AccessMessageInput) {
  return [
    `Hola, ${collaboratorName}. Has sido añadido como colaborador en la rifa ${raffleName}.`,
    '',
    `Enlace de acceso: ${url}`,
    ...(pin ? [`PIN: ${pin}`] : []),
    '',
    'Este acceso es personal. Las acciones realizadas aparecerán registradas a tu nombre.',
  ].join('\n')
}

/** Aviso que ve el colaborador antes de activar su acceso (diseño §11). */
export function responsibilityNotice(collaboratorName: string) {
  return (
    `Este acceso está asignado a ${collaboratorName}. Todas las acciones realizadas con este ` +
    `acceso quedarán registradas a nombre de ${collaboratorName}. No compartas el enlace ni el PIN.`
  )
}
