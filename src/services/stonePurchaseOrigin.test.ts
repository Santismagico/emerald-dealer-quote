import { describe, expect, it } from 'vitest';
import type { CuttingBatch, StoneInternalUse, StoneLot, StoneSale } from '../types';
import { normalizeStoneLot } from './schema';
import {
  stoneLotPurchaseOrigin,
  summarizeStoneLot,
  summarizeStonePartnership,
  validateCuttingBatch,
  validateStoneInternalUse,
  validateStoneLotInventory,
  validateStoneSale
} from './stones';

function lot(overrides: Partial<StoneLot> = {}): StoneLot {
  return {
    purchaseOrigin: 'bruto',
    id: 'lot-c2',
    name: 'Lote C2',
    stoneType: 'Esmeralda',
    description: '',
    purchaseDate: '2026-08-01',
    supplier: 'Proveedor',
    supplierId: null,
    carats: 5,
    quantity: 5,
    purchaseValueCop: 5_000_000,
    partnerId: null,
    partnerName: '',
    myPercent: 100,
    onCredit: false,
    supplierPayments: [],
    cuttingBatches: [],
    internalUses: [],
    notes: '',
    sales: [],
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-08-01T12:00:00.000Z',
    ...overrides
  };
}

function sale(overrides: Partial<StoneSale> = {}): StoneSale {
  return {
    id: 'sale-c2',
    date: '2026-08-02',
    buyer: 'Comprador',
    buyerId: null,
    carats: 1,
    quantity: 1,
    origin: 'tallado',
    valueCop: 2_000_000,
    productType: 'Piedra',
    usdRate: 4_000,
    receivedBy: 'Santiago',
    method: 'Transferencia',
    onCredit: false,
    dueDate: '',
    payments: [],
    notes: '',
    ...overrides
  };
}

function use(overrides: Partial<StoneInternalUse> = {}): StoneInternalUse {
  return {
    id: 'use-c2',
    date: '2026-08-03',
    carats: 0.5,
    quantity: 1,
    origin: 'tallado',
    jewelId: 'jewel-c2',
    costCop: 500_000,
    notes: '',
    ...overrides
  };
}

function batch(): CuttingBatch {
  return {
    id: 'batch-c2',
    sentDate: '2026-08-02',
    sentCarats: 1,
    sentQuantity: 1,
    returnedDate: '',
    returnedCarats: 0,
    returnedQuantity: 0,
    cuttingCostCop: 0,
    cuttingPaidDate: '',
    notes: ''
  };
}

describe('C2: estado de compra del lote', () => {
  it('normaliza la historia sin campo como bruto sin cambiar inventario ni dinero', () => {
    const current = lot({
      purchaseOrigin: undefined,
      onCredit: true,
      supplierPayments: [{ id: 'pay-1', date: '2026-08-02', amount: 1_000_000, notes: '' }],
      partnerId: 'partner-1',
      partnerName: 'Socio',
      myPercent: 60,
      sales: [sale({ origin: 'bruto', carats: 2, quantity: 2, valueCop: 3_000_001 })]
    });
    const raw = JSON.parse(JSON.stringify(current)) as Record<string, unknown>;
    delete raw.purchaseOrigin;
    const before = summarizeStoneLot(raw as unknown as StoneLot);
    const beforeSplit = summarizeStonePartnership(raw as unknown as StoneLot);
    const normalized = normalizeStoneLot(raw);
    const after = summarizeStoneLot(normalized);

    expect(normalized.purchaseOrigin).toBe('bruto');
    expect(stoneLotPurchaseOrigin(raw as unknown as StoneLot)).toBe('bruto');
    expect(after).toMatchObject({
      rawAvailableCarats: before.rawAvailableCarats,
      rawAvailableQuantity: before.rawAvailableQuantity,
      cutAvailableCarats: before.cutAvailableCarats,
      soldValue: before.soldValue,
      totalInvested: before.totalInvested,
      supplierDebt: before.supplierDebt,
      result: before.result
    });
    expect(summarizeStonePartnership(normalized)).toEqual(beforeSplit);
  });

  it('un lote ya tallado entra directo a tallado y conserva ventas, joyas, credito y sociedad', () => {
    const base = lot({
      purchaseOrigin: 'tallado',
      onCredit: true,
      supplierPayments: [{ id: 'pay-1', date: '2026-08-02', amount: 1_000_000, notes: '' }],
      partnerId: 'partner-1',
      partnerName: 'Socio',
      myPercent: 60
    });
    expect(validateStoneSale(base, sale())).toBeNull();
    expect(validateStoneInternalUse(base, use())).toBeNull();

    const moved = { ...base, sales: [sale()], internalUses: [use()] };
    const summary = summarizeStoneLot(moved);
    expect(summary).toMatchObject({
      rawAvailableCarats: 0,
      rawAvailableQuantity: 0,
      inCuttingCarats: 0,
      inCuttingQuantity: 0,
      cutAvailableCarats: 3.5,
      cutAvailableQuantity: 3,
      cuttingLossRatio: null,
      totalCuttingCost: 0,
      totalInvested: 5_000_000,
      supplierDebt: 4_000_000,
      result: -2_500_000
    });
    expect(summarizeStonePartnership(moved)).toMatchObject({
      shared: true,
      realResult: -3_000_000,
      myResult: -1_800_000,
      partnerResult: -1_200_000
    });
    expect(validateStoneLotInventory(moved)).toBeNull();
  });

  it('impide tandas y salidas en bruto cuando la compra ya estaba tallada', () => {
    const tallado = lot({ purchaseOrigin: 'tallado' });
    expect(validateCuttingBatch(tallado, batch())).toContain('ya tallado');
    expect(validateStoneLotInventory({ ...tallado, cuttingBatches: [batch()] })).toContain(
      'ya tallado'
    );
    expect(validateStoneSale(tallado, sale({ origin: 'bruto' }))).toContain('0 piedra');
  });

  it('protege el estado de compra cuando ya existe historia fisica', () => {
    const previous = lot({ sales: [sale({ origin: 'bruto' })] });
    expect(
      validateStoneLotInventory({ ...previous, purchaseOrigin: 'tallado' }, previous)
    ).toContain('movimientos');
    const empty = lot();
    expect(validateStoneLotInventory({ ...empty, purchaseOrigin: 'tallado' }, empty)).toBeNull();
  });
});
