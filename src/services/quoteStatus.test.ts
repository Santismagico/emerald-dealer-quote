import { describe, expect, it } from 'vitest';
import { sampleClient, sampleQuote } from '../test/fixtures';
import {
  countHistoryQuotesByStatus,
  filterHistoryQuotes,
  getEffectiveQuoteStatus,
  SELECTABLE_QUOTE_STATUSES,
  withQuoteStatus
} from './quoteStatus';

const TODAY = '2026-07-11';

describe('estado efectivo de una cotización', () => {
  it('marca como vencida una cotización pendiente con fecha anterior', () => {
    const quote = sampleQuote({ status: 'pendiente', validUntil: '2026-07-10' });
    expect(getEffectiveQuoteStatus(quote, TODAY)).toBe('vencida');
  });

  it('marca como vencido un borrador con fecha anterior', () => {
    const quote = sampleQuote({ status: 'borrador', validUntil: '2026-07-10' });
    expect(getEffectiveQuoteStatus(quote, TODAY)).toBe('vencida');
  });

  it('mantiene pendiente una cotización que vence hoy', () => {
    const quote = sampleQuote({ status: 'pendiente', validUntil: TODAY });
    expect(getEffectiveQuoteStatus(quote, TODAY)).toBe('pendiente');
  });

  it('mantiene pendiente una cotización con vencimiento futuro', () => {
    const quote = sampleQuote({ status: 'pendiente', validUntil: '2026-07-12' });
    expect(getEffectiveQuoteStatus(quote, TODAY)).toBe('pendiente');
  });

  it('no cambia una cotización aprobada aunque su fecha haya pasado', () => {
    const quote = sampleQuote({ status: 'aprobada', validUntil: '2026-07-10' });
    expect(getEffectiveQuoteStatus(quote, TODAY)).toBe('aprobada');
  });

  it('no cambia una cotización rechazada aunque su fecha haya pasado', () => {
    const quote = sampleQuote({ status: 'rechazada', validUntil: '2026-07-10' });
    expect(getEffectiveQuoteStatus(quote, TODAY)).toBe('rechazada');
  });

  it('conserva una cotización ya guardada como vencida', () => {
    const quote = sampleQuote({ status: 'vencida', validUntil: '2026-07-20' });
    expect(getEffectiveQuoteStatus(quote, TODAY)).toBe('vencida');
  });

  it('conserva cualquier estado futuro que no sea borrador ni pendiente', () => {
    const quote = { status: 'enviada', validUntil: '2026-07-01' } as const;
    expect(getEffectiveQuoteStatus(quote, TODAY)).toBe('enviada');
  });

  it.each(['', 'fecha-invalida', '2026-02-30'])('ignora de forma segura la fecha inválida o vacía %j', (validUntil) => {
    const quote = sampleQuote({ status: 'pendiente', validUntil });
    expect(getEffectiveQuoteStatus(quote, TODAY)).toBe('pendiente');
  });

  it('ignora de forma segura una fecha de referencia inválida', () => {
    const quote = sampleQuote({ status: 'pendiente', validUntil: '2026-07-10' });
    expect(getEffectiveQuoteStatus(quote, 'hoy')).toBe('pendiente');
  });

  it('no modifica el objeto original ni updatedAt', () => {
    const quote = sampleQuote({
      status: 'pendiente',
      validUntil: '2026-07-10',
      updatedAt: '2026-07-01T08:00:00.000Z'
    });
    const original = structuredClone(quote);

    expect(getEffectiveQuoteStatus(quote, TODAY)).toBe('vencida');
    expect(quote).toEqual(original);
    expect(quote.status).toBe('pendiente');
    expect(quote.updatedAt).toBe('2026-07-01T08:00:00.000Z');
  });
});

