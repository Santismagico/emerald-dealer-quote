import type { Appointment, Client, Quote, Settings, StoneLot, Supplier } from '../../types';
import type { StoreDataSource } from '../dataSource';
import type { GoldPriceBreakdown } from '../goldPrice';
import * as localStorage from '../storage';
import { getSupabase } from './config';
import {
  createCloudOutbox,
  indexedDbOutboxRepository,
  startOutboxTriggers,
  type CloudOutbox,
  type CloudOutboxOperation,
  type CloudTable
} from './outbox';
import {
  createCloudSync,
  indexedDbSyncCache,
  type CloudRow,
  type CloudSync,
  type CloudSyncRemote
} from './sync';

interface QueryResult<T> {
  data: T | null;
  error: { message?: string } | null;
}

interface SupabaseLike {
  from: (table: string) => {
    select: (columns: string) => PromiseLike<QueryResult<CloudRow[]>>;
  };
  rpc: (name: string, args?: Record<string, unknown>) => PromiseLike<QueryResult<unknown>>;
}

export interface CloudRemote extends CloudSyncRemote {
  execute: (operation: CloudOutboxOperation) => Promise<void>;
  nextQuoteNumber: () => Promise<string>;
}

export interface CloudDataSource extends StoreDataSource {
  pullAll: () => Promise<void>;
  flush: () => Promise<void>;
  pendingCount: () => Promise<number>;
}

export const CLOUD_DATA_CHANGED_EVENT = 'emerald-cloud-data-changed';

const functionNames: Record<CloudTable, { upsert: string; delete: string }> = {
  org_settings: { upsert: 'upsert_settings', delete: 'delete_settings' },
  clients: { upsert: 'upsert_client', delete: 'delete_client' },
  quotes: { upsert: 'upsert_quote', delete: 'delete_quote' },
  appointments: { upsert: 'upsert_appointment', delete: 'delete_appointment' },
  stone_lots: { upsert: 'upsert_stone_lot', delete: 'delete_stone_lot' },
  suppliers: { upsert: 'upsert_supplier', delete: 'delete_supplier' }
};

function resultOrThrow<T>(result: QueryResult<T>, action: string): T {
  if (result.error) throw new Error(result.error.message || `No se pudo ${action}.`);
  if (result.data === null) throw new Error(`No se pudo ${action}.`);
  return result.data;
}

export function createSupabaseCloudRemote(
  client: () => Promise<SupabaseLike> = async () => (await getSupabase()) as unknown as SupabaseLike
): CloudRemote {
  return {
    async list(table) {
      const columns = table === 'org_settings' ? 'data, updated_at' : 'id, data, updated_at';
      return resultOrThrow(await (await client()).from(table).select(columns), `consultar ${table}`);
    },
    async execute(operation) {
      const functions = functionNames[operation.table];
      const args = operation.table === 'org_settings'
        ? operation.type === 'upsert'
          ? { p_data: operation.data, p_updated_at: operation.updatedAt }
          : undefined
        : operation.type === 'upsert'
          ? { p_id: operation.entityId, p_data: operation.data, p_updated_at: operation.updatedAt }
          : { p_id: operation.entityId };
      const result = await (await client()).rpc(functions[operation.type], args);
      if (result.error) throw new Error(result.error.message || 'No se pudo sincronizar el cambio.');
    },
    async nextQuoteNumber() {
      const result = await (await client()).rpc('next_quote_number');
      const value = resultOrThrow(result, 'crear el consecutivo');
      if (typeof value !== 'string') throw new Error('El consecutivo recibido no es válido.');
      return value;
    }
  };
}

export async function prepareCloudOperation(
  remote: Pick<CloudRemote, 'nextQuoteNumber'>,
  cache: Pick<typeof indexedDbSyncCache, 'put'>,
  operation: CloudOutboxOperation
): Promise<CloudOutboxOperation> {
  if (operation.table !== 'quotes' || operation.type !== 'upsert') return operation;
  const data = operation.data as Record<string, unknown> | null;
  if (!data || (typeof data.number === 'string' && data.number.trim())) return operation;

  const prepared = {
    ...operation,
    data: { ...data, number: await remote.nextQuoteNumber() }
  };
  await cache.put('quotes', {
    id: operation.entityId,
    data: prepared.data,
    updatedAt: operation.updatedAt
  });
  return prepared;
}

function changedLots(before: StoneLot[], after: StoneLot[]): StoneLot[] {
  const previous = new Map(before.map((lot) => [lot.id, JSON.stringify(lot)]));
  return after.filter((lot) => previous.get(lot.id) !== JSON.stringify(lot));
}

