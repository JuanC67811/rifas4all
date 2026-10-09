import { expect, test } from '@playwright/test'
import { accessFor, login, openAsCollaborator } from './helpers.ts'

/**
 * Capturas para el README (npm run screenshots). Usan los datos de ejemplo del seed
 * y se guardan en docs/screenshots. No forman parte de la suite de pruebas.
 */
const DIR = 'docs/screenshots'

test.use({ colorScheme: 'light' })

test('capturas del organizador', async ({ page }) => {
  await page.goto('/')
  await page.screenshot({ path: `${DIR}/inicio.png` })

  await login(page)
  await page.getByRole('link', { name: /Canasta Navideña/ }).click()
  await expect(page.getByRole('button', { name: /^Número 00/ })).toBeVisible()
  await page.getByRole('heading', { name: 'Tablero de números' }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${DIR}/tablero.png` })

  await page.getByRole('button', { name: /^Número 07/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.screenshot({ path: `${DIR}/numero.png` })
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click()

  await page.getByRole('tab', { name: 'Resumen' }).click()
  await page.screenshot({ path: `${DIR}/resumen.png` })

  await page.getByRole('tab', { name: 'Accesos' }).click()
  await page
    .getByRole('article')
    .filter({ hasText: 'María' })
    .getByRole('button', { name: 'Compartir acceso' })
    .click()
  await expect(page.getByLabel('Mensaje para María')).toBeVisible()
  await page.getByLabel('Mensaje para María').scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${DIR}/compartir.png` })
})

test('capturas del colaborador', async ({ page, browser }, testInfo) => {
  await login(page)
  await page.getByRole('link', { name: /Canasta Navideña/ }).click()
  const access = await accessFor(page, 'María')

  const preview = await browser.newContext({ ...testInfo.project.use, colorScheme: 'light' })
  const invitation = await preview.newPage()
  await invitation.goto(access.url)
  await expect(invitation.getByRole('heading', { name: '¿Eres María?' })).toBeVisible()
  await invitation.screenshot({ path: `${DIR}/activacion.png` })
  await preview.close()

  const maria = await openAsCollaborator(browser, testInfo, 'María', access)
  await maria.page.getByRole('heading', { name: 'Tablero' }).scrollIntoViewIfNeeded()
  await maria.page.screenshot({ path: `${DIR}/colaborador.png` })
  await maria.context.close()
})

test('captura en modo oscuro', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ ...testInfo.project.use, colorScheme: 'dark' })
  const page = await context.newPage()
  await login(page)
  await page.getByRole('link', { name: /Canasta Navideña/ }).click()
  await expect(page.getByRole('button', { name: /^Número 00/ })).toBeVisible()
  await page.getByRole('heading', { name: 'Tablero de números' }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${DIR}/tablero-oscuro.png` })
  await context.close()
})
