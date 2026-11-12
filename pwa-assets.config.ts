import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

const background = '#0e0e10'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    // Home-screen icons need an opaque background; the logo itself has rounded transparent corners.
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background, fit: 'contain' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background, fit: 'contain' } },
  },
  images: ['public/logo.svg'],
})
