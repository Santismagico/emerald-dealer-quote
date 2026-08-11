import type { BackupFile } from '../../types';
import { exportBackup, parseBackup } from '../backup';
import type { StoreDataSource } from '../dataSource';
import { defaultSettings } from '../storage';
import { stockJewelAcquisitionCostCop } from '../stockJewels';
import { cloudDataSource, supabaseCloudRemote, type CloudRemote } from './api';

export interface CloudImportProgress {
  completed: number;
  total: number;
  percent: number;
  current: string;
}

export interface CloudImportWriter extends Pick<
  StoreDataSource,
  | 'saveSettings'
  | 'saveClient'
  | 'saveQuote'
  | 'saveAppointment'
  | 'saveStoneLot'
  | 'saveSupplier'
  | 'saveBuyer'
  | 'saveStockJewel'
  | 'saveMaterialPartner'
  | 'saveMaterialLot'
  | 'saveExpense'
  | 'saveFundContribution'
> {
  authorizeImport: () => Promise<void>;
  seedStoneLotForImport: (
    baseline: BackupFile['stoneLots'][number],
    finalLot: BackupFile['stoneLots'][number],
    importUpdatedAt: string
  ) => Promise<void>;
  seedStockJewelForImport: (
    baseline: BackupFile['stockJewels'][number],
    finalJewel: BackupFile['stockJewels'][number],
    importUpdatedAt: string
  ) => Promise<void>;
  finalizeStoneLotForImport: (
    lot: BackupFile['stoneLots'][number],
    importUpdatedAt: string
  ) => Promise<void>;
  finalizeStockJewelForImport: (
    jewel: BackupFile['stockJewels'][number],
    importUpdatedAt: string
  ) => Promise<void>;
  restoreStockJewelTransformationForImport: (input: {
    id: string;
    date: string;
    lotId: string;
    jewelId: string;
    origin: 'bruto' | 'tallado';
    carats: number;
    quantity: number;
    notes: string;
    costCop: number;
    updatedAt: string;
  }) => Promise<void>;
  flush: () => Promise<void>;
  pendingCount: () => Promise<number>;
  pullAll: () => Promise<void>;
}

interface ImportTask {
  label: string;
  run: () => Promise<void>;
}

export async function readLocalImportSource(): Promise<BackupFile> {
  return exportBackup();
}

export async function readBackupImportSource(file: File): Promise<BackupFile> {
  return parseBackup(await file.text());
}

export function countImportRecords(backup: BackupFile): number {
  const transformations = backup.stockJewels.flatMap((jewel) => jewel.stoneTransformations ?? []);
  const lotIds = new Set(backup.stoneLots.map((lot) => lot.id));
  const restorableTransformations = transformations.filter((item) => lotIds.has(item.lotId));
  const transformedLotIds = new Set(restorableTransformations.map((item) => item.lotId));
  const transformedJewelIds = new Set(transformations.map((item) => item.jewelId));
  return (backup.settings ? 1 : 0)
    + backup.clients.length
    + backup.quotes.length
    + backup.appointments.length
    + backup.stoneLots.length
    + backup.suppliers.length
    + backup.buyers.length
    + backup.stockJewels.length
    + backup.materialPartners.length
    + backup.materialLots.length
    + backup.expenses.length
    + backup.fundContributions.length
    + restorableTransformations.length
    + transformedLotIds.size
    + transformedJewelIds.size;
}

export function hasLocalDataToImport(backup: BackupFile): boolean {
  if (
    backup.clients.length
    || backup.quotes.length
    || backup.appointments.length
    || backup.stoneLots.length
    || backup.suppliers.length
    || backup.buyers.length
    || backup.stockJewels.length
    || backup.materialPartners.length
    || backup.materialLots.length
    || backup.expenses.length
    || backup.fundContributions.length
  ) return true;
  return backup.settings !== null
    && JSON.stringify(backup.settings) !== JSON.stringify(defaultSettings());
}

export async function isCloudEmpty(remote: Pick<CloudRemote, 'list'> = supabaseCloudRemote): Promise<boolean> {
  const tables = [
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
  ] as const;
  const rows = await Promise.all(tables.map((table) => remote.list(table)));
  return rows.every((collection) => collection.length === 0);
}

