// Constructores PUROS del contenido de los PDF (sin dependencia de jsPDF).
// Separados para poder probar con tests que el PDF del cliente
// no contiene información sensible.

import type { Quote, Settings, Stone } from '../types';
import type { CalcResult } from '../calc/engine';
import { formatCOP } from '../utils/money';
import { formatDateCO } from '../utils/dates';
import { paymentsTotal } from './payments';

export interface PdfSection {
  title: string;
  rows?: Array<[string, string]>;
  paragraphs?: string[];
}

export interface PdfContent {
  /** true = documento interno con datos sensibles. */
  internal: boolean;
  jewelryName: string;
  contactLines: string[];
  docTitle: string;
  quoteNumber: string;
  dateLine: string;
  sections: PdfSection[];
  totals: Array<[string, string]>;
  totalLine: [string, string];
  footer: string;
}

// Términos que jamás deberían aparecer en texto visible para el cliente.
// Coinciden por palabra o frase completa ("costoso" no dispara "costo")
// ignorando mayúsculas y tildes. Lista alineada con la regla 1 de AGENTS.md.
const SENSITIVE_TERMS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'costo', pattern: /\b(?:costos?|costes?)\b/ },
  { label: 'margen', pattern: /\bmargen(?:es)?\b/ },
  { label: 'utilidad', pattern: /\butilidad(?:es)?\b/ },
  { label: 'ganancia', pattern: /\bganancias?\b/ },
  { label: 'rentabilidad', pattern: /\brentabilidad(?:es)?\b/ },
  {
    label: 'precio por gramo',
    pattern:
      /\b(?:precio|valor)[\s-]+(?:por|x|del)[\s-]+gramos?\b|\b(?:precio|valor)\s*\/\s*gramos?\b|\bpesos?\s+por\s+gramo\b/
  },
  { label: '$/g', pattern: /(?:\$|cop)\s*\/\s*g(?:ramos?)?\b/ },
  { label: '18K', pattern: /\b18\s*(?:k|kt|kilates?|quilates?)\b/ },
  { label: '24K', pattern: /\b24\s*(?:k|kt|kilates?|quilates?)\b/ },
  { label: 'pureza', pattern: /\bpurezas?\b/ },
  { label: 'fórmula', pattern: /\bformulas?\b/ },
  { label: 'confidencial', pattern: /\bconfidencial(?:es)?\b/ },
  { label: 'interno', pattern: /\bintern[oa]s?\b/ },
  { label: 'markup', pattern: /\bmark(?:\s*-\s*|\s+)?up\b/ }
];

