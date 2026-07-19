import { dbDelete, dbGetAll, dbPut } from '../db';

export type CloudTable =
  | 'org_settings'
  | 'clients'
  | 'quotes'
  | 'appointments'
  | 'stone_lots'
  | 'suppliers';

export type CloudOperationType = 'upsert' | 'delete';

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
  remove: (id) => dbDelete('cloudOutbox', id)
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
  let retryScheduledFor = 0;

  const schedule = (at: number, flush: () => Promise<OutboxFlushResult>) => {
    if (retryScheduledFor && retryScheduledFor <= at) return;
    retryScheduledFor = at;
    scheduleRetry(() => {
      retryScheduledFor = 0;
      void flush().catch(() => {});
    }, Math.max(0, at - now()));
  };

  const flush = (): Promise<OutboxFlushResult> => {
    if (activeFlush) return activeFlush;

    activeFlush = (async () => {
      let processed = 0;
      const operations = ordered(await options.repository.list());

      for (const operation of operations) {
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
      const operation: CloudOutboxOperation = {
        id: createId(),
        table: input.table,
        type: input.type,
        entityId: input.entityId,
        data: input.type === 'delete' ? null : input.data ?? null,
        updatedAt: input.updatedAt,
        queuedAt: now(),
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
