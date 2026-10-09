import { expect, test } from '@playwright/test'
import { DEMO, isoDate, login } from './helpers.ts'

test('credenciales incorrectas muestran un mensaje claro', async ({ page }) => {
  await page.goto('/entrar')
  await page.getByLabel('Correo').fill(DEMO.email)
  await page.getByLabel('Contraseña').fill('no-es-la-clave')
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page.getByRole('alert')).toHaveText(/El correo o la contraseña no son correctos/)
})

test('la organizadora crea, edita y elimina una rifa', async ({ page }, testInfo) => {
  // Nombre único por proyecto (móvil y escritorio corren en paralelo).
  const name = `Rifa E2E ${testInfo.project.name} ${Date.now()}`

  await login(page)
  await expect(page.getByRole('link', { name: /Canasta Navideña/ })).toBeVisible()

  // Crear
  await page.getByRole('link', { name: '+ Nueva rifa' }).click()
  await page.getByRole('button', { name: 'Crear rifa' }).click()
  await expect(page.getByLabel('Nombre de la rifa')).toBeFocused()

  await page.getByLabel('Nombre de la rifa').fill(name)
  await page.getByLabel('Precio por número').fill('1 500')
  await page.getByLabel('Fecha del sorteo').fill(isoDate(30))
  await page.getByLabel('Fecha límite de pago').fill(isoDate(25))
  await page.getByRole('button', { name: 'Crear rifa' }).click()

  await expect(page.getByRole('heading', { name })).toBeVisible()
  await expect(page.getByText('Borrador')).toBeVisible()
  await expect(page.getByText(/₡\s?1\s?500 por número/)).toBeVisible()

  // Editar
  await page.getByRole('link', { name: 'Editar datos' }).click()
  await page.getByLabel('Nombre de la rifa').fill(`${name} (editada)`)
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('heading', { name: `${name} (editada)` })).toBeVisible()

  // Eliminar: el botón solo se habilita al escribir el nombre exacto
  await page.getByRole('button', { name: 'Eliminar la rifa' }).click()
  const confirm = page.getByRole('button', { name: 'Eliminar definitivamente' })
  await expect(confirm).toBeDisabled()
  await page.getByLabel(/para confirmar/).fill(`${name} (editada)`)
  await confirm.click()

  await expect(page.getByRole('heading', { name: 'Mis rifas' })).toBeVisible()
  await expect(page.getByRole('link', { name: new RegExp(name) })).toHaveCount(0)
})

test('la rifa activa no ofrece eliminarse sin cerrarla antes', async ({ page }) => {
  await login(page)
  await page.getByRole('link', { name: /Canasta Navideña/ }).click()

  await expect(page.getByRole('heading', { name: 'Colaboradores y accesos' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cerrar la rifa ahora' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Eliminar la rifa' })).toHaveCount(0)
})
