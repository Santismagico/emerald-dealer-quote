import { describe, expect, it } from 'vitest';
import { createCloudSync, type CloudSyncCache, type SyncCacheRecord } from './sync';
import type { CloudOutboxOperation } from './outbox';

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
