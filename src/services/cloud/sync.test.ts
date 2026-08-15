import { describe, expect, it, vi } from 'vitest';
import type { StockJewel, StoneLot } from '../../types';
import { transformStockJewelToNatural } from '../stoneJewelTransformation';
import {
  createCloudSync,
  type CloudSyncCache,
  type CloudSyncCacheMutation,
  type SyncCacheRecord
} from './sync';
import type { CloudOutboxOperation, CloudTable } from './outbox';
import type { CloudOperationScope } from './scope';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function memoryCache(records: SyncCacheRecord[]): CloudSyncCache & { values: Map<string, SyncCacheRecord> } {
  const values = new Map(records.map((record) => [record.id, record]));
  return {
    values,
    list: async () => [...values.values()],
    put: async (_table, record) => void values.set(record.id, record),
    remove: async (_table, id) => void values.delete(id)
  };
}

function inventoryMemoryCache(lot: StoneLot, jewel: StockJewel, failBatch = false) {
  const values = new Map<CloudTable, Map<string, SyncCacheRecord>>([
    ['stone_lots', new Map([[lot.id, {
      id: lot.id, data: lot, updatedAt: lot.updatedAt, seenInCloud: true
    }]])],
    ['stock_jewels', new Map([[jewel.id, {
      id: jewel.id, data: jewel, updatedAt: jewel.updatedAt, seenInCloud: true
    }]])]
  ]);
  const tableValues = (table: CloudTable) => {
    let records = values.get(table);
    if (!records) {
      records = new Map();
      values.set(table, records);
    }
    return records;
  };
  const removedOutboxIds: string[] = [];
  const applyBatch = async (mutations: readonly CloudSyncCacheMutation[]) => {
    const staged = new Map<CloudTable, Map<string, SyncCacheRecord>>(
      [...values].map(([table, records]) => [table, new Map(records)])
    );
    for (const mutation of mutations) {
      let records = staged.get(mutation.table);
      if (!records) {
        records = new Map();
        staged.set(mutation.table, records);
      }
      if (mutation.record) records.set(mutation.id, mutation.record);
      else records.delete(mutation.id);
    }
    if (failBatch) throw new Error('fallo atomico simulado');
    values.clear();
    for (const [table, records] of staged) values.set(table, records);
  };
  const cache: CloudSyncCache = {
    list: async (table) => [...tableValues(table).values()],
    put: async (table, record) => void tableValues(table).set(record.id, record),
    remove: async (table, id) => void tableValues(table).delete(id),
    applyBatch,
    applyBatchAndRemoveOutbox: async (mutations, outboxIds) => {
      await applyBatch(mutations);
      removedOutboxIds.push(...outboxIds);
    }
  };
  return { cache, values, tableValues, removedOutboxIds };
}

const c2Lot: StoneLot = {
  id: 'lot-pair', name: 'Lote pareja', stoneType: 'Esmeralda', description: '',
  purchaseDate: '2026-08-01', supplier: '', supplierId: null, carats: 5, quantity: 5,
  purchaseValueCop: 1_000_000, partnerId: null, partnerName: '', myPercent: 100,
  onCredit: false, supplierPayments: [], cuttingBatches: [], internalUses: [], notes: '',
  sales: [], createdAt: '2026-08-01T09:00:00.000Z', updatedAt: '2026-08-01T09:00:00.000Z'
};
const c2Jewel: StockJewel = {
  id: 'jewel-pair', name: 'Anillo pareja', pieceType: 'anillo', material: 'Oro', photo: '', extraPhotos: [],
  acquiredDate: '2026-08-02', weightGrams: 4, size: '7', stoneCount: 1,
  stoneKind: 'fantasia', costCop: 500_000, priceCop: 1_500_000, status: 'disponible',
  notes: '', sale: null, collectionId: null, stoneTransformations: [],
  createdAt: '2026-08-02T09:00:00.000Z', updatedAt: '2026-08-02T09:00:00.000Z'
};
const c2Transformed = transformStockJewelToNatural(c2Lot, c2Jewel, {
  id: 'event-pair', date: '2026-08-04', lotId: c2Lot.id, jewelId: c2Jewel.id,
  origin: 'bruto', carats: 1, quantity: 1, notes: ''
}, '2026-08-04T12:00:00.000Z');

const remoteQuote = (updated_at: string) => ({
  id: 'q-1',
  data: { id: 'q-1', pieceDescription: 'Versión nube' },
  updated_at
});

