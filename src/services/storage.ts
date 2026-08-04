// Operaciones de persistencia del dominio sobre la capa db.ts.
// Todo dato leído pasa por services/schema.ts (normalización + migraciones):
// las vistas siempre reciben la forma actual del tipo, venga de la versión que venga.

import type {
  Settings,
  Client,
  Quote,
  Appointment,
  StoneLot,
  Supplier,
  Buyer,
  StockJewel,
  MaterialPartner,
  MaterialLot,
  Expense
} from '../types';
import type { GoldPriceBreakdown } from './goldPrice';
import { dbGet, dbPut, dbGetAll, dbDelete, dbUpdate, dbWriteTransaction } from './db';
import {
  defaultSettings,
  normalizeSettings,
  normalizeQuote,
  normalizeClient,
  normalizeAppointment,
  normalizeStoneLot,
  normalizeSupplier,
  normalizeBuyer,
  normalizeStockJewel,
  normalizeMaterialPartner,
  normalizeMaterialLot,
  normalizeExpense
} from './schema';
import { compareAppointments } from './agenda';
import {
  compareStoneLots,
  validateStoneLotOwnership,
  validateStoneLotSalesMetadata
} from './stones';
import { compareStockJewels, validateStockJewelSaleMetadata } from './stockJewels';
import { compareMaterialLots } from './materials';
import { compareExpenses, validateExpense } from './expenses';

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
    expenseCategories: current.expenseCategories,
    productTypes: current.productTypes,
    productTypesUpdatedAt: current.productTypesUpdatedAt,
    lastKnownUsdRate: current.lastKnownUsdRate,
    usdRateUpdatedAt: current.usdRateUpdatedAt,
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
      goldPriceUpdatedAt: applied.fetchedAt,
      lastKnownUsdRate: applied.copPerUsd,
      usdRateUpdatedAt: applied.fetchedAt
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

export async function listStoneLots(): Promise<StoneLot[]> {
  const lots = await dbGetAll<unknown>('stoneLots');
  return lots.map(normalizeStoneLot).sort(compareStoneLots);
}

export async function saveStoneLot(lot: StoneLot): Promise<void> {
  const error = validateStoneLotOwnership(lot);
  if (error) throw new Error(error);
  const stored = await dbGet<unknown>('stoneLots', lot.id);
  const previous = stored === undefined ? null : normalizeStoneLot(stored);
  const metadataError = validateStoneLotSalesMetadata(lot, previous);
  if (metadataError) throw new Error(metadataError);
  await dbPut('stoneLots', normalizeStoneLot(lot));
}

export async function deleteStoneLot(id: string): Promise<void> {
  await dbDelete('stoneLots', id);
}

export async function listSuppliers(): Promise<Supplier[]> {
  const suppliers = await dbGetAll<unknown>('suppliers');
  return suppliers.map(normalizeSupplier).sort((a, b) => {
    const byName = a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
    return byName || a.id.localeCompare(b.id, 'es');
  });
}

export async function saveSupplier(supplier: Supplier): Promise<void> {
  const normalizedSupplier = normalizeSupplier(supplier);
  const updatedAt = new Date().toISOString();

  await dbWriteTransaction(['suppliers', 'stoneLots'], (getStore) => {
    getStore('suppliers').put(normalizedSupplier);

    const stoneLots = getStore('stoneLots');
    const request = stoneLots.getAll();
    request.onsuccess = () => {
      for (const stored of request.result as unknown[]) {
        const lot = normalizeStoneLot(stored);
        if (lot.supplierId === normalizedSupplier.id && lot.supplier !== normalizedSupplier.name) {
          stoneLots.put({ ...lot, supplier: normalizedSupplier.name, updatedAt });
        }
      }
    };
  });
}

export async function deleteSupplier(id: string): Promise<void> {
  const updatedAt = new Date().toISOString();

  await dbWriteTransaction(['suppliers', 'stoneLots'], (getStore) => {
    getStore('suppliers').delete(id);

    const stoneLots = getStore('stoneLots');
    const request = stoneLots.getAll();
    request.onsuccess = () => {
      for (const stored of request.result as unknown[]) {
        const lot = normalizeStoneLot(stored);
        if (lot.supplierId === id) {
          stoneLots.put({ ...lot, supplierId: null, updatedAt });
        }
      }
    };
  });
}

export async function listBuyers(): Promise<Buyer[]> {
  const buyers = await dbGetAll<unknown>('buyers');
  return buyers.map(normalizeBuyer).sort((a, b) => {
    const byName = a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
    return byName || a.id.localeCompare(b.id, 'es');
  });
}

