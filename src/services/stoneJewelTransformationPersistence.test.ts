import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IDBFactory as FakeIDBFactory,
  IDBObjectStore as FakeIDBObjectStore
} from 'fake-indexeddb';
import type { StockJewel, StoneLot } from '../types';

let storage: typeof import('./storage');
let db: typeof import('./db');

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new FakeIDBFactory());
  storage = await import('./storage');
  db = await import('./db');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

function lot(overrides: Partial<StoneLot> = {}): StoneLot {
  return {
    purchaseOrigin: 'bruto',
    id: 'lot-c2',
    name: 'Lote para joyas',
    stoneType: 'Esmeralda',
    description: '',
    purchaseDate: '2026-08-01',
    supplier: '',
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
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-08-01T09:00:00.000Z',
    ...overrides
  };
}

function jewel(overrides: Partial<StockJewel> = {}): StockJewel {
  return {
    id: 'jewel-c2',
    name: 'Anillo de fantasía',
    pieceType: 'anillo',
    material: 'Oro',
    photo: '',
    acquiredDate: '2026-08-01',
    weightGrams: 5,
    size: '7',
    stoneCount: 1,
    stoneKind: 'fantasia',
    costCop: 3_000_000,
    priceCop: 8_000_000,
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

function transformationInput(overrides: Record<string, unknown> = {}) {
  return {
    id: 'transformation-c2',
    date: '2026-08-04',
    lotId: 'lot-c2',
    jewelId: 'jewel-c2',
    origin: 'bruto' as const,
    carats: 2,
    quantity: 1,
    notes: 'Cambio por piedra natural',
    ...overrides
  };
}

describe('persistencia atómica de la transformación de una joya', () => {
  it('guarda el mismo traslado en el lote y en la joya', async () => {
    await storage.saveStoneLot(lot());
    await storage.saveStockJewel(jewel());

    const result = await storage.transformStockJewelToNatural(transformationInput());
    const [storedLot] = await storage.listStoneLots();
    const [storedJewel] = await storage.listStockJewels();

    expect(result.attributedCostCop).toBe(2_000_000);
    expect(storedLot.internalUses).toEqual([result.internalUse]);
    expect(storedJewel.stoneTransformations).toEqual([result.transformation]);
    expect(storedLot.internalUses[0]).toMatchObject({
      id: 'transformation-c2',
      jewelId: 'jewel-c2',
      carats: 2,
      quantity: 1,
      origin: 'bruto',
      costCop: 2_000_000
    });
    expect(storedJewel.stoneTransformations[0]).toMatchObject({
      id: 'transformation-c2',
      lotId: 'lot-c2',
      jewelId: 'jewel-c2',
      fromStoneKind: 'fantasia',
      toStoneKind: 'natural',
      costCop: 2_000_000
    });
    expect(storedJewel.stoneKind).toBe('natural');
    expect(storedJewel.costCop).toBe(5_000_000);
  });

  it('revierte el lote completo si falla la segunda escritura', async () => {
    const originalLot = lot();
    const originalJewel = jewel();
    await storage.saveStoneLot(originalLot);
    await storage.saveStockJewel(originalJewel);

    const originalPut = FakeIDBObjectStore.prototype.put;
    vi.spyOn(FakeIDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey
    ) {
      const candidate = value as { stoneTransformations?: unknown[] };
      if (this.name === 'stockJewels' && (candidate.stoneTransformations?.length ?? 0) > 0) {
        throw new Error('fallo simulado en la segunda escritura');
      }
      return key === undefined
        ? originalPut.call(this, value)
        : originalPut.call(this, value, key);
    });

    await expect(
      storage.transformStockJewelToNatural(transformationInput())
    ).rejects.toThrow('fallo simulado en la segunda escritura');

    expect(await storage.listStoneLots()).toEqual([originalLot]);
    expect(await storage.listStockJewels()).toEqual([originalJewel]);
  });

  it('si el lote no existe, no cambia la joya', async () => {
    const originalJewel = jewel();
    await storage.saveStockJewel(originalJewel);

    await expect(
      storage.transformStockJewelToNatural(
        transformationInput({ lotId: 'lot-ausente' })
      )
    ).rejects.toThrow(/lote/i);

    expect(await storage.listStoneLots()).toEqual([]);
    expect(await storage.listStockJewels()).toEqual([originalJewel]);
  });

  it('si la joya no existe, no cambia el lote', async () => {
    const originalLot = lot();
    await storage.saveStoneLot(originalLot);

    await expect(
      storage.transformStockJewelToNatural(
        transformationInput({ jewelId: 'joya-ausente' })
      )
    ).rejects.toThrow(/joya/i);

    expect(await storage.listStoneLots()).toEqual([originalLot]);
    expect(await storage.listStockJewels()).toEqual([]);
  });

  it('permite borrar el lote, conserva su nombre y sigue protegiendo la joya', async () => {
    await storage.saveStoneLot(lot());
    await storage.saveStockJewel(jewel());
    await storage.transformStockJewelToNatural(transformationInput());

    await storage.deleteStoneLot('lot-c2');
    expect(await storage.listStoneLots()).toEqual([]);
    const [preservedJewel] = await storage.listStockJewels();
    expect(preservedJewel.costCop).toBe(5_000_000);
    expect(preservedJewel.stoneTransformations[0]).toMatchObject({
      lotId: 'lot-c2',
      lotName: 'Lote para joyas',
      costCop: 2_000_000
    });
    await expect(storage.deleteStockJewel('jewel-c2')).rejects.toThrow(/historia/i);

    expect((await storage.listStockJewels()).map((item) => item.id)).toEqual(['jewel-c2']);
  });

  it('impide fabricar historiales mediante los guardados normales', async () => {
    const fakeUse = {
      id: 'historia-falsa',
      date: '2026-08-04',
      carats: 1,
      quantity: 1,
      origin: 'bruto' as const,
      jewelId: 'jewel-c2',
      costCop: 1_000_000,
      notes: ''
    };
    const fakeTransformation = {
      ...fakeUse,
      lotId: 'lot-c2',
      fromStoneKind: 'fantasia' as const,
      toStoneKind: 'natural' as const
    };

    await expect(storage.saveStoneLot(lot({ internalUses: [fakeUse] }))).rejects.toThrow(
      /solo se registran al transformar/i
    );
    await expect(storage.saveStockJewel(jewel({
      stoneKind: 'natural',
      costCop: 4_000_000,
      stoneTransformations: [fakeTransformation]
    }))).rejects.toThrow(/solo se registra al transformar/i);
  });

  it('permite editar otros datos sin alterar una transformación ya registrada', async () => {
    await storage.saveStoneLot(lot());
    await storage.saveStockJewel(jewel());
    await storage.transformStockJewelToNatural(transformationInput());
    const [storedLot] = await storage.listStoneLots();
    const [storedJewel] = await storage.listStockJewels();

    await storage.saveStoneLot({ ...storedLot, notes: 'Nota corregida' });
    await storage.saveStockJewel({ ...storedJewel, notes: 'Vitrina principal' });

    expect((await storage.listStoneLots())[0].internalUses).toEqual(storedLot.internalUses);
    expect((await storage.listStockJewels())[0].stoneTransformations).toEqual(
      storedJewel.stoneTransformations
    );
  });

  it('reconcilia costo remoto distinto sustituyendo lote y joya juntos', async () => {
    await storage.saveStoneLot(lot());
    await storage.saveStockJewel(jewel());
    const local = await storage.transformStockJewelToNatural(transformationInput());
    const authoritativeCost = local.attributedCostCop + 50_000;
    const authoritativeLot = {
      ...local.lot,
      internalUses: [{ ...local.internalUse, costCop: authoritativeCost }]
    };
    const authoritativeJewel = {
      ...local.jewel,
      costCop: local.jewel.costCop + 50_000,
      stoneTransformations: [{ ...local.transformation, costCop: authoritativeCost }]
    };

    await storage.reconcileAuthoritativeStoneJewelTransformation({
      lot: authoritativeLot,
      jewel: authoritativeJewel
    });

    expect((await storage.listStoneLots())[0].internalUses[0].costCop).toBe(authoritativeCost);
    expect((await storage.listStockJewels())[0]).toMatchObject({
      costCop: authoritativeJewel.costCop,
      stoneTransformations: [{ costCop: authoritativeCost }]
    });
    expect(await db.dbGet<Record<string, unknown>>('stoneLots', authoritativeLot.id)).toMatchObject({
      cloudUpdatedAt: authoritativeLot.updatedAt
    });
    expect(await db.dbGet<Record<string, unknown>>('stockJewels', authoritativeJewel.id)).toMatchObject({
      cloudUpdatedAt: authoritativeJewel.updatedAt
    });
  });

  it('no guarda un lote remoto con otra mitad de joya que todavia falta', async () => {
    await storage.saveStoneLot(lot());
    await storage.saveStockJewel(jewel());
    const local = await storage.transformStockJewelToNatural(transformationInput());
    const extraUse = {
      ...local.internalUse,
      id: 'event-other-device',
      jewelId: 'jewel-other-device',
      carats: 0.5,
      costCop: 500_000
    };

    await expect(storage.reconcileAuthoritativeStoneJewelTransformation({
      lot: { ...local.lot, internalUses: [...local.lot.internalUses, extraUse] },
      jewel: local.jewel
    })).rejects.toThrow(/actualizar toda la historia/i);

    expect((await storage.listStoneLots())[0]).toEqual(local.lot);
    expect((await storage.listStockJewels())[0]).toEqual(local.jewel);
  });

  it('rechaza una respuesta remota descuadrada sin tocar ninguna mitad', async () => {
    await storage.saveStoneLot(lot());
    await storage.saveStockJewel(jewel());
    const local = await storage.transformStockJewelToNatural(transformationInput());

    await expect(storage.reconcileAuthoritativeStoneJewelTransformation({
      lot: local.lot,
      jewel: {
        ...local.jewel,
        stoneTransformations: [{ ...local.transformation, costCop: 1 }]
      }
    })).rejects.toThrow(/no cuadra/i);

    expect((await storage.listStoneLots())[0]).toEqual(local.lot);
    expect((await storage.listStockJewels())[0]).toEqual(local.jewel);
  });
});
