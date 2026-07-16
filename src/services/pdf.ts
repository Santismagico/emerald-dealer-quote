// Renderizado de PDF con jsPDF a partir del contenido puro de pdfContent.ts.
// jsPDF se eligió por ser estable, funcionar 100% offline en el navegador
// y no requerir servidor. Ver DECISIONS.md.

import type { jsPDF } from 'jspdf';
import type { Quote, Settings } from '../types';
import type { CalcResult } from '../calc/engine';
import { buildClientPdfContent, buildInternalPdfContent, type PdfContent } from './pdfContent';

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;

const EMERALD: [number, number, number] = [6, 78, 59];
const GOLD: [number, number, number] = [163, 132, 62];
const GRAY: [number, number, number] = [110, 110, 110];
const DARK: [number, number, number] = [30, 30, 30];

interface RenderState {
  doc: jsPDF;
  y: number;
}

function ensureSpace(state: RenderState, needed: number): void {
  if (state.y + needed > PAGE_H - MARGIN - 10) {
    state.doc.addPage();
    state.y = MARGIN;
  }
}

function imageFormat(dataUrl: string): 'PNG' | 'JPEG' {
  return dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
}

function loadImageSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error('No se pudo leer una imagen.'));
    img.src = dataUrl;
  });
}

async function renderHeader(state: RenderState, content: PdfContent, logoDataUrl: string): Promise<void> {
  const { doc } = state;
  let textX = MARGIN;

  if (logoDataUrl && !content.internal) {
    try {
      const size = await loadImageSize(logoDataUrl);
      const maxH = 18;
      const maxW = 30;
      const scale = Math.min(maxW / size.w, maxH / size.h);
      const w = size.w * scale;
      const h = size.h * scale;
      doc.addImage(logoDataUrl, imageFormat(logoDataUrl), MARGIN, state.y, w, h);
      textX = MARGIN + w + 5;
    } catch {
      // Si el logo falla, seguimos sin él.
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...EMERALD);
  doc.text(content.jewelryName, textX, state.y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  let cy = state.y + 11;
  for (const line of content.contactLines) {
    doc.text(line, textX, cy);
    cy += 4;
  }

  // Bloque derecho: título, número y fecha.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...DARK);
  doc.text(content.docTitle, PAGE_W - MARGIN, state.y + 6, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  // El Cierre del día no tiene número: la línea se omite si viene vacía.
  if (content.quoteNumber) {
    doc.text(`N.º ${content.quoteNumber}`, PAGE_W - MARGIN, state.y + 12, { align: 'right' });
  }
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(content.dateLine, PAGE_W - MARGIN, state.y + 17, { align: 'right' });

  state.y = Math.max(cy, state.y + 20) + 3;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, state.y, PAGE_W - MARGIN, state.y);
  state.y += 7;
}

function renderSections(state: RenderState, content: PdfContent): void {
  const { doc } = state;
  for (const section of content.sections) {
    ensureSpace(state, 14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...EMERALD);
    doc.text(section.title.toUpperCase(), MARGIN, state.y);
    state.y += 6;

    doc.setFontSize(9.5);
    for (const [label, value] of section.rows ?? []) {
      const valueLines = doc.splitTextToSize(value, CONTENT_W - 55) as string[];
      ensureSpace(state, valueLines.length * 4.5 + 2);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY);
      doc.text(label, MARGIN, state.y);
      doc.setTextColor(...DARK);
      doc.text(valueLines, MARGIN + 55, state.y);
      state.y += valueLines.length * 4.5 + 1.5;
    }

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK);
    for (const paragraph of section.paragraphs ?? []) {
      const lines = doc.splitTextToSize(paragraph, CONTENT_W) as string[];
      ensureSpace(state, lines.length * 4.5 + 2);
      doc.text(lines, MARGIN, state.y);
      state.y += lines.length * 4.5 + 1.5;
    }
    state.y += 4;
  }
}

async function renderImages(state: RenderState, images: string[]): Promise<void> {
  if (images.length === 0) return;
  const { doc } = state;
  const thumb = 38;
  const gap = 5;
  ensureSpace(state, thumb + 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...EMERALD);
  doc.text('IMÁGENES DE REFERENCIA', MARGIN, state.y);
  state.y += 5;

  let x = MARGIN;
  let rowH = 0;
  for (const dataUrl of images) {
    try {
      const size = await loadImageSize(dataUrl);
      const scale = Math.min(thumb / size.w, thumb / size.h);
      const w = size.w * scale;
      const h = size.h * scale;
      if (x + w > PAGE_W - MARGIN) {
        x = MARGIN;
        state.y += rowH + gap;
        rowH = 0;
        ensureSpace(state, thumb);
      }
      doc.addImage(dataUrl, imageFormat(dataUrl), x, state.y, w, h);
      x += w + gap;
      rowH = Math.max(rowH, h);
    } catch {
      // Imagen ilegible: se omite sin romper el PDF.
    }
  }
  state.y += rowH + 8;
}