/**
 * Guarda el comprador y propaga su nombre a las ventas que lo apuntan, para que
 * renombrarlo no deje historial con el nombre viejo (mismo patrón que C3 con
 * los proveedores). Todo ocurre en una sola transacción.
 */
export async function saveBuyer(buyer: Buyer): Promise<void> {
  const normalizedBuyer = normalizeBuyer(buyer);
  const updatedAt = new Date().toISOString();

  await dbWriteTransaction(['buyers', 'stoneLots', 'stockJewels'], (getStore) => {
    getStore('buyers').put(normalizedBuyer);

    const stoneLots = getStore('stoneLots');
    const lotsRequest = stoneLots.getAll();
    lotsRequest.onsuccess = () => {
      for (const stored of lotsRequest.result as unknown[]) {
        const lot = normalizeStoneLot(stored);
        const needsRename = lot.sales.some(
          (sale) => sale.buyerId === normalizedBuyer.id && sale.buyer !== normalizedBuyer.name
        );
        if (!needsRename) continue;
        stoneLots.put({
          ...lot,
          sales: lot.sales.map((sale) =>
            sale.buyerId === normalizedBuyer.id ? { ...sale, buyer: normalizedBuyer.name } : sale
          ),
          updatedAt
        });
      }
    };

    const stockJewels = getStore('stockJewels');
    const jewelsRequest = stockJewels.getAll();
    jewelsRequest.onsuccess = () => {
      for (const stored of jewelsRequest.result as unknown[]) {
        const jewel = normalizeStockJewel(stored);
        if (
          !jewel.sale ||
          jewel.sale.buyerId !== normalizedBuyer.id ||
          jewel.sale.buyer === normalizedBuyer.name
        ) {
          continue;
        }
        stockJewels.put({
          ...jewel,
          sale: { ...jewel.sale, buyer: normalizedBuyer.name },
          updatedAt
        });
      }
    };
  });
}

/**
 * Borra el comprador SIN tocar sus ventas: el nombre queda escrito y solo se
 * suelta el vínculo. El historial de dinero nunca se pierde por borrar una
 * ficha (D-043, mismo criterio que con proveedores).
 */
export async function deleteBuyer(id: string): Promise<void> {
  const updatedAt = new Date().toISOString();

  await dbWriteTransaction(['buyers', 'stoneLots', 'stockJewels'], (getStore) => {
    getStore('buyers').delete(id);

    const stoneLots = getStore('stoneLots');
    const lotsRequest = stoneLots.getAll();
    lotsRequest.onsuccess = () => {
      for (const stored of lotsRequest.result as unknown[]) {
        const lot = normalizeStoneLot(stored);
        if (!lot.sales.some((sale) => sale.buyerId === id)) continue;
        stoneLots.put({
          ...lot,
          sales: lot.sales.map((sale) =>
            sale.buyerId === id ? { ...sale, buyerId: null } : sale
          ),
          updatedAt
        });
      }
    };

    const stockJewels = getStore('stockJewels');
    const jewelsRequest = stockJewels.getAll();
    jewelsRequest.onsuccess = () => {
      for (const stored of jewelsRequest.result as unknown[]) {
        const jewel = normalizeStockJewel(stored);
        if (!jewel.sale || jewel.sale.buyerId !== id) continue;
        stockJewels.put({ ...jewel, sale: { ...jewel.sale, buyerId: null }, updatedAt });
      }
    };
  });
}

export async function listStockJewels(): Promise<StockJewel[]> {
  const jewels = await dbGetAll<unknown>('stockJewels');
  return jewels.map(normalizeStockJewel).sort(compareStockJewels);
}

export async function saveStockJewel(jewel: StockJewel): Promise<void> {
  const stored = await dbGet<unknown>('stockJewels', jewel.id);
  const previous = stored === undefined ? null : normalizeStockJewel(stored);
  const metadataError = validateStockJewelSaleMetadata(jewel, previous);
  if (metadataError) throw new Error(metadataError);
  await dbPut('stockJewels', normalizeStockJewel(jewel));
}

export async function deleteStockJewel(id: string): Promise<void> {
  await dbDelete('stockJewels', id);
}

export async function listMaterialPartners(): Promise<MaterialPartner[]> {
  const partners = await dbGetAll<unknown>('materialPartners');
  return partners.map(normalizeMaterialPartner).sort((a, b) => {
    const byName = a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
    return byName || a.id.localeCompare(b.id, 'es');
  });
}

