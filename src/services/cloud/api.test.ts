import { describe, expect, it } from 'vitest';
import { createSupabaseCloudRemote, prepareCloudOperation } from './api';
import type { CloudOutboxOperation } from './outbox';

describe('adaptador de nube con Supabase simulado', () => {
  it('completa una cotización sin numerar con el consecutivo del servidor antes de subirla', async () => {
    const cached: unknown[] = [];
    let reservations = 0;
    const operation: CloudOutboxOperation = {
      id: 'op-offline', table: 'quotes', type: 'upsert', entityId: 'q-offline',
      data: { id: 'q-offline', number: '' }, updatedAt: '2026-07-18T10:00:00Z',
      queuedAt: 1, attempts: 0, nextAttemptAt: 0
    };

    const prepared = await prepareCloudOperation(
      { nextQuoteNumber: async () => `ED-2026-${String(++reservations).padStart(4, '0')}` },
      { put: async (_table, record) => void cached.push(record) },
      operation
    );

    expect(prepared.data).toEqual({ id: 'q-offline', number: 'ED-2026-0001' });
    expect(cached).toEqual([{
      id: 'q-offline', data: { id: 'q-offline', number: 'ED-2026-0001' },
      updatedAt: '2026-07-18T10:00:00Z'
    }]);
    expect(reservations).toBe(1);
  });

  it('no reserva otro consecutivo cuando la operación ya tiene número definitivo', async () => {
    let reservations = 0;
    const operation: CloudOutboxOperation = {
      id: 'op-numbered', table: 'quotes', type: 'upsert', entityId: 'q-numbered',
      data: { id: 'q-numbered', number: 'ED-2026-0042' }, updatedAt: '2026-07-18T10:00:00Z',
      queuedAt: 1, attempts: 0, nextAttemptAt: 0
    };

    const prepared = await prepareCloudOperation(
      { nextQuoteNumber: async () => { reservations += 1; return 'ED-2026-0043'; } },
      { put: async () => {} },
      operation
    );

    expect(prepared).toBe(operation);
    expect(reservations).toBe(0);
  });

  it('lee filas sin realizar una llamada de red real', async () => {
    const calls: string[] = [];
    const remote = createSupabaseCloudRemote(async () => ({
      from: (table) => ({
        select: async (columns) => {
          calls.push(`${table}:${columns}`);
          return { data: [{ id: 'c-1', data: { id: 'c-1' }, updated_at: '2026-07-18T10:00:00Z' }], error: null };
        }
      }),
      rpc: async () => ({ data: null, error: null })
    }));

    expect(await remote.list('clients')).toHaveLength(1);
    expect(calls).toEqual(['clients:id, data, updated_at']);
  });

  it('traduce una escritura a la operación protegida exacta', async () => {
    const calls: Array<{ name: string; args?: Record<string, unknown> }> = [];
    const remote = createSupabaseCloudRemote(async () => ({
      from: () => ({ select: async () => ({ data: [], error: null }) }),
      rpc: async (name, args) => {
        calls.push({ name, args });
        return { data: null, error: null };
      }
    }));
    const operation: CloudOutboxOperation = {
      id: 'op-1', table: 'quotes', type: 'upsert', entityId: 'q-1',
      data: { id: 'q-1' }, updatedAt: '2026-07-18T10:00:00Z',
      queuedAt: 1, attempts: 0, nextAttemptAt: 0
    };

    await remote.execute(operation);
    expect(calls).toEqual([{
      name: 'upsert_quote',
      args: { p_id: 'q-1', p_data: { id: 'q-1' }, p_updated_at: '2026-07-18T10:00:00Z' }
    }]);
  });
});
