// Cadena de nube de la ampliación de inventario (D-042 a D-044).
//
// Lo que se prueba aquí no es "que suba algo", sino algo más fino: cuando se
// renombra o se borra un COMPRADOR, la app reescribe su nombre (o suelta el
// vínculo) dentro de las ventas de los lotes y de las joyas. Esos registros
// también cambiaron, así que también tienen que subir. Si no, el otro
// dispositivo se queda con el nombre viejo para siempre.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory as FakeIDBFactory } from 'fake-indexeddb';
import type { Buyer, StockJewel, StoneLot } from '../../types';
import { transformStockJewelToNatural } from '../stoneJewelTransformation';
import { createSupabaseCloudRemote } from './api';
import type { CloudOutboxOperation, CloudTable } from './outbox';

let api: typeof import('./api');
let storage: typeof import('../storage');

/** Cola en memoria: registra lo que la app habría subido, sin red ni servidor. */
function fakeOutbox() {
  const enqueued: Array<{ table: CloudTable; type: string; entityId: string }> = [];
  const payloads: Array<unknown> = [];
  return {
    enqueued,
    payloads,
    outbox: {
      enqueue: async (op: {
        table: CloudTable;
        type: string;
        entityId: string;
        data?: unknown;
      }) => {
        enqueued.push({ table: op.table, type: op.type, entityId: op.entityId });
        payloads.push(op.data);
        return op as unknown as CloudOutboxOperation;
      },
      flush: async () => ({ processed: 0, pending: 0 }),
      list: async () => [],
      status: async () => ({ pending: 0, held: 0, operations: [] }),
      retryHeld: async () => ({ processed: 0, pending: 0 })
    }
  };
}

const noopSync = {
  pullTable: async () => {}, pullStoneJewelPair: async () => {}, pullAll: async () => {}
};
const noopRemote = {
  list: async () => [],
  execute: async () => {},
  nextQuoteNumber: async () => 'ED-2026-0001'
};

function comprador(overrides: Partial<Buyer> = {}): Buyer {
  return {
    id: 'buy-1',
    name: 'Joyería Ejemplo',
    phone: '',
    city: '',
    notes: '',
    createdAt: '2026-07-21T09:00:00.000Z',
    ...overrides
  };
}

function loteConVentaDelComprador(): StoneLot {
  return {
    id: 'lot-1',
    name: 'Lote Ejemplo',
    stoneType: 'Esmeralda',
    description: '',
    purchaseDate: '2026-07-10',
    supplier: '',
    supplierId: null,
    carats: 5,
    quantity: 5,
    purchaseValueCop: 2000000,
    partnerId: null,
    partnerName: '',
    myPercent: 100,
    onCredit: false,
    supplierPayments: [],
    cuttingBatches: [],
    internalUses: [],
    notes: '',
    sales: [
      {
        id: 'sale-1',
        date: '2026-07-15',
        buyer: 'Joyería Ejemplo',
        buyerId: 'buy-1',
        carats: 1,
        quantity: 1,
        origin: 'bruto',
        valueCop: 3000000,
        productType: '',
        usdRate: null,
        onCredit: true,
        dueDate: '2026-08-15',
        payments: [{
          id: 'ab-1',
          date: '2026-07-20',
          amount: 1000000,
          usdRate: null,
          method: 'Transferencia',
          receivedBy: 'Santiago',
          notes: 'Comprobante 123'
        }],
        method: '',
        receivedBy: '',
        notes: 'Venta a crédito'
      }
    ],
    createdAt: '2026-07-10T09:00:00.000Z',
    updatedAt: '2026-07-10T09:00:00.000Z'
  };
}

