import type {
  Appointment,
  Buyer,
  Client,
  Expense,
  MaterialLot,
  MaterialPartner,
  Quote,
  Settings,
  StockJewel,
  StoneLot,
  Supplier
} from '../../types';
import type { StoreDataSource } from '../dataSource';
import type { GoldPriceBreakdown } from '../goldPrice';
import {
  validateStoneJewelTransformation,
  type StoneJewelTransformationInput
} from '../stoneJewelTransformation';
import { validateExpense } from '../expenses';
import { validateSettingsMetadata } from '../settingsMetadata';
import { normalizeStockJewel, normalizeStoneLot } from '../schema';
import {
  validateStockJewelSaleMetadata,
  validateStockJewelStoneHistory
} from '../stockJewels';
import {
  validateStoneLotInventory,
  validateStoneLotOwnership,
  validateStoneLotSalesMetadata
} from '../stones';
import * as localStorage from '../storage';
import { getSupabase } from './config';
import {
  createCloudOutbox,
  indexedDbOutboxRepository,
  startOutboxTriggers,
  type CloudOutbox,
  type CloudOutboxOperation,
  type CloudOperationType,
  type CloudTable,
  type OutboxStatus
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
  execute: (operation: CloudOutboxOperation) => Promise<unknown>;
  nextQuoteNumber: () => Promise<string>;
}

export interface CloudDataSource extends StoreDataSource {
  authorizeImport: () => Promise<void>;
  seedStoneLotForImport: (
    baseline: StoneLot, finalLot: StoneLot, importUpdatedAt: string
  ) => Promise<void>;
  seedStockJewelForImport: (
    baseline: StockJewel, finalJewel: StockJewel, importUpdatedAt: string
  ) => Promise<void>;
  finalizeStoneLotForImport: (lot: StoneLot, importUpdatedAt: string) => Promise<void>;
  finalizeStockJewelForImport: (jewel: StockJewel, importUpdatedAt: string) => Promise<void>;
  restoreStockJewelTransformationForImport: (
    input: StoneJewelTransformationInput & { costCop: number; updatedAt: string }
  ) => Promise<void>;
  pullAll: () => Promise<void>;
  flush: () => Promise<void>;
  pendingCount: () => Promise<number>;
  cloudSyncStatus: () => Promise<OutboxStatus>;
  retryCloudChanges: (id?: string) => Promise<void>;
  useCloudInventoryVersion: () => Promise<void>;
}

export const CLOUD_DATA_CHANGED_EVENT = 'emerald-cloud-data-changed';

const functionNames: Record<CloudTable, { upsert: string; delete: string }> = {
  org_settings: { upsert: 'upsert_settings', delete: 'delete_settings' },
  clients: { upsert: 'upsert_client', delete: 'delete_client' },
  quotes: { upsert: 'upsert_quote', delete: 'delete_quote' },
  appointments: { upsert: 'upsert_appointment', delete: 'delete_appointment' },
  stone_lots: { upsert: 'upsert_stone_lot', delete: 'delete_stone_lot' },
  suppliers: { upsert: 'upsert_supplier', delete: 'delete_supplier' },
  buyers: { upsert: 'upsert_buyer', delete: 'delete_buyer' },
  stock_jewels: { upsert: 'upsert_stock_jewel', delete: 'delete_stock_jewel' },
  material_partners: { upsert: 'upsert_material_partner', delete: 'delete_material_partner' },
  material_lots: { upsert: 'upsert_material_lot', delete: 'delete_material_lot' },
  expenses: { upsert: 'upsert_expense', delete: 'delete_expense' }
};

function resultOrThrow<T>(result: QueryResult<T>, action: string): T {
  if (result.error) throw new Error(result.error.message || `No se pudo ${action}.`);
  if (result.data === null) throw new Error(`No se pudo ${action}.`);
  return result.data;
}

export class CloudOperationRejectedError extends Error {}

