import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      pwaAssets: { config: true },
      manifest: {
        name: 'Loko Fees',
        short_name: 'Loko Fees',
        description: 'Multas e caixa do Lokomotiv',
        lang: 'pt-PT',
        theme_color: '#0e0e10',
        background_color: '#0e0e10',
        display: 'standalone',
        start_url: '/',
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
})
