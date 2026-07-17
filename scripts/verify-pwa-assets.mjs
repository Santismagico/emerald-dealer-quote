// Verifica que los iconos publicados conserven dimensiones, opacidad y
// configuracion PWA correctas. Solo usa modulos incluidos en Node.

import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readGeneratedPng(relativePath) {
  const png = readFileSync(join(root, relativePath));
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert(png.subarray(0, 8).equals(signature), `${relativePath} no es un PNG valido.`);

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += length + 12;
  }

  assert(bitDepth === 8 && colorType === 6, `${relativePath} debe ser RGBA de 8 bits.`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4 + 1;
  assert(raw.length === height * stride, `${relativePath} tiene datos incompletos.`);
  let minAlpha = 255;
  let maxAlpha = 0;
  for (let y = 0; y < height; y++) {
    assert(raw[y * stride] === 0, `${relativePath} usa un filtro inesperado.`);
    for (let x = 0; x < width; x++) {
      const alpha = raw[y * stride + 1 + x * 4 + 3];
      minAlpha = Math.min(minAlpha, alpha);
      maxAlpha = Math.max(maxAlpha, alpha);
    }
  }
  return {
    width,
    height,
    minAlpha,
    maxAlpha,
    hash: createHash('sha256').update(png).digest('hex')
  };
}

const expected = [
  ['public/pwa-192.png', 192],
  ['public/pwa-512.png', 512],
  ['public/pwa-maskable-512.png', 512],
  ['public/apple-touch-icon.png', 180]
];
const assets = new Map();
for (const [path, size] of expected) {
  const info = readGeneratedPng(path);
  assert(info.width === size && info.height === size, `${path} debe medir ${size}x${size}.`);
  assets.set(path, info);
}

assert(
  assets.get('public/pwa-512.png').minAlpha === 0,
  'El icono normal debe conservar esquinas transparentes.'
);
assert(
  assets.get('public/pwa-maskable-512.png').minAlpha === 255,
  'El icono maskable debe tener un fondo completamente opaco.'
);
assert(
  assets.get('public/apple-touch-icon.png').minAlpha === 255,
  'El icono de Apple debe tener un fondo completamente opaco.'
);
assert(
  assets.get('public/pwa-512.png').hash !== assets.get('public/pwa-maskable-512.png').hash,
  'El icono maskable debe ser distinto al icono normal.'
);

const generator = readFileSync(join(root, 'scripts', 'generate-app-icon-source.mjs'), 'utf8');
const scaleMatch = generator.match(/MASKABLE_ICON\s*=\s*\{[\s\S]*?gemScale:\s*([\d.]+)/);
assert(scaleMatch, 'No se encontro la escala segura del icono maskable.');
const maskableScale = Number(scaleMatch[1]);
const safeRadius = 150 * 0.4;
const gemOuterRadius = Math.hypot(44, 38) * maskableScale;
assert(gemOuterRadius <= safeRadius, 'La gema sale de la zona segura maskable de Android.');

const viteConfig = readFileSync(join(root, 'vite.config.ts'), 'utf8');
assert(
  /pwa-maskable-512\.png[\s\S]*purpose:\s*'maskable'/.test(viteConfig),
  'El manifiesto debe declarar el icono maskable.'
);
assert(
  /background_color:\s*'#0a3d2b'/.test(viteConfig),
  'El arranque PWA debe usar el fondo esmeralda de marca.'
);

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
assert(
  packageJson.scripts.icons.includes('generate-app-icon-source.mjs') &&
    packageJson.scripts.icons.indexOf('generate-app-icon-source.mjs') <
      packageJson.scripts.icons.indexOf('generate-icons.mjs'),
  'npm run icons debe generar primero las piezas maestras.'
);

console.log('Iconos y configuracion PWA verificados.');
