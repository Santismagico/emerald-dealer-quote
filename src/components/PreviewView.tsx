// Vista previa de la cotización con dos pestañas:
// "Cliente" (lo que verá el cliente) e "Interno" (confidencial).
// Desde aquí se guarda, se genera PDF y se comparte por WhatsApp.

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import type { Quote, QuoteStatus } from '../types';
import { QUOTE_STATUSES } from '../types';
import { workshopJobFromQuote } from '../services/workshop';
import { calculateQuote, quoteToCalcInput } from '../calc/engine';
import {
  buildClientPdfContent,
  stoneClientDescription,
  findSensitiveWordsInClientText,
  findSensitiveWordsInText
} from '../services/pdfContent';
import { downloadClientPdf, downloadInternalPdf } from '../services/pdf';
import {
  clientPdfShareMessage,
  createPdfShareController,
  runClientPdfShareFlow,
  shareClientPdf,
  type PdfShareController
} from '../services/pdfShare';
import { buildWhatsAppMessage, whatsAppLink } from '../services/whatsapp';
import { getEffectiveQuoteStatus, withQuoteStatus } from '../services/quoteStatus';
import {
  createQuoteAutosaveController,
  runAfterSuccessfulFlush,
  type QuoteAutosaveController,
  type QuoteAutosaveStatus
} from '../services/quoteAutosave';
import { formatCOP } from '../utils/money';
import { formatDateCO, todayISO } from '../utils/dates';
import { Button, ConfirmDialog, Select, StatusBadge, SummaryRow } from './ui';

export interface PreviewViewHandle {
  flushPending: () => Promise<void>;
}

interface PreviewViewProps {
  quote: Quote;
  onEdit: () => void;
  onSaved: (quote: Quote) => void;
  onClose: () => void;
  /** Abre el trabajo del taller (producción y abonos) de esta cotización. */
  onOpenWorkshop: () => void;
  initialTab?: 'cliente' | 'interno';
}

