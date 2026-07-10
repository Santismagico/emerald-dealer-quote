// Operaciones de persistencia del dominio sobre la capa db.ts.
// Todo dato leído pasa por services/schema.ts (normalización + migraciones):
// las vistas siempre reciben la forma actual del tipo, venga de la versión que venga.

import type { Settings, Client, Quote } from '../types';
import { dbGet, dbPut, dbGetAll, dbDelete } from './db';
import { defaultSettings, normalizeSettings, normalizeQuote } from './schema';

// Re-export para compatibilidad: el resto de la app importa defaultSettings desde aquí.
export { defaultSettings } from './schema';

const SETTINGS_KEY = 'main';

export async function loadSettings(): Promise<Settings> {
  const stored = await dbGet<Settings & { id: string }>('settings', SETTINGS_KEY);
  if (!stored) return defaultSettings();
  const { id: _id, ...rest } = stored;
  return normalizeSettings(rest);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await dbPut('settings', { id: SETTINGS_KEY, ...settings });
}

export async function listClients(): Promise<Client[]> {
  const clients = await dbGetAll<Client>('clients');
  return clients.sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export async function saveClient(client: Client): Promise<void> {
  await dbPut('clients', client);
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
