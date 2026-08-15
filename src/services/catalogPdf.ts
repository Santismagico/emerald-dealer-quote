// Documento exclusivo del catálogo (D-079). No comparte el renderer de cotizaciones.

import type { jsPDF } from 'jspdf';
import type { CatalogContent, CatalogJewel, CatalogPiece } from './catalog';

const PAGE_W = 210;
const MARGIN = 20;
const CONTENT_W = 170;
const EMERALD: [number, number, number] = [6, 78, 59];
const GOLD: [number, number, number] = [163, 132, 62];
const INK: [number, number, number] = [23, 33, 28];
const MUTED: [number, number, number] = [122, 114, 104];
const PALE_LINE: [number, number, number] = [222, 216, 204];
const CLOSING_MESSAGE = 'Para reservar una pieza, indícanos su número.';

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('No se pudo leer una imagen.'));
    image.src = dataUrl;
  });
}

async function imageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  const image = await loadImage(dataUrl);
  return { width: image.naturalWidth, height: image.naturalHeight };
}

/** Recorte centrado tipo cubrir, con fondo blanco y salida JPEG. */
export async function cropToSquare(dataUrl: string, targetPx: number): Promise<string> {
  const image = await loadImage(dataUrl);
  const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = (image.naturalWidth - sourceSize) / 2;
  const sourceY = (image.naturalHeight - sourceSize) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = targetPx;
  canvas.height = targetPx;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo preparar una imagen del catálogo.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, targetPx, targetPx);
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    targetPx,
    targetPx
  );
  return canvas.toDataURL('image/jpeg', targetPx >= 1000 ? 0.72 : 0.68);
}

function centeredLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

async function drawCover(doc: jsPDF, content: CatalogContent, logoDataUrl: string): Promise<void> {
  if (logoDataUrl) {
    try {
      const dimensions = await imageDimensions(logoDataUrl);
      const scale = Math.min(40 / dimensions.width, 26 / dimensions.height);
      const width = dimensions.width * scale;
      const height = dimensions.height * scale;
      const format = logoDataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(logoDataUrl, format, (PAGE_W - width) / 2, 62, width, height);
    } catch {
      // Un logo ilegible se omite sin impedir el catálogo.
    }
  }

  doc.setFont('times', 'bold');
  doc.setFontSize(24);
  if (doc.getTextWidth(content.jewelryName) > CONTENT_W) doc.setFontSize(18);
  doc.setTextColor(...EMERALD);
  doc.text(content.jewelryName, PAGE_W / 2, 118, { align: 'center', charSpace: 1.1 });

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(89, 132, 121, 132);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text('CATÁLOGO', PAGE_W / 2, 146, { align: 'center', charSpace: 3.2 });
  doc.setFont('times', 'normal');
  doc.setFontSize(15);
  doc.setTextColor(...INK);
  doc.text(content.periodLine, PAGE_W / 2, 158, { align: 'center' });

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const footerLines = centeredLines(doc, content.footer, 130);
  const startY = 252 - (footerLines.length - 1) * 4.2;
  doc.text(footerLines, PAGE_W / 2, startY, { align: 'center', lineHeightFactor: 1.35 });
}

function trimNameLines(doc: jsPDF, name: string): string[] {
  const lines = doc.splitTextToSize(name, 84) as string[];
  if (lines.length <= 2) return lines;
  const result = lines.slice(0, 2);
  let last = result[1].trimEnd();
  while (last && doc.getTextWidth(`${last}…`) > 84) last = last.slice(0, -1).trimEnd();
  result[1] = `${last}…`;
  return result;
}

async function drawSquarePhoto(
  doc: jsPDF,
  dataUrl: string,
  x: number,
  y: number,
  sizeMm: number,
  targetPx: number
): Promise<void> {
  if (!dataUrl) return;
  try {
    const cropped = await cropToSquare(dataUrl, targetPx);
    doc.addImage(cropped, 'JPEG', x, y, sizeMm, sizeMm);
  } catch {
    // Una foto ilegible se omite sin impedir que la pieza aparezca.
  }
}

