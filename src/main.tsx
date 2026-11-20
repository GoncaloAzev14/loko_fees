import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ConfirmProvider } from './components/Confirm'
import { ToastProvider } from './components/Toast'
import { AuthProvider } from './lib/auth'
import { isConfigured } from './lib/supabase'
import '@fontsource-variable/sora'
import './styles.css'

// Pinch, double-tap and ctrl+wheel zoom are switched off: this is an app, not a document.
// (The viewport tag covers Android; iOS Safari ignores it, hence the gesture handlers.)
const stop = (e: Event) => e.preventDefault()
document.addEventListener('gesturestart', stop)
document.addEventListener('gesturechange', stop)
document.addEventListener('wheel', (e) => e.ctrlKey && e.preventDefault(), { passive: false })
document.addEventListener('touchmove', (e) => e.touches.length > 1 && e.preventDefault(), { passive: false })
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

const queryClient = new QueryClient({
  // offlineFirst: ask even without a connection, so the service worker can answer from what it saved
  // (otherwise a reloaded app offline would wait for the network forever).
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true, networkMode: 'offlineFirst' } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isConfigured ? (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter basename={import.meta.env.BASE_URL}>
            <ToastProvider>
              <ConfirmProvider>
                <App />
              </ConfirmProvider>
            </ToastProvider>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    ) : (
      <main className="setup">
        <h1>Falta configurar</h1>
        <p>
          Defina <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> num ficheiro <code>.env</code> (veja{' '}
          <code>.env.example</code> e o <code>README.md</code>).
        </p>
      </main>
    )}
  </StrictMode>,
)
