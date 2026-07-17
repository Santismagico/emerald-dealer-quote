import { describe, expect, it } from 'vitest';
import { sampleClient, sampleQuote } from '../test/fixtures';
import { calculateQuote, quoteToCalcInput } from '../calc/engine';
import type { ProductionStage } from '../types';
import {
  countWorkshopJobs,
  filterWorkshopJobs,
  withQuoteDelivery,
  workshopJobFromQuote,
  workshopJobsFromQuotes
} from './workshop';

function stage(overrides: Partial<ProductionStage> = {}): ProductionStage {
  return {
    id: 'st-x',
    name: 'Etapa',
    status: 'pendiente',
    completedAt: '',
    cost: 0,
    paid: false,
    paidAt: '',
    paidTo: '',
    paidBy: '',
    notes: '',
    ...overrides
  };
}

describe('trabajos del taller derivados de cotizaciones', () => {
  it('solo las cotizaciones aprobadas son trabajos', () => {
    const quotes = [
      sampleQuote({ id: 'q-borrador', status: 'borrador' }),
      sampleQuote({ id: 'q-aprobada', status: 'aprobada' }),
      sampleQuote({ id: 'q-pendiente', status: 'pendiente' }),
      sampleQuote({ id: 'q-rechazada', status: 'rechazada' }),
      sampleQuote({ id: 'q-vencida', status: 'vencida' })
    ];
    const jobs = workshopJobsFromQuotes(quotes);
    expect(jobs.map((job) => job.quote.id)).toEqual(['q-aprobada']);
  });

  it('calcula total, abonado y saldo con el motor puro', () => {
    const quote = sampleQuote({ status: 'aprobada' });
    const job = workshopJobFromQuote(quote);
    const total = calculateQuote(quoteToCalcInput(quote)).total;

    expect(job.total).toBe(total);
    expect(job.paid).toBe(3000000);
    expect(job.balance).toBe(total - 3000000);
    expect(job.paidInFull).toBe(false);
  });

  it('un trabajo queda pagado solo cuando el dinero recibido cubre el total (D-028)', () => {
    const quote = sampleQuote({ status: 'aprobada' });
    const total = calculateQuote(quoteToCalcInput(quote)).total;

    expect(workshopJobFromQuote({ ...quote, deposit: total, payments: [] }).paidInFull).toBe(true);
    expect(workshopJobFromQuote({ ...quote, deposit: total - 1, payments: [] }).paidInFull).toBe(
      false
    );
  });

  it('pagada y entregada son estados independientes (D-028)', () => {
    const quote = sampleQuote({ status: 'aprobada' });
    const total = calculateQuote(quoteToCalcInput(quote)).total;

    const pagadaSinEntregar = workshopJobFromQuote({ ...quote, deposit: total, payments: [] });
    expect(pagadaSinEntregar.paidInFull).toBe(true);
    expect(pagadaSinEntregar.delivered).toBe(false);

    const entregadaSinPagar = workshopJobFromQuote({
      ...quote,
      deposit: 0,
      payments: [],
      deliveredAt: '2026-07-16'
    });
    expect(entregadaSinPagar.paidInFull).toBe(false);
    expect(entregadaSinPagar.delivered).toBe(true);
  });

  it('cuenta el avance de etapas sin modificar la cotización', () => {
    const quote = sampleQuote({ status: 'aprobada' });
    const original = structuredClone(quote);
    const job = workshopJobFromQuote(quote);

    expect(job.stagesTotal).toBe(2);
    expect(job.stagesDone).toBe(1);
    expect(job.ready).toBe(false);
    expect(quote).toEqual(original);
  });

  it('un trabajo sin etapas nunca está listo', () => {
    const job = workshopJobFromQuote(sampleQuote({ status: 'aprobada', production: [] }));
    expect(job.stagesTotal).toBe(0);
    expect(job.ready).toBe(false);
  });

  it('un trabajo con todas las etapas listas está listo', () => {
    const production = [
      stage({ id: 'st-1', status: 'lista', completedAt: '2026-07-10' }),
      stage({ id: 'st-2', status: 'lista', completedAt: '2026-07-11' })
    ];
    const job = workshopJobFromQuote(sampleQuote({ status: 'aprobada', production }));
    expect(job.ready).toBe(true);
    expect(job.stagesDone).toBe(2);
  });
});

