// Genera los iconos PWA (pwa-192.png, pwa-512.png, apple-touch-icon.png)
// sin dependencias externas: escribe PNG válidos usando zlib de Node.
// Diseño: fondo verde esmeralda con una gema de talla esmeralda (octágono).

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public');
mkdirSync(outDir, { recursive: true });

// ---------- Codificador PNG mínimo ----------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([len, typeBytes, data, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filtro None
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ---------- Dibujo de la gema ----------
const BG = [6, 60, 47]; // verde esmeralda oscuro
const GEM_OUTER = [16, 150, 105];
const GEM_INNER = [110, 231, 183];

/** ¿El punto (x, y) cae dentro de un octágono tipo "talla esmeralda"? */
function inOctagon(x, y, cx, cy, halfW, halfH, cut) {
  const dx = Math.abs(x - cx);
  const dy = Math.abs(y - cy);
  if (dx > halfW || dy > halfH) return false;
  return dx / halfW + dy / halfH <= 1 + (1 - cut);
}

function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const outerW = size * 0.30;
  const outerH = size * 0.34;
  const innerW = outerW * 0.62;
  const innerH = outerH * 0.62;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Supermuestreo 2x2 para suavizar bordes.
      let r = 0;
      let g = 0;
      let b = 0;
      for (const [ox, oy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        const px = x + ox;
        const py = y + oy;
        let color = BG;
        if (inOctagon(px, py, cx, cy, innerW, innerH, 0.55)) color = GEM_INNER;
        else if (inOctagon(px, py, cx, cy, outerW, outerH, 0.55)) color = GEM_OUTER;
        r += color[0];
        g += color[1];
        b += color[2];
      }
      const i = (y * size + x) * 4;
      rgba[i] = Math.round(r / 4);
      rgba[i + 1] = Math.round(g / 4);
      rgba[i + 2] = Math.round(b / 4);
      rgba[i + 3] = 255;
    }
  }
  return encodePng(size, size, rgba);
}

const targets = [
  ['pwa-192.png', 192],
  ['pwa-512.png', 512],
  ['apple-touch-icon.png', 180]
];

for (const [name, size] of targets) {
  writeFileSync(join(outDir, name), drawIcon(size));
  console.log(`✔ public/${name} (${size}x${size})`);
}
