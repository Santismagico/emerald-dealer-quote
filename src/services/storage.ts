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
    commercialMessage: 'Gracias por su confianza. Será un gusto atenderle.',
    defaultValidityDays: 15,
    currency: 'COP',
    // 0 = sin configurar. La interfaz avisa al usuario que debe fijarlo en Ajustes.
    // Referencia comercial del negocio (solo interna): precio internacional 24K + $100.000 COP/g.
    goldPricePerGram: 0,
    goldPriceNote:
      'Referencia interna: precio internacional del oro 24K + $100.000 COP por gramo. Este dato es confidencial y nunca se muestra al cliente.',
    defaultMarginPercent: 0,
    taxEnabledByDefault: false,
    defaultTaxPercent: 19,
    conditions:
      'Precios sujetos a cambio según el mercado del oro y disponibilidad de piedras. Cotización válida hasta la fecha indicada. El trabajo inicia con la confirmación del anticipo.',
    quoteCounter: 1
  };
}

export async function loadSettings(): Promise<Settings> {
  const stored = await dbGet<Settings & { id: string }>('settings', SETTINGS_KEY);
  if (!stored) return defaultSettings();
  // Mezcla con defaults para tolerar settings guardados por versiones anteriores.
  const { id: _id, ...rest } = stored;
  return { ...defaultSettings(), ...rest };
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
  return quotes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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
