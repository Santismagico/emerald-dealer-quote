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
import { createSupabaseCloudRemote } from './api';
import type { CloudOutboxOperation, CloudTable } from './outbox';

let api: typeof import('./api');
let storage: typeof import('../storage');

/** Cola en memoria: registra lo que la app habría subido, sin red ni servidor. */
function fakeOutbox() {
  const enqueued: Array<{ table: CloudTable; type: string; entityId: string }> = [];
  return {
    enqueued,
    outbox: {
      enqueue: async (op: { table: CloudTable; type: string; entityId: string }) => {
        enqueued.push({ table: op.table, type: op.type, entityId: op.entityId });
        return op as unknown as CloudOutboxOperation;
      },
      flush: async () => ({ processed: 0, pending: 0 }),
      list: async () => [],
      status: async () => ({ pending: 0, held: 0, operations: [] }),
      retryHeld: async () => ({ processed: 0, pending: 0 })
    }
  };
}

const noopSync = { pullTable: async () => {}, pullAll: async () => {} };
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
    onCredit: false,
    supplierPayments: [],
    notes: '',
    sales: [
      {
        id: 'sale-1',
        date: '2026-07-15',
        buyer: 'Joyería Ejemplo',
        buyerId: 'buy-1',
        carats: 1,
        quantity: 1,
        valueCop: 3000000,
        onCredit: true,
        dueDate: '2026-08-15',
        payments: [{ id: 'ab-1', date: '2026-07-20', amount: 1000000, notes: '' }],
        notes: ''
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
      notes: ''
    },
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
