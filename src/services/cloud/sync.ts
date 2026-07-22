import { dbDelete, dbGetAll, dbPut, type StoreName } from '../db';
import {
  normalizeAppointment,
  normalizeBuyer,
  normalizeClient,
  normalizeQuote,
  normalizeSettings,
  normalizeStockJewel,
  normalizeStoneLot,
  normalizeSupplier
} from '../schema';
import { SETTINGS_KEY } from '../storage';
import type { CloudOutboxOperation, CloudTable } from './outbox';

export interface CloudRow {
  id?: string;
  data: unknown;
  updated_at: string;
}

export interface SyncCacheRecord {
  id: string;
  data: unknown;
  updatedAt: string;
  /** El dispositivo ya confirmó este registro como parte de la nube. */
  seenInCloud?: boolean;
}

export interface CloudSyncRemote {
  list: (table: CloudTable) => Promise<CloudRow[]>;
}

export interface CloudSyncCache {
  list: (table: CloudTable) => Promise<SyncCacheRecord[]>;
  put: (table: CloudTable, record: SyncCacheRecord) => Promise<void>;
  remove: (table: CloudTable, id: string) => Promise<void>;
}

export interface CloudSync {
  pullTable: (table: CloudTable) => Promise<void>;
  pullAll: () => Promise<void>;
}

const CLOUD_TABLES: readonly CloudTable[] = [
  'org_settings',
  'clients',
  'quotes',
  'appointments',
  'stone_lots',
  'suppliers',
  'buyers',
  'stock_jewels'
];

const storeByTable: Record<CloudTable, StoreName> = {
  org_settings: 'settings',
  clients: 'clients',
  quotes: 'quotes',
  appointments: 'appointments',
  stone_lots: 'stoneLots',
  suppliers: 'suppliers',
  buyers: 'buyers',
  stock_jewels: 'stockJewels'
};

function normalized(table: CloudTable, data: unknown): Record<string, unknown> {
  switch (table) {
    case 'org_settings': return normalizeSettings(data) as unknown as Record<string, unknown>;
    case 'clients': return normalizeClient(data) as unknown as Record<string, unknown>;
    case 'quotes': return normalizeQuote(data) as unknown as Record<string, unknown>;
    case 'appointments': return normalizeAppointment(data) as unknown as Record<string, unknown>;
    case 'stone_lots': return normalizeStoneLot(data) as unknown as Record<string, unknown>;
    case 'suppliers': return normalizeSupplier(data) as unknown as Record<string, unknown>;
    case 'buyers': return normalizeBuyer(data) as unknown as Record<string, unknown>;
    case 'stock_jewels': return normalizeStockJewel(data) as unknown as Record<string, unknown>;
  }
}

function recordId(table: CloudTable, value: Record<string, unknown>): string {
  return table === 'org_settings' ? SETTINGS_KEY : String(value.id ?? '');
}

function recordUpdatedAt(value: Record<string, unknown>): string {
  const cloudUpdatedAt = typeof value.cloudUpdatedAt === 'string' ? value.cloudUpdatedAt : '';
  if (cloudUpdatedAt) return cloudUpdatedAt;
  const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : '';
  if (updatedAt) return updatedAt;
  return typeof value.createdAt === 'string' ? value.createdAt : '';
}

export const indexedDbSyncCache: CloudSyncCache = {
  async list(table) {
    const values = await dbGetAll<Record<string, unknown>>(storeByTable[table]);
    return values.map((value) => ({
      id: recordId(table, value),
      data: value,
      updatedAt: recordUpdatedAt(value),
      seenInCloud: typeof value.cloudUpdatedAt === 'string' && value.cloudUpdatedAt.length > 0
    }));
  },
  async put(table, record) {
    const value = normalized(table, record.data);
    await dbPut(storeByTable[table], {
      ...value,
      id: table === 'org_settings' ? SETTINGS_KEY : record.id,
      cloudUpdatedAt: record.updatedAt
    });
  },
  remove: (table, id) => dbDelete(storeByTable[table], table === 'org_settings' ? SETTINGS_KEY : id)
};

function entityId(table: CloudTable, row: CloudRow): string {
  if (table === 'org_settings') return SETTINGS_KEY;
  const id = row.id ?? (row.data as { id?: unknown } | null)?.id;
  return typeof id === 'string' ? id : '';
}

function validTime(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function createCloudSync(options: {
  remote: CloudSyncRemote;
  cache: CloudSyncCache;
  listPending: () => Promise<CloudOutboxOperation[]>;
}): CloudSync {
  const pullTable = async (table: CloudTable) => {
    const [remoteRows, localRows, pendingOperations] = await Promise.all([
      options.remote.list(table),
      options.cache.list(table),
      options.listPending()
    ]);
    const localById = new Map(localRows.map((record) => [record.id, record]));
    const pendingById = new Map(
      pendingOperations
        .filter((operation) => operation.table === table)
        .map((operation) => [operation.entityId, operation])
    );
    const remoteIds = new Set(
      remoteRows
        .map((row) => entityId(table, row))
        .filter((id): id is string => Boolean(id))
    );

    for (const localRow of localRows) {
      // Ante cualquier duda se conserva el dato: solo se reconcilian borrados
      // de registros que este dispositivo ya vio o subió a la nube.
      if (!localRow.seenInCloud || remoteIds.has(localRow.id) || pendingById.has(localRow.id)) continue;
      await options.cache.remove(table, localRow.id);
    }

    for (const remoteRow of remoteRows) {
      const id = entityId(table, remoteRow);
      if (!id) continue;
      const local = localById.get(id);
      const pending = pendingById.get(id);

      // Una eliminación local pendiente nunca se revive durante un pull.
      if (pending?.type === 'delete') continue;
      // LWW: el cambio con fecha más reciente gana, incluso si aún espera conexión.
      if (local && validTime(local.updatedAt) > validTime(remoteRow.updated_at)) continue;

      await options.cache.put(table, {
        id,
        data: remoteRow.data,
        updatedAt: remoteRow.updated_at,
        seenInCloud: true
      });
    }
  };

  return {
    pullTable,
    async pullAll() {
      for (const table of CLOUD_TABLES) await pullTable(table);
    }
  };
}
