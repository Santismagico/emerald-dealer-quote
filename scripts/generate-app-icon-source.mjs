// Dibuja la pieza maestra del ícono "La gema viva" (D-029) y la guarda en
// assets/branding/app-icon-source.png (1024×1024). Después, `npm run icons`
// produce las versiones instalables. Sin dependencias externas.
//
// La gema es una talla esmeralda con luz desde arriba a la izquierda: cada
// faceta tiene su propio verde, la mesa lleva un gradiente diagonal, y hay
// un destello y una chispa blancos. La piedra ocupa la zona segura de los
// íconos adaptables de Android (todas sus puntas caben en el círculo del 80%).

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const standardOutPath = join(root, 'assets', 'branding', 'app-icon-source.png');
const maskableOutPath = join(root, 'assets', 'branding', 'app-icon-maskable-source.png');
mkdirSync(dirname(standardOutPath), { recursive: true });

const SIZE = 1024;
const UNITS = 150; // el dibujo se define en un lienzo de 150×150
const SS = 3; // muestras por eje (antialiasing 3×3)

// ---------- geometría (coordenadas del lienzo 150×150) ----------

const TILE_RADIUS = 34;
const STANDARD_ICON = { gemCenter: { x: 75, y: 76 }, gemScale: 1.2, roundedTile: true };
// Android puede recortar el icono con circulos, cuadrados redondeados u otras
// formas. Esta version deja la gema dentro del circulo seguro central del 80 %
// y pinta el lienzo completo, sin esquinas transparentes al instalarla.
const MASKABLE_ICON = { gemCenter: { x: 75, y: 75 }, gemScale: 0.9, roundedTile: false };

// Octágonos de la talla esmeralda (coordenadas propias de la gema).
const OUTER = [[-26, -38], [26, -38], [44, -20], [44, 20], [26, 38], [-26, 38], [-44, 20], [-44, -20]];
const TABLE = [[-14, -21], [14, -21], [24, -11], [24, 11], [14, 21], [-14, 21], [-24, 11], [-24, -11]];

// Facetas entre ambos octágonos, con la luz desde arriba a la izquierda.
const FACETS = [
  { pts: [[-26, -38], [26, -38], [14, -21], [-14, -21]], color: [0x5f, 0xd8, 0xa4] },
  { pts: [[26, -38], [44, -20], [24, -11], [14, -21]], color: [0x2f, 0xb0, 0x7c] },
  { pts: [[44, -20], [44, 20], [24, 11], [24, -11]], color: [0x1b, 0x92, 0x65] },
  { pts: [[44, 20], [26, 38], [14, 21], [24, 11]], color: [0x0f, 0x73, 0x50] },
  { pts: [[26, 38], [-26, 38], [-14, 21], [14, 21]], color: [0x0a, 0x5c, 0x40] },
  { pts: [[-26, 38], [-44, 20], [-24, 11], [-14, 21]], color: [0x15, 0x87, 0x5d] },
  { pts: [[-44, 20], [-44, -20], [-24, -11], [-24, 11]], color: [0x41, 0xc4, 0x8f] },
  { pts: [[-44, -20], [-26, -38], [-14, -21], [-24, -11]], color: [0x8c, 0xee, 0xc0] }
];

const TABLE_G0 = [0xc2, 0xf6, 0xdb]; // esquina iluminada
const TABLE_G1 = [0x2f, 0xa8, 0x78]; // esquina profunda

// Destello especular sobre la mesa y chispa de 4 puntas.
const SPECULAR = [[-22, -10], [-4, -20], [8, -20], [-12, 6]];
const SPARKLE = [[-33, -29], [-30.8, -24], [-25.8, -21.8], [-30.8, -19.6], [-33, -14.6], [-35.2, -19.6], [-40.2, -21.8], [-35.2, -24]];

// Aristas (contornos + conectores) y jardín (líneas internas de la mesa).
const EDGES = [];
const ring = (pts) => pts.forEach((p, i) => EDGES.push([p, pts[(i + 1) % pts.length]]));
ring(OUTER);
ring(TABLE);
OUTER.forEach((p, i) => EDGES.push([p, TABLE[i]]));
const GARDEN = [[[-20, -6], [20, -6]], [[-20, 4], [20, 4]]];

// Fondo del tile: gradiente radial esmeralda profundo.
const BG_CENTER = { x: 52.5, y: 37.5 };
const BG_RADIUS = 142.5;
const BG_STOPS = [
  { t: 0, c: [0x11, 0x59, 0x3f] },
  { t: 0.55, c: [0x0a, 0x3d, 0x2b] },
  { t: 1, c: [0x03, 0x23, 0x1a] }
];

// ---------- utilidades ----------

function pointInPolygon(pts, x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToSegment(px, py, [[ax, ay], [bx, by]]) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const ex = ax + t * dx - px;
  const ey = ay + t * dy - py;
  return Math.hypot(ex, ey);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function gradientAt(stops, t) {
  if (t <= stops[0].t) return stops[0].c;
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i].t) {
      const f = (t - stops[i - 1].t) / (stops[i].t - stops[i - 1].t);
      return [0, 1, 2].map((k) => lerp(stops[i - 1].c[k], stops[i].c[k], f));
    }
  }
  return stops[stops.length - 1].c;
}