/**
 * Guarda el socio y propaga su nombre a material, gastos y piedras vinculados,
 * para que renombrarlo no deje historial con el nombre viejo (mismo patrón que
 * proveedores en C3 y compradores en D-043). Todo en una sola transacción.
 */
export async function saveMaterialPartner(partner: MaterialPartner): Promise<void> {
  const normalizedPartner = normalizeMaterialPartner(partner);
  const updatedAt = new Date().toISOString();

  await dbWriteTransaction(['materialPartners', 'materialLots', 'expenses', 'stoneLots'], (getStore) => {
    getStore('materialPartners').put(normalizedPartner);

    const lots = getStore('materialLots');
    const request = lots.getAll();
    request.onsuccess = () => {
      for (const stored of request.result as unknown[]) {
        const lot = normalizeMaterialLot(stored);
        if (lot.partnerId === normalizedPartner.id && lot.partnerName !== normalizedPartner.name) {
          lots.put({ ...lot, partnerName: normalizedPartner.name, updatedAt });
        }
      }
    };

    const expenses = getStore('expenses');
    const expensesRequest = expenses.getAll();
    expensesRequest.onsuccess = () => {
      for (const stored of expensesRequest.result as unknown[]) {
        const expense = normalizeExpense(stored);
        if (
          expense.partnerId === normalizedPartner.id &&
          expense.partnerName !== normalizedPartner.name
        ) {
          expenses.put({ ...expense, partnerName: normalizedPartner.name, updatedAt });
        }
      }
    };

    const stoneLots = getStore('stoneLots');
    const stoneLotsRequest = stoneLots.getAll();
    stoneLotsRequest.onsuccess = () => {
      for (const stored of stoneLotsRequest.result as unknown[]) {
        const lot = normalizeStoneLot(stored);
        if (lot.partnerId === normalizedPartner.id && lot.partnerName !== normalizedPartner.name) {
          stoneLots.put({ ...lot, partnerName: normalizedPartner.name, updatedAt });
        }
      }
    };
  });
}

/**
 * Borra el socio sin borrar historia: solo suelta `partnerId`; nombres y repartos
 * permanecen en material, gastos y piedras (D-049/D-053).
 */
export async function deleteMaterialPartner(id: string): Promise<void> {
  const updatedAt = new Date().toISOString();

  await dbWriteTransaction(['materialPartners', 'materialLots', 'expenses', 'stoneLots'], (getStore) => {
    getStore('materialPartners').delete(id);

    const lots = getStore('materialLots');
    const request = lots.getAll();
    request.onsuccess = () => {
      for (const stored of request.result as unknown[]) {
        const lot = normalizeMaterialLot(stored);
        if (lot.partnerId === id) {
          lots.put({ ...lot, partnerId: null, updatedAt });
        }
      }
    };

    const expenses = getStore('expenses');
    const expensesRequest = expenses.getAll();
    expensesRequest.onsuccess = () => {
      for (const stored of expensesRequest.result as unknown[]) {
        const expense = normalizeExpense(stored);
        if (expense.partnerId === id) {
          expenses.put({ ...expense, partnerId: null, updatedAt });
        }
      }
    };

    const stoneLots = getStore('stoneLots');
    const stoneLotsRequest = stoneLots.getAll();
    stoneLotsRequest.onsuccess = () => {
      for (const stored of stoneLotsRequest.result as unknown[]) {
        const lot = normalizeStoneLot(stored);
        if (lot.partnerId === id) {
          stoneLots.put({ ...lot, partnerId: null, updatedAt });
        }
      }
    };
  });
}

export async function listMaterialLots(): Promise<MaterialLot[]> {
  const lots = await dbGetAll<unknown>('materialLots');
  return lots.map(normalizeMaterialLot).sort(compareMaterialLots);
}

export async function saveMaterialLot(lot: MaterialLot): Promise<void> {
  await dbPut('materialLots', normalizeMaterialLot(lot));
}

export async function deleteMaterialLot(id: string): Promise<void> {
  await dbDelete('materialLots', id);
}

export async function listExpenses(): Promise<Expense[]> {
  const expenses = await dbGetAll<unknown>('expenses');
  return expenses.map(normalizeExpense).sort(compareExpenses);
}

export async function saveExpense(expense: Expense): Promise<void> {
  const stored = await dbGet<unknown>('expenses', expense.id);
  const previous = stored === undefined ? null : normalizeExpense(stored);
  const error = validateExpense(expense, previous);
  if (error) throw new Error(error);
  await dbPut('expenses', normalizeExpense(expense));
}

export async function deleteExpense(id: string): Promise<void> {
  await dbDelete('expenses', id);
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
