/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // `npm run preview` sirve el build con la misma CSP que producción (public/_headers),
  // para detectar a tiempo cualquier recurso que la política bloquee.
  preview: {
    headers: {
      'Content-Security-Policy':
        readFileSync('public/_headers', 'utf8')
          .match(/Content-Security-Policy: (.+)/)?.[1]
          // En local, Supabase corre en 127.0.0.1 y no en *.supabase.co.
          ?.replace('connect-src ', 'connect-src http://127.0.0.1:54321 ws://127.0.0.1:54321 ') ??
        '',
    },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'supabase/functions/_shared/**/*.test.ts'],
    // Los tests no deben depender de un .env local: se usan valores de prueba.
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx'],
    },
  },
})
