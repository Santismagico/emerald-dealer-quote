import { describe, expect, it } from 'vitest';
import type { StockJewel, StoneLot } from '../types';
import { buildDailyReport, buildMonthlyReport } from './dailyReport';
import { buildSalesAnalytics } from './salesAnalytics';
import { summarizeStockJewel } from './stockJewels';
import { summarizeStoneLot } from './stones';
import {
  preserveDeletedStoneLotName,
  transformStockJewelToNatural
} from './stoneJewelTransformation';

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

  it('borrar el lote no cambia costo, resultado ni reportes de la joya vendida', () => {
    const previousMonthLot = { ...lot, purchaseDate: '2026-07-30' };
    const previousMonthJewel = { ...jewel, acquiredDate: '2026-07-31' };
    const moved = transformStockJewelToNatural(
      previousMonthLot,
      previousMonthJewel,
      {
        id: 'event-delete',
        date: '2026-08-01',
        lotId: previousMonthLot.id,
        jewelId: previousMonthJewel.id,
        origin: 'bruto',
        carats: 1,
        quantity: 1,
        notes: ''
      },
      '2026-08-01T12:00:00.000Z'
    );
    const soldJewel: StockJewel = {
      ...moved.jewel,
      sale: {
        id: 'sale-delete',
        date: '2026-08-04',
        buyer: 'Cliente',
        buyerId: null,
        priceCop: 2_000_000,
        productType: 'Anillo',
        usdRate: 4_000,
        receivedBy: 'Santiago',
        method: 'Transferencia',
        notes: ''
      }
    };
    const preservedJewel = preserveDeletedStoneLotName(
      soldJewel,
      moved.lot.id,
      'Lote para joya',
      '2026-08-04T18:00:00.000Z'
    );

    expect(preservedJewel.costCop).toBe(soldJewel.costCop);
    expect(summarizeStockJewel(preservedJewel).resultCop).toBe(
      summarizeStockJewel(soldJewel).resultCop
    );
    expect(buildDailyReport('2026-08-04', [], [], [preservedJewel])).toEqual(
      buildDailyReport('2026-08-04', [], [moved.lot], [soldJewel])
    );
    expect(buildMonthlyReport('2026-08', [], [], [preservedJewel])).toEqual(
      buildMonthlyReport('2026-08', [], [moved.lot], [soldJewel])
    );
    expect(
      buildSalesAnalytics({
        period: 'mes',
        anchorDate: '2026-08-04',
        stockJewels: [preservedJewel]
      })
    ).toEqual(
      buildSalesAnalytics({
        period: 'mes',
        anchorDate: '2026-08-04',
        stoneLots: [moved.lot],
        stockJewels: [soldJewel]
      })
    );
  });
});
