// Exportación e importación de todos los datos a/desde JSON.
// La importación NORMALIZA todo (services/schema.ts): un respaldo de una versión
// anterior, editado a mano o corrupto nunca puede dejar datos malformados en la
// base local (hallazgo de la auditoría de seguridad 2026-07-09).

import type {
  Appointment,
  BackupFile,
  Buyer,
  Client,
  Expense,
  MaterialLot,
  MaterialPartner,
  Quote,
  StockJewel,
  StoneLot,
  Supplier
} from '../types';
import { dbWriteTransaction } from './db';
import {
  loadSettings,
  listClients,
  listQuotes,
  listAppointments,
  listStoneLots,
  listSuppliers,
  listBuyers,
  listStockJewels,
  listMaterialPartners,
  listMaterialLots,
  listExpenses,
  SETTINGS_KEY
} from './storage';
import {
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
import { validateExpense } from './expenses';
import {
  validateStoneLotInventory,
  validateStoneLotOwnership,
  validateStoneLotSalesMetadata
} from './stones';
import { validateStockJewelSaleMetadata } from './stockJewels';
import { validateOptionalUsdRate } from './currency';
import { validateSettingsMetadata } from './settingsMetadata';
import { validateStoneJewelTransformationCollections } from './stoneJewelTransformation';

/**
 * Versión actual del formato de respaldo. Se aceptan al importar: 1 a 8.
 * v3 agregó las citas; v4 los lotes de piedras; v5 los proveedores; v6 los
 * compradores y las joyas en stock; v7 los socios y lotes de material; v8 los gastos. Los
 * respaldos más viejos se importan con las listas nuevas vacías y nunca fallan
 * por no traerlas.
 */
export const BACKUP_VERSION = 8;
const ACCEPTED_VERSIONS = [1, 2, 3, 4, 5, 6, 7, 8];
export const MAX_BACKUP_FILE_BYTES = 25 * 1024 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveCarats(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0 &&
    Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-7
  );
}

function isRawStoneInternalUse(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.date === 'string' &&
    isPositiveCarats(value.carats) &&
    typeof value.quantity === 'number' &&
    Number.isInteger(value.quantity) &&
    value.quantity > 0 &&
    (value.origin === 'bruto' || value.origin === 'tallado') &&
    typeof value.jewelId === 'string' &&
    typeof value.costCop === 'number' &&
    Number.isSafeInteger(value.costCop) &&
    value.costCop >= 0 &&
    typeof value.notes === 'string'
  );
}

function isRawStoneTransformation(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.date === 'string' &&
    typeof value.lotId === 'string' &&
    typeof value.jewelId === 'string' &&
    isPositiveCarats(value.carats) &&
    typeof value.quantity === 'number' &&
    Number.isInteger(value.quantity) &&
    value.quantity > 0 &&
    (value.origin === 'bruto' || value.origin === 'tallado') &&
    typeof value.costCop === 'number' &&
    Number.isSafeInteger(value.costCop) &&
    value.costCop >= 0 &&
    typeof value.notes === 'string' &&
    value.fromStoneKind === 'fantasia' &&
    value.toStoneKind === 'natural'
  );
}

