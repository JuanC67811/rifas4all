import { defineConfig, devices } from '@playwright/test'

// Pruebas end-to-end. En la Fase 1 solo hay una prueba de humo;
// los flujos reales (creador + colaborador en dos navegadores) llegan en fases posteriores.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
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
