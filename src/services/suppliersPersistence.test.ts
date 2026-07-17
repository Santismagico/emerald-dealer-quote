// Corrección C3: migración IndexedDB v3→v4 (almacén de proveedores) y
// respaldo v5. Se prueba contra una base v3 auténtica: al abrir la app nueva
// debe aparecer el almacén de proveedores SIN perder un solo dato.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory as FakeIDBFactory } from 'fake-indexeddb';
import type { BackupFile, StoneLot, Supplier } from '../types';
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

function proveedor(overrides: Partial<Supplier> = {}): Supplier {
  return {
    id: 'sup-1',
    name: 'Proveedor Ejemplo',
    phone: '3000000000',
    city: 'Ciudad Ejemplo',
    notes: '',
    createdAt: '2026-07-16T09:00:00.000Z',
    ...overrides
  };
}

function loteVinculado(overrides: Partial<StoneLot> = {}): StoneLot {
  return {
    id: 'lot-sup-1',
    name: 'Lote con historial',
    stoneType: 'Esmeralda',
    description: '',
    purchaseDate: '2026-07-16',
    supplier: 'Proveedor Ejemplo',
    supplierId: 'sup-1',
    carats: 2,
    quantity: 2,
    purchaseValueCop: 4000000,
    onCredit: true,
    supplierPayments: [
      { id: 'pay-1', date: '2026-07-16', amount: 1000000, notes: 'Transferencia' }
    ],
    notes: '',
    sales: [
      {
        id: 'sale-1',
        date: '2026-07-16',
        buyer: 'Cliente interno',
        carats: 0.5,
        quantity: 1,
        valueCop: 1500000,
        notes: ''
      }
    ],
    createdAt: '2026-07-16T09:00:00.000Z',
    updatedAt: '2026-07-16T09:00:00.000Z',
    ...overrides
  };
}

/** Crea a mano una base v3 real (la publicada) con datos. */
async function seedV3Database(): Promise<void> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('emerald-dealer-quote', 3);
    request.onupgradeneeded = () => {
      const d = request.result;
      for (const store of ['settings', 'clients', 'quotes', 'appointments', 'stoneLots']) {
        d.createObjectStore(store, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(['settings', 'quotes'], 'readwrite');
    tx.objectStore('settings').put({ id: 'main', ...sampleSettings({ quoteCounter: 11 }) });
    tx.objectStore('quotes').put(sampleQuote({ id: 'q-v3', number: 'ED-2026-0011' }));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  database.close();
}

describe('migración real v3 → v4', () => {
  it('conserva los datos publicados y estrena los proveedores vacíos', async () => {
    await seedV3Database();

    const [settings, quotes, suppliers] = await Promise.all([
      storage.loadSettings(),
      storage.listQuotes(),
      storage.listSuppliers()
    ]);

    expect(settings.quoteCounter).toBe(11);
    expect(quotes.map((q) => q.number)).toEqual(['ED-2026-0011']);
    expect(suppliers).toEqual([]);
  });

  it('después de migrar se pueden guardar, listar y borrar proveedores', async () => {
    await seedV3Database();
    await storage.saveSupplier(proveedor({ id: 'sup-b', name: 'Bruno' }));
    await storage.saveSupplier(proveedor({ id: 'sup-a', name: 'Ana' }));

    const list = await storage.listSuppliers();
    expect(list.map((s) => s.name)).toEqual(['Ana', 'Bruno']);

    await storage.deleteSupplier('sup-a');
    expect((await storage.listSuppliers()).map((s) => s.id)).toEqual(['sup-b']);
  });

  it('renombrar un proveedor actualiza sus lotes sin tocar ventas ni pagos', async () => {
    await storage.saveSupplier(proveedor());
    await storage.saveStoneLot(loteVinculado());

    await storage.saveSupplier(proveedor({ name: 'Proveedor Alterno Ejemplo' }));

    const [lot] = await storage.listStoneLots();
    expect(lot.supplierId).toBe('sup-1');
    expect(lot.supplier).toBe('Proveedor Alterno Ejemplo');
    expect(lot.sales.map((sale) => sale.id)).toEqual(['sale-1']);
    expect(lot.supplierPayments.map((payment) => payment.id)).toEqual(['pay-1']);
  });

  it('eliminar un proveedor conserva el nombre y todo el historial del lote', async () => {
    await storage.saveSupplier(proveedor());
    await storage.saveStoneLot(loteVinculado());

    await storage.deleteSupplier('sup-1');

    const [lot] = await storage.listStoneLots();
    expect(await storage.listSuppliers()).toEqual([]);
    expect(lot.supplierId).toBeNull();
    expect(lot.supplier).toBe('Proveedor Ejemplo');
    expect(lot.sales).toHaveLength(1);
    expect(lot.sales[0].valueCop).toBe(1500000);
    expect(lot.supplierPayments).toHaveLength(1);
    expect(lot.supplierPayments[0].amount).toBe(1000000);
    expect(lot.onCredit).toBe(true);
  });

  it('normaliza al leer un proveedor corrupto', async () => {
    await storage.saveSupplier({ id: 'sup-x', name: 42, phone: null } as unknown as Supplier);
    const [restored] = await storage.listSuppliers();
    expect(restored.name).toBe('');
    expect(restored.phone).toBe('');
  });
});

describe('respaldo v5 con proveedores', () => {
  it('exporta los proveedores y declara la versión vigente', async () => {
    await storage.saveSupplier(proveedor());
    const backup = await backupService.exportBackup();
    expect(backup.version).toBe(backupService.BACKUP_VERSION);
    expect(backup.suppliers.map((s) => s.id)).toEqual(['sup-1']);
  });

  it('importar un respaldo v4 (sin proveedores) funciona y los deja vacíos', async () => {
    await storage.saveSupplier(proveedor({ id: 'sup-viejo' }));

    const v4 = {
      app: 'emerald-dealer-quote',
      version: 4,
      exportedAt: '2026-07-15T12:00:00.000Z',
      settings: sampleSettings(),
      clients: [sampleClient()],
      quotes: [sampleQuote()],
      appointments: [],
      stoneLots: []
    } as unknown as BackupFile;

    await backupService.importBackup(v4);

    expect(await storage.listSuppliers()).toEqual([]);
    expect((await storage.listClients()).length).toBe(1);
  });

  it('importar un respaldo v5 restaura los proveedores', async () => {
    const backup: BackupFile = {
      app: 'emerald-dealer-quote',
      version: 5,
      exportedAt: '2026-07-16T12:00:00.000Z',
      settings: sampleSettings(),
      clients: [],
      quotes: [],
      appointments: [],
      stoneLots: [],
      suppliers: [proveedor({ id: 'sup-import' })]
    };

    await backupService.importBackup(backup);

    expect((await storage.listSuppliers()).map((s) => s.id)).toEqual(['sup-import']);
  });

  it('rechaza proveedores duplicados o sin identificador', () => {
    const base: BackupFile = {
      app: 'emerald-dealer-quote',
      version: 5,
      exportedAt: '',
      settings: null,
      clients: [],
      quotes: [],
      appointments: [],
      stoneLots: [],
      suppliers: [proveedor({ id: 'dup' }), proveedor({ id: 'dup' })]
    };
    expect(() => backupService.parseBackup(JSON.stringify(base))).toThrow(/duplicados/);

    const sinId = { ...base, suppliers: [{ ...proveedor(), id: ' ' }] };
    expect(() => backupService.parseBackup(JSON.stringify(sinId))).toThrow(/inválidos/);
  });
});
