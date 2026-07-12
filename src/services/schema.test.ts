import { describe, it, expect } from 'vitest';
import {
  normalizeClient,
  normalizeQuote,
  normalizeSettings,
  defaultSettings,
  SETTINGS_VERSION
} from './schema';
import { sampleClient, sampleQuote } from '../test/fixtures';

describe('normalizeClient: datos antiguos o corruptos', () => {
  it('conserva un cliente válido en un objeto nuevo', () => {
    const client = sampleClient();
    const normalized = normalizeClient(client);

    expect(normalized).toEqual(client);
    expect(normalized).not.toBe(client);
  });

  it('completa campos faltantes y corrige tipos inválidos', () => {
    const normalized = normalizeClient({
      id: 'c-antiguo',
      name: 'Cliente antiguo',
      phone: 3001234567,
      email: null,
      notes: ['dato viejo']
    });

    expect(normalized).toEqual({
      id: 'c-antiguo',
      name: 'Cliente antiguo',
      phone: '',
      email: '',
      city: '',
      document: '',
      notes: '',
      createdAt: ''
    });
  });

  it('descarta claves desconocidas sin mutar el objeto original', () => {
    const original = Object.freeze({
      ...sampleClient({ id: 'c-claves' }),
      claveAjena: 'no debe sobrevivir'
    });
    const before = { ...original };

    const normalized = normalizeClient(original);

    expect(normalized).toEqual(sampleClient({ id: 'c-claves' }));
    expect('claveAjena' in normalized).toBe(false);
    expect(original).toEqual(before);
  });
});

describe('normalizeQuote: datos corruptos o de versiones viejas', () => {
  it('una cotización bien formada pasa sin cambios (identidad)', () => {
    const quote = sampleQuote();
    expect(normalizeQuote(quote)).toEqual(quote);
  });

  it('cotizaciones de versiones viejas sin production/payments reciben arreglos vacíos', () => {
    const old = sampleQuote() as unknown as Record<string, unknown>;
    delete old.production;
    delete old.payments;
    const q = normalizeQuote(old);
    expect(q.production).toEqual([]);
    expect(q.payments).toEqual([]);
  });

  it('tipos corruptos se corrigen en vez de romper la app', () => {
    const q = normalizeQuote({
      id: 'q-x',
      number: 'ED-2026-0001',
      production: {}, // objeto en vez de arreglo
      payments: 'nada', // string en vez de arreglo
      pieceDescription: 42, // número en vez de string
      weightGrams: 'cinco', // string en vez de número
      status: 'inventado',
      stones: [{ unitPrice: 'mil' }]
    });
    expect(q.production).toEqual([]);
    expect(q.payments).toEqual([]);
    expect(q.pieceDescription).toBe('');
    expect(q.weightGrams).toBe(0);
    expect(q.status).toBe('borrador');
    expect(q.stones[0].unitPrice).toBe(0);
    expect(() => q.production.filter(() => true)).not.toThrow();
  });

  it('descarta imágenes que no sean data URLs de imagen (evita rastreo externo)', () => {
    const q = normalizeQuote({
      id: 'q-img',
      number: 'X',
      images: ['https://atacante.com/pixel.png', 'data:image/jpeg;base64,AAA', 'javascript:alert(1)', 5]
    });
    expect(q.images).toEqual(['data:image/jpeg;base64,AAA']);
  });
});

describe('normalizeSettings: migraciones y saneamiento', () => {
  it('claves desconocidas de un respaldo se descartan', () => {
    const s = normalizeSettings({ jewelryName: 'Mi Joyería', claveMaliciosa: 'x' });
    expect(s.jewelryName).toBe('Mi Joyería');
    expect('claveMaliciosa' in s).toBe(false);
  });

  it('tipos incorrectos vuelven al valor por defecto', () => {
    const s = normalizeSettings({ goldPricePerGram: 'medio millón', defaultValidityDays: '15' });
    expect(s.goldPricePerGram).toBe(0);
    expect(s.defaultValidityDays).toBe(15);
  });

  it('el logo solo acepta data URLs de imagen', () => {
    expect(normalizeSettings({ logoDataUrl: 'https://x.com/logo.png' }).logoDataUrl).toBe('');
    expect(normalizeSettings({ logoDataUrl: 'data:image/png;base64,AAA' }).logoDataUrl).toBe('data:image/png;base64,AAA');
  });

  it('migra el mensaje comercial legado solo si venía de una versión anterior', () => {
    const legacy = 'Gracias por su confianza. Será un gusto atenderle.';
    const migrated = normalizeSettings({ commercialMessage: legacy }); // sin settingsVersion = v1
    expect(migrated.commercialMessage).toBe(defaultSettings().commercialMessage);

    // Un usuario de la versión actual que escribió ese texto a propósito lo conserva.
    const deliberate = normalizeSettings({ commercialMessage: legacy, settingsVersion: SETTINGS_VERSION });
    expect(deliberate.commercialMessage).toBe(legacy);
  });

  it('siempre queda en la versión de esquema actual y moneda COP', () => {
    const s = normalizeSettings({ currency: 'USD', settingsVersion: 1 });
    expect(s.currency).toBe('COP');
    expect(s.settingsVersion).toBe(SETTINGS_VERSION);
  });
});
