// Ampliación de inventario (D-042/D-043/D-044): migración IndexedDB v5→v6
// (almacenes de compradores y joyas en stock) y respaldo v6. Se prueba contra
// una base v5 AUTÉNTICA —la de la candidata de nube— para comprobar que al
// abrir la app nueva aparecen los almacenes nuevos SIN perder un solo dato.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory as FakeIDBFactory } from 'fake-indexeddb';
import type { BackupFile, Buyer, StockJewel, StoneLot, Supplier } from '../types';
import { sampleClient, sampleQuote, sampleSettings } from '../test/fixtures';

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

function comprador(overrides: Partial<Buyer> = {}): Buyer {
  return {
    id: 'buy-1',
    name: 'Joyería Ejemplo',
    phone: '3000000000',
    city: 'Ciudad Ejemplo',
    notes: '',
    createdAt: '2026-07-21T09:00:00.000Z',
    ...overrides
  };
}

function joya(overrides: Partial<StockJewel> = {}): StockJewel {
  return {
    id: 'j-1',
    name: 'Anillo Ejemplo',
    pieceType: 'anillo',
    material: 'Oro',
    photo: '',
    acquiredDate: '2026-07-10',
    costCop: 3000000,
    priceCop: 5000000,
    status: 'disponible',
    notes: '',
    sale: null,
    createdAt: '2026-07-10T09:00:00.000Z',
    updatedAt: '2026-07-10T09:00:00.000Z',
    ...overrides
  };
}

/** Lote con una venta a crédito vinculada a un comprador registrado. */
function loteConCredito(overrides: Partial<StoneLot> = {}): StoneLot {
  return {
    id: 'lot-credito',
    name: 'Lote con crédito',
    stoneType: 'Esmeralda',
    description: '',
    purchaseDate: '2026-07-10',
    supplier: '',
    supplierId: null,
    carats: 5,
    quantity: 5,
    purchaseValueCop: 4000000,
    onCredit: false,
    supplierPayments: [],
    notes: '',
    sales: [
      {
        id: 'sale-credito',
        date: '2026-07-15',
        buyer: 'Joyería Ejemplo',
        buyerId: 'buy-1',
        carats: 1,
        quantity: 1,
        valueCop: 3000000,
        onCredit: true,
        dueDate: '2026-08-15',
        payments: [{ id: 'ab-1', date: '2026-07-20', amount: 1000000, notes: '' }],
        notes: ''
      }
    ],
    createdAt: '2026-07-10T09:00:00.000Z',
    updatedAt: '2026-07-10T09:00:00.000Z',
    ...overrides
  };
}

