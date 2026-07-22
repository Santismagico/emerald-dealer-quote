import type {
  Appointment,
  Buyer,
  Client,
  Quote,
  Settings,
  StockJewel,
  StoneLot,
  Supplier
} from '../types';
import type { GoldPriceBreakdown } from './goldPrice';
import * as storage from './storage';
import type { OutboxStatus } from './cloud/outbox';

export interface StoreDataSource {
  loadSettings: () => Promise<Settings>;
  saveSettings: (settings: Settings) => Promise<void>;
  updateSettingsAtomically: (update: (current: Settings) => Settings) => Promise<Settings>;
  saveEditableSettings: (settings: Settings, goldPriceWasEdited: boolean) => Promise<Settings>;
  saveFetchedGoldPrice: (fetched: GoldPriceBreakdown) => Promise<{ settings: Settings; info: GoldPriceBreakdown }>;
  recordBackupExported: (exportedAt: string) => Promise<Settings>;
  snoozeBackupReminder: (snoozedUntil: string) => Promise<Settings>;
  ensureBackupReminderFirstDataAt: (startedAt: string) => Promise<Settings>;
  listClients: () => Promise<Client[]>;
  saveClient: (client: Client) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  listQuotes: () => Promise<Quote[]>;
  saveQuote: (quote: Quote) => Promise<void>;
  deleteQuote: (id: string) => Promise<void>;
  listAppointments: () => Promise<Appointment[]>;
  saveAppointment: (appointment: Appointment) => Promise<void>;
  deleteAppointment: (id: string) => Promise<void>;
  listStoneLots: () => Promise<StoneLot[]>;
  saveStoneLot: (lot: StoneLot) => Promise<void>;
  deleteStoneLot: (id: string) => Promise<void>;
  listSuppliers: () => Promise<Supplier[]>;
  saveSupplier: (supplier: Supplier) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
  listBuyers: () => Promise<Buyer[]>;
  saveBuyer: (buyer: Buyer) => Promise<void>;
  deleteBuyer: (id: string) => Promise<void>;
  listStockJewels: () => Promise<StockJewel[]>;
  saveStockJewel: (jewel: StockJewel) => Promise<void>;
  deleteStockJewel: (id: string) => Promise<void>;
  nextQuoteNumber: () => Promise<string>;
  cloudSyncStatus?: () => Promise<OutboxStatus>;
  retryCloudChanges?: (id?: string) => Promise<void>;
}

export const localDataSource: StoreDataSource = storage;
