// Estado global de la app: settings, clientes y cotizaciones,
// sincronizado con IndexedDB a través de services/storage.

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Settings, Client, Quote } from './types';
import * as storage from './services/storage';
import { fetchGoldPriceCOP, type GoldPriceBreakdown } from './services/goldPrice';

interface AppStore {
  ready: boolean;
  settings: Settings;
  clients: Client[];
  quotes: Quote[];
  toast: string | null;
  showToast: (message: string) => void;
  updateSettings: (settings: Settings) => Promise<void>;
  upsertClient: (client: Client) => Promise<void>;
  removeClient: (id: string) => Promise<void>;
  upsertQuote: (quote: Quote) => Promise<void>;
  removeQuote: (id: string) => Promise<void>;
  nextQuoteNumber: () => Promise<string>;
  reloadAll: () => Promise<void>;
  /** Consulta el precio internacional del oro del día y actualiza el precio interno. */
  refreshGoldPrice: () => Promise<GoldPriceBreakdown>;
}

const StoreContext = createContext<AppStore | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(storage.defaultSettings());
  const [clients, setClients] = useState<Client[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const reloadAll = useCallback(async () => {
    const [s, c, q] = await Promise.all([
      storage.loadSettings(),
      storage.listClients(),
      storage.listQuotes()
    ]);
    setSettings(s);
    setClients(c);
    setQuotes(q);
  }, []);

  const refreshGoldPrice = useCallback(async () => {
    const current = await storage.loadSettings();
    const info = await fetchGoldPriceCOP(current.goldMarkupPerGram);
    const next: Settings = {
      ...current,
      goldPricePerGram: info.totalCopPerGram,
      goldPriceUpdatedAt: info.fetchedAt
    };
    await storage.saveSettings(next);
    setSettings(next);
    return info;
  }, []);

  useEffect(() => {
    reloadAll()
      .catch(() => {
        // Si IndexedDB falla (modo privado extremo), la app sigue con datos en memoria.
      })
      .finally(() => setReady(true));
    // Al abrir la app con internet, actualiza el precio del oro del día.
    // Sin conexión, se conserva el último precio guardado.
    refreshGoldPrice().catch(() => {});
  }, [reloadAll, refreshGoldPrice]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2500);
  }, []);

  const updateSettings = useCallback(async (next: Settings) => {
    await storage.saveSettings(next);
    setSettings(next);
  }, []);

  const upsertClient = useCallback(async (client: Client) => {
    await storage.saveClient(client);
    setClients(await storage.listClients());
  }, []);

  const removeClient = useCallback(async (id: string) => {
    await storage.deleteClient(id);
    setClients(await storage.listClients());
  }, []);

  const upsertQuote = useCallback(async (quote: Quote) => {
    await storage.saveQuote(quote);
    setQuotes(await storage.listQuotes());
  }, []);

  const removeQuote = useCallback(async (id: string) => {
    await storage.deleteQuote(id);
    setQuotes(await storage.listQuotes());
  }, []);

  const nextQuoteNumber = useCallback(async () => {
    const number = await storage.nextQuoteNumber();
    setSettings(await storage.loadSettings());
    return number;
  }, []);

  return (
    <StoreContext.Provider
      value={{
        ready,
        settings,
        clients,
        quotes,
        toast,
        showToast,
        updateSettings,
        upsertClient,
        removeClient,
        upsertQuote,
        removeQuote,
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
