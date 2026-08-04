import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory as FakeIDBFactory } from 'fake-indexeddb';
import type { Expense, MaterialPartner } from '../../types';
import { createSupabaseCloudRemote } from './api';
import type { CloudOutboxOperation, CloudTable } from './outbox';

let api: typeof import('./api');
let storage: typeof import('../storage');

function fakeOutbox() {
  const enqueued: Array<{ table: CloudTable; type: string; entityId: string; data?: unknown }> = [];
  return {
    enqueued,
    outbox: {
      enqueue: async (op: { table: CloudTable; type: string; entityId: string; data?: unknown }) => {
        enqueued.push(op);
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
  list: async () => [], execute: async () => {}, nextQuoteNumber: async () => 'ED-2026-0001'
};

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'g-1', date: '2026-08-03', concept: 'Feria', category: 'Publicidad',
    amountCop: 300000, method: 'Transferencia', paidBy: 'Santiago',
    partnerId: 'soc-1', partnerName: 'Socio Emerald', myPercent: 60, notes: '',
    createdAt: '2026-08-03T10:00:00.000Z', updatedAt: '2026-08-03T10:00:00.000Z',
    ...overrides
  };
}

function partner(overrides: Partial<MaterialPartner> = {}): MaterialPartner {
  return {
    id: 'soc-1', name: 'Socio Emerald', phone: '', city: '', notes: '',
    createdAt: '2026-08-03T09:00:00.000Z', ...overrides
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

describe('gastos viajan por su tabla protegida', () => {
  it('guardar y borrar conserva la carga completa en expenses', async () => {
    const { enqueued, outbox } = fakeOutbox();
    const source = api.createCloudDataSource({ remote: noopRemote, outbox, sync: noopSync });
    await source.saveExpense(expense());
    await source.deleteExpense('g-1');

    expect(enqueued.map(({ table, type, entityId }) => ({ table, type, entityId }))).toEqual([
      { table: 'expenses', type: 'upsert', entityId: 'g-1' },
      { table: 'expenses', type: 'delete', entityId: 'g-1' }
    ]);
    expect(enqueued[0].data).toMatchObject({
      amountCop: 300000, method: 'Transferencia', paidBy: 'Santiago',
      partnerName: 'Socio Emerald', myPercent: 60
    });
  });

  it('rechaza el porcentaje original antes de normalizar o encolar', async () => {
    const { enqueued, outbox } = fakeOutbox();
    const source = api.createCloudDataSource({ remote: noopRemote, outbox, sync: noopSync });
    await expect(source.saveExpense(expense({ myPercent: 101 }))).rejects.toThrow(/porcentaje/);
    expect(enqueued).toEqual([]);
    expect(await storage.listExpenses()).toEqual([]);
  });
});

describe('cambios de socio arrastran sus gastos a la nube', () => {
  it('renombrar y borrar encola el gasto cambiado y conserva su reparto', async () => {
    await storage.saveMaterialPartner(partner());
    await storage.saveExpense(expense());
    const { enqueued, outbox } = fakeOutbox();
    const source = api.createCloudDataSource({ remote: noopRemote, outbox, sync: noopSync });

    await source.saveMaterialPartner(partner({ name: 'Socio Renombrado' }));
    expect(enqueued).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'expenses', type: 'upsert', entityId: 'g-1' })
    ]));
    enqueued.length = 0;

    await source.deleteMaterialPartner('soc-1');
    expect(enqueued).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'expenses', type: 'upsert', entityId: 'g-1' })
    ]));
    expect((await storage.listExpenses())[0]).toMatchObject({
      partnerId: null, partnerName: 'Socio Renombrado', myPercent: 60
    });
  });
});

describe('RPC protegidas de gastos', () => {
  it('usa upsert_expense/delete_expense sin mandar organization_id', async () => {
    const calls: Array<{ name: string; args?: Record<string, unknown> }> = [];
    const remote = createSupabaseCloudRemote(async () => ({
      from: () => ({ select: async () => ({ data: [], error: null }) }),
      rpc: async (name, args) => {
        calls.push({ name, args });
        return { data: null, error: null };
      }
    }));
    const base = {
      id: 'op', table: 'expenses' as const, entityId: 'g-1',
      updatedAt: '2026-08-03T10:00:00.000Z', queuedAt: 1, attempts: 0, nextAttemptAt: 0
    };
    await remote.execute({ ...base, type: 'upsert', data: expense() });
    await remote.execute({ ...base, type: 'delete', data: null });
    expect(calls.map((call) => call.name)).toEqual(['upsert_expense', 'delete_expense']);
    expect(calls[0].args).toMatchObject({ p_id: 'g-1', p_data: expense() });
    for (const call of calls) expect(call.args).not.toHaveProperty('p_organization_id');
  });
});