export function stockJewelTransformationRejectionMessage(message = ''): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('sold stock jewel')) {
    return 'La joya ya fue vendida y no se puede transformar.';
  }
  if (normalized.includes('only a fantasia stock jewel')) {
    return 'La joya ya no está registrada con piedra de fantasía.';
  }
  if (normalized.includes('quantity differs')) {
    return 'La cantidad de piedras ya no coincide con la joya.';
  }
  if (normalized.includes('cost')) {
    return 'El costo de la transformación no pudo confirmarse de forma segura.';
  }
  if (normalized.includes('exceed') || normalized.includes('has no carats')) {
    return 'El lote ya no tiene suficientes piedras disponibles para este cambio.';
  }
  if (normalized.includes('not found') || normalized.includes('missing')) {
    return 'El lote o la joya ya no existen en la nube.';
  }
  if (normalized.includes('predate') || normalized.includes('postdate')) {
    return 'La fecha no coincide con la historia actual de la joya.';
  }
  if (
    normalized.includes('cutoff') ||
    normalized.includes('collides') ||
    normalized.includes('reused') ||
    normalized.includes('already belongs')
  ) {
    return 'Otro equipo cambió este lote o esta joya. Actualiza e intenta de nuevo.';
  }
  return 'El servidor rechazó el cambio porque el inventario ya no coincide. Actualiza e intenta de nuevo.';
}

