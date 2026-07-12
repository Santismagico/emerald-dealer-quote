// Historial de cotizaciones: búsqueda por cliente/número, filtro por estado,
// cambio rápido de estado tocando la etiqueta, abrir, editar, duplicar
// y eliminar (con confirmación).

import { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { Quote, QuoteStatus } from '../types';
import { QUOTE_STATUSES } from '../types';
import { calculateQuote, quoteToCalcInput } from '../calc/engine';
import { formatCOP } from '../utils/money';
import { formatDateCO, todayISO } from '../utils/dates';
import {
  countHistoryQuotesByStatus,
  filterHistoryQuotes,
  getEffectiveQuoteStatus,
  SELECTABLE_QUOTE_STATUSES,
  withQuoteStatus
} from '../services/quoteStatus';
import { Button, StatusBadge, ConfirmDialog, EmptyState, TextInput } from './ui';

export function HistoryView({
  onNew,
  onOpen,
  onOpenInternal,
  onEdit,
  onDuplicate
}: {
  onNew: () => void;
  onOpen: (quote: Quote) => void;
  onOpenInternal: (quote: Quote) => void;
  onEdit: (quote: Quote) => void;
  onDuplicate: (quote: Quote) => void;
}) {
  const store = useStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'todas'>('todas');
  const [toDelete, setToDelete] = useState<Quote | null>(null);
  const [statusMenuFor, setStatusMenuFor] = useState<Quote | null>(null);
  const today = todayISO();

  const changeStatus = async (quote: Quote, status: QuoteStatus) => {
    setStatusMenuFor(null);
    if (status === quote.status) return;
    await store.upsertQuote(withQuoteStatus(quote, status, new Date().toISOString()));
    store.showToast(`Estado cambiado a ${status}`);
  };

  const filtered = useMemo(
    () => filterHistoryQuotes(store.quotes, search, statusFilter, today),
    [store.quotes, search, statusFilter, today]
  );
  const statusCounts = useMemo(
    () => countHistoryQuotesByStatus(store.quotes, search, today),
    [store.quotes, search, today]
  );

  return (
    <div className="space-y-4">
      <Button full onClick={onNew}>
        ＋ Nueva cotización
      </Button>

      <TextInput value={search} onChange={setSearch} placeholder="Buscar por cliente o número…" />

      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-2 pb-1">
          {(['todas', ...QUOTE_STATUSES] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`whitespace-nowrap rounded-full px-3.5 py-2 text-sm capitalize ${
                statusFilter === s ? 'bg-brand-800 text-white' : 'bg-white text-stone-600'
              }`}
            >
              {s} ({statusCounts[s]})
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Sin cotizaciones"
          message={
            store.quotes.length === 0
              ? 'Crea tu primera cotización con el botón de arriba.'
              : 'Ninguna cotización coincide con la búsqueda o el filtro.'
          }
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((quote) => {
            const total = calculateQuote(quoteToCalcInput(quote)).total;
            const effectiveStatus = getEffectiveQuoteStatus(quote, today);
            return (
              <li key={quote.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onOpen(quote)}
                  >
                    <p className="truncate font-semibold text-stone-900">
                      {quote.clientSnapshot?.name || 'Sin cliente'}
                    </p>
                    <p className="text-xs text-stone-500">
                      {quote.number || 'Sin número'} · {formatDateCO(quote.date)}
                    </p>
                    <p className="mt-1 truncate text-sm capitalize text-stone-600">
                      {quote.pieceType}
                      {quote.pieceDescription ? ` · ${quote.pieceDescription}` : ''}
                    </p>
                  </button>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold text-brand-900">{formatCOP(total)}</p>
                    <button
                      type="button"
                      onClick={() => setStatusMenuFor(quote)}
                      className="-mr-1.5 mt-0.5 flex min-h-10 items-center justify-end gap-1 rounded-lg px-1.5 active:bg-stone-100"
                      aria-label={`Cambiar estado de la cotización ${quote.number || 'sin número'}`}
                    >
                      <StatusBadge status={effectiveStatus} />
                      <span className="text-xs text-stone-400">▾</span>
                    </button>
                  </div>
                </div>
                {quote.status === 'aprobada' && (
                  <button
                    type="button"
                    onClick={() => onOpenInternal(quote)}
                    className="mt-2 flex min-h-11 w-full items-center justify-between rounded-xl bg-amber-50 px-3 py-2.5 text-left"
                  >
                    <span className="text-sm font-medium text-amber-800">
                      🛠 Producción: {quote.production.filter((s) => s.status === 'lista').length}/
                      {quote.production.length} etapas listas
                    </span>
                    <span className="text-amber-700">›</span>
                  </button>
                )}
                <div className="mt-3 flex gap-2 border-t border-stone-100 pt-3">
                  <ActionLink label="Editar" onClick={() => onEdit(quote)} />
                  <ActionLink label="Duplicar" onClick={() => onDuplicate(quote)} />
                  <ActionLink label="Eliminar" danger onClick={() => setToDelete(quote)} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {statusMenuFor !== null && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setStatusMenuFor(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-stone-900">Cambiar estado</h3>
            <p className="mt-1 text-sm text-stone-600">
              {statusMenuFor.number || 'Sin número'} ·{' '}
              {statusMenuFor.clientSnapshot?.name || 'Sin cliente'}
            </p>
            <div className="mt-4 space-y-2">
              {SELECTABLE_QUOTE_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void changeStatus(statusMenuFor, s)}
                  className={`flex min-h-12 w-full items-center justify-between rounded-xl border px-3 ${
                    statusMenuFor.status === s
                      ? 'border-brand-700 bg-brand-50'
                      : 'border-stone-200 bg-white active:bg-stone-50'
                  }`}
                >
                  <StatusBadge status={s} />
                  <span className="text-xs text-stone-500">
                    {statusMenuFor.status === s ? 'Actual' : '›'}
                  </span>
                </button>
              ))}
            </div>
            {getEffectiveQuoteStatus(statusMenuFor, today) === 'vencida' && (
              <p className="mt-3 text-xs text-stone-500">
                “Vencida” se marca sola cuando pasa la fecha de validez; para quitarla, cambia la
                fecha o elige otro estado.
              </p>
            )}
            <div className="mt-4">
              <Button variant="ghost" full onClick={() => setStatusMenuFor(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Eliminar cotización"
        message={`¿Eliminar la cotización ${toDelete?.number || 'sin número'} de ${
          toDelete?.clientSnapshot?.name || 'cliente sin nombre'
        }? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete) {
            await store.removeQuote(toDelete.id);
            store.showToast('Cotización eliminada');
          }
          setToDelete(null);
        }}
      />
    </div>
  );
}

function ActionLink({ label, onClick, danger = false }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-10 flex-1 rounded-lg text-sm font-medium ${
        danger ? 'text-red-600 active:bg-red-50' : 'text-brand-800 active:bg-brand-50'
      }`}
    >
      {label}
    </button>
  );
}