export async function exportBackup(): Promise<BackupFile> {
  const [
    settings,
    clients,
    quotes,
    appointments,
    stoneLots,
    suppliers,
    buyers,
    stockJewels,
    materialPartners,
    materialLots,
    expenses
  ] = await Promise.all([
    loadSettings(),
    listClients(),
    listQuotes(),
    listAppointments(),
    listStoneLots(),
    listSuppliers(),
    listBuyers(),
    listStockJewels(),
    listMaterialPartners(),
    listMaterialLots(),
    listExpenses()
  ]);
  return {
    app: 'emerald-dealer-quote',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
    clients,
    quotes,
    appointments,
    stoneLots,
    suppliers,
    buyers,
    stockJewels,
    materialPartners,
    materialLots,
    expenses
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
  if (rawSettings !== null) {
    const settingsError = validateSettingsMetadata(rawSettings);
    if (settingsError) {
      throw new Error(`El respaldo contiene ajustes inválidos. ${settingsError}`);
    }
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
    const payments = (q as Quote).payments;
    if (
      payments !== undefined &&
      (!Array.isArray(payments) ||
        payments.some(
          (payment) =>
            typeof payment !== 'object' ||
            payment === null ||
            typeof payment.amount !== 'number' ||
            !Number.isFinite(payment.amount)
        ))
    ) {
      throw new Error('El respaldo contiene un abono inválido. Revisa el archivo e inténtalo de nuevo.');
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
  // Las citas son opcionales (v1/v2 no las traen), pero si vienen deben ser válidas.
  const rawAppointments = b.appointments ?? [];
  if (!Array.isArray(rawAppointments)) {
    throw new Error('El respaldo contiene una agenda inválida.');
  }
  const appointmentIds = new Set<string>();
  for (const a of rawAppointments) {
    const id = (a as Appointment)?.id;
    if (typeof id !== 'string' || !id.trim()) {
      throw new Error('El respaldo contiene citas inválidas.');
    }
    if (appointmentIds.has(id)) {
      throw new Error('El respaldo contiene citas duplicadas.');
    }
    appointmentIds.add(id);
  }
  // Los lotes de piedras son opcionales (v1/v2/v3 no los traen).
  const rawStoneLots = b.stoneLots ?? [];
  if (!Array.isArray(rawStoneLots)) {
    throw new Error('El respaldo contiene lotes de piedras inválidos.');
  }
  const stoneLotIds = new Set<string>();
  for (const l of rawStoneLots) {
    const id = (l as StoneLot)?.id;
    if (typeof id !== 'string' || !id.trim()) {
      throw new Error('El respaldo contiene lotes de piedras inválidos.');
    }
    if (stoneLotIds.has(id)) {
      throw new Error('El respaldo contiene lotes de piedras duplicados.');
    }
    if (
      isRecord(l) &&
      Object.prototype.hasOwnProperty.call(l, 'internalUses') &&
      (!Array.isArray(l.internalUses) || !l.internalUses.every(isRawStoneInternalUse))
    ) {
      throw new Error('El respaldo contiene usos internos de piedras inválidos.');
    }
    const ownershipError = validateStoneLotOwnership(l);
    if (ownershipError) {
      throw new Error(`El respaldo contiene un reparto de piedras inválido: ${ownershipError}`);
    }
    const metadataError = validateStoneLotSalesMetadata(l);
    if (metadataError) {
      throw new Error(`El respaldo contiene ventas de piedras inválidas: ${metadataError}`);
    }
    const inventoryError = validateStoneLotInventory(normalizeStoneLot(l));
    if (inventoryError) {
      throw new Error(`El respaldo contiene existencias de piedras inválidas: ${inventoryError}`);
    }
    stoneLotIds.add(id);
  }
  // Los proveedores son opcionales (v1–v4 no los traen).
  const rawSuppliers = b.suppliers ?? [];
  if (!Array.isArray(rawSuppliers)) {
    throw new Error('El respaldo contiene proveedores inválidos.');
  }
  const supplierIds = new Set<string>();
  for (const s of rawSuppliers) {
    const id = (s as Supplier)?.id;
    if (typeof id !== 'string' || !id.trim()) {
      throw new Error('El respaldo contiene proveedores inválidos.');
    }
    if (supplierIds.has(id)) {
      throw new Error('El respaldo contiene proveedores duplicados.');
    }
    supplierIds.add(id);
  }
  // Los compradores son opcionales (v1–v5 no los traen).
  const rawBuyers = b.buyers ?? [];
  if (!Array.isArray(rawBuyers)) {
    throw new Error('El respaldo contiene compradores inválidos.');
  }
  const buyerIds = new Set<string>();
  for (const bu of rawBuyers) {
    const id = (bu as Buyer)?.id;
    if (typeof id !== 'string' || !id.trim()) {
      throw new Error('El respaldo contiene compradores inválidos.');
    }
    if (buyerIds.has(id)) {
      throw new Error('El respaldo contiene compradores duplicados.');
    }
    buyerIds.add(id);
  }
  // Las joyas en stock son opcionales (v1–v5 no las traen).
  const rawStockJewels = b.stockJewels ?? [];
  if (!Array.isArray(rawStockJewels)) {
    throw new Error('El respaldo contiene joyas en stock inválidas.');
  }
  const jewelIds = new Set<string>();
  for (const j of rawStockJewels) {
    const id = (j as StockJewel)?.id;
    if (typeof id !== 'string' || !id.trim()) {
      throw new Error('El respaldo contiene joyas en stock inválidas.');
    }
    if (jewelIds.has(id)) {
      throw new Error('El respaldo contiene joyas en stock duplicadas.');
    }
    if (
      isRecord(j) &&
      Object.prototype.hasOwnProperty.call(j, 'stoneTransformations') &&
      (!Array.isArray(j.stoneTransformations) ||
        !j.stoneTransformations.every(isRawStoneTransformation))
    ) {
      throw new Error('El respaldo contiene transformaciones de joyas inválidas.');
    }
    const metadataError = validateStockJewelSaleMetadata(j);
    if (metadataError) {
      throw new Error(`El respaldo contiene ventas de joyas inválidas: ${metadataError}`);
    }
    jewelIds.add(id);
  }
  // Los socios de material son opcionales (v1–v6 no los traen).
  const rawMaterialPartners = b.materialPartners ?? [];
  if (!Array.isArray(rawMaterialPartners)) {
    throw new Error('El respaldo contiene socios de material inválidos.');
  }
  const partnerIds = new Set<string>();
  for (const p of rawMaterialPartners) {
    const id = (p as MaterialPartner)?.id;
    if (typeof id !== 'string' || !id.trim()) {
      throw new Error('El respaldo contiene socios de material inválidos.');
    }
    if (partnerIds.has(id)) {
      throw new Error('El respaldo contiene socios de material duplicados.');
    }
    partnerIds.add(id);
  }
  // Los lotes de material son opcionales (v1–v6 no los traen).
  const rawMaterialLots = b.materialLots ?? [];
  if (!Array.isArray(rawMaterialLots)) {
    throw new Error('El respaldo contiene lotes de material inválidos.');
  }
  const materialLotIds = new Set<string>();
  for (const l of rawMaterialLots) {
    const id = (l as MaterialLot)?.id;
    if (typeof id !== 'string' || !id.trim()) {
      throw new Error('El respaldo contiene lotes de material inválidos.');
    }
    if (materialLotIds.has(id)) {
      throw new Error('El respaldo contiene lotes de material duplicados.');
    }
    materialLotIds.add(id);
  }
  // Los gastos son opcionales en v1–v7 y obligatorios en el formato v8.
  const rawExpenses = b.expenses ?? [];
  if (!Array.isArray(rawExpenses) || (b.version === 8 && !Array.isArray(b.expenses))) {
    throw new Error('El respaldo contiene gastos inválidos.');
  }
  const expenseIds = new Set<string>();
  for (const rawExpense of rawExpenses) {
    const expense = rawExpense as Partial<Expense>;
    if (typeof expense.id !== 'string' || !expense.id.trim()) {
      throw new Error('El respaldo contiene gastos con identificador inválido.');
    }
    if (expenseIds.has(expense.id)) {
      throw new Error('El respaldo contiene gastos duplicados.');
    }
    if (
      typeof expense.amountCop !== 'number' ||
      !Number.isFinite(expense.amountCop) ||
      !Number.isInteger(expense.amountCop) ||
      typeof expense.myPercent !== 'number' ||
      !Number.isFinite(expense.myPercent) ||
      !Number.isInteger(expense.myPercent) ||
      expense.myPercent < 0 ||
      expense.myPercent > 100
    ) {
      throw new Error('El respaldo contiene dinero o porcentajes inválidos en gastos.');
    }
    const rateError = validateOptionalUsdRate(
      Object.prototype.hasOwnProperty.call(expense, 'usdRate') ? expense.usdRate : null
    );
    if (rateError) {
      throw new Error(`El respaldo contiene tasas inválidas en gastos: ${rateError}`);
    }
    const normalizedExpense = normalizeExpense(expense);
    if (validateExpense(normalizedExpense)) {
      throw new Error('El respaldo contiene gastos inválidos.');
    }
    expenseIds.add(expense.id);
  }
  const normalized: BackupFile = {
    app: 'emerald-dealer-quote',
    version: BACKUP_VERSION,
    exportedAt: typeof b.exportedAt === 'string' ? b.exportedAt : '',
    // Normalización total: tipos corruptos se corrigen, imágenes externas se descartan.
    settings: rawSettings === null ? null : normalizeSettings(rawSettings),
    clients: b.clients.map(normalizeClient),
    quotes: b.quotes.map(normalizeQuote),
    appointments: rawAppointments.map(normalizeAppointment),
    stoneLots: rawStoneLots.map(normalizeStoneLot),
    suppliers: rawSuppliers.map(normalizeSupplier),
    buyers: rawBuyers.map(normalizeBuyer),
    stockJewels: rawStockJewels.map(normalizeStockJewel),
    materialPartners: rawMaterialPartners.map(normalizeMaterialPartner),
    materialLots: rawMaterialLots.map(normalizeMaterialLot),
    expenses: rawExpenses.map(normalizeExpense)
  };
  const linkError = validateStoneJewelTransformationCollections(
    normalized.stoneLots,
    normalized.stockJewels
  );
  if (linkError) throw new Error(`El respaldo no cuadra entre Piedras y Joyas: ${linkError}`);
  return normalized;
}

/** Valida, normaliza y parsea un respaldo. Lanza Error con mensaje humano si no es válido. */
export function parseBackup(json: string): BackupFile {
  if (new TextEncoder().encode(json).byteLength > MAX_BACKUP_FILE_BYTES) {
    throw new Error('El respaldo es demasiado grande. El tamaño máximo permitido es 25 MB.');
  }
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
    await dbWriteTransaction(
      [
        'settings',
        'clients',
        'quotes',
        'appointments',
        'stoneLots',
        'suppliers',
        'buyers',
        'stockJewels',
        'materialPartners',
        'materialLots',
        'expenses'
      ],
      (getStore) => {
        const settingsStore = getStore('settings');
        const clientsStore = getStore('clients');
        const quotesStore = getStore('quotes');
        const appointmentsStore = getStore('appointments');
        const stoneLotsStore = getStore('stoneLots');
        const suppliersStore = getStore('suppliers');
        const buyersStore = getStore('buyers');
        const stockJewelsStore = getStore('stockJewels');
        const materialPartnersStore = getStore('materialPartners');
        const materialLotsStore = getStore('materialLots');
        const expensesStore = getStore('expenses');

        settingsStore.clear();
        clientsStore.clear();
        quotesStore.clear();
        appointmentsStore.clear();
        stoneLotsStore.clear();
        suppliersStore.clear();
        buyersStore.clear();
        stockJewelsStore.clear();
        materialPartnersStore.clear();
        materialLotsStore.clear();
        expensesStore.clear();

        if (normalized.settings) {
          settingsStore.put({ id: SETTINGS_KEY, ...normalized.settings });
        }
        for (const client of normalized.clients) {
          clientsStore.put(client);
        }
        for (const quote of normalized.quotes) {
          quotesStore.put(quote);
        }
        for (const appointment of normalized.appointments) {
          appointmentsStore.put(appointment);
        }
        for (const lot of normalized.stoneLots) {
          stoneLotsStore.put(lot);
        }
        for (const supplier of normalized.suppliers) {
          suppliersStore.put(supplier);
        }
        for (const buyer of normalized.buyers) {
          buyersStore.put(buyer);
        }
        for (const jewel of normalized.stockJewels) {
          stockJewelsStore.put(jewel);
        }
        for (const partner of normalized.materialPartners) {
          materialPartnersStore.put(partner);
        }
        for (const lot of normalized.materialLots) {
          materialLotsStore.put(lot);
        }
        for (const expense of normalized.expenses) {
          expensesStore.put(expense);
        }
      }
    );
  } catch {
    throw new Error(
      'No se pudo restaurar el respaldo. Tus datos anteriores se conservaron.'
    );
  }
}
