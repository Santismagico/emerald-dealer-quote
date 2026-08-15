import { describe, expect, it, vi } from 'vitest';
import { calculateQuote, quoteToCalcInput } from '../calc/engine';
import type { StockJewel } from '../types';
import { sampleQuote, sampleSettings } from '../test/fixtures';
import { buildClientPdfContent, contentToPlainText } from './pdfContent';
import {
  buildCatalogPdfContent,
  catalogContentToPlainText,
  prepareCatalogPdfContent,
  selectCatalogJewels,
  type CatalogOptions
} from './catalog';
import {
  assertCatalogPdfSize,
  catalogPdfFileName,
  CatalogPdfTooLargeError,
  CatalogPrivacyError,
  createCatalogPdfFile,
  MAX_CATALOG_PDF_BYTES
} from './pdf';
import { shareCatalogPdfFile, type PdfShareEnvironment } from './pdfShare';

const settings = sampleSettings({
  jewelryName: 'Emerald Dealer',
  nit: '',
  phone: '',
  whatsapp: '',
  address: '',
  city: '',
  email: '',
  commercialMessage: 'Consulta disponibilidad y detalles.',
  logoDataUrl: ''
});

const allWithoutPrices: CatalogOptions = {
  stoneFilter: 'todas',
  includePrices: false
};

function jewel(overrides: Partial<StockJewel> = {}): StockJewel {
  return {
    id: 'jewel-interno-998877',
    name: 'Anillo Aurora',
    pieceType: 'anillo',
    material: 'Oro amarillo',
    photo: '',
    extraPhotos: [],
    acquiredDate: '2026-07-20',
    weightGrams: 4.5,
    size: '7',
    stoneCount: 1,
    stoneKind: 'natural',
    costCop: 987_654,
    priceCop: 7_654_321,
    status: 'disponible',
    notes: 'NOTA-SECRETA-31415926',
    sale: null,
    collectionId: null,
    stoneTransformations: [],
    createdAt: '2026-07-20T10:00:00.000Z',
    updatedAt: '2026-07-20T10:00:00.000Z',
    ...overrides
  };
}

function plainTextFor(source: StockJewel[], options: CatalogOptions): string {
  const result = prepareCatalogPdfContent(source, settings, options, '2026-08-04');
  expect(result.status).toBe('ready');
  if (result.status !== 'ready') throw new Error('El catálogo de prueba fue bloqueado.');
  return catalogContentToPlainText(result.content);
}

function digitsOnly(text: string): string {
  return text.replace(/\D/g, '');
}