function renderTotals(state: RenderState, content: PdfContent): void {
  const { doc } = state;
  const boxW = 80;
  const boxX = PAGE_W - MARGIN - boxW;
  const rows = content.totals.length;
  const boxH = rows * 5.5 + 13;
  ensureSpace(state, boxH + 4);

  doc.setFontSize(9.5);
  let ty = state.y;
  for (const [label, value] of content.totals) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(label, boxX, ty);
    doc.setTextColor(...DARK);
    doc.text(value, PAGE_W - MARGIN, ty, { align: 'right' });
    ty += 5.5;
  }

  doc.setFillColor(...EMERALD);
  doc.roundedRect(boxX - 4, ty - 4, boxW + 4 + 4, 11, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(content.totalLine[0], boxX, ty + 3);
  doc.text(content.totalLine[1], PAGE_W - MARGIN, ty + 3, { align: 'right' });
  state.y = ty + 14;
}

function renderFooter(doc: jsPDF, content: PdfContent): void {
  const pages = doc.getNumberOfPages();
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  // El mensaje comercial puede ocupar varias líneas: se ajusta al ancho útil.
  const lines = doc.splitTextToSize(content.footer, CONTENT_W - 14) as string[];
  const startY = PAGE_H - 8 - (lines.length - 1) * 3.8;
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY);
    doc.text(lines, PAGE_W / 2, startY, { align: 'center' });
    if (pages > 1) {
      doc.text(`${i}/${pages}`, PAGE_W - MARGIN, PAGE_H - 8, { align: 'right' });
    }
  }
}

async function renderPdf(content: PdfContent, images: string[], logoDataUrl: string): Promise<jsPDF> {
  // jsPDF se carga bajo demanda: no pesa en la carga inicial de la app.
  const { jsPDF: JsPdf } = await import('jspdf');
  const doc = new JsPdf({ unit: 'mm', format: 'a4' });
  const state: RenderState = { doc, y: MARGIN };
  await renderHeader(state, content, logoDataUrl);
  renderSections(state, content);
  await renderImages(state, images);
  renderTotals(state, content);
  renderFooter(doc, content);
  return doc;
}

/** Única fuente de contenido permitida para descargar o compartir el PDF cliente. */
export function getClientPdfContent(quote: Quote, calc: CalcResult, settings: Settings): PdfContent {
  return buildClientPdfContent(quote, calc, settings);
}

function safeFilePart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function clientPdfFileName(quoteNumber: string): string {
  return `Cotizacion-${safeFilePart(quoteNumber) || 'Sin-numero'}.pdf`;
}

/** Genera el PDF cliente una sola vez como Blob reutilizable. */
export async function createClientPdfBlob(quote: Quote, calc: CalcResult, settings: Settings): Promise<Blob> {
  const content = getClientPdfContent(quote, calc, settings);
  const doc = await renderPdf(content, quote.images, settings.logoDataUrl);
  const blob = doc.output('blob');
  return blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
}

/** Construye el archivo exacto que puede descargarse o entregarse a Web Share. */
export async function createClientPdfFile(quote: Quote, calc: CalcResult, settings: Settings): Promise<File> {
  const blob = await createClientPdfBlob(quote, calc, settings);
  return new File([blob], clientPdfFileName(quote.number), { type: 'application/pdf' });
}

export function downloadPdfFile(file: File): void {
  const url = URL.createObjectURL(file);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Genera y descarga el mismo archivo PDF que se usa para compartir. */
export async function downloadClientPdf(
  quote: Quote,
  calc: CalcResult,
  settings: Settings,
  download: (file: File) => void = downloadPdfFile
): Promise<void> {
  download(await createClientPdfFile(quote, calc, settings));
}

/** Genera y descarga el PDF interno (confidencial). */
export async function downloadInternalPdf(quote: Quote, calc: CalcResult, settings: Settings): Promise<void> {
  const content = buildInternalPdfContent(quote, calc, settings);
  const doc = await renderPdf(content, quote.images, '');
  doc.save(`Interno-${quote.number}.pdf`);
}

/**
 * Genera y descarga el PDF interno del Cierre del día. SOLO descarga directa:
 * este documento nunca pasa por Web Share ni WhatsApp (D-020/D-024).
 */
export async function downloadDailyReportPdf(content: PdfContent, day: string): Promise<void> {
  const doc = await renderPdf(content, [], '');
  doc.save(`Cierre-del-dia-${safeFilePart(day) || 'sin-fecha'}.pdf`);
}
