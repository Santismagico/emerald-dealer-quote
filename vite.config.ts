/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Inyecta una Content-Security-Policy en el HTML SOLO en producción
 * (en desarrollo rompería el HMR de Vite). Los scripts inline (la red de
 * seguridad de index.html) se permiten por hash, no con 'unsafe-inline'.
 * Únicos destinos de red permitidos: las dos APIs del precio del oro.
 */
function cspPlugin(): PluginOption {
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html: string) {
        const inlineHashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
          (m) => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`
        );
        const csp = [
          "default-src 'self'",
          `script-src 'self' ${inlineHashes.join(' ')}`.trim(),
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "connect-src 'self' https://api.gold-api.com https://open.er-api.com",
          "manifest-src 'self'",
          "worker-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'"
        ].join('; ');
        return html.replace(
          '<head>',
          `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`
        );
      }
    }
  };
}

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
    cspPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Emerald Dealer Quote',
        short_name: 'ED Quote',
        description: 'Cotizaciones profesionales de joyeria',
        lang: 'es',
        theme_color: '#031b15',
        background_color: '#031b15',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ],
  test: {
    environment: 'node'
  }
});
