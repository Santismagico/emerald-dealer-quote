import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateQuote, quoteToCalcInput } from '../calc/engine';
import { sampleQuote, sampleSettings } from '../test/fixtures';
import type { ClientPayment, ProductionStage, Quote } from '../types';
import { patchById } from '../utils/collections';
import { buildClientPdfContent } from './pdfContent';
import { buildWhatsAppMessage } from './whatsapp';
import { getEffectiveQuoteStatus } from './quoteStatus';
import {
  createQuoteAutosaveController,
  runAfterSuccessfulFlush,
  type QuoteAutosaveController,
  type QuoteAutosaveStatus
} from './quoteAutosave';

function createDeferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeController({
  initial = sampleQuote({ production: [], payments: [] }),
  save = async () => {},
  drafts = [],
  statuses = []
}: {
  initial?: Quote;
  save?: (quote: Quote) => Promise<void>;
  drafts?: Quote[];
  statuses?: QuoteAutosaveStatus[];
} = {}) {
  let tick = 0;
  return createQuoteAutosaveController({
    initialQuote: initial,
    save,
    onDraft: (quote) => drafts.push(quote),
    onStatus: (status) => statuses.push(status),
    now: () => `2026-07-11T12:00:00.${String(tick++).padStart(3, '0')}Z`
  });
}

