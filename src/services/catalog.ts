// Catálogo para cliente (D-065): se construye desde una lista blanca explícita.
// Ningún objeto StockJewel completo llega al contenido ni al constructor del PDF.

import type { Settings, StockJewel, StockJewelStoneKind } from '../types';
import { formatCOP } from '../utils/money';
import { findSensitiveWordsInText } from './pdfContent';

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
  extraPhotos: string[];
  weightGrams: number;
  size: string;
  stoneCount: number;
  stoneKind: StockJewelStoneKind;
  priceCop?: number;
}

export interface CatalogPiece {
  /** Número visible solo en este archivo. Jamás es el id interno (D-080). */
  code: string;
  name: string;
  detailLine: string;
  stoneLine: string;
  priceLine: string;
  photo: string;
  extraPhotos: string[];
}

export interface CatalogContent {
  jewelryName: string;
  contactLines: string[];
  periodLine: string;
  footer: string;
  pieces: CatalogPiece[];
}

export type CatalogPreparationResult =
  | { status: 'ready'; content: CatalogContent; jewels: CatalogJewel[] }
  | { status: 'sensitive'; words: string[] };

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function localizedNumber(value: number): string {
  return value.toLocaleString('es-CO', { maximumFractionDigits: 3 });
}

function matchesStoneFilter(kind: StockJewelStoneKind, filter: CatalogStoneFilter): boolean {
  if (filter === 'naturales') return kind === 'natural';
  if (filter === 'fantasia') return kind === 'fantasia';
  return true;
}

function periodLine(generatedDate: string): string {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(generatedDate);
  if (!match) return '';
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? `${MONTHS[month - 1]} ${match[1]}` : '';
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
        extraPhotos: jewel.extraPhotos.slice(0, 2),
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
  return lines;
}

function pieceContent(jewel: CatalogJewel, index: number, includePrices: boolean): CatalogPiece {
  const details = [
    jewel.material.trim().replace(/\s+/g, ' '),
    jewel.weightGrams > 0 ? `${localizedNumber(jewel.weightGrams)} g` : '',
    jewel.size.trim() ? `Talla ${jewel.size.trim()}` : ''
  ].filter(Boolean);
  let stoneLine = '';
  if (jewel.stoneCount > 0) {
    const count = localizedNumber(jewel.stoneCount);
    if (jewel.stoneKind === 'natural') {
      stoneLine = `${count} ${jewel.stoneCount === 1 ? 'piedra natural' : 'piedras naturales'}`;
    } else if (jewel.stoneKind === 'fantasia') {
      stoneLine = `${count} ${jewel.stoneCount === 1 ? 'piedra de fantasía' : 'piedras de fantasía'}`;
    } else {
      stoneLine = `${count} ${jewel.stoneCount === 1 ? 'piedra' : 'piedras'}`;
    }
  }
  return {
    code: String(index + 1).padStart(2, '0'),
    name: jewel.name.trim() || capitalize(jewel.pieceType) || 'Pieza disponible',
    detailLine: details.join(' · '),
    stoneLine,
    priceLine: includePrices && (jewel.priceCop ?? 0) > 0 ? formatCOP(jewel.priceCop ?? 0) : '',
    photo: jewel.photo,
    extraPhotos: jewel.extraPhotos.slice(0, 2)
  };
}

/** Construye el contenido final únicamente desde piezas ya reducidas a la lista blanca. */
export function buildCatalogPdfContent(
  jewels: readonly CatalogJewel[],
  settings: Settings,
  options: CatalogOptions,
  generatedDate: string
): CatalogContent {
  return {
    jewelryName: settings.jewelryName.trim(),
    contactLines: customerContactLines(settings),
    periodLine: periodLine(generatedDate),
    footer: settings.commercialMessage.trim() || 'Consulta disponibilidad y detalles.',
    pieces: jewels.map((jewel, index) => pieceContent(jewel, index, options.includePrices))
  };
}

/** Incluye cada cadena que el renderer puede imprimir; es la barrera final de privacidad. */
export function catalogContentToPlainText(content: CatalogContent): string {
  return [
    content.jewelryName,
    ...content.contactLines,
    content.periodLine,
    ...content.pieces.flatMap((piece) => [
      piece.code,
      piece.name,
      piece.detailLine,
      piece.stoneLine,
      piece.priceLine
    ]),
    content.footer,
    'CATÁLOGO',
    'Para reservar una pieza, indícanos su número.'
  ].filter(Boolean).join('\n');
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
  const words = findSensitiveWordsInText(catalogContentToPlainText(content));
  if (words.length > 0) return { status: 'sensitive', words };
  return { status: 'ready', content, jewels };
}
