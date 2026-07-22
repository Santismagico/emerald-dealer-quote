// Etapa 8: migración IndexedDB v2→v3 (almacén de lotes de piedras) y respaldo
// v4. Se prueba contra una base v2 auténtica (la que dejó la Etapa 7): al abrir
// la app nueva debe aparecer el almacén de lotes SIN perder un solo dato.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory as FakeIDBFactory } from 'fake-indexeddb';
import type { Appointment, BackupFile, StoneLot } from '../types';
import { sampleClient, sampleQuote, sampleSettings } from '../test/fixtures';

let db: typeof import('./db');
let storage: typeof import('./storage');
let backupService: typeof import('./backup');

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new FakeIDBFactory());
  db = await import('./db');
  storage = await import('./storage');
  backupService = await import('./backup');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

function cita(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 'a-1',
    clientId: null,
    clientName: 'Cliente Ejemplo',
    date: '2026-07-20',
    time: '10:00',
    durationMinutes: 60,
    reason: 'Asesoría',
    notes: '',
    status: 'programada',
    createdAt: '2026-07-14T09:00:00.000Z',
    updatedAt: '2026-07-14T09:00:00.000Z',
    ...overrides
  };
}

function lote(overrides: Partial<StoneLot> = {}): StoneLot {
  return {
    id: 'l-1',
    name: 'Lote Ejemplo 12',
    stoneType: 'Esmeralda',
    description: '',
    purchaseDate: '2026-07-15',
    supplier: 'Proveedor Ejemplo',
    supplierId: null,
    carats: 5,
    quantity: 4,
    purchaseValueCop: 6000000,
    onCredit: false,
    supplierPayments: [],
    notes: '',
    sales: [
      {
        id: 'v-1',
        date: '2026-07-15',
        buyer: 'Comprador Ciudad Ejemplo',
        carats: 1,
        quantity: 1,
        valueCop: 2000000,
        buyerId: null,
        onCredit: false,
        dueDate: '',
        payments: [],
        notes: ''
      }
    ],
    createdAt: '2026-07-15T09:00:00.000Z',
    updatedAt: '2026-07-15T09:00:00.000Z',
    ...overrides
  };
}

/** Crea a mano una base v2 real (la que dejó la Etapa 7) con datos en los 4 almacenes. */
async function seedV2Database(): Promise<void> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('emerald-dealer-quote', 2);
    request.onupgradeneeded = () => {
      const d = request.result;
      d.createObjectStore('settings', { keyPath: 'id' });
      d.createObjectStore('clients', { keyPath: 'id' });
      d.createObjectStore('quotes', { keyPath: 'id' });
      d.createObjectStore('appointments', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(['settings', 'clients', 'quotes', 'appointments'], 'readwrite');
    tx.objectStore('settings').put({ id: 'main', ...sampleSettings({ quoteCounter: 9 }) });
    tx.objectStore('clients').put(sampleClient({ id: 'c-v2', name: 'Cliente de la v2' }));
    tx.objectStore('quotes').put(sampleQuote({ id: 'q-v2', number: 'ED-2026-0009' }));
    tx.objectStore('appointments').put(cita({ id: 'a-v2' }));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  database.close();
}

describe('migración real v2 → v3', () => {
  it('conserva ajustes, clientes, cotizaciones y citas, y estrena los lotes vacíos', async () => {
    await seedV2Database();

    const [settings, clients, quotes, appointments, lots] = await Promise.all([
      storage.loadSettings(),
      storage.listClients(),
      storage.listQuotes(),
      storage.listAppointments(),
      storage.listStoneLots()
    ]);

    expect(settings.quoteCounter).toBe(9);
    expect(clients.map((c) => c.id)).toEqual(['c-v2']);
    expect(quotes.map((q) => q.number)).toEqual(['ED-2026-0009']);
    expect(appointments.map((a) => a.id)).toEqual(['a-v2']);
    expect(lots).toEqual([]);
  });

  it('después de migrar se pueden guardar y leer lotes con sus ventas', async () => {
    await seedV2Database();
    await storage.saveStoneLot(lote());
    const [restored] = await storage.listStoneLots();
    expect(restored.id).toBe('l-1');
    expect(restored.sales.length).toBe(1);
    expect(restored.sales[0].valueCop).toBe(2000000);
  });
});

describe('persistencia de los lotes', () => {
  it('lista los lotes del más reciente al más antiguo', async () => {
    await storage.saveStoneLot(lote({ id: 'l-viejo', purchaseDate: '2026-07-01', sales: [] }));
    await storage.saveStoneLot(lote({ id: 'l-nuevo', purchaseDate: '2026-07-15', sales: [] }));
    const lots = await storage.listStoneLots();
    expect(lots.map((l) => l.id)).toEqual(['l-nuevo', 'l-viejo']);
  });

  it('normaliza al leer un lote corrupto (ventas basura, números negativos)', async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('emerald-dealer-quote', db.DB_VERSION);
      request.onupgradeneeded = () => db.applyDbMigrations(request.result, 0);
      request.onsuccess = () => {
        const database = request.result;
        const tx = database.transaction('stoneLots', 'readwrite');
        tx.objectStore('stoneLots').put({
          id: 'l-corrupto',
          carats: -3,
          purchaseValueCop: 'gratis',
          sales: [null, { id: 'v-x', valueCop: -50 }, 'basura']
        });
        tx.oncomplete = () => {
          database.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });

    const [restored] = await storage.listStoneLots();
    expect(restored.carats).toBe(0);
    expect(restored.purchaseValueCop).toBe(0);
    expect(restored.sales.length).toBe(3);
    expect(restored.sales.every((s) => s.valueCop >= 0 && typeof s.id === 'string')).toBe(true);
  });

  it('eliminar un lote no toca los demás', async () => {
    await storage.saveStoneLot(lote({ id: 'l-1', sales: [] }));
    await storage.saveStoneLot(lote({ id: 'l-2', sales: [] }));
    await storage.deleteStoneLot('l-1');
    const lots = await storage.listStoneLots();
    expect(lots.map((l) => l.id)).toEqual(['l-2']);
  });
});

