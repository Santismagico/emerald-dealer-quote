// Pantalla de UN trabajo del taller: producción y abonos de una cotización
// aprobada, fuera del flujo de cotización. Usa el mismo guardado diferido y
// serializado de la vista interna (services/quoteAutosave).

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import type { Quote, ProductionStage, ClientPayment } from '../types';
import { ProductionPanel } from './ProductionPanel';
import { PaymentsPanel } from './PaymentsPanel';
import { calculateQuote, quoteToCalcInput } from '../calc/engine';
import { workshopJobFromQuote, withQuoteDelivery } from '../services/workshop';
import { settlementPayment } from '../services/payments';
import { jobChip } from './WorkshopView';
import {
  createQuoteAutosaveController,
  runAfterSuccessfulFlush,
  type QuoteAutosaveController,
  type QuoteAutosaveStatus,
  type QuoteSaveMode
} from '../services/quoteAutosave';
import { formatCOP } from '../utils/money';
import { formatDateCO, todayISO } from '../utils/dates';
import { Button, ConfirmDialog, SummaryRow } from './ui';

export interface WorkshopJobViewHandle {
  flushPending: () => Promise<void>;
}

interface WorkshopJobViewProps {
  quote: Quote;
  onSaved: (quote: Quote) => void;
  onBack: () => void;
  onOpenQuote: (quote: Quote) => void;
}

