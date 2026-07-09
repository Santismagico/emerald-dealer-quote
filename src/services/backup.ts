// Exportación e importación de todos los datos a/desde JSON.

import type { BackupFile, Client, Quote, Settings } from '../types';
import { dbGetAll, dbClear, dbPut } from './db';
import { loadSettings, saveSettings } from './storage';

export async function exportBackup(): Promise<BackupFile> {
  const [settings, clients, quotes] = await Promise.all([
    loadSettings(),
    dbGetAll<Client>('clients'),
    dbGetAll<Quote>('quotes')
  ]);
  return {
    app: 'emerald-dealer-quote',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    clients,
    quotes
  };
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

/** Valida y parsea un respaldo. Lanza Error con mensaje humano si no es válido. */
export function parseBackup(json: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  if (typeof data !== 'object' || data === null) {
    throw new Error('El archivo no tiene el formato de respaldo esperado.');
  }
  const b = data as Partial<BackupFile>;
  if (b.app !== 'emerald-dealer-quote') {
    throw new Error('Este archivo no es un respaldo de Emerald Dealer Quote.');
  }
  if (b.version !== 1) {
    throw new Error(`Versión de respaldo no soportada: ${String(b.version)}.`);
  }
  if (!Array.isArray(b.clients) || !Array.isArray(b.quotes)) {
    throw new Error('El respaldo está incompleto (faltan clientes o cotizaciones).');
  }
  for (const q of b.quotes) {
    if (typeof q?.id !== 'string' || typeof q?.number !== 'string') {
      throw new Error('El respaldo contiene cotizaciones inválidas.');
    }
  }
  for (const c of b.clients) {
    if (typeof c?.id !== 'string' || typeof c?.name !== 'string') {
      throw new Error('El respaldo contiene clientes inválidos.');
    }
  }
  return {
    app: 'emerald-dealer-quote',
    version: 1,
    exportedAt: typeof b.exportedAt === 'string' ? b.exportedAt : '',
    settings: (b.settings ?? null) as Settings | null,
    clients: b.clients as Client[],
    quotes: b.quotes as Quote[]
  };
}

/**
 * Importa un respaldo REEMPLAZANDO los datos actuales.
 * La interfaz debe pedir confirmación explícita antes de llamar esto.
 */
export async function importBackup(backup: BackupFile): Promise<void> {
  await Promise.all([dbClear('clients'), dbClear('quotes')]);
  for (const client of backup.clients) {
    await dbPut('clients', client);
  }
  for (const quote of backup.quotes) {
    await dbPut('quotes', quote);
  }
  if (backup.settings) {
    await saveSettings(backup.settings);
  }
}
