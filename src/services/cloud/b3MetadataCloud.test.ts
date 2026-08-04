import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory as FakeIDBFactory } from 'fake-indexeddb';
import type {
  Expense,
  Settings,
  StockJewel,
  StoneLot
} from '../../types';
import type { CloudOutboxOperation, CloudTable } from './outbox';

let api: typeof import('./api');
let backupService: typeof import('../backup');
let importer: typeof import('./importer');
let storage: typeof import('../storage');

function fakeOutbox() {
  const enqueued: Array<{ table: CloudTable; entityId: string; data: unknown }> = [];
  return {
    enqueued,
    outbox: {
      enqueue: async (operation: {
        table: CloudTable;
        entityId: string;
        data?: unknown;
      }) => {
        enqueued.push({
          table: operation.table,
          entityId: operation.entityId,
          data: operation.data
        });
        return operation as unknown as CloudOutboxOperation;
      },
      flush: async () => ({ processed: 0, pending: 0 }),
      list: async () => [],
      status: async () => ({ pending: 0, held: 0, operations: [] }),
      retryHeld: async () => ({ processed: 0, pending: 0 })
    }
  };
}

const noopSync = { pullTable: async () => {}, pullAll: async () => {} };
const noopRemote = {
  list: async () => [],
  execute: async () => {},
  nextQuoteNumber: async () => 'ED-2026-0001'
};