describe('sincronización LWW', () => {
  it('descarta una descarga si la identidad cambia antes de escribir la caché', async () => {
    const cache = memoryCache([]);
    const started = deferred();
    const release = deferred();
    let scope: CloudOperationScope | null = { userId: 'user-a', organizationId: 'org-a' };
    const sync = createCloudSync({
      remote: {
        list: async () => {
          started.resolve();
          await release.promise;
          return [{
            id: 'client-a',
            data: { id: 'client-a', name: 'Cliente de A' },
            updated_at: '2026-08-14T10:00:00Z'
          }];
        }
      },
      cache,
      listPending: async () => [],
      getScope: () => scope
    });

    const pulling = sync.pullTable('clients');
    await started.promise;
    scope = { userId: 'user-b', organizationId: 'org-b' };
    release.resolve();
    await pulling;

    expect(cache.values.size).toBe(0);
  });

  it('conserva la descarga cuando la identidad sigue siendo la misma', async () => {
    const cache = memoryCache([]);
    const scope = { userId: 'user-a', organizationId: 'org-a' } as const;
    const sync = createCloudSync({
      remote: {
        list: async () => [{
          id: 'client-a',
          data: { id: 'client-a', name: 'Cliente de A' },
          updated_at: '2026-08-14T10:00:00Z'
        }]
      },
      cache,
      listPending: async () => [],
      getScope: () => scope
    });

    await sync.pullTable('clients');

    expect(cache.values.has('client-a')).toBe(true);
  });

  it('conserva datos locales previos cuando la nube está vacía y no hay cola', async () => {
    const cache = memoryCache([
      { id: 'c-1', data: { id: 'c-1' }, updatedAt: '2026-07-01T10:00:00Z' },
      { id: 'c-2', data: { id: 'c-2' }, updatedAt: '2026-07-02T10:00:00Z' },
      { id: 'c-3', data: { id: 'c-3' }, updatedAt: '2026-07-03T10:00:00Z' }
    ]);
    const sync = createCloudSync({
      remote: { list: async () => [] },
      cache,
      listPending: async () => []
    });

    await sync.pullTable('clients');

    expect([...cache.values.keys()].sort()).toEqual(['c-1', 'c-2', 'c-3']);
  });

  it('conserva datos nunca subidos aunque la nube ya tenga otros registros', async () => {
    const cache = memoryCache([
      { id: 'c-local-1', data: { id: 'c-local-1' }, updatedAt: '2026-07-01T10:00:00Z' },
      { id: 'c-local-2', data: { id: 'c-local-2' }, updatedAt: '2026-07-02T10:00:00Z' }
    ]);
    const sync = createCloudSync({
      remote: {
        list: async () => [{
          id: 'c-cloud', data: { id: 'c-cloud' }, updated_at: '2026-07-18T11:00:00Z'
        }]
      },
      cache,
      listPending: async () => []
    });

    await sync.pullTable('clients');

    expect([...cache.values.keys()].sort()).toEqual(['c-cloud', 'c-local-1', 'c-local-2']);
  });

  it('tras reconciliar el dispositivo sí aplica un borrado hecho en otro dispositivo', async () => {
    const cache = memoryCache([
      { id: 'q-1', data: { id: 'q-1' }, updatedAt: '2026-07-18T10:00:00Z' },
      { id: 'q-2', data: { id: 'q-2' }, updatedAt: '2026-07-18T10:00:00Z' },
      { id: 'q-3', data: { id: 'q-3' }, updatedAt: '2026-07-18T10:00:00Z' }
    ]);
    let remoteRows = [
      { id: 'q-1', data: { id: 'q-1' }, updated_at: '2026-07-18T11:00:00Z' },
      { id: 'q-2', data: { id: 'q-2' }, updated_at: '2026-07-18T11:00:00Z' },
      { id: 'q-3', data: { id: 'q-3' }, updated_at: '2026-07-18T11:00:00Z' }
    ];
    const sync = createCloudSync({
      remote: { list: async () => remoteRows },
      cache,
      listPending: async () => []
    });

    await sync.pullTable('quotes');
    expect([...cache.values.values()].every((record) => record.seenInCloud)).toBe(true);

    remoteRows = remoteRows.filter((row) => row.id !== 'q-3');
    await sync.pullTable('quotes');

    expect([...cache.values.keys()].sort()).toEqual(['q-1', 'q-2']);
  });

  it('conserva una cotización creada sin conexión que todavía espera subir', async () => {
    const cache = memoryCache([
      { id: 'q-local', data: { id: 'q-local' }, updatedAt: '2026-07-18T12:00:00Z' }
    ]);
    const pending = [{
      id: 'op-local', table: 'quotes', type: 'upsert', entityId: 'q-local', data: { id: 'q-local' },
      updatedAt: '2026-07-18T12:00:00Z', queuedAt: 1, attempts: 0, nextAttemptAt: 0
    } satisfies CloudOutboxOperation];
    const sync = createCloudSync({
      remote: { list: async () => [] },
      cache,
      listPending: async () => pending
    });

    await sync.pullTable('quotes');

    expect(cache.values.has('q-local')).toBe(true);
  });

  it('una transformación pendiente protege a la vez el lote y la joya', async () => {
    const operation = {
      id: 'op-transform',
      table: 'stock_jewels',
      type: 'transform_stock_jewel',
      entityId: 'jewel-transform',
      data: {
        id: 'event-1',
        lotId: 'lot-transform',
        jewelId: 'jewel-transform'
      },
      updatedAt: '2026-08-04T12:00:00Z',
      queuedAt: 1,
      attempts: 0,
      nextAttemptAt: 0
    } satisfies CloudOutboxOperation;
    const lotCache = memoryCache([{
      id: 'lot-transform',
      data: { id: 'lot-transform', internalUses: [{ id: 'event-1' }] },
      updatedAt: operation.updatedAt,
      seenInCloud: true
    }]);
    const jewelCache = memoryCache([{
      id: 'jewel-transform',
      data: { id: 'jewel-transform', stoneKind: 'natural' },
      updatedAt: operation.updatedAt,
      seenInCloud: true
    }]);
    const remote = {
      list: async (table: string) => [{
        id: table === 'stone_lots' ? 'lot-transform' : 'jewel-transform',
        data: { id: 'version-remota', stoneKind: 'fantasia' },
        updated_at: '2030-01-01T00:00:00Z'
      }]
    };

    await createCloudSync({ remote, cache: lotCache, listPending: async () => [operation] })
      .pullTable('stone_lots');
    await createCloudSync({ remote, cache: jewelCache, listPending: async () => [operation] })
      .pullTable('stock_jewels');

    expect(lotCache.values.has('lot-transform')).toBe(true);
    expect(jewelCache.values.has('jewel-transform')).toBe(true);
    expect(lotCache.values.get('lot-transform')?.data).toMatchObject({
      internalUses: [{ id: 'event-1' }]
    });
    expect(jewelCache.values.get('jewel-transform')?.data).toMatchObject({
      stoneKind: 'natural'
    });
  });

  it('si la consulta remota falla deja intacta toda la caché', async () => {
    const original = [
      { id: 'q-1', data: { id: 'q-1' }, updatedAt: '2026-07-18T10:00:00Z' },
      { id: 'q-2', data: { id: 'q-2' }, updatedAt: '2026-07-18T10:00:00Z' }
    ];
    const cache = memoryCache(original);
    const sync = createCloudSync({
      remote: { list: async () => { throw new Error('sin red'); } },
      cache,
      listPending: async () => []
    });

    await expect(sync.pullTable('quotes')).rejects.toThrow('sin red');
    expect([...cache.values.values()]).toEqual(original);
  });

  it('la versión remota más reciente reemplaza la caché', async () => {
    const cache = memoryCache([{
      id: 'q-1', data: { id: 'q-1', pieceDescription: 'Versión local' }, updatedAt: '2026-07-18T10:00:00Z'
    }]);
    const sync = createCloudSync({
      remote: { list: async () => [remoteQuote('2026-07-18T11:00:00Z')] },
      cache,
      listPending: async () => []
    });

    await sync.pullTable('quotes');
    expect(cache.values.get('q-1')?.data).toMatchObject({ pieceDescription: 'Versión nube' });
  });

  it('la versión local más reciente no se pisa mientras espera subir', async () => {
    const cache = memoryCache([{
      id: 'q-1', data: { id: 'q-1', pieceDescription: 'Edición sin internet' }, updatedAt: '2026-07-18T12:00:00Z'
    }]);
    const pending = [{
      id: 'op-1', table: 'quotes', type: 'upsert', entityId: 'q-1', data: {},
      updatedAt: '2026-07-18T12:00:00Z', queuedAt: 1, attempts: 0, nextAttemptAt: 0
    } satisfies CloudOutboxOperation];
    const sync = createCloudSync({
      remote: { list: async () => [remoteQuote('2026-07-18T11:00:00Z')] },
      cache,
      listPending: async () => pending
    });

    await sync.pullTable('quotes');
    expect(cache.values.get('q-1')?.data).toMatchObject({ pieceDescription: 'Edición sin internet' });
  });

  it('una eliminación pendiente no revive por una lectura remota', async () => {
    const cache = memoryCache([]);
    const pending = [{
      id: 'op-delete', table: 'quotes', type: 'delete', entityId: 'q-1', data: null,
      updatedAt: '2026-07-18T12:00:00Z', queuedAt: 1, attempts: 0, nextAttemptAt: 0
    } satisfies CloudOutboxOperation];
    const sync = createCloudSync({
      remote: { list: async () => [remoteQuote('2026-07-18T11:00:00Z')] },
      cache,
      listPending: async () => pending
    });

    await sync.pullTable('quotes');
    expect(cache.values.has('q-1')).toBe(false);
  });
});

