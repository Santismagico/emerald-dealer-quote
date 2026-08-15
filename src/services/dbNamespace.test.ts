import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  dbDelete,
  dbGetAll,
  dbPut,
  defaultDatabaseContainsCloudData,
  deleteCloudDatabaseScope,
  setCloudDatabaseScope
} from './db';
import {
  indexedDbOutboxRepository,
  type CloudOutboxOperation
} from './cloud/outbox';

const suffix = `${Date.now()}-${Math.random()}`;
const ACCOUNT_A = { userId: `user-a-${suffix}`, organizationId: `org-a-${suffix}` };
const ACCOUNT_B = { userId: `user-b-${suffix}`, organizationId: `org-b-${suffix}` };

afterEach(async () => {
  setCloudDatabaseScope(null);
  await deleteCloudDatabaseScope(ACCOUNT_A);
  await deleteCloudDatabaseScope(ACCOUNT_B);
});

describe('aislamiento local por cuenta cloud', () => {
  it('separa el modo local y dos identidades cloud sin borrar sus datos', async () => {
    setCloudDatabaseScope(null);
    await dbPut('clients', { id: `local-${suffix}` });

    setCloudDatabaseScope(ACCOUNT_A);
    expect(await dbGetAll('clients')).not.toContainEqual({ id: `local-${suffix}` });
    await dbPut('clients', { id: `client-a-${suffix}` });

    setCloudDatabaseScope(ACCOUNT_B);
    expect(await dbGetAll('clients')).toEqual([]);
    await dbPut('clients', { id: `client-b-${suffix}` });

    setCloudDatabaseScope(ACCOUNT_A);
    expect(await dbGetAll('clients')).toEqual([{ id: `client-a-${suffix}` }]);

    setCloudDatabaseScope(ACCOUNT_B);
    expect(await dbGetAll('clients')).toEqual([{ id: `client-b-${suffix}` }]);
  });

  it('elimina la base aislada cuando se borra la organización', async () => {
    setCloudDatabaseScope(ACCOUNT_A);
    await dbPut('quotes', { id: `quote-a-${suffix}` });

    setCloudDatabaseScope(null);
    await deleteCloudDatabaseScope(ACCOUNT_A);
    setCloudDatabaseScope(ACCOUNT_A);

    expect(await dbGetAll('quotes')).toEqual([]);
  });

  it('termina la limpieza en la cuenta original aunque la cuenta activa ya cambió', async () => {
    const operation = (scope: typeof ACCOUNT_A): CloudOutboxOperation => ({
      ...scope,
      id: `same-operation-${suffix}`,
      table: 'quotes',
      type: 'delete',
      entityId: `quote-${suffix}`,
      data: null,
      updatedAt: '2026-08-14T10:00:00Z',
      queuedAt: 1,
      attempts: 0,
      nextAttemptAt: 0
    });
    await indexedDbOutboxRepository.put(operation(ACCOUNT_A));
    await indexedDbOutboxRepository.put(operation(ACCOUNT_B));

    setCloudDatabaseScope(ACCOUNT_B);
    await indexedDbOutboxRepository.remove(`same-operation-${suffix}`, ACCOUNT_A);

    expect(await indexedDbOutboxRepository.list(ACCOUNT_A)).toEqual([]);
    expect(await indexedDbOutboxRepository.list(ACCOUNT_B)).toHaveLength(1);
  });

  it('pone en cuarentena la caché cloud antigua de propietario desconocido', async () => {
    const localId = `local-clean-${suffix}`;
    const cloudId = `legacy-cloud-${suffix}`;
    setCloudDatabaseScope(null);
    await dbPut('clients', { id: localId, name: 'Dato local legítimo' });
    expect(await defaultDatabaseContainsCloudData()).toBe(false);

    await dbPut('quotes', {
      id: cloudId,
      cloudUpdatedAt: '2026-08-14T10:00:00Z'
    });
    expect(await defaultDatabaseContainsCloudData()).toBe(true);

    await dbDelete('clients', localId);
    await dbDelete('quotes', cloudId);
  });
});
