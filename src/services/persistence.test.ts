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
  defaultSettings
} from './storage';
import { exportBackup, serializeBackup, parseBackup, importBackup } from './backup';
import { sampleQuote, sampleClient } from '../test/fixtures';

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
