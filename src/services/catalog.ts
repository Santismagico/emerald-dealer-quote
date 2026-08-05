// Catálogo para cliente (D-065): se construye desde una lista blanca explícita.
// Ningún objeto StockJewel completo llega al contenido del PDF.

import type { Settings, StockJewel, StockJewelStoneKind } from '../types';
import { formatCOP } from '../utils/money';
import { formatDateCO } from '../utils/dates';
import {
  contentToPlainText,
  findSensitiveWordsInText,
  type PdfContent,
  type PdfSection
} from './pdfContent';

export type CatalogStoneFilter = 'todas' | 'naturales' | 'fantasia';

export interface CatalogOptions {
  stoneFilter: CatalogStoneFilter;
  includePrices: boolean;
}

/** Única forma de pieza que puede llegar al constructor del catálogo. */
export interface CatalogJewel {
  name: string;
  pieceType: string;
  material: string;
  photo: string;
  weightGrams: number;
  size: string;
  stoneCount: number;
  stoneKind: StockJewelStoneKind;
  priceCop?: number;
}

export type CatalogPreparationResult =
  | { status: 'ready'; content: PdfContent; jewels: CatalogJewel[] }
  | { status: 'sensitive'; words: string[] };

const STONE_KIND_LABEL: Record<StockJewelStoneKind, string> = {
  '': 'Sin registrar',
  fantasia: 'Fantasía',
  natural: 'Natural'
};

function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function historicalNumber(value: number, suffix = ''): string {
  if (!Number.isFinite(value) || value <= 0) return 'Sin registrar';
  return `${value.toLocaleString('es-CO', { maximumFractionDigits: 3 })}${suffix}`;
}

function matchesStoneFilter(kind: StockJewelStoneKind, filter: CatalogStoneFilter): boolean {
  if (filter === 'naturales') return kind === 'natural';
  if (filter === 'fantasia') return kind === 'fantasia';
  return true;
}

/**
 * Filtra disponibilidad y después copia, campo por campo, únicamente la lista blanca.
 * `status` y `sale` solo deciden si la pieza entra; nunca pasan al documento.
 */
export function selectCatalogJewels(
  jewels: readonly StockJewel[],
  options: CatalogOptions
): CatalogJewel[] {
  return jewels
    .filter((jewel) => (
      jewel.status === 'disponible' &&
      jewel.sale === null &&
      matchesStoneFilter(jewel.stoneKind, options.stoneFilter)
    ))
    .map((jewel) => {
      const allowed: CatalogJewel = {
        name: jewel.name,
        pieceType: jewel.pieceType,
        material: jewel.material,
        photo: jewel.photo,
        weightGrams: jewel.weightGrams,
        size: jewel.size,
        stoneCount: jewel.stoneCount,
        stoneKind: jewel.stoneKind
      };
      if (options.includePrices) allowed.priceCop = jewel.priceCop;
      return allowed;
    })
    .sort((a, b) => (
      a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }) ||
      a.pieceType.localeCompare(b.pieceType, 'es', { sensitivity: 'base' })
    ));
}

function customerContactLines(settings: Settings): string[] {
  const lines: string[] = [];
  const cityAddress = [settings.address, settings.city].filter(Boolean).join(', ');
  if (cityAddress) lines.push(cityAddress);
  const phones = [
    settings.phone ? `Tel: ${settings.phone}` : '',
    settings.whatsapp ? `WhatsApp: ${settings.whatsapp}` : ''
  ].filter(Boolean).join('  ·  ');
  if (phones) lines.push(phones);
  if (settings.email) lines.push(settings.email);
  if (settings.nit) lines.push(`NIT: ${settings.nit}`);
  return lines;
}

function jewelSection(jewel: CatalogJewel, includePrices: boolean): PdfSection {
  const rows: Array<[string, string]> = [
    ['Tipo', capitalize(jewel.pieceType) || 'Sin registrar'],
    ['Material', jewel.material.trim() || 'Sin registrar'],
    ['Peso', historicalNumber(jewel.weightGrams, ' g')],
    ['Talla o medida', jewel.size.trim() || 'Sin registrar'],
    ['Número de piedras', historicalNumber(jewel.stoneCount)],
    ['Clase de piedra', STONE_KIND_LABEL[jewel.stoneKind] ?? 'Sin registrar']
  ];
  if (includePrices && jewel.priceCop !== undefined) {
    rows.push(['Precio', formatCOP(jewel.priceCop)]);
  }
  return {
    title: jewel.name.trim() || capitalize(jewel.pieceType) || 'Pieza disponible',
    rows,
    image: jewel.photo
  };
}

/** Construye el contenido final únicamente desde piezas ya reducidas a la lista blanca. */
export function buildCatalogPdfContent(
  jewels: readonly CatalogJewel[],
  settings: Settings,
  options: CatalogOptions,
  generatedDate: string
): PdfContent {
  return {
    internal: false,
    jewelryName: settings.jewelryName,
    contactLines: customerContactLines(settings),
    docTitle: 'CATÁLOGO',
    quoteNumber: '',
    dateLine: `Generado: ${formatDateCO(generatedDate)}`,
    sections: jewels.map((jewel) => jewelSection(jewel, options.includePrices)),
    totals: [],
    totalLine: ['PIEZAS DISPONIBLES', String(jewels.length)],
    footer: settings.commercialMessage.trim() || 'Consulta disponibilidad y detalles.'
  };
}

/**
 * Ejecuta el detector sobre el contenido final. Si encuentra algo, no entrega
 * contenido listo para renderizar y por tanto no existe forma de saltar el bloqueo.
 */
export function prepareCatalogPdfContent(
  stockJewels: readonly StockJewel[],
  settings: Settings,
  options: CatalogOptions,
  generatedDate: string
): CatalogPreparationResult {
  const jewels = selectCatalogJewels(stockJewels, options);
  const content = buildCatalogPdfContent(jewels, settings, options, generatedDate);
  const words = findSensitiveWordsInText(contentToPlainText(content));
  if (words.length > 0) return { status: 'sensitive', words };
  return { status: 'ready', content, jewels };
}
