import { expect, test } from '@playwright/test'
import {
  accessFor,
  closeAndDelete,
  createActiveRaffle,
  login,
  openAsCollaborator,
} from './helpers.ts'

test('ventas y pagos en tiempo real entre colaborador y organizadora', async ({
  page,
  browser,
}, testInfo) => {
  const raffleName = `Rifa E2E ventas ${testInfo.project.name} ${Date.now()}`

  await login(page)
  await createActiveRaffle(page, raffleName, [{ name: 'Carlos' }, { name: 'María' }])
  const carlos = await openAsCollaborator(
    browser,
    testInfo,
    'Carlos',
    await accessFor(page, 'Carlos'),
  )

  // Carlos ve primero sus números (00–49).
  await expect(carlos.page.getByRole('button', { name: 'Mis números (50)' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  // ---------------------------------------------------------------------------
  // Carlos vende el 07
  // ---------------------------------------------------------------------------
  await carlos.page.getByRole('button', { name: /^Número 07, Disponible, tuyo$/ }).click()
  const sheet = carlos.page.getByRole('dialog', { name: 'Número 07' })
  await sheet.getByRole('button', { name: 'Vendido, pendiente de pago' }).click()
  await expect(sheet.getByLabel('Nombre del comprador')).toHaveAccessibleDescription(
    'Escribe el nombre del comprador.',
  )

  await sheet.getByLabel('Nombre del comprador').fill('Ana Mora')
  await sheet.getByLabel('Teléfono').fill('7000 1111')
  await sheet.getByRole('button', { name: 'Vendido, pendiente de pago' }).click()
  await expect(sheet.getByText('Guardado.')).toBeVisible()
  await expect(sheet.getByText('Ana Mora')).toBeVisible()
  await sheet.getByRole('button', { name: 'Cerrar' }).click()

  // El cobro pendiente aparece con su recordatorio listo para copiar.
  await expect(carlos.page.getByRole('heading', { name: /Por cobrar \(1\)/ })).toBeVisible()
  await expect(carlos.page.getByRole('button', { name: 'Copiar recordatorio' })).toBeVisible()

  // La organizadora lo ve sin recargar (tiempo real).
  await expect(
    page.getByRole('button', { name: 'Número 07, Pendiente de pago, de Carlos' }),
  ).toBeVisible({ timeout: 10_000 })

  // ---------------------------------------------------------------------------
  // La organizadora confirma el pago; Carlos lo ve en vivo
  // ---------------------------------------------------------------------------
  await page.getByRole('button', { name: 'Número 07, Pendiente de pago, de Carlos' }).click()
  const organizerSheet = page.getByRole('dialog', { name: 'Número 07' })
  await expect(organizerSheet.getByText('Ana Mora')).toBeVisible()
  await organizerSheet.getByRole('button', { name: 'Marcar como pagado' }).click()
  await expect(organizerSheet.getByText('Guardado.')).toBeVisible()
  await organizerSheet.getByRole('button', { name: 'Cerrar' }).click()

  await expect(carlos.page.getByRole('button', { name: 'Número 07, Pagado, tuyo' })).toBeVisible({
    timeout: 10_000,
  })
  await expect(carlos.page.getByText(/Recaudado por ti\s*₡\s?1\s?000/)).toBeVisible()

  // ---------------------------------------------------------------------------
  // Revertir el pago exige motivo
  // ---------------------------------------------------------------------------
  await carlos.page.getByRole('button', { name: 'Número 07, Pagado, tuyo' }).click()
  const revert = carlos.page.getByRole('dialog', { name: 'Número 07' })
  await revert.getByRole('button', { name: 'Revertir el pago' }).click()
  await revert.getByRole('button', { name: 'Sí, revertir el pago' }).click()
  await expect(revert.getByLabel('Motivo')).toHaveAccessibleDescription(/Escribe el motivo/)
  await revert.getByLabel('Motivo').fill('Lo marqué por error')
  await revert.getByRole('button', { name: 'Sí, revertir el pago' }).click()
  await expect(revert.getByText(/Pendiente de pago/)).toBeVisible()
  await revert.getByRole('button', { name: 'Cerrar' }).click()

  // ---------------------------------------------------------------------------
  // Carlos no puede tocar números de María ni ver sus compradores
  // ---------------------------------------------------------------------------
  await carlos.page.getByRole('button', { name: /^Todos/ }).click()
  await carlos.page.getByRole('button', { name: 'Número 60, Disponible, de María' }).click()
  const other = carlos.page.getByRole('dialog', { name: 'Número 60' })
  await expect(other.getByText('Este número es de María.')).toBeVisible()
  await expect(other.getByLabel('Nombre del comprador')).toHaveCount(0)
  await other.getByRole('button', { name: 'Cerrar' }).click()

  await carlos.context.close()
  await page.reload()
  await closeAndDelete(page, raffleName)
})