function joyaVendidaAlComprador(): StockJewel {
  return {
    id: 'j-1',
    name: 'Anillo Ejemplo',
    pieceType: 'anillo',
    material: 'Oro',
    photo: '',
    acquiredDate: '2026-07-05',
    weightGrams: 0,
    size: '',
    stoneCount: 0,
    stoneKind: '',
    costCop: 1000000,
    priceCop: 2000000,
    status: 'disponible',
    notes: '',
    sale: {
      id: 's-1',
      date: '2026-07-18',
      buyer: 'Joyería Ejemplo',
      buyerId: 'buy-1',
      priceCop: 1900000,
      productType: '',
      usdRate: null,
      method: 'Efectivo',
      receivedBy: 'Laura',
      notes: 'Venta de mostrador'
    },
    collectionId: null,
    stoneTransformations: [],
    createdAt: '2026-07-05T09:00:00.000Z',
    updatedAt: '2026-07-05T09:00:00.000Z'
  };
}

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new FakeIDBFactory());
  storage = await import('../storage');
  api = await import('./api');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('renombrar un comprador arrastra sus ventas a la nube', () => {
  it('sube el comprador, el lote y la joya que cambiaron de nombre', async () => {
    await storage.saveBuyer(comprador());
    await storage.saveStoneLot(loteConVentaDelComprador());
    await storage.saveStockJewel(joyaVendidaAlComprador());

    const { enqueued, outbox } = fakeOutbox();
    const source = api.createCloudDataSource({
      remote: noopRemote,
      outbox,
      sync: noopSync
    });

    await source.saveBuyer(comprador({ name: 'Joyería Alterna Ejemplo' }));

    expect(enqueued).toEqual(
      expect.arrayContaining([
        { table: 'buyers', type: 'upsert', entityId: 'buy-1' },
        { table: 'stone_lots', type: 'upsert', entityId: 'lot-1' },
        { table: 'stock_jewels', type: 'upsert', entityId: 'j-1' }
      ])
    );
  });

  it('no sube lotes ni joyas que no cambiaron', async () => {
    await storage.saveBuyer(comprador());
    await storage.saveStoneLot(loteConVentaDelComprador());
    await storage.saveStockJewel(joyaVendidaAlComprador());

    const { enqueued, outbox } = fakeOutbox();
    const source = api.createCloudDataSource({
      remote: noopRemote,
      outbox,
      sync: noopSync
    });

    // Se guarda el MISMO nombre: nada de lo vinculado se toca.
    await source.saveBuyer(comprador({ phone: '3000000000' }));

    expect(enqueued.filter((op) => op.table === 'stone_lots')).toEqual([]);
    expect(enqueued.filter((op) => op.table === 'stock_jewels')).toEqual([]);
    expect(enqueued.filter((op) => op.table === 'buyers')).toHaveLength(1);
  });
});

describe('borrar un comprador arrastra sus ventas a la nube', () => {
  it('encola el borrado y la actualización de lote y joya', async () => {
    await storage.saveBuyer(comprador());
    await storage.saveStoneLot(loteConVentaDelComprador());
    await storage.saveStockJewel(joyaVendidaAlComprador());

    const { enqueued, outbox } = fakeOutbox();
    const source = api.createCloudDataSource({
      remote: noopRemote,
      outbox,
      sync: noopSync
    });

    await source.deleteBuyer('buy-1');

    expect(enqueued).toEqual(
      expect.arrayContaining([
        { table: 'buyers', type: 'delete', entityId: 'buy-1' },
        { table: 'stone_lots', type: 'upsert', entityId: 'lot-1' },
        { table: 'stock_jewels', type: 'upsert', entityId: 'j-1' }
      ])
    );

    // Y el dinero sigue completo en la copia local.
    const [lot] = await storage.listStoneLots();
    expect(lot.sales[0].buyer).toBe('Joyería Ejemplo');
    expect(lot.sales[0].buyerId).toBeNull();
    expect(lot.sales[0].payments).toHaveLength(1);
  });
});

