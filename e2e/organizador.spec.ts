import { expect, test } from '@playwright/test'
import { closeAndDelete, isoDate, login } from './helpers.ts'

test('la organizadora vende junto a un colaborador: 50 y 50', async ({ page }, testInfo) => {
  const raffleName = `Rifa E2E organizadora ${testInfo.project.name} ${Date.now()}`

  await login(page)
  await page.getByRole('link', { name: '+ Nueva rifa' }).click()
  await page.getByLabel('Nombre de la rifa').fill(raffleName)
  await page.getByLabel('Precio por número').fill('1000')
  await page.getByLabel('Fecha del sorteo').fill(isoDate(30))
  await page.getByLabel('Fecha límite de pago').fill(isoDate(25))
  await page.getByRole('button', { name: 'Crear rifa' }).click()

  // "Yo también vendo números" viene marcado: sin colaboradores, se queda los 100.
  await expect(page.getByLabel('Yo también vendo números')).toBeChecked()
  await page.getByRole('button', { name: 'Guardar colaboradores' }).click()
  await page.getByRole('button', { name: 'Ver el reparto' }).click()
  await expect(page.getByText(/\(tú\) · 100 números/)).toBeVisible()

  // Con un colaborador, la mitad para cada uno.
  await page.getByRole('button', { name: '+ Agregar colaborador' }).click()
  await page.getByLabel('Nombre', { exact: true }).fill('Carlos')
  await page.getByRole('button', { name: 'Guardar colaboradores' }).click()
  await page.getByRole('button', { name: 'Ver el reparto' }).click()
  await expect(page.getByText(/\(tú\) · 50 números/)).toBeVisible()
  await expect(page.getByText('Carlos · 50 números')).toBeVisible()

  await page.getByRole('button', { name: 'Confirmar reparto y activar la rifa' }).click()
  await page.getByRole('button', { name: 'Sí, confirmar y activar' }).click()

  // En el tablero tiene su propia lista y puede vender cualquier número.
  await expect(page.getByRole('button', { name: 'Mis números (50)' })).toBeVisible()
  await page.getByRole('button', { name: /^Número 00, Disponible, tuyo$/ }).click()
  await expect(page.getByRole('dialog').getByLabel('Nombre del comprador')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click()

  // Su lista no necesita enlace; la de Carlos sí.
  await page.getByRole('tab', { name: 'Accesos' }).click()
  await expect(page.getByText(/No necesita enlace: entras con tu cuenta/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Compartir acceso' })).toHaveCount(1)

  await page.getByRole('tab', { name: 'Tablero' }).click()
  await closeAndDelete(page, raffleName)
})