export function createSupabaseCloudRemote(
  client: () => Promise<SupabaseLike> = async () => (await getSupabase()) as unknown as SupabaseLike,
  onTransformationApplied: (payload: unknown) => Promise<void> = async () => {}
): CloudRemote {
  return {
    async list(table) {
      const columns = table === 'org_settings' ? 'data, updated_at' : 'id, data, updated_at';
      return resultOrThrow(await (await client()).from(table).select(columns), `consultar ${table}`);
    },
    async execute(operation) {
      if (operation.type === 'authorize_import') {
        const result = await (await client()).rpc('authorize_cloud_import');
        if (result.error) {
          throw new CloudOperationRejectedError('Esta cuenta no puede importar datos.');
        }
        return result.data;
      }
      const importFunctionNames: Partial<Record<CloudOperationType, string>> = {
        seed_stone_lot_import: 'seed_stone_lot_transformation_import',
        seed_stock_jewel_import: 'seed_stock_jewel_transformation_import',
        finalize_stone_lot_import: 'finalize_stone_lot_transformation_import',
        finalize_stock_jewel_import: 'finalize_stock_jewel_transformation_import'
      };
      const importFunction = importFunctionNames[operation.type];
      if (importFunction) {
        const isSeed = operation.type === 'seed_stone_lot_import' ||
          operation.type === 'seed_stock_jewel_import';
        const seedData = typeof operation.data === 'object' && operation.data !== null
          ? operation.data as { baseline?: unknown; final?: unknown }
          : {};
        const args = isSeed
          ? {
              p_id: operation.entityId,
              p_baseline_data: seedData.baseline,
              p_final_data: seedData.final,
              p_updated_at: operation.updatedAt
            }
          : {
              p_id: operation.entityId,
              p_data: operation.data,
              p_updated_at: operation.updatedAt
            };
        const result = await (await client()).rpc(importFunction, args);
        if (result.error) {
          throw new CloudOperationRejectedError(
            'No se pudo restaurar el registro porque la nube ya no coincide con el respaldo.'
          );
        }
        return result.data;
      }
      if (
        operation.type === 'transform_stock_jewel' ||
        operation.type === 'restore_stock_jewel'
      ) {
        const data =
          typeof operation.data === 'object' && operation.data !== null
            ? (operation.data as Record<string, unknown>)
            : {};
        const args: Record<string, unknown> = {
          p_event_id: data.id,
          p_date: data.date,
          p_lot_id: data.lotId,
          p_jewel_id: data.jewelId,
          p_origin: data.origin,
          p_carats: data.carats,
          p_quantity: data.quantity,
          p_notes: data.notes,
          p_updated_at: operation.updatedAt
        };
        if (operation.type === 'restore_stock_jewel') args.p_cost_cop = data.costCop;
        const result = await (await client()).rpc(
          operation.type === 'restore_stock_jewel'
            ? 'restore_stock_jewel_transformation'
            : 'transform_stock_jewel_to_natural',
          args
        );
        if (result.error) {
          throw new CloudOperationRejectedError(
            stockJewelTransformationRejectionMessage(result.error.message)
          );
        }
        if (operation.type === 'transform_stock_jewel') {
          await onTransformationApplied(result.data);
        }
        return result.data;
      }
      if (operation.type !== 'upsert' && operation.type !== 'delete') {
        throw new CloudOperationRejectedError('La operacion de nube no es valida.');
      }
      const functions = functionNames[operation.table];
      const args = operation.table === 'org_settings'
        ? operation.type === 'upsert'
          ? { p_data: operation.data, p_updated_at: operation.updatedAt }
          : undefined
        : operation.type === 'upsert'
          ? { p_id: operation.entityId, p_data: operation.data, p_updated_at: operation.updatedAt }
          : { p_id: operation.entityId };
      const result = await (await client()).rpc(functions[operation.type], args);
      if (result.error) {
        throw new CloudOperationRejectedError(result.error.message || 'No se pudo sincronizar el cambio.');
      }
      return result.data;
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

/** Registros que cambiaron entre dos fotos, comparando su contenido completo. */
function changed<T extends { id: string }>(before: T[], after: T[]): T[] {
  const previous = new Map(before.map((item) => [item.id, JSON.stringify(item)]));
  return after.filter((item) => previous.get(item.id) !== JSON.stringify(item));
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
    type: CloudOperationType,
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
  const pullInventoryThen = async <T>(read: () => Promise<T>): Promise<T> => {
    try {
      await options.sync.pullStoneJewelPair();
    } catch {
      // Sin conexión se entrega la pareja local completa.
    }
    return read();
  };

  const saveSettings = async (settings: Settings): Promise<void> => {
    const metadataError = validateSettingsMetadata(settings);
    if (metadataError) throw new Error(metadataError);
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
    async authorizeImport() {
      const updatedAt = nowIso();
      await options.remote.execute({
        id: `authorize-import-${updatedAt}`,
        table: 'org_settings',
        type: 'authorize_import',
        entityId: localStorage.SETTINGS_KEY,
        data: null,
        updatedAt,
        queuedAt: Date.parse(updatedAt),
        attempts: 0,
        nextAttemptAt: 0
      });
    },
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
    listStoneLots: () => pullInventoryThen(localStorage.listStoneLots),
    async saveStoneLot(lot: StoneLot) {
      const error = validateStoneLotOwnership(lot);
      if (error) throw new Error(error);
      const previous = (await localStorage.listStoneLots()).find((item) => item.id === lot.id) ?? null;
      const metadataError = validateStoneLotSalesMetadata(lot, previous);
      if (metadataError) throw new Error(metadataError);
      const normalized = normalizeStoneLot(lot);
      if (
        previous
          ? JSON.stringify(normalized.internalUses) !== JSON.stringify(previous.internalUses)
          : normalized.internalUses.length > 0
      ) {
        throw new Error('Los usos internos solo se registran al transformar una joya.');
      }
      const inventoryError = validateStoneLotInventory(normalized, previous);
      if (inventoryError) throw new Error(inventoryError);
      await cacheAndQueue('stone_lots', lot.id, normalized, normalized.updatedAt || nowIso());
    },
    async seedStoneLotForImport(lot: StoneLot, finalLot: StoneLot, importUpdatedAt: string) {
      const ownershipError = validateStoneLotOwnership(lot) || validateStoneLotOwnership(finalLot);
      if (ownershipError) throw new Error(ownershipError);
      const metadataError = validateStoneLotSalesMetadata(lot);
      if (metadataError) throw new Error(metadataError);
      const normalized = normalizeStoneLot(lot);
      const normalizedFinal = normalizeStoneLot(finalLot);
      const inventoryError = validateStoneLotInventory(normalized);
      if (inventoryError) throw new Error(inventoryError);
      await enqueue(
        'stone_lots',
        'seed_stone_lot_import',
        normalized.id,
        { baseline: normalized, final: normalizedFinal },
        importUpdatedAt
      );
    },
    async deleteStoneLot(id) {
      const jewelsBefore = await localStorage.listStockJewels();
      await localStorage.deleteStoneLot(id);
      const jewelsAfter = await localStorage.listStockJewels();
      for (const jewel of changed(jewelsBefore, jewelsAfter)) {
        await cacheAndQueue('stock_jewels', jewel.id, jewel, jewel.updatedAt || nowIso());
      }
      await enqueue('stone_lots', 'delete', id, null, nowIso());
    },
    listSuppliers: () => pullThen('suppliers', localStorage.listSuppliers),
    async saveSupplier(supplier: Supplier) {
      const before = await localStorage.listStoneLots();
      await localStorage.saveSupplier(supplier);
      const after = await localStorage.listStoneLots();
      await cacheAndQueue('suppliers', supplier.id, supplier, nowIso());
      for (const lot of changed(before, after)) {
        await cacheAndQueue('stone_lots', lot.id, lot, lot.updatedAt || nowIso());
      }
    },
    async deleteSupplier(id) {
      const before = await localStorage.listStoneLots();
      await localStorage.deleteSupplier(id);
      const after = await localStorage.listStoneLots();
      await enqueue('suppliers', 'delete', id, null, nowIso());
      for (const lot of changed(before, after)) {
        await cacheAndQueue('stone_lots', lot.id, lot, lot.updatedAt || nowIso());
      }
    },
    listBuyers: () => pullThen('buyers', localStorage.listBuyers),
    // Guardar o borrar un comprador reescribe el nombre o suelta el vínculo en
    // las ventas que lo apuntan: esos lotes y joyas también deben subir (D-043).
    async saveBuyer(buyer: Buyer) {
      const [lotsBefore, jewelsBefore] = await Promise.all([
        localStorage.listStoneLots(),
        localStorage.listStockJewels()
      ]);
      await localStorage.saveBuyer(buyer);
      const [lotsAfter, jewelsAfter] = await Promise.all([
        localStorage.listStoneLots(),
        localStorage.listStockJewels()
      ]);
      await cacheAndQueue('buyers', buyer.id, buyer, nowIso());
      for (const lot of changed(lotsBefore, lotsAfter)) {
        await cacheAndQueue('stone_lots', lot.id, lot, lot.updatedAt || nowIso());
      }
      for (const jewel of changed(jewelsBefore, jewelsAfter)) {
        await cacheAndQueue('stock_jewels', jewel.id, jewel, jewel.updatedAt || nowIso());
      }
    },
    async deleteBuyer(id) {
      const [lotsBefore, jewelsBefore] = await Promise.all([
        localStorage.listStoneLots(),
        localStorage.listStockJewels()
      ]);
      await localStorage.deleteBuyer(id);
      const [lotsAfter, jewelsAfter] = await Promise.all([
        localStorage.listStoneLots(),
        localStorage.listStockJewels()
      ]);
      await enqueue('buyers', 'delete', id, null, nowIso());
      for (const lot of changed(lotsBefore, lotsAfter)) {
        await cacheAndQueue('stone_lots', lot.id, lot, lot.updatedAt || nowIso());
      }
      for (const jewel of changed(jewelsBefore, jewelsAfter)) {
        await cacheAndQueue('stock_jewels', jewel.id, jewel, jewel.updatedAt || nowIso());
      }
    },
    listStockJewels: () => pullInventoryThen(localStorage.listStockJewels),
    async saveStockJewel(jewel: StockJewel) {
      const previous = (await localStorage.listStockJewels()).find((item) => item.id === jewel.id) ?? null;
      const metadataError = validateStockJewelSaleMetadata(jewel, previous);
      if (metadataError) throw new Error(metadataError);
      const normalized = normalizeStockJewel(jewel);
      if (
        previous
          ? JSON.stringify(normalized.stoneTransformations) !==
            JSON.stringify(previous.stoneTransformations)
          : normalized.stoneTransformations.length > 0
      ) {
        throw new Error('La historia de piedras solo se registra al transformar una joya.');
      }
      const historyError = validateStockJewelStoneHistory(normalized, previous);
      if (historyError) throw new Error(historyError);
      await cacheAndQueue(
        'stock_jewels',
        normalized.id,
        normalized,
        normalized.updatedAt || nowIso()
      );
    },
    async seedStockJewelForImport(
      jewel: StockJewel,
      finalJewel: StockJewel,
      importUpdatedAt: string
    ) {
      const metadataError = validateStockJewelSaleMetadata(jewel) ||
        validateStockJewelSaleMetadata(finalJewel);
      if (metadataError) throw new Error(metadataError);
      const normalized = normalizeStockJewel(jewel);
      const normalizedFinal = normalizeStockJewel(finalJewel);
      const historyError = validateStockJewelStoneHistory(normalized);
      if (historyError) throw new Error(historyError);
      await enqueue(
        'stock_jewels',
        'seed_stock_jewel_import',
        normalized.id,
        { baseline: normalized, final: normalizedFinal },
        importUpdatedAt
      );
    },
    async finalizeStoneLotForImport(lot: StoneLot, importUpdatedAt: string) {
      const ownershipError = validateStoneLotOwnership(lot);
      if (ownershipError) throw new Error(ownershipError);
      const metadataError = validateStoneLotSalesMetadata(lot);
      if (metadataError) throw new Error(metadataError);
      const normalized = normalizeStoneLot(lot);
      const inventoryError = validateStoneLotInventory(normalized);
      if (inventoryError) throw new Error(inventoryError);
      await enqueue(
        'stone_lots',
        'finalize_stone_lot_import',
        normalized.id,
        normalized,
        importUpdatedAt
      );
    },
    async finalizeStockJewelForImport(jewel: StockJewel, importUpdatedAt: string) {
      const metadataError = validateStockJewelSaleMetadata(jewel);
      if (metadataError) throw new Error(metadataError);
      const normalized = normalizeStockJewel(jewel);
      const historyError = validateStockJewelStoneHistory(normalized);
      if (historyError) throw new Error(historyError);
      await enqueue(
        'stock_jewels',
        'finalize_stock_jewel_import',
        normalized.id,
        normalized,
        importUpdatedAt
      );
    },
    async deleteStockJewel(id) {
      await localStorage.deleteStockJewel(id);
      await enqueue('stock_jewels', 'delete', id, null, nowIso());
    },
    async transformStockJewelToNatural(input) {
      const updatedAt = nowIso();
      let authoritative: unknown;
      try {
        await options.outbox.flush();
        const pending = await options.outbox.list();
        const affectsTransformation = (operation: CloudOutboxOperation): boolean => {
          if (operation.table === 'stone_lots' && operation.entityId === input.lotId) return true;
          if (operation.table === 'stock_jewels' && operation.entityId === input.jewelId) return true;
          if (
            operation.type !== 'transform_stock_jewel' &&
            operation.type !== 'restore_stock_jewel'
          ) return false;
          const data = typeof operation.data === 'object' && operation.data !== null
            ? operation.data as Record<string, unknown>
            : {};
          return data.lotId === input.lotId || data.jewelId === input.jewelId;
        };
        if (pending.some(affectsTransformation)) {
          throw new CloudOperationRejectedError(
            'Hay un cambio pendiente en este lote o esta joya. Espera a que termine de subir antes de transformar.'
          );
        }
        await options.sync.pullStoneJewelPair();
        const [lots, jewels] = await Promise.all([
          localStorage.listStoneLots(),
          localStorage.listStockJewels()
        ]);
        const lot = lots.find((item) => item.id === input.lotId);
        const jewel = jewels.find((item) => item.id === input.jewelId);
        if (!lot || !jewel) {
          throw new CloudOperationRejectedError(
            'El lote o la joya ya no existen en la nube.'
          );
        }
        const validationError = validateStoneJewelTransformation(lot, jewel, input);
        if (validationError) throw new CloudOperationRejectedError(validationError);
        authoritative = await options.remote.execute({
          id: `direct-transform-${input.id}`,
          table: 'stock_jewels',
          type: 'transform_stock_jewel',
          entityId: input.jewelId,
          data: input,
          updatedAt,
          queuedAt: Date.parse(updatedAt),
          attempts: 0,
          nextAttemptAt: 0
        });
      } catch (error) {
        if (error instanceof CloudOperationRejectedError) throw error;
        throw new Error(
          'Necesitas conexion para confirmar este cambio. No se guardo ninguna transformacion.'
        );
      }
      try {
        return await localStorage.reconcileAuthoritativeStoneJewelTransformation(authoritative);
      } catch {
        try {
          await options.sync.pullStoneJewelPair();
          const [lots, jewels] = await Promise.all([
            localStorage.listStoneLots(),
            localStorage.listStockJewels()
          ]);
          const lot = lots.find((item) => item.id === input.lotId);
          const jewel = jewels.find((item) => item.id === input.jewelId);
          if (!lot || !jewel) throw new Error('Falta la pareja confirmada en la nube.');
          return await localStorage.reconcileAuthoritativeStoneJewelTransformation({ lot, jewel });
        } catch {
          throw new Error(
            'El cambio quedó confirmado en la nube, pero este equipo no pudo actualizar toda la historia. Recarga la aplicación antes de continuar.'
          );
        }
      }
    },
    async restoreStockJewelTransformationForImport(input) {
      if (!Number.isSafeInteger(input.costCop) || input.costCop < 0) {
        throw new Error('El costo histórico de la transformación no es válido.');
      }
      await enqueue(
        'stock_jewels',
        'restore_stock_jewel',
        input.jewelId,
        input,
        input.updatedAt || nowIso()
      );
    },
    listMaterialPartners: () => pullThen('material_partners', localStorage.listMaterialPartners),
    // Guardar o borrar un socio reescribe el nombre o suelta el vínculo en
    // material, gastos y piedras: todos los registros cambiados deben subir.
    async saveMaterialPartner(partner: MaterialPartner) {
      const [lotsBefore, expensesBefore, stoneLotsBefore] = await Promise.all([
        localStorage.listMaterialLots(),
        localStorage.listExpenses(),
        localStorage.listStoneLots()
      ]);
      await localStorage.saveMaterialPartner(partner);
      const [lotsAfter, expensesAfter, stoneLotsAfter] = await Promise.all([
        localStorage.listMaterialLots(),
        localStorage.listExpenses(),
        localStorage.listStoneLots()
      ]);
      await cacheAndQueue('material_partners', partner.id, partner, nowIso());
      for (const lot of changed(lotsBefore, lotsAfter)) {
        await cacheAndQueue('material_lots', lot.id, lot, lot.updatedAt || nowIso());
      }
      for (const expense of changed(expensesBefore, expensesAfter)) {
        await cacheAndQueue('expenses', expense.id, expense, expense.updatedAt || nowIso());
      }
      for (const lot of changed(stoneLotsBefore, stoneLotsAfter)) {
        await cacheAndQueue('stone_lots', lot.id, lot, lot.updatedAt || nowIso());
      }
    },
    async deleteMaterialPartner(id) {
      const [lotsBefore, expensesBefore, stoneLotsBefore] = await Promise.all([
        localStorage.listMaterialLots(),
        localStorage.listExpenses(),
        localStorage.listStoneLots()
      ]);
      await localStorage.deleteMaterialPartner(id);
      const [lotsAfter, expensesAfter, stoneLotsAfter] = await Promise.all([
        localStorage.listMaterialLots(),
        localStorage.listExpenses(),
        localStorage.listStoneLots()
      ]);
      await enqueue('material_partners', 'delete', id, null, nowIso());
      for (const lot of changed(lotsBefore, lotsAfter)) {
        await cacheAndQueue('material_lots', lot.id, lot, lot.updatedAt || nowIso());
      }
      for (const expense of changed(expensesBefore, expensesAfter)) {
        await cacheAndQueue('expenses', expense.id, expense, expense.updatedAt || nowIso());
      }
      for (const lot of changed(stoneLotsBefore, stoneLotsAfter)) {
        await cacheAndQueue('stone_lots', lot.id, lot, lot.updatedAt || nowIso());
      }
    },
    listMaterialLots: () => pullThen('material_lots', localStorage.listMaterialLots),
    async saveMaterialLot(lot: MaterialLot) {
      await cacheAndQueue('material_lots', lot.id, lot, lot.updatedAt || nowIso());
    },
    async deleteMaterialLot(id) {
      await localStorage.deleteMaterialLot(id);
      await enqueue('material_lots', 'delete', id, null, nowIso());
    },
    listExpenses: () => pullThen('expenses', localStorage.listExpenses),
    async saveExpense(expense: Expense) {
      const previous = (await localStorage.listExpenses()).find((item) => item.id === expense.id) ?? null;
      const error = validateExpense(expense, previous);
      if (error) throw new Error(error);
      await cacheAndQueue('expenses', expense.id, expense, expense.updatedAt || nowIso());
    },
    async deleteExpense(id) {
      await localStorage.deleteExpense(id);
      await enqueue('expenses', 'delete', id, null, nowIso());
    },
    // Fondo de inversión: por ahora vive SOLO en el dispositivo. La tabla, el RPC
    // y las reglas de aislamiento entran en la etapa 9 del plan de socios; hasta
    // entonces no hay a dónde sincronizarlo, y encolarlo sin tabla haría fallar
    // el envío una y otra vez. Guardar en local es correcto y reversible: cuando
    // llegue la etapa 9, el primer envío sube lo que ya esté guardado aquí.
    listFundContributions: () => localStorage.listFundContributions(),
    saveFundContribution: (contribution) => localStorage.saveFundContribution(contribution),
    deleteFundContribution: (id) => localStorage.deleteFundContribution(id),
    nextQuoteNumber: options.remote.nextQuoteNumber,
    pullAll: options.sync.pullAll,
    async flush() {
      await options.outbox.flush();
    },
    async pendingCount() {
      return (await options.outbox.list()).length;
    },
    cloudSyncStatus: options.outbox.status,
    async retryCloudChanges(id) {
      await options.outbox.retryHeld(id);
    },
    async useCloudInventoryVersion() {
      const inventoryChanges = (await options.outbox.list()).filter(
        (operation) =>
          (operation.table === 'stone_lots' || operation.table === 'stock_jewels')
      );
      if (!inventoryChanges.some((operation) => operation.state === 'held')) return;
      if (!options.outbox.resolveTableChanges || !options.sync.replaceStoneJewelPairFromCloud) {
        throw new Error('No fue posible resolver estos cambios desde este dispositivo.');
      }
      await options.outbox.resolveTableChanges(
        ['stone_lots', 'stock_jewels'],
        (operations) => options.sync.replaceStoneJewelPairFromCloud!(
          operations.map((operation) => operation.id)
        )
      );
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(CLOUD_DATA_CHANGED_EVENT));
      }
    }
  };
}

export const supabaseCloudRemote = createSupabaseCloudRemote();
export const cloudOutbox = createCloudOutbox({
  repository: indexedDbOutboxRepository,
  maxAttempts: 5,
  shouldHold: (error) => error instanceof CloudOperationRejectedError,
  onChange: () => {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(CLOUD_DATA_CHANGED_EVENT));
  },
  prepare: async (operation) => {
    const prepared = await prepareCloudOperation(supabaseCloudRemote, indexedDbSyncCache, operation);
    if (prepared !== operation && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(CLOUD_DATA_CHANGED_EVENT));
    }
    return prepared;
  },
  execute: async (operation) => {
    const authoritative = await supabaseCloudRemote.execute(operation);
    if (operation.type === 'transform_stock_jewel') {
      await localStorage.reconcileAuthoritativeStoneJewelTransformation(authoritative);
    }
  }
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
