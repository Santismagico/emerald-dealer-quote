// Operaciones de persistencia del dominio sobre la capa db.ts.
// Todo dato leído pasa por services/schema.ts (normalización + migraciones):
// las vistas siempre reciben la forma actual del tipo, venga de la versión que venga.

import type { Settings, Client, Quote, Appointment } from '../types';
import type { GoldPriceBreakdown } from './goldPrice';
import { dbGet, dbPut, dbGetAll, dbDelete, dbUpdate } from './db';
import {
  defaultSettings,
  normalizeSettings,
  normalizeQuote,
  normalizeClient,
  normalizeAppointment
} from './schema';
import { compareAppointments } from './agenda';

// Re-export para compatibilidad: el resto de la app importa defaultSettings desde aquí.
export { defaultSettings } from './schema';

export const SETTINGS_KEY = 'main';

type StoredSettings = Settings & { id: string };

function normalizeStoredSettings(stored: StoredSettings | undefined): Settings {
  if (!stored) return defaultSettings();
  const { id: _id, ...rest } = stored;
  return normalizeSettings(rest);
}

export async function loadSettings(): Promise<Settings> {
  const stored = await dbGet<StoredSettings>('settings', SETTINGS_KEY);
  return normalizeStoredSettings(stored);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await dbPut('settings', { id: SETTINGS_KEY, ...settings });
}

/** Actualiza settings sin separar la lectura de la escritura. */
export async function updateSettingsAtomically(
  update: (current: Settings) => Settings
): Promise<Settings> {
  const stored = await dbUpdate<StoredSettings>('settings', SETTINGS_KEY, (current) => {
    const next = normalizeSettings(update(normalizeStoredSettings(current)));
    return { id: SETTINGS_KEY, ...next };
  });
  return normalizeStoredSettings(stored);
}

/**
 * Guarda los campos editables sin devolver el contador ni las referencias de
 * respaldo a una versión antigua del formulario.
 */
export async function saveEditableSettings(
  settings: Settings,
  goldPriceWasEdited: boolean
): Promise<Settings> {
  return updateSettingsAtomically((current) => ({
    ...settings,
    goldPricePerGram: goldPriceWasEdited ? settings.goldPricePerGram : current.goldPricePerGram,
    goldPriceUpdatedAt: goldPriceWasEdited
      ? settings.goldPriceUpdatedAt
      : current.goldPriceUpdatedAt,
    quoteCounter: current.quoteCounter,
    lastBackupExportedAt: current.lastBackupExportedAt,
    backupReminderSnoozedUntil: current.backupReminderSnoozedUntil,
    backupReminderFirstDataAt: current.backupReminderFirstDataAt
  }));
}

/**
 * Aplica una consulta terminada con el recargo más reciente. La red puede
 * tardar mientras el usuario cambia Ajustes, por eso el total se recompone
 * dentro de la misma transacción que lo guarda.
 */
export async function saveFetchedGoldPrice(
  fetched: GoldPriceBreakdown
): Promise<{ settings: Settings; info: GoldPriceBreakdown }> {
  let applied = fetched;
  const settings = await updateSettingsAtomically((current) => {
    const markupPerGram = Math.round(current.goldMarkupPerGram);
    applied = {
      ...fetched,
      markupPerGram,
      totalCopPerGram: fetched.internationalCopPerGram + markupPerGram
    };
    return {
      ...current,
      goldPricePerGram: applied.totalCopPerGram,
      goldPriceUpdatedAt: applied.fetchedAt
    };
  });
  return { settings, info: applied };
}

/** Registra un respaldo solo después de que el navegador inició su descarga. */
export async function recordBackupExported(exportedAt: string): Promise<Settings> {
  return updateSettingsAtomically((current) => ({
    ...current,
    lastBackupExportedAt: exportedAt,
    backupReminderSnoozedUntil: ''
  }));
}

/** Posponer solo afecta el aviso local; no exporta ni transmite información. */
export async function snoozeBackupReminder(snoozedUntil: string): Promise<Settings> {
  return updateSettingsAtomically((current) => ({ ...current, backupReminderSnoozedUntil: snoozedUntil }));
}

/** Guarda una única referencia para datos antiguos sin fecha válida. */
export async function ensureBackupReminderFirstDataAt(startedAt: string): Promise<Settings> {
  return updateSettingsAtomically((current) => {
    if (Number.isFinite(Date.parse(current.backupReminderFirstDataAt))) return current;
    return { ...current, backupReminderFirstDataAt: startedAt };
  });
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

export async function listAppointments(): Promise<Appointment[]> {
  const appointments = await dbGetAll<unknown>('appointments');
  return appointments.map(normalizeAppointment).sort(compareAppointments);
}

export async function saveAppointment(appointment: Appointment): Promise<void> {
  await dbPut('appointments', normalizeAppointment(appointment));
}

export async function deleteAppointment(id: string): Promise<void> {
  await dbDelete('appointments', id);
}

/** Genera el siguiente número de cotización y avanza el consecutivo en settings. */
export async function nextQuoteNumber(): Promise<string> {
  const year = new Date().getFullYear();
  let number = '';
  await updateSettingsAtomically((settings) => {
    number = `ED-${year}-${String(settings.quoteCounter).padStart(4, '0')}`;
    return { ...settings, quoteCounter: settings.quoteCounter + 1 };
  });
  return number;
}
