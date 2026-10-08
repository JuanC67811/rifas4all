import { expect, test } from '@playwright/test'

test('la app carga y muestra el encabezado', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1, name: 'Rifas4All' })).toBeVisible()
  await expect(page.getByRole('listitem').first()).toHaveText('00')
})
