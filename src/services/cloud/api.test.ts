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

  it('envía una transformación como una sola RPC sin aceptar costo escrito por el dispositivo', async () => {
    const calls: Array<{ name: string; args?: Record<string, unknown> }> = [];
    const reconciled: unknown[] = [];
    const authoritative = { lot: { id: 'lot-1' }, jewel: { id: 'jewel-1' } };
    const remote = createSupabaseCloudRemote(async () => ({
      from: () => ({ select: async () => ({ data: [], error: null }) }),
      rpc: async (name, args) => {
        calls.push({ name, args });
        return { data: authoritative, error: null };
      }
    }), async (payload) => { reconciled.push(payload); });
    await remote.execute({
      id: 'op-transform',
      table: 'stock_jewels',
      type: 'transform_stock_jewel',
      entityId: 'jewel-1',
      data: {
        id: 'transform-1',
        date: '2026-08-04',
        lotId: 'lot-1',
        jewelId: 'jewel-1',
        origin: 'tallado',
        carats: 0.5,
        quantity: 1,
        notes: 'Cambio de vitrina',
        costCop: 999_999_999
      },
      updatedAt: '2026-08-04T15:00:00.000Z',
      queuedAt: 1,
      attempts: 0,
      nextAttemptAt: 0
    });

    expect(calls).toEqual([{
      name: 'transform_stock_jewel_to_natural',
      args: {
        p_event_id: 'transform-1',
        p_date: '2026-08-04',
        p_lot_id: 'lot-1',
        p_jewel_id: 'jewel-1',
        p_origin: 'tallado',
        p_carats: 0.5,
        p_quantity: 1,
        p_notes: 'Cambio de vitrina',
        p_updated_at: '2026-08-04T15:00:00.000Z'
      }
    }]);
    expect(calls[0].args).not.toHaveProperty('p_cost_cop');
    expect(reconciled).toEqual([authoritative]);
  });

  it('traduce al español un rechazo concurrente del servidor', async () => {
    const remote = createSupabaseCloudRemote(async () => ({
      from: () => ({ select: async () => ({ data: [], error: null }) }),
      rpc: async () => ({
        data: null,
        error: { message: 'a sold stock jewel cannot be transformed' }
      })
    }));

    await expect(remote.execute({
      id: 'op-transform-rejected',
      table: 'stock_jewels',
      type: 'transform_stock_jewel',
      entityId: 'jewel-1',
      data: {
        id: 'transform-1',
        date: '2026-08-04',
        lotId: 'lot-1',
        jewelId: 'jewel-1',
        origin: 'bruto',
        carats: 1,
        quantity: 1,
        notes: ''
      },
      updatedAt: '2026-08-04T15:00:00.000Z',
      queuedAt: 1,
      attempts: 0,
      nextAttemptAt: 0
    })).rejects.toThrow(/joya ya fue vendida/i);
  });

  it('restaura el costo histórico y entrega la pareja autoritativa al dispositivo', async () => {
    const calls: Array<{ name: string; args?: Record<string, unknown> }> = [];
    const reconciled: unknown[] = [];
    const authoritative = { lot: { id: 'lot-1' }, jewel: { id: 'jewel-1' } };
    const remote = createSupabaseCloudRemote(async () => ({
      from: () => ({ select: async () => ({ data: [], error: null }) }),
      rpc: async (name, args) => {
        calls.push({ name, args });
        return { data: authoritative, error: null };
      }
    }), async (payload) => { reconciled.push(payload); });

    await remote.execute({
      id: 'op-restore',
      table: 'stock_jewels',
      type: 'restore_stock_jewel',
      entityId: 'jewel-1',
      data: {
        id: 'event-1',
        date: '2026-08-04',
        lotId: 'lot-1',
        jewelId: 'jewel-1',
        origin: 'bruto',
        carats: 1,
        quantity: 1,
        notes: '',
        costCop: 100_000
      },
      updatedAt: '2026-08-04T15:00:00.000Z',
      queuedAt: 1,
      attempts: 0,
      nextAttemptAt: 0
    });

    expect(calls).toEqual([{
      name: 'restore_stock_jewel_transformation',
      args: expect.objectContaining({
        p_event_id: 'event-1',
        p_cost_cop: 100_000,
        p_updated_at: '2026-08-04T15:00:00.000Z'
      })
    }]);
    expect(reconciled).toEqual([]);
  });

  it('usa puertas separadas para sembrar y finalizar una restauracion', async () => {
    const calls: Array<{ name: string; args?: Record<string, unknown> }> = [];
    const remote = createSupabaseCloudRemote(async () => ({
      from: () => ({ select: async () => ({ data: [], error: null }) }),
      rpc: async (name, args) => {
        calls.push({ name, args });
        return { data: null, error: null };
      }
    }));
    const operations = [
      ['seed_stone_lot_import', 'stone_lots', 'seed_stone_lot_transformation_import'],
      ['seed_stock_jewel_import', 'stock_jewels', 'seed_stock_jewel_transformation_import'],
      ['finalize_stone_lot_import', 'stone_lots', 'finalize_stone_lot_transformation_import'],
      ['finalize_stock_jewel_import', 'stock_jewels', 'finalize_stock_jewel_transformation_import']
    ] as const;

    for (const [type, table, name] of operations) {
      const data = type.startsWith('seed_')
        ? { baseline: { id: 'record-1', stage: 'baseline' }, final: { id: 'record-1', stage: 'final' } }
        : { id: 'record-1' };
      await remote.execute({
        id: `op-${type}`,
        table,
        type,
        entityId: 'record-1',
        data,
        updatedAt: '2026-08-04T15:00:00.000Z',
        queuedAt: 1,
        attempts: 0,
        nextAttemptAt: 0
      });
      expect(calls.at(-1)).toEqual(type.startsWith('seed_') ? {
        name,
        args: {
          p_id: 'record-1',
          p_baseline_data: { id: 'record-1', stage: 'baseline' },
          p_final_data: { id: 'record-1', stage: 'final' },
          p_updated_at: '2026-08-04T15:00:00.000Z'
        }
      } : {
        name,
        args: {
          p_id: 'record-1',
          p_data: { id: 'record-1' },
          p_updated_at: '2026-08-04T15:00:00.000Z'
        }
      });
    }
  });

  it('comprueba el permiso de importacion antes de escribir datos', async () => {
    const calls: Array<{ name: string; args?: Record<string, unknown> }> = [];
    const remote = createSupabaseCloudRemote(async () => ({
      from: () => ({ select: async () => ({ data: [], error: null }) }),
      rpc: async (name, args) => {
        calls.push({ name, args });
        return { data: null, error: null };
      }
    }));

    await remote.execute({
      id: 'authorize-import',
      table: 'org_settings',
      type: 'authorize_import',
      entityId: 'settings',
      data: null,
      updatedAt: '2026-08-04T15:00:00.000Z',
      queuedAt: 1,
      attempts: 0,
      nextAttemptAt: 0
    });

    expect(calls).toEqual([{ name: 'authorize_cloud_import', args: undefined }]);
  });
});