describe('joyas en stock viajan por su propia tabla protegida', () => {
  it('confirma la transformación en el servidor antes de guardar ambos lados locales', async () => {
    const lot = loteConVentaDelComprador();
    const jewel: StockJewel = {
      ...joyaVendidaAlComprador(),
      sale: null,
      stoneKind: 'fantasia',
      stoneCount: 1
    };
    await storage.saveStoneLot(lot);
    await storage.saveStockJewel(jewel);
    const { enqueued, outbox } = fakeOutbox();
    const input = {
      id: 'event-cloud-c2',
      date: '2026-08-04',
      lotId: lot.id,
      jewelId: jewel.id,
      origin: 'bruto' as const,
      carats: 1,
      quantity: 1,
      notes: 'Cambio de vitrina'
    };
    const updatedAt = '2026-08-04T15:00:00.000Z';
    const authoritative = transformStockJewelToNatural(lot, jewel, input, updatedAt);
    const remote = createSupabaseCloudRemote(async () => ({
      from: () => ({ select: async () => ({ data: [], error: null }) }),
      rpc: async () => ({ data: authoritative, error: null })
    }));
    const source = api.createCloudDataSource({
      remote,
      outbox,
      sync: noopSync,
      now: () => new Date(updatedAt)
    });

    const result = await source.transformStockJewelToNatural(input);

    expect(enqueued).toEqual([]);
    expect(result.attributedCostCop).toBe(400_000);
    expect((await storage.listStoneLots())[0].internalUses).toEqual([result.internalUse]);
    expect((await storage.listStockJewels())[0].stoneTransformations).toEqual([
      result.transformation
    ]);
  });

  it('si la respuesta necesita otra joya, vuelve a traer Piedras y Joyas juntas', async () => {
    const lot = loteConVentaDelComprador();
    const jewel: StockJewel = {
      ...joyaVendidaAlComprador(),
      sale: null,
      stoneKind: 'fantasia',
      stoneCount: 1
    };
    await storage.saveStoneLot(lot);
    await storage.saveStockJewel(jewel);
    const input = {
      id: 'event-race-c2',
      date: '2026-08-04',
      lotId: lot.id,
      jewelId: jewel.id,
      origin: 'bruto' as const,
      carats: 1,
      quantity: 1,
      notes: ''
    };
    const authoritative = transformStockJewelToNatural(
      lot,
      jewel,
      input,
      '2026-08-04T15:00:00.000Z'
    );
    const reconcile = vi.spyOn(storage, 'reconcileAuthoritativeStoneJewelTransformation')
      .mockRejectedValueOnce(new Error('Falta otra mitad remota.'))
      .mockResolvedValueOnce(authoritative);
    let pulls = 0;
    const execute = vi.fn(async () => authoritative);
    const { outbox } = fakeOutbox();
    const source = api.createCloudDataSource({
      remote: { ...noopRemote, execute },
      outbox,
      sync: {
        ...noopSync,
        pullStoneJewelPair: async () => { pulls += 1; }
      }
    });

    const result = await source.transformStockJewelToNatural(input);

    expect(result).toEqual(authoritative);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(reconcile).toHaveBeenCalledTimes(2);
    expect(pulls).toBe(2);
  });

  it('sin conexión no deja una transformación falsa en el dispositivo', async () => {
    const lot = loteConVentaDelComprador();
    const jewel: StockJewel = {
      ...joyaVendidaAlComprador(),
      sale: null,
      stoneKind: 'fantasia',
      stoneCount: 1
    };
    await storage.saveStoneLot(lot);
    await storage.saveStockJewel(jewel);
    const { outbox } = fakeOutbox();
    const source = api.createCloudDataSource({
      remote: {
        ...noopRemote,
        execute: async () => { throw new Error('Sin conexión'); }
      },
      outbox,
      sync: noopSync
    });

    await expect(source.transformStockJewelToNatural({
      id: 'event-offline',
      date: '2026-08-04',
      lotId: lot.id,
      jewelId: jewel.id,
      origin: 'bruto',
      carats: 1,
      quantity: 1,
      notes: ''
    })).rejects.toThrow(/necesitas conexion/i);

    expect((await storage.listStoneLots())[0].internalUses).toEqual([]);
    expect((await storage.listStockJewels())[0]).toMatchObject({
      stoneKind: 'fantasia',
      costCop: jewel.costCop,
      stoneTransformations: []
    });
  });

  it('rechaza en el dispositivo un consumo mayor a la existencia antes de llamar al servidor', async () => {
    const lot = loteConVentaDelComprador();
    const jewel: StockJewel = {
      ...joyaVendidaAlComprador(),
      sale: null,
      stoneKind: 'fantasia',
      stoneCount: 1
    };
    await storage.saveStoneLot(lot);
    await storage.saveStockJewel(jewel);
    const execute = vi.fn(async () => ({}));
    const { outbox } = fakeOutbox();
    const source = api.createCloudDataSource({
      remote: { ...noopRemote, execute },
      outbox,
      sync: noopSync
    });

    await expect(source.transformStockJewelToNatural({
      id: 'event-overuse',
      date: '2026-08-04',
      lotId: lot.id,
      jewelId: jewel.id,
      origin: 'bruto',
      carats: 5,
      quantity: 1,
      notes: ''
    })).rejects.toThrow(/solo tiene 4 ct/i);

    expect(execute).not.toHaveBeenCalled();
    expect((await storage.listStoneLots())[0].internalUses).toEqual([]);
    expect((await storage.listStockJewels())[0].stoneTransformations).toEqual([]);
  });

  it('no transforma mientras el lote tenga un cambio pendiente de subir', async () => {
    const lot = loteConVentaDelComprador();
    const jewel: StockJewel = {
      ...joyaVendidaAlComprador(),
      sale: null,
      stoneKind: 'fantasia',
      stoneCount: 1
    };
    await storage.saveStoneLot(lot);
    await storage.saveStockJewel(jewel);
    const execute = vi.fn(async () => ({}));
    const pending: CloudOutboxOperation = {
      id: 'pending-lot',
      table: 'stone_lots',
      type: 'upsert',
      entityId: lot.id,
      data: lot,
      updatedAt: lot.updatedAt,
      queuedAt: 1,
      attempts: 1,
      nextAttemptAt: 0,
      state: 'held'
    };
    const source = api.createCloudDataSource({
      remote: { ...noopRemote, execute },
      outbox: {
        enqueue: async () => pending,
        flush: async () => ({ processed: 0, pending: 1 }),
        list: async () => [pending],
        status: async () => ({ pending: 0, held: 1, operations: [pending] }),
        retryHeld: async () => ({ processed: 0, pending: 1 })
      },
      sync: noopSync
    });

    await expect(source.transformStockJewelToNatural({
      id: 'event-blocked',
      date: '2026-08-04',
      lotId: lot.id,
      jewelId: jewel.id,
      origin: 'bruto',
      carats: 1,
      quantity: 1,
      notes: ''
    })).rejects.toThrow(/cambio pendiente/i);

    expect(execute).not.toHaveBeenCalled();
    expect((await storage.listStoneLots())[0].internalUses).toEqual([]);
    expect((await storage.listStockJewels())[0].stoneTransformations).toEqual([]);
  });

  it('no encola un costo histórico que no se pueda conservar exactamente', async () => {
    const { payloads, outbox } = fakeOutbox();
    const source = api.createCloudDataSource({
      remote: noopRemote,
      outbox,
      sync: noopSync
    });

    await expect(source.restoreStockJewelTransformationForImport({
      id: 'event-unsafe-cost',
      date: '2026-08-04',
      lotId: 'lot-1',
      jewelId: 'jewel-1',
      origin: 'bruto',
      carats: 1,
      quantity: 1,
      notes: '',
      costCop: Number.MAX_SAFE_INTEGER + 1,
      updatedAt: '2026-08-04T15:00:00.000Z'
    })).rejects.toThrow(/costo histórico/i);

    expect(payloads).toEqual([]);
  });

  it('permite abandonar una importación C2 retenida y traer la pareja de la nube', async () => {
    const held: CloudOutboxOperation = {
      id: 'held-restore-c2',
      table: 'stock_jewels',
      type: 'restore_stock_jewel',
      entityId: 'jewel-1',
      data: { lotId: 'lot-1', jewelId: 'jewel-1' },
      updatedAt: '2026-08-04T15:00:00.000Z',
      queuedAt: 1,
      attempts: 5,
      nextAttemptAt: 0,
      state: 'held'
    };
    const pending: CloudOutboxOperation = {
      ...held,
      id: 'pending-lot-c2',
      table: 'stone_lots',
      type: 'upsert',
      entityId: 'lot-1',
      state: 'pending'
    };
    const resolveTableChanges = vi.fn(async (
      tables: readonly CloudTable[],
      resolve: (operations: readonly CloudOutboxOperation[]) => Promise<void>
    ) => {
      expect(tables).toEqual(['stone_lots', 'stock_jewels']);
      await resolve([held, pending]);
    });
    const replaceStoneJewelPairFromCloud = vi.fn(async (ids: readonly string[]) => {
      expect(ids).toEqual([held.id, pending.id]);
    });
    const base = fakeOutbox().outbox;
    const source = api.createCloudDataSource({
      remote: noopRemote,
      outbox: {
        ...base,
        list: async () => [held, pending],
        resolveTableChanges
      },
      sync: { ...noopSync, replaceStoneJewelPairFromCloud }
    });

    await source.useCloudInventoryVersion();

    expect(resolveTableChanges).toHaveBeenCalledTimes(1);
    expect(replaceStoneJewelPairFromCloud).toHaveBeenCalledTimes(1);
  });

  it('la cola conserva la trazabilidad anidada de piedras, abonos y joyas', async () => {
    const { payloads, outbox } = fakeOutbox();
    const source = api.createCloudDataSource({
      remote: noopRemote,
      outbox,
      sync: noopSync
    });

    await source.saveStoneLot(loteConVentaDelComprador());
    await source.saveStockJewel(joyaVendidaAlComprador());

    const lot = payloads[0] as StoneLot;
    const jewel = payloads[1] as StockJewel;
    expect(lot.sales[0]).toMatchObject({
      method: '',
      receivedBy: '',
      notes: 'Venta a crédito'
    });
    expect(lot.sales[0].payments[0]).toMatchObject({
      method: 'Transferencia',
      receivedBy: 'Santiago',
      notes: 'Comprobante 123'
    });
    expect(jewel.sale).toMatchObject({
      method: 'Efectivo',
      receivedBy: 'Laura',
      notes: 'Venta de mostrador'
    });
  });

  it('guardar una joya la encola en stock_jewels', async () => {
    const { enqueued, outbox } = fakeOutbox();
    const source = api.createCloudDataSource({
      remote: noopRemote,
      outbox,
      sync: noopSync
    });

    await source.saveStockJewel(joyaVendidaAlComprador());

    expect(enqueued).toEqual([{ table: 'stock_jewels', type: 'upsert', entityId: 'j-1' }]);
  });

  it('borrar una joya la encola como borrado y la quita de la copia local', async () => {
    await storage.saveStockJewel(joyaVendidaAlComprador());
    const { enqueued, outbox } = fakeOutbox();
    const source = api.createCloudDataSource({
      remote: noopRemote,
      outbox,
      sync: noopSync
    });

    await source.deleteStockJewel('j-1');

    expect(enqueued).toEqual([{ table: 'stock_jewels', type: 'delete', entityId: 'j-1' }]);
    expect(await storage.listStockJewels()).toEqual([]);
  });
});

