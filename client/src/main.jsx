import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/geist'
import '@fontsource/geist-mono'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
