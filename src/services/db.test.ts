import { afterEach, describe, expect, it, vi } from 'vitest';

function fakeIndexedDb() {
  const requestedStores: string[] = [];
  let abortCalls = 0;
  const request = {
    result: undefined,
    error: null,
    onsuccess: null,
    onerror: null
  } as unknown as IDBRequest;
  const objectStore = {
    put: () => request
  } as unknown as IDBObjectStore;
  const transaction = {
    error: null,
    oncomplete: null,
    onerror: null,
    onabort: null,
    objectStore: (name: string) => {
      requestedStores.push(name);
      return objectStore;
    },
    abort: () => {
      abortCalls += 1;
    }
  } as unknown as IDBTransaction;
  const database = {
    transaction: () => transaction
  } as unknown as IDBDatabase;
  const openRequest = {
    result: database,
    error: null,
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null
  } as unknown as IDBOpenDBRequest;
  const indexedDb = {
    open: () => openRequest
  } as unknown as IDBFactory;

  return {
    indexedDb,
    openRequest,
    request,
    transaction,
    requestedStores,
    abortCalls: () => abortCalls
  };
}

async function startPut() {
  vi.resetModules();
  const fake = fakeIndexedDb();
  vi.stubGlobal('indexedDB', fake.indexedDb);
  const { dbPut } = await import('./db');
  const saving = dbPut('quotes', { id: 'q-transaction' });
  fake.openRequest.onsuccess?.call(fake.openRequest, {} as Event);
  await Promise.resolve();
  return { ...fake, saving };
}

describe('confirmación de transacciones IndexedDB', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('no informa guardado hasta que la transacción completa', async () => {
    const { request, transaction, saving } = await startPut();
    let resolved = false;
    void saving.then(() => {
      resolved = true;
    });

    request.onsuccess?.call(request, {} as Event);
    await Promise.resolve();
    expect(resolved).toBe(false);

    transaction.oncomplete?.call(transaction, {} as Event);
    await saving;
    expect(resolved).toBe(true);
  });

  it('rechaza el guardado si la transacción se aborta después de aceptar la solicitud', async () => {
    const { request, transaction, saving } = await startPut();
    request.onsuccess?.call(request, {} as Event);
    transaction.onabort?.call(transaction, {} as Event);

    await expect(saving).rejects.toThrow('cancelada');
  });

  it('la escritura multi-store se confirma una sola vez después de oncomplete', async () => {
    vi.resetModules();
    const fake = fakeIndexedDb();
    vi.stubGlobal('indexedDB', fake.indexedDb);
    const { dbWriteTransaction } = await import('./db');
    const saving = dbWriteTransaction(['settings', 'clients', 'quotes'], (getStore) => {
      getStore('settings');
      getStore('clients');
      getStore('quotes');
    });
    fake.openRequest.onsuccess?.call(fake.openRequest, {} as Event);
    await Promise.resolve();
    let completions = 0;
    void saving.then(() => {
      completions += 1;
    });

    expect(fake.requestedStores).toEqual(['settings', 'clients', 'quotes']);
    expect(completions).toBe(0);
    fake.transaction.oncomplete?.call(fake.transaction, {} as Event);
    await saving;
    fake.transaction.oncomplete?.call(fake.transaction, {} as Event);
    await Promise.resolve();
    expect(completions).toBe(1);
  });

  it('si el callback falla, solicita aborto y espera onabort antes de rechazar', async () => {
    vi.resetModules();
    const fake = fakeIndexedDb();
    vi.stubGlobal('indexedDB', fake.indexedDb);
    const { dbWriteTransaction } = await import('./db');
    const saving = dbWriteTransaction(['settings', 'clients', 'quotes'], () => {
      throw new Error('fallo simulado');
    });
    fake.openRequest.onsuccess?.call(fake.openRequest, {} as Event);
    await Promise.resolve();
    let rejected = false;
    void saving.catch(() => {
      rejected = true;
    });

    expect(fake.abortCalls()).toBe(1);
    expect(rejected).toBe(false);
    fake.transaction.onabort?.call(fake.transaction, {} as Event);
    await expect(saving).rejects.toThrow('fallo simulado');
    expect(rejected).toBe(true);
  });
});
