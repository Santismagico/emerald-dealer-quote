import { describe, expect, it } from 'vitest';
import type { BackupFile, StockJewel, StoneLot } from '../types';
import { parseBackup } from './backup';
import { attributedStoneCostCop } from './stoneJewelTransformation';

const lot: StoneLot = {
  id: 'lot-1',
  name: 'Lote natural',
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
  internalUses: [{
    id: 'transform-1',
    date: '2026-08-04',
    carats: 1,
    quantity: 1,
    origin: 'bruto',
    jewelId: 'jewel-1',
    costCop: 100_000,
    notes: 'Cambio de vitrina'
  }],
  notes: '',
  sales: [],
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-04T10:00:00.000Z'
};

const jewel: StockJewel = {
  id: 'jewel-1',
  name: 'Anillo de vitrina',
  pieceType: 'anillo',
  material: 'Oro',
  photo: '',
  extraPhotos: [],
  acquiredDate: '2026-08-02',
  weightGrams: 4.5,
  size: '7',
  stoneCount: 1,
  stoneKind: 'natural',
  costCop: 600_000,
  priceCop: 1_200_000,
  status: 'disponible',
  notes: '',
  sale: null,
  collectionId: null,
  stoneTransformations: [{
    id: 'transform-1',
    date: '2026-08-04',
    lotId: 'lot-1',
    jewelId: 'jewel-1',
    origin: 'bruto',
    carats: 1,
    quantity: 1,
    costCop: 100_000,
    notes: 'Cambio de vitrina',
    fromStoneKind: 'fantasia',
    toStoneKind: 'natural'
  }],
  createdAt: '2026-08-02T10:00:00.000Z',
  updatedAt: '2026-08-04T10:00:00.000Z'
};

function backup(overrides: Partial<BackupFile> = {}): BackupFile {
  return {
    app: 'emerald-dealer-quote',
    version: 8,
    exportedAt: '2026-08-04T11:00:00.000Z',
    settings: null,
    clients: [],
    quotes: [],
    appointments: [],
    stoneLots: [lot],
    suppliers: [],
    buyers: [],
    stockJewels: [jewel],
    materialPartners: [],
    materialLots: [],
    expenses: [],
    fundContributions: [],
    ...overrides
  };
}

describe('respaldo de transformaciones de joyas', () => {
  it('conserva exactamente las dos mitades de una transformación válida', () => {
    const parsed = parseBackup(JSON.stringify(backup()));

    expect(parsed.stoneLots[0].internalUses).toEqual(lot.internalUses);
    expect(parsed.stockJewels[0].stoneTransformations).toEqual(jewel.stoneTransformations);
    expect(parsed.stockJewels[0].costCop).toBe(600_000);
  });

  it('conserva el costo histórico aunque el costo actual del lote ya sea distinto', () => {
    const changedLot: StoneLot = { ...lot, purchaseValueCop: 2_000_000 };
    expect(attributedStoneCostCop(changedLot, 1)).toBe(200_000);

    const parsed = parseBackup(JSON.stringify(backup({ stoneLots: [changedLot] })));

    expect(parsed.stoneLots[0].internalUses[0].costCop).toBe(100_000);
    expect(parsed.stockJewels[0].stoneTransformations[0].costCop).toBe(100_000);
    expect(parsed.stockJewels[0].costCop).toBe(600_000);
  });

  it('mantiene compatibles los respaldos anteriores sin los campos de C2', () => {
    const legacyLot = { ...lot } as Record<string, unknown>;
    const legacyJewel = { ...jewel } as Record<string, unknown>;
    delete legacyLot.internalUses;
    delete legacyJewel.weightGrams;
    delete legacyJewel.size;
    delete legacyJewel.stoneCount;
    delete legacyJewel.stoneKind;
    delete legacyJewel.stoneTransformations;
    delete legacyJewel.extraPhotos;
    legacyJewel.costCop = 500_000;

    const parsed = parseBackup(JSON.stringify(backup({
      stoneLots: [legacyLot as unknown as StoneLot],
      stockJewels: [legacyJewel as unknown as StockJewel]
    })));

    expect(parsed.stoneLots[0].internalUses).toEqual([]);
    expect(parsed.stockJewels[0]).toMatchObject({
      weightGrams: 0,
      size: '',
      stoneCount: 0,
      stoneKind: '',
      stoneTransformations: [],
      photo: '',
      extraPhotos: [],
      costCop: 500_000,
      priceCop: 1_200_000
    });
  });

  it('restaura una joya con el lote eliminado si conserva su nombre histórico', () => {
    const snapshotJewel: StockJewel = {
      ...jewel,
      stoneTransformations: [
        { ...jewel.stoneTransformations[0], lotName: 'Lote natural eliminado' }
      ]
    };
    const parsed = parseBackup(
      JSON.stringify(backup({ stoneLots: [], stockJewels: [snapshotJewel] }))
    );

    expect(parsed.stoneLots).toEqual([]);
    expect(parsed.stockJewels[0].costCop).toBe(600_000);
    expect(parsed.stockJewels[0].stoneTransformations[0].lotName).toBe(
      'Lote natural eliminado'
    );
  });

  it('rechaza una mitad huérfana o datos distintos antes de importar', () => {
    expect(() => parseBackup(JSON.stringify(backup({ stockJewels: [] })))).toThrow(
      /no tiene su transformación/i
    );
    expect(() => parseBackup(JSON.stringify(backup({ stoneLots: [] })))).toThrow(
      /no tiene su uso interno/i
    );
    expect(() => parseBackup(JSON.stringify(backup({
      stockJewels: [{
        ...jewel,
        stoneTransformations: [{ ...jewel.stoneTransformations[0], costCop: 99_999 }]
      }]
    })))).toThrow(/no coinciden/i);
  });

  it('rechaza tipos corruptos en vez de normalizarlos silenciosamente', () => {
    const corrupt = backup() as unknown as Record<string, unknown>;
    corrupt.stoneLots = [{ ...lot, internalUses: [{ ...lot.internalUses[0], quantity: 1.5 }] }];
    expect(() => parseBackup(JSON.stringify(corrupt))).toThrow(/usos internos/i);
  });

  it('rechaza costos C2 fuera del rango exacto de JavaScript', () => {
    const unsafe = Number.MAX_SAFE_INTEGER + 1;
    expect(() => parseBackup(JSON.stringify(backup({
      stoneLots: [{
        ...lot,
        internalUses: [{ ...lot.internalUses[0], costCop: unsafe }]
      }]
    })))).toThrow(/usos internos/i);
    expect(() => parseBackup(JSON.stringify(backup({
      stockJewels: [{
        ...jewel,
        stoneTransformations: [{ ...jewel.stoneTransformations[0], costCop: unsafe }]
      }]
    })))).toThrow(/transformaciones/i);
  });

  it('rechaza una transformación fechada después de la venta', () => {
    expect(() => parseBackup(JSON.stringify(backup({
      stockJewels: [{
        ...jewel,
        sale: {
          id: 'sale-1',
          date: '2026-08-03',
          buyer: 'Comprador',
          buyerId: null,
          priceCop: 1_200_000,
          productType: 'Joya con piedra natural',
          usdRate: null,
          method: 'Transferencia',
          receivedBy: 'Santiago',
          notes: ''
        }
      }]
    })))).toThrow(/fecha de venta/i);
  });
});
