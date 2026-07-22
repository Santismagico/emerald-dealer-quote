import { describe, it, expect } from 'vitest';
import {
  normalizeAppointment,
  normalizeClient,
  normalizeQuote,
  normalizeSettings,
  normalizeStoneLot,
  normalizeBuyer,
  normalizeStockJewel,
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
      phone: 3000000000,
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

  it('cotizaciones de versiones viejas reciben campos nuevos con valores seguros', () => {
    const old = sampleQuote() as unknown as Record<string, unknown>;
    delete old.production;
    delete old.payments;
    delete old.depositDate;
    delete old.approvedAt;
    delete old.deliveredAt;
    const q = normalizeQuote(old);
    expect(q.production).toEqual([]);
    expect(q.payments).toEqual([]);
    expect(q.depositDate).toBe('');
    expect(q.approvedAt).toBe('');
    expect(q.deliveredAt).toBe('');
  });

  it('construye un objeto nuevo y descarta claves de contaminación de prototipo', () => {
    const raw = JSON.parse(
      '{"id":"q-segura","number":"ED-2026-0001","__proto__":{"infectado":true},"constructor":{"prototype":{"infectado":true}}}'
    ) as Record<string, unknown>;
    const q = normalizeQuote(raw);

    expect(q).not.toBe(raw);
    expect(Object.prototype.hasOwnProperty.call(q, '__proto__')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(q, 'constructor')).toBe(false);
    expect(({} as Record<string, unknown>).infectado).toBeUndefined();
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
    expect(s.lastBackupExportedAt).toBe('');
    expect(s.backupReminderSnoozedUntil).toBe('');
    expect(s.backupReminderFirstDataAt).toBe('');
  });
});

describe('normalizeAppointment', () => {
  it('convierte basura en una cita válida con defaults seguros', () => {
    const a = normalizeAppointment(null);
    expect(a.id).toBeTruthy();
    expect(a.clientId).toBeNull();
    expect(a.status).toBe('programada');
    expect(a.durationMinutes).toBe(60);
    expect(a.time).toBe('');
  });

  it('conserva una cita bien formada tal cual', () => {
    const valid = {
      id: 'a-1',
      clientId: 'c-1',
      clientName: 'Cliente Ejemplo',
      date: '2026-07-20',
      time: '10:30',
      durationMinutes: 90,
      reason: 'Asesoría',
      notes: 'Traer referencias',
      status: 'cumplida',
      createdAt: '2026-07-14T09:00:00.000Z',
      updatedAt: '2026-07-14T10:00:00.000Z'
    };
    expect(normalizeAppointment(valid)).toEqual(valid);
  });

  it('descarta horas mal formadas y corrige duraciones inválidas', () => {
    expect(normalizeAppointment({ time: '9am' }).time).toBe('');
    expect(normalizeAppointment({ time: '10:30' }).time).toBe('10:30');
    expect(normalizeAppointment({ durationMinutes: 0 }).durationMinutes).toBe(60);
    expect(normalizeAppointment({ durationMinutes: 45.4 }).durationMinutes).toBe(45);
  });

  it('un estado desconocido vuelve a programada', () => {
    expect(normalizeAppointment({ status: 'confirmadísima' }).status).toBe('programada');
  });
});

describe('normalizeStoneLot', () => {
  it('convierte basura en un lote válido con defaults seguros', () => {
    const l = normalizeStoneLot(null);
    expect(l.id).toBeTruthy();
    expect(l.carats).toBe(0);
    expect(l.purchaseValueCop).toBe(0);
    expect(l.sales).toEqual([]);
  });

  it('conserva un lote bien formado con sus ventas', () => {
    const valid = {
      id: 'l-1',
      name: 'Lote Ejemplo 12',
      stoneType: 'Esmeralda',
      description: 'Calidad alta',
      purchaseDate: '2026-07-15',
      supplier: 'Proveedor Ejemplo',
      supplierId: null,
      carats: 5,
      quantity: 4,
      purchaseValueCop: 6000000,
      onCredit: false,
      supplierPayments: [],
      notes: '',
      sales: [
        {
          id: 'v-1',
          date: '2026-07-15',
          buyer: 'Cliente',
          buyerId: null,
          carats: 1,
          quantity: 1,
          valueCop: 2000000,
          onCredit: false,
          dueDate: '',
          payments: [],
          notes: ''
        }
      ],
      createdAt: '2026-07-15T09:00:00.000Z',
      updatedAt: '2026-07-15T09:00:00.000Z'
    };
    expect(normalizeStoneLot(valid)).toEqual(valid);
  });

  it('lleva a cero los números negativos o corruptos del lote y sus ventas', () => {
    const l = normalizeStoneLot({
      carats: -2,
      quantity: 'muchas',
      purchaseValueCop: -100,
      sales: [{ id: 'v-1', carats: -1, valueCop: 'regalo' }]
    });
    expect(l.carats).toBe(0);
    expect(l.quantity).toBe(0);
    expect(l.purchaseValueCop).toBe(0);
    expect(l.sales[0].carats).toBe(0);
    expect(l.sales[0].valueCop).toBe(0);
  });

  it('las ventas que no son objetos se convierten en ventas vacías con id propio', () => {
    const l = normalizeStoneLot({ sales: ['basura', null] });
    expect(l.sales.length).toBe(2);
    expect(l.sales[0].id).toBeTruthy();
    expect(l.sales[0].id).not.toBe(l.sales[1].id);
  });
});

