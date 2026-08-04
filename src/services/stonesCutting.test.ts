import { describe, expect, it } from 'vitest';
import type { CuttingBatch, StoneLot, StoneSale } from '../types';
import { normalizeStoneLot } from './schema';
import {
  summarizeStoneLot,
  summarizeStonePartnership,
  validateCuttingBatch,
  validateStoneLotInventory,
  validateStoneLotSalesMetadata,
  validateStoneSale
} from './stones';

function sale(overrides: Partial<StoneSale> = {}): StoneSale {
  return {
    id: 'sale-1',
    date: '2026-08-04',
    buyer: 'Comprador',
    buyerId: null,
    carats: 1,
    quantity: 1,
    origin: 'bruto',
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

function batch(overrides: Partial<CuttingBatch> = {}): CuttingBatch {
  return {
    id: 'batch-1',
    sentDate: '2026-08-02',
    sentCarats: 4,
    sentQuantity: 4,
    returnedDate: '',
    returnedCarats: 0,
    returnedQuantity: 0,
    cuttingCostCop: 0,
    cuttingPaidDate: '',
    notes: '',
    ...overrides
  };
}

function lot(overrides: Partial<StoneLot> = {}): StoneLot {
  return {
    id: 'lot-1',
    name: 'Lote C1',
    stoneType: 'Esmeralda',
    description: '',
    purchaseDate: '2026-08-01',
    supplier: 'Proveedor',
    supplierId: null,
    carats: 10,
    quantity: 10,
    purchaseValueCop: 10_000_000,
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

describe('C1: compatibilidad histórica', () => {
  it('un lote anterior conserva exactamente existencias, dinero y resultado', () => {
    const original = lot({ sales: [sale({ carats: 2, quantity: 2, valueCop: 3_000_000 })] });
    const legacy = JSON.parse(JSON.stringify(original)) as Record<string, unknown>;
    delete legacy.cuttingBatches;
    for (const rawSale of legacy.sales as Array<Record<string, unknown>>) delete rawSale.origin;

    const before = summarizeStoneLot(legacy as unknown as StoneLot);
    const normalized = normalizeStoneLot(legacy);
    const after = summarizeStoneLot(normalized);

    expect(normalized.cuttingBatches).toEqual([]);
    expect(normalized.sales[0].origin).toBe('bruto');
    expect({
      raw: [after.rawAvailableCarats, after.rawAvailableQuantity],
      sold: [after.soldCarats, after.soldQuantity, after.soldValue],
      invested: after.totalInvested,
      result: after.result
    }).toEqual({
      raw: [before.rawAvailableCarats, before.rawAvailableQuantity],
      sold: [before.soldCarats, before.soldQuantity, before.soldValue],
      invested: before.totalInvested,
      result: before.result
    });
  });
});

describe('C1: existencias por estado', () => {
  it('separa un envío parcial pendiente entre bruto y en talla', () => {
    const summary = summarizeStoneLot(lot({ cuttingBatches: [batch()] }));
    expect(summary).toMatchObject({
      rawAvailableCarats: 6,
      rawAvailableQuantity: 6,
      inCuttingCarats: 4,
      inCuttingQuantity: 4,
      cutAvailableCarats: 0,
      cutAvailableQuantity: 0
    });
  });

  it('registra merma y permite que una piedra regrese dividida en más piezas', () => {
    const returned = batch({
      returnedDate: '2026-08-03',
      returnedCarats: 3.2,
      returnedQuantity: 5
    });
    expect(validateCuttingBatch(lot(), returned)).toBeNull();
    const summary = summarizeStoneLot(lot({ cuttingBatches: [returned] }));
    expect(summary).toMatchObject({
      rawAvailableCarats: 6,
      rawAvailableQuantity: 6,
      inCuttingCarats: 0,
      cutAvailableCarats: 3.2,
      cutAvailableQuantity: 5
    });
    expect(summary.cuttingLossRatio).toBeCloseTo(0.2, 10);
  });

  it('combina una tanda regresada con una segunda tanda pendiente', () => {
    const summary = summarizeStoneLot(
      lot({
        cuttingBatches: [
          batch({ returnedDate: '2026-08-03', returnedCarats: 3, returnedQuantity: 4 }),
          batch({ id: 'batch-2', sentDate: '2026-08-04', sentCarats: 2, sentQuantity: 2 })
        ]
      })
    );
    expect(summary).toMatchObject({
      rawAvailableCarats: 4,
      rawAvailableQuantity: 4,
      inCuttingCarats: 2,
      inCuttingQuantity: 2,
      cutAvailableCarats: 3,
      cutAvailableQuantity: 4
    });
  });

  it('rechaza sobreenvíos y devoluciones con más quilates', () => {
    expect(validateCuttingBatch(lot(), batch({ sentCarats: 11 }))).toContain('10 ct');
    expect(validateCuttingBatch(lot(), batch({ sentQuantity: 11 }))).toContain('10 piedra');
    expect(
      validateCuttingBatch(
        lot(),
        batch({ returnedDate: '2026-08-03', returnedCarats: 4.001, returnedQuantity: 4 })
      )
    ).toContain('más quilates');
  });

  it('rechaza ventas talladas antes del regreso o superiores a lo regresado', () => {
    const pending = lot({ cuttingBatches: [batch()] });
    expect(validateStoneSale(pending, sale({ origin: 'tallado' }))).toContain('0 piedra');

    const returned = lot({
      cuttingBatches: [
        batch({ returnedDate: '2026-08-03', returnedCarats: 3, returnedQuantity: 5 })
      ]
    });
    expect(
      validateStoneSale(returned, sale({ origin: 'tallado', carats: 3.1, quantity: 1 }))
    ).toContain('3 ct');
    expect(
      validateStoneSale(returned, sale({ origin: 'tallado', carats: 1, quantity: 6 }))
    ).toContain('5 piedra');
  });
});

describe('C1: historial y dinero', () => {
  it('protege los datos físicos tras vender tallado, pero permite pagar la talla después', () => {
    const returned = batch({
      returnedDate: '2026-08-03',
      returnedCarats: 3.5,
      returnedQuantity: 4,
      cuttingCostCop: 400_000
    });
    const previous = lot({
      cuttingBatches: [returned],
      sales: [sale({ origin: 'tallado', carats: 1, quantity: 1 })]
    });
    const paid = lot({
      ...previous,
      cuttingBatches: [
        { ...returned, cuttingPaidDate: '2026-08-04', notes: 'Pagado por transferencia' }
      ]
    });
    expect(validateStoneLotInventory(paid, previous)).toBeNull();

    const changedWeight = lot({
      ...previous,
      cuttingBatches: [{ ...returned, returnedCarats: 3.4 }]
    });
    expect(validateStoneLotInventory(changedWeight, previous)).toContain('datos físicos');
    expect(validateStoneLotInventory({ ...previous, cuttingBatches: [] }, previous)).not.toBeNull();
  });

  it('suma solo tallas pagadas a la inversión, resultado y reparto exacto', () => {
    const shared = lot({
      purchaseValueCop: 1_000_000,
      partnerId: 'partner-1',
      partnerName: 'Socio',
      myPercent: 60,
      cuttingBatches: [
        batch({ cuttingCostCop: 200_001, cuttingPaidDate: '2026-08-04' }),
        batch({ id: 'batch-2', sentCarats: 1, sentQuantity: 1, cuttingCostCop: 300_000 })
      ],
      sales: [sale({ carats: 1, quantity: 1, valueCop: 2_000_002 })]
    });
    const summary = summarizeStoneLot(shared);
    const partnership = summarizeStonePartnership(shared);
    expect(summary).toMatchObject({
      totalCuttingCost: 500_001,
      paidCuttingCost: 200_001,
      unpaidCuttingCost: 300_000,
      totalInvested: 1_200_001,
      result: 800_001
    });
    expect(partnership).toMatchObject({ realResult: 800_001, myResult: 480_001, partnerResult: 320_000 });
    expect(partnership.myResult + partnership.partnerResult).toBe(partnership.realResult);
  });

  it('rechaza la forma cruda dañada antes de normalizarla', () => {
    const raw = { ...lot(), cuttingBatches: 'se perdió el arreglo' };
    expect(validateStoneLotSalesMetadata(raw)).toContain('tandas de talla');
    expect(
      validateStoneLotSalesMetadata({
        ...lot(),
        cuttingBatches: [{ ...batch(), sentQuantity: 1.5 }]
      })
    ).toContain('datos inválidos');
  });
});
