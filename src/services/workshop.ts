// Lógica PURA del área Taller: deriva los trabajos desde las cotizaciones
// aprobadas sin modificar los datos guardados. Un "trabajo" es una vista
// calculada (avance de etapas, abonos y saldo), nunca un registro nuevo.

import type { Quote } from '../types';
import { calculateQuote, quoteToCalcInput } from '../calc/engine';
import { productionSummary } from './production';
import { clientPaidTotal } from './payments';
import { quoteMatchesHistorySearch } from './quoteStatus';
import { isValidISODate } from '../utils/dates';

export type WorkshopFilter = 'todos' | 'enTaller' | 'listos' | 'entregados';

export interface WorkshopJob {
  quote: Quote;
  /** Total cotizado al cliente (COP entero). */
  total: number;
  /** Total pagado por el cliente: anticipo + abonos posteriores. */
  paid: number;
  /** Saldo que el cliente aún debe (total − anticipo − abonos posteriores). */
  balance: number;
  stagesTotal: number;
  stagesDone: number;
  /** true cuando hay etapas y todas están listas. */
  ready: boolean;
  /** true cuando la joya ya se ENTREGÓ al cliente (independiente de "lista"). */
  delivered: boolean;
}

/** Una entrega solo existe si tiene una fecha real en formato YYYY-MM-DD. */
export function isQuoteDelivered(quote: Pick<Quote, 'deliveredAt'>): boolean {
  return isValidISODate(quote.deliveredAt);
}

export function workshopJobFromQuote(quote: Quote): WorkshopJob {
  const total = calculateQuote(quoteToCalcInput(quote)).total;
  const paid = clientPaidTotal(quote.deposit, quote.payments ?? []);
  const summary = productionSummary(quote.production ?? []);
  return {
    quote,
    total,
    paid,
    balance: total - paid,
    stagesTotal: summary.stagesTotal,
    stagesDone: summary.stagesDone,
    ready: summary.stagesTotal > 0 && summary.stagesDone === summary.stagesTotal,
    delivered: isQuoteDelivered(quote)
  };
}

/**
 * Copia de la cotización marcada como entregada (o no), sin tocar el original.
 * `deliveredDate` es YYYY-MM-DD; con '' se deshace la entrega.
 */
export function withQuoteDelivery(quote: Quote, deliveredDate: string, nowIso: string): Quote {
  if (deliveredDate !== '' && !isValidISODate(deliveredDate)) {
    throw new Error('La fecha de entrega debe ser una fecha real con formato YYYY-MM-DD.');
  }
  return { ...quote, deliveredAt: deliveredDate, updatedAt: nowIso };
}

/** Los trabajos del taller son las cotizaciones aprobadas, en el orden recibido. */
export function workshopJobsFromQuotes(quotes: readonly Quote[]): WorkshopJob[] {
  return quotes.filter((quote) => quote.status === 'aprobada').map(workshopJobFromQuote);
}

/** Categoría única de un trabajo: entregado manda sobre listo y en taller. */
function jobCategory(job: WorkshopJob): Exclude<WorkshopFilter, 'todos'> {
  if (job.delivered) return 'entregados';
  return job.ready ? 'listos' : 'enTaller';
}

export function filterWorkshopJobs(
  jobs: readonly WorkshopJob[],
  search: string,
  filter: WorkshopFilter
): WorkshopJob[] {
  return jobs.filter((job) => {
    if (!quoteMatchesHistorySearch(job.quote, search)) return false;
    return filter === 'todos' || jobCategory(job) === filter;
  });
}

export function countWorkshopJobs(
  jobs: readonly WorkshopJob[],
  search: string
): Record<WorkshopFilter, number> {
  const counts: Record<WorkshopFilter, number> = {
    todos: 0,
    enTaller: 0,
    listos: 0,
    entregados: 0
  };
  for (const job of jobs) {
    if (!quoteMatchesHistorySearch(job.quote, search)) continue;
    counts.todos += 1;
    counts[jobCategory(job)] += 1;
  }
  return counts;
}