describe('sincronización atómica de Piedras y Joyas C2', () => {
  it('si falla una de las dos lecturas remotas conserva la pareja local anterior', async () => {
    const target = inventoryMemoryCache(c2Lot, c2Jewel);
    const batch = vi.spyOn(target.cache, 'applyBatch');
    const sync = createCloudSync({
      remote: {
        list: async (table) => {
          if (table === 'stock_jewels') throw new Error('fallo entre lecturas');
          return [{
            id: c2Lot.id,
            data: c2Transformed.lot,
            updated_at: c2Transformed.lot.updatedAt
          }];
        }
      },
      cache: target.cache,
      listPending: async () => []
    });

    await expect(sync.pullStoneJewelPair()).rejects.toThrow(/fallo entre lecturas/i);
    expect(batch).not.toHaveBeenCalled();
    expect(target.tableValues('stone_lots').get(c2Lot.id)?.data).toEqual(c2Lot);
    expect(target.tableValues('stock_jewels').get(c2Jewel.id)?.data).toEqual(c2Jewel);
  });

  it('aplica la transformación remota completa en un solo lote local', async () => {
    const target = inventoryMemoryCache(c2Lot, c2Jewel);
    const sync = createCloudSync({
      remote: {
        list: async (table) => table === 'stone_lots'
          ? [{
              id: c2Lot.id,
              data: c2Transformed.lot,
              updated_at: c2Transformed.lot.updatedAt
            }]
          : [{
              id: c2Jewel.id,
              data: c2Transformed.jewel,
              updated_at: c2Transformed.jewel.updatedAt
            }]
      },
      cache: target.cache,
      listPending: async () => []
    });

    await sync.pullStoneJewelPair();

    expect(target.tableValues('stone_lots').get(c2Lot.id)?.data).toEqual(c2Transformed.lot);
    expect(target.tableValues('stock_jewels').get(c2Jewel.id)?.data).toEqual(
      c2Transformed.jewel
    );
  });

  it('al elegir la nube reemplaza una pareja local aunque su reloj sea posterior', async () => {
    const newerLot = {
      ...c2Lot,
      notes: 'Edición local retenida',
      updatedAt: '2030-01-01T00:00:00.000Z'
    };
    const newerJewel = {
      ...c2Jewel,
      notes: 'Edición local retenida',
      updatedAt: '2030-01-01T00:00:00.000Z'
    };
    const target = inventoryMemoryCache(newerLot, newerJewel);
    const sync = createCloudSync({
      remote: {
        list: async (table) => table === 'stone_lots'
          ? [{
              id: c2Lot.id,
              data: c2Transformed.lot,
              updated_at: c2Transformed.lot.updatedAt
            }]
          : [{
              id: c2Jewel.id,
              data: c2Transformed.jewel,
              updated_at: c2Transformed.jewel.updatedAt
            }]
      },
      cache: target.cache,
      listPending: async () => []
    });

    await sync.replaceStoneJewelPairFromCloud?.(['op-held-inventory']);

    expect(target.tableValues('stone_lots').get(c2Lot.id)?.data).toEqual(c2Transformed.lot);
    expect(target.tableValues('stock_jewels').get(c2Jewel.id)?.data).toEqual(
      c2Transformed.jewel
    );
    expect(target.removedOutboxIds).toEqual(['op-held-inventory']);
  });

  it('serializa una lectura normal en curso antes de reemplazar toda la pareja con la nube', async () => {
    const newerLot = {
      ...c2Lot,
      notes: 'Edición local retenida',
      updatedAt: '2030-01-01T00:00:00.000Z'
    };
    const newerJewel = {
      ...c2Jewel,
      notes: 'Edición local retenida',
      updatedAt: '2030-01-01T00:00:00.000Z'
    };
    const target = inventoryMemoryCache(newerLot, newerJewel);
    const firstPull = deferred();
    const calls = new Map<CloudTable, number>();
    const sync = createCloudSync({
      remote: {
        list: async (table) => {
          const call = (calls.get(table) ?? 0) + 1;
          calls.set(table, call);
          if (call === 1) await firstPull.promise;
          if (table === 'stone_lots') {
            const lot = call === 1 ? c2Lot : c2Transformed.lot;
            return [{ id: lot.id, data: lot, updated_at: lot.updatedAt }];
          }
          const jewel = call === 1 ? c2Jewel : c2Transformed.jewel;
          return [{ id: jewel.id, data: jewel, updated_at: jewel.updatedAt }];
        }
      },
      cache: target.cache,
      listPending: async () => []
    });

    const normal = sync.pullStoneJewelPair();
    await vi.waitFor(() => {
      expect(calls.get('stone_lots')).toBe(1);
      expect(calls.get('stock_jewels')).toBe(1);
    });
    const replacement = sync.replaceStoneJewelPairFromCloud?.(['op-held-inventory']);
    const repeatedNormal = sync.pullStoneJewelPair();
    expect(repeatedNormal).toBe(normal);

    firstPull.resolve();
    await Promise.all([normal, replacement, repeatedNormal]);

    expect(calls.get('stone_lots')).toBe(2);
    expect(calls.get('stock_jewels')).toBe(2);
    expect(target.tableValues('stone_lots').get(c2Lot.id)?.data).toEqual(c2Transformed.lot);
    expect(target.tableValues('stock_jewels').get(c2Jewel.id)?.data).toEqual(
      c2Transformed.jewel
    );
    expect(target.removedOutboxIds).toEqual(['op-held-inventory']);
  });

  it('si falla el guardado por lote no confirma ninguna mitad', async () => {
    const target = inventoryMemoryCache(c2Lot, c2Jewel, true);
    const sync = createCloudSync({
      remote: {
        list: async (table) => table === 'stone_lots'
          ? [{
              id: c2Lot.id,
              data: c2Transformed.lot,
              updated_at: c2Transformed.lot.updatedAt
            }]
          : [{
              id: c2Jewel.id,
              data: c2Transformed.jewel,
              updated_at: c2Transformed.jewel.updatedAt
            }]
      },
      cache: target.cache,
      listPending: async () => []
    });

    await expect(sync.pullStoneJewelPair()).rejects.toThrow(/fallo atomico/i);
    expect(target.tableValues('stone_lots').get(c2Lot.id)?.data).toEqual(c2Lot);
    expect(target.tableValues('stock_jewels').get(c2Jewel.id)?.data).toEqual(c2Jewel);
  });
});

