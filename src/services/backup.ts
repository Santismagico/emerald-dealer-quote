// Exportación e importación de todos los datos a/desde JSON.
// La importación NORMALIZA todo (services/schema.ts): un respaldo de una versión
// anterior, editado a mano o corrupto nunca puede dejar datos malformados en la
// base local (hallazgo de la auditoría de seguridad 2026-07-09).

import type { BackupFile, Client, Quote } from '../types';
import { dbGetAll, dbClear, dbPut } from './db';
import { loadSettings, saveSettings } from './storage';
import { normalizeSettings, normalizeQuote, normalizeClient } from './schema';

/** Versión actual del formato de respaldo. Se aceptan al importar: 1 y 2. */
export const BACKUP_VERSION = 2;
const ACCEPTED_VERSIONS = [1, 2];

export async function exportBackup(): Promise<BackupFile> {
  const [settings, clients, quotes] = await Promise.all([
    loadSettings(),
    dbGetAll<Client>('clients'),
    dbGetAll<Quote>('quotes')
  ]);
  return {
    app: 'emerald-dealer-quote',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
    clients,
    quotes: quotes.map(normalizeQuote)
  };
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

/** Valida, normaliza y parsea un respaldo. Lanza Error con mensaje humano si no es válido. */
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
  if (typeof b.version !== 'number' || !ACCEPTED_VERSIONS.includes(b.version)) {
    throw new Error(`Versión de respaldo no soportada: ${String(b.version)}.`);
  }
  if (!Array.isArray(b.clients) || !Array.isArray(b.quotes)) {
    throw new Error('El respaldo está incompleto (faltan clientes o cotizaciones).');
  }
  for (const q of b.quotes) {
    if (typeof (q as Quote)?.id !== 'string' || typeof (q as Quote)?.number !== 'string') {
      throw new Error('El respaldo contiene cotizaciones inválidas.');
    }
  }
  for (const c of b.clients) {
    if (typeof (c as Client)?.id !== 'string' || typeof (c as Client)?.name !== 'string') {
      throw new Error('El respaldo contiene clientes inválidos.');
    }
  }
  return {
    app: 'emerald-dealer-quote',
    version: BACKUP_VERSION,
    exportedAt: typeof b.exportedAt === 'string' ? b.exportedAt : '',
    // Normalización total: tipos corruptos se corrigen, imágenes externas se descartan.
    settings: b.settings ? normalizeSettings(b.settings) : null,
    clients: b.clients.map(normalizeClient),
    quotes: b.quotes.map(normalizeQuote)
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