async function drawPiece(
  doc: jsPDF,
  piece: CatalogPiece,
  jewel: CatalogJewel,
  yTop: number
): Promise<void> {
  await drawSquarePhoto(doc, jewel.photo, 20, yTop, 76, 1000);
  await Promise.all(jewel.extraPhotos.slice(0, 2).map((photo, index) => (
    drawSquarePhoto(doc, photo, index === 0 ? 20 : 53, yTop + 80, 29, 420)
  )));

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...GOLD);
  doc.text(piece.code, 106, yTop + 6, { charSpace: 1.6 });

  doc.setFont('times', 'normal');
  doc.setFontSize(17);
  doc.setTextColor(...INK);
  const nameLines = trimNameLines(doc, piece.name);
  doc.text(nameLines, 106, yTop + 15, { lineHeightFactor: 1.34 });
  const nameLastY = yTop + 15 + (nameLines.length - 1) * 8;

  const ruleY = nameLastY + 6;
  doc.setDrawColor(...PALE_LINE);
  doc.setLineWidth(0.25);
  doc.line(106, ruleY, 124, ruleY);

  const dataLines = [piece.detailLine, piece.stoneLine].filter(Boolean);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  dataLines.forEach((line, index) => doc.text(line, 106, ruleY + 7 + index * 5));

  if (piece.priceLine) {
    const lastDataY = dataLines.length > 0 ? ruleY + 7 + (dataLines.length - 1) * 5 : ruleY;
    doc.setFont('times', 'normal');
    doc.setFontSize(14);
    doc.setTextColor(...EMERALD);
    doc.text(piece.priceLine, 106, lastDataY + 10);
  }
}

async function drawPiecesPage(
  doc: jsPDF,
  content: CatalogContent,
  jewels: readonly CatalogJewel[],
  startIndex: number,
  pageNumber: number
): Promise<void> {
  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...EMERALD);
  doc.text(content.jewelryName.toUpperCase(), MARGIN, 24, { charSpace: 1.4 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(content.periodLine, PAGE_W - MARGIN, 24, { align: 'right' });
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, 29, PAGE_W - MARGIN, 29);

  await drawPiece(doc, content.pieces[startIndex], jewels[startIndex], 38);
  if (content.pieces[startIndex + 1]) {
    await drawPiece(doc, content.pieces[startIndex + 1], jewels[startIndex + 1], 157);
  }

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const footerLines = centeredLines(doc, content.footer, 150).slice(0, 2);
  doc.text(footerLines, PAGE_W / 2, 283, { align: 'center', lineHeightFactor: 1.25 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(String(pageNumber), PAGE_W - MARGIN, 283, { align: 'right' });
}

function drawBackCover(doc: jsPDF, content: CatalogContent): void {
  doc.setFont('times', 'normal');
  doc.setFontSize(18);
  doc.setTextColor(...EMERALD);
  doc.text(content.jewelryName, PAGE_W / 2, 120, { align: 'center', charSpace: 1.2 });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  content.contactLines.forEach((line, index) => {
    doc.text(line, PAGE_W / 2, 132 + index * 6, { align: 'center' });
  });
  const lastContactY = content.contactLines.length > 0
    ? 132 + (content.contactLines.length - 1) * 6
    : 120;
  const ruleY = lastContactY + 10;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(89, ruleY, 121, ruleY);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(CLOSING_MESSAGE, PAGE_W / 2, ruleY + 12, { align: 'center' });
}

/** El constructor acepta exclusivamente la lista blanca CatalogJewel[]. */
export async function renderCatalogPdf(
  jewels: readonly CatalogJewel[],
  content: CatalogContent,
  logoDataUrl: string
): Promise<jsPDF> {
  if (jewels.length !== content.pieces.length) {
    throw new Error('El contenido del catálogo no coincide con sus piezas.');
  }
  const { jsPDF: JsPdf } = await import('jspdf');
  const doc = new JsPdf({ unit: 'mm', format: 'a4' });
  await drawCover(doc, content, logoDataUrl);
  for (let index = 0, page = 1; index < content.pieces.length; index += 2, page += 1) {
    doc.addPage();
    await drawPiecesPage(doc, content, jewels, index, page);
  }
  doc.addPage();
  drawBackCover(doc, content);
  return doc;
}
