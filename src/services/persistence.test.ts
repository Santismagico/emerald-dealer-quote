// Pruebas de persistencia y respaldo usando fake-indexeddb (simula IndexedDB en Node).
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import {
  saveQuote,
  listQuotes,
  deleteQuote,
  saveClient,
  listClients,
  loadSettings,
  saveSettings,
  nextQuoteNumber,
  defaultSettings,
  recordBackupExported,
  snoozeBackupReminder,
  ensureBackupReminderFirstDataAt,
  updateSettingsAtomically,
  saveEditableSettings,
  saveFetchedGoldPrice
} from './storage';
import {
  exportBackup,
  serializeBackup,
  parseBackup,
  importBackup,
  MAX_BACKUP_FILE_BYTES
} from './backup';
import { sampleQuote, sampleClient } from '../test/fixtures';
import { getEffectiveQuoteStatus } from './quoteStatus';
import { dbGet, dbPut } from './db';

describe('persistencia de cotizaciones', () => {
  it('guarda y recupera una cotización', async () => {
    const quote = sampleQuote();
    await saveQuote(quote);
    const quotes = await listQuotes();
    expect(quotes.find((q) => q.id === quote.id)).toEqual(quote);
  });

  it('actualiza una cotización existente sin duplicarla', async () => {
    const quote = sampleQuote({ id: 'q-upd' });
    await saveQuote(quote);
    await saveQuote({ ...quote, status: 'aprobada', updatedAt: '2026-07-08T00:00:00.000Z' });
    const quotes = (await listQuotes()).filter((q) => q.id === 'q-upd');
    expect(quotes).toHaveLength(1);
    expect(quotes[0].status).toBe('aprobada');
  });

  it('elimina una cotización', async () => {
    const quote = sampleQuote({ id: 'q-del' });
    await saveQuote(quote);
    await deleteQuote('q-del');
    const quotes = await listQuotes();
    expect(quotes.find((q) => q.id === 'q-del')).toBeUndefined();
  });

  it('calcula el vencimiento sin escribir el estado ni updatedAt en IndexedDB', async () => {
    const quote = sampleQuote({
      id: 'q-derived-expired',
      status: 'pendiente',
      validUntil: '2026-07-10',
      updatedAt: '2026-07-01T08:00:00.000Z'
    });
    await saveQuote(quote);

    const loaded = (await listQuotes()).find((item) => item.id === quote.id);
    expect(loaded).toBeDefined();
    expect(getEffectiveQuoteStatus(loaded!, '2026-07-11')).toBe('vencida');

    const persisted = (await listQuotes()).find((item) => item.id === quote.id);
    expect(persisted?.status).toBe('pendiente');
    expect(persisted?.updatedAt).toBe('2026-07-01T08:00:00.000Z');
  });
});

describe('persistencia normalizada de clientes', () => {
  it('listClients normaliza clientes antiguos e incompletos', async () => {
    await dbPut('clients', {
      id: 'c-legacy-normalize',
      name: 42,
      phone: 3001234567,
      email: null,
      notes: ['anterior']
    });

    const client = (await listClients()).find((item) => item.id === 'c-legacy-normalize');
    expect(client).toEqual({
      id: 'c-legacy-normalize',
      name: '',
      phone: '',
      email: '',
      city: '',
      document: '',
      notes: '',
      createdAt: ''
    });
  });

  it('listClients descarta claves desconocidas', async () => {
    await dbPut('clients', {
      ...sampleClient({ id: 'c-legacy-extra', name: 'Cliente con clave extra' }),
      claveAjena: 'no debe llegar a la interfaz'
    });

    const client = (await listClients()).find((item) => item.id === 'c-legacy-extra');
    expect(client).toEqual(sampleClient({ id: 'c-legacy-extra', name: 'Cliente con clave extra' }));
    expect(client && 'claveAjena' in client).toBe(false);
  });

  it('listClients conserva un orden alfabético estable', async () => {
    const clients = [
      sampleClient({ id: 'c-order-3', name: 'Zulema' }),
      sampleClient({ id: 'c-order-2', name: 'Beatriz' }),
      sampleClient({ id: 'c-order-1', name: 'Ángela' })
    ];
    for (const client of clients) await dbPut('clients', client);

    const ids = new Set(clients.map((client) => client.id));
    const ordered = (await listClients()).filter((client) => ids.has(client.id));
    expect(ordered.map((client) => client.name)).toEqual(['Ángela', 'Beatriz', 'Zulema']);
  });

  it('saveClient no persiste una estructura corrupta ni muta la entrada', async () => {
    const corrupt = {
      ...sampleClient({ id: 'c-save-normalized' }),
      name: 42,
      phone: 3001234567,
      email: null,
      claveAjena: 'no guardar'
    };
    const before = { ...corrupt };

    await saveClient(corrupt as unknown as Parameters<typeof saveClient>[0]);

    const stored = await dbGet<Record<string, unknown>>('clients', 'c-save-normalized');
    expect(stored).toEqual({
      ...sampleClient({ id: 'c-save-normalized', name: '', phone: '', email: '' })
    });
    expect(corrupt).toEqual(before);
  });

  it('exportBackup conserva la exportación y sanea clientes locales antiguos', async () => {
    await dbPut('clients', {
      ...sampleClient({ id: 'c-export-normalized' }),
      phone: 123,
      claveAjena: 'no exportar'
    });

    const backup = await exportBackup();
    const exported = backup.clients.find((client) => client.id === 'c-export-normalized');
    expect(exported?.phone).toBe('');
    expect(exported && 'claveAjena' in exported).toBe(false);
  });
});

