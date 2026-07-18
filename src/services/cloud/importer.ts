import type { BackupFile } from '../../types';
import { exportBackup, parseBackup } from '../backup';
import type { StoreDataSource } from '../dataSource';
import { defaultSettings } from '../storage';
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
> {
  flush: () => Promise<void>;
  pendingCount: () => Promise<number>;
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
  return (backup.settings ? 1 : 0)
    + backup.clients.length
    + backup.quotes.length
    + backup.appointments.length
    + backup.stoneLots.length
    + backup.suppliers.length;
}

export function hasLocalDataToImport(backup: BackupFile): boolean {
  if (
    backup.clients.length
    || backup.quotes.length
    || backup.appointments.length
    || backup.stoneLots.length
    || backup.suppliers.length
  ) return true;
  return backup.settings !== null
    && JSON.stringify(backup.settings) !== JSON.stringify(defaultSettings());
}

export async function isCloudEmpty(remote: Pick<CloudRemote, 'list'> = supabaseCloudRemote): Promise<boolean> {
  const tables = ['clients', 'quotes', 'appointments', 'stone_lots', 'suppliers'] as const;
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

export async function importToCloud(
  backup: BackupFile,
  options: {
    writer?: CloudImportWriter;
    batchSize?: number;
    onProgress?: (progress: CloudImportProgress) => void;
  } = {}
): Promise<void> {
  const writer = options.writer ?? cloudDataSource;
  const batchSize = Math.max(1, Math.round(options.batchSize ?? 20));
  const tasks: ImportTask[] = [];

  if (backup.settings) {
    tasks.push({ label: 'Ajustes', run: () => writer.saveSettings(backup.settings!) });
  }
  for (const supplier of backup.suppliers) {
    tasks.push({ label: 'Proveedores', run: () => writer.saveSupplier(supplier) });
  }
  for (const client of backup.clients) {
    tasks.push({ label: 'Clientes', run: () => writer.saveClient(client) });
  }
  for (const quote of backup.quotes) {
    tasks.push({ label: 'Cotizaciones', run: () => writer.saveQuote(quote) });
  }
  for (const appointment of backup.appointments) {
    tasks.push({ label: 'Agenda', run: () => writer.saveAppointment(appointment) });
  }
  for (const lot of backup.stoneLots) {
    tasks.push({ label: 'Lotes de piedras', run: () => writer.saveStoneLot(lot) });
  }

  const total = tasks.length;
  options.onProgress?.({ completed: 0, total, percent: total ? 0 : 100, current: '' });
  for (let offset = 0; offset < tasks.length; offset += batchSize) {
    const batch = tasks.slice(offset, offset + batchSize);
    for (let index = 0; index < batch.length; index += 1) {
      const task = batch[index];
      await task.run();
      const completed = offset + index + 1;
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
