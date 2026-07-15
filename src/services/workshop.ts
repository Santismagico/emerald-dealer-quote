// Lógica PURA del área Taller: deriva los trabajos desde las cotizaciones
// aprobadas sin modificar los datos guardados. Un "trabajo" es una vista
// calculada (avance de etapas, abonos y saldo), nunca un registro nuevo.

import type { Quote } from '../types';
import { calculateQuote, quoteToCalcInput } from '../calc/engine';
import { productionSummary } from './production';
import { paymentsTotal } from './payments';
import { quoteMatchesHistorySearch } from './quoteStatus';

export type WorkshopFilter = 'todos' | 'enTaller' | 'listos';

export interface WorkshopJob {
  quote: Quote;
  /** Total cotizado al cliente (COP entero). */
  total: number;
  /** Total abonado por el cliente. */
  paid: number;
  /** Saldo que el cliente aún debe (total − abonos). */
  balance: number;
  stagesTotal: number;
  stagesDone: number;
  /** true cuando hay etapas y todas están listas. */
  ready: boolean;
}

export function workshopJobFromQuote(quote: Quote): WorkshopJob {
  const total = calculateQuote(quoteToCalcInput(quote)).total;
  const paid = paymentsTotal(quote.payments ?? []);
  const summary = productionSummary(quote.production ?? []);
  return {
    quote,
    total,
    paid,
    balance: total - paid,
    stagesTotal: summary.stagesTotal,
    stagesDone: summary.stagesDone,
    ready: summary.stagesTotal > 0 && summary.stagesDone === summary.stagesTotal
  };
}

/** Los trabajos del taller son las cotizaciones aprobadas, en el orden recibido. */
export function workshopJobsFromQuotes(quotes: readonly Quote[]): WorkshopJob[] {
  return quotes.filter((quote) => quote.status === 'aprobada').map(workshopJobFromQuote);
}

export function filterWorkshopJobs(
  jobs: readonly WorkshopJob[],
  search: string,
  filter: WorkshopFilter
): WorkshopJob[] {
  return jobs.filter((job) => {
    if (!quoteMatchesHistorySearch(job.quote, search)) return false;
    if (filter === 'enTaller') return !job.ready;
    if (filter === 'listos') return job.ready;
    return true;
  });
}

export function countWorkshopJobs(
  jobs: readonly WorkshopJob[],
  search: string
): Record<WorkshopFilter, number> {
  const counts: Record<WorkshopFilter, number> = { todos: 0, enTaller: 0, listos: 0 };
  for (const job of jobs) {
    if (!quoteMatchesHistorySearch(job.quote, search)) continue;
    counts.todos += 1;
    counts[job.ready ? 'listos' : 'enTaller'] += 1;
  }
  return counts;
}
