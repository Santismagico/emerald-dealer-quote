import { dbDelete, dbGetAll, dbPut, dbWriteTransaction, type StoreName } from '../db';
import type { StockJewel, StoneLot } from '../../types';
import {
  normalizeAppointment,
  normalizeBuyer,
  normalizeClient,
  normalizeMaterialLot,
  normalizeMaterialPartner,
  normalizeExpense,
  normalizeFundContribution,
  normalizeQuote,
  normalizeSettings,
  normalizeStockJewel,
  normalizeStoneLot,
  normalizeSupplier
} from '../schema';
import { SETTINGS_KEY } from '../storage';
import { validateExpenseRateMetadata } from '../expenses';
import { validateFundContribution } from '../fund';
import { validateSettingsMetadata } from '../settingsMetadata';
import { validateStockJewelSaleMetadata } from '../stockJewels';
import { validateStoneLotInventory, validateStoneLotSalesMetadata } from '../stones';
import { validateStoneJewelTransformationCollections } from '../stoneJewelTransformation';
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
  applyBatch?: (mutations: readonly CloudSyncCacheMutation[]) => Promise<void>;
  applyBatchAndRemoveOutbox?: (
    mutations: readonly CloudSyncCacheMutation[],
    outboxIds: readonly string[]
  ) => Promise<void>;
}

export interface CloudSyncCacheMutation {
  table: CloudTable;
  id: string;
  record: SyncCacheRecord | null;
}

export interface CloudSync {
  pullTable: (table: CloudTable) => Promise<void>;
  pullStoneJewelPair: () => Promise<void>;
  replaceStoneJewelPairFromCloud?: (outboxIds: readonly string[]) => Promise<void>;
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
  'stock_jewels',
  'material_partners',
  'material_lots',
  'expenses',
  'fund_contributions'
];

