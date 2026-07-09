/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// En GitHub Pages la app vive bajo /<nombre-repo>/; localmente bajo /.
// El workflow de despliegue define DEPLOY_BASE.
const base = process.env.DEPLOY_BASE || '/';

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? 'dev')
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Emerald Dealer Quote',
        short_name: 'ED Quote',
        description: 'Cotizaciones profesionales de joyeria',
        lang: 'es',
        theme_color: '#064e3b',
        background_color: '#fafaf9',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ],
  test: {
    environment: 'node'
  }
});