function stoneLot(usdRate: number | null = 4100): StoneLot {
  const timestamp = '2026-08-03T10:00:00.000Z';
  return {
    id: 'stone-b3',
    name: 'Lote B3',
    stoneType: 'Esmeralda',
    description: '',
    purchaseDate: '2026-08-03',
    supplier: '',
    supplierId: null,
    carats: 2,
    quantity: 2,
    purchaseValueCop: 1000000,
    partnerId: null,
    partnerName: '',
    myPercent: 100,
    onCredit: false,
    supplierPayments: [],
    cuttingBatches: [],
    notes: '',
    sales: [{
      id: 'sale-b3',
      date: '2026-08-03',
      buyer: 'Comprador',
      buyerId: null,
      carats: 1,
      quantity: 1,
      origin: 'bruto',
      valueCop: 2000000,
      productType: usdRate === null ? '' : 'Esmeralda tallada',
      usdRate,
      onCredit: false,
      dueDate: '',
      payments: [],
      method: 'Transferencia',
      receivedBy: 'Santiago',
      notes: ''
    }],
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function stockJewel(usdRate: number | null = 4100): StockJewel {
  const timestamp = '2026-08-03T10:00:00.000Z';
  return {
    id: 'stock-b3',
    name: 'Anillo B3',
    pieceType: 'anillo',
    material: 'Oro',
    photo: '',
    acquiredDate: '2026-08-03',
    costCop: 1000000,
    priceCop: 2000000,
    status: 'disponible',
    notes: '',
    sale: {
      id: 'stock-sale-b3',
      date: '2026-08-03',
      buyer: 'Comprador',
      buyerId: null,
      priceCop: 2000000,
      productType: usdRate === null ? '' : 'Joya con piedra natural',
      usdRate,
      method: 'Efectivo',
      receivedBy: 'Santiago',
      notes: ''
    },
    collectionId: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function expense(usdRate: number | null = 4100): Expense {
  const timestamp = '2026-08-03T10:00:00.000Z';
  return {
    id: 'expense-b3',
    date: '2026-08-03',
    concept: 'Feria',
    category: 'Publicidad',
    amountCop: 300000,
    usdRate,
    method: 'Transferencia',
    paidBy: 'Santiago',
    partnerId: null,
    partnerName: '',
    myPercent: 100,
    notes: '',
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new FakeIDBFactory());
  storage = await import('../storage');
  backupService = await import('../backup');
  api = await import('./api');
  importer = await import('./importer');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('metadatos B3 en la nube', () => {
  it('importa un respaldo v8 histórico sin inventar tipo ni tasa', async () => {
    const raw = {
      app: 'emerald-dealer-quote',
      version: 8,
      exportedAt: '2026-08-03T10:00:00.000Z',
      settings: null,
      clients: [],
      quotes: [],
      appointments: [],
      stoneLots: [{
        ...stoneLot(),
        sales: [{
          ...stoneLot().sales[0],
          productType: undefined,
          usdRate: undefined,
          payments: []
        }]
      }],
      suppliers: [],
      buyers: [],
      stockJewels: [{
        ...stockJewel(),
        sale: {
          ...stockJewel().sale,
          productType: undefined,
          usdRate: undefined
        }
      }],
      materialPartners: [],
      materialLots: [],
      expenses: [{ ...expense(), usdRate: undefined }]
    };
    const parsed = backupService.parseBackup(JSON.stringify(raw));
    const { enqueued, outbox } = fakeOutbox();
    const source = api.createCloudDataSource({ remote: noopRemote, outbox, sync: noopSync });

    await importer.importToCloud(parsed, { writer: source });

    expect(parsed.stoneLots[0].sales[0]).toMatchObject({
      productType: '',
      usdRate: null
    });
    expect(parsed.stockJewels[0].sale).toMatchObject({ productType: '', usdRate: null });
    expect(parsed.expenses[0].usdRate).toBeNull();
    expect(enqueued.map((operation) => operation.table)).toEqual([
      'expenses',
      'stone_lots',
      'stock_jewels'
    ]);
  });

  it.each([
    ['venta de piedras', 'stone_lots', () => stoneLot(999), 'saveStoneLot'],
    ['venta de joya', 'stock_jewels', () => stockJewel(20001), 'saveStockJewel'],
    ['gasto', 'expenses', () => expense(999), 'saveExpense']
  ] as const)('rechaza una tasa inválida en %s antes de encolarla', async (
    _label,
    table,
    makeValue,
    method
  ) => {
    const { enqueued, outbox } = fakeOutbox();
    const source = api.createCloudDataSource({ remote: noopRemote, outbox, sync: noopSync });

    await expect(
      (source[method] as (value: never) => Promise<void>)(makeValue() as never)
    ).rejects.toThrow(/tasa USD\/COP/);
    expect(enqueued.filter((operation) => operation.table === table)).toEqual([]);
  });

  it('no permite cambiar la tasa de operaciones ya guardadas', async () => {
    await storage.saveStoneLot(stoneLot(4100));
    await storage.saveStockJewel(stockJewel(4100));
    await storage.saveExpense(expense(4100));
    const { enqueued, outbox } = fakeOutbox();
    const source = api.createCloudDataSource({ remote: noopRemote, outbox, sync: noopSync });

    await expect(source.saveStoneLot(stoneLot(4200))).rejects.toThrow(/no se puede cambiar/);
    await expect(source.saveStockJewel(stockJewel(4200))).rejects.toThrow(/no se puede cambiar/);
    await expect(source.saveExpense(expense(4200))).rejects.toThrow(/no se puede cambiar/);
    expect(enqueued).toEqual([]);
  });

  it('rechaza ajustes con tasa o tipos de producto corruptos', async () => {
    const { enqueued, outbox } = fakeOutbox();
    const source = api.createCloudDataSource({ remote: noopRemote, outbox, sync: noopSync });
    const settings = storage.defaultSettings();

    await expect(source.saveSettings({
      ...settings,
      lastKnownUsdRate: 999
    })).rejects.toThrow(/tasa USD\/COP/);
    await expect(source.saveSettings({
      ...settings,
      productTypes: [{ name: '', active: true }]
    } as Settings)).rejects.toThrow(/sin nombre/);
    await expect(source.saveSettings({
      ...settings,
      productTypesUpdatedAt: 'fecha imposible'
    })).rejects.toThrow(/fecha del catálogo/);
    expect(enqueued).toEqual([]);
  });
});
