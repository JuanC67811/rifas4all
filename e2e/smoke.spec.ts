import { expect, test } from '@playwright/test'

test('la página de inicio presenta la app y lleva a crear cuenta', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Organiza tu rifa')
  await page.getByRole('link', { name: 'Crear cuenta gratis' }).click()
  await expect(page.getByRole('heading', { name: 'Crear cuenta' })).toBeVisible()
})

test('sin sesión, "Mis rifas" redirige a Entrar', async ({ page }) => {
  await page.goto('/rifas')

  await expect(page).toHaveURL(/\/entrar$/)
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
})
