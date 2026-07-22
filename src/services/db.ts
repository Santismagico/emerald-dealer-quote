// Capa mínima sobre IndexedDB con promesas. Sin dependencias externas.
// Almacena settings, clientes, cotizaciones, citas y lotes de piedras
// de forma local (funciona offline).

const DB_NAME = 'emerald-dealer-quote';

export type StoreName =
  | 'settings'
  | 'clients'
  | 'quotes'
  | 'appointments'
  | 'stoneLots'
  | 'suppliers'
  | 'cloudOutbox'
  | 'buyers'
  | 'stockJewels';

type StoreAccessor = (store: StoreName) => IDBObjectStore;

type MigratableDb = Pick<IDBDatabase, 'createObjectStore' | 'objectStoreNames'>;

function createStoreIfMissing(db: MigratableDb, name: StoreName): void {
  // Guardia idempotente: si una base quedó a medio migrar, no falla al reintentar.
  if (!db.objectStoreNames.contains(name)) {
    db.createObjectStore(name, { keyPath: 'id' });
  }
}

/**
 * Escalera de migraciones: la posición N crea lo que estrena la versión N+1.
 * NUNCA reordenar ni eliminar entradas; solo agregar al final y los datos de
 * versiones anteriores se conservan intactos.
 */
const DB_MIGRATIONS: Array<(db: MigratableDb) => void> = [
  // v1 — almacenes originales del MVP.
  (db) => {
    createStoreIfMissing(db, 'settings');
    createStoreIfMissing(db, 'clients');
    createStoreIfMissing(db, 'quotes');
  },
  // v2 — agenda de asesorías (Etapa 7 del Ecosistema).
  (db) => {
    createStoreIfMissing(db, 'appointments');
  },
  // v3 — lotes de piedras con sus ventas (Etapa 8 del Ecosistema).
  (db) => {
    createStoreIfMissing(db, 'stoneLots');
  },
  // v4 — proveedores (corrección C3, 2026-07-16).
  (db) => {
    createStoreIfMissing(db, 'suppliers');
  },
  // v5 — cola persistente para sincronización con la nube (Fase 2 N2).
  (db) => {
    createStoreIfMissing(db, 'cloudOutbox');
  },
  // v6 — compradores y joyas en stock (ampliación de inventario, D-043/D-044).
  (db) => {
    createStoreIfMissing(db, 'buyers');
    createStoreIfMissing(db, 'stockJewels');
  }
];

export const DB_VERSION = DB_MIGRATIONS.length;

/** Aplica en orden solo las migraciones que le faltan a la base abierta. */
export function applyDbMigrations(db: MigratableDb, oldVersion: number): void {
  for (let version = Math.max(0, oldVersion); version < DB_MIGRATIONS.length; version += 1) {
    DB_MIGRATIONS[version](db);
  }
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      applyDbMigrations(request.result, event.oldVersion);
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

/**
 * Lee, transforma y guarda un registro dentro de UNA sola transacción.
 * Las transacciones readwrite del mismo almacén se ejecutan en orden, por lo
 * que dos acciones simultáneas no pueden basarse en el mismo valor anterior.
 */
export function dbUpdate<T>(
  store: StoreName,
  key: string,
  update: (current: T | undefined) => T
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        let tx: IDBTransaction;
        try {
          tx = db.transaction(store, 'readwrite');
        } catch (error) {
          reject(
            error instanceof Error ? error : new Error('No se pudo iniciar la operación local.')
          );
          return;
        }

        const objectStore = tx.objectStore(store);
        const request = objectStore.get(key);
        let next!: T;
        let callbackError: unknown;
        let settled = false;

        const rejectOnce = (fallback: string) => {
          if (settled) return;
          settled = true;
          reject(callbackError instanceof Error ? callbackError : tx.error ?? new Error(fallback));
        };

        request.onsuccess = () => {
          try {
            next = update(request.result as T | undefined);
            objectStore.put(next);
          } catch (error) {
            callbackError = error;
            try {
              tx.abort();
            } catch {
              rejectOnce('No se pudo completar la operación local.');
            }
          }
        };
        // Los errores de get/put abortan la transacción. Se rechaza en onabort
        // después de que IndexedDB termine el rollback.
        request.onerror = () => {};
        tx.onerror = () => {};
        tx.onabort = () => rejectOnce('La operación local fue cancelada.');
        tx.oncomplete = () => {
          if (settled) return;
          settled = true;
          resolve(next);
        };
      })
  );
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
