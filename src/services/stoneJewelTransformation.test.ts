import { describe, expect, it } from 'vitest';
import type { StockJewel, StoneLot } from '../types';
import { stonesFlow, summarizeStoneLot } from './stones';
import {
  stockJewelAcquisitionCostCop,
  summarizeStockJewel,
  validateStockJewelStoneHistory
} from './stockJewels';
import {
  attributedStoneCostCop,
  transformStockJewelToNatural,
  validateStoneJewelTransformation,
  validateStoneJewelTransformationLink,
  type StoneJewelTransformationInput
} from './stoneJewelTransformation';

function lot(overrides: Partial<StoneLot> = {}): StoneLot {
  return {
    id: 'lot-1',
    name: 'Lote C2',
    stoneType: 'Esmeralda',
    description: '',
    purchaseDate: '2026-08-01',
    supplier: '',
    supplierId: null,
    carats: 10,
    quantity: 10,
    purchaseValueCop: 1000000,
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
    updatedAt: '2026-08-01T09:00:00.000Z',
    ...overrides
  };
}

function jewel(overrides: Partial<StockJewel> = {}): StockJewel {
  return {
    id: 'jewel-1',
    name: 'Anillo C2',
    pieceType: 'anillo',
    material: 'Oro',
    photo: '',
    acquiredDate: '2026-08-01',
    weightGrams: 4.5,
    size: '7',
    stoneCount: 2,
    stoneKind: 'fantasia',
    costCop: 500000,
    priceCop: 1500000,
    status: 'disponible',
    notes: '',
    sale: null,
    collectionId: null,
    stoneTransformations: [],
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-08-01T09:00:00.000Z',
    ...overrides
  };
}

function input(overrides: Partial<StoneJewelTransformationInput> = {}): StoneJewelTransformationInput {
  return {
    id: 'transform-1',
    date: '2026-08-04',
    lotId: 'lot-1',
    jewelId: 'jewel-1',
    origin: 'bruto',
    carats: 2,
    quantity: 2,
    notes: 'Cambio de vitrina',
    ...overrides
  };
}

describe('transformacion fantasia a natural (C2)', () => {
  it('actualiza joya y lote con el mismo evento, sin mutar las entradas', () => {
    const originalLot = lot();
    const originalJewel = jewel();
    const lotSnapshot = structuredClone(originalLot);
    const jewelSnapshot = structuredClone(originalJewel);

    const result = transformStockJewelToNatural(
      originalLot,
      originalJewel,
      input(),
      '2026-08-04T15:00:00.000Z'
    );

    expect(originalLot).toEqual(lotSnapshot);
    expect(originalJewel).toEqual(jewelSnapshot);
    expect(result.attributedCostCop).toBe(200000);
    expect(result.lot.internalUses).toEqual([result.internalUse]);
    expect(result.jewel.stoneTransformations).toEqual([result.transformation]);
    expect(result.internalUse.id).toBe(result.transformation.id);
    expect(validateStoneJewelTransformationLink(result.internalUse, result.transformation)).toBeNull();
    expect(result.jewel).toMatchObject({
      stoneKind: 'natural',
      stoneCount: 2,
      costCop: 700000,
      updatedAt: '2026-08-04T15:00:00.000Z'
    });
    expect(summarizeStoneLot(result.lot)).toMatchObject({
      rawAvailableCarats: 8,
      rawAvailableQuantity: 8,
      internalAttributedCost: 200000
    });
  });

  it('conserva el resultado combinado: el costo sale del lote y entra a la joya', () => {
    const originalLot = lot();
    const originalJewel = jewel();
    const before =
      summarizeStoneLot(originalLot).result + summarizeStockJewel(originalJewel).resultCop;
    const transformed = transformStockJewelToNatural(
      originalLot,
      originalJewel,
      input(),
      '2026-08-04T15:00:00.000Z'
    );
    const after =
      summarizeStoneLot(transformed.lot).result + summarizeStockJewel(transformed.jewel).resultCop;

    expect(summarizeStoneLot(transformed.lot).result).toBe(-800000);
    expect(summarizeStockJewel(transformed.jewel).resultCop).toBe(800000);
    expect(after).toBe(before);
    expect(stonesFlow([transformed.lot]).balance).toBe(stonesFlow([originalLot]).balance);
    expect(stonesFlow([transformed.lot]).totalInternalAttributed).toBe(200000);
  });

  it('descuenta tambien de la existencia tallada y usa inversion pagada', () => {
    const source = lot({
      cuttingBatches: [{
        id: 'batch-1',
        sentDate: '2026-08-02',
        sentCarats: 4,
        sentQuantity: 4,
        returnedDate: '2026-08-03',
        returnedCarats: 1.2,
        returnedQuantity: 5,
        cuttingCostCop: 200000,
        cuttingPaidDate: '2026-08-03',
        notes: ''
      }]
    });
    const result = transformStockJewelToNatural(
      source,
      jewel(),
      input({ origin: 'tallado', carats: 0.5, quantity: 2 }),
      '2026-08-04T15:00:00.000Z'
    );

    expect(attributedStoneCostCop(source, 0.5)).toBe(60000);
    expect(result.attributedCostCop).toBe(60000);
    expect(summarizeStoneLot(result.lot)).toMatchObject({
      cutAvailableCarats: 0.7,
      cutAvailableQuantity: 3,
      rawAvailableCarats: 6,
      inCuttingCarats: 0
    });
  });

  it('mantiene derivable el costo original que salio de caja', () => {
    const result = transformStockJewelToNatural(
      lot(),
      jewel(),
      input(),
      '2026-08-04T15:00:00.000Z'
    );
    expect(result.jewel.costCop).toBe(700000);
    expect(stockJewelAcquisitionCostCop(result.jewel)).toBe(500000);
  });
});

