import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IDBDatabase as FakeIDBDatabase,
  IDBFactory as FakeIDBFactory,
  IDBObjectStore as FakeIDBObjectStore
} from 'fake-indexeddb';
import type { BackupFile } from '../types';
import { sampleClient, sampleQuote, sampleSettings } from '../test/fixtures';

let db: typeof import('./db');
let storage: typeof import('./storage');
let backupService: typeof import('./backup');
let schema: typeof import('./schema');

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new FakeIDBFactory());
  db = await import('./db');
  storage = await import('./storage');
  backupService = await import('./backup');
  schema = await import('./schema');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

function makeBackup(
  prefix: string,
  options: { clients?: number; quotes?: number; version?: number; settings?: BackupFile['settings'] } = {}
): BackupFile {
  const clientCount = options.clients ?? 1;
  const quoteCount = options.quotes ?? 1;
  const clients = Array.from({ length: clientCount }, (_, index) =>
    sampleClient({
      id: `${prefix}-client-${index + 1}`,
      name: `${prefix} Cliente ${index + 1}`
    })
  );
  const quotes = Array.from({ length: quoteCount }, (_, index) => {
    const client = clients[index % clients.length] ?? null;
    return sampleQuote({
      id: `${prefix}-quote-${index + 1}`,
      number: `ED-2026-${String(index + 1).padStart(4, '0')}`,
      clientId: client?.id ?? null,
      clientSnapshot: client,
      updatedAt: `2026-07-11T10:${String(index).padStart(2, '0')}:00.000Z`
    });
  });

  return {
    app: 'emerald-dealer-quote',
    version: options.version ?? 2,
    exportedAt: '2026-07-11T12:00:00.000Z',
    settings:
      options.settings === undefined
        ? sampleSettings({ jewelryName: `Joyería ${prefix}`, quoteCounter: 40 + clientCount + quoteCount })
        : options.settings,
    clients,
    quotes,
    appointments: [],
    stoneLots: [],
    suppliers: []
  };
}

