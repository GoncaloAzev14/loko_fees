import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * A strict content-security policy for the published site: the page may run only its own scripts and
 * talk only to itself and to the Supabase project, so injected script could neither run nor send
 * anything out. GitHub Pages cannot send headers, so it goes in as a meta tag, first in <head>.
 * Build only: the dev server needs inline scripts for hot reloading.
 */
function contentSecurityPolicy(supabaseUrl: string | undefined): Plugin {
  const connect = ["'self'"]
  try {
    const { origin, host } = new URL(supabaseUrl ?? '')
    connect.push(origin, `wss://${host}`)
  } catch {
    /* no valid URL: only the site itself */
  }
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'", // React sets some styles inline
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connect.join(' ')}`,
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
  return {
    name: 'content-security-policy',
    apply: 'build',
    // right after the charset tag (which must stay among the first bytes), and before any script
    transformIndexHtml: (html) => html.replace(/(<meta charset[^>]*>)/i, `$1\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`),
  }
}

// GitHub Pages serves project sites under /<repo>/; the deploy workflow sets BASE_PATH.
export default defineConfig(({ mode }) => ({
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    contentSecurityPolicy(loadEnv(mode, process.cwd(), 'VITE_').VITE_SUPABASE_URL),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'FC Lokomotiv',
        short_name: 'FC Lokomotiv',
        description: 'Multas e caixa do Lokomotiv',
        lang: 'pt-PT',
        theme_color: '#0e0e10',
        background_color: '#050505',
        display: 'standalone',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Let the app be opened and read offline: keep the last data seen.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/rest/v1/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-reads',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
}))