function insideRoundedTile(x, y) {
  if (x < 0 || y < 0 || x > UNITS || y > UNITS) return false;
  const r = TILE_RADIUS;
  const cx = Math.max(r, Math.min(UNITS - r, x));
  const cy = Math.max(r, Math.min(UNITS - r, y));
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

// Color de UNA muestra (x, y en coordenadas 150×150). Devuelve [r,g,b,a 0..1].
function sample(x, y, icon) {
  if (icon.roundedTile && !insideRoundedTile(x, y)) return [0, 0, 0, 0];

  // Fondo radial.
  const dBg = Math.hypot(x - BG_CENTER.x, y - BG_CENTER.y) / BG_RADIUS;
  let [r, g, b] = gradientAt(BG_STOPS, Math.min(1, dBg));

  // Sombra elíptica bajo la piedra.
  const relativeScale = icon.gemScale / STANDARD_ICON.gemScale;
  const shadowY = icon.gemCenter.y + 42 * relativeScale;
  const sd =
    ((x - icon.gemCenter.x) / (40 * relativeScale)) ** 2 +
    ((y - shadowY) / (8.5 * relativeScale)) ** 2;
  if (sd <= 1) {
    const a = 0.3;
    r *= 1 - a;
    g *= 1 - a;
    b *= 1 - a;
  }

  // Coordenadas de la gema.
  const gx = (x - icon.gemCenter.x) / icon.gemScale;
  const gy = (y - icon.gemCenter.y) / icon.gemScale;

  if (gx >= -46 && gx <= 46 && gy >= -40 && gy <= 40) {
    if (pointInPolygon(TABLE, gx, gy)) {
      // Mesa: gradiente diagonal + jardín.
      const t = Math.max(0, Math.min(1, ((gx + 24) * 48 + (gy + 21) * 42) / (48 * 48 + 42 * 42)));
      r = lerp(TABLE_G0[0], TABLE_G1[0], t);
      g = lerp(TABLE_G0[1], TABLE_G1[1], t);
      b = lerp(TABLE_G0[2], TABLE_G1[2], t);
      for (const seg of GARDEN) {
        if (distToSegment(gx, gy, seg) < 0.5) {
          r = lerp(r, 0x06, 0.28);
          g = lerp(g, 0x5c, 0.28);
          b = lerp(b, 0x40, 0.28);
        }
      }
    } else if (pointInPolygon(OUTER, gx, gy)) {
      for (const f of FACETS) {
        if (pointInPolygon(f.pts, gx, gy)) {
          [r, g, b] = f.color;
          break;
        }
      }
    }

    // Aristas de la talla.
    if (pointInPolygon(OUTER, gx, gy) || distToSegment(gx, gy, EDGES[0]) < 2) {
      for (const seg of EDGES) {
        if (distToSegment(gx, gy, seg) < 0.5) {
          r = lerp(r, 0x03, 0.5);
          g = lerp(g, 0x27, 0.5);
          b = lerp(b, 0x1c, 0.5);
          break;
        }
      }
    }

    // Destello y chispa.
    if (pointInPolygon(SPECULAR, gx, gy)) {
      r = lerp(r, 255, 0.3);
      g = lerp(g, 255, 0.3);
      b = lerp(b, 255, 0.3);
    }
    if (pointInPolygon(SPARKLE, gx, gy)) {
      r = lerp(r, 255, 0.9);
      g = lerp(g, 255, 0.9);
      b = lerp(b, 255, 0.9);
    }
  }

  return [r, g, b, 1];
}

// ---------- render con supermuestreo ----------

const unitsPerPixel = UNITS / SIZE;

function render(icon) {
  const rgba = Buffer.alloc(SIZE * SIZE * 4);
  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) * unitsPerPixel;
          const y = (py + (sy + 0.5) / SS) * unitsPerPixel;
          const [cr, cg, cb, ca] = sample(x, y, icon);
          r += cr * ca;
          g += cg * ca;
          b += cb * ca;
          a += ca;
        }
      }
      const n = SS * SS;
      const idx = (py * SIZE + px) * 4;
      const alpha = a / n;
      rgba[idx] = alpha > 0 ? Math.round(r / a) : 0;
      rgba[idx + 1] = alpha > 0 ? Math.round(g / a) : 0;
      rgba[idx + 2] = alpha > 0 ? Math.round(b / a) : 0;
      rgba[idx + 3] = Math.round(alpha * 255);
    }
  }
  return rgba;
}

// ---------- codificación PNG (idéntica a generate-icons.mjs) ----------

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

const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;
ihdr[9] = 6;
function writePng(outPath, rgba) {
  const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
  for (let y = 0; y < SIZE; y++) {
    raw[y * (SIZE * 4 + 1)] = 0;
    rgba.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
  }
  writeFileSync(
    outPath,
    Buffer.concat([
      signature,
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0))
    ])
  );
  console.log(`OK ${outPath} (${SIZE}x${SIZE})`);
}

writePng(standardOutPath, render(STANDARD_ICON));
writePng(maskableOutPath, render(MASKABLE_ICON));