describe('respaldo v4 con lotes de piedras', () => {
  it('la exportación incluye los lotes y declara la versión 4', async () => {
    await storage.saveStoneLot(lote());
    const backup = await backupService.exportBackup();
    expect(backup.version).toBe(backupService.BACKUP_VERSION);
    expect(backup.stoneLots.map((l) => l.id)).toEqual(['l-1']);
    expect(backup.stoneLots[0].sales.length).toBe(1);
  });

  it('importar un respaldo v3 (sin lotes) funciona y deja los lotes vacíos', async () => {
    await storage.saveStoneLot(lote({ id: 'l-existente' }));

    const v3 = {
      app: 'emerald-dealer-quote',
      version: 3,
      exportedAt: '2026-07-14T12:00:00.000Z',
      settings: sampleSettings(),
      clients: [sampleClient()],
      quotes: [sampleQuote()],
      appointments: [cita()]
    } as unknown as BackupFile;

    await backupService.importBackup(v3);

    expect(await storage.listStoneLots()).toEqual([]);
    expect((await storage.listAppointments()).length).toBe(1);
  });

  it('importar un respaldo v4 restaura los lotes con sus ventas', async () => {
    const backup: BackupFile = {
      app: 'emerald-dealer-quote',
      version: 4,
      exportedAt: '2026-07-15T12:00:00.000Z',
      settings: sampleSettings(),
      clients: [sampleClient()],
      quotes: [sampleQuote()],
      appointments: [],
      stoneLots: [lote({ id: 'l-import' })],
      suppliers: [],
      buyers: [],
      stockJewels: []
    };

    await backupService.importBackup(backup);

    const lots = await storage.listStoneLots();
    expect(lots.map((l) => l.id)).toEqual(['l-import']);
    expect(lots[0].sales[0].buyer).toBe('Comprador Ciudad Ejemplo');
  });

  it('rechaza un respaldo con lotes duplicados o sin identificador', async () => {
    const base: BackupFile = {
      app: 'emerald-dealer-quote',
      version: 4,
      exportedAt: '',
      settings: null,
      clients: [],
      quotes: [],
      appointments: [],
      stoneLots: [lote({ id: 'l-dup' }), lote({ id: 'l-dup' })],
      suppliers: [],
      buyers: [],
      stockJewels: []
    };
    expect(() => backupService.parseBackup(JSON.stringify(base))).toThrow(/duplicados/);

    const sinId = { ...base, stoneLots: [{ ...lote(), id: '  ' }] };
    expect(() => backupService.parseBackup(JSON.stringify(sinId))).toThrow(/inválidos/);
  });
});