describe('normalizeStoneLot: crédito al vender (D-042)', () => {
  it('una venta anterior a la decisión se lee como de CONTADO', () => {
    // Es la garantía de no regresión: los datos que ya existen en los teléfonos
    // no traen ninguna marca de crédito y deben seguir valiendo lo mismo.
    const l = normalizeStoneLot({
      sales: [{ id: 'v-vieja', date: '2026-07-01', buyer: 'Pedro', carats: 1, quantity: 1, valueCop: 3000000 }]
    });
    expect(l.sales[0].onCredit).toBe(false);
    expect(l.sales[0].dueDate).toBe('');
    expect(l.sales[0].payments).toEqual([]);
    expect(l.sales[0].buyerId).toBeNull();
    expect(l.sales[0].valueCop).toBe(3000000);
  });

  it('conserva la fecha acordada y los abonos de una venta a crédito', () => {
    const l = normalizeStoneLot({
      sales: [
        {
          id: 'v-credito',
          date: '2026-07-10',
          buyer: 'Joyería Ejemplo',
          buyerId: 'buy-1',
          carats: 2,
          quantity: 2,
          valueCop: 5000000,
          onCredit: true,
          dueDate: '2026-08-10',
          payments: [{ id: 'ab-1', date: '2026-07-20', amount: 2000000, notes: 'primer abono' }]
        }
      ]
    });
    expect(l.sales[0].onCredit).toBe(true);
    expect(l.sales[0].dueDate).toBe('2026-08-10');
    expect(l.sales[0].buyerId).toBe('buy-1');
    expect(l.sales[0].payments).toEqual([
      { id: 'ab-1', date: '2026-07-20', amount: 2000000, notes: 'primer abono' }
    ]);
  });

  it('una venta de contado nunca conserva abonos sueltos', () => {
    // Si los conservara, el precio completo Y los abonos contarían como dinero
    // recibido y la caja del día quedaría inflada.
    const l = normalizeStoneLot({
      sales: [
        {
          id: 'v-1',
          valueCop: 1000000,
          onCredit: false,
          dueDate: '2026-08-01',
          payments: [{ id: 'ab-1', date: '2026-07-20', amount: 500000, notes: '' }]
        }
      ]
    });
    expect(l.sales[0].payments).toEqual([]);
    expect(l.sales[0].dueDate).toBe('');
  });

  it('lleva a cero un abono negativo o corrupto', () => {
    const l = normalizeStoneLot({
      sales: [{ id: 'v-1', valueCop: 100, onCredit: true, payments: [{ id: 'ab-1', amount: -50 }, 'basura'] }]
    });
    expect(l.sales[0].payments[0].amount).toBe(0);
    expect(l.sales[0].payments[1].id).toBeTruthy();
  });
});

describe('normalizeBuyer', () => {
  it('convierte basura en un comprador válido con id propio', () => {
    const b = normalizeBuyer(null);
    expect(b.id).toBeTruthy();
    expect(b.name).toBe('');
    expect(b.phone).toBe('');
  });

  it('conserva un comprador bien formado', () => {
    const valid = {
      id: 'buy-1',
      name: 'Joyería Ejemplo',
      phone: '3000000000',
      city: 'Ciudad Ejemplo',
      notes: 'Paga puntual',
      createdAt: '2026-07-21T09:00:00.000Z'
    };
    expect(normalizeBuyer(valid)).toEqual(valid);
  });
});

describe('normalizeStockJewel', () => {
  it('convierte basura en una joya válida con defaults seguros', () => {
    const j = normalizeStockJewel(null);
    expect(j.id).toBeTruthy();
    expect(j.status).toBe('disponible');
    expect(j.costCop).toBe(0);
    expect(j.priceCop).toBe(0);
    expect(j.sale).toBeNull();
    expect(j.photo).toBe('');
  });

  it('un estado inventado no puede dejar la pieza fuera de los dos estados guardables', () => {
    // "vendida" NO es un estado guardado: se deriva de tener venta (D-044).
    expect(normalizeStockJewel({ status: 'vendida' }).status).toBe('disponible');
    expect(normalizeStockJewel({ status: 'apartada' }).status).toBe('apartada');
  });

  it('descarta una foto que no sea data URL de imagen', () => {
    expect(normalizeStockJewel({ photo: 'https://ejemplo.invalido/foto.jpg' }).photo).toBe('');
    expect(normalizeStockJewel({ photo: 'data:image/jpeg;base64,abc' }).photo).toBe(
      'data:image/jpeg;base64,abc'
    );
  });

  it('lleva a cero costos y precios negativos o corruptos', () => {
    const j = normalizeStockJewel({ costCop: -5000, priceCop: 'mucho' });
    expect(j.costCop).toBe(0);
    expect(j.priceCop).toBe(0);
  });

  it('conserva una joya vendida con su venta', () => {
    const j = normalizeStockJewel({
      id: 'j-1',
      name: 'Anillo Ejemplo',
      pieceType: 'anillo',
      material: 'Oro',
      photo: '',
      acquiredDate: '2026-07-01',
      costCop: 3000000,
      priceCop: 5000000,
      status: 'disponible',
      notes: '',
      sale: {
        id: 's-1',
        date: '2026-07-20',
        buyer: 'Comprador Ejemplo',
        buyerId: 'buy-1',
        priceCop: 4800000,
        notes: ''
      },
      createdAt: '2026-07-01T09:00:00.000Z',
      updatedAt: '2026-07-20T09:00:00.000Z'
    });
    expect(j.sale?.priceCop).toBe(4800000);
    expect(j.sale?.buyerId).toBe('buy-1');
  });

  it('una venta corrupta no deja la joya a medio vender', () => {
    const j = normalizeStockJewel({ sale: 'vendida ayer' });
    expect(j.sale).toBeNull();
  });
});
