import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './workspace.css'
import './noche-cero.css'
import './simulation-viewport.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
