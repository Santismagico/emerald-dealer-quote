// Inventario de materiales (D-048/D-049): migración IndexedDB v6→v7 (almacenes
// de socios y lotes de material) y respaldo vigente. Se prueba contra una base v6
// AUTÉNTICA para comprobar que al abrir la app nueva aparecen los almacenes
// nuevos SIN perder un solo dato.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory as FakeIDBFactory } from 'fake-indexeddb';
import type { BackupFile, Expense, MaterialLot, MaterialPartner, StoneLot } from '../types';
import { sampleClient, sampleQuote, sampleSettings } from '../test/fixtures';
import { emptyExpense } from './expenses';
import { emptyStoneLot } from './stones';

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

function socio(overrides: Partial<MaterialPartner> = {}): MaterialPartner {
  return {
    id: 'soc-1',
    name: 'Socio Emerald',
    phone: '3000000000',
    city: 'Bogotá',
    notes: '',
    createdAt: '2026-07-24T09:00:00.000Z',
    ...overrides
  };
}

function loteCompartido(overrides: Partial<MaterialLot> = {}): MaterialLot {
  return {
    id: 'l-1',
    name: '',
    materialType: 'Oro',
    purity: '18K',
    purchaseDate: '2026-07-20',
    grams: 100,
    costCop: 20000000,
    partnerId: 'soc-1',
    partnerName: 'Socio Emerald',
    myGrams: 60,
    notes: '',
    uses: [{ id: 'u-1', date: '2026-07-22', grams: 10, notes: 'argolla' }],
    createdAt: '2026-07-20T09:00:00.000Z',
    updatedAt: '2026-07-20T09:00:00.000Z',
    ...overrides
  };
}

function gastoCompartido(overrides: Partial<Expense> = {}): Expense {
  return {
    ...emptyExpense('2026-07-20', '2026-07-20T09:00:00.000Z'),
    id: 'g-1',
    concept: 'Feria',
    category: 'Publicidad',
    amountCop: 300000,
    method: 'Transferencia',
    paidBy: 'Santiago',
    partnerId: 'soc-1',
    partnerName: 'Socio Emerald',
    myPercent: 60,
    ...overrides
  };
}

function piedrasCompartidas(overrides: Partial<StoneLot> = {}): StoneLot {
  return {
    ...emptyStoneLot('2026-07-20', '2026-07-20T09:00:00.000Z'),
    id: 'p-1',
    name: 'Lote compartido',
    stoneType: 'Esmeralda',
    quantity: 1,
    purchaseValueCop: 1000000,
    partnerId: 'soc-1',
    partnerName: 'Socio Emerald',
    myPercent: 60,
    ...overrides
  };
}