function sortById<T extends { id?: unknown }>(items: T[]): T[] {
  return [...items].sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

async function rawSnapshot() {
  const [settings, clients, quotes] = await Promise.all([
    db.dbGetAll<Record<string, unknown>>('settings'),
    db.dbGetAll<Record<string, unknown>>('clients'),
    db.dbGetAll<Record<string, unknown>>('quotes')
  ]);
  return {
    settings: sortById(settings),
    clients: sortById(clients),
    quotes: sortById(quotes)
  };
}

function trackAtomicTransactions() {
  const counts = { writes: 0, completes: 0, aborts: 0 };
  const original = FakeIDBDatabase.prototype.transaction;
  vi.spyOn(FakeIDBDatabase.prototype, 'transaction').mockImplementation(function (
    this: IDBDatabase,
    storeNames: string | Iterable<string>,
    mode?: IDBTransactionMode,
    options?: IDBTransactionOptions
  ) {
    const args = options === undefined ? [storeNames, mode] : [storeNames, mode, options];
    const tx = Reflect.apply(original, this, args) as IDBTransaction;
    const scope = Array.from(tx.objectStoreNames);
    if (
      mode === 'readwrite' &&
      ['settings', 'clients', 'quotes'].every((store) => scope.includes(store))
    ) {
      counts.writes += 1;
      tx.addEventListener('complete', () => {
        counts.completes += 1;
      });
      tx.addEventListener('abort', () => {
        counts.aborts += 1;
      });
    }
    return tx;
  });
  return counts;
}

function abortAfterSuccessfulPut(target: 'settings' | 'clients' | 'quotes') {
  let triggers = 0;
  const original = FakeIDBObjectStore.prototype.put;
  const spy = vi.spyOn(FakeIDBObjectStore.prototype, 'put').mockImplementation(function (
    this: IDBObjectStore,
    value: unknown,
    key?: IDBValidKey
  ) {
    const args = key === undefined ? [value] : [value, key];
    const request = Reflect.apply(original, this, args) as IDBRequest;
    if (this.name === target && triggers === 0) {
      triggers += 1;
      request.addEventListener(
        'success',
        () => {
          this.transaction.abort();
        },
        { once: true }
      );
    }
    return request;
  });
  return { spy, triggerCount: () => triggers };
}

describe('restauración atómica de respaldos', () => {
  it('reemplaza ajustes, clientes y cotizaciones en una única confirmación', async () => {
    await backupService.importBackup(makeBackup('anterior', { clients: 2, quotes: 2 }));
    const next = makeBackup('nuevo', { clients: 2, quotes: 2 });
    const transactions = trackAtomicTransactions();

    await backupService.importBackup(next);

    const [settings, clients, quotes] = await Promise.all([
      storage.loadSettings(),
      storage.listClients(),
      storage.listQuotes()
    ]);
    expect(settings.jewelryName).toBe('Joyería nuevo');
    expect(clients.map((client) => client.id).sort()).toEqual(next.clients.map((client) => client.id).sort());
    expect(quotes.map((quote) => quote.id).sort()).toEqual(next.quotes.map((quote) => quote.id).sort());
    expect(transactions).toEqual({ writes: 1, completes: 1, aborts: 0 });
  });

  it('restaura completamente varios clientes y cotizaciones sin dejar datos anteriores', async () => {
    await backupService.importBackup(makeBackup('viejo', { clients: 3, quotes: 3 }));
    const next = makeBackup('lote', { clients: 5, quotes: 7 });

    await backupService.importBackup(next);

    const snapshot = await rawSnapshot();
    expect(snapshot.settings).toHaveLength(1);
    expect(snapshot.clients).toHaveLength(5);
    expect(snapshot.quotes).toHaveLength(7);
    expect(snapshot.clients.every((client) => String(client.id).startsWith('lote-'))).toBe(true);
    expect(snapshot.quotes.every((quote) => String(quote.id).startsWith('lote-'))).toBe(true);
  });

  it.each(['settings', 'clients', 'quotes'] as const)(
    'un fallo al escribir %s aborta todo y conserva los tres grupos anteriores',
    async (target) => {
      await backupService.importBackup(makeBackup(`base-${target}`, { clients: 2, quotes: 3 }));
      const before = await rawSnapshot();
      const transactions = trackAtomicTransactions();
      const aborter = abortAfterSuccessfulPut(target);
      let successReached = false;

      try {
        await backupService.importBackup(makeBackup(`nuevo-${target}`, { clients: 3, quotes: 4 }));
        successReached = true;
      } catch (error) {
        expect(error).toEqual(
          new Error('No se pudo restaurar el respaldo. Tus datos anteriores se conservaron.')
        );
      }

      aborter.spy.mockRestore();
      const after = await rawSnapshot();
      expect(successReached).toBe(false);
      expect(aborter.triggerCount()).toBe(1);
      expect(transactions).toEqual({ writes: 1, completes: 0, aborts: 1 });
      expect(after).toEqual(before);
    }
  );

  it('un respaldo inválido no inicia ninguna transacción de escritura', async () => {
    const transactions = trackAtomicTransactions();

    expect(() => backupService.parseBackup('{"app":"otra-app"}')).toThrow(
      'no es un respaldo'
    );
    await expect(
      backupService.importBackup({
        app: 'emerald-dealer-quote',
        version: 2,
        exportedAt: '',
        settings: null,
        clients: null,
        quotes: []
      } as unknown as BackupFile)
    ).rejects.toThrow('faltan clientes');
    expect(transactions).toEqual({ writes: 0, completes: 0, aborts: 0 });
  });

  it('rechaza un abono con monto de texto sin iniciar escrituras parciales', async () => {
    const corrupted = makeBackup('abono-corrupto');
    corrupted.quotes[0].payments = [
      {
        id: 'payment-corrupto',
        amount: 'hola' as unknown as number,
        date: '2026-07-11',
        receivedBy: '',
        method: '',
        notes: ''
      }
    ];
    const transactions = trackAtomicTransactions();

    await expect(backupService.importBackup(corrupted)).rejects.toThrow('abono inválido');
    expect(transactions).toEqual({ writes: 0, completes: 0, aborts: 0 });
  });

  it('importa una imagen data URL de aproximadamente 5 MB sin romper la restauración', async () => {
    const large = makeBackup('imagen-grande');
    large.quotes[0].images = [`data:image/jpeg;base64,${'A'.repeat(5 * 1024 * 1024)}`];

    await backupService.importBackup(large);

    const restored = await storage.listQuotes();
    expect(restored[0].images[0]).toHaveLength(large.quotes[0].images[0].length);
  });

  it('rechaza identificadores duplicados antes de iniciar la escritura', async () => {
    const duplicateClients = makeBackup('duplicated-clients', { clients: 2 });
    duplicateClients.clients[1].id = duplicateClients.clients[0].id;
    const duplicateQuotes = makeBackup('duplicated-quotes', { quotes: 2 });
    duplicateQuotes.quotes[1].id = duplicateQuotes.quotes[0].id;
    const transactions = trackAtomicTransactions();

    await expect(backupService.importBackup(duplicateClients)).rejects.toThrow('clientes duplicados');
    await expect(backupService.importBackup(duplicateQuotes)).rejects.toThrow('cotizaciones duplicadas');
    expect(transactions).toEqual({ writes: 0, completes: 0, aborts: 0 });
  });

  it('rechaza identificadores vacíos antes de iniciar la escritura', async () => {
    const emptyClientId = makeBackup('empty-client');
    emptyClientId.clients[0].id = '   ';
    const emptyQuoteId = makeBackup('empty-quote');
    emptyQuoteId.quotes[0].id = '';
    const transactions = trackAtomicTransactions();

    await expect(backupService.importBackup(emptyClientId)).rejects.toThrow('clientes con identificador vacío');
    await expect(backupService.importBackup(emptyQuoteId)).rejects.toThrow('cotizaciones con identificador vacío');
    expect(transactions).toEqual({ writes: 0, completes: 0, aborts: 0 });
  });

  it('normaliza ajustes, clientes y cotizaciones antes de persistirlos', async () => {
    const raw = {
      app: 'emerald-dealer-quote',
      version: 1,
      exportedAt: '2026-07-11T12:00:00.000Z',
      settings: {
        ...sampleSettings(),
        currency: 'USD',
        logoDataUrl: 'https://example.com/logo.png',
        claveAjena: 'descartar'
      },
      clients: [
        {
          ...sampleClient({ id: 'normalized-client', name: 'Cliente normalizado' }),
          phone: 123,
          claveAjena: 'descartar'
        }
      ],
      quotes: [
        {
          ...sampleQuote({ id: 'normalized-quote', number: 'ED-2026-0999' }),
          pieceDescription: 42,
          production: {},
          images: ['https://example.com/rastreo.png'],
          claveAjena: 'descartar'
        }
      ]
    } as unknown as BackupFile;

    await backupService.importBackup(raw);

    const [storedSettings, storedClient, storedQuote] = await Promise.all([
      db.dbGet<Record<string, unknown>>('settings', storage.SETTINGS_KEY),
      db.dbGet<Record<string, unknown>>('clients', 'normalized-client'),
      db.dbGet<Record<string, unknown>>('quotes', 'normalized-quote')
    ]);
    expect(storedSettings).toEqual({ id: storage.SETTINGS_KEY, ...schema.normalizeSettings(raw.settings) });
    expect(storedClient).toEqual(schema.normalizeClient(raw.clients[0]));
    expect(storedQuote).toEqual(schema.normalizeQuote(raw.quotes[0]));
  });

  it('no muta el respaldo original durante la restauración', async () => {
    const original = makeBackup('inmutable', { clients: 2, quotes: 2, version: 1 });
    const before = JSON.parse(JSON.stringify(original));

    await backupService.importBackup(original);

    expect(original).toEqual(before);
  });

  it('las mismas lecturas usadas por reloadAll quedan coherentes después del commit', async () => {
    const next = makeBackup('reload', { clients: 3, quotes: 4 });

    await backupService.importBackup(next);
    const [settings, clients, quotes] = await Promise.all([
      storage.loadSettings(),
      storage.listClients(),
      storage.listQuotes()
    ]);

    expect(settings).toEqual(next.settings);
    expect(clients).toHaveLength(3);
    expect(quotes).toHaveLength(4);
    expect(quotes.every((quote) => clients.some((client) => client.id === quote.clientId))).toBe(true);
  });

  it.each([1, 2])('mantiene compatible el respaldo versión %i', async (version) => {
    const source = makeBackup(`version-${version}`, { version, clients: 2, quotes: 2 });
    const parsed = backupService.parseBackup(JSON.stringify(source));

    await backupService.importBackup(parsed);

    expect(parsed.version).toBe(backupService.BACKUP_VERSION);
    expect((await storage.listClients()).map((client) => client.id).sort()).toEqual(
      source.clients.map((client) => client.id).sort()
    );
    expect((await storage.listQuotes()).map((quote) => quote.id).sort()).toEqual(
      source.quotes.map((quote) => quote.id).sort()
    );
  });

  it('un respaldo sin ajustes reemplaza los anteriores por los valores por defecto', async () => {
    await backupService.importBackup(makeBackup('ajustes-anteriores'));
    const withoutSettings = makeBackup('sin-ajustes', { settings: null });

    await backupService.importBackup(withoutSettings);

    expect(await storage.loadSettings()).toEqual(storage.defaultSettings());
  });
});