export const PreviewView = forwardRef<PreviewViewHandle, PreviewViewProps>(function PreviewView(
  { quote, onEdit, onSaved, onClose, onOpenWorkshop, initialTab = 'cliente' },
  ref
) {
  const store = useStore();
  const [tab, setTab] = useState<'cliente' | 'interno'>(initialTab);
  const [busy, setBusy] = useState(false);
  const [sharePreparing, setSharePreparing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<QuoteAutosaveStatus>('idle');
  const mountedRef = useRef(true);
  const numberPromiseRef = useRef<Promise<string> | null>(null);
  // Aviso de privacidad: la salida queda bloqueada hasta corregir el texto.
  const [sensitiveWarning, setSensitiveWarning] = useState<string[] | null>(null);

  const callbacksRef = useRef({
    save: store.upsertQuote,
    nextQuoteNumber: store.nextQuoteNumber,
    onSaved,
    showToast: store.showToast
  });
  callbacksRef.current = {
    save: store.upsertQuote,
    nextQuoteNumber: store.nextQuoteNumber,
    onSaved,
    showToast: store.showToast
  };

  const autosaveRef = useRef<QuoteAutosaveController | null>(null);
  const pdfShareControllerRef = useRef<PdfShareController | null>(null);
  if (pdfShareControllerRef.current === null) {
    pdfShareControllerRef.current = createPdfShareController((sharing) => {
      if (mountedRef.current) {
        setBusy(sharing);
        setSharePreparing(sharing);
      }
    });
  }
  const pdfShareController = pdfShareControllerRef.current;
  const requestQuoteNumber = async () => {
    if (numberPromiseRef.current === null) {
      numberPromiseRef.current = callbacksRef.current.nextQuoteNumber();
    }
    const pendingNumber = numberPromiseRef.current;
    try {
      return await pendingNumber;
    } finally {
      if (numberPromiseRef.current === pendingNumber) numberPromiseRef.current = null;
    }
  };

  if (autosaveRef.current === null) {
    autosaveRef.current = createQuoteAutosaveController({
      initialQuote: quote,
      save: async (latest) => {
        if (!latest.number) {
          const number = await requestQuoteNumber();
          if (!autosaveRef.current?.getLatest().number) {
            autosaveRef.current?.update((current) => ({ ...current, number }));
          }
          return;
        }
        await callbacksRef.current.save(latest);
      },
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
  const workshopSummary = useMemo(() => workshopJobFromQuote(quote), [quote]);
  const effectiveStatus = getEffectiveQuoteStatus(quote, todayISO());
  const clientContent = useMemo(
    () => buildClientPdfContent(quote, calc, store.settings),
    [quote, calc, store.settings]
  );

  const ensureQuoteNumber = async (): Promise<Quote> => {
    const current = autosave.getLatest();
    if (current.number) return current;

    const number = await requestQuoteNumber();
    if (!autosave.getLatest().number) {
      autosave.update((latest) => ({ ...latest, number }));
    }
    return autosave.getLatest();
  };

  /** Guarda la última versión local, nunca la prop capturada por un render anterior. */
  const persist = async (): Promise<Quote> => {
    await ensureQuoteNumber();
    return autosave.commit();
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      const saved = await persist();
      store.showToast(`Guardada como ${saved.number}`);
    } catch {
      store.showToast('No se pudo guardar. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const doClientPdf = async () => {
    const current = autosave.getLatest();
    const currentCalc = calculateQuote(quoteToCalcInput(current));
    const words = findSensitiveWordsInClientText(current, currentCalc, store.settings);
    if (words.length > 0) {
      setSensitiveWarning(words);
      return;
    }

    setBusy(true);
    try {
      const saved = await persist();
      const savedCalc = calculateQuote(quoteToCalcInput(saved));
      const savedWords = findSensitiveWordsInClientText(saved, savedCalc, store.settings);
      if (savedWords.length > 0) {
        setSensitiveWarning(savedWords);
        return;
      }
      await downloadClientPdf(saved, savedCalc, store.settings);
      store.showToast('PDF del cliente generado');
    } catch {
      store.showToast('No se pudo generar el PDF.');
    } finally {
      setBusy(false);
    }
  };

  const doShareClientPdf = async () => {
    try {
      const outcome = await pdfShareController.start(async () => {
        const current = autosave.getLatest();
        const currentCalc = calculateQuote(quoteToCalcInput(current));
        return runClientPdfShareFlow({
          quote: current,
          calc: currentCalc,
          settings: store.settings,
          persist,
          share: (saved) =>
            shareClientPdf(saved, calculateQuote(quoteToCalcInput(saved)), store.settings)
        });
      });

      if (outcome === null) return;
      if (outcome.status === 'sensitive') {
        setSensitiveWarning(outcome.words);
        return;
      }

      store.showToast(clientPdfShareMessage(outcome.result));
    } catch {
      store.showToast('No se pudo preparar el PDF. Puedes descargarlo manualmente.');
    }
  };

  const handleInternalPdf = async () => {
    setBusy(true);
    try {
      const saved = await persist();
      await downloadInternalPdf(saved, calculateQuote(quoteToCalcInput(saved)), store.settings);
      store.showToast('PDF interno generado');
    } catch {
      store.showToast('No se pudo generar el PDF interno.');
    } finally {
      setBusy(false);
    }
  };

  const doWhatsApp = async () => {
    const current = autosave.getLatest();
    const currentCalc = calculateQuote(quoteToCalcInput(current));
    const words = findSensitiveWordsInText(buildWhatsAppMessage(current, currentCalc, store.settings));
    if (words.length > 0) {
      setSensitiveWarning(words);
      return;
    }

    setBusy(true);
    try {
      const saved = await persist();
      const message = buildWhatsAppMessage(saved, calculateQuote(quoteToCalcInput(saved)), store.settings);
      const savedWords = findSensitiveWordsInText(message);
      if (savedWords.length > 0) {
        setSensitiveWarning(savedWords);
        return;
      }
      const link = whatsAppLink(message, saved.clientSnapshot?.phone);
      // OJO: no pasar 'noopener' como feature — hace que window.open devuelva
      // null AUNQUE la ventana se abra, y el fallback navegaría la app entera
      // (bug detectado en auditoría). Se anula opener a mano.
      const win = window.open(link, '_blank');
      if (win) {
        win.opener = null;
      } else {
        // Ventana bloqueada (Safari tras un await): navegación directa como último recurso.
        window.location.href = link;
      }
    } catch {
      store.showToast('No se pudo abrir WhatsApp.');
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (status: QuoteStatus) => {
    try {
      // Misma lógica del historial (D-019/D-024): etapas estándar y approvedAt al aprobar.
      autosave.update((current) => withQuoteStatus(current, status, new Date().toISOString()));
      await ensureQuoteNumber();
      await autosave.flush();
      store.showToast(`Estado: ${status}`);
    } catch {
      store.showToast('No se pudo guardar el estado. Puedes reintentar.');
    }
  };

  const flushPending = async () => {
    await autosave.flush();
  };

  const runAfterFlush = async (action: () => void) => {
    const saved = await runAfterSuccessfulFlush(flushPending, action);
    if (!saved) {
      store.showToast('No se pudo guardar. Reintenta antes de salir.');
    }
  };

  const changeTab = async (next: 'cliente' | 'interno') => {
    if (next === tab) return;
    await runAfterFlush(() => setTab(next));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="min-h-11 text-sm font-medium text-brand-800"
          onClick={() => void runAfterFlush(onClose)}
        >
          ← Volver
        </button>
        <StatusBadge status={effectiveStatus} />
      </div>

      {/* Pestañas cliente / interno */}
      <div className="grid grid-cols-2 gap-1 rounded-full bg-stone-200 p-1">
        <button
          type="button"
          onClick={() => void changeTab('cliente')}
          className={`min-h-11 rounded-full py-2 text-sm font-medium ${tab === 'cliente' ? 'bg-white text-brand-900 shadow' : 'text-stone-600'}`}
        >
          Vista cliente
        </button>
        <button
          type="button"
          onClick={() => void changeTab('interno')}
          className={`min-h-11 rounded-full py-2 text-sm font-medium ${tab === 'interno' ? 'bg-white text-brand-900 shadow' : 'text-stone-600'}`}
        >
          🔒 Interna
        </button>
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

      {tab === 'cliente' ? (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          {/* Réplica fiel de lo que verá el cliente: sin datos sensibles */}
          <div className="border-b border-stone-200 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {store.settings.logoDataUrl ? (
                  <img src={store.settings.logoDataUrl} alt="Logo" className="h-12 w-12 rounded-lg object-contain" />
                ) : null}
                <div>
                  <p className="font-semibold text-brand-900">{clientContent.jewelryName}</p>
                  {clientContent.contactLines.map((line) => (
                    <p key={line} className="text-xs text-stone-500">
                      {line}
                    </p>
                  ))}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold text-stone-900">{clientContent.docTitle}</p>
                <p className="text-xs text-stone-500">{quote.number || 'Sin número'}</p>
                <p className="text-xs text-stone-500">{formatDateCO(quote.date)}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4">
            {clientContent.sections.map((section) => (
              <div key={section.title}>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-800">{section.title}</p>
                <div className="mt-1 space-y-1">
                  {(section.rows ?? []).map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3 text-sm">
                      <span className="text-stone-500">{label}</span>
                      <span className="text-right text-stone-800">{value}</span>
                    </div>
                  ))}
                  {(section.paragraphs ?? []).map((p) => (
                    <p key={p} className="text-sm text-stone-700">
                      {p}
                    </p>
                  ))}
                </div>
              </div>
            ))}

            {quote.images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {quote.images.map((img, i) => (
                  <img key={i} src={img} alt={`Referencia ${i + 1}`} className="h-20 w-20 rounded-xl object-cover" />
                ))}
              </div>
            )}

            <div className="space-y-1 border-t border-stone-200 pt-3">
              {clientContent.totals.map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-stone-500">{label}</span>
                  <span className="text-stone-800">{value}</span>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-xl bg-brand-900 px-4 py-3 text-white">
                <span className="text-sm font-semibold">{clientContent.totalLine[0]}</span>
                <span className="text-lg font-bold">{clientContent.totalLine[1]}</span>
              </div>
            </div>

            <p className="text-center text-xs italic text-stone-500">{clientContent.footer}</p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-700">
            🔒 Información confidencial — no compartir con el cliente
          </p>
          <div className="space-y-1.5">
            <SummaryRow label="Subtotal material" value={formatCOP(calc.materialSubtotal)} />
            <SummaryRow label="Subtotal piedras" value={formatCOP(calc.stonesSubtotal)} />
            <SummaryRow label="Mano de obra" value={formatCOP(calc.laborSubtotal)} />
            <SummaryRow label="Costos adicionales" value={formatCOP(calc.extrasSubtotal)} />
            <SummaryRow label="Costo base" value={formatCOP(calc.baseCost)} bold />
            <SummaryRow label={`Margen (${quote.marginPercent}%)`} value={formatCOP(calc.marginAmount)} />
            <SummaryRow label="Subtotal comercial" value={formatCOP(calc.subtotal)} />
            <SummaryRow label="Descuento" value={`- ${formatCOP(calc.discountAmount)}`} />
            <SummaryRow label="Impuesto" value={formatCOP(calc.taxAmount)} />
            <SummaryRow label="Total" value={formatCOP(calc.total)} bold />
            <SummaryRow label="Anticipo" value={formatCOP(calc.deposit)} />
            <SummaryRow label="Saldo" value={formatCOP(calc.balance)} />
          </div>
          {quote.stones.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-amber-700">Piedras (interno)</p>
              {quote.stones.map((s) => (
                <p key={s.id} className="mt-1 text-sm text-stone-700">
                  • {stoneClientDescription(s)} — {s.priceMode === 'porQuilate' ? `${formatCOP(s.unitPrice)}/ct` : `${formatCOP(s.unitPrice)} c/u`}
                  {s.notes ? ` — ${s.notes}` : ''}
                </p>
              ))}
            </div>
          )}
          {quote.internalNotes && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-amber-700">Notas internas</p>
              <p className="mt-1 text-sm text-stone-700">{quote.internalNotes}</p>
            </div>
          )}
          <p className="mt-4 text-xs text-stone-500">{store.settings.goldPriceNote}</p>

          {quote.status === 'aprobada' ? (
            <div className="mt-4 border-t border-amber-200 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                🛠 Trabajo del taller
              </p>
              <div className="space-y-1 rounded-xl bg-white p-3 shadow-sm">
                <SummaryRow
                  label="Etapas listas"
                  value={`${workshopSummary.stagesDone}/${workshopSummary.stagesTotal}`}
                />
                <SummaryRow label="Abonado por el cliente" value={formatCOP(workshopSummary.paid)} />
                <SummaryRow label="Saldo pendiente" value={formatCOP(workshopSummary.balance)} bold />
              </div>
              <div className="mt-2">
                <Button variant="secondary" full onClick={() => void runAfterFlush(onOpenWorkshop)}>
                  🛠 Abrir en el Taller
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-white/60 p-3 text-xs text-stone-500">
              🛠 Al pasar a estado <strong>aprobada</strong>, esta cotización se convierte en un trabajo
              del taller: sus etapas de producción y los abonos del cliente se manejan en la pestaña{' '}
              <strong>Taller</strong>.
            </p>
          )}

          <div className="mt-4">
            <Button variant="secondary" full onClick={handleInternalPdf} disabled={busy}>
              Descargar PDF interno
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-3">
          <span className="mb-1 block text-sm font-medium text-stone-700">Estado de la cotización</span>
          <Select
            value={quote.status}
            onChange={(v) => void changeStatus(v as QuoteStatus)}
            options={QUOTE_STATUSES.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
          />
          {effectiveStatus !== quote.status ? (
            <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
              Esta cotización se muestra como vencida porque su fecha ya pasó. Su estado guardado sigue siendo{' '}
              <strong>{quote.status}</strong> hasta que lo cambies aquí.
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => void runAfterFlush(onEdit)} disabled={busy}>
            ✏ Editar
          </Button>
          <Button onClick={handleSave} disabled={busy}>
            💾 Guardar
          </Button>
          <Button variant="secondary" onClick={() => void doClientPdf()} disabled={busy}>
            📄 PDF cliente
          </Button>
          <Button onClick={() => void doWhatsApp()} disabled={busy}>
            📲 WhatsApp
          </Button>
          <div className="col-span-2">
            <Button variant="secondary" full onClick={() => void doShareClientPdf()} disabled={busy}>
              📤 Compartir PDF
            </Button>
          </div>
        </div>
        {busy ? (
          <p className="mt-2 text-center text-sm text-stone-500">
            {sharePreparing ? 'Preparando PDF para compartir…' : 'Procesando…'}
          </p>
        ) : null}
      </div>

      <ConfirmDialog
        open={sensitiveWarning !== null}
        title="Salida bloqueada"
        message="Se detectó información reservada en el contenido para el cliente. La salida no se generó ni se compartió. Vuelve a editar la cotización y corrige el texto antes de intentarlo otra vez."
        confirmLabel="Volver y corregir"
        cancelLabel={null}
        onConfirm={() => setSensitiveWarning(null)}
        onCancel={() => setSensitiveWarning(null)}
      />
    </div>
  );
});
