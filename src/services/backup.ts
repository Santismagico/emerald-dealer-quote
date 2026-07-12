// Exportación e importación de todos los datos a/desde JSON.
// La importación NORMALIZA todo (services/schema.ts): un respaldo de una versión
// anterior, editado a mano o corrupto nunca puede dejar datos malformados en la
// base local (hallazgo de la auditoría de seguridad 2026-07-09).

import type { BackupFile, Client, Quote } from '../types';
import { dbWriteTransaction } from './db';
import { loadSettings, listClients, listQuotes, SETTINGS_KEY } from './storage';
import { normalizeSettings, normalizeQuote, normalizeClient } from './schema';

/** Versión actual del formato de respaldo. Se aceptan al importar: 1 y 2. */
export const BACKUP_VERSION = 2;
const ACCEPTED_VERSIONS = [1, 2];

export async function exportBackup(): Promise<BackupFile> {
  const [settings, clients, quotes] = await Promise.all([
    loadSettings(),
    listClients(),
    listQuotes()
  ]);
  return {
    app: 'emerald-dealer-quote',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
    clients,
    quotes
  };
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

/** Inicia la descarga del respaldo JSON compatible usado por toda la aplicación. */
export async function downloadBackupFile(): Promise<void> {
  const backup = await exportBackup();
  const json = serializeBackup(backup);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `respaldo-emerald-dealer-${date}.json`;
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Valida y normaliza por completo antes de que pueda empezar una escritura. */
function normalizeBackup(data: unknown): BackupFile {
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
  const rawSettings = b.settings ?? null;
  if (rawSettings !== null && (typeof rawSettings !== 'object' || Array.isArray(rawSettings))) {
    throw new Error('El respaldo contiene ajustes inválidos.');
  }
  const quoteIds = new Set<string>();
  for (const q of b.quotes) {
    if (typeof (q as Quote)?.id !== 'string' || typeof (q as Quote)?.number !== 'string') {
      throw new Error('El respaldo contiene cotizaciones inválidas.');
    }
    const id = (q as Quote).id;
    if (!id.trim()) {
      throw new Error('El respaldo contiene cotizaciones con identificador vacío.');
    }
    if (quoteIds.has(id)) {
      throw new Error('El respaldo contiene cotizaciones duplicadas.');
    }
    quoteIds.add(id);
  }
  const clientIds = new Set<string>();
  for (const c of b.clients) {
    if (typeof (c as Client)?.id !== 'string' || typeof (c as Client)?.name !== 'string') {
      throw new Error('El respaldo contiene clientes inválidos.');
    }
    const id = (c as Client).id;
    if (!id.trim()) {
      throw new Error('El respaldo contiene clientes con identificador vacío.');
    }
    if (clientIds.has(id)) {
      throw new Error('El respaldo contiene clientes duplicados.');
    }
    clientIds.add(id);
  }
  return {
    app: 'emerald-dealer-quote',
    version: BACKUP_VERSION,
    exportedAt: typeof b.exportedAt === 'string' ? b.exportedAt : '',
    // Normalización total: tipos corruptos se corrigen, imágenes externas se descartan.
    settings: rawSettings === null ? null : normalizeSettings(rawSettings),
    clients: b.clients.map(normalizeClient),
    quotes: b.quotes.map(normalizeQuote)
  };
}

/** Valida, normaliza y parsea un respaldo. Lanza Error con mensaje humano si no es válido. */
export function parseBackup(json: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  return normalizeBackup(data);
}

/**
 * Importa un respaldo REEMPLAZANDO los datos actuales.
 * La interfaz debe pedir confirmación explícita antes de llamar esto.
 */
export async function importBackup(backup: BackupFile): Promise<void> {
  // Defensa en profundidad: aunque el llamador no haya usado parseBackup, toda
  // validación y normalización termina antes de abrir la transacción destructiva.
  const normalized = normalizeBackup(backup);

  try {
    await dbWriteTransaction(['settings', 'clients', 'quotes'], (getStore) => {
      const settingsStore = getStore('settings');
      const clientsStore = getStore('clients');
      const quotesStore = getStore('quotes');

      settingsStore.clear();
      clientsStore.clear();
      quotesStore.clear();

      if (normalized.settings) {
        settingsStore.put({ id: SETTINGS_KEY, ...normalized.settings });
      }
      for (const client of normalized.clients) {
        clientsStore.put(client);
      }
      for (const quote of normalized.quotes) {
        quotesStore.put(quote);
      }
    });
  } catch {
    throw new Error(
      'No se pudo restaurar el respaldo. Tus datos anteriores se conservaron.'
    );
  }
}
