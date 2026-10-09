import { defineConfig, devices } from '@playwright/test'

// Pruebas end-to-end contra Supabase local (npm run db:start + npm run db:reset).
// Cada flujo corre en un perfil de teléfono y otro de escritorio.
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  // Como mucho 2 pruebas a la vez: cada una crea una rifa en la cuenta de demo, que ya
  // tiene 2, y el límite de la cuenta es 5.
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  // Mobile-first: el proyecto principal emula un teléfono.
  projects: [
    { name: 'movil', use: { ...devices['Pixel 7'] } },
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
