// Estado global de la app: settings, clientes y cotizaciones,
// sincronizado con IndexedDB a través de services/storage.

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import type { Settings, Client, Quote, Appointment, StoneLot, Supplier } from './types';
import { defaultSettings } from './services/storage';
import { localDataSource, type StoreDataSource } from './services/dataSource';
import { cloudDataSource } from './services/cloud/api';
import { cloudEnabled } from './services/cloud/config';
import { sortAgenda } from './services/agenda';
import { sortStoneLots } from './services/stones';
import { fetchGoldPriceCOP, type GoldPriceBreakdown } from './services/goldPrice';
import { downloadBackupFile } from './services/backup';
import {
  createBackupExportController,
  type BackupExportController
} from './services/backupReminder';

interface AppStore {
  ready: boolean;
  settings: Settings;
  clients: Client[];
  quotes: Quote[];
  appointments: Appointment[];
  stoneLots: StoneLot[];
  suppliers: Supplier[];
  toast: string | null;
  backupExporting: boolean;
  showToast: (message: string) => void;
  updateSettings: (settings: Settings, goldPriceWasEdited: boolean) => Promise<Settings>;
  exportBackup: () => Promise<boolean>;
  snoozeBackupReminder: (snoozedUntil: string) => Promise<void>;
  ensureBackupReminderFirstDataAt: (startedAt: string) => Promise<void>;
  upsertClient: (client: Client) => Promise<void>;
  removeClient: (id: string) => Promise<void>;
  upsertQuote: (quote: Quote) => Promise<void>;
  removeQuote: (id: string) => Promise<void>;
  upsertAppointment: (appointment: Appointment) => Promise<void>;
  removeAppointment: (id: string) => Promise<void>;
  upsertStoneLot: (lot: StoneLot) => Promise<void>;
  removeStoneLot: (id: string) => Promise<void>;
  upsertSupplier: (supplier: Supplier) => Promise<void>;
  removeSupplier: (id: string) => Promise<void>;
  nextQuoteNumber: () => Promise<string>;
  reloadAll: () => Promise<void>;
  /** Consulta el precio internacional del oro del día y actualiza el precio interno. */
  refreshGoldPrice: () => Promise<GoldPriceBreakdown>;
}

const StoreContext = createContext<AppStore | null>(null);

export function selectStoreDataSource(options: {
  hasSession: boolean;
  cloudConfigured?: boolean;
  local?: StoreDataSource;
  cloud?: StoreDataSource;
}): StoreDataSource {
  const local = options.local ?? localDataSource;
  const cloud = options.cloud ?? cloudDataSource;
  const configured = options.cloudConfigured ?? cloudEnabled();
  return configured && options.hasSession ? cloud : local;
}

