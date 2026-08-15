import { describe, expect, it, vi } from 'vitest';
import {
  createCloudOutbox,
  startOutboxTriggers,
  type CloudOutboxOperation,
  type OutboxRepository
} from './outbox';
import type { CloudOperationScope } from './scope';

function memoryRepository(): OutboxRepository & { values: Map<string, CloudOutboxOperation> } {
  const values = new Map<string, CloudOutboxOperation>();
  return {
    values,
    list: async () => [...values.values()],
    put: async (operation) => void values.set(operation.id, operation),
    remove: async (id) => void values.delete(id),
    putMany: async (operations) => {
      for (const operation of operations) values.set(operation.id, operation);
    },
    removeMany: async (ids) => {
      for (const id of ids) values.delete(id);
    }
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

const ACCOUNT_A = { userId: 'user-a', organizationId: 'org-a' } as const;
const ACCOUNT_B = { userId: 'user-b', organizationId: 'org-b' } as const;

type TestOutboxOptions = Parameters<typeof createCloudOutbox>[0];

function createTestOutbox(
  options: Omit<TestOutboxOptions, 'getScope'> & Partial<Pick<TestOutboxOptions, 'getScope'>>
) {
  return createCloudOutbox({ getScope: () => ACCOUNT_A, ...options });
}

describe('cola de sincronización', () => {
  it('solo reproduce las operaciones de la identidad que las creó', async () => {
    const repository = memoryRepository();
    const uploaded: string[] = [];
    let scope: CloudOperationScope = ACCOUNT_A;
    const outbox = createTestOutbox({
      repository,
      getScope: () => scope,
      createId: () => 'op-account-a',
      now: () => 1_000,
      execute: async (operation) => { uploaded.push(operation.entityId); }
    });

    const operation = await outbox.enqueue({
      table: 'quotes', type: 'upsert', entityId: 'quote-a', data: { id: 'quote-a' },
      updatedAt: '2026-08-14T10:00:00Z'
    });
    expect(operation).toMatchObject(ACCOUNT_A);

    scope = ACCOUNT_B;
    await outbox.flush();
    expect(uploaded).toEqual([]);
    expect(await outbox.list()).toEqual([]);
    expect(repository.values.has('op-account-a')).toBe(true);

    scope = ACCOUNT_A;
    await outbox.flush();
    expect(uploaded).toEqual(['quote-a']);
    expect(repository.values.has('op-account-a')).toBe(false);
  });

  it('no acepta cambios cuando todavía no hay una identidad cloud activa', async () => {
    const outbox = createTestOutbox({
      repository: memoryRepository(),
      getScope: () => null,
      execute: async () => {}
    });

    await expect(outbox.enqueue({
      table: 'clients', type: 'upsert', entityId: 'client-without-account', data: {},
      updatedAt: '2026-08-14T10:00:00Z'
    })).rejects.toThrow(/identidad cloud activa/i);
  });

  it('pone en cuarentena operaciones antiguas que no tienen dueño verificable', async () => {
    const repository = memoryRepository();
    repository.values.set('legacy-op', {
      id: 'legacy-op', table: 'clients', type: 'delete', entityId: 'client-a', data: null,
      updatedAt: '2026-08-14T10:00:00Z', queuedAt: 1, attempts: 0, nextAttemptAt: 0
    });
    const execute = vi.fn(async () => {});
    const outbox = createTestOutbox({
      repository,
      getScope: () => ACCOUNT_A,
      execute
    });

    await outbox.flush();

    expect(execute).not.toHaveBeenCalled();
    expect(repository.values.has('legacy-op')).toBe(true);
    expect(await outbox.list()).toEqual([]);
  });

  it('conserva el orden de inserción aunque el reloj coincida y los ids vengan al revés', async () => {
    const repository = memoryRepository();
    const uploaded: string[] = [];
    const ids = ['z-primero', 'a-segundo'];
    const outbox = createTestOutbox({
      repository,
      createId: () => ids.shift()!,
      now: () => 1_000,
      execute: async (operation) => { uploaded.push(operation.entityId); }
    });

    await outbox.enqueue({
      table: 'stock_jewels', type: 'restore_stock_jewel', entityId: 'primero',
      data: { id: 'evento-1' }, updatedAt: '2026-08-04T10:00:00Z'
    });
    await outbox.enqueue({
      table: 'stock_jewels', type: 'restore_stock_jewel', entityId: 'segundo',
      data: { id: 'evento-2' }, updatedAt: '2026-08-04T10:00:00Z'
    });

    expect((await outbox.list()).map((operation) => operation.queuedAt)).toEqual([1000, 1001]);
    await outbox.flush();
    expect(uploaded).toEqual(['primero', 'segundo']);
  });

  it('informa cinco cambios pendientes y cero después de subirlos', async () => {
    const repository = memoryRepository();
    const outbox = createTestOutbox({
      repository,
      createId: (() => { let id = 0; return () => `op-count-${++id}`; })(),
      now: () => 1_000,
      execute: async () => {}
    });
    for (const id of ['q-1', 'q-2', 'q-3', 'q-4', 'q-5']) {
      await outbox.enqueue({
        table: 'quotes', type: 'upsert', entityId: id, data: { id },
        updatedAt: '2026-07-18T10:00:00Z'
      });
    }

    expect(await outbox.status()).toMatchObject({ pending: 5, held: 0 });
    await outbox.flush();
    expect(await outbox.status()).toMatchObject({ pending: 0, held: 0 });
  });

  it('un cambio siempre rechazado se aparta y deja subir los otros cuatro', async () => {
    const repository = memoryRepository();
    let time = 1_000;
    const uploaded: string[] = [];
    const outbox = createTestOutbox({
      repository,
      createId: (() => { let id = 0; return () => `op-reject-${++id}`; })(),
      now: () => time,
      retryBaseMs: 1,
      maxAttempts: 3,
      shouldHold: () => true,
      scheduleRetry: () => {},
      execute: async (operation) => {
        if (operation.entityId === 'q-1') throw new Error('rechazado');
        uploaded.push(operation.entityId);
      }
    });
    for (const id of ['q-1', 'q-2', 'q-3', 'q-4', 'q-5']) {
      await outbox.enqueue({
        table: 'quotes', type: 'upsert', entityId: id, data: { id },
        updatedAt: '2026-07-18T10:00:00Z'
      });
    }

    await outbox.flush();
    time = 2_000;
    await outbox.flush();
    time = 3_000;
    await outbox.flush();

    expect(uploaded).toEqual(['q-2', 'q-3', 'q-4', 'q-5']);
    expect(await outbox.status()).toMatchObject({ pending: 0, held: 1 });
  });

  it('el cambio apartado sigue listado y se puede reintentar', async () => {
    const repository = memoryRepository();
    let rejected = true;
    let time = 1_000;
    const outbox = createTestOutbox({
      repository,
      createId: () => 'op-held',
      now: () => time,
      retryBaseMs: 1,
      maxAttempts: 1,
      shouldHold: () => true,
      scheduleRetry: () => {},
      execute: async () => {
        if (rejected) throw new Error('rechazado');
      }
    });
    await outbox.enqueue({
      table: 'quotes', type: 'upsert', entityId: 'q-held', data: { id: 'q-held' },
      updatedAt: '2026-07-18T10:00:00Z'
    });

    await outbox.flush();
    expect((await outbox.status()).operations[0]).toMatchObject({ id: 'op-held', state: 'held' });

    rejected = false;
    time = 2_000;
    await outbox.retryHeld('op-held');

    expect(await outbox.status()).toMatchObject({ pending: 0, held: 0, operations: [] });
  });

  it('puede usar la nube retirando un cambio retenido antes de actualizar', async () => {
    const repository = memoryRepository();
    repository.values.set('op-held-inventory', {
      ...ACCOUNT_A,
      id: 'op-held-inventory',
      table: 'stock_jewels',
      type: 'upsert',
      entityId: 'jewel-1',
      data: { id: 'jewel-1' },
      updatedAt: '2026-08-04T10:00:00Z',
      queuedAt: 1,
      attempts: 5,
      nextAttemptAt: 0,
      state: 'held'
    });
    const outbox = createTestOutbox({ repository, execute: async () => {} });

    await outbox.resolveTableChanges?.(['stone_lots', 'stock_jewels'], async (operations) => {
      expect(operations.map((operation) => operation.id)).toEqual(['op-held-inventory']);
      await repository.removeMany?.(operations.map((operation) => operation.id));
      expect(await outbox.list()).toEqual([]);
    });

    expect(await outbox.list()).toEqual([]);
  });

  it('conserva el cambio retenido si no logra traer la versión de la nube', async () => {
    const repository = memoryRepository();
    const held: CloudOutboxOperation = {
      ...ACCOUNT_A,
      id: 'op-held-rollback',
      table: 'stone_lots',
      type: 'delete',
      entityId: 'lot-1',
      data: null,
      updatedAt: '2026-08-04T10:00:00Z',
      queuedAt: 1,
      attempts: 5,
      nextAttemptAt: 0,
      state: 'held'
    };
    repository.values.set(held.id, held);
    const outbox = createTestOutbox({ repository, execute: async () => {} });

    await expect(outbox.resolveTableChanges?.(['stone_lots', 'stock_jewels'], async () => {
      throw new Error('Sin conexión');
    })).rejects.toThrow(/sin conexión/i);

    expect(await outbox.list()).toEqual([held]);
  });

  it('si falla la retirada atómica conserva completa la cola original', async () => {
    const repository = memoryRepository();
    const first: CloudOutboxOperation = {
      ...ACCOUNT_A,
      id: 'op-first', table: 'stone_lots', type: 'upsert', entityId: 'lot-1',
      data: { id: 'lot-1' }, updatedAt: '2026-08-04T10:00:00Z',
      queuedAt: 1, attempts: 5, nextAttemptAt: 0, state: 'held'
    };
    const second: CloudOutboxOperation = {
      ...ACCOUNT_A,
      id: 'op-second', table: 'stock_jewels', type: 'upsert', entityId: 'jewel-1',
      data: { id: 'jewel-1' }, updatedAt: '2026-08-04T10:00:00Z',
      queuedAt: 2, attempts: 0, nextAttemptAt: 0
    };
    repository.values.set(first.id, first);
    repository.values.set(second.id, second);
    repository.removeMany = async () => { throw new Error('fallo atómico'); };
    const outbox = createTestOutbox({ repository, execute: async () => {} });

    await expect(outbox.resolveTableChanges?.(
      ['stone_lots', 'stock_jewels'],
      async (operations) => repository.removeMany?.(
        operations.map((operation) => operation.id)
      )
    ))
      .rejects.toThrow(/fallo atómico/i);

    expect(await outbox.list()).toEqual([first, second]);
  });

  it('detiene el envío entre operaciones antes de usar la versión de la nube', async () => {
    const repository = memoryRepository();
    const inFlight = deferred();
    const uploaded: string[] = [];
    const operations: CloudOutboxOperation[] = [
      {
        ...ACCOUNT_A,
        id: 'op-in-flight', table: 'stone_lots', type: 'upsert', entityId: 'lot-running',
        data: { id: 'lot-running' }, updatedAt: '2026-08-04T10:00:00Z',
        queuedAt: 1, attempts: 0, nextAttemptAt: 0
      },
      {
        ...ACCOUNT_A,
        id: 'op-not-started', table: 'stock_jewels', type: 'upsert', entityId: 'jewel-pending',
        data: { id: 'jewel-pending' }, updatedAt: '2026-08-04T10:01:00Z',
        queuedAt: 2, attempts: 0, nextAttemptAt: 0
      },
      {
        ...ACCOUNT_A,
        id: 'op-held-conflict', table: 'stock_jewels', type: 'delete', entityId: 'jewel-held',
        data: null, updatedAt: '2026-08-04T10:02:00Z',
        queuedAt: 3, attempts: 5, nextAttemptAt: 0, state: 'held'
      }
    ];
    for (const operation of operations) repository.values.set(operation.id, operation);
    const outbox = createTestOutbox({
      repository,
      execute: async (operation) => {
        uploaded.push(operation.id);
        if (operation.id === 'op-in-flight') await inFlight.promise;
      }
    });

    const flushing = outbox.flush();
    await vi.waitFor(() => expect(uploaded).toEqual(['op-in-flight']));
    let resolutionStarted = false;
    const resolving = outbox.resolveTableChanges?.(
      ['stone_lots', 'stock_jewels'],
      async (selected) => {
        resolutionStarted = true;
        expect(selected.map((operation) => operation.id)).toEqual([
          'op-not-started',
          'op-held-conflict'
        ]);
        await repository.removeMany?.(selected.map((operation) => operation.id));
      }
    );
    await Promise.resolve();
    expect(resolutionStarted).toBe(false);

    inFlight.resolve();
    await Promise.all([flushing, resolving]);

    expect(uploaded).toEqual(['op-in-flight']);
    expect(await outbox.list()).toEqual([]);
  });

  it('al volver la red asigna el número del servidor y sube la cotización una sola vez', async () => {
    const repository = memoryRepository();
    let online = false;
    let time = 1_000;
    let uploads = 0;
    let assigned = 0;
    const outbox = createTestOutbox({
      repository,
      createId: () => 'op-offline',
      now: () => time,
      scheduleRetry: () => {},
      prepare: async (operation) => {
        if (!online) throw new Error('sin red');
        return {
          ...operation,
          data: { ...(operation.data as object), number: `ED-2026-${String(++assigned).padStart(4, '0')}` }
        };
      },
      execute: async (operation) => {
        if (!online) throw new Error('sin red');
        uploads += 1;
        expect(operation.data).toMatchObject({ number: 'ED-2026-0001' });
      }
    });
    await outbox.enqueue({
      table: 'quotes', type: 'upsert', entityId: 'q-offline', data: { id: 'q-offline', number: '' },
      updatedAt: '2026-07-18T10:00:00Z'
    });

    await outbox.flush();
    online = true;
    time = 2_000;
    await outbox.flush();

    expect(assigned).toBe(1);
    expect(uploads).toBe(1);
    expect(await outbox.list()).toEqual([]);
  });

  it('dos cotizaciones creadas sin red reciben dos números distintos', async () => {
    const repository = memoryRepository();
    let sequence = 6;
    const uploadedNumbers: string[] = [];
    const outbox = createTestOutbox({
      repository,
      createId: (() => { let id = 0; return () => `op-${++id}`; })(),
      now: () => 1_000,
      scheduleRetry: () => {},
      prepare: async (operation) => ({
        ...operation,
        data: { ...(operation.data as object), number: `ED-2026-${String(++sequence).padStart(4, '0')}` }
      }),
      execute: async (operation) => {
        uploadedNumbers.push((operation.data as { number: string }).number);
      }
    });
    for (const id of ['q-a', 'q-b']) {
      await outbox.enqueue({
        table: 'quotes', type: 'upsert', entityId: id, data: { id, number: '' },
        updatedAt: '2026-07-18T10:00:00Z'
      });
    }

    await outbox.flush();

    expect(uploadedNumbers).toEqual(['ED-2026-0007', 'ED-2026-0008']);
  });

  it('procesa operaciones estrictamente en serie', async () => {
    const repository = memoryRepository();
    const first = deferred();
    const started: string[] = [];
    let ids = 0;
    let time = 100;
    const outbox = createTestOutbox({
      repository,
      createId: () => `op-${++ids}`,
      now: () => time++,
      scheduleRetry: () => {},
      execute: async (operation) => {
        started.push(operation.entityId);
        if (operation.entityId === 'primero') await first.promise;
      }
    });
    await outbox.enqueue({
      table: 'clients', type: 'upsert', entityId: 'primero', data: {}, updatedAt: '2026-07-18T10:00:00Z'
    });
    await outbox.enqueue({
      table: 'clients', type: 'upsert', entityId: 'segundo', data: {}, updatedAt: '2026-07-18T10:01:00Z'
    });

    const flushing = outbox.flush();
    await vi.waitFor(() => expect(started).toEqual(['primero']));
    first.resolve();
    await flushing;

    expect(started).toEqual(['primero', 'segundo']);
    expect(await outbox.list()).toEqual([]);
  });

  it('conserva el fallo y aumenta la espera antes de reintentar', async () => {
    const repository = memoryRepository();
    let time = 1_000;
    let calls = 0;
    const scheduled: number[] = [];
    const outbox = createTestOutbox({
      repository,
      createId: () => 'op-retry',
      now: () => time,
      retryBaseMs: 250,
      scheduleRetry: (_callback, delay) => void scheduled.push(delay),
      execute: async () => {
        calls += 1;
        if (calls === 1) throw new Error('sin red');
      }
    });
    await outbox.enqueue({
      table: 'quotes', type: 'upsert', entityId: 'q-1', data: {}, updatedAt: '2026-07-18T10:00:00Z'
    });

    expect(await outbox.flush()).toEqual({ processed: 0, pending: 1 });
    expect((await outbox.list())[0]).toMatchObject({ attempts: 1, nextAttemptAt: 1_250 });
    expect(scheduled).toEqual([250]);

    time = 1_250;
    expect(await outbox.flush()).toEqual({ processed: 1, pending: 0 });
  });

  it('si cae la red a mitad del envío, deja esa operación y las siguientes en cola', async () => {
    const repository = memoryRepository();
    let ids = 0;
    const outbox = createTestOutbox({
      repository,
      createId: () => `op-${++ids}`,
      now: () => 1_000 + ids,
      scheduleRetry: () => {},
      execute: async (operation) => {
        if (operation.entityId === 'q-2') throw new Error('red interrumpida');
      }
    });
    for (const id of ['q-1', 'q-2', 'q-3']) {
      await outbox.enqueue({
        table: 'quotes', type: 'upsert', entityId: id, data: { id }, updatedAt: '2026-07-18T10:00:00Z'
      });
    }

    expect(await outbox.flush()).toEqual({ processed: 1, pending: 2 });
    expect((await outbox.list()).map((operation) => operation.entityId)).toEqual(['q-2', 'q-3']);
    expect((await outbox.list())[0].attempts).toBe(1);
  });
  it('al arrancar sube lo pendiente de la sesión anterior sin esperar ningún evento', async () => {
    // El caso real: crear sin señal, cerrar la app, reabrirla con internet.
    // Al abrir no ocurre ni "online" ni "visibilitychange": la subida debe
    // dispararse sola o el cambio queda esperando para siempre.
    const repository = memoryRepository();
    const uploaded: string[] = [];
    const flushed = deferred();
    const outbox = createTestOutbox({
      repository,
      createId: (() => { let id = 0; return () => `op-boot-${++id}`; })(),
      now: () => 1_000,
      execute: async (operation) => {
        uploaded.push(operation.entityId);
        flushed.resolve();
      }
    });
    await outbox.enqueue({
      table: 'quotes', type: 'upsert', entityId: 'q-pendiente-de-ayer',
      data: { id: 'q-pendiente-de-ayer' }, updatedAt: '2026-07-18T10:00:00Z'
    });

    const silentSource = { addEventListener: () => {}, removeEventListener: () => {} };
    const stop = startOutboxTriggers(outbox, silentSource, silentSource);
    await flushed.promise;
    // Esperar a que la subida iniciada al arrancar termine su limpieza.
    await outbox.flush();
    stop();

    expect(uploaded).toEqual(['q-pendiente-de-ayer']);
    expect(await outbox.status()).toMatchObject({ pending: 0, held: 0 });
  });
});