describe('settings', () => {
  it('devuelve defaults con marca Emerald Dealer si no hay nada guardado', async () => {
    const s = await loadSettings();
    expect(s.jewelryName).toBe('Emerald Dealer');
    expect(s.currency).toBe('COP');
  });

  it('guarda y recupera configuración', async () => {
    await saveSettings({ ...defaultSettings(), goldPricePerGram: 600000 });
    const s = await loadSettings();
    expect(s.goldPricePerGram).toBe(600000);
  });

  it('el consecutivo de cotizaciones avanza', async () => {
    await saveSettings({ ...(await loadSettings()), quoteCounter: 7 });
    const year = new Date().getFullYear();
    expect(await nextQuoteNumber()).toBe(`ED-${year}-0007`);
    expect(await nextQuoteNumber()).toBe(`ED-${year}-0008`);
  });

  it('entrega consecutivos únicos cuando se crean cotizaciones al mismo tiempo', async () => {
    await saveSettings({ ...defaultSettings(), quoteCounter: 41 });
    const year = new Date().getFullYear();

    const numbers = await Promise.all([
      nextQuoteNumber(),
      nextQuoteNumber(),
      nextQuoteNumber(),
      nextQuoteNumber()
    ]);

    expect(new Set(numbers).size).toBe(4);
    expect([...numbers].sort()).toEqual([
      `ED-${year}-0041`,
      `ED-${year}-0042`,
      `ED-${year}-0043`,
      `ED-${year}-0044`
    ]);
    expect((await loadSettings()).quoteCounter).toBe(45);
  });

  it('conserva contador, respaldo y precio cuando se actualizan al mismo tiempo', async () => {
    const staleForm = {
      ...defaultSettings(),
      jewelryName: 'Formulario guardado',
      quoteCounter: 70
    };
    await saveSettings(staleForm);
    const year = new Date().getFullYear();

    const [number] = await Promise.all([
      nextQuoteNumber(),
      recordBackupExported('2026-07-11T18:00:00.000Z'),
      ensureBackupReminderFirstDataAt('2026-07-11T17:59:00.000Z'),
      updateSettingsAtomically((current) => ({
        ...current,
        goldPricePerGram: 777000,
        goldPriceUpdatedAt: '2026-07-11T18:01:00.000Z'
      })),
      saveEditableSettings({ ...staleForm, jewelryName: 'Ajustes nuevos' }, false)
    ]);

    const current = await loadSettings();
    expect(number).toBe(`ED-${year}-0070`);
    expect(current.quoteCounter).toBe(71);
    expect(current.lastBackupExportedAt).toBe('2026-07-11T18:00:00.000Z');
    expect(current.backupReminderFirstDataAt).toBe('2026-07-11T17:59:00.000Z');
    expect(current.goldPricePerGram).toBe(777000);
    expect(current.goldPriceUpdatedAt).toBe('2026-07-11T18:01:00.000Z');
    expect(current.jewelryName).toBe('Ajustes nuevos');
  });

  it('aplica una consulta de oro con el recargo más reciente', async () => {
    const initial = {
      ...defaultSettings(),
      goldMarkupPerGram: 100000,
      goldPricePerGram: 600000
    };
    await saveSettings(initial);

    const fetched = {
      usdPerOunce: 4000,
      copPerUsd: 3500,
      internationalCopPerGram: 500000,
      markupPerGram: 100000,
      totalCopPerGram: 600000,
      fetchedAt: '2026-07-11T19:00:00.000Z'
    };

    await saveEditableSettings({ ...initial, goldMarkupPerGram: 150000 }, false);
    const applied = await saveFetchedGoldPrice(fetched);

    expect(applied.info.markupPerGram).toBe(150000);
    expect(applied.info.totalCopPerGram).toBe(650000);
    expect(applied.settings.goldMarkupPerGram).toBe(150000);
    expect(applied.settings.goldPricePerGram).toBe(650000);
  });

  it('solo reemplaza el precio guardado cuando la edición manual es explícita', async () => {
    const current = {
      ...defaultSettings(),
      goldPricePerGram: 777000,
      goldPriceUpdatedAt: '2026-07-11T18:01:00.000Z'
    };
    const staleForm = {
      ...current,
      goldPricePerGram: 555000,
      goldPriceUpdatedAt: '2026-07-10T18:01:00.000Z'
    };
    await saveSettings(current);

    expect((await saveEditableSettings(staleForm, false)).goldPricePerGram).toBe(777000);
    expect((await saveEditableSettings(staleForm, true)).goldPricePerGram).toBe(555000);
  });

  it('registra una exportación confirmada y elimina la posposición', async () => {
    await saveSettings({
      ...defaultSettings(),
      backupReminderSnoozedUntil: '2026-07-12T12:00:00.000Z'
    });

    await recordBackupExported('2026-07-11T12:00:00.000Z');

    const settings = await loadSettings();
    expect(settings.lastBackupExportedAt).toBe('2026-07-11T12:00:00.000Z');
    expect(settings.backupReminderSnoozedUntil).toBe('');
  });

  it('guarda una posposición sin alterar la última exportación', async () => {
    await saveSettings({
      ...defaultSettings(),
      lastBackupExportedAt: '2026-07-01T12:00:00.000Z'
    });

    await snoozeBackupReminder('2026-07-12T12:00:00.000Z');

    const settings = await loadSettings();
    expect(settings.lastBackupExportedAt).toBe('2026-07-01T12:00:00.000Z');
    expect(settings.backupReminderSnoozedUntil).toBe('2026-07-12T12:00:00.000Z');
  });

  it('reemplaza una referencia inicial inválida una sola vez', async () => {
    await saveSettings({ ...defaultSettings(), backupReminderFirstDataAt: 'fecha inválida' });

    await ensureBackupReminderFirstDataAt('2026-07-11T12:00:00.000Z');
    await ensureBackupReminderFirstDataAt('2026-07-12T12:00:00.000Z');

    expect((await loadSettings()).backupReminderFirstDataAt).toBe('2026-07-11T12:00:00.000Z');
  });
});

