import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory as FakeIDBFactory } from 'fake-indexeddb';
import type { FundContribution, MaterialPartner } from '../../types';
import type { CloudOutboxOperation, CloudTable } from './outbox';

let api: typeof import('./api');
let storage: typeof import('../storage');
let syncModule: typeof import('./sync');

function contribution(overrides: Partial<FundContribution> = {}): FundContribution {
  return {
    id: 'aporte-1',
    personId: 'soc-1',
    personName: 'Socio Emerald',
    date: '2026-08-01',
    amountCop: 3_000_000,
    returnKind: 'mensual',
    monthlyRatePercent: 2,
    agreedTotalCop: null,
    dueDate: '',
    payments: [],
    notes: '',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    ...overrides
  };
}

function partner(overrides: Partial<MaterialPartner> = {}): MaterialPartner {
  return {
    id: 'soc-1',
    name: 'Socio Emerald',
    phone: '',
    city: '',
    notes: '',
    createdAt: '2026-08-01T09:00:00.000Z',
    ...overrides
  };
}

function fakeOutbox() {
  const enqueued: Array<{
    table: CloudTable;
    type: string;
    entityId: string;
    data?: unknown;
  }> = [];
  return {
    enqueued,
    outbox: {
      enqueue: async (operation: {
        table: CloudTable;
        type: string;
        entityId: string;
        data?: unknown;
      }) => {
        enqueued.push(operation);
        return operation as unknown as CloudOutboxOperation;
      },
      flush: async () => ({ processed: 0, pending: 0 }),
      list: async () => [],
      status: async () => ({ pending: 0, held: 0, operations: [] }),
      retryHeld: async () => ({ processed: 0, pending: 0 })
    }
  };
}

const noopRemote = {
  list: async () => [],
  execute: async () => {},
  nextQuoteNumber: async () => 'ED-2026-0001'
};

const noopSync = {
  pullTable: async () => {},
  pullStoneJewelPair: async () => {},
  pullAll: async () => {}
};

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new FakeIDBFactory());
  storage = await import('../storage');
  syncModule = await import('./sync');
  api = await import('./api');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('Fondo conectado a la nube', () => {
  it('guardar y borrar usa la tabla protegida y conserva la carga completa', async () => {
    const { enqueued, outbox } = fakeOutbox();
    const source = api.createCloudDataSource({ remote: noopRemote, outbox, sync: noopSync });

    await source.saveFundContribution(contribution());
    await source.deleteFundContribution('aporte-1');

    expect(enqueued).toEqual([
      expect.objectContaining({
        table: 'fund_contributions',
        type: 'upsert',
        entityId: 'aporte-1',
        data: expect.objectContaining({ personName: 'Socio Emerald', amountCop: 3_000_000 })
      }),
      expect.objectContaining({
        table: 'fund_contributions', type: 'delete', entityId: 'aporte-1'
      })
    ]);
  });

  it('sube una sola vez los aportes que ya existían en el dispositivo', async () => {
    await storage.saveFundContribution(contribution());
    const { enqueued, outbox } = fakeOutbox();
    const source = api.createCloudDataSource({ remote: noopRemote, outbox, sync: noopSync });

    expect(await source.listFundContributions()).toHaveLength(1);
    expect(await source.listFundContributions()).toHaveLength(1);

    expect(enqueued.filter((operation) => operation.table === 'fund_contributions')).toHaveLength(1);
  });

  it('un aporte ya recibido de la nube no se vuelve a encolar', async () => {
    const remoteContribution = contribution({
      personName: 'Versión nube',
      updatedAt: '2026-08-02T10:00:00.000Z'
    });
    const { enqueued, outbox } = fakeOutbox();
    const sync = {
      ...noopSync,
      async pullTable(table: CloudTable) {
        if (table !== 'fund_contributions') return;
        await syncModule.indexedDbSyncCache.put(table, {
          id: remoteContribution.id,
          data: remoteContribution,
          updatedAt: remoteContribution.updatedAt,
          seenInCloud: true
        });
      }
    };
    const source = api.createCloudDataSource({ remote: noopRemote, outbox, sync });

    expect((await source.listFundContributions())[0].personName).toBe('Versión nube');
    expect(enqueued).toEqual([]);
  });

  it('rechaza dinero no entero antes de guardar o encolar', async () => {
    const { enqueued, outbox } = fakeOutbox();
    const source = api.createCloudDataSource({ remote: noopRemote, outbox, sync: noopSync });

    await expect(
      source.saveFundContribution(contribution({ amountCop: 10.5 }))
    ).rejects.toThrow(/pesos/);
    expect(enqueued).toEqual([]);
    expect(await storage.listFundContributions()).toEqual([]);
  });
});

describe('cambios de persona llegan también al Fondo', () => {
  it('renombrar y borrar encola el aporte, conservando su historia', async () => {
    await storage.saveMaterialPartner(partner());
    await storage.saveFundContribution(contribution());
    const { enqueued, outbox } = fakeOutbox();
    const source = api.createCloudDataSource({ remote: noopRemote, outbox, sync: noopSync });

    await source.saveMaterialPartner(partner({ name: 'Socio Renombrado' }));
    expect(enqueued).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'fund_contributions', type: 'upsert', entityId: 'aporte-1'
      })
    ]));
    expect((await storage.listFundContributions())[0]).toMatchObject({
      personId: 'soc-1', personName: 'Socio Renombrado', amountCop: 3_000_000
    });

    enqueued.length = 0;
    await source.deleteMaterialPartner('soc-1');
    expect(enqueued).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'fund_contributions', type: 'upsert', entityId: 'aporte-1'
      })
    ]));
    expect((await storage.listFundContributions())[0]).toMatchObject({
      personId: null, personName: 'Socio Renombrado', amountCop: 3_000_000
    });
  });
});

describe('funciones protegidas del Fondo', () => {
  it('usa las dos funciones exactas sin aceptar organization_id del dispositivo', async () => {
    const calls: Array<{ name: string; args?: Record<string, unknown> }> = [];
    const remote = api.createSupabaseCloudRemote(async () => ({
      from: () => ({ select: async () => ({ data: [], error: null }) }),
      rpc: async (name, args) => {
        calls.push({ name, args });
        return { data: null, error: null };
      }
    }));
    const base = {
      id: 'op-fund',
      table: 'fund_contributions' as const,
      entityId: 'aporte-1',
      updatedAt: '2026-08-01T10:00:00.000Z',
      queuedAt: 1,
      attempts: 0,
      nextAttemptAt: 0
    };

    await remote.execute({ ...base, type: 'upsert', data: contribution() });
    await remote.execute({ ...base, type: 'delete', data: null });

    expect(calls.map((call) => call.name)).toEqual([
      'upsert_fund_contribution',
      'delete_fund_contribution'
    ]);
    for (const call of calls) expect(call.args).not.toHaveProperty('p_organization_id');
  });
});