async function flushCompletely(writer: CloudImportWriter): Promise<void> {
  let previousPending = Number.POSITIVE_INFINITY;
  for (let pass = 0; pass < 4; pass += 1) {
    await writer.flush();
    const pending = await writer.pendingCount();
    if (pending === 0) return;
    if (pending >= previousPending) break;
    previousPending = pending;
  }
  throw new Error(
    'La conexión se interrumpió. Lo pendiente quedó guardado y continuará cuando vuelva internet.'
  );
}

async function ensureImportQueueIsClear(writer: CloudImportWriter): Promise<void> {
  try {
    await writer.flush();
    if (await writer.pendingCount() === 0) return;
  } catch {
    // No se empieza a escribir si la cola anterior no pudo confirmarse.
  }
  throw new Error(
    'Antes de importar, resuelve los cambios pendientes de la nube y vuelve a intentar.'
  );
}

export async function importToCloud(
  backup: BackupFile,
  options: {
    writer?: CloudImportWriter;
    batchSize?: number;
    onProgress?: (progress: CloudImportProgress) => void;
  } = {}
): Promise<void> {
  const writer = options.writer ?? cloudDataSource;
  await writer.authorizeImport();
  await ensureImportQueueIsClear(writer);
  const batchSize = Math.max(1, Math.round(options.batchSize ?? 20));
  const baseTasks: ImportTask[] = [];
  const transformationTasks: ImportTask[] = [];
  const finalizationTasks: ImportTask[] = [];

  if (backup.settings) {
    baseTasks.push({ label: 'Ajustes', run: () => writer.saveSettings(backup.settings!) });
  }
  for (const supplier of backup.suppliers) {
    baseTasks.push({ label: 'Proveedores', run: () => writer.saveSupplier(supplier) });
  }
  // Los compradores van antes que lotes y joyas: sus ventas los referencian.
  for (const buyer of backup.buyers) {
    baseTasks.push({ label: 'Compradores', run: () => writer.saveBuyer(buyer) });
  }
  // Los socios van antes que los lotes de material: los lotes los referencian.
  for (const partner of backup.materialPartners) {
    baseTasks.push({ label: 'Socios', run: () => writer.saveMaterialPartner(partner) });
  }
  // Los aportes van después de las personas que pueden tener vinculadas.
  for (const contribution of backup.fundContributions) {
    baseTasks.push({ label: 'Fondo', run: () => writer.saveFundContribution(contribution) });
  }
  // Los gastos con sociedad van después de los socios que referencian.
  for (const expense of backup.expenses) {
    baseTasks.push({ label: 'Gastos', run: () => writer.saveExpense(expense) });
  }
  for (const client of backup.clients) {
    baseTasks.push({ label: 'Clientes', run: () => writer.saveClient(client) });
  }
  for (const quote of backup.quotes) {
    baseTasks.push({ label: 'Cotizaciones', run: () => writer.saveQuote(quote) });
  }
  for (const appointment of backup.appointments) {
    baseTasks.push({ label: 'Agenda', run: () => writer.saveAppointment(appointment) });
  }
  const stoneLotIds = new Set(backup.stoneLots.map((lot) => lot.id));
  const allTransformations = backup.stockJewels.flatMap(
    (jewel) => jewel.stoneTransformations ?? []
  );
  const restorableTransformations = allTransformations.filter((transformation) =>
    stoneLotIds.has(transformation.lotId)
  );
  const transformedLotIds = new Set(
    restorableTransformations.map((transformation) => transformation.lotId)
  );
  const transformedJewelIds = new Set(
    allTransformations.map((transformation) => transformation.jewelId)
  );
  const restorableJewelIds = new Set(
    restorableTransformations.map((transformation) => transformation.jewelId)
  );
  const transformationTimestamps = [
    ...backup.stoneLots
      .filter((lot) => transformedLotIds.has(lot.id))
      .map((lot) => Date.parse(lot.updatedAt)),
    ...backup.stockJewels
      .filter((jewel) => transformedJewelIds.has(jewel.id))
      .map((jewel) => Date.parse(jewel.updatedAt))
  ];
  if (transformationTimestamps.some((timestamp) => !Number.isFinite(timestamp))) {
    throw new Error('La importacion tiene una fecha de transformacion invalida.');
  }
  const transformationImportUpdatedAt = transformationTimestamps.length > 0
    ? new Date(Math.max(...transformationTimestamps)).toISOString()
    : '';
  for (const lot of backup.stoneLots) {
    const baseline = transformedLotIds.has(lot.id) ? { ...lot, internalUses: [] } : lot;
    baseTasks.push({
      label: 'Lotes de piedras',
      run: () => transformedLotIds.has(lot.id)
        ? writer.seedStoneLotForImport(baseline, lot, transformationImportUpdatedAt)
        : writer.saveStoneLot(baseline)
    });
  }
  for (const jewel of backup.stockJewels) {
    const baseline = transformedJewelIds.has(jewel.id)
      ? restorableJewelIds.has(jewel.id)
        ? {
          ...jewel,
          stoneKind: 'fantasia' as const,
          costCop: stockJewelAcquisitionCostCop(jewel),
          sale: null,
          stoneTransformations: []
        }
        : jewel
      : jewel;
    baseTasks.push({
      label: 'Joyas en stock',
      run: () => transformedJewelIds.has(jewel.id)
        ? writer.seedStockJewelForImport(baseline, jewel, transformationImportUpdatedAt)
        : writer.saveStockJewel(baseline)
    });
  }
  for (const lot of backup.materialLots) {
    baseTasks.push({ label: 'Lotes de material', run: () => writer.saveMaterialLot(lot) });
  }

  const transformationById = new Map(
    backup.stockJewels.flatMap((jewel) =>
      (jewel.stoneTransformations ?? []).map((transformation) => [
        transformation.id,
        { jewel, transformation }
      ] as const)
    )
  );
  for (const lot of backup.stoneLots) {
    for (const use of lot.internalUses ?? []) {
      const linked = transformationById.get(use.id);
      if (!linked || linked.transformation.lotId !== lot.id) {
        throw new Error('La importación no cuadra entre Piedras y Joyas. Revisa el respaldo.');
      }
      const { transformation } = linked;
      transformationTasks.push({
        label: 'Transformaciones de joyas',
        run: () => writer.restoreStockJewelTransformationForImport({
          id: transformation.id,
          date: transformation.date,
          lotId: transformation.lotId,
          jewelId: transformation.jewelId,
          origin: transformation.origin,
          carats: transformation.carats,
          quantity: transformation.quantity,
          notes: transformation.notes,
          costCop: transformation.costCop,
          updatedAt: transformationImportUpdatedAt
        })
      });
    }
  }
  for (const lot of backup.stoneLots) {
    if (transformedLotIds.has(lot.id)) {
      finalizationTasks.push({
        label: 'Finalizar lotes transformados',
        run: () => writer.finalizeStoneLotForImport(lot, transformationImportUpdatedAt)
      });
    }
  }
  for (const jewel of backup.stockJewels) {
    if (transformedJewelIds.has(jewel.id)) {
      finalizationTasks.push({
        label: 'Finalizar joyas transformadas',
        run: () => writer.finalizeStockJewelForImport(jewel, transformationImportUpdatedAt)
      });
    }
  }

  const phases = [baseTasks, transformationTasks, finalizationTasks].filter(
    (phase) => phase.length > 0
  );
  const total = phases.reduce((sum, phase) => sum + phase.length, 0);
  options.onProgress?.({ completed: 0, total, percent: total ? 0 : 100, current: '' });
  let completed = 0;
  for (const phase of phases) {
    for (let offset = 0; offset < phase.length; offset += batchSize) {
      const batch = phase.slice(offset, offset + batchSize);
      for (const task of batch) {
        await task.run();
        completed += 1;
        options.onProgress?.({
          completed,
          total,
          percent: Math.round((completed / total) * 100),
          current: task.label
        });
      }
      await flushCompletely(writer);
    }
  }
  await writer.pullAll();
}