describe('respaldo (exportar/importar)', () => {
  it('exporta e importa un respaldo completo sin perder datos', async () => {
    const client = sampleClient({ id: 'c-bk' });
    const quote = sampleQuote({ id: 'q-bk' });
    await saveClient(client);
    await saveQuote(quote);

    const backup = await exportBackup();
    const json = serializeBackup(backup);

    // Simula restaurar en otro dispositivo: parsea el JSON y lo importa.
    const parsed = parseBackup(json);
    await importBackup(parsed);

    const quotes = await listQuotes();
    const clients = await listClients();
    expect(quotes.find((q) => q.id === 'q-bk')).toEqual(quote);
    expect(clients.find((c) => c.id === 'c-bk')).toEqual(client);
  });

  it('rechaza archivos que no son respaldos válidos', () => {
    expect(() => parseBackup('no es json')).toThrow('JSON válido');
    expect(() => parseBackup('{"app":"otra-app"}')).toThrow('no es un respaldo');
    expect(() => parseBackup('{"app":"emerald-dealer-quote","version":99}')).toThrow('Versión');
    expect(() =>
      parseBackup('{"app":"emerald-dealer-quote","version":1,"clients":[],"quotes":[{"id":1}]}')
    ).toThrow('inválidas');
  });

  it('rechaza respaldos mayores a 25 MB antes de intentar leer el JSON', () => {
    expect(() => parseBackup('x'.repeat(MAX_BACKUP_FILE_BYTES + 1))).toThrow(
      'demasiado grande'
    );
  });

  it('la importación reemplaza los datos anteriores', async () => {
    await saveQuote(sampleQuote({ id: 'q-viejo' }));
    const backup = parseBackup(
      JSON.stringify({
        app: 'emerald-dealer-quote',
        version: 1,
        exportedAt: '',
        settings: null,
        clients: [],
        quotes: [sampleQuote({ id: 'q-nuevo' })]
      })
    );
    await importBackup(backup);
    const quotes = await listQuotes();
    expect(quotes.find((q) => q.id === 'q-viejo')).toBeUndefined();
    expect(quotes.find((q) => q.id === 'q-nuevo')).toBeDefined();
  });
});