describe('rechazos de la transformacion C2', () => {
  it('rechaza consumir mas de la existencia declarada', () => {
    expect(validateStoneJewelTransformation(lot(), jewel(), input({ carats: 11 }))).toMatch(
      /solo tiene 10 ct/i
    );
    expect(validateStoneJewelTransformation(lot(), jewel({ stoneCount: 0 }), input({ quantity: 11 }))).toMatch(
      /solo tiene 10 piedra/i
    );
  });

  it('conserva la cantidad ya registrada y permite completar el dato historico vacio', () => {
    expect(
      validateStoneJewelTransformation(lot(), jewel({ stoneCount: 3 }), input({ quantity: 2 }))
    ).toMatch(/debe conservar esa cantidad/i);

    const completed = transformStockJewelToNatural(
      lot(),
      jewel({ stoneCount: 0 }),
      input({ quantity: 2 }),
      '2026-08-04T15:00:00.000Z'
    );
    expect(completed.jewel.stoneCount).toBe(2);
  });

  it('rechaza una joya vendida, natural o ya transformada', () => {
    const sold = jewel({
      sale: {
        id: 'sale-1',
        date: '2026-08-03',
        buyer: '',
        buyerId: null,
        priceCop: 1500000,
        productType: '',
        usdRate: null,
        receivedBy: '',
        method: '',
        notes: ''
      }
    });
    expect(validateStoneJewelTransformation(lot(), sold, input())).toMatch(/vendida/i);
    expect(validateStoneJewelTransformation(lot(), jewel({ stoneKind: 'natural' }), input())).toMatch(
      /ya tiene piedra natural/i
    );

    const first = transformStockJewelToNatural(
      lot(),
      jewel(),
      input(),
      '2026-08-04T15:00:00.000Z'
    );
    expect(
      validateStoneJewelTransformation(
        first.lot,
        first.jewel,
        input({ id: 'transform-2', carats: 1, quantity: 1 })
      )
    ).toMatch(/ya tiene piedra natural|otra vez/i);
  });

  it('rechaza identidades, fechas y precision que no conservan historia exacta', () => {
    expect(validateStoneJewelTransformation(lot(), jewel(), input({ lotId: 'otro' }))).toMatch(
      /no coinciden/i
    );
    expect(validateStoneJewelTransformation(lot(), jewel(), input({ date: '2026-07-31' }))).toMatch(
      /antes/i
    );
    expect(validateStoneJewelTransformation(lot(), jewel(), input({ carats: 0.1234 }))).toMatch(
      /tres decimales/i
    );
    expect(
      validateStoneJewelTransformation(lot({ purchaseDate: '' }), jewel(), input())
    ).toMatch(/fecha de compra valida/i);
    expect(
      validateStoneJewelTransformation(lot(), jewel({ acquiredDate: '' }), input())
    ).toMatch(/fecha de entrada valida/i);
  });

  it('rechaza costos que no se pueden conservar exactamente en el dispositivo', () => {
    const unsafe = Number.MAX_SAFE_INTEGER + 1;
    expect(validateStoneJewelTransformation(
      lot({ purchaseValueCop: unsafe }),
      jewel({ stoneCount: 0 }),
      input({ carats: 10, quantity: 10 })
    )).toMatch(/rango seguro/i);
    expect(validateStoneJewelTransformation(
      lot(),
      jewel({ costCop: unsafe }),
      input()
    )).toMatch(/rango seguro/i);
  });

  it('bloquea cambiar o deshacer una historia ya registrada', () => {
    const first = transformStockJewelToNatural(
      lot(),
      jewel(),
      input(),
      '2026-08-04T15:00:00.000Z'
    );
    expect(
      validateStockJewelStoneHistory(
        { ...first.jewel, stoneTransformations: [] },
        first.jewel
      )
    ).toMatch(/no se puede cambiar ni deshacer/i);
    expect(
      validateStockJewelStoneHistory({ ...first.jewel, stoneCount: 1 }, first.jewel)
    ).toMatch(/debe conservar la cantidad/i);
    expect(
      validateStoneJewelTransformationLink(
        { ...first.internalUse, quantity: 1 },
        first.transformation
      )
    ).toMatch(/no coinciden/i);
  });
});
