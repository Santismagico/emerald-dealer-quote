import { describe, expect, it } from 'vitest';
import { createCloudSync, type CloudSyncCache, type SyncCacheRecord } from './sync';
import type { CloudOutboxOperation, CloudTable } from './outbox';

function memoryCache(records: SyncCacheRecord[]): CloudSyncCache & { values: Map<string, SyncCacheRecord> } {
  const values = new Map(records.map((record) => [record.id, record]));
  return {
    values,
    list: async () => [...values.values()],
    put: async (_table, record) => void values.set(record.id, record),
    remove: async (_table, id) => void values.delete(id)
  };
}

const remoteQuote = (updated_at: string) => ({
  id: 'q-1',
  data: { id: 'q-1', pieceDescription: 'Versión nube' },
  updated_at
});

describe('sincronización LWW', () => {
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
