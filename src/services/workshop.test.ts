import { describe, expect, it } from 'vitest';
import { sampleClient, sampleQuote } from '../test/fixtures';
import { calculateQuote, quoteToCalcInput } from '../calc/engine';
import type { ProductionStage } from '../types';
import {
  countWorkshopJobs,
  filterWorkshopJobs,
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
    expect(job.paid).toBe(1000000);
    expect(job.balance).toBe(total - 1000000);
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
    expect(countWorkshopJobs(jobs, '')).toEqual({ todos: 2, enTaller: 1, listos: 1 });
    expect(countWorkshopJobs(jobs, 'Beatriz')).toEqual({ todos: 1, enTaller: 0, listos: 1 });
  });
});