/** Crea a mano una base v6 real (compradores + joyas) con datos. */
async function seedV6Database(): Promise<void> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('emerald-dealer-quote', 6);
    request.onupgradeneeded = () => {
      const d = request.result;
      for (const store of [
        'settings',
        'clients',
        'quotes',
        'appointments',
        'stoneLots',
        'suppliers',
        'cloudOutbox',
        'buyers',
        'stockJewels'
      ]) {
        d.createObjectStore(store, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(
      ['settings', 'clients', 'quotes', 'buyers', 'stockJewels'],
      'readwrite'
    );
    tx.objectStore('settings').put({ id: 'main', ...sampleSettings({ quoteCounter: 30 }) });
    tx.objectStore('clients').put(sampleClient({ id: 'c-v6', name: 'Cliente de la v6' }));
    tx.objectStore('quotes').put(sampleQuote({ id: 'q-v6', number: 'ED-2026-0030' }));
    tx.objectStore('buyers').put({
      id: 'buy-v6',
      name: 'Comprador de la v6',
      phone: '',
      city: '',
      notes: '',
      createdAt: '2026-07-21T09:00:00.000Z'
    });
    // Una joya VIEJA sin collectionId: es el caso real de la v6 ya instalada.
    tx.objectStore('stockJewels').put({
      id: 'j-v6',
      name: 'Anillo de la v6',
      pieceType: 'anillo',
      material: 'Oro',
      photo: '',
      acquiredDate: '2026-07-15',
      costCop: 3000000,
      priceCop: 5000000,
      status: 'disponible',
      notes: '',
      sale: null,
      createdAt: '2026-07-15T09:00:00.000Z',
      updatedAt: '2026-07-15T09:00:00.000Z'
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  database.close();
}

describe('migración real v6 → v7', () => {
  it('conserva todos los datos de la v6 y estrena los almacenes vacíos', async () => {
    await seedV6Database();

    const [settings, clients, quotes, buyers, jewels, partners, lots] = await Promise.all([
      storage.loadSettings(),
      storage.listClients(),
      storage.listQuotes(),
      storage.listBuyers(),
      storage.listStockJewels(),
      storage.listMaterialPartners(),
      storage.listMaterialLots()
    ]);

    expect(settings.quoteCounter).toBe(30);
    expect(clients.map((c) => c.id)).toEqual(['c-v6']);
    expect(quotes.map((q) => q.number)).toEqual(['ED-2026-0030']);
    expect(buyers.map((b) => b.id)).toEqual(['buy-v6']);
    expect(jewels.map((j) => j.id)).toEqual(['j-v6']);
    expect(partners).toEqual([]);
    expect(lots).toEqual([]);
  });

  it('una joya de la v6 estrena collectionId en null sin perder nada', async () => {
    await seedV6Database();
    const [jewel] = await storage.listStockJewels();
    expect(jewel.collectionId).toBeNull();
    expect(jewel.priceCop).toBe(5000000);
  });

  it('después de migrar se pueden guardar, listar y borrar lotes de material', async () => {
    await seedV6Database();
    await storage.saveMaterialLot(loteCompartido({ id: 'l-a', purchaseDate: '2026-07-10' }));
    await storage.saveMaterialLot(loteCompartido({ id: 'l-b', purchaseDate: '2026-07-22' }));

    expect((await storage.listMaterialLots()).map((l) => l.id)).toEqual(['l-b', 'l-a']);

    await storage.deleteMaterialLot('l-a');
    expect((await storage.listMaterialLots()).map((l) => l.id)).toEqual(['l-b']);
  });
});

describe('el historial no se pierde por borrar un socio (D-049)', () => {
  it('renombrar el socio actualiza sus lotes sin tocar los gramos', async () => {
    await storage.saveMaterialPartner(socio());
    await storage.saveMaterialLot(loteCompartido());
    await storage.saveExpense(gastoCompartido());
    await storage.saveStoneLot(piedrasCompartidas());

    await storage.saveMaterialPartner(socio({ name: 'Socio Renombrado' }));

    const [lot] = await storage.listMaterialLots();
    expect(lot.partnerId).toBe('soc-1');
    expect(lot.partnerName).toBe('Socio Renombrado');
    expect(lot.myGrams).toBe(60);
    expect(lot.uses.map((u) => u.id)).toEqual(['u-1']);
    expect((await storage.listExpenses())[0]).toMatchObject({
      partnerId: 'soc-1', partnerName: 'Socio Renombrado', myPercent: 60
    });
    expect((await storage.listStoneLots())[0]).toMatchObject({
      partnerId: 'soc-1', partnerName: 'Socio Renombrado', myPercent: 60
    });
  });

  it('borrar el socio conserva el nombre escrito y el reparto', async () => {
    await storage.saveMaterialPartner(socio());
    await storage.saveMaterialLot(loteCompartido());
    await storage.saveExpense(gastoCompartido());
    await storage.saveStoneLot(piedrasCompartidas());

    await storage.deleteMaterialPartner('soc-1');

    expect(await storage.listMaterialPartners()).toEqual([]);
    const [lot] = await storage.listMaterialLots();
    expect(lot.partnerId).toBeNull();
    expect(lot.partnerName).toBe('Socio Emerald');
    expect(lot.myGrams).toBe(60);
    expect(lot.grams).toBe(100);
    expect((await storage.listExpenses())[0]).toMatchObject({
      partnerId: null, partnerName: 'Socio Emerald', myPercent: 60
    });
    expect((await storage.listStoneLots())[0]).toMatchObject({
      partnerId: null, partnerName: 'Socio Emerald', myPercent: 60
    });
  });

  it('borrar un socio no toca los lotes de otro socio', async () => {
    await storage.saveMaterialPartner(socio({ id: 'soc-1' }));
    await storage.saveMaterialPartner(socio({ id: 'soc-2', name: 'Joyero Amigo' }));
    await storage.saveMaterialLot(loteCompartido({ id: 'l-1', partnerId: 'soc-1' }));
    await storage.saveMaterialLot(
      loteCompartido({ id: 'l-2', partnerId: 'soc-2', partnerName: 'Joyero Amigo' })
    );

    await storage.deleteMaterialPartner('soc-1');

    const otro = (await storage.listMaterialLots()).find((l) => l.id === 'l-2');
    expect(otro?.partnerId).toBe('soc-2');
  });
});

describe('respaldo vigente y compatibilidad v7', () => {
  it('exporta socios y lotes de material', async () => {
    await storage.saveMaterialPartner(socio());
    await storage.saveMaterialLot(loteCompartido());

    const backup = await backupService.exportBackup();
    expect(backup.version).toBe(9);
    expect(backup.materialPartners.map((p) => p.id)).toEqual(['soc-1']);
    expect(backup.materialLots.map((l) => l.id)).toEqual(['l-1']);
  });

  it('un respaldo v6 se sigue aceptando y estrena las listas vacías', async () => {
    const v6 = {
      app: 'emerald-dealer-quote',
      version: 6,
      exportedAt: '2026-07-21T09:00:00.000Z',
      settings: sampleSettings(),
      clients: [],
      quotes: [],
      appointments: [],
      stoneLots: [],
      suppliers: [],
      buyers: [],
      stockJewels: []
    };
    const parsed = backupService.parseBackup(JSON.stringify(v6));
    expect(parsed.materialPartners).toEqual([]);
    expect(parsed.materialLots).toEqual([]);
    expect(parsed.version).toBe(9);
  });

  it('restaurar un respaldo v7 reemplaza socios y lotes de material', async () => {
    await storage.saveMaterialPartner(socio({ id: 'viejo', name: 'Socio anterior' }));
    await storage.saveMaterialLot(loteCompartido({ id: 'l-viejo' }));

    const backup: BackupFile = {
      app: 'emerald-dealer-quote',
      version: 7,
      exportedAt: '',
      settings: sampleSettings(),
      clients: [],
      quotes: [],
      appointments: [],
      stoneLots: [],
      suppliers: [],
      buyers: [],
      stockJewels: [],
      materialPartners: [socio({ id: 'soc-import' })],
      materialLots: [loteCompartido({ id: 'l-import' })],
      expenses: [],
      fundContributions: []
    };
    await backupService.importBackup(backup);

    expect((await storage.listMaterialPartners()).map((p) => p.id)).toEqual(['soc-import']);
    expect((await storage.listMaterialLots()).map((l) => l.id)).toEqual(['l-import']);
  });

  it('rechaza socios o lotes de material duplicados o sin id', () => {
    const base: BackupFile = {
      app: 'emerald-dealer-quote',
      version: 7,
      exportedAt: '',
      settings: null,
      clients: [],
      quotes: [],
      appointments: [],
      stoneLots: [],
      suppliers: [],
      buyers: [],
      stockJewels: [],
      materialPartners: [socio({ id: 'dup' }), socio({ id: 'dup' })],
      materialLots: [],
      expenses: [],
      fundContributions: []
    };
    expect(() => backupService.parseBackup(JSON.stringify(base))).toThrow(/duplicados/);

    const lotesDup = {
      ...base,
      materialPartners: [],
      materialLots: [loteCompartido({ id: 'dup' }), loteCompartido({ id: 'dup' })]
    };
    expect(() => backupService.parseBackup(JSON.stringify(lotesDup))).toThrow(/duplicados/);

    const sinId = { ...base, materialPartners: [{ ...socio(), id: ' ' }] };
    expect(() => backupService.parseBackup(JSON.stringify(sinId))).toThrow(/inválidos/);
  });

  it('un lote de material sobrevive intacto al viaje de ida y vuelta', async () => {
    await storage.saveMaterialLot(loteCompartido());

    const exported = await backupService.exportBackup();
    const parsed = backupService.parseBackup(backupService.serializeBackup(exported));
    const [lot] = parsed.materialLots;

    expect(lot.partnerId).toBe('soc-1');
    expect(lot.myGrams).toBe(60);
    expect(lot.uses).toEqual([{ id: 'u-1', date: '2026-07-22', grams: 10, notes: 'argolla' }]);
  });
});