/** Quita tildes (diacríticos U+0300–U+036F) y pasa a minúsculas antes de comparar. */
function normalizeForScan(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Revisa un texto que está a punto de enviarse al cliente. */
export function findSensitiveWordsInText(text: string): string[] {
  const haystack = normalizeForScan(text);
  const found: string[] = [];
  for (const { label, pattern } of SENSITIVE_TERMS) {
    if (pattern.test(haystack)) found.push(label);
  }
  return found;
}

/**
 * Revisa el contenido final del PDF cliente, no una lista manual de campos.
 * Así también quedan cubiertos material, marca, contacto, condiciones,
 * mensaje comercial y cualquier texto visible que se agregue en el futuro.
 */
export function findSensitiveWordsInClientText(
  quote: Quote,
  calc: CalcResult,
  settings: Settings
): string[] {
  const clientContent = buildClientPdfContent(quote, calc, settings);
  return findSensitiveWordsInText(contentToPlainText(clientContent));
}

/** Descripción comercial de una piedra (apta para el cliente). */
export function stoneClientDescription(stone: Stone): string {
  const parts: string[] = [];
  parts.push(stone.type.trim() || 'Piedra');
  if (stone.cut.trim()) parts.push(`talla ${stone.cut.trim()}`);
  if (stone.carats > 0) parts.push(`${stone.carats} ct`);
  if (stone.size.trim()) parts.push(stone.size.trim());
  if (stone.quality.trim()) parts.push(stone.quality.trim());
  if (stone.treatment.trim()) parts.push(stone.treatment.trim());
  const qty = stone.quantity > 1 ? ` (x${stone.quantity})` : '';
  return parts.join(', ') + qty;
}

function contactLines(settings: Settings): string[] {
  const lines: string[] = [];
  const cityAddress = [settings.address, settings.city].filter(Boolean).join(', ');
  if (cityAddress) lines.push(cityAddress);
  const phones = [
    settings.phone ? `Tel: ${settings.phone}` : '',
    settings.whatsapp ? `WhatsApp: ${settings.whatsapp}` : ''
  ]
    .filter(Boolean)
    .join('  ·  ');
  if (phones) lines.push(phones);
  if (settings.email) lines.push(settings.email);
  if (settings.nit) lines.push(`NIT: ${settings.nit}`);
  return lines;
}

function clientSection(quote: Quote): PdfSection | null {
  const c = quote.clientSnapshot;
  if (!c) return null;
  const rows: Array<[string, string]> = [];
  if (c.name) rows.push(['Cliente', c.name]);
  if (c.phone) rows.push(['Teléfono', c.phone]);
  if (c.city) rows.push(['Ciudad', c.city]);
  if (c.email) rows.push(['Email', c.email]);
  return rows.length ? { title: 'Cliente', rows } : null;
}

/**
 * Contenido del PDF PARA EL CLIENTE.
 * Prohibido incluir: margen, utilidad, ganancia, costo interno, precio por gramo,
 * pureza (18K/24K), fórmula del oro, observaciones internas.
 */
export function buildClientPdfContent(quote: Quote, calc: CalcResult, settings: Settings): PdfContent {
  const sections: PdfSection[] = [];

  const cs = clientSection(quote);
  if (cs) sections.push(cs);

  const pieceRows: Array<[string, string]> = [
    ['Tipo de pieza', capitalize(quote.pieceType)],
    ['Material', quote.material]
  ];
  if (quote.weightGrams > 0) pieceRows.push(['Peso aproximado', `${quote.weightGrams} g`]);
  if (quote.pieceDescription.trim()) pieceRows.push(['Descripción', quote.pieceDescription.trim()]);
  sections.push({ title: 'Detalle de la pieza', rows: pieceRows });

  if (quote.stones.length > 0) {
    sections.push({
      title: 'Piedras',
      paragraphs: quote.stones.map((s) => `• ${stoneClientDescription(s)}`)
    });
  }

  if (quote.clientNotes.trim()) {
    sections.push({ title: 'Observaciones', paragraphs: [quote.clientNotes.trim()] });
  }

  const conditions: string[] = [];
  if (quote.validUntil) {
    conditions.push(`Cotización válida hasta el ${formatDateCO(quote.validUntil)}.`);
  }
  if (settings.conditions.trim()) {
    conditions.push(settings.conditions.trim());
  }
  if (conditions.length) {
    sections.push({ title: 'Condiciones', paragraphs: conditions });
  }

  const totals: Array<[string, string]> = [];
  if (calc.discountAmount > 0) totals.push(['Descuento aplicado', `- ${formatCOP(calc.discountAmount)}`]);
  if (calc.taxAmount > 0) totals.push(['Impuesto', formatCOP(calc.taxAmount)]);
  if (calc.deposit > 0) {
    totals.push(['Anticipo', formatCOP(calc.deposit)]);
    totals.push(['Saldo pendiente', formatCOP(calc.balance)]);
  }

  return {
    internal: false,
    jewelryName: settings.jewelryName,
    contactLines: contactLines(settings),
    docTitle: 'COTIZACIÓN',
    quoteNumber: quote.number,
    dateLine: `Fecha: ${formatDateCO(quote.date)}`,
    sections,
    totals,
    totalLine: ['VALOR TOTAL', formatCOP(calc.total)],
    footer: settings.commercialMessage.trim() || 'Gracias por su confianza.'
  };
}

/** Contenido del documento INTERNO. Incluye costos, margen y notas internas. */
export function buildInternalPdfContent(quote: Quote, calc: CalcResult, settings: Settings): PdfContent {
  const sections: PdfSection[] = [];

  const cs = clientSection(quote);
  if (cs) sections.push(cs);

  sections.push({
    title: 'Pieza',
    rows: [
      ['Tipo', capitalize(quote.pieceType)],
      ['Material', quote.material],
      ['Peso', `${quote.weightGrams} g`],
      ['Precio material por gramo', formatCOP(quote.materialPricePerGram)],
      ['Estado', capitalize(quote.status)]
    ]
  });

  if (quote.stones.length > 0) {
    sections.push({
      title: 'Piedras (detalle interno)',
      paragraphs: quote.stones.map((s) => {
        const mode = s.priceMode === 'porQuilate' ? `${formatCOP(s.unitPrice)}/ct` : `${formatCOP(s.unitPrice)} c/u`;
        const extra = s.notes.trim() ? ` — ${s.notes.trim()}` : '';
        return `• ${stoneClientDescription(s)} — ${mode}${extra}`;
      })
    });
  }

  const costRows: Array<[string, string]> = [
    ['Subtotal material', formatCOP(calc.materialSubtotal)],
    ['Subtotal piedras', formatCOP(calc.stonesSubtotal)],
    ['Mano de obra', formatCOP(calc.laborSubtotal)],
    ['Costos adicionales', formatCOP(calc.extrasSubtotal)],
    ['Costo base', formatCOP(calc.baseCost)],
    [`Margen (${quote.marginPercent}%)`, formatCOP(calc.marginAmount)],
    ['Subtotal comercial', formatCOP(calc.subtotal)],
    ['Descuento', `- ${formatCOP(calc.discountAmount)}`],
    ['Impuesto', formatCOP(calc.taxAmount)],
    ['Anticipo', formatCOP(calc.deposit)],
    ['Saldo', formatCOP(calc.balance)]
  ];
  sections.push({ title: 'Estructura de costos (confidencial)', rows: costRows });

  const payments = quote.payments ?? [];
  if (payments.length > 0) {
    const totalPaid = paymentsTotal(payments);
    sections.push({
      title: 'Abonos recibidos (interno)',
      paragraphs: [
        ...payments.map((p) => {
          let line = `• ${formatCOP(p.amount)} el ${formatDateCO(p.date)}`;
          if (p.receivedBy) line += ` — recibió ${p.receivedBy}`;
          if (p.method) line += ` (${p.method})`;
          if (p.notes.trim()) line += ` — ${p.notes.trim()}`;
          return line;
        }),
        `Total abonado: ${formatCOP(totalPaid)} — Saldo real: ${formatCOP(calc.total - totalPaid)}`
      ]
    });
  }

  const production = quote.production ?? [];
  if (production.length > 0) {
    sections.push({
      title: 'Producción del taller (interno)',
      paragraphs: production.map((st) => {
        const statusLabel =
          st.status === 'lista'
            ? `lista${st.completedAt ? ` el ${formatDateCO(st.completedAt)}` : ''}`
            : st.status === 'enProceso'
              ? 'en proceso'
              : 'pendiente';
        let payment = '';
        if (st.cost > 0) {
          payment = ` — ${formatCOP(st.cost)}`;
          if (st.paid) {
            payment += ' pagado';
            if (st.paidAt) payment += ` el ${formatDateCO(st.paidAt)}`;
            if (st.paidTo) payment += ` a ${st.paidTo}`;
            if (st.paidBy) payment += ` (pagó ${st.paidBy})`;
          } else {
            payment += ' por pagar';
          }
        }
        const note = st.notes.trim() ? ` — ${st.notes.trim()}` : '';
        return `• ${st.name}: ${statusLabel}${payment}${note}`;
      })
    });
  }

  const auditParagraphs = [
    `Creada: ${quote.createdAt}`,
    `Última actualización: ${quote.updatedAt}`,
    settings.goldPriceNote
  ];
  if (quote.internalNotes.trim()) {
    auditParagraphs.unshift(`Notas internas: ${quote.internalNotes.trim()}`);
  }
  sections.push({ title: 'Auditoría y notas internas', paragraphs: auditParagraphs });

  return {
    internal: true,
    jewelryName: settings.jewelryName,
    contactLines: ['DOCUMENTO INTERNO — NO ENTREGAR AL CLIENTE'],
    docTitle: 'COTIZACIÓN (INTERNA)',
    quoteNumber: quote.number,
    dateLine: `Fecha: ${formatDateCO(quote.date)}`,
    sections,
    totals: [],
    totalLine: ['TOTAL COTIZADO', formatCOP(calc.total)],
    footer: 'Uso exclusivo de la joyería.'
  };
}

/** Aplana todo el contenido a texto plano (para tests de privacidad). */
export function contentToPlainText(content: PdfContent): string {
  const parts: string[] = [
    content.jewelryName,
    ...content.contactLines,
    content.docTitle,
    content.quoteNumber,
    content.dateLine
  ];
  for (const s of content.sections) {
    parts.push(s.title);
    for (const [label, value] of s.rows ?? []) parts.push(`${label}: ${value}`);
    for (const p of s.paragraphs ?? []) parts.push(p);
  }
  for (const [label, value] of content.totals) parts.push(`${label}: ${value}`);
  parts.push(`${content.totalLine[0]}: ${content.totalLine[1]}`);
  parts.push(content.footer);
  return parts.join('\n');
}

function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}