describe('guardado diferido de producción y abonos', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('agrupa varias pulsaciones rápidas en una sola escritura final', async () => {
    const writes: Quote[] = [];
    const controller = makeController({ save: async (quote) => void writes.push(quote) });

    controller.update((quote) => ({ ...quote, internalNotes: 'a' }));
    controller.update((quote) => ({ ...quote, internalNotes: 'ab' }));
    controller.update((quote) => ({ ...quote, internalNotes: 'abc' }));

    await vi.advanceTimersByTimeAsync(649);
    expect(writes).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(writes).toHaveLength(1);
    expect(writes[0].internalNotes).toBe('abc');
  });

  it('siempre guarda el último valor escrito', async () => {
    const writes: Quote[] = [];
    const controller = makeController({ save: async (quote) => void writes.push(quote) });

    controller.update((quote) => ({ ...quote, clientNotes: 'primero' }));
    controller.update((quote) => ({ ...quote, clientNotes: 'último' }));
    await controller.flush();

    expect(writes.at(-1)?.clientNotes).toBe('último');
  });

  it('una ráfaga de 20 cambios y flush produce una sola escritura con la última versión', async () => {
    const writes: Quote[] = [];
    const controller = makeController({ save: async (quote) => void writes.push(quote) });

    for (let index = 1; index <= 20; index += 1) {
      controller.update((quote) => ({ ...quote, clientNotes: `versión ${index}` }));
    }
    await controller.flush();

    expect(writes).toHaveLength(1);
    expect(writes[0].clientNotes).toBe('versión 20');
  });

  it('el blur fuerza el guardado pendiente y cancela el temporizador', async () => {
    const writes: Quote[] = [];
    const controller = makeController({ save: async (quote) => void writes.push(quote) });
    controller.update((quote) => ({ ...quote, internalNotes: 'guardar al salir del campo' }));

    await controller.flush();

    expect(writes).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('contraer una tarjeta fuerza el guardado pendiente', async () => {
    const writes: Quote[] = [];
    const controller = makeController({ save: async (quote) => void writes.push(quote) });
    controller.update((quote) => ({ ...quote, production: [{ ...sampleQuote().production[0], notes: 'lista' }] }));

    await controller.flush();

    expect(writes[0].production[0].notes).toBe('lista');
  });

  it('navegar fuera espera y guarda la versión pendiente', async () => {
    const gate = createDeferred();
    let navigated = false;
    const controller = makeController({ save: () => gate.promise });
    controller.update((quote) => ({ ...quote, clientNotes: 'pendiente' }));

    const leave = controller.flush().then(() => {
      navigated = true;
    });
    await Promise.resolve();
    expect(navigated).toBe(false);
    gate.resolve();
    await leave;
    expect(navigated).toBe(true);
  });

  it('agregar un abono actualiza la interfaz y activa guardado inmediato automáticamente', async () => {
    const writes: Quote[] = [];
    const drafts: Quote[] = [];
    const controller = makeController({ save: async (quote) => void writes.push(quote), drafts });
    const payment: ClientPayment = {
      id: 'payment-new', amount: 500000, date: '2026-07-11', receivedBy: 'Laura', method: 'Efectivo', notes: ''
    };

    const result = controller.update((quote) => ({ ...quote, payments: [...quote.payments, payment] }), 'immediate');
    await result.savePromise;

    expect(drafts.at(-1)?.payments).toEqual([payment]);
    expect(writes.at(-1)?.payments).toEqual([payment]);
  });

  it('eliminar un abono guarda una sola lista sin duplicados', async () => {
    const payment = sampleQuote().payments[0];
    const writes: Quote[] = [];
    const controller = makeController({
      initial: sampleQuote({ payments: [payment] }),
      save: async (quote) => void writes.push(quote)
    });

    const result = controller.update(
      (quote) => ({ ...quote, payments: quote.payments.filter((item) => item.id !== payment.id) }),
      'immediate'
    );
    await result.savePromise;

    expect(writes.at(-1)?.payments).toEqual([]);
  });

  it('agregar una etapa conserva un único elemento nuevo y lo guarda', async () => {
    const stage: ProductionStage = { ...sampleQuote().production[0], id: 'stage-new' };
    const writes: Quote[] = [];
    const controller = makeController({ save: async (quote) => void writes.push(quote) });

    const result = controller.update(
      (quote) => ({ ...quote, production: [...quote.production, stage] }),
      'immediate'
    );
    await result.savePromise;

    expect(writes.at(-1)?.production).toEqual([stage]);
  });

  it('eliminar una etapa conserva las demás y guarda la lista final', async () => {
    const first = { ...sampleQuote().production[0], id: 'stage-1' };
    const second = { ...sampleQuote().production[1], id: 'stage-2' };
    const writes: Quote[] = [];
    const controller = makeController({
      initial: sampleQuote({ production: [first, second] }),
      save: async (quote) => void writes.push(quote)
    });

    const result = controller.update(
      (quote) => ({ ...quote, production: quote.production.filter((item) => item.id !== first.id) }),
      'immediate'
    );
    await result.savePromise;

    expect(writes.at(-1)?.production).toEqual([second]);
  });

  it.each([
    ['estado', (quote: Quote) => ({ ...quote, status: 'aprobada' as const }), 'status', 'aprobada'],
    ['fecha', (quote: Quote) => ({ ...quote, validUntil: '2026-08-01' }), 'validUntil', '2026-08-01'],
    [
      'pago',
      (quote: Quote) => ({ ...quote, payments: [{ ...sampleQuote().payments[0], amount: 900000 }] }),
      'payments',
      900000
    ],
    [
      'interruptor',
      (quote: Quote) => ({ ...quote, production: [{ ...sampleQuote().production[0], paid: false }] }),
      'production',
      false
    ],
    [
      'selector',
      (quote: Quote) => ({ ...quote, production: [{ ...sampleQuote().production[0], status: 'enProceso' as const }] }),
      'productionStatus',
      'enProceso'
    ]
  ] as const)('un cambio importante de %s activa guardado inmediato automáticamente', async (_label, updater, field, expected) => {
    const writes: Quote[] = [];
    const controller = makeController({ save: async (quote) => void writes.push(quote) });
    const result = controller.update(updater, 'immediate');
    await result.savePromise;
    const saved = writes.at(-1)!;

    const actual =
      field === 'payments'
        ? saved.payments[0].amount
        : field === 'production'
          ? saved.production[0].paid
          : field === 'productionStatus'
            ? saved.production[0].status
            : saved[field];
    expect(actual).toBe(expected);
  });

  it('dos cambios rápidos dentro de producción no se pisan', async () => {
    const stage = { ...sampleQuote().production[0], name: 'Diseño', notes: '' };
    const writes: Quote[] = [];
    const controller = makeController({
      initial: sampleQuote({ production: [stage] }),
      save: async (quote) => void writes.push(quote)
    });

    controller.update((quote) => ({ ...quote, production: patchById(quote.production, stage.id, { name: 'Diseño final' }) }));
    controller.update((quote) => ({ ...quote, production: patchById(quote.production, stage.id, { notes: 'Prioridad alta' }) }));
    await controller.flush();

    expect(writes.at(-1)?.production[0]).toMatchObject({ name: 'Diseño final', notes: 'Prioridad alta' });
  });

  it('un cambio de producción y otro de abonos se conservan juntos', async () => {
    const stage = sampleQuote().production[0];
    const payment = sampleQuote().payments[0];
    const writes: Quote[] = [];
    const controller = makeController({
      initial: sampleQuote({ production: [stage], payments: [payment] }),
      save: async (quote) => void writes.push(quote)
    });

    controller.update((quote) => ({ ...quote, production: patchById(quote.production, stage.id, { notes: 'Terminada' }) }));
    controller.update((quote) => ({ ...quote, payments: patchById(quote.payments, payment.id, { method: 'Tarjeta' }) }));
    await controller.flush();

    expect(writes.at(-1)?.production[0].notes).toBe('Terminada');
    expect(writes.at(-1)?.payments[0].method).toBe('Tarjeta');
  });

  it('una escritura lenta anterior nunca corre a la vez ni reemplaza la versión reciente', async () => {
    const firstWrite = createDeferred();
    const writes: Quote[] = [];
    let activeWrites = 0;
    let maxActiveWrites = 0;
    const controller = makeController({
      save: async (quote) => {
        writes.push(quote);
        activeWrites += 1;
        maxActiveWrites = Math.max(maxActiveWrites, activeWrites);
        if (writes.length === 1) await firstWrite.promise;
        activeWrites -= 1;
      }
    });

    controller.update((quote) => ({ ...quote, internalNotes: 'versión lenta' }));
    const flushing = controller.flush();
    await Promise.resolve();
    controller.update((quote) => ({ ...quote, internalNotes: 'versión final' }));
    const finalFlush = controller.flush();

    expect(writes).toHaveLength(1);
    expect(maxActiveWrites).toBe(1);
    firstWrite.resolve();
    await Promise.all([flushing, finalFlush]);

    expect(writes).toHaveLength(2);
    expect(writes[1].internalNotes).toBe('versión final');
    expect(maxActiveWrites).toBe(1);
  });

  it('un error conserva el dato local, muestra error y permite reintentar la última versión', async () => {
    const drafts: Quote[] = [];
    const statuses: QuoteAutosaveStatus[] = [];
    const writes: Quote[] = [];
    let attempt = 0;
    const controller = makeController({
      drafts,
      statuses,
      save: async (quote) => {
        attempt += 1;
        if (attempt === 1) throw new Error('IndexedDB no disponible');
        writes.push(quote);
      }
    });
    controller.update((quote) => ({ ...quote, clientNotes: 'no perder' }));

    await expect(controller.flush()).rejects.toThrow('IndexedDB');
    expect(controller.getLatest().clientNotes).toBe('no perder');
    expect(drafts.at(-1)?.clientNotes).toBe('no perder');
    expect(statuses).toContain('error');

    await controller.retry();
    expect(writes.at(-1)?.clientNotes).toBe('no perder');
    expect(controller.getStatus()).toBe('saved');
  });

  it('una acción de salida solo ocurre si el flush termina correctamente', async () => {
    let successfulAction = false;
    let failedAction = false;

    const success = await runAfterSuccessfulFlush(async () => {}, () => {
      successfulAction = true;
    });
    const failure = await runAfterSuccessfulFlush(
      async () => {
        throw new Error('No guardado');
      },
      () => {
        failedAction = true;
      }
    );

    expect(success).toBe(true);
    expect(successfulAction).toBe(true);
    expect(failure).toBe(false);
    expect(failedAction).toBe(false);
  });

  it('si el writer asigna número, el mismo flush guarda después la revisión numerada más reciente', async () => {
    const initial = sampleQuote({ number: '', payments: [], production: [] });
    const persisted: Quote[] = [];
    let reservations = 0;
    let controller!: QuoteAutosaveController;
    controller = createQuoteAutosaveController({
      initialQuote: initial,
      onDraft: () => {},
      save: async (quote) => {
        if (!quote.number) {
          reservations += 1;
          controller.update((current) => ({ ...current, number: 'ED-2026-0099' }));
          return;
        }
        persisted.push(quote);
      }
    });

    controller.update((quote) => ({ ...quote, clientNotes: 'Última edición' }));
    await controller.flush();

    expect(reservations).toBe(1);
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({ number: 'ED-2026-0099', clientNotes: 'Última edición' });
  });

  it('editar producción o abonos no cambia el total del motor de cálculo', async () => {
    const initial = sampleQuote();
    const before = calculateQuote(quoteToCalcInput(initial));
    const controller = makeController({ initial });

    controller.update((quote) => ({
      ...quote,
      production: patchById(quote.production, quote.production[0].id, { cost: 9999999 }),
      payments: patchById(quote.payments, quote.payments[0].id, { amount: 8888888 })
    }));
    const after = calculateQuote(quoteToCalcInput(controller.getLatest()));

    expect(after).toEqual(before);
    await controller.dispose();
  });

  it('no cambia PDF cliente, WhatsApp, oro ni estado vencido al editar datos internos', async () => {
    const initial = sampleQuote({ status: 'pendiente', validUntil: '2026-07-10' });
    const settings = sampleSettings();
    const calc = calculateQuote(quoteToCalcInput(initial));
    const beforePdf = buildClientPdfContent(initial, calc, settings);
    const beforeWhatsApp = buildWhatsAppMessage(initial, calc, settings);
    const controller = makeController({ initial });

    controller.update((quote) => ({
      ...quote,
      production: patchById(quote.production, quote.production[0].id, { notes: 'Cambio interno' }),
      payments: patchById(quote.payments, quote.payments[0].id, { receivedBy: 'Santiago' })
    }));
    const latest = controller.getLatest();

    expect(buildClientPdfContent(latest, calc, settings)).toEqual(beforePdf);
    expect(buildWhatsAppMessage(latest, calc, settings)).toBe(beforeWhatsApp);
    expect(latest.materialPricePerGram).toBe(initial.materialPricePerGram);
    expect(getEffectiveQuoteStatus(latest, '2026-07-11')).toBe('vencida');
    await controller.dispose();
  });

  it('nunca muta la cotización ni las listas recibidas', async () => {
    const initial = sampleQuote();
    const original = structuredClone(initial);
    const controller = makeController({ initial });

    const latest = controller.update((quote) => ({
      ...quote,
      production: patchById(quote.production, quote.production[0].id, { notes: 'Nueva' })
    })).quote;

    expect(initial).toEqual(original);
    expect(latest).not.toBe(initial);
    expect(latest.production).not.toBe(initial.production);
    await controller.dispose();
  });

  it('flush y dispose limpian sus timers sin escrituras posteriores', async () => {
    const writes: Quote[] = [];
    const controller = makeController({ save: async (quote) => void writes.push(quote) });
    controller.update((quote) => ({ ...quote, clientNotes: 'final' }));

    await controller.dispose();
    expect(writes).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(writes).toHaveLength(1);
  });
});