export const WorkshopJobView = forwardRef<WorkshopJobViewHandle, WorkshopJobViewProps>(
  function WorkshopJobView({ quote, onSaved, onBack, onOpenQuote }, ref) {
    const store = useStore();
    const [saveStatus, setSaveStatus] = useState<QuoteAutosaveStatus>('idle');
    const mountedRef = useRef(true);

    const callbacksRef = useRef({ save: store.upsertQuote, onSaved, showToast: store.showToast });
    callbacksRef.current = { save: store.upsertQuote, onSaved, showToast: store.showToast };

    const autosaveRef = useRef<QuoteAutosaveController | null>(null);
    if (autosaveRef.current === null) {
      autosaveRef.current = createQuoteAutosaveController({
        initialQuote: quote,
        save: (latest) => callbacksRef.current.save(latest),
        onDraft: (latest) => callbacksRef.current.onSaved(latest),
        onStatus: (status) => {
          if (mountedRef.current) setSaveStatus(status);
        }
      });
    }
    const autosave = autosaveRef.current;

    useImperativeHandle(
      ref,
      () => ({
        flushPending: async () => {
          await autosave.flush();
        }
      }),
      [autosave]
    );

    useEffect(() => {
      mountedRef.current = true;
      const flushWhenHidden = () => {
        if (document.visibilityState === 'hidden') {
          void autosave.flush().catch(() => {
            // Al volver a la app se conserva el borrador y aparece la opción de reintentar.
          });
        }
      };
      document.addEventListener('visibilitychange', flushWhenHidden);
      return () => {
        document.removeEventListener('visibilitychange', flushWhenHidden);
        mountedRef.current = false;
        void autosave.flush().catch(() => {
          callbacksRef.current.showToast('No se pudo guardar. Los cambios siguen en pantalla.');
        });
      };
    }, [autosave]);

    const calc = useMemo(() => calculateQuote(quoteToCalcInput(quote)), [quote]);
    const job = useMemo(() => workshopJobFromQuote(quote), [quote]);
    const [confirmDelivery, setConfirmDelivery] = useState<'entregar' | 'deshacer' | null>(null);
    const [confirmPaid, setConfirmPaid] = useState(false);

    const flushPending = async () => {
      await autosave.flush();
    };

    /** Marca o deshace la entrega con el mismo guardado seguro del resto del trabajo. */
    const setDelivery = async (deliveredDate: string) => {
      try {
        autosave.update((current) =>
          withQuoteDelivery(current, deliveredDate, new Date().toISOString())
        );
        await autosave.flush();
        store.showToast(deliveredDate ? 'Joya marcada como entregada' : 'Entrega deshecha');
      } catch {
        store.showToast('No se pudo guardar. Puedes reintentar.');
      } finally {
        setConfirmDelivery(null);
      }
    };

    /**
     * "El cliente ya pagó todo": registra el saldo que falta como un pago de hoy
     * (D-028). La etiqueta "Pagada" sale sola de las cuentas y ese dinero queda
     * en el cierre del día, en vez de desaparecer.
     */
    const settleBalance = async () => {
      const latest = autosave.getLatest();
      const payment = settlementPayment(
        calculateQuote(quoteToCalcInput(latest)).total,
        latest.deposit,
        latest.payments
      );
      if (payment === null) {
        setConfirmPaid(false);
        return;
      }
      try {
        updatePayments((current) => [...current, payment], 'immediate');
        await autosave.flush();
        store.showToast('Joya marcada como pagada');
      } catch {
        store.showToast('No se pudo guardar. Puedes reintentar.');
      } finally {
        setConfirmPaid(false);
      }
    };

    const runAfterFlush = async (action: () => void) => {
      const saved = await runAfterSuccessfulFlush(flushPending, action);
      if (!saved) {
        store.showToast('No se pudo guardar. Reintenta antes de salir.');
      }
    };

    const updateProduction = (
      updater: (current: ProductionStage[]) => ProductionStage[],
      mode: QuoteSaveMode
    ) => {
      autosave.update((current) => ({ ...current, production: updater(current.production) }), mode);
    };

    const updatePayments = (
      updater: (current: ClientPayment[]) => ClientPayment[],
      mode: QuoteSaveMode
    ) => {
      autosave.update((current) => ({ ...current, payments: updater(current.payments) }), mode);
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="min-h-11 text-sm font-medium text-brand-800"
            onClick={() => void runAfterFlush(onBack)}
          >
            ← Taller
          </button>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${jobChip(job).className}`}>
            {jobChip(job).label}
          </span>
        </div>

        {saveStatus !== 'idle' ? (
          <div
            aria-live="polite"
            className={`flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs ${
              saveStatus === 'error'
                ? 'bg-red-50 text-red-700'
                : saveStatus === 'saved'
                  ? 'bg-brand-50 text-brand-800'
                  : 'bg-stone-200 text-stone-600'
            }`}
          >
            <span>
              {saveStatus === 'pending' && 'Cambios pendientes…'}
              {saveStatus === 'saving' && 'Guardando…'}
              {saveStatus === 'saved' && 'Guardado.'}
              {saveStatus === 'error' && 'No se pudo guardar. Tus cambios siguen en pantalla.'}
            </span>
            {saveStatus === 'error' ? (
              <button
                type="button"
                className="min-h-11 shrink-0 rounded-lg px-3 font-medium text-red-700 underline"
                onClick={() => void autosave.retry().catch(() => {})}
              >
                Reintentar
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
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
            </div>
            <button
              type="button"
              className="min-h-11 shrink-0 rounded-lg px-2 text-sm font-medium text-brand-800 active:bg-brand-50"
              onClick={() => void runAfterFlush(() => onOpenQuote(autosave.getLatest()))}
            >
              Ver cotización ›
            </button>
          </div>
          <div className="mt-3 space-y-1 border-t border-stone-100 pt-3">
            <SummaryRow label="Total cotizado" value={formatCOP(calc.total)} />
            <SummaryRow label="Total pagado por el cliente" value={formatCOP(job.paid)} />
            <SummaryRow
              label="Saldo pendiente"
              value={job.paidInFull ? 'Pagada ✓' : formatCOP(job.balance)}
              bold
              valueClass={job.paidInFull ? 'text-brand-800' : undefined}
            />
          </div>
          <div className="mt-3 space-y-2 border-t border-stone-100 pt-3">
            {job.paidInFull ? (
              <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900">
                ✓ <strong>Pagada.</strong> El cliente no debe nada.
              </p>
            ) : (
              <Button variant="secondary" full onClick={() => setConfirmPaid(true)}>
                El cliente ya pagó todo
              </Button>
            )}

            {job.delivered ? (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-stone-100 px-3 py-2">
                <p className="text-sm text-stone-700">
                  ✓ <strong>Entregada</strong> el {formatDateCO(quote.deliveredAt)}
                </p>
                <button
                  type="button"
                  className="min-h-10 shrink-0 rounded-lg px-2 text-sm font-medium text-stone-500 active:bg-stone-200"
                  onClick={() => setConfirmDelivery('deshacer')}
                >
                  Deshacer
                </button>
              </div>
            ) : (
              <Button
                variant={job.ready ? 'primary' : 'secondary'}
                full
                onClick={() => setConfirmDelivery('entregar')}
              >
                Marcar como entregada
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Trabajo interno del taller — no compartir con el cliente
          </p>

          <PaymentsPanel
            deposit={quote.deposit}
            depositDate={quote.depositDate}
            payments={quote.payments}
            quoteTotal={calc.total}
            onChange={updatePayments}
            onCommit={flushPending}
          />

          <ProductionPanel
            stages={quote.production}
            quoteTotal={calc.total}
            onChange={updateProduction}
            onCommit={flushPending}
          />
        </div>

        <ConfirmDialog
          open={confirmPaid}
          title="El cliente ya pagó todo"
          message={`Se registrará un pago de ${formatCOP(job.balance)} con la fecha de hoy y la joya quedará marcada como pagada. Ese dinero entra al cierre del día. Si el pago fue otro día o quieres anotar el medio de pago, edítalo después en la lista de pagos.`}
          confirmLabel="Sí, pagó todo"
          onCancel={() => setConfirmPaid(false)}
          onConfirm={() => void settleBalance()}
        />

        <ConfirmDialog
          open={confirmDelivery === 'entregar'}
          title="Entregar la joya"
          message={`¿Confirmas que la joya se entregó al cliente hoy?${
            !job.ready
              ? ` Ojo: aún hay etapas sin terminar (${job.stagesDone}/${job.stagesTotal} listas).`
              : ''
          }${job.balance > 0 ? ` El cliente aún debe ${formatCOP(job.balance)}.` : ''}`}
          confirmLabel="Sí, se entregó"
          onCancel={() => setConfirmDelivery(null)}
          onConfirm={() => void setDelivery(todayISO())}
        />

        <ConfirmDialog
          open={confirmDelivery === 'deshacer'}
          title="Deshacer entrega"
          message="¿Quitar la marca de entrega? El trabajo vuelve a aparecer como listo o en taller."
          confirmLabel="Deshacer"
          danger
          onCancel={() => setConfirmDelivery(null)}
          onConfirm={() => void setDelivery('')}
        />
      </div>
    );
  }
);