const storeByTable: Record<CloudTable, StoreName> = {
  org_settings: 'settings',
  clients: 'clients',
  quotes: 'quotes',
  appointments: 'appointments',
  stone_lots: 'stoneLots',
  suppliers: 'suppliers',
  buyers: 'buyers',
  stock_jewels: 'stockJewels',
  material_partners: 'materialPartners',
  material_lots: 'materialLots',
  expenses: 'expenses',
  fund_contributions: 'fundContributions'
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
    case 'material_partners': return normalizeMaterialPartner(data) as unknown as Record<string, unknown>;
    case 'material_lots': return normalizeMaterialLot(data) as unknown as Record<string, unknown>;
    case 'expenses': return normalizeExpense(data) as unknown as Record<string, unknown>;
    case 'fund_contributions': return normalizeFundContribution(data) as unknown as Record<string, unknown>;
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

function b3MetadataError(
  table: CloudTable,
  remoteData: unknown,
  localData?: unknown
): string | null {
  switch (table) {
    case 'org_settings':
      return validateSettingsMetadata(remoteData);
    case 'stone_lots':
      {
        const previous = localData === undefined ? null : normalizeStoneLot(localData);
        const metadataError = validateStoneLotSalesMetadata(remoteData, previous);
        if (metadataError) return metadataError;
        return validateStoneLotInventory(normalizeStoneLot(remoteData), previous);
      }
    case 'stock_jewels':
      return validateStockJewelSaleMetadata(
        remoteData,
        localData === undefined ? null : normalizeStockJewel(localData)
      );
    case 'expenses':
      return validateExpenseRateMetadata(
        remoteData,
        localData === undefined ? null : normalizeExpense(localData)
      );
    case 'fund_contributions':
      return validateFundContribution(normalizeFundContribution(remoteData));
    default:
      return null;
  }
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
  remove: (table, id) => dbDelete(storeByTable[table], table === 'org_settings' ? SETTINGS_KEY : id),
  async applyBatch(mutations) {
    if (mutations.length === 0) return;
    const prepared = mutations.map((mutation) => ({
      ...mutation,
      store: storeByTable[mutation.table],
      key: mutation.table === 'org_settings' ? SETTINGS_KEY : mutation.id,
      value: mutation.record
        ? {
            ...normalized(mutation.table, mutation.record.data),
            id: mutation.table === 'org_settings' ? SETTINGS_KEY : mutation.record.id,
            cloudUpdatedAt: mutation.record.updatedAt
          }
        : null
    }));
    const stores = [...new Set(prepared.map((mutation) => mutation.store))];
    await dbWriteTransaction(stores, (getStore) => {
      for (const mutation of prepared) {
        if (mutation.value === null) getStore(mutation.store).delete(mutation.key);
        else getStore(mutation.store).put(mutation.value);
      }
    });
  },
  async applyBatchAndRemoveOutbox(mutations, outboxIds) {
    const prepared = mutations.map((mutation) => ({
      ...mutation,
      store: storeByTable[mutation.table],
      key: mutation.table === 'org_settings' ? SETTINGS_KEY : mutation.id,
      value: mutation.record
        ? {
            ...normalized(mutation.table, mutation.record.data),
            id: mutation.table === 'org_settings' ? SETTINGS_KEY : mutation.record.id,
            cloudUpdatedAt: mutation.record.updatedAt
          }
        : null
    }));
    const stores = [...new Set<StoreName>([
      ...prepared.map((mutation) => mutation.store),
      'cloudOutbox'
    ])];
    await dbWriteTransaction(stores, (getStore) => {
      for (const mutation of prepared) {
        if (mutation.value === null) getStore(mutation.store).delete(mutation.key);
        else getStore(mutation.store).put(mutation.value);
      }
      const outboxStore = getStore('cloudOutbox');
      for (const id of outboxIds) outboxStore.delete(id);
    });
  }
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

/** Una transformación pendiente protege a la vez la joya y el lote que consume. */
function pendingEntityForTable(
  operation: CloudOutboxOperation,
  table: CloudTable
): string | null {
  if (
    operation.type !== 'transform_stock_jewel' &&
    operation.type !== 'restore_stock_jewel'
  ) {
    return operation.table === table ? operation.entityId : null;
  }
  const data =
    typeof operation.data === 'object' && operation.data !== null
      ? (operation.data as Record<string, unknown>)
      : {};
  if (table === 'stock_jewels' && typeof data.jewelId === 'string') return data.jewelId;
  if (table === 'stone_lots' && typeof data.lotId === 'string') return data.lotId;
  return null;
}

export function createCloudSync(options: {
  remote: CloudSyncRemote;
  cache: CloudSyncCache;
  listPending: () => Promise<CloudOutboxOperation[]>;
}): CloudSync {
  const planTablePull = (
    table: CloudTable,
    remoteRows: CloudRow[],
    localRows: SyncCacheRecord[],
    pendingOperations: CloudOutboxOperation[],
    forceRemote = false
  ): { mutations: CloudSyncCacheMutation[]; finalRows: Map<string, SyncCacheRecord> } => {
    const mutations: CloudSyncCacheMutation[] = [];
    const localById = new Map(localRows.map((record) => [record.id, record]));
    const finalRows = new Map(localById);
    const pendingById = new Map(
      pendingOperations
        .map((operation) => [pendingEntityForTable(operation, table), operation] as const)
        .filter((entry): entry is [string, CloudOutboxOperation] => Boolean(entry[0]))
    );
    const remoteIds = new Set(
      remoteRows
        .map((row) => entityId(table, row))
        .filter((id): id is string => Boolean(id))
    );

    for (const localRow of localRows) {
      // Ante cualquier duda se conserva el dato: solo se reconcilian borrados
      // de registros que este dispositivo ya vio o subió a la nube.
      if (
        !forceRemote &&
        (!localRow.seenInCloud || remoteIds.has(localRow.id) || pendingById.has(localRow.id))
      ) continue;
      if (forceRemote && remoteIds.has(localRow.id)) continue;
      finalRows.delete(localRow.id);
      mutations.push({ table, id: localRow.id, record: null });
    }

    for (const remoteRow of remoteRows) {
      const id = entityId(table, remoteRow);
      if (!id) continue;
      const local = localById.get(id);
      const pending = pendingById.get(id);

      // Una eliminación local pendiente nunca se revive durante un pull.
      if (!forceRemote && pending?.type === 'delete') continue;
      // La operacion compuesta protege sus dos mitades hasta que la RPC las
      // confirme; un reloj remoto adelantado no puede separarlas.
      if (!forceRemote && (
        pending?.type === 'transform_stock_jewel' ||
        pending?.type === 'restore_stock_jewel'
      )) continue;
      // LWW: el cambio con fecha más reciente gana, incluso si aún espera conexión.
      if (
        !forceRemote &&
        local &&
        validTime(local.updatedAt) > validTime(remoteRow.updated_at)
      ) continue;

      const metadataError = b3MetadataError(
        table,
        remoteRow.data,
        forceRemote ? undefined : local?.data
      );
      if (metadataError) {
        throw new Error(`La nube rechazó un dato inválido antes de guardarlo: ${metadataError}`);
      }

      const record: SyncCacheRecord = {
        id,
        data: remoteRow.data,
        updatedAt: remoteRow.updated_at,
        seenInCloud: true
      };
      finalRows.set(id, record);
      mutations.push({ table, id, record });
    }
    return { mutations, finalRows };
  };

  const applyMutations = async (mutations: CloudSyncCacheMutation[]) => {
    if (mutations.length === 0) return;
    if (options.cache.applyBatch) {
      await options.cache.applyBatch(mutations);
      return;
    }
    for (const mutation of mutations) {
      if (mutation.record) await options.cache.put(mutation.table, mutation.record);
      else await options.cache.remove(mutation.table, mutation.id);
    }
  };

  const pullTable = async (table: CloudTable) => {
    const [remoteRows, localRows, pendingOperations] = await Promise.all([
      options.remote.list(table),
      options.cache.list(table),
      options.listPending()
    ]);
    const plan = planTablePull(table, remoteRows, localRows, pendingOperations);
    await applyMutations(plan.mutations);
  };

  const runStoneJewelPairPull = async (
    forceRemote: boolean,
    discardOutboxIds: readonly string[] = []
  ): Promise<void> => {
    const [remoteLots, remoteJewels, localLots, localJewels, pendingOperations] =
      await Promise.all([
        options.remote.list('stone_lots'),
        options.remote.list('stock_jewels'),
        options.cache.list('stone_lots'),
        options.cache.list('stock_jewels'),
        options.listPending()
      ]);
    const lotPlan = planTablePull(
      'stone_lots', remoteLots, localLots, pendingOperations, forceRemote
    );
    const jewelPlan = planTablePull(
      'stock_jewels', remoteJewels, localJewels, pendingOperations, forceRemote
    );
    const lots = [...lotPlan.finalRows.values()].map(
      (record) => normalizeStoneLot(record.data) as StoneLot
    );
    const jewels = [...jewelPlan.finalRows.values()].map(
      (record) => normalizeStockJewel(record.data) as StockJewel
    );
    const linkError = validateStoneJewelTransformationCollections(lots, jewels);
    if (linkError) {
      throw new Error(`La nube devolvió Piedras y Joyas descuadradas: ${linkError}`);
    }
    const mutations = [...lotPlan.mutations, ...jewelPlan.mutations];
    if (discardOutboxIds.length > 0) {
      if (!options.cache.applyBatchAndRemoveOutbox) {
        throw new Error('No se puede reemplazar la pareja y limpiar la cola atómicamente.');
      }
      await options.cache.applyBatchAndRemoveOutbox(mutations, discardOutboxIds);
      return;
    }
    await applyMutations(mutations);
  };

  let inventoryPullTail: Promise<void> = Promise.resolve();
  let activeNormalPull: Promise<void> | null = null;
  let activeReplacementPull: Promise<void> | null = null;
  const queueInventoryPull = (
    forceRemote: boolean,
    discardOutboxIds: readonly string[] = []
  ): Promise<void> => {
    const queued = inventoryPullTail
      .catch(() => {})
      .then(() => runStoneJewelPairPull(forceRemote, discardOutboxIds));
    inventoryPullTail = queued;
    return queued;
  };

  const pullStoneJewelPair = (): Promise<void> => {
    if (activeNormalPull) return activeNormalPull;
    const queued = queueInventoryPull(false);
    activeNormalPull = queued;
    queued.then(
      () => { if (activeNormalPull === queued) activeNormalPull = null; },
      () => { if (activeNormalPull === queued) activeNormalPull = null; }
    );
    return queued;
  };

  const replaceStoneJewelPairFromCloud = (
    discardOutboxIds: readonly string[]
  ): Promise<void> => {
    if (activeReplacementPull) return activeReplacementPull;
    const queued = queueInventoryPull(true, discardOutboxIds);
    activeReplacementPull = queued;
    queued.then(
      () => { if (activeReplacementPull === queued) activeReplacementPull = null; },
      () => { if (activeReplacementPull === queued) activeReplacementPull = null; }
    );
    return queued;
  };

  return {
    pullTable,
    pullStoneJewelPair,
    replaceStoneJewelPairFromCloud,
    async pullAll() {
      for (const table of CLOUD_TABLES) {
        if (table === 'stone_lots') await pullStoneJewelPair();
        else if (table !== 'stock_jewels') await pullTable(table);
      }
    }
  };
}
