import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'fonts/*.woff2'],
      workbox: {
        // pdf.js worker, tesseract wasm/lang data can be large
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,wasm}'],
        navigateFallbackDenylist: [/^\/api/],
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
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        // Register as a PDF handler where the platform allows it
        file_handlers: [
          {
            action: '/',
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