describe('catálogo por lista blanca', () => {
  it.each([false, true])(
    'el número delator y la nota interna no aparecen con includePrices=%s',
    (includePrices) => {
      const text = plainTextFor([jewel()], { stoneFilter: 'todas', includePrices });
      const digits = digitsOnly(text);
      expect(digits).not.toContain('987654');
      expect(digits).not.toContain('31415926');
      expect(text).not.toContain('NOTA-SECRETA-31415926');
    }
  );

  it('sin precios no lee ni conserva priceCop en la proyección permitida', () => {
    const [selected] = selectCatalogJewels([jewel()], allWithoutPrices);
    expect(selected).not.toHaveProperty('priceCop');
    expect(digitsOnly(plainTextFor([jewel()], allWithoutPrices))).not.toContain('7654321');
  });

  it('con precios muestra únicamente el precio comercial y omite precio cero', () => {
    const options: CatalogOptions = { stoneFilter: 'todas', includePrices: true };
    expect(digitsOnly(plainTextFor([jewel()], options))).toContain('7654321');
    const zeroContent = buildCatalogPdfContent(
      selectCatalogJewels([jewel({ priceCop: 0 })], options),
      settings,
      options,
      '2026-08-04'
    );
    expect(zeroContent.pieces[0].priceLine).toBe('');
  });

  it('la proyección contiene exactamente los campos permitidos', () => {
    const [withoutPrice] = selectCatalogJewels([jewel()], allWithoutPrices);
    expect(Object.keys(withoutPrice).sort()).toEqual([
      'extraPhotos', 'material', 'name', 'photo', 'pieceType', 'size',
      'stoneCount', 'stoneKind', 'weightGrams'
    ]);
    const [withPrice] = selectCatalogJewels(
      [jewel()],
      { stoneFilter: 'todas', includePrices: true }
    );
    expect(Object.keys(withPrice).sort()).toEqual([
      'extraPhotos', 'material', 'name', 'photo', 'pieceType', 'priceCop',
      'size', 'stoneCount', 'stoneKind', 'weightGrams'
    ]);
  });

  it('excluye piezas vendidas y apartadas', () => {
    const available = jewel({ id: 'available' });
    const reserved = jewel({ id: 'reserved', status: 'apartada' });
    const sold = jewel({
      id: 'sold',
      sale: {
        id: 'sale-1', date: '2026-08-01', buyer: 'Comprador', buyerId: null,
        priceCop: 8_000_000, productType: '', usdRate: null, receivedBy: 'Caja',
        method: 'Transferencia', notes: ''
      }
    });
    expect(selectCatalogJewels([reserved, sold, available], allWithoutPrices)).toHaveLength(1);
  });

  it('filtra naturales, fantasía y deja la clase desconocida únicamente en todas', () => {
    const natural = jewel({ id: 'natural', name: 'Natural', stoneKind: 'natural' });
    const fantasy = jewel({ id: 'fantasy', name: 'Fantasía', stoneKind: 'fantasia' });
    const unknown = jewel({ id: 'unknown', name: 'Desconocida', stoneKind: '' });
    const source = [natural, fantasy, unknown];
    expect(selectCatalogJewels(source, { ...allWithoutPrices, stoneFilter: 'naturales' }))
      .toEqual([expect.objectContaining({ name: 'Natural' })]);
    expect(selectCatalogJewels(source, { ...allWithoutPrices, stoneFilter: 'fantasia' }))
      .toEqual([expect.objectContaining({ name: 'Fantasía' })]);
    expect(selectCatalogJewels(source, allWithoutPrices)).toHaveLength(3);
  });

  it('numera por orden visible, nunca expone ids internos y revisa todo el texto final', () => {
    const source = [
      jewel({ id: 'id-privado-111', name: 'Zafiro' }),
      jewel({ id: 'id-privado-222', name: 'Aurora' }),
      jewel({ id: 'id-privado-333', name: 'Brisa' })
    ];
    const result = prepareCatalogPdfContent(source, settings, allWithoutPrices, '2026-08-04');
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.content.pieces.map((piece) => [piece.code, piece.name])).toEqual([
      ['01', 'Aurora'], ['02', 'Brisa'], ['03', 'Zafiro']
    ]);
    const text = catalogContentToPlainText(result.content);
    expect(text).toContain('01\nAurora');
    expect(text).toContain('Oro amarillo · 4,5 g · Talla 7');
    expect(text).toContain('1 piedra natural');
    expect(text).toContain('Consulta disponibilidad y detalles.');
    expect(text).toContain('Para reservar una pieza, indícanos su número.');
    for (const item of source) expect(text).not.toContain(item.id);
  });

  it('el detector bloquea una palabra sensible ubicada en el nombre final', () => {
    const result = prepareCatalogPdfContent(
      [jewel({ name: 'Anillo con costo interno' })],
      settings,
      allWithoutPrices,
      '2026-08-04'
    );
    expect(result).toEqual({
      status: 'sensitive',
      words: expect.arrayContaining(['costo', 'interno'])
    });
  });

  it('omite datos desconocidos sin dejar separadores ni la frase Sin registrar', () => {
    const content = buildCatalogPdfContent(
      selectCatalogJewels([jewel({
        material: '', weightGrams: 0, size: '', stoneCount: 0, stoneKind: ''
      })], allWithoutPrices),
      settings,
      allWithoutPrices,
      '2026-08-04'
    );
    expect(content.pieces[0]).toMatchObject({ detailLine: '', stoneLine: '' });
    const text = catalogContentToPlainText(content);
    expect(text).not.toContain('Sin registrar');
    expect(text).not.toContain(' · ');
    expect(text).not.toContain('  ');
  });

  it('conserva cero, una o tres fotos sin perder la ficha', () => {
    const image = 'data:image/jpeg;base64,abc';
    const source = [
      jewel({ name: 'Cero', photo: '', extraPhotos: [] }),
      jewel({ name: 'Una', photo: image, extraPhotos: [] }),
      jewel({ name: 'Tres', photo: image, extraPhotos: [image, image] })
    ];
    const content = buildCatalogPdfContent(
      selectCatalogJewels(source, allWithoutPrices), settings, allWithoutPrices, '2026-08-04'
    );
    expect(content.pieces).toHaveLength(3);
    expect(content.pieces.map((piece) => [piece.photo, ...piece.extraPhotos].filter(Boolean).length))
      .toEqual([0, 3, 1]);
  });

  it('el catálogo omite el NIT y la cotización cliente lo conserva', () => {
    const settingsWithNit = { ...settings, nit: '900.123.456-7' };
    const catalog = buildCatalogPdfContent(
      selectCatalogJewels([jewel()], allWithoutPrices),
      settingsWithNit,
      allWithoutPrices,
      '2026-08-04'
    );
    const catalogText = catalogContentToPlainText(catalog);
    expect(catalogText).not.toContain('NIT');
    expect(digitsOnly(catalogText)).not.toContain('9001234567');

    const quote = sampleQuote();
    const quoteText = contentToPlainText(buildClientPdfContent(
      quote,
      calculateQuote(quoteToCalcInput(quote)),
      settingsWithNit
    ));
    expect(quoteText).toContain('NIT: 900.123.456-7');
  });
});

describe('archivo y entrega del catálogo', () => {
  it('crea un PDF cliente con nombre explícito de filtro y precios', async () => {
    const options: CatalogOptions = { stoneFilter: 'naturales', includePrices: true };
    const file = await createCatalogPdfFile([jewel()], settings, options, '2026-08-04');
    expect(file).toMatchObject({
      name: 'Catalogo-2026-08-04-naturales-con-precios.pdf',
      type: 'application/pdf'
    });
    expect(file.size).toBeGreaterThan(0);
    expect(catalogPdfFileName(options, '2026-08-04')).toBe(file.name);
  });

  it('bloquea un archivo que supera el límite antes de entregarlo', () => {
    expect(() => assertCatalogPdfSize(MAX_CATALOG_PDF_BYTES + 1))
      .toThrow(CatalogPdfTooLargeError);
  });

  it('no crea el archivo cuando el detector final encuentra información reservada', async () => {
    await expect(createCatalogPdfFile(
      [jewel({ material: 'Material con costo interno' })],
      settings,
      allWithoutPrices,
      '2026-08-04'
    )).rejects.toBeInstanceOf(CatalogPrivacyError);
  });

  it('comparte con Web Share y conserva la descarga como respaldo', async () => {
    const file = new File([new Uint8Array([37, 80, 68, 70])], 'Catalogo.pdf', {
      type: 'application/pdf'
    });
    const environment: PdfShareEnvironment = {
      share: undefined,
      canShare: undefined,
      download: vi.fn()
    };
    expect(await shareCatalogPdfFile(file, environment)).toEqual({ status: 'downloaded' });
    expect(environment.download).toHaveBeenCalledWith(file);
  });
});
