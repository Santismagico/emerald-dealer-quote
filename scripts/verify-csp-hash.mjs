import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (scripts.length === 0) throw new Error('No se encontró el script inline que protege el arranque.');

for (const script of scripts) {
  const hash = `sha256-${createHash('sha256').update(script[1]).digest('base64')}`;
  if (!html.includes(`'${hash}'`)) throw new Error(`El hash CSP no coincide: ${hash}`);
}
if (html.includes("script-src 'self' 'unsafe-inline'") || html.includes("script-src 'self' 'unsafe-eval'")) {
  throw new Error('La política de scripts contiene una excepción insegura.');
}
if (html.includes('__INLINE_SCRIPT_HASHES__')) throw new Error('Quedó un marcador CSP sin resolver.');

const expectedCloudOrigin = process.env.EXPECT_CLOUD_ORIGIN?.trim();
if (expectedCloudOrigin && !html.includes(`connect-src 'self' https://api.gold-api.com https://open.er-api.com ${expectedCloudOrigin}`)) {
  throw new Error('La CSP final no contiene el origen de Supabase esperado.');
}
if (!expectedCloudOrigin && /connect-src[^;]*\.supabase\.co/.test(html)) {
  throw new Error('El build local incluyó un origen de Supabase sin configuración.');
}

console.log('Hash CSP final verificado.');
