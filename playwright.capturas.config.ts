import { defineConfig, devices } from '@playwright/test'

// Configuración solo para generar las capturas del README (npm run screenshots).
export default defineConfig({
  testDir: './e2e',
  testMatch: 'capturas.ts',
  globalSetup: './e2e/global-setup.ts',
  workers: 1,
  reporter: 'list',
  use: { ...devices['Pixel 7'], baseURL: 'http://localhost:5173' },
  webServer: { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true },
})