describe('historial con estado derivado', () => {
  const expiredPending = sampleQuote({
    id: 'q-expired-pending',
    number: 'ED-2026-0101',
    status: 'pendiente',
    validUntil: '2026-07-10',
    clientSnapshot: sampleClient({ name: 'Ana Torres' })
  });
  const futurePending = sampleQuote({
    id: 'q-future-pending',
    number: 'ED-2026-0102',
    status: 'pendiente',
    validUntil: '2026-07-20',
    clientSnapshot: sampleClient({ name: 'Ana Torres' })
  });
  const expiredApproved = sampleQuote({
    id: 'q-expired-approved',
    number: 'ED-2026-0103',
    status: 'aprobada',
    validUntil: '2026-07-01',
    clientSnapshot: sampleClient({ name: 'Beatriz Rojas' })
  });
  const savedExpired = sampleQuote({
    id: 'q-saved-expired',
    number: 'ED-2026-0104',
    status: 'vencida',
    validUntil: '2026-07-30',
    clientSnapshot: sampleClient({ name: 'Carla Ruiz' })
  });
  const quotes = [expiredPending, futurePending, expiredApproved, savedExpired];

  it('el filtro vencida incluye estados derivados y guardados, pero no aprobadas antiguas', () => {
    const result = filterHistoryQuotes(quotes, '', 'vencida', TODAY);
    expect(result.map((quote) => quote.id)).toEqual(['q-expired-pending', 'q-saved-expired']);
  });

  it('el filtro pendiente excluye la pendiente cuya fecha ya pasó', () => {
    const result = filterHistoryQuotes(quotes, '', 'pendiente', TODAY);
    expect(result.map((quote) => quote.id)).toEqual(['q-future-pending']);
  });

  it('combina búsqueda, filtro y conteos usando el estado efectivo', () => {
    const result = filterHistoryQuotes(quotes, 'Ana', 'vencida', TODAY);
    const counts = countHistoryQuotesByStatus(quotes, 'Ana', TODAY);

    expect(result.map((quote) => quote.id)).toEqual(['q-expired-pending']);
    expect(counts.todas).toBe(2);
    expect(counts.vencida).toBe(1);
    expect(counts.pendiente).toBe(1);
    expect(counts.aprobada).toBe(0);
  });

  it('entrega al historial el objeto original para abrir, editar o duplicar', () => {
    const result = filterHistoryQuotes([expiredPending], '', 'vencida', TODAY);
    expect(result[0]).toBe(expiredPending);
    expect(result[0].status).toBe('pendiente');
    expect(result[0].updatedAt).toBe(expiredPending.updatedAt);
  });

  it('el estado mostrado por el historial coincide con el estado efectivo', () => {
    const visibleQuote = filterHistoryQuotes([expiredPending], '', 'vencida', TODAY)[0];
    expect(getEffectiveQuoteStatus(visibleQuote, TODAY)).toBe('vencida');
  });
});

describe('cambio rápido de estado desde el historial', () => {
  const NOW = '2026-07-12T10:00:00.000Z';

  it('los estados seleccionables no incluyen vencida (estado derivado, D-013)', () => {
    expect(SELECTABLE_QUOTE_STATUSES).toEqual(['borrador', 'pendiente', 'aprobada', 'rechazada']);
    expect(SELECTABLE_QUOTE_STATUSES).not.toContain('vencida');
  });

  it('cambia el estado y actualiza updatedAt sin tocar nada más', () => {
    const quote = sampleQuote({ status: 'pendiente', updatedAt: '2026-07-01T08:00:00.000Z' });
    const changed = withQuoteStatus(quote, 'aprobada', NOW);

    expect(changed.status).toBe('aprobada');
    expect(changed.updatedAt).toBe(NOW);
    expect({ ...changed, status: quote.status, updatedAt: quote.updatedAt }).toEqual(quote);
  });

  it('no modifica el objeto original', () => {
    const quote = sampleQuote({ status: 'pendiente', updatedAt: '2026-07-01T08:00:00.000Z' });
    const original = structuredClone(quote);

    withQuoteStatus(quote, 'rechazada', NOW);

    expect(quote).toEqual(original);
  });

  it('permite salir de una vencida guardada asignando un estado real', () => {
    const quote = sampleQuote({ status: 'vencida', validUntil: '2026-07-30' });
    const changed = withQuoteStatus(quote, 'pendiente', NOW);
    expect(getEffectiveQuoteStatus(changed, '2026-07-12')).toBe('pendiente');
  });
});