/** Crea a mano una base v5 real (la de la candidata de nube) con datos. */
async function seedV5Database(): Promise<void> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('emerald-dealer-quote', 5);
    request.onupgradeneeded = () => {
      const d = request.result;
      for (const store of [
        'settings',
        'clients',
        'quotes',
        'appointments',
        'stoneLots',
        'suppliers',
        'cloudOutbox'
      ]) {
        d.createObjectStore(store, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(
      ['settings', 'clients', 'quotes', 'stoneLots', 'suppliers', 'cloudOutbox'],
      'readwrite'
    );
    tx.objectStore('settings').put({ id: 'main', ...sampleSettings({ quoteCounter: 21 }) });
    tx.objectStore('clients').put(sampleClient({ id: 'c-v5', name: 'Cliente de la v5' }));
    tx.objectStore('quotes').put(sampleQuote({ id: 'q-v5', number: 'ED-2026-0021' }));
    tx.objectStore('suppliers').put({
      id: 'sup-v5',
      name: 'Proveedor de la v5',
      phone: '',
      city: '',
      notes: '',
      createdAt: '2026-07-18T09:00:00.000Z'
    } satisfies Supplier);
    // Una venta VIEJA, sin ninguna marca de crédito: es el caso real de los
    // teléfonos que ya tienen la app instalada.
    tx.objectStore('stoneLots').put({
      id: 'lot-v5',
      name: 'Lote de la v5',
      stoneType: 'Esmeralda',
      description: '',
      purchaseDate: '2026-07-05',
      supplier: 'Proveedor de la v5',
      supplierId: 'sup-v5',
      carats: 3,
      quantity: 3,
      purchaseValueCop: 2000000,
      onCredit: false,
      supplierPayments: [],
      notes: '',
      sales: [
        {
          id: 'sale-v5',
          date: '2026-07-06',
          buyer: 'Comprador de la v5',
          carats: 1,
          quantity: 1,
          valueCop: 1500000,
          notes: ''
        }
      ],
      createdAt: '2026-07-05T09:00:00.000Z',
      updatedAt: '2026-07-05T09:00:00.000Z'
    });
    tx.objectStore('cloudOutbox').put({
      id: 'op-v5',
      table: 'quotes',
      type: 'upsert',
      entityId: 'q-v5',
      data: null,
      updatedAt: '2026-07-18T09:00:00.000Z',
      queuedAt: 1,
      attempts: 0,
      nextAttemptAt: 0
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  database.close();
}

describe('migración real v5 → v6', () => {
  it('conserva todos los datos de la v5 y estrena los almacenes vacíos', async () => {
    await seedV5Database();

    const [settings, clients, quotes, lots, suppliers, buyers, jewels] = await Promise.all([
      storage.loadSettings(),
      storage.listClients(),
      storage.listQuotes(),
      storage.listStoneLots(),
      storage.listSuppliers(),
      storage.listBuyers(),
      storage.listStockJewels()
    ]);

    expect(settings.quoteCounter).toBe(21);
    expect(clients.map((c) => c.id)).toEqual(['c-v5']);
    expect(quotes.map((q) => q.number)).toEqual(['ED-2026-0021']);
    expect(lots.map((l) => l.id)).toEqual(['lot-v5']);
    expect(suppliers.map((s) => s.id)).toEqual(['sup-v5']);
    expect(buyers).toEqual([]);
    expect(jewels).toEqual([]);
  });

  it('una venta de la v5 se sigue leyendo como de contado, con su mismo valor', async () => {
    await seedV5Database();

    const [lot] = await storage.listStoneLots();
    const [sale] = lot.sales;
    expect(sale.valueCop).toBe(1500000);
    expect(sale.onCredit).toBe(false);
    expect(sale.dueDate).toBe('');
    expect(sale.payments).toEqual([]);
    expect(sale.buyerId).toBeNull();
    expect(sale.buyer).toBe('Comprador de la v5');
  });

  it('la cola de sincronización pendiente sobrevive a la migración', async () => {
    await seedV5Database();
    const { dbGetAll } = await import('./db');
    const pending = await dbGetAll<{ id: string }>('cloudOutbox');
    expect(pending.map((op) => op.id)).toEqual(['op-v5']);
  });

  it('después de migrar se pueden guardar, listar y borrar compradores', async () => {
    await seedV5Database();
    await storage.saveBuyer(comprador({ id: 'buy-b', name: 'Bruno' }));
    await storage.saveBuyer(comprador({ id: 'buy-a', name: 'Ana' }));

    expect((await storage.listBuyers()).map((b) => b.name)).toEqual(['Ana', 'Bruno']);

    await storage.deleteBuyer('buy-a');
    expect((await storage.listBuyers()).map((b) => b.id)).toEqual(['buy-b']);
  });

  it('después de migrar se pueden guardar, listar y borrar joyas en stock', async () => {
    await seedV5Database();
    await storage.saveStockJewel(joya({ id: 'j-vieja', acquiredDate: '2026-07-01' }));
    await storage.saveStockJewel(joya({ id: 'j-nueva', acquiredDate: '2026-07-20' }));

    expect((await storage.listStockJewels()).map((j) => j.id)).toEqual(['j-nueva', 'j-vieja']);

    await storage.deleteStockJewel('j-vieja');
    expect((await storage.listStockJewels()).map((j) => j.id)).toEqual(['j-nueva']);
  });
});

describe('el historial nunca se pierde por borrar un comprador (D-043)', () => {
  it('renombrar el comprador actualiza sus ventas sin tocar los abonos', async () => {
    await storage.saveBuyer(comprador());
    await storage.saveStoneLot(loteConCredito());

    await storage.saveBuyer(comprador({ name: 'Joyería Alterna Ejemplo' }));

    const [lot] = await storage.listStoneLots();
    expect(lot.sales[0].buyerId).toBe('buy-1');
    expect(lot.sales[0].buyer).toBe('Joyería Alterna Ejemplo');
    expect(lot.sales[0].payments.map((p) => p.id)).toEqual(['ab-1']);
    expect(lot.sales[0].valueCop).toBe(3000000);
  });

  it('renombrar el comprador actualiza también la venta de una joya', async () => {
    await storage.saveBuyer(comprador());
    await storage.saveStockJewel(
      joya({
        sale: {
          id: 's-1',
          date: '2026-07-20',
          buyer: 'Joyería Ejemplo',
          buyerId: 'buy-1',
          priceCop: 4800000,
          notes: ''
        }
      })
    );

    await storage.saveBuyer(comprador({ name: 'Joyería Alterna Ejemplo' }));

    const [jewel] = await storage.listStockJewels();
    expect(jewel.sale?.buyer).toBe('Joyería Alterna Ejemplo');
    expect(jewel.sale?.priceCop).toBe(4800000);
  });

  it('borrar el comprador conserva el nombre escrito y todos los abonos', async () => {
    await storage.saveBuyer(comprador());
    await storage.saveStoneLot(loteConCredito());

    await storage.deleteBuyer('buy-1');

    expect(await storage.listBuyers()).toEqual([]);
    const [lot] = await storage.listStoneLots();
    expect(lot.sales[0].buyerId).toBeNull();
    expect(lot.sales[0].buyer).toBe('Joyería Ejemplo');
    expect(lot.sales[0].payments.map((p) => p.amount)).toEqual([1000000]);
    expect(lot.sales[0].onCredit).toBe(true);
    expect(lot.sales[0].dueDate).toBe('2026-08-15');
  });

  it('borrar el comprador no toca las ventas de otros compradores', async () => {
    await storage.saveBuyer(comprador({ id: 'buy-1' }));
    await storage.saveBuyer(comprador({ id: 'buy-2', name: 'Otra Joyería' }));
    await storage.saveStoneLot(loteConCredito());
    await storage.saveStoneLot(
      loteConCredito({
        id: 'lot-otro',
        sales: [
          {
            id: 'sale-otro',
            date: '2026-07-15',
            buyer: 'Otra Joyería',
            buyerId: 'buy-2',
            carats: 1,
            quantity: 1,
            valueCop: 1000000,
            onCredit: true,
            dueDate: '2026-08-15',
            payments: [],
            notes: ''
          }
        ]
      })
    );

    await storage.deleteBuyer('buy-1');

    const lots = await storage.listStoneLots();
    const otro = lots.find((l) => l.id === 'lot-otro');
    expect(otro?.sales[0].buyerId).toBe('buy-2');
  });
});

describe('respaldo v6', () => {
  it('exporta compradores y joyas en stock', async () => {
    await storage.saveBuyer(comprador());
    await storage.saveStockJewel(joya());

    const backup = await backupService.exportBackup();
    expect(backup.version).toBe(6);
    expect(backup.buyers.map((b) => b.id)).toEqual(['buy-1']);
    expect(backup.stockJewels.map((j) => j.id)).toEqual(['j-1']);
  });

  it('un respaldo v5 se sigue aceptando y estrena las listas vacías', async () => {
    const v5 = {
      app: 'emerald-dealer-quote',
      version: 5,
      exportedAt: '2026-07-18T09:00:00.000Z',
      settings: sampleSettings(),
      clients: [],
      quotes: [],
      appointments: [],
      stoneLots: [],
      suppliers: []
    };
    const parsed = backupService.parseBackup(JSON.stringify(v5));
    expect(parsed.buyers).toEqual([]);
    expect(parsed.stockJewels).toEqual([]);
    expect(parsed.version).toBe(6);
  });

  it('restaurar un respaldo v6 reemplaza compradores y joyas', async () => {
    await storage.saveBuyer(comprador({ id: 'buy-viejo', name: 'Comprador anterior' }));
    await storage.saveStockJewel(joya({ id: 'j-vieja' }));

    const backup: BackupFile = {
      app: 'emerald-dealer-quote',
      version: 6,
      exportedAt: '',
      settings: sampleSettings(),
      clients: [],
      quotes: [],
      appointments: [],
      stoneLots: [],
      suppliers: [],
      buyers: [comprador({ id: 'buy-import' })],
      stockJewels: [joya({ id: 'j-import' })]
    };
    await backupService.importBackup(backup);

    expect((await storage.listBuyers()).map((b) => b.id)).toEqual(['buy-import']);
    expect((await storage.listStockJewels()).map((j) => j.id)).toEqual(['j-import']);
  });

  it('rechaza compradores duplicados o sin identificador', () => {
    const base: BackupFile = {
      app: 'emerald-dealer-quote',
      version: 6,
      exportedAt: '',
      settings: null,
      clients: [],
      quotes: [],
      appointments: [],
      stoneLots: [],
      suppliers: [],
      buyers: [comprador({ id: 'dup' }), comprador({ id: 'dup' })],
      stockJewels: []
    };
    expect(() => backupService.parseBackup(JSON.stringify(base))).toThrow(/duplicados/);

    const sinId = { ...base, buyers: [{ ...comprador(), id: ' ' }] };
    expect(() => backupService.parseBackup(JSON.stringify(sinId))).toThrow(/inválidos/);
  });

  it('rechaza joyas duplicadas o sin identificador', () => {
    const base: BackupFile = {
      app: 'emerald-dealer-quote',
      version: 6,
      exportedAt: '',
      settings: null,
      clients: [],
      quotes: [],
      appointments: [],
      stoneLots: [],
      suppliers: [],
      buyers: [],
      stockJewels: [joya({ id: 'dup' }), joya({ id: 'dup' })]
    };
    expect(() => backupService.parseBackup(JSON.stringify(base))).toThrow(/duplicadas/);

    const sinId = { ...base, stockJewels: [{ ...joya(), id: ' ' }] };
    expect(() => backupService.parseBackup(JSON.stringify(sinId))).toThrow(/inválidas/);
  });

  it('una venta a crédito sobrevive intacta al viaje de ida y vuelta', async () => {
    await storage.saveStoneLot(loteConCredito());

    const exported = await backupService.exportBackup();
    const parsed = backupService.parseBackup(backupService.serializeBackup(exported));
    const [sale] = parsed.stoneLots[0].sales;

    expect(sale.onCredit).toBe(true);
    expect(sale.dueDate).toBe('2026-08-15');
    expect(sale.buyerId).toBe('buy-1');
    expect(sale.payments).toEqual([{ id: 'ab-1', date: '2026-07-20', amount: 1000000, notes: '' }]);
  });
});
