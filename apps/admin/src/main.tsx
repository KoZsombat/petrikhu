import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './styles.css'
import { App } from './App.tsx'
import { SessionProvider } from './session.tsx'
import { DialogProvider } from './dialog.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename="/admin">
      <SessionProvider>
        <DialogProvider>
          <App />
        </DialogProvider>
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
)
