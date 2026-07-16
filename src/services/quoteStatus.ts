import type { Quote, QuoteStatus } from '../types';
import { QUOTE_STATUSES } from '../types';
import { isExpired } from '../utils/dates';
import { defaultProductionStages } from './production';

export type HistoryStatusFilter = QuoteStatus | 'todas';

/**
 * Estados que Santiago puede asignar a mano desde el historial.
 * "vencida" queda fuera: es un estado derivado de la fecha (D-013)
 * y volvería solo aunque se quitara manualmente.
 */
export const SELECTABLE_QUOTE_STATUSES: QuoteStatus[] = [
  'borrador',
  'pendiente',
  'aprobada',
  'rechazada'
];

/**
 * Copia de la cotización con el nuevo estado, sin tocar el objeto original.
 * Es la ÚNICA lógica de cambio de estado (historial y vista previa):
 * al ENTRAR a aprobada se crean las etapas estándar del taller si faltan y
 * se registra approvedAt para el Cierre del día. Salir de aprobada conserva
 * el registro histórico.
 */
export function withQuoteStatus(quote: Quote, status: QuoteStatus, nowIso: string): Quote {
  const approving = status === 'aprobada' && quote.status !== 'aprobada';
  const production =
    status === 'aprobada' && quote.production.length === 0
      ? defaultProductionStages()
      : quote.production;
  return {
    ...quote,
    status,
    production,
    approvedAt: approving ? nowIso : quote.approvedAt,
    updatedAt: nowIso
  };
}

/**
 * Estado que debe mostrar la interfaz sin modificar la cotización guardada.
 * Solo borradores y pendientes pasan a vencida cuando la fecha ya terminó.
 */
export function getEffectiveQuoteStatus<TStatus extends string>(
  quote: { status: TStatus; validUntil: string },
  today: string
): TStatus | 'vencida' {
  const canExpire = quote.status === 'borrador' || quote.status === 'pendiente';
  return canExpire && isExpired(quote.validUntil, today) ? 'vencida' : quote.status;
}

export function quoteMatchesHistorySearch(
  quote: Pick<Quote, 'number' | 'clientSnapshot' | 'pieceDescription'>,
  search: string
): boolean {
  const term = search.trim().toLowerCase();
  if (!term) return true;

  const haystack = `${quote.number} ${quote.clientSnapshot?.name ?? ''} ${quote.pieceDescription}`.toLowerCase();
  return haystack.includes(term);
}

export function filterHistoryQuotes(
  quotes: readonly Quote[],
  search: string,
  statusFilter: HistoryStatusFilter,
  today: string
): Quote[] {
  return quotes.filter((quote) => {
    if (!quoteMatchesHistorySearch(quote, search)) return false;
    return statusFilter === 'todas' || getEffectiveQuoteStatus(quote, today) === statusFilter;
  });
}

export function countHistoryQuotesByStatus(
  quotes: readonly Quote[],
  search: string,
  today: string
): Record<HistoryStatusFilter, number> {
  const counts = Object.fromEntries(
    (['todas', ...QUOTE_STATUSES] as const).map((status) => [status, 0])
  ) as Record<HistoryStatusFilter, number>;

  for (const quote of quotes) {
    if (!quoteMatchesHistorySearch(quote, search)) continue;
    counts.todas += 1;
    counts[getEffectiveQuoteStatus(quote, today)] += 1;
  }

  return counts;
}