describe('las operaciones protegidas del servidor son las correctas', () => {
  it('cada tabla nueva llama a su propia función, nunca a una tabla directa', async () => {
    const calls: Array<{ name: string; args?: Record<string, unknown> }> = [];
    const remote = createSupabaseCloudRemote(async () => ({
      from: () => ({ select: async () => ({ data: [], error: null }) }),
      rpc: async (name, args) => {
        calls.push({ name, args });
        return { data: null, error: null };
      }
    }));

    const base = { id: 'op', updatedAt: '2026-07-21T10:00:00Z', queuedAt: 1, attempts: 0, nextAttemptAt: 0 };
    await remote.execute({ ...base, table: 'buyers', type: 'upsert', entityId: 'buy-1', data: { id: 'buy-1' } });
    await remote.execute({ ...base, table: 'buyers', type: 'delete', entityId: 'buy-1', data: null });
    await remote.execute({ ...base, table: 'stock_jewels', type: 'upsert', entityId: 'j-1', data: { id: 'j-1' } });
    await remote.execute({ ...base, table: 'stock_jewels', type: 'delete', entityId: 'j-1', data: null });

    expect(calls.map((c) => c.name)).toEqual([
      'upsert_buyer',
      'delete_buyer',
      'upsert_stock_jewel',
      'delete_stock_jewel'
    ]);
    // El navegador jamás manda el identificador de la organización: lo resuelve
    // el servidor dentro de la función protegida.
    for (const call of calls) {
      expect(Object.keys(call.args ?? {})).not.toContain('p_organization_id');
    }
  });
});