describe('búsqueda, filtro y conteos del taller', () => {
  const inProgress = workshopJobFromQuote(
    sampleQuote({
      id: 'q-en-taller',
      number: 'ED-2026-0201',
      status: 'aprobada',
      clientSnapshot: sampleClient({ name: 'Ana Torres' })
    })
  );
  const ready = workshopJobFromQuote(
    sampleQuote({
      id: 'q-listo',
      number: 'ED-2026-0202',
      status: 'aprobada',
      clientSnapshot: sampleClient({ name: 'Beatriz Rojas' }),
      production: [stage({ id: 'st-1', status: 'lista', completedAt: '2026-07-10' })]
    })
  );
  const jobs = [inProgress, ready];

  it('el filtro "en taller" excluye los trabajos listos', () => {
    expect(filterWorkshopJobs(jobs, '', 'enTaller').map((j) => j.quote.id)).toEqual(['q-en-taller']);
  });

  it('el filtro "listos" solo incluye trabajos con todas las etapas listas', () => {
    expect(filterWorkshopJobs(jobs, '', 'listos').map((j) => j.quote.id)).toEqual(['q-listo']);
  });

  it('busca por nombre de cliente y número igual que el historial', () => {
    expect(filterWorkshopJobs(jobs, 'Ana', 'todos').map((j) => j.quote.id)).toEqual(['q-en-taller']);
    expect(filterWorkshopJobs(jobs, '0202', 'todos').map((j) => j.quote.id)).toEqual(['q-listo']);
  });

  it('los conteos respetan la búsqueda', () => {
    expect(countWorkshopJobs(jobs, '')).toEqual({ todos: 2, enTaller: 1, listos: 1, entregados: 0 });
    expect(countWorkshopJobs(jobs, 'Beatriz')).toEqual({ todos: 1, enTaller: 0, listos: 1, entregados: 0 });
  });
});

describe('entrega de la joya (lista ≠ entregada)', () => {
  const NOW = '2026-07-16T10:00:00.000Z';
  const listaNoEntregada = workshopJobFromQuote(
    sampleQuote({
      id: 'q-lista',
      status: 'aprobada',
      production: [stage({ id: 'st-1', status: 'lista', completedAt: '2026-07-10' })]
    })
  );
  const entregada = workshopJobFromQuote(
    sampleQuote({
      id: 'q-entregada',
      status: 'aprobada',
      deliveredAt: '2026-07-15',
      production: [stage({ id: 'st-1', status: 'lista', completedAt: '2026-07-10' })]
    })
  );
  const enTaller = workshopJobFromQuote(sampleQuote({ id: 'q-taller', status: 'aprobada' }));
  const jobs = [listaNoEntregada, entregada, enTaller];

  it('una joya lista NO cuenta como entregada hasta que se marque', () => {
    expect(listaNoEntregada.ready).toBe(true);
    expect(listaNoEntregada.delivered).toBe(false);
    expect(entregada.delivered).toBe(true);
  });

  it('una fecha inválida no convierte el trabajo en entregado', () => {
    const fechaImposible = workshopJobFromQuote(
      sampleQuote({
        id: 'q-fecha-invalida',
        status: 'aprobada',
        deliveredAt: '2026-02-30',
        production: [stage({ id: 'st-1', status: 'lista', completedAt: '2026-07-10' })]
      })
    );

    expect(fechaImposible.delivered).toBe(false);
    expect(filterWorkshopJobs([fechaImposible], '', 'listos')).toEqual([fechaImposible]);
    expect(filterWorkshopJobs([fechaImposible], '', 'entregados')).toEqual([]);
  });

  it('entregado manda: el filtro Listos excluye las entregadas', () => {
    expect(filterWorkshopJobs(jobs, '', 'listos').map((j) => j.quote.id)).toEqual(['q-lista']);
    expect(filterWorkshopJobs(jobs, '', 'entregados').map((j) => j.quote.id)).toEqual(['q-entregada']);
    expect(countWorkshopJobs(jobs, '')).toEqual({ todos: 3, enTaller: 1, listos: 1, entregados: 1 });
  });

  it('withQuoteDelivery marca la entrega sin tocar el original y con deshacer', () => {
    const quote = sampleQuote({ status: 'aprobada', deliveredAt: '' });
    const original = structuredClone(quote);

    const entregadaHoy = withQuoteDelivery(quote, '2026-07-16', NOW);
    expect(entregadaHoy.deliveredAt).toBe('2026-07-16');
    expect(entregadaHoy.updatedAt).toBe(NOW);
    expect(quote).toEqual(original);

    const deshecha = withQuoteDelivery(entregadaHoy, '', NOW);
    expect(deshecha.deliveredAt).toBe('');
    expect(workshopJobFromQuote(deshecha).delivered).toBe(false);
  });

  it('withQuoteDelivery rechaza fechas inválidas sin modificar la cotización', () => {
    const quote = sampleQuote({ status: 'aprobada', deliveredAt: '' });
    const original = structuredClone(quote);

    expect(() => withQuoteDelivery(quote, '2026-02-30', NOW)).toThrow(/fecha real/);
    expect(() => withQuoteDelivery(quote, '16\/07\/2026', NOW)).toThrow(/YYYY-MM-DD/);
    expect(quote).toEqual(original);
  });
});
