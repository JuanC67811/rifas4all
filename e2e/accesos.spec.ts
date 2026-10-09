import { expect, test } from '@playwright/test'
import { isoDate, login } from './helpers.ts'

test('de la configuración al acceso del colaborador', async ({ page, browser }, testInfo) => {
  const raffleName = `Rifa accesos ${testInfo.project.name} ${Date.now()}`

  // ---------------------------------------------------------------------------
  // Organizadora: crea la rifa y agrega colaboradores
  // ---------------------------------------------------------------------------
  await login(page)
  await page.getByRole('link', { name: '+ Nueva rifa' }).click()
  await page.getByLabel('Nombre de la rifa').fill(raffleName)
  await page.getByLabel('Precio por número').fill('1000')
  await page.getByLabel('Fecha del sorteo').fill(isoDate(30))
  await page.getByLabel('Fecha límite de pago').fill(isoDate(25))
  await page.getByRole('button', { name: 'Crear rifa' }).click()
  await expect(page.getByRole('heading', { name: raffleName })).toBeVisible()

  await page.getByLabel('Nombre').first().fill('Carlos')
  await page.getByLabel('Teléfono (opcional)').first().fill('8888 7777')
  await page.getByLabel('Proteger su acceso con un PIN de 4 dígitos').first().check()
  await page.getByRole('button', { name: '+ Agregar colaborador' }).click()
  await page.getByLabel('Nombre').nth(1).fill('María')
  await page.getByRole('button', { name: 'Guardar colaboradores' }).click()

  // ---------------------------------------------------------------------------
  // Reparto en orden, vista previa y activación
  // ---------------------------------------------------------------------------
  await page.getByRole('button', { name: 'Ver el reparto' }).click()
  await expect(page.getByText('Carlos · 50 números')).toBeVisible()
  await expect(page.getByText('00–49')).toBeVisible()
  await expect(page.getByText('50–99')).toBeVisible()

  await page.getByRole('button', { name: 'Confirmar reparto y activar la rifa' }).click()
  await page.getByRole('button', { name: 'Sí, confirmar y activar' }).click()
  await expect(page.getByRole('heading', { name: 'Colaboradores y accesos' })).toBeVisible()

  // ---------------------------------------------------------------------------
  // Compartir el acceso de Carlos
  // ---------------------------------------------------------------------------
  const carlos = page.getByRole('article').filter({ hasText: 'Carlos' })
  await expect(carlos.getByText('Todavía no abrió su enlace')).toBeVisible()
  await carlos.getByRole('button', { name: 'Compartir acceso' }).click()

  const message = await carlos.getByLabel('Mensaje para Carlos').inputValue()
  expect(message).toContain(`Has sido añadido como colaborador en la rifa ${raffleName}`)
  const url = message.match(/Enlace de acceso: (\S+)/)?.[1] ?? ''
  const pin = message.match(/PIN: (\d{4})/)?.[1] ?? ''
  expect(url).toMatch(/\/i#[A-Za-z0-9_-]{43}$/)
  expect(pin).toMatch(/^\d{4}$/)

  // ---------------------------------------------------------------------------
  // Carlos, en su propio navegador (sin la sesión de la organizadora)
  // ---------------------------------------------------------------------------
  const carlosContext = await browser.newContext({ ...testInfo.project.use })
  const carlosPage = await carlosContext.newPage()
  await carlosPage.goto(url)

  await expect(carlosPage.getByRole('heading', { name: '¿Eres Carlos?' })).toBeVisible()
  await expect(carlosPage.getByText(/Este acceso está asignado a Carlos/)).toBeVisible()
  // El token desaparece de la barra de direcciones.
  await expect(carlosPage).toHaveURL(/\/i$/)

  const wrongPin = pin === '9999' ? '8888' : '9999'
  await carlosPage.getByLabel('PIN de 4 dígitos').fill(wrongPin)
  await carlosPage.getByRole('button', { name: 'Sí, soy Carlos' }).click()
  await expect(carlosPage.getByText('PIN incorrecto. Te quedan 4 intentos.')).toBeVisible()

  await carlosPage.getByLabel('PIN de 4 dígitos').fill(pin)
  await carlosPage.getByRole('button', { name: 'Sí, soy Carlos' }).click()
  await expect(carlosPage.getByRole('heading', { name: 'Hola, Carlos' })).toBeVisible()
  await expect(carlosPage.getByText('00–49')).toBeVisible()

  // ---------------------------------------------------------------------------
  // La organizadora ve el dispositivo y pausa el acceso
  // ---------------------------------------------------------------------------
  await page.reload()
  await expect(carlos.getByText('Activo en 1 dispositivo')).toBeVisible()
  await carlos.getByRole('button', { name: 'Pausar acceso' }).click()
  await expect(carlos.getByText('Acceso pausado')).toBeVisible()

  await carlosPage.reload()
  await expect(carlosPage.getByRole('heading', { name: 'Tu acceso no está activo' })).toBeVisible()
  await carlosContext.close()

  // ---------------------------------------------------------------------------
  // Limpieza: cerrar y eliminar la rifa de prueba
  // ---------------------------------------------------------------------------
  await page.getByRole('button', { name: 'Cerrar la rifa ahora' }).click()
  await page.getByRole('button', { name: 'Sí, cerrar la rifa' }).click()
  await page.getByRole('button', { name: 'Eliminar la rifa' }).click()
  await page.getByLabel(/para confirmar/).fill(raffleName)
  await page.getByRole('button', { name: 'Eliminar definitivamente' }).click()
  await expect(page.getByRole('heading', { name: 'Mis rifas' })).toBeVisible()
})