export function createCloudDataSource(options: {
  remote: CloudRemote;
  outbox: CloudOutbox;
  sync: CloudSync;
  now?: () => Date;
}): CloudDataSource {
  const nowIso = () => (options.now ?? (() => new Date()))().toISOString();

  const enqueue = async (
    table: CloudTable,
    type: 'upsert' | 'delete',
    entityId: string,
    data: unknown,
    updatedAt: string
  ) => {
    await options.outbox.enqueue({ table, type, entityId, data, updatedAt });
    void options.outbox.flush().catch(() => {});
  };

  const cacheAndQueue = async (
    table: CloudTable,
    entityId: string,
    data: unknown,
    updatedAt: string
  ) => {
    await indexedDbSyncCache.put(table, { id: entityId, data, updatedAt });
    await enqueue(table, 'upsert', entityId, data, updatedAt);
  };

  const pullThen = async <T>(table: CloudTable, read: () => Promise<T>): Promise<T> => {
    try {
      await options.sync.pullTable(table);
    } catch {
      // Sin conexión se entrega la caché local completa.
    }
    return read();
  };

  const saveSettings = async (settings: Settings): Promise<void> => {
    const updatedAt = nowIso();
    await cacheAndQueue('org_settings', localStorage.SETTINGS_KEY, settings, updatedAt);
  };

  const updateSettingsAtomically = async (
    update: (current: Settings) => Settings
  ): Promise<Settings> => {
    const saved = await localStorage.updateSettingsAtomically(update);
    await saveSettings(saved);
    return saved;
  };

  return {
    loadSettings: () => pullThen('org_settings', localStorage.loadSettings),
    saveSettings,
    updateSettingsAtomically,
    async saveEditableSettings(settings, goldPriceWasEdited) {
      const saved = await localStorage.saveEditableSettings(settings, goldPriceWasEdited);
      await saveSettings(saved);
      return saved;
    },
    async saveFetchedGoldPrice(fetched: GoldPriceBreakdown) {
      const result = await localStorage.saveFetchedGoldPrice(fetched);
      await saveSettings(result.settings);
      return result;
    },
    async recordBackupExported(exportedAt) {
      const saved = await localStorage.recordBackupExported(exportedAt);
      await saveSettings(saved);
      return saved;
    },
    async snoozeBackupReminder(snoozedUntil) {
      const saved = await localStorage.snoozeBackupReminder(snoozedUntil);
      await saveSettings(saved);
      return saved;
    },
    async ensureBackupReminderFirstDataAt(startedAt) {
      const saved = await localStorage.ensureBackupReminderFirstDataAt(startedAt);
      await saveSettings(saved);
      return saved;
    },
    listClients: () => pullThen('clients', localStorage.listClients),
    async saveClient(client: Client) {
      await cacheAndQueue('clients', client.id, client, nowIso());
    },
    async deleteClient(id) {
      await localStorage.deleteClient(id);
      await enqueue('clients', 'delete', id, null, nowIso());
    },
    listQuotes: () => pullThen('quotes', localStorage.listQuotes),
    async saveQuote(quote: Quote) {
      await cacheAndQueue('quotes', quote.id, quote, quote.updatedAt || nowIso());
    },
    async deleteQuote(id) {
      await localStorage.deleteQuote(id);
      await enqueue('quotes', 'delete', id, null, nowIso());
    },
    listAppointments: () => pullThen('appointments', localStorage.listAppointments),
    async saveAppointment(appointment: Appointment) {
      await cacheAndQueue(
        'appointments', appointment.id, appointment, appointment.updatedAt || nowIso()
      );
    },
    async deleteAppointment(id) {
      await localStorage.deleteAppointment(id);
      await enqueue('appointments', 'delete', id, null, nowIso());
    },
    listStoneLots: () => pullThen('stone_lots', localStorage.listStoneLots),
    async saveStoneLot(lot: StoneLot) {
      await cacheAndQueue('stone_lots', lot.id, lot, lot.updatedAt || nowIso());
    },
    async deleteStoneLot(id) {
      await localStorage.deleteStoneLot(id);
      await enqueue('stone_lots', 'delete', id, null, nowIso());
    },
    listSuppliers: () => pullThen('suppliers', localStorage.listSuppliers),
    async saveSupplier(supplier: Supplier) {
      const before = await localStorage.listStoneLots();
      await localStorage.saveSupplier(supplier);
      const after = await localStorage.listStoneLots();
      await cacheAndQueue('suppliers', supplier.id, supplier, nowIso());
      for (const lot of changedLots(before, after)) {
        await cacheAndQueue('stone_lots', lot.id, lot, lot.updatedAt || nowIso());
      }
    },
    async deleteSupplier(id) {
      const before = await localStorage.listStoneLots();
      await localStorage.deleteSupplier(id);
      const after = await localStorage.listStoneLots();
      await enqueue('suppliers', 'delete', id, null, nowIso());
      for (const lot of changedLots(before, after)) {
        await cacheAndQueue('stone_lots', lot.id, lot, lot.updatedAt || nowIso());
      }
    },
    nextQuoteNumber: options.remote.nextQuoteNumber,
    pullAll: options.sync.pullAll,
    async flush() {
      await options.outbox.flush();
    },
    async pendingCount() {
      return (await options.outbox.list()).length;
    }
  };
}

export const supabaseCloudRemote = createSupabaseCloudRemote();
export const cloudOutbox = createCloudOutbox({
  repository: indexedDbOutboxRepository,
  prepare: async (operation) => {
    const prepared = await prepareCloudOperation(supabaseCloudRemote, indexedDbSyncCache, operation);
    if (prepared !== operation && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(CLOUD_DATA_CHANGED_EVENT));
    }
    return prepared;
  },
  execute: (operation) => supabaseCloudRemote.execute(operation)
});
export const cloudSync = createCloudSync({
  remote: supabaseCloudRemote,
  cache: indexedDbSyncCache,
  listPending: cloudOutbox.list
});
export const cloudDataSource = createCloudDataSource({
  remote: supabaseCloudRemote,
  outbox: cloudOutbox,
  sync: cloudSync
});

export function startCloudLifecycle(): () => void {
  const stopOutbox = startOutboxTriggers(cloudOutbox);
  const pullWhenVisible = () => {
    if (document.visibilityState === 'visible') void cloudSync.pullAll().catch(() => {});
  };
  document.addEventListener('visibilitychange', pullWhenVisible);
  return () => {
    stopOutbox();
    document.removeEventListener('visibilitychange', pullWhenVisible);
  };
}
