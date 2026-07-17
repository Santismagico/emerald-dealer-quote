// Genera todos los iconos instalables desde la pieza maestra de marca.
// No requiere dependencias externas: decodifica, redimensiona y escribe PNG con Node.

import { deflateSync, inflateSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = join(root, 'assets', 'branding', 'app-icon-source.png');
const outDir = join(root, 'public');
mkdirSync(outDir, { recursive: true });

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
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function decodePng(path) {
  const png = readFileSync(path);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!png.subarray(0, 8).equals(signature)) throw new Error('La pieza maestra no es un PNG válido.');

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
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
      interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += length + 12;
  }

  if (bitDepth !== 8 || ![2, 6].includes(colorType) || interlace !== 0) {
    throw new Error('La pieza maestra debe ser PNG RGB/RGBA de 8 bits y sin entrelazado.');
  }

  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const inflated = inflateSync(Buffer.concat(idat));
  const pixels = Buffer.alloc(width * height * channels);

  for (let y = 0; y < height; y++) {
    const filter = inflated[y * (stride + 1)];
    const rowStart = y * stride;
    const rawStart = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? pixels[rowStart + x - channels] : 0;
      const up = y > 0 ? pixels[rowStart - stride + x] : 0;
      const upperLeft = y > 0 && x >= channels ? pixels[rowStart - stride + x - channels] : 0;
      const value = inflated[rawStart + x];
      if (filter === 0) pixels[rowStart + x] = value;
      else if (filter === 1) pixels[rowStart + x] = (value + left) & 255;
      else if (filter === 2) pixels[rowStart + x] = (value + up) & 255;
      else if (filter === 3) pixels[rowStart + x] = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) pixels[rowStart + x] = (value + paeth(left, up, upperLeft)) & 255;
      else throw new Error(`Filtro PNG no compatible: ${filter}`);
    }
  }

  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0, j = 0; i < pixels.length; i += channels, j += 4) {
    rgba[j] = pixels[i];
    rgba[j + 1] = pixels[i + 1];
    rgba[j + 2] = pixels[i + 2];
    rgba[j + 3] = channels === 4 ? pixels[i + 3] : 255;
  }
  return { width, height, rgba };
}

function sampleBilinear(source, x, y, channel) {
  const x0 = Math.max(0, Math.min(source.width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(source.height - 1, Math.floor(y)));
  const x1 = Math.min(source.width - 1, x0 + 1);
  const y1 = Math.min(source.height - 1, y0 + 1);
  const tx = Math.max(0, Math.min(1, x - x0));
  const ty = Math.max(0, Math.min(1, y - y0));
  const at = (px, py) => source.rgba[(py * source.width + px) * 4 + channel];
  const top = at(x0, y0) * (1 - tx) + at(x1, y0) * tx;
  const bottom = at(x0, y1) * (1 - tx) + at(x1, y1) * tx;
  return top * (1 - ty) + bottom * ty;
}

function resizeSquare(source, size) {
  if (source.width !== source.height) throw new Error('La pieza maestra del icono debe ser cuadrada.');
  const rgba = Buffer.alloc(size * size * 4);
  const samples = 3;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      for (let channel = 0; channel < 4; channel++) {
        let sum = 0;
        for (let sy = 0; sy < samples; sy++) {
          for (let sx = 0; sx < samples; sx++) {
            const sourceX = ((x + (sx + 0.5) / samples) * source.width) / size - 0.5;
            const sourceY = ((y + (sy + 0.5) / samples) * source.height) / size - 0.5;
            sum += sampleBilinear(source, sourceX, sourceY, channel);
          }
        }
        rgba[(y * size + x) * 4 + channel] = Math.round(sum / (samples * samples));
      }
    }
  }
  return encodePng(size, size, rgba);
}

const source = decodePng(sourcePath);
const targets = [
  ['pwa-192.png', 192],
  ['pwa-512.png', 512],
  ['pwa-maskable-512.png', 512],
  ['apple-touch-icon.png', 180]
];

for (const [name, size] of targets) {
  writeFileSync(join(outDir, name), resizeSquare(source, size));
  console.log(`✔ public/${name} (${size}x${size})`);
}
