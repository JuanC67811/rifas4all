import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { accessFor, login, openAsCollaborator } from './helpers.ts'

/**
 * Revisión automática de accesibilidad (WCAG 2.1 A y AA) con axe-core en las
 * pantallas principales, en tema claro y oscuro. No reemplaza la prueba manual
 * con lector de pantalla, pero detecta contraste, etiquetas y roles incorrectos.
 */
async function expectNoViolations(page: Page, context: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const summary = results.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.nodes
        .slice(0, 3)
        .map((node) => node.target.join(' '))
        .join(' | ')}`,
  )
  expect(summary, `Violaciones en ${context}`).toEqual([])
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`tema ${colorScheme === 'light' ? 'claro' : 'oscuro'}`, () => {
    test.use({ colorScheme })

    test('páginas públicas', async ({ page }) => {
      for (const path of ['/', '/entrar', '/registro', '/recuperar', '/privacidad']) {
        await page.goto(path)
        await expect(page.locator('main')).toBeVisible()
        await expectNoViolations(page, path)
      }
    })

    test('organizador: mis rifas, panel con pestañas y panel inferior', async ({ page }) => {
      await login(page)
      await expectNoViolations(page, 'Mis rifas')

      await page.getByRole('link', { name: /Canasta Navideña/ }).click()
      await expect(page.getByRole('tab', { name: 'Tablero' })).toBeVisible()
      await expect(page.getByRole('button', { name: /^Número 00/ })).toBeVisible()
      await expectNoViolations(page, 'Tablero')

      for (const tab of ['Resumen', 'Colaboradores', 'Actividad']) {
        await page.getByRole('tab', { name: tab }).click()
        await expect(page.getByRole('tabpanel')).toBeVisible()
        await expectNoViolations(page, tab)
      }

      await page.getByRole('tab', { name: 'Tablero' }).click()
      await page.getByRole('button', { name: /^Número 03/ }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await expectNoViolations(page, 'panel del número 03')
    })

    test('colaborador: activación y su lista', async ({ page, browser }, testInfo) => {
      await login(page)
      await page.getByRole('link', { name: /Canasta Navideña/ }).click()
      const access = await accessFor(page, 'María')

      const maria = await browser.newContext({ ...testInfo.project.use, colorScheme })
      const invitation = await maria.newPage()
      await invitation.goto(access.url)
      await expect(invitation.getByRole('heading', { name: '¿Eres María?' })).toBeVisible()
      await expectNoViolations(invitation, 'activación')
      await maria.close()

      const collaborator = await openAsCollaborator(browser, testInfo, 'María', access)
      await expectNoViolations(collaborator.page, 'lista del colaborador')
      await collaborator.context.close()
    })
  })
}
