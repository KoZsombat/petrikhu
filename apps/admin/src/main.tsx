import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router'
import './styles.css'
import { App } from './App.tsx'
import { DialogProvider } from './dialog.tsx'
import { SessionProvider } from './session.tsx'

/**
 * A data router (createBrowserRouter), so the editors can block in-app navigation with unsaved changes
 * (useBlocker). One splat route renders the app, whose <Routes> pick the screen.
 */
const router = createBrowserRouter(
  [
    {
      path: '*',
      element: (
        <SessionProvider>
          <DialogProvider>
            <App />
          </DialogProvider>
        </SessionProvider>
      ),
    },
  ],
  { basename: '/admin' },
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