// N2 conserva el modo local. N3 conectará aquí la sesión autenticada.
const dataSource = selectStoreDataSource({ hasSession: false });

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings());
  const [clients, setClients] = useState<Client[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [stoneLots, setStoneLots] = useState<StoneLot[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [backupExporting, setBackupExporting] = useState(false);

  const reloadAll = useCallback(async () => {
    const [s, c, q, a, sm, sp] = await Promise.all([
      dataSource.loadSettings(),
      dataSource.listClients(),
      dataSource.listQuotes(),
      dataSource.listAppointments(),
      dataSource.listStoneLots(),
      dataSource.listSuppliers()
    ]);
    setSettings(s);
    setClients(c);
    setQuotes(q);
    setAppointments(a);
    setStoneLots(sm);
    setSuppliers(sp);
  }, []);

  const refreshGoldPrice = useCallback(async () => {
    const markup = (await dataSource.loadSettings()).goldMarkupPerGram;
    const fetched = await fetchGoldPriceCOP(markup);
    const { settings: next, info } = await dataSource.saveFetchedGoldPrice(fetched);
    setSettings(next);
    return info;
  }, []);

  useEffect(() => {
    reloadAll()
      .catch(() => {
        // Si IndexedDB falla (modo privado extremo), la app sigue con datos en memoria.
      })
      .finally(() => setReady(true))
      // Después de cargar, actualiza el precio del oro del día (si hay internet).
      // Encadenado para no competir con la carga inicial de settings.
      .then(() => refreshGoldPrice())
      .catch(() => {});
  }, [reloadAll, refreshGoldPrice]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2500);
  }, []);

  const updateSettings = useCallback(async (next: Settings, goldPriceWasEdited: boolean) => {
    const saved = await dataSource.saveEditableSettings(next, goldPriceWasEdited);
    setSettings(saved);
    return saved;
  }, []);

  const recordBackupExported = useCallback(async (exportedAt: string) => {
    const next = await dataSource.recordBackupExported(exportedAt);
    setSettings(next);
  }, []);

  const backupExportControllerRef = useRef<BackupExportController | null>(null);
  if (!backupExportControllerRef.current) {
    backupExportControllerRef.current = createBackupExportController({
      download: downloadBackupFile,
      recordExported: recordBackupExported,
      now: () => new Date(),
      onExportingChange: setBackupExporting
    });
  }

  const exportBackup = useCallback(() => backupExportControllerRef.current!.start(), []);

  const snoozeBackupReminder = useCallback(async (snoozedUntil: string) => {
    const next = await dataSource.snoozeBackupReminder(snoozedUntil);
    setSettings(next);
  }, []);

  const ensureBackupReminderFirstDataAt = useCallback(async (startedAt: string) => {
    const next = await dataSource.ensureBackupReminderFirstDataAt(startedAt);
    setSettings(next);
  }, []);

  const upsertClient = useCallback(async (client: Client) => {
    await dataSource.saveClient(client);
    setClients(await dataSource.listClients());
  }, []);

  const removeClient = useCallback(async (id: string) => {
    await dataSource.deleteClient(id);
    setClients(await dataSource.listClients());
  }, []);

  const upsertQuote = useCallback(async (quote: Quote) => {
    // Se parcha el estado localmente: recargar TODAS las cotizaciones (con sus
    // fotos) desde IndexedDB en cada guardado causaba lag al teclear en
    // producción/abonos (hallazgo de eficiencia de la auditoría).
    setQuotes((prev) =>
      [quote, ...prev.filter((q) => q.id !== quote.id)].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt)
      )
    );
    await dataSource.saveQuote(quote);
  }, []);

  const removeQuote = useCallback(async (id: string) => {
    setQuotes((prev) => prev.filter((q) => q.id !== id));
    await dataSource.deleteQuote(id);
  }, []);

  const upsertAppointment = useCallback(async (appointment: Appointment) => {
    // Mismo patrón optimista que las cotizaciones: la interfaz responde ya
    // y la escritura local se confirma detrás.
    setAppointments((prev) => sortAgenda([appointment, ...prev.filter((a) => a.id !== appointment.id)]));
    await dataSource.saveAppointment(appointment);
  }, []);

  const removeAppointment = useCallback(async (id: string) => {
    setAppointments((prev) => prev.filter((a) => a.id !== id));
    await dataSource.deleteAppointment(id);
  }, []);

  const upsertStoneLot = useCallback(async (lot: StoneLot) => {
    // Mismo patrón optimista que las cotizaciones: la interfaz responde ya
    // y la escritura local se confirma detrás.
    setStoneLots((prev) => sortStoneLots([lot, ...prev.filter((l) => l.id !== lot.id)]));
    await dataSource.saveStoneLot(lot);
  }, []);

  const removeStoneLot = useCallback(async (id: string) => {
    setStoneLots((prev) => prev.filter((l) => l.id !== id));
    await dataSource.deleteStoneLot(id);
  }, []);

  const upsertSupplier = useCallback(async (supplier: Supplier) => {
    await dataSource.saveSupplier(supplier);
    const [nextSuppliers, nextStoneLots] = await Promise.all([
      dataSource.listSuppliers(),
      dataSource.listStoneLots()
    ]);
    setSuppliers(nextSuppliers);
    setStoneLots(nextStoneLots);
  }, []);

  const removeSupplier = useCallback(async (id: string) => {
    await dataSource.deleteSupplier(id);
    const [nextSuppliers, nextStoneLots] = await Promise.all([
      dataSource.listSuppliers(),
      dataSource.listStoneLots()
    ]);
    setSuppliers(nextSuppliers);
    setStoneLots(nextStoneLots);
  }, []);

  const nextQuoteNumber = useCallback(async () => {
    const number = await dataSource.nextQuoteNumber();
    setSettings(await dataSource.loadSettings());
    return number;
  }, []);

  return (
    <StoreContext.Provider
      value={{
        ready,
        settings,
        clients,
        quotes,
        appointments,
        stoneLots,
        suppliers,
        toast,
        backupExporting,
        showToast,
        updateSettings,
        exportBackup,
        snoozeBackupReminder,
        ensureBackupReminderFirstDataAt,
        upsertClient,
        removeClient,
        upsertQuote,
        removeQuote,
        upsertAppointment,
        removeAppointment,
        upsertStoneLot,
        removeStoneLot,
        upsertSupplier,
        removeSupplier,
        nextQuoteNumber,
        reloadAll,
        refreshGoldPrice
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): AppStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore debe usarse dentro de StoreProvider');
  return store;
}
