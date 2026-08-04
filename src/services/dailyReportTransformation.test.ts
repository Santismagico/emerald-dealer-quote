import { describe, expect, it } from 'vitest';
import type { StockJewel, StoneLot } from '../types';
import { buildDailyReport } from './dailyReport';
import { summarizeStockJewel } from './stockJewels';
import { summarizeStoneLot } from './stones';
import { transformStockJewelToNatural } from './stoneJewelTransformation';

const lot: StoneLot = {
  id: 'lot-cash',
  name: 'Lote para joya',
  stoneType: 'Esmeralda',
  description: '',
  purchaseDate: '2026-08-01',
  supplier: '',
  supplierId: null,
  carats: 10,
  quantity: 10,
  purchaseValueCop: 1_000_000,
  partnerId: null,
  partnerName: '',
  myPercent: 100,
  onCredit: false,
  supplierPayments: [],
  cuttingBatches: [],
  internalUses: [],
  notes: '',
  sales: [],
  createdAt: '2026-08-01T09:00:00.000Z',
  updatedAt: '2026-08-01T09:00:00.000Z'
};

const jewel: StockJewel = {
  id: 'jewel-cash',
  name: 'Anillo de fantasía',
  pieceType: 'anillo',
  material: 'Oro',
  photo: '',
  acquiredDate: '2026-08-02',
  weightGrams: 4,
  size: '7',
  stoneCount: 1,
  stoneKind: 'fantasia',
  costCop: 500_000,
  priceCop: 2_000_000,
  status: 'disponible',
  notes: '',
  sale: null,
  collectionId: null,
  stoneTransformations: [],
  createdAt: '2026-08-02T09:00:00.000Z',
  updatedAt: '2026-08-02T09:00:00.000Z'
};

describe('una transformación no mueve caja', () => {
  const transformed = transformStockJewelToNatural(
    lot,
    jewel,
    {
      id: 'event-cash',
      date: '2026-08-04',
      lotId: lot.id,
      jewelId: jewel.id,
      origin: 'bruto',
      carats: 1,
      quantity: 1,
      notes: ''
    },
    '2026-08-04T12:00:00.000Z'
  );

  it('conserva exactamente el cierre del día de compra del lote', () => {
    expect(buildDailyReport('2026-08-01', [], [transformed.lot], [transformed.jewel])).toEqual(
      buildDailyReport('2026-08-01', [], [lot], [jewel])
    );
  });

  it('conserva exactamente el cierre del día en que entró la joya', () => {
    expect(buildDailyReport('2026-08-02', [], [transformed.lot], [transformed.jewel])).toEqual(
      buildDailyReport('2026-08-02', [], [lot], [jewel])
    );
  });

  it('no crea entradas ni salidas de caja el día de la transformación', () => {
    expect(buildDailyReport('2026-08-04', [], [transformed.lot], [transformed.jewel])).toEqual(
      buildDailyReport('2026-08-04', [], [lot], [jewel])
    );
  });

  it('traslada el costo sin cambiar el resultado total esperado del negocio', () => {
    const before = summarizeStoneLot(lot).result + summarizeStockJewel(jewel).resultCop;
    const after =
      summarizeStoneLot(transformed.lot).result +
      summarizeStockJewel(transformed.jewel).resultCop;

    expect(transformed.attributedCostCop).toBe(100_000);
    expect(summarizeStoneLot(transformed.lot).rawAvailableCarats).toBe(9);
    expect(transformed.jewel.costCop).toBe(600_000);
    expect(after).toBe(before);
  });
});
