import { expect, type Browser, type Page, type TestInfo } from '@playwright/test'

/** Utilidades compartidas por las pruebas end-to-end. */
export const DEMO = { email: 'demo@rifas4all.local', password: 'rifas4all-demo' }

export function isoDate(daysFromToday: number) {
  const date = new Date()
  date.setDate(date.getDate() + daysFromToday)
  return date.toISOString().slice(0, 10)
}

export async function login(page: Page) {
  await page.goto('/entrar')
  await page.getByLabel('Correo').fill(DEMO.email)
  await page.getByLabel('Contraseña').fill(DEMO.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Mis rifas' })).toBeVisible()
}

type CollaboratorSpec = { name: string; pin?: boolean }

/** Crea una rifa, agrega colaboradores, la reparte en orden y la activa. */
export async function createActiveRaffle(
  page: Page,
  name: string,
  collaborators: CollaboratorSpec[],
  { organizerSells = false }: { organizerSells?: boolean } = {},
) {
  await page.getByRole('link', { name: '+ Nueva rifa' }).click()
  await page.getByLabel('Nombre de la rifa').fill(name)
  await page.getByLabel('Precio por número').fill('1000')
  await page.getByLabel('Fecha del sorteo').fill(isoDate(30))
  await page.getByLabel('Fecha límite de pago').fill(isoDate(25))
  await page.getByRole('button', { name: 'Crear rifa' }).click()
  await expect(page.getByRole('heading', { name })).toBeVisible()

  if (!organizerSells) await page.getByLabel('Yo también vendo números').uncheck()
  for (const [index, collaborator] of collaborators.entries()) {
    await page.getByRole('button', { name: '+ Agregar colaborador' }).click()
    await page.getByLabel('Nombre', { exact: true }).nth(index).fill(collaborator.name)
    if (collaborator.pin) {
      await page.getByLabel('Proteger su acceso con un PIN de 4 dígitos').nth(index).check()
    }
  }
  await page.getByRole('button', { name: 'Guardar colaboradores' }).click()
  await page.getByRole('button', { name: 'Ver el reparto' }).click()
  await page.getByRole('button', { name: 'Confirmar reparto y activar la rifa' }).click()
  await page.getByRole('button', { name: 'Sí, confirmar y activar' }).click()
  await expect(page.getByRole('tab', { name: 'Tablero' })).toHaveAttribute('aria-selected', 'true')
}

/** Copia (lee) el mensaje de acceso de un colaborador y devuelve enlace y PIN. */
export async function accessFor(page: Page, collaboratorName: string) {
  await page.getByRole('tab', { name: 'Accesos' }).click()
  const card = page.getByRole('article').filter({ hasText: collaboratorName })
  await card.getByRole('button', { name: 'Compartir acceso' }).click()
  const message = await card.getByLabel(`Mensaje para ${collaboratorName}`).inputValue()
  await card.getByRole('button', { name: 'Cerrar' }).click()
  await page.getByRole('tab', { name: 'Tablero' }).click()
  return {
    url: message.match(/Enlace de acceso: (\S+)/)?.[1] ?? '',
    pin: message.match(/PIN: (\d{4})/)?.[1] ?? null,
  }
}

/** Abre el enlace en un navegador nuevo (sin la sesión del organizador) y activa el acceso. */
export async function openAsCollaborator(
  browser: Browser,
  testInfo: TestInfo,
  name: string,
  access: { url: string; pin: string | null },
) {
  const context = await browser.newContext({ ...testInfo.project.use })
  const page = await context.newPage()
  await page.goto(access.url)
  if (access.pin) await page.getByLabel('PIN de 4 dígitos').fill(access.pin)
  await page.getByRole('button', { name: `Sí, soy ${name}` }).click()
  await expect(page.getByRole('heading', { name: `Hola, ${name}` })).toBeVisible()
  return { context, page }
}

/** Cierra y elimina una rifa de prueba desde su pantalla de detalle. */
export async function closeAndDelete(page: Page, name: string) {
  await page.getByRole('button', { name: 'Cerrar la rifa ahora' }).click()
  await page.getByRole('button', { name: 'Sí, cerrar la rifa' }).click()
  await page.getByRole('button', { name: 'Eliminar la rifa' }).click()
  await page.getByLabel(/para confirmar/).fill(name)
  await page.getByRole('button', { name: 'Eliminar definitivamente' }).click()
  await expect(page.getByRole('heading', { name: 'Mis rifas' })).toBeVisible()
}
