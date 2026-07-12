// Capa mínima sobre IndexedDB con promesas. Sin dependencias externas.
// Almacena settings, clientes y cotizaciones de forma local (funciona offline).

const DB_NAME = 'emerald-dealer-quote';
const DB_VERSION = 1;

export type StoreName = 'settings' | 'clients' | 'quotes';

type StoreAccessor = (store: StoreName) => IDBObjectStore;

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
        let result!: T;
        request.onsuccess = () => {
          result = request.result as T;
        };
        request.onerror = () => reject(request.error ?? new Error('Error de base de datos local.'));
        // Una solicitud exitosa todavía puede pertenecer a una transacción sin confirmar.
        // Resolver al completar la transacción garantiza que "Guardado" signifique commit real.
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error ?? request.error ?? new Error('Error de base de datos local.'));
        tx.onabort = () => reject(tx.error ?? new Error('La operación de base de datos fue cancelada.'));
      })
  );
}

/**
 * Ejecuta varias escrituras dentro de UNA sola transacción IndexedDB.
 * El callback debe encolar sus solicitudes de forma síncrona: la promesa se
 * resuelve únicamente cuando IndexedDB confirma el commit completo.
 */
export function dbWriteTransaction(
  stores: readonly StoreName[],
  run: (getStore: StoreAccessor) => void
): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        let tx: IDBTransaction;
        try {
          tx = db.transaction([...stores], 'readwrite');
        } catch (error) {
          reject(error instanceof Error ? error : new Error('No se pudo iniciar la operación local.'));
          return;
        }

        let settled = false;
        let callbackError: unknown;
        const rejectOnce = (fallback: string) => {
          if (settled) return;
          settled = true;
          reject(
            callbackError instanceof Error
              ? callbackError
              : tx.error ?? new Error(fallback)
          );
        };

        tx.oncomplete = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        // Un error de solicitud aborta la transacción por defecto. Se espera
        // onabort para rechazar solo después de que IndexedDB termine el rollback.
        tx.onerror = () => {};
        tx.onabort = () => rejectOnce('La operación local fue cancelada.');

        try {
          run((store) => tx.objectStore(store));
        } catch (error) {
          callbackError = error;
          try {
            tx.abort();
          } catch {
            rejectOnce('No se pudo completar la operación local.');
          }
        }
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
