import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// GitHub Pages serves this as a project site at /<repo>/, not the domain
// root, so every absolute asset reference needs that prefix when building
// there. Local dev and any host serving from the root stay at '/'.
const base = process.env.GITHUB_ACTIONS ? '/pdfeditor/' : '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png', 'brand/*.jpg'],
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // precache the app + pdf.js; the OCR engine is big and optional, so
        // cache it on first use instead.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['**/tesseract/**', '**/pdfjs/**'],
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /\/tesseract\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'redline-ocr',
              expiration: { maxEntries: 12 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\/pdfjs\/.*/,
            handler: 'CacheFirst',
            options: { cacheName: 'redline-pdfjs', expiration: { maxEntries: 60 } },
          },
        ],
      },
      manifest: {
        name: 'Redline — Xtracom Solutions',
        short_name: 'Redline',
        description:
          'Read, mark up, fill, sign and redact PDFs. Everything stays on your device.',
        theme_color: '#16191d',
        background_color: '#16191d',
        display: 'standalone',
        orientation: 'any',
        start_url: base,
        scope: base,
        icons: [
          { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
          {
            src: `${base}icons/icon-512-maskable.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        // Register as a PDF handler where the platform allows it
        file_handlers: [
          {
            action: base,
            accept: { 'application/pdf': ['.pdf'] },
          },
        ],
      },
    }),
  ],
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    // pdfjs ships its own worker; let Vite pre-bundle the main entry
    include: ['pdfjs-dist', 'pdf-lib', '@pdf-lib/fontkit'],
  },
})
