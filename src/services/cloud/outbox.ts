import { dbDelete, dbGetAll, dbPut, dbWriteTransaction } from '../db';

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
  | 'expenses';

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
}

export interface NewCloudOperation {
  table: CloudTable;
  type: CloudOperationType;
  entityId: string;
  data?: unknown;
  updatedAt: string;
}

export interface OutboxRepository {
  list: () => Promise<CloudOutboxOperation[]>;
  put: (operation: CloudOutboxOperation) => Promise<void>;
  remove: (id: string) => Promise<void>;
  putMany?: (operations: readonly CloudOutboxOperation[]) => Promise<void>;
  removeMany?: (ids: readonly string[]) => Promise<void>;
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

export const indexedDbOutboxRepository: OutboxRepository = {
  list: () => dbGetAll<CloudOutboxOperation>('cloudOutbox'),
  put: (operation) => dbPut('cloudOutbox', operation),
  remove: (id) => dbDelete('cloudOutbox', id),
  putMany: (operations) => dbWriteTransaction(['cloudOutbox'], (getStore) => {
    const store = getStore('cloudOutbox');
    for (const operation of operations) store.put(operation);
  }),
  removeMany: (ids) => dbWriteTransaction(['cloudOutbox'], (getStore) => {
    const store = getStore('cloudOutbox');
    for (const id of ids) store.delete(id);
  })
};

function defaultOperationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function ordered(operations: CloudOutboxOperation[]): CloudOutboxOperation[] {
  return [...operations].sort((a, b) => a.queuedAt - b.queuedAt || a.id.localeCompare(b.id));
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
  let activeFlush: Promise<OutboxFlushResult> | null = null;
  let activeResolution: Promise<void> | null = null;
  let resolutionRequested = false;
  let retryScheduledFor = 0;
  let queueClockInitialized = false;
  let queueClock: Promise<number> = Promise.resolve(Number.NEGATIVE_INFINITY);

  const nextQueuedAt = (): Promise<number> => {
    queueClock = queueClock.then(async (previous) => {
      let latest = previous;
      if (!queueClockInitialized) {
        const stored = await options.repository.list();
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
    if (activeResolution) return activeResolution.then(() => flush(), () => flush());
    if (activeFlush) return activeFlush;

    activeFlush = (async () => {
      let processed = 0;
      const operations = ordered(await options.repository.list());

      for (const operation of operations) {
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
          await options.execute(ready);
          await options.repository.remove(operation.id);
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

      return { processed, pending: (await options.repository.list()).length };
    })().finally(() => {
      activeFlush = null;
    });

    return activeFlush;
  };

  return {
    async enqueue(input) {
      if (activeResolution) await activeResolution;
      const operation: CloudOutboxOperation = {
        id: createId(),
        table: input.table,
        type: input.type,
        entityId: input.entityId,
        data: input.type === 'delete' ? null : input.data ?? null,
        updatedAt: input.updatedAt,
        queuedAt: await nextQueuedAt(),
        attempts: 0,
        nextAttemptAt: 0
      };
      await options.repository.put(operation);
      options.onChange?.();
      return operation;
    },
    flush,
    list: async () => ordered(await options.repository.list()),
    async status() {
      const operations = ordered(await options.repository.list());
      return {
        pending: operations.filter((operation) => operation.state !== 'held').length,
        held: operations.filter((operation) => operation.state === 'held').length,
        operations
      };
    },
    async retryHeld(id) {
      if (activeResolution) await activeResolution;
      const operations = await options.repository.list();
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
      const selectedTables = new Set(tables);
      resolutionRequested = true;
      let resolutionCompleted = false;
      const run = (async () => {
        if (activeFlush) await activeFlush;
        const operations = (await options.repository.list()).filter(
          (operation) => selectedTables.has(operation.table)
        );
        if (!operations.some((operation) => operation.state === 'held')) {
          resolutionCompleted = true;
          return;
        }
        await resolve(operations);
        const remainingIds = new Set(
          (await options.repository.list()).map((operation) => operation.id)
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
