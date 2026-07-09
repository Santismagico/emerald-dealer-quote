// Capa mínima sobre IndexedDB con promesas. Sin dependencias externas.
// Almacena settings, clientes y cotizaciones de forma local (funciona offline).

const DB_NAME = 'emerald-dealer-quote';
const DB_VERSION = 1;

export type StoreName = 'settings' | 'clients' | 'quotes';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('clients')) {
        db.createObjectStore('clients', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('quotes')) {
        db.createObjectStore('quotes', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir la base de datos local.'));
  });
  return dbPromise;
}

function txRequest<T>(store: StoreName, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const request = run(tx.objectStore(store));
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error ?? new Error('Error de base de datos local.'));
      })
  );
}

export function dbPut(store: StoreName, value: unknown): Promise<void> {
  return txRequest<void>(store, 'readwrite', (s) => s.put(value));
}

export function dbGet<T>(store: StoreName, key: string): Promise<T | undefined> {
  return txRequest<T | undefined>(store, 'readonly', (s) => s.get(key));
}

export function dbGetAll<T>(store: StoreName): Promise<T[]> {
  return txRequest<T[]>(store, 'readonly', (s) => s.getAll());
}

export function dbDelete(store: StoreName, key: string): Promise<void> {
  return txRequest<void>(store, 'readwrite', (s) => s.delete(key));
}

export function dbClear(store: StoreName): Promise<void> {
  return txRequest<void>(store, 'readwrite', (s) => s.clear());
}
