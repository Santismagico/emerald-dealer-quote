// Etapa 7: primera migración real de IndexedDB (v1→v2) y persistencia de la
// agenda. Se prueba con una base v1 auténtica creada a mano: al abrir la app
// nueva debe aparecer el almacén de citas SIN perder un solo dato anterior.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory as FakeIDBFactory } from 'fake-indexeddb';
import type { Appointment, BackupFile } from '../types';
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
    clientName: 'María Gómez',
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

/** Crea a mano una base v1 real (como la que tienen los teléfonos hoy) con datos. */
async function seedV1Database(): Promise<void> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('emerald-dealer-quote', 1);
    request.onupgradeneeded = () => {
      const d = request.result;
      d.createObjectStore('settings', { keyPath: 'id' });
      d.createObjectStore('clients', { keyPath: 'id' });
      d.createObjectStore('quotes', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(['settings', 'clients', 'quotes'], 'readwrite');
    tx.objectStore('settings').put({ id: 'main', ...sampleSettings({ quoteCounter: 7 }) });
    tx.objectStore('clients').put(sampleClient({ id: 'c-v1', name: 'Cliente de la v1' }));
    tx.objectStore('quotes').put(sampleQuote({ id: 'q-v1', number: 'ED-2026-0007' }));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  database.close();
}

describe('escalera de migraciones', () => {
  function fakeMigratableDb() {
    const created: string[] = [];
    const names = new Set<string>();
    return {
      created,
      db: {
        objectStoreNames: { contains: (name: string) => names.has(name) } as DOMStringList,
        createObjectStore: (name: string) => {
          names.add(name);
          created.push(name);
          return {} as IDBObjectStore;
        }
      }
    };
  }

  it('la versión actual coincide con la cantidad de migraciones', () => {
    expect(db.DB_VERSION).toBe(2);
  });

  it('una base nueva (v0) crea los cuatro almacenes', () => {
    const fake = fakeMigratableDb();
    db.applyDbMigrations(fake.db, 0);
    expect(fake.created).toEqual(['settings', 'clients', 'quotes', 'appointments']);
  });

  it('una base v1 solo agrega el almacén de citas', () => {
    const fake = fakeMigratableDb();
    db.applyDbMigrations(fake.db, 1);
    expect(fake.created).toEqual(['appointments']);
  });

  it('una base ya migrada no crea nada', () => {
    const fake = fakeMigratableDb();
    db.applyDbMigrations(fake.db, 2);
    expect(fake.created).toEqual([]);
  });
});

describe('migración real v1 → v2', () => {
  it('conserva ajustes, clientes y cotizaciones, y estrena la agenda vacía', async () => {
    await seedV1Database();

    const [settings, clients, quotes, appointments] = await Promise.all([
      storage.loadSettings(),
      storage.listClients(),
      storage.listQuotes(),
      storage.listAppointments()
    ]);

    expect(settings.quoteCounter).toBe(7);
    expect(clients.map((c) => c.id)).toEqual(['c-v1']);
    expect(quotes.map((q) => q.number)).toEqual(['ED-2026-0007']);
    expect(appointments).toEqual([]);
  });

  it('después de migrar se pueden guardar y leer citas', async () => {
    await seedV1Database();
    await storage.saveAppointment(cita());
    const list = await storage.listAppointments();
    expect(list.map((a) => a.id)).toEqual(['a-1']);
  });
});

describe('persistencia de la agenda', () => {
  it('lista las citas en orden de agenda (fecha y hora)', async () => {
    await storage.saveAppointment(cita({ id: 'a-tarde', date: '2026-07-21', time: '15:00' }));
    await storage.saveAppointment(cita({ id: 'a-temprano', date: '2026-07-21', time: '08:00' }));
    await storage.saveAppointment(cita({ id: 'a-antes', date: '2026-07-20' }));

    const list = await storage.listAppointments();
    expect(list.map((a) => a.id)).toEqual(['a-antes', 'a-temprano', 'a-tarde']);
  });

  it('normaliza al leer una cita corrupta guardada por una versión vieja', async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('emerald-dealer-quote', db.DB_VERSION);
      request.onupgradeneeded = () => db.applyDbMigrations(request.result, 0);
      request.onsuccess = () => {
        const database = request.result;
        const tx = database.transaction('appointments', 'readwrite');
        tx.objectStore('appointments').put({
          id: 'a-corrupta',
          durationMinutes: -5,
          time: '25:99h',
          status: 'inventado'
        });
        tx.oncomplete = () => {
          database.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });

    const [restored] = await storage.listAppointments();
    expect(restored.durationMinutes).toBe(60);
    expect(restored.time).toBe('');
    expect(restored.status).toBe('programada');
    expect(restored.clientName).toBe('');
  });

  it('eliminar una cita no toca las demás', async () => {
    await storage.saveAppointment(cita({ id: 'a-1' }));
    await storage.saveAppointment(cita({ id: 'a-2', time: '11:00' }));
    await storage.deleteAppointment('a-1');
    const list = await storage.listAppointments();
    expect(list.map((a) => a.id)).toEqual(['a-2']);
  });
});

describe('respaldo v3 con agenda', () => {
  it('la exportación incluye las citas y declara la versión 3', async () => {
    await storage.saveAppointment(cita());
    const backup = await backupService.exportBackup();
    expect(backup.version).toBe(3);
    expect(backup.appointments.map((a) => a.id)).toEqual(['a-1']);
  });

  it('importar un respaldo v2 (sin citas) funciona y deja la agenda vacía', async () => {
    await storage.saveAppointment(cita({ id: 'a-existente' }));

    const v2 = {
      app: 'emerald-dealer-quote',
      version: 2,
      exportedAt: '2026-07-11T12:00:00.000Z',
      settings: sampleSettings(),
      clients: [sampleClient()],
      quotes: [sampleQuote()]
    } as unknown as BackupFile;

    await backupService.importBackup(v2);

    expect(await storage.listAppointments()).toEqual([]);
    expect((await storage.listClients()).length).toBe(1);
  });

  it('importar un respaldo v3 restaura las citas normalizadas', async () => {
    const backup: BackupFile = {
      app: 'emerald-dealer-quote',
      version: 3,
      exportedAt: '2026-07-14T12:00:00.000Z',
      settings: sampleSettings(),
      clients: [sampleClient()],
      quotes: [sampleQuote()],
      appointments: [cita({ id: 'a-import', status: 'cumplida' })]
    };

    await backupService.importBackup(backup);

    const list = await storage.listAppointments();
    expect(list.map((a) => a.id)).toEqual(['a-import']);
    expect(list[0].status).toBe('cumplida');
  });

  it('rechaza un respaldo con citas duplicadas o sin identificador', async () => {
    const base: BackupFile = {
      app: 'emerald-dealer-quote',
      version: 3,
      exportedAt: '',
      settings: null,
      clients: [],
      quotes: [],
      appointments: [cita({ id: 'a-dup' }), cita({ id: 'a-dup' })]
    };
    expect(() => backupService.parseBackup(JSON.stringify(base))).toThrow(/duplicadas/);

    const sinId = { ...base, appointments: [{ ...cita(), id: '  ' }] };
    expect(() => backupService.parseBackup(JSON.stringify(sinId))).toThrow(/inválidas/);
  });
});
