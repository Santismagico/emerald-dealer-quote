// Exportación e importación de todos los datos a/desde JSON.
// La importación NORMALIZA todo (services/schema.ts): un respaldo de una versión
// anterior, editado a mano o corrupto nunca puede dejar datos malformados en la
// base local (hallazgo de la auditoría de seguridad 2026-07-09).

import type { Appointment, BackupFile, Client, Quote, StoneLot, Supplier } from '../types';
import { dbWriteTransaction } from './db';
import {
  loadSettings,
  listClients,
  listQuotes,
  listAppointments,
  listStoneLots,
  listSuppliers,
  SETTINGS_KEY
} from './storage';
import {
  normalizeSettings,
  normalizeQuote,
  normalizeClient,
  normalizeAppointment,
  normalizeStoneLot,
  normalizeSupplier
} from './schema';

/**
 * Versión actual del formato de respaldo. Se aceptan al importar: 1 a 5.
 * v3 agregó las citas; v4 los lotes de piedras; v5 los proveedores. Los
 * respaldos más viejos se importan con las listas nuevas vacías y nunca
 * fallan por no traerlas.
 */
export const BACKUP_VERSION = 5;
const ACCEPTED_VERSIONS = [1, 2, 3, 4, 5];

export async function exportBackup(): Promise<BackupFile> {
  const [settings, clients, quotes, appointments, stoneLots, suppliers] = await Promise.all([
    loadSettings(),
    listClients(),
    listQuotes(),
    listAppointments(),
    listStoneLots(),
    listSuppliers()
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
    suppliers
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
  return {
    app: 'emerald-dealer-quote',
    version: BACKUP_VERSION,
    exportedAt: typeof b.exportedAt === 'string' ? b.exportedAt : '',
    // Normalización total: tipos corruptos se corrigen, imágenes externas se descartan.
    settings: rawSettings === null ? null : normalizeSettings(rawSettings),
    clients: b.clients.map(normalizeClient),
    quotes: b.quotes.map(normalizeQuote),
    appointments: rawAppointments.map(normalizeAppointment),
    stoneLots: rawStoneLots.map(normalizeStoneLot),
    suppliers: rawSuppliers.map(normalizeSupplier)
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
    await dbWriteTransaction(
      ['settings', 'clients', 'quotes', 'appointments', 'stoneLots', 'suppliers'],
      (getStore) => {
        const settingsStore = getStore('settings');
        const clientsStore = getStore('clients');
        const quotesStore = getStore('quotes');
        const appointmentsStore = getStore('appointments');
        const stoneLotsStore = getStore('stoneLots');
        const suppliersStore = getStore('suppliers');

        settingsStore.clear();
        clientsStore.clear();
        quotesStore.clear();
        appointmentsStore.clear();
        stoneLotsStore.clear();
        suppliersStore.clear();

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
      }
    );
  } catch {
    throw new Error(
      'No se pudo restaurar el respaldo. Tus datos anteriores se conservaron.'
    );
  }
}
