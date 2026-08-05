/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, loadEnv, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Inyecta una Content-Security-Policy en el HTML SOLO en producción
 * (en desarrollo rompería el HMR de Vite). Los scripts inline (la red de
 * seguridad de index.html) se permiten por hash, no con 'unsafe-inline'.
 * Únicos destinos de red permitidos: las dos APIs del precio del oro.
 */
export function supabaseConnectOrigin(url: string | undefined): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.origin : '';
  } catch {
    return '';
  }
}

function cspPlugin(cloudOrigin: string): PluginOption {
  const hashPlaceholder = '__INLINE_SCRIPT_HASHES__';
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html: string) {
        const csp = [
          "default-src 'self'",
          `script-src 'self' ${hashPlaceholder}`,
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          `connect-src 'self' https://api.gold-api.com https://open.er-api.com${cloudOrigin ? ` ${cloudOrigin}` : ''}`,
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
    },
    writeBundle(options) {
      const htmlPath = resolve(options.dir ?? 'dist', 'index.html');
      const html = readFileSync(htmlPath, 'utf8');
      const inlineHashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
        (match) => `'sha256-${createHash('sha256').update(match[1]).digest('base64')}'`
      );
      writeFileSync(htmlPath, html.replace(hashPlaceholder, inlineHashes.join(' ')), 'utf8');
    }
  };
}

// En GitHub Pages la app vive bajo /<nombre-repo>/; localmente bajo /.
// El workflow de despliegue define DEPLOY_BASE.
const base = process.env.DEPLOY_BASE || '/';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const cloudOrigin = supabaseConnectOrigin(env.VITE_SUPABASE_URL);
  return {
    base,
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? 'dev')
    },
    plugins: [
      react(),
      tailwindcss(),
      cspPlugin(cloudOrigin),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      workbox: {
        globIgnores: cloudOrigin ? [] : ['**/supabase-*.js']
      },
      manifest: {
        name: 'Emerald Dealer',
        short_name: 'Emerald Dealer',
        description: 'Cotizaciones profesionales de joyeria',
        lang: 'es',
        theme_color: '#0a4d38',
        background_color: '#0a3d2b',
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
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('/node_modules/@supabase/')) return 'supabase';
          }
        }
      }
    },
    test: {
      environment: 'node'
    }
  };
});
