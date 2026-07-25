// Cadena de nube del inventario de materiales (D-048/D-049).
//
// Lo fino que se prueba: cuando se renombra o se borra un SOCIO, la app
// reescribe su nombre (o suelta el vínculo) dentro de los lotes de material.
// Esos lotes también cambiaron, así que también tienen que subir. Si no, el
// otro dispositivo se queda con el nombre viejo.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory as FakeIDBFactory } from 'fake-indexeddb';
import type { MaterialLot, MaterialPartner } from '../../types';
import { createSupabaseCloudRemote } from './api';
import type { CloudOutboxOperation, CloudTable } from './outbox';

let api: typeof import('./api');
let storage: typeof import('../storage');

function fakeOutbox() {
  const enqueued: Array<{ table: CloudTable; type: string; entityId: string }> = [];
  return {
    enqueued,
    outbox: {
      enqueue: async (op: { table: CloudTable; type: string; entityId: string }) => {
        enqueued.push({ table: op.table, type: op.type, entityId: op.entityId });
        return op as unknown as CloudOutboxOperation;
      },
      flush: async () => ({ processed: 0, pending: 0 }),
      list: async () => [],
      status: async () => ({ pending: 0, held: 0, operations: [] }),
      retryHeld: async () => ({ processed: 0, pending: 0 })
    }
  };
}

const noopSync = { pullTable: async () => {}, pullAll: async () => {} };
const noopRemote = {
  list: async () => [],
  execute: async () => {},
  nextQuoteNumber: async () => 'ED-2026-0001'
};

function socio(overrides: Partial<MaterialPartner> = {}): MaterialPartner {
  return {
    id: 'soc-1',
    name: 'Socio Emerald',
    phone: '',
    city: '',
    notes: '',
    createdAt: '2026-07-24T09:00:00.000Z',
    ...overrides
  };
}

function loteDelSocio(): MaterialLot {
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
    uses: [],
    createdAt: '2026-07-20T09:00:00.000Z',
    updatedAt: '2026-07-20T09:00:00.000Z'
  };
}

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new FakeIDBFactory());
  storage = await import('../storage');
  api = await import('./api');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('renombrar un socio arrastra sus lotes a la nube', () => {
  it('sube el socio y el lote que cambió de nombre', async () => {
    await storage.saveMaterialPartner(socio());
    await storage.saveMaterialLot(loteDelSocio());

    const { enqueued, outbox } = fakeOutbox();
    const source = api.createCloudDataSource({ remote: noopRemote, outbox, sync: noopSync });

    await source.saveMaterialPartner(socio({ name: 'Socio Renombrado' }));

    expect(enqueued).toEqual(
      expect.arrayContaining([
        { table: 'material_partners', type: 'upsert', entityId: 'soc-1' },
        { table: 'material_lots', type: 'upsert', entityId: 'l-1' }
      ])
    );
  });

  it('no sube lotes que no cambiaron', async () => {
    await storage.saveMaterialPartner(socio());
    await storage.saveMaterialLot(loteDelSocio());

    const { enqueued, outbox } = fakeOutbox();
    const source = api.createCloudDataSource({ remote: noopRemote, outbox, sync: noopSync });

    await source.saveMaterialPartner(socio({ phone: '3000000000' }));

    expect(enqueued.filter((op) => op.table === 'material_lots')).toEqual([]);
    expect(enqueued.filter((op) => op.table === 'material_partners')).toHaveLength(1);
  });
});

describe('borrar un socio arrastra sus lotes a la nube', () => {
  it('encola el borrado y la actualización del lote, y conserva el reparto', async () => {
    await storage.saveMaterialPartner(socio());
    await storage.saveMaterialLot(loteDelSocio());

    const { enqueued, outbox } = fakeOutbox();
    const source = api.createCloudDataSource({ remote: noopRemote, outbox, sync: noopSync });

    await source.deleteMaterialPartner('soc-1');

    expect(enqueued).toEqual(
      expect.arrayContaining([
        { table: 'material_partners', type: 'delete', entityId: 'soc-1' },
        { table: 'material_lots', type: 'upsert', entityId: 'l-1' }
      ])
    );

    const [lot] = await storage.listMaterialLots();
    expect(lot.partnerId).toBeNull();
    expect(lot.partnerName).toBe('Socio Emerald');
    expect(lot.myGrams).toBe(60);
  });
});

describe('lotes de material viajan por su tabla protegida', () => {
  it('guardar y borrar un lote usa material_lots', async () => {
    const { enqueued, outbox } = fakeOutbox();
    const source = api.createCloudDataSource({ remote: noopRemote, outbox, sync: noopSync });

    await source.saveMaterialLot(loteDelSocio());
    await storage.saveMaterialLot(loteDelSocio());
    await source.deleteMaterialLot('l-1');

    expect(enqueued).toEqual([
      { table: 'material_lots', type: 'upsert', entityId: 'l-1' },
      { table: 'material_lots', type: 'delete', entityId: 'l-1' }
    ]);
    expect(await storage.listMaterialLots()).toEqual([]);
  });
});

describe('las operaciones protegidas del servidor son las correctas', () => {
  it('cada tabla nueva llama a su propia función, sin mandar organization_id', async () => {
    const calls: Array<{ name: string; args?: Record<string, unknown> }> = [];
    const remote = createSupabaseCloudRemote(async () => ({
      from: () => ({ select: async () => ({ data: [], error: null }) }),
      rpc: async (name, args) => {
        calls.push({ name, args });
        return { data: null, error: null };
      }
    }));

    const base = {
      id: 'op',
      updatedAt: '2026-07-24T10:00:00Z',
      queuedAt: 1,
      attempts: 0,
      nextAttemptAt: 0
    };
    await remote.execute({ ...base, table: 'material_partners', type: 'upsert', entityId: 'soc-1', data: { id: 'soc-1' } });
    await remote.execute({ ...base, table: 'material_partners', type: 'delete', entityId: 'soc-1', data: null });
    await remote.execute({ ...base, table: 'material_lots', type: 'upsert', entityId: 'l-1', data: { id: 'l-1' } });
    await remote.execute({ ...base, table: 'material_lots', type: 'delete', entityId: 'l-1', data: null });

    expect(calls.map((c) => c.name)).toEqual([
      'upsert_material_partner',
      'delete_material_partner',
      'upsert_material_lot',
      'delete_material_lot'
    ]);
    for (const call of calls) {
      expect(Object.keys(call.args ?? {})).not.toContain('p_organization_id');
    }
  });
});
