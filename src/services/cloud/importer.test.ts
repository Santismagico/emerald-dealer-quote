import { describe, expect, it, vi } from 'vitest';
import type {
  Appointment,
  BackupFile,
  Buyer,
  Client,
  Quote,
  Settings,
  StockJewel,
  StoneLot,
  Supplier
} from '../../types';
import { sampleQuote, sampleSettings } from '../../test/fixtures';
import {
  countImportRecords,
  hasLocalDataToImport,
  importToCloud,
  isCloudEmpty,
  type CloudImportWriter
} from './importer';

function largeBackup(): BackupFile {
  return {
    app: 'emerald-dealer-quote',
    version: 5,
    exportedAt: '2026-07-18T15:00:00Z',
    settings: sampleSettings(),
    clients: [],
    quotes: Array.from({ length: 200 }, (_, index) => sampleQuote({
      id: `q-${index}`,
      number: `ED-2026-${String(index).padStart(4, '0')}`,
      images: [`data:image/jpeg;base64,imagen-${index}`],
      updatedAt: `2026-07-18T15:${String(index % 60).padStart(2, '0')}:00Z`
    })),
    appointments: [],
    stoneLots: [],
    suppliers: [],
    buyers: [],
    stockJewels: []
  };
}

function memoryWriter() {
  const values = {
    settings: null as Settings | null,
    clients: new Map<string, Client>(),
    quotes: new Map<string, Quote>(),
    appointments: new Map<string, Appointment>(),
    stoneLots: new Map<string, StoneLot>(),
    suppliers: new Map<string, Supplier>(),
    buyers: new Map<string, Buyer>(),
    stockJewels: new Map<string, StockJewel>()
  };
  let flushes = 0;
  const writer: CloudImportWriter = {
    saveSettings: async (settings) => { values.settings = settings; },
    saveClient: async (client) => void values.clients.set(client.id, client),
    saveQuote: async (quote) => void values.quotes.set(quote.id, quote),
    saveAppointment: async (appointment) => void values.appointments.set(appointment.id, appointment),
    saveStoneLot: async (lot) => void values.stoneLots.set(lot.id, lot),
    saveSupplier: async (supplier) => void values.suppliers.set(supplier.id, supplier),
    saveBuyer: async (buyer) => void values.buyers.set(buyer.id, buyer),
    saveStockJewel: async (jewel) => void values.stockJewels.set(jewel.id, jewel),
    flush: async () => { flushes += 1; },
    pendingCount: async () => 0
  };
  return { writer, values, flushes: () => flushes };
}

describe('importación inicial a la nube', () => {
  it('sube un respaldo grande de 200 cotizaciones por lotes y conserva imágenes', async () => {
    const backup = largeBackup();
    const target = memoryWriter();
    const progress = vi.fn();

    await importToCloud(backup, { writer: target.writer, batchSize: 25, onProgress: progress });

    expect(countImportRecords(backup)).toBe(201);
    expect(target.values.quotes.size).toBe(200);
    expect(target.values.quotes.get('q-199')?.images).toEqual(['data:image/jpeg;base64,imagen-199']);
    expect(target.flushes()).toBe(9);
    expect(progress.mock.calls.at(-1)?.[0]).toMatchObject({ completed: 201, total: 201, percent: 100 });
  });

  it('repetir la misma importación conserva ids y no duplica registros', async () => {
    const backup = largeBackup();
    const target = memoryWriter();

    await importToCloud(backup, { writer: target.writer, batchSize: 50 });
    await importToCloud(backup, { writer: target.writer, batchSize: 50 });

    expect(target.values.quotes.size).toBe(200);
    expect([...target.values.quotes.keys()][0]).toBe('q-0');
  });

  it('detecta si el dispositivo tiene información y si la nube está vacía', async () => {
    expect(hasLocalDataToImport(largeBackup())).toBe(true);
    expect(await isCloudEmpty({ list: async () => [] })).toBe(true);
    expect(await isCloudEmpty({
      list: async (table) => table === 'clients'
        ? [{ id: 'c-1', data: {}, updated_at: '2026-07-18T15:00:00Z' }]
        : []
    })).toBe(false);
  });

  it('si se interrumpe internet, informa que la cola quedó protegida', async () => {
    const backup = largeBackup();
    const target = memoryWriter();
    target.writer.pendingCount = async () => 10;

    await expect(importToCloud(backup, { writer: target.writer, batchSize: 25 })).rejects.toThrow(
      'Lo pendiente quedó guardado'
    );
  });
});
