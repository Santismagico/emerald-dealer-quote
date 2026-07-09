import { describe, it, expect } from 'vitest';
import { buildClientPdfContent, buildInternalPdfContent, contentToPlainText } from './pdfContent';
import { calculateQuote, quoteToCalcInput } from '../calc/engine';
import { sampleQuote, sampleSettings } from '../test/fixtures';

const quote = sampleQuote();
const settings = sampleSettings();
const calc = calculateQuote(quoteToCalcInput(quote));

// Palabras que JAMÁS pueden aparecer en el documento del cliente.
const FORBIDDEN_FOR_CLIENT = [
  'margen',
  'ganancia',
  'utilidad',
  'costo interno',
  'costo base',
  'costo real',
  'fórmula',
  'formula',
  '24k',
  '18k',
  'pureza',
  'confidencial',
  'interno'
];

describe('PDF del cliente: privacidad', () => {
  const text = contentToPlainText(buildClientPdfContent(quote, calc, settings)).toLowerCase();

  it.each(FORBIDDEN_FOR_CLIENT)('no contiene la palabra sensible "%s"', (word) => {
    expect(text).not.toContain(word);
  });

  it('no contiene el precio por gramo del material', () => {
    expect(text).not.toContain('550.000');
    expect(text).not.toContain('por gramo');
  });

  it('no contiene las observaciones internas', () => {
    expect(text).not.toContain('proveedor');
    expect(text).not.toContain(quote.internalNotes.toLowerCase().slice(0, 20));
  });

  it('no contiene el desglose interno de costos', () => {
    expect(text).not.toContain('mano de obra');
    expect(text).not.toContain('subtotal material');
  });

  it('no contiene las notas internas de las piedras', () => {
    expect(text).not.toContain('muzo');
    expect(text).not.toContain('lote 12');
  });
});

describe('PDF del cliente: contenido esperado', () => {
  const content = buildClientPdfContent(quote, calc, settings);
  const text = contentToPlainText(content);

  it('incluye la marca, el número y la fecha', () => {
    expect(text).toContain('Emerald Dealer');
    expect(text).toContain('ED-2026-0001');
    expect(text).toContain('2026');
  });

  it('incluye los datos del cliente', () => {
    expect(text).toContain('María Gómez');
  });

  it('incluye el total, anticipo y saldo formateados en COP', () => {
    expect(text).toContain('VALOR TOTAL');
    expect(text.replace(/ /g, ' ')).toContain('Anticipo');
    expect(text).toContain('Saldo pendiente');
  });

  it('describe las piedras de forma comercial', () => {
    expect(text).toContain('Esmeralda');
    expect(text).toContain('1.2 ct');
  });

  it('incluye vigencia y condiciones', () => {
    expect(text).toContain('válida hasta');
    expect(text).toContain(settings.conditions.slice(0, 30));
  });

  it('incluye las observaciones visibles para el cliente', () => {
    expect(text).toContain('Incluye estuche de lujo.');
  });
});

describe('documento interno', () => {
  const text = contentToPlainText(buildInternalPdfContent(quote, calc, settings));

  it('incluye el desglose completo de costos', () => {
    expect(text).toContain('Subtotal material');
    expect(text).toContain('Mano de obra');
    expect(text).toContain('Margen');
    expect(text).toContain('Costo base');
  });

  it('incluye las notas internas y la nota del oro', () => {
    expect(text).toContain('proveedor');
    expect(text).toContain('24K');
  });

  it('está marcado como documento interno', () => {
    expect(text).toContain('NO ENTREGAR AL CLIENTE');
  });

  it('el flag internal distingue ambos documentos', () => {
    expect(buildInternalPdfContent(quote, calc, settings).internal).toBe(true);
    expect(buildClientPdfContent(quote, calc, settings).internal).toBe(false);
  });
});
