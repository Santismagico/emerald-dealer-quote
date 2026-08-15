import {
  dbDelete,
  dbDeleteForCloudScope,
  dbGetAll,
  dbGetAllForCloudScope,
  dbPut,
  dbPutForCloudScope,
  dbWriteTransaction,
  dbWriteTransactionForCloudScope
} from '../db';
import type { CloudOperationScope } from './scope';

export type CloudTable =
  | 'org_settings'
  | 'clients'
  | 'quotes'
  | 'appointments'
  | 'stone_lots'
  | 'suppliers'
  | 'buyers'
  | 'stock_jewels'
  | 'material_partners'
  | 'material_lots'
  | 'expenses'
  | 'fund_contributions';

export type CloudOperationType =
  | 'upsert'
  | 'delete'
  | 'transform_stock_jewel'
  | 'restore_stock_jewel'
  | 'authorize_import'
  | 'seed_stone_lot_import'
  | 'seed_stock_jewel_import'
  | 'finalize_stone_lot_import'
  | 'finalize_stock_jewel_import';

export interface CloudOutboxOperation {
  id: string;
  table: CloudTable;
  type: CloudOperationType;
  entityId: string;
  data: unknown | null;
  updatedAt: string;
  queuedAt: number;
  attempts: number;
  nextAttemptAt: number;
  state?: 'pending' | 'held';
  /** Ausentes únicamente en registros antiguos, que se dejan en cuarentena. */
  userId?: string;
  organizationId?: string;
}

export interface NewCloudOperation {
  table: CloudTable;
  type: CloudOperationType;
  entityId: string;
  data?: unknown;
  updatedAt: string;
}

export interface OutboxRepository {
  list: (scope?: CloudOperationScope) => Promise<CloudOutboxOperation[]>;
  put: (operation: CloudOutboxOperation) => Promise<void>;
  remove: (id: string, scope?: CloudOperationScope) => Promise<void>;
  putMany?: (operations: readonly CloudOutboxOperation[]) => Promise<void>;
  removeMany?: (ids: readonly string[], scope?: CloudOperationScope) => Promise<void>;
}

export interface OutboxFlushResult {
  processed: number;
  pending: number;
}

export interface OutboxStatus {
  pending: number;
  held: number;
  operations: CloudOutboxOperation[];
}

export interface CloudOutbox {
  enqueue: (operation: NewCloudOperation) => Promise<CloudOutboxOperation>;
  flush: () => Promise<OutboxFlushResult>;
  list: () => Promise<CloudOutboxOperation[]>;
  status: () => Promise<OutboxStatus>;
  retryHeld: (id?: string) => Promise<OutboxFlushResult>;
  resolveTableChanges?: (
    tables: readonly CloudTable[],
    resolve: (operations: readonly CloudOutboxOperation[]) => Promise<void>
  ) => Promise<void>;
}

interface OutboxOptions {
  repository: OutboxRepository;
  getScope: () => CloudOperationScope | null;
  prepare?: (operation: CloudOutboxOperation) => Promise<CloudOutboxOperation>;
  execute: (operation: CloudOutboxOperation) => Promise<void>;
  now?: () => number;
  createId?: () => string;
  retryBaseMs?: number;
  maxAttempts?: number;
  shouldHold?: (error: unknown) => boolean;
  onChange?: () => void;
  scheduleRetry?: (callback: () => void, delayMs: number) => void;
}

function operationScope(operation: CloudOutboxOperation): CloudOperationScope | null {
  return operation.userId && operation.organizationId
    ? { userId: operation.userId, organizationId: operation.organizationId }
    : null;
}

export const indexedDbOutboxRepository: OutboxRepository = {
  list: (scope) => scope
    ? dbGetAllForCloudScope<CloudOutboxOperation>(scope, 'cloudOutbox')
    : dbGetAll<CloudOutboxOperation>('cloudOutbox'),
  put: (operation) => {
    const scope = operationScope(operation);
    return scope
      ? dbPutForCloudScope(scope, 'cloudOutbox', operation)
      : dbPut('cloudOutbox', operation);
  },
  remove: (id, scope) => scope
    ? dbDeleteForCloudScope(scope, 'cloudOutbox', id)
    : dbDelete('cloudOutbox', id),
  putMany: (operations) => {
    if (operations.length === 0) return Promise.resolve();
    const scope = operationScope(operations[0]);
    if (scope && operations.some((operation) => !belongsToScope(operation, scope))) {
      return Promise.reject(new Error('No se pueden mezclar identidades en una transacción de cola.'));
    }
    if (scope) {
      return dbWriteTransactionForCloudScope(scope, ['cloudOutbox'], (getStore) => {
        const store = getStore('cloudOutbox');
        for (const operation of operations) store.put(operation);
      });
    }
    return dbWriteTransaction(['cloudOutbox'], (getStore) => {
      const store = getStore('cloudOutbox');
      for (const operation of operations) store.put(operation);
    });
  },
  removeMany: (ids, scope) => {
    if (scope) {
      return dbWriteTransactionForCloudScope(scope, ['cloudOutbox'], (getStore) => {
        const store = getStore('cloudOutbox');
        for (const id of ids) store.delete(id);
      });
    }
    return dbWriteTransaction(['cloudOutbox'], (getStore) => {
      const store = getStore('cloudOutbox');
      for (const id of ids) store.delete(id);
    });
  }
};

function defaultOperationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function ordered(operations: CloudOutboxOperation[]): CloudOutboxOperation[] {
  return [...operations].sort((a, b) => a.queuedAt - b.queuedAt || a.id.localeCompare(b.id));
}

function belongsToScope(
  operation: CloudOutboxOperation,
  scope: CloudOperationScope
): boolean {
  return operation.userId === scope.userId && operation.organizationId === scope.organizationId;
}

function sameScope(
  current: CloudOperationScope | null,
  expected: CloudOperationScope
): boolean {
  return Boolean(
    current &&
    current.userId === expected.userId &&
    current.organizationId === expected.organizationId
  );
}

export function createCloudOutbox(options: OutboxOptions): CloudOutbox {
  const now = options.now ?? Date.now;
  const createId = options.createId ?? defaultOperationId;
  const retryBaseMs = Math.max(1, options.retryBaseMs ?? 1_000);
  const maxAttempts = Math.max(1, options.maxAttempts ?? 5);
  const shouldHold = options.shouldHold ?? (() => false);
  const scheduleRetry = options.scheduleRetry ?? ((callback, delayMs) => {
    globalThis.setTimeout(callback, delayMs);
  });
  let activeFlush: { scope: CloudOperationScope; promise: Promise<OutboxFlushResult> } | null = null;
  let activeResolution: Promise<void> | null = null;
  let resolutionRequested = false;
  let retryScheduledFor = 0;
  let queueClockInitialized = false;
  let queueClock: Promise<number> = Promise.resolve(Number.NEGATIVE_INFINITY);

  const listForScope = async (scope: CloudOperationScope): Promise<CloudOutboxOperation[]> =>
    ordered((await options.repository.list(scope)).filter((operation) => belongsToScope(operation, scope)));

  const nextQueuedAt = (scope: CloudOperationScope): Promise<number> => {
    queueClock = queueClock.then(async (previous) => {
      let latest = previous;
      if (!queueClockInitialized) {
        const stored = await options.repository.list(scope);
        latest = stored.reduce(
          (maximum, operation) => Math.max(maximum, operation.queuedAt),
          latest
        );
        queueClockInitialized = true;
      }
      return Math.max(now(), latest + 1);
    });
    return queueClock;
  };

  const schedule = (at: number, flush: () => Promise<OutboxFlushResult>) => {
    if (retryScheduledFor && retryScheduledFor <= at) return;
    retryScheduledFor = at;
    scheduleRetry(() => {
      retryScheduledFor = 0;
      void flush().catch(() => {});
    }, Math.max(0, at - now()));
  };

  const flush = (): Promise<OutboxFlushResult> => {
    const flushScope = options.getScope();
    if (!flushScope) return Promise.resolve({ processed: 0, pending: 0 });
    if (activeResolution) return activeResolution.then(() => flush(), () => flush());
    if (activeFlush) {
      if (sameScope(activeFlush.scope, flushScope)) return activeFlush.promise;
      return activeFlush.promise.then(() => flush(), () => flush());
    }

    const promise = (async () => {
      let processed = 0;
      const operations = await listForScope(flushScope);

      for (const operation of operations) {
        if (!sameScope(options.getScope(), flushScope)) break;
        if (resolutionRequested) break;
        if (operation.state === 'held') continue;
        const currentTime = now();
        if (operation.nextAttemptAt > currentTime) {
          schedule(operation.nextAttemptAt, flush);
          break;
        }

        let ready = operation;
        try {
          if (options.prepare) {
            ready = await options.prepare(operation);
            if (ready !== operation) await options.repository.put(ready);
          }
          if (!sameScope(options.getScope(), flushScope)) break;
          await options.execute(ready);
          await options.repository.remove(operation.id, flushScope);
          options.onChange?.();
          processed += 1;
        } catch (error) {
          const attempts = ready.attempts + 1;
          if (attempts >= maxAttempts && shouldHold(error)) {
            await options.repository.put({
              ...ready,
              attempts,
              nextAttemptAt: 0,
              state: 'held'
            });
            options.onChange?.();
            continue;
          }
          const delay = retryBaseMs * 2 ** Math.min(attempts - 1, 8);
          const failed = { ...ready, attempts, nextAttemptAt: now() + delay, state: 'pending' as const };
          await options.repository.put(failed);
          options.onChange?.();
          schedule(failed.nextAttemptAt, flush);
          break;
        }
      }

      return { processed, pending: (await listForScope(flushScope)).length };
    })().finally(() => {
      activeFlush = null;
    });

    activeFlush = { scope: flushScope, promise };
    return promise;
  };

  return {
    async enqueue(input) {
      if (activeResolution) await activeResolution;
      const scope = options.getScope();
      if (!scope) {
        throw new Error('No hay una identidad cloud activa para guardar este cambio.');
      }
      const operation: CloudOutboxOperation = {
        id: createId(),
        table: input.table,
        type: input.type,
        entityId: input.entityId,
        data: input.type === 'delete' ? null : input.data ?? null,
        updatedAt: input.updatedAt,
        queuedAt: await nextQueuedAt(scope),
        attempts: 0,
        nextAttemptAt: 0,
        userId: scope.userId,
        organizationId: scope.organizationId
      };
      await options.repository.put(operation);
      options.onChange?.();
      return operation;
    },
    flush,
    list: async () => {
      const scope = options.getScope();
      return scope ? listForScope(scope) : [];
    },
    async status() {
      const scope = options.getScope();
      const operations = scope ? await listForScope(scope) : [];
      return {
        pending: operations.filter((operation) => operation.state !== 'held').length,
        held: operations.filter((operation) => operation.state === 'held').length,
        operations
      };
    },
    async retryHeld(id) {
      if (activeResolution) await activeResolution;
      const scope = options.getScope();
      if (!scope) return { processed: 0, pending: 0 };
      const operations = await listForScope(scope);
      for (const operation of operations) {
        if (operation.state !== 'held' || (id && operation.id !== id)) continue;
        await options.repository.put({
          ...operation,
          attempts: 0,
          nextAttemptAt: 0,
          state: 'pending'
        });
      }
      options.onChange?.();
      return flush();
    },
    resolveTableChanges(tables, resolve) {
      if (activeResolution) return activeResolution;
      const scope = options.getScope();
      if (!scope) {
        return Promise.reject(new Error('No hay una identidad cloud activa para resolver cambios.'));
      }
      const selectedTables = new Set(tables);
      resolutionRequested = true;
      let resolutionCompleted = false;
      const run = (async () => {
        if (activeFlush) await activeFlush.promise;
        if (!sameScope(options.getScope(), scope)) {
          throw new Error('La identidad cloud cambió antes de resolver los cambios.');
        }
        const operations = (await listForScope(scope)).filter(
          (operation) => selectedTables.has(operation.table)
        );
        if (!operations.some((operation) => operation.state === 'held')) {
          resolutionCompleted = true;
          return;
        }
        await resolve(operations);
        const remainingIds = new Set(
          (await listForScope(scope)).map((operation) => operation.id)
        );
        if (operations.some((operation) => remainingIds.has(operation.id))) {
          throw new Error('La versión de la nube no retiró toda la cola seleccionada.');
        }
        options.onChange?.();
        resolutionCompleted = true;
      })();
      activeResolution = run.finally(() => {
        resolutionRequested = false;
        activeResolution = null;
        if (resolutionCompleted) void flush().catch(() => {});
      });
      return activeResolution;
    }
  };
}

interface BrowserEventSource {
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

export function startOutboxTriggers(
  outbox: CloudOutbox,
  onlineSource: BrowserEventSource = window,
  visibilitySource: BrowserEventSource = document
): () => void {
  const flush = () => void outbox.flush().catch(() => {});
  const visibleFlush = () => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') flush();
  };

  onlineSource.addEventListener('online', flush);
  visibilitySource.addEventListener('visibilitychange', visibleFlush);
  // Al arrancar no ocurre ningún evento: la app ya está visible y ya hay red.
  // Sin este intento inicial, lo encolado en una sesión anterior queda esperando
  // para siempre un aviso que nunca llega.
  visibleFlush();
  return () => {
    onlineSource.removeEventListener('online', flush);
    visibilitySource.removeEventListener('visibilitychange', visibleFlush);
  };
}
