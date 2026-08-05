import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = join(root, 'dist', 'assets');
const serviceWorker = readFileSync(join(root, 'dist', 'sw.js'), 'utf8');
const html = readFileSync(join(root, 'dist', 'index.html'), 'utf8');
const expectedConnect = "connect-src 'self' https://api.gold-api.com https://open.er-api.com";

const cloudAssets = readdirSync(assetsDir)
  .filter((name) => name.endsWith('.js'))
  .filter((name) => /GoTrueClient|SupabaseClient|PostgrestClient|RealtimeClient/.test(
    readFileSync(join(assetsDir, name), 'utf8')
  ));

if (cloudAssets.length === 0) {
  throw new Error('No se pudo identificar el archivo de Supabase en la compilación.');
}
for (const asset of cloudAssets) {
  if (serviceWorker.includes(`assets/${asset}`)) {
    throw new Error(`La compilación pública precarga Supabase: ${asset}`);
  }
}
if (!html.includes(`${expectedConnect}; manifest-src`)) {
  throw new Error('La CSP pública no conserva exactamente los destinos autorizados.');
}

console.log('Compilación pública sin Supabase en precarga y CSP verificada.');
