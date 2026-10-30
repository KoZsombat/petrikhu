import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import SiteContentProvider from './lib/SiteContentProvider.tsx'
import LanguageProvider from './i18n/LanguageContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <SiteContentProvider>
          <App />
        </SiteContentProvider>
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>,
)
