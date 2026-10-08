import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { parseEnv } from './lib/env'
import './index.css'

// Falla al arrancar si la configuración es incorrecta (ver .env.example).
parseEnv(import.meta.env)

const root = document.getElementById('root')
if (!root) {
  throw new Error('No se encontró el elemento #root en index.html')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
