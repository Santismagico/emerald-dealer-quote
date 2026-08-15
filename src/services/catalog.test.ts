import { describe, expect, it, vi } from 'vitest';
import type { StockJewel } from '../types';
import { sampleSettings } from '../test/fixtures';
import { contentToPlainText } from './pdfContent';
import {
  buildCatalogPdfContent,
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
    id: 'jewel-1',
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
  return contentToPlainText(result.content);
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

  it('con precios muestra únicamente el precio comercial', () => {
    const options: CatalogOptions = { stoneFilter: 'todas', includePrices: true };
    const text = plainTextFor([jewel()], options);
    expect(digitsOnly(text)).toContain('7654321');
    expect(digitsOnly(text)).not.toContain('987654');
  });

  it('la proyección contiene exactamente los campos permitidos', () => {
    const [withoutPrice] = selectCatalogJewels([jewel()], allWithoutPrices);
    expect(Object.keys(withoutPrice).sort()).toEqual([
      'material',
      'name',
      'photo',
      'pieceType',
      'size',
      'stoneCount',
      'stoneKind',
      'weightGrams'
    ]);

    const [withPrice] = selectCatalogJewels(
      [jewel()],
      { stoneFilter: 'todas', includePrices: true }
    );
    expect(Object.keys(withPrice).sort()).toEqual([
      'material',
      'name',
      'photo',
      'pieceType',
      'priceCop',
      'size',
      'stoneCount',
      'stoneKind',
      'weightGrams'
    ]);
  });

  it('excluye piezas vendidas y apartadas', () => {
    const available = jewel({ id: 'available' });
    const reserved = jewel({ id: 'reserved', status: 'apartada' });
    const sold = jewel({
      id: 'sold',
      sale: {
        id: 'sale-1',
        date: '2026-08-01',
        buyer: 'Comprador',
        buyerId: null,
        priceCop: 8_000_000,
        productType: '',
        usdRate: null,
        receivedBy: 'Caja',
        method: 'Transferencia',
        notes: ''
      }
    });
    expect(selectCatalogJewels([reserved, sold, available], allWithoutPrices))
      .toHaveLength(1);
  });

  it('filtra naturales, fantasía y deja sin registrar únicamente en todas', () => {
    const natural = jewel({ id: 'natural', name: 'Natural', stoneKind: 'natural' });
    const fantasy = jewel({ id: 'fantasy', name: 'Fantasía', stoneKind: 'fantasia' });
    const unknown = jewel({ id: 'unknown', name: 'Sin registrar', stoneKind: '' });
    const source = [natural, fantasy, unknown];

    expect(selectCatalogJewels(source, { ...allWithoutPrices, stoneFilter: 'naturales' }))
      .toEqual([expect.objectContaining({ name: 'Natural' })]);
    expect(selectCatalogJewels(source, { ...allWithoutPrices, stoneFilter: 'fantasia' }))
      .toEqual([expect.objectContaining({ name: 'Fantasía' })]);
    expect(selectCatalogJewels(source, allWithoutPrices).map((item) => item.name).sort())
      .toEqual(['Fantasía', 'Natural', 'Sin registrar'].sort());
  });

  it('el detector revisa el contenido final y bloquea ante un hallazgo', () => {
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

  it('una pieza sin foto conserva su ficha', () => {
    const selected = selectCatalogJewels([jewel({ photo: '' })], allWithoutPrices);
    const content = buildCatalogPdfContent(selected, settings, allWithoutPrices, '2026-08-04');
    expect(content.sections).toHaveLength(1);
    expect(content.sections[0].image).toBe('');
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
