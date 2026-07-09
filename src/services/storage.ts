// Operaciones de persistencia del dominio sobre la capa db.ts.

import type { Settings, Client, Quote } from '../types';
import { dbGet, dbPut, dbGetAll, dbDelete } from './db';

const SETTINGS_KEY = 'main';

export function defaultSettings(): Settings {
  return {
    jewelryName: 'Emerald Dealer',
    logoDataUrl: '',
    nit: '',
    phone: '',
    whatsapp: '',
    address: '',
    city: '',
    email: '',
    commercialMessage:
      'Cada joya de nuestra casa es un emblema de lujo y distinción, creada para acompañar los momentos que merecen quedar en la memoria. Esta pieza será elaborada con dedicación artesanal, cuidando cada detalle de su fabricación para entregarle una obra digna de usted. Gracias por su confianza.',
    defaultValidityDays: 15,
    currency: 'COP',
    // 0 = aún sin actualizar. Se actualiza solo al abrir la app con internet.
    // Regla comercial (solo interna): precio internacional 24K del día + recargo por gramo.
    goldPricePerGram: 0,
    goldMarkupPerGram: 100000,
    goldPriceUpdatedAt: '',
    goldPriceNote:
      'Regla interna: precio internacional del oro 24K del día + $100.000 COP por gramo. Este dato es confidencial y nunca se muestra al cliente.',
    defaultMarginPercent: 0,
    taxEnabledByDefault: false,
    defaultTaxPercent: 19,
    conditions:
      'Precios sujetos a cambio según el mercado del oro y disponibilidad de piedras. Cotización válida hasta la fecha indicada. El trabajo inicia con la confirmación del anticipo.',
    quoteCounter: 1
  };
}

// Mensaje por defecto de versiones anteriores: si el usuario no lo personalizó,
// se actualiza al nuevo mensaje comercial (migración suave, no destructiva).
const LEGACY_DEFAULT_MESSAGE = 'Gracias por su confianza. Será un gusto atenderle.';

export async function loadSettings(): Promise<Settings> {
  const stored = await dbGet<Settings & { id: string }>('settings', SETTINGS_KEY);
  if (!stored) return defaultSettings();
  // Mezcla con defaults para tolerar settings guardados por versiones anteriores.
  const { id: _id, ...rest } = stored;
  const merged = { ...defaultSettings(), ...rest };
  if (merged.commercialMessage === LEGACY_DEFAULT_MESSAGE) {
    merged.commercialMessage = defaultSettings().commercialMessage;
  }
  return merged;
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
  return quotes
    // Cotizaciones guardadas por versiones sin producción ni abonos.
    .map((q) => ({ ...q, production: q.production ?? [], payments: q.payments ?? [] }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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