describe('defensas B3 al bajar datos de la nube', () => {
  it('rechaza cambios de tasa en piedras, joyas y gastos ya guardados', async () => {
    const cases: Array<{
      table: CloudTable;
      id: string;
      localData: Record<string, unknown>;
      remoteData: Record<string, unknown>;
    }> = [
      {
        table: 'stone_lots',
        id: 'stone-1',
        localData: {
          id: 'stone-1',
          sales: [{ id: 'sale-1', usdRate: 4100, payments: [] }]
        },
        remoteData: {
          id: 'stone-1',
          sales: [{ id: 'sale-1', usdRate: 4200, payments: [] }]
        }
      },
      {
        table: 'stock_jewels',
        id: 'stock-1',
        localData: { id: 'stock-1', sale: { id: 'sale-1', usdRate: 4100 } },
        remoteData: { id: 'stock-1', sale: { id: 'sale-1', usdRate: 4200 } }
      },
      {
        table: 'expenses',
        id: 'expense-1',
        localData: { id: 'expense-1', usdRate: 4100 },
        remoteData: { id: 'expense-1', usdRate: 4200 }
      }
    ];

    for (const value of cases) {
      const localRecord = {
        id: value.id,
        data: value.localData,
        updatedAt: '2026-08-03T10:00:00Z'
      };
      const cache = memoryCache([localRecord]);
      const sync = createCloudSync({
        remote: {
          list: async () => [{
            id: value.id,
            data: value.remoteData,
            updated_at: '2026-08-03T11:00:00Z'
          }]
        },
        cache,
        listPending: async () => []
      });

      await expect(sync.pullTable(value.table)).rejects.toThrow(/no se puede cambiar/);
      expect(cache.values.get(value.id)?.data).toEqual(value.localData);
    }
  });

  it('acepta reemplazar una venta deshecha de joya por otra venta con identificador nuevo', async () => {
    const localData = {
      id: 'stock-replaced-sale',
      sale: { id: 'sale-anterior', usdRate: 4100 }
    };
    const remoteData = {
      id: 'stock-replaced-sale',
      sale: { id: 'sale-nueva', usdRate: 4200 }
    };
    const cache = memoryCache([{
      id: 'stock-replaced-sale',
      data: localData,
      updatedAt: '2026-08-03T10:00:00Z'
    }]);
    const sync = createCloudSync({
      remote: {
        list: async () => [{
          id: 'stock-replaced-sale',
          data: remoteData,
          updated_at: '2026-08-03T11:00:00Z'
        }]
      },
      cache,
      listPending: async () => []
    });

    await sync.pullTable('stock_jewels');
    expect(cache.values.get('stock-replaced-sale')?.data).toEqual(remoteData);
  });

  it('no permite completar desde la nube una tasa histórica vacía', async () => {
    const localData = {
      id: 'stone-historical',
      sales: [{ id: 'sale-historical', productType: '', usdRate: null, payments: [] }]
    };
    const cache = memoryCache([{
      id: 'stone-historical',
      data: localData,
      updatedAt: '2026-08-03T10:00:00Z'
    }]);
    const sync = createCloudSync({
      remote: {
        list: async () => [{
          id: 'stone-historical',
          data: {
            ...localData,
            sales: [{ ...localData.sales[0], usdRate: 4100 }]
          },
          updated_at: '2026-08-03T11:00:00Z'
        }]
      },
      cache,
      listPending: async () => []
    });

    await expect(sync.pullTable('stone_lots')).rejects.toThrow(/no se puede cambiar/);
    expect(cache.values.get('stone-historical')?.data).toEqual(localData);
  });

  it('acepta un histórico nuevo sin tasa, pero rechaza rangos y ajustes corruptos', async () => {
    const historicalCache = memoryCache([]);
    const historicalSync = createCloudSync({
      remote: {
        list: async () => [{
          id: 'stone-old',
          data: { id: 'stone-old', sales: [{ id: 'sale-old', payments: [] }] },
          updated_at: '2026-08-03T11:00:00Z'
        }]
      },
      cache: historicalCache,
      listPending: async () => []
    });
    await historicalSync.pullTable('stone_lots');
    expect(historicalCache.values.has('stone-old')).toBe(true);

    const invalidRateCache = memoryCache([]);
    const invalidRateSync = createCloudSync({
      remote: {
        list: async () => [{
          id: 'stone-invalid',
          data: {
            id: 'stone-invalid',
            sales: [{ id: 'sale-invalid', usdRate: 999, payments: [] }]
          },
          updated_at: '2026-08-03T11:00:00Z'
        }]
      },
      cache: invalidRateCache,
      listPending: async () => []
    });
    await expect(invalidRateSync.pullTable('stone_lots')).rejects.toThrow(/tasa USD\/COP/);
    expect(invalidRateCache.values.size).toBe(0);

    const invalidSettingsCache = memoryCache([]);
    const invalidSettingsSync = createCloudSync({
      remote: {
        list: async () => [{
          data: {
            lastKnownUsdRate: 4100,
            usdRateUpdatedAt: '2026-08-03T10:00:00Z',
            productTypes: [{ name: '', active: true }]
          },
          updated_at: '2026-08-03T11:00:00Z'
        }]
      },
      cache: invalidSettingsCache,
      listPending: async () => []
    });
    await expect(invalidSettingsSync.pullTable('org_settings')).rejects.toThrow(/sin nombre/);
    expect(invalidSettingsCache.values.size).toBe(0);
  });
});
