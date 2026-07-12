import { afterEach, describe, expect, it, vi } from 'vitest';

function fakeIndexedDb() {
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
    objectStore: () => objectStore
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

  return { indexedDb, openRequest, request, transaction };
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
});
