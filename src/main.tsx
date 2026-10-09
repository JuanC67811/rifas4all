import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
// Inter variable servida desde la app (la CSP no permite fuentes externas).
import '@fontsource-variable/inter'
import './index.css'

const root = document.getElementById('root')
if (!root) {
  throw new Error('No se encontró el elemento #root en index.html')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
