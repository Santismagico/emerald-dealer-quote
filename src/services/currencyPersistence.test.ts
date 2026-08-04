import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory as FakeIDBFactory } from 'fake-indexeddb';
import { formatOperationMoney } from './currency';
import { normalizeExpense, normalizeStockJewel, normalizeStoneLot } from './schema';

let storage: typeof import('./storage');

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new FakeIDBFactory());
  storage = await import('./storage');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function storedBytes(): Promise<string> {
  return JSON.stringify({
    settings: await storage.loadSettings(),
    stoneLots: await storage.listStoneLots(),
    stockJewels: await storage.listStockJewels(),
    expenses: await storage.listExpenses()
  });
}

describe('el cambio visual de moneda no escribe datos', () => {
  it('deja el almacenamiento byte a byte igual al pasar COP → USD → COP', async () => {
    const stoneLot = normalizeStoneLot({
      id: 'lot-currency-view',
      name: 'Lote moneda',
      purchaseDate: '2026-08-03',
      carats: 1,
      quantity: 1,
      sales: [{
        id: 'sale-currency-view',
        date: '2026-08-03',
        quantity: 1,
        carats: 1,
        valueCop: 4_200_000,
        productType: 'Esmeralda tallada',
        usdRate: 4_200,
        payments: []
      }]
    });
    const stockJewel = normalizeStockJewel({
      id: 'jewel-currency-view',
      name: 'Anillo moneda',
      acquiredDate: '2026-08-03',
      priceCop: 2_100_000,
      sale: {
        id: 'jewel-sale-currency-view',
        date: '2026-08-03',
        priceCop: 2_100_000,
        productType: 'Joya con piedra natural',
        usdRate: 4_200
      }
    });
    const expense = normalizeExpense({
      id: 'expense-currency-view',
      date: '2026-08-03',
      concept: 'Feria',
      category: 'Publicidad',
      amountCop: 420_000,
      usdRate: 4_200,
      method: 'Transferencia',
      paidBy: 'Santiago',
      partnerId: null,
      partnerName: '',
      myPercent: 100,
      createdAt: '2026-08-03T10:00:00.000Z',
      updatedAt: '2026-08-03T10:00:00.000Z'
    });

    await storage.saveStoneLot(stoneLot);
    await storage.saveStockJewel(stockJewel);
    await storage.saveExpense(expense);
    const before = await storedBytes();

    expect(formatOperationMoney(stoneLot.sales[0].valueCop, 4_200, 'COP')).not.toBe('');
    expect(formatOperationMoney(stoneLot.sales[0].valueCop, 4_200, 'USD')).not.toBe('');
    expect(formatOperationMoney(stockJewel.sale!.priceCop, 4_200, 'USD')).not.toBe('');
    expect(formatOperationMoney(expense.amountCop, 4_200, 'USD')).not.toBe('');
    expect(formatOperationMoney(expense.amountCop, 4_200, 'COP')).not.toBe('');

    expect(await storedBytes()).toBe(before);
  });
});
