import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory as FakeIDBFactory } from 'fake-indexeddb';
import type { BackupFile, Expense, MaterialPartner } from '../types';
import { sampleClient, sampleSettings } from '../test/fixtures';

let storage: typeof import('./storage');
let backupService: typeof import('./backup');

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new FakeIDBFactory());
  storage = await import('./storage');
  backupService = await import('./backup');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'g-1',
    date: '2026-08-03',
    concept: 'Publicidad feria',
    category: 'Publicidad',
    amountCop: 600000,
    usdRate: null,
    method: 'Transferencia',
    paidBy: 'Santiago',
    partnerId: null,
    partnerName: '',
    myPercent: 100,
    notes: '',
    createdAt: '2026-08-03T10:00:00.000Z',
    updatedAt: '2026-08-03T10:00:00.000Z',
    ...overrides
  };
}

function partner(overrides: Partial<MaterialPartner> = {}): MaterialPartner {
  return {
    id: 'soc-1',
    name: 'Socio Emerald',
    phone: '',
    city: '',
    notes: '',
    createdAt: '2026-08-03T09:00:00.000Z',
    ...overrides
  };
}

async function seedV7Database(): Promise<void> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('emerald-dealer-quote', 7);
    request.onupgradeneeded = () => {
      for (const store of [
        'settings', 'clients', 'quotes', 'appointments', 'stoneLots', 'suppliers',
        'cloudOutbox', 'buyers', 'stockJewels', 'materialPartners', 'materialLots'
      ]) request.result.createObjectStore(store, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(['settings', 'clients'], 'readwrite');
    tx.objectStore('settings').put({ id: 'main', ...sampleSettings({ quoteCounter: 44 }) });
    tx.objectStore('clients').put(sampleClient({ id: 'c-v7', name: 'Cliente v7' }));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  database.close();
}

describe('migración real v7 → v8', () => {
  it('conserva los datos anteriores y crea gastos vacío', async () => {
    await seedV7Database();
    const [settings, clients, expenses] = await Promise.all([
      storage.loadSettings(), storage.listClients(), storage.listExpenses()
    ]);
    expect(settings.quoteCounter).toBe(44);
    expect(clients.map((client) => client.id)).toEqual(['c-v7']);
    expect(expenses).toEqual([]);
  });

  it('permite crear, editar, ordenar y borrar un gasto tras migrar', async () => {
    await seedV7Database();
    await storage.saveExpense(expense({ id: 'a', date: '2026-08-01' }));
    await storage.saveExpense(expense({ id: 'b', date: '2026-08-03' }));
    await storage.saveExpense(expense({ id: 'a', date: '2026-08-04', method: 'Efectivo' }));
    expect((await storage.listExpenses()).map((item) => item.id)).toEqual(['a', 'b']);
    expect((await storage.listExpenses())[0].method).toBe('Efectivo');
    await storage.deleteExpense('b');
    expect((await storage.listExpenses()).map((item) => item.id)).toEqual(['a']);
  });

  it('rechaza el porcentaje original inválido antes de normalizar', async () => {
    await expect(
      storage.saveExpense(
        expense({ partnerId: 'soc-1', partnerName: 'Socio', myPercent: 101 })
      )
    ).rejects.toThrow(/porcentaje/);
    expect(await storage.listExpenses()).toEqual([]);
  });
});

describe('historial de sociedad en gastos', () => {
  it('renombrar y borrar el socio conserva nombre y reparto', async () => {
    await storage.saveMaterialPartner(partner());
    await storage.saveExpense(
      expense({ partnerId: 'soc-1', partnerName: 'Socio Emerald', myPercent: 60 })
    );
    await storage.saveMaterialPartner(partner({ name: 'Socio Renombrado' }));
    expect((await storage.listExpenses())[0]).toMatchObject({
      partnerId: 'soc-1', partnerName: 'Socio Renombrado', myPercent: 60
    });
    await storage.deleteMaterialPartner('soc-1');
    expect((await storage.listExpenses())[0]).toMatchObject({
      partnerId: null, partnerName: 'Socio Renombrado', myPercent: 60
    });
  });
});

describe('respaldo v8 de gastos', () => {
  it('exporta y restaura gastos completos', async () => {
    await storage.saveExpense(expense());
    const exported = await backupService.exportBackup();
    expect(exported.version).toBe(8);
    const parsed = backupService.parseBackup(backupService.serializeBackup(exported));
    expect(parsed.expenses).toEqual([expense()]);
  });

  it('acepta todas las versiones v1–v7 con gastos vacíos', () => {
    for (let version = 1; version <= 7; version += 1) {
      const parsed = backupService.parseBackup(JSON.stringify({
        app: 'emerald-dealer-quote', version, exportedAt: '', settings: null, clients: [], quotes: []
      }));
      expect(parsed.version).toBe(8);
      expect(parsed.expenses).toEqual([]);
    }
  });

  it('rechaza gastos duplicados o porcentajes fuera de 0..100', () => {
    const base: BackupFile = {
      app: 'emerald-dealer-quote', version: 8, exportedAt: '', settings: null,
      clients: [], quotes: [], appointments: [], stoneLots: [], suppliers: [], buyers: [],
      stockJewels: [], materialPartners: [], materialLots: [], expenses: [expense()]
    };
    expect(() => backupService.parseBackup(JSON.stringify({
      ...base, expenses: [expense(), expense()]
    }))).toThrow(/duplicados/);
    expect(() => backupService.parseBackup(JSON.stringify({
      ...base,
      expenses: [expense({ partnerId: 'soc-1', partnerName: 'Socio', myPercent: 101 })]
    }))).toThrow(/porcentajes/);
  });
});
