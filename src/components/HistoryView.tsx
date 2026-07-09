// Historial de cotizaciones: búsqueda por cliente/número, filtro por estado,
// abrir, editar, duplicar y eliminar (con confirmación).

import { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { Quote, QuoteStatus } from '../types';
import { QUOTE_STATUSES } from '../types';
import { calculateQuote, quoteToCalcInput } from '../calc/engine';
import { formatCOP } from '../utils/money';
import { formatDateCO, isExpired } from '../utils/dates';
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

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return store.quotes.filter((q) => {
      if (statusFilter !== 'todas' && q.status !== statusFilter) return false;
      if (!term) return true;
      const haystack = `${q.number} ${q.clientSnapshot?.name ?? ''} ${q.pieceDescription}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [store.quotes, search, statusFilter]);

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
              {s}
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
              : 'Ninguna cotización coincide con la búsqueda.'
          }
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((quote) => {
            const total = calculateQuote(quoteToCalcInput(quote)).total;
            const expired = isExpired(quote.validUntil) && (quote.status === 'pendiente' || quote.status === 'borrador');
            return (
              <li key={quote.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <button type="button" className="block w-full text-left" onClick={() => onOpen(quote)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-stone-900">
                        {quote.clientSnapshot?.name || 'Sin cliente'}
                      </p>
                      <p className="text-xs text-stone-500">
                        {quote.number || 'Sin número'} · {formatDateCO(quote.date)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold text-brand-900">{formatCOP(total)}</p>
                      <div className="mt-1 flex items-center justify-end gap-1">
                        <StatusBadge status={quote.status} />
                        {expired ? <span className="text-xs text-red-600">vencida</span> : null}
                      </div>
                    </div>
                  </div>
                  <p className="mt-1 truncate text-sm capitalize text-stone-600">
                    {quote.pieceType}
                    {quote.pieceDescription ? ` · ${quote.pieceDescription}` : ''}
                  </p>
                </button>
                {quote.status === 'aprobada' && (
                  <button
                    type="button"
                    onClick={() => onOpenInternal(quote)}
                    className="mt-2 flex w-full items-center justify-between rounded-xl bg-amber-50 px-3 py-2.5 text-left"
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
