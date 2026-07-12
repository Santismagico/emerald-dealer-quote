// Operaciones de persistencia del dominio sobre la capa db.ts.
// Todo dato leído pasa por services/schema.ts (normalización + migraciones):
// las vistas siempre reciben la forma actual del tipo, venga de la versión que venga.

import type { Settings, Client, Quote } from '../types';
import { dbGet, dbPut, dbGetAll, dbDelete } from './db';
import { defaultSettings, normalizeSettings, normalizeQuote, normalizeClient } from './schema';

// Re-export para compatibilidad: el resto de la app importa defaultSettings desde aquí.
export { defaultSettings } from './schema';

export const SETTINGS_KEY = 'main';

export async function loadSettings(): Promise<Settings> {
  const stored = await dbGet<Settings & { id: string }>('settings', SETTINGS_KEY);
  if (!stored) return defaultSettings();
  const { id: _id, ...rest } = stored;
  return normalizeSettings(rest);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await dbPut('settings', { id: SETTINGS_KEY, ...settings });
}

/** Registra un respaldo solo después de que el navegador inició su descarga. */
export async function recordBackupExported(exportedAt: string): Promise<Settings> {
  const current = await loadSettings();
  const next = normalizeSettings({
    ...current,
    lastBackupExportedAt: exportedAt,
    backupReminderSnoozedUntil: ''
  });
  await saveSettings(next);
  return next;
}

/** Posponer solo afecta el aviso local; no exporta ni transmite información. */
export async function snoozeBackupReminder(snoozedUntil: string): Promise<Settings> {
  const current = await loadSettings();
  const next = normalizeSettings({ ...current, backupReminderSnoozedUntil: snoozedUntil });
  await saveSettings(next);
  return next;
}

/** Guarda una única referencia para datos antiguos sin fecha válida. */
export async function ensureBackupReminderFirstDataAt(startedAt: string): Promise<Settings> {
  const current = await loadSettings();
  if (Number.isFinite(Date.parse(current.backupReminderFirstDataAt))) return current;
  const next = normalizeSettings({ ...current, backupReminderFirstDataAt: startedAt });
  await saveSettings(next);
  return next;
}

export async function listClients(): Promise<Client[]> {
  const clients = await dbGetAll<unknown>('clients');
  return clients.map(normalizeClient).sort((a, b) => {
    const byName = a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
    return byName || a.id.localeCompare(b.id, 'es');
  });
}

export async function saveClient(client: Client): Promise<void> {
  await dbPut('clients', normalizeClient(client));
}

export async function deleteClient(id: string): Promise<void> {
  await dbDelete('clients', id);
}

export async function listQuotes(): Promise<Quote[]> {
  const quotes = await dbGetAll<Quote>('quotes');
  return quotes.map(normalizeQuote).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveQuote(quote: Quote): Promise<void> {
  await dbPut('quotes', quote);
}

export async function deleteQuote(id: string): Promise<void> {
  await dbDelete('quotes', id);
}

/** Genera el siguiente número de cotización y avanza el consecutivo en settings. */
export async function nextQuoteNumber(): Promise<string> {
  const settings = await loadSettings();
  const year = new Date().getFullYear();
  const number = `ED-${year}-${String(settings.quoteCounter).padStart(4, '0')}`;
  await saveSettings({ ...settings, quoteCounter: settings.quoteCounter + 1 });
  return number;
}
