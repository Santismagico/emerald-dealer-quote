// Vista previa de la cotización con dos pestañas:
// "Cliente" (lo que verá el cliente) e "Interno" (confidencial).
// Desde aquí se guarda, se genera PDF y se comparte por WhatsApp.

import { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { Quote, QuoteStatus } from '../types';
import { QUOTE_STATUSES } from '../types';
import { calculateQuote, quoteToCalcInput } from '../calc/engine';
import { buildClientPdfContent, stoneClientDescription } from '../services/pdfContent';
import { downloadClientPdf, downloadInternalPdf } from '../services/pdf';
import { buildWhatsAppMessage, whatsAppLink } from '../services/whatsapp';
import { formatCOP } from '../utils/money';
import { formatDateCO } from '../utils/dates';
import { Button, Select, StatusBadge } from './ui';

export function PreviewView({
  quote,
  onEdit,
  onSaved,
  onClose
}: {
  quote: Quote;
  onEdit: () => void;
  onSaved: (quote: Quote) => void;
  onClose: () => void;
}) {
  const store = useStore();
  const [tab, setTab] = useState<'cliente' | 'interno'>('cliente');
  const [busy, setBusy] = useState(false);

  const calc = useMemo(() => calculateQuote(quoteToCalcInput(quote)), [quote]);
  const clientContent = useMemo(
    () => buildClientPdfContent(quote, calc, store.settings),
    [quote, calc, store.settings]
  );

  /** Guarda la cotización asignando número si aún no tiene. Devuelve la versión guardada. */
  const persist = async (): Promise<Quote> => {
    const number = quote.number || (await store.nextQuoteNumber());
    const saved: Quote = { ...quote, number, updatedAt: new Date().toISOString() };
    await store.upsertQuote(saved);
    onSaved(saved);
    return saved;
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

  const handleClientPdf = async () => {
    setBusy(true);
    try {
      const saved = await persist();
      await downloadClientPdf(saved, calc, store.settings);
      store.showToast('PDF del cliente generado');
    } catch {
      store.showToast('No se pudo generar el PDF.');
    } finally {
      setBusy(false);
    }
  };

  const handleInternalPdf = async () => {
    setBusy(true);
    try {
      const saved = await persist();
      await downloadInternalPdf(saved, calc, store.settings);
      store.showToast('PDF interno generado');
    } catch {
      store.showToast('No se pudo generar el PDF interno.');
    } finally {
      setBusy(false);
    }
  };

  const handleWhatsApp = async () => {
    setBusy(true);
    try {
      const saved = await persist();
      const message = buildWhatsAppMessage(saved, calc, store.settings);
      const link = whatsAppLink(message, saved.clientSnapshot?.phone);
      window.open(link, '_blank', 'noopener');
    } catch {
      store.showToast('No se pudo abrir WhatsApp.');
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (status: QuoteStatus) => {
    const saved: Quote = {
      ...quote,
      number: quote.number || (await store.nextQuoteNumber()),
      status,
      updatedAt: new Date().toISOString()
    };
    await store.upsertQuote(saved);
    onSaved(saved);
    store.showToast(`Estado: ${status}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button type="button" className="text-sm font-medium text-brand-800" onClick={onClose}>
          ← Volver
        </button>
        <StatusBadge status={quote.status} />
      </div>

      {/* Pestañas cliente / interno */}
      <div className="grid grid-cols-2 gap-1 rounded-full bg-stone-200 p-1">
        <button
          type="button"
          onClick={() => setTab('cliente')}
          className={`rounded-full py-2 text-sm font-medium ${tab === 'cliente' ? 'bg-white text-brand-900 shadow' : 'text-stone-600'}`}
        >
          Vista cliente
        </button>
        <button
          type="button"
          onClick={() => setTab('interno')}
          className={`rounded-full py-2 text-sm font-medium ${tab === 'interno' ? 'bg-white text-brand-900 shadow' : 'text-stone-600'}`}
        >
          🔒 Interna
        </button>
      </div>

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
            <InternalRow label="Subtotal material" value={formatCOP(calc.materialSubtotal)} />
            <InternalRow label="Subtotal piedras" value={formatCOP(calc.stonesSubtotal)} />
            <InternalRow label="Mano de obra" value={formatCOP(calc.laborSubtotal)} />
            <InternalRow label="Costos adicionales" value={formatCOP(calc.extrasSubtotal)} />
            <InternalRow label="Costo base" value={formatCOP(calc.baseCost)} bold />
            <InternalRow label={`Margen (${quote.marginPercent}%)`} value={formatCOP(calc.marginAmount)} />
            <InternalRow label="Subtotal comercial" value={formatCOP(calc.subtotal)} />
            <InternalRow label="Descuento" value={`- ${formatCOP(calc.discountAmount)}`} />
            <InternalRow label="Impuesto" value={formatCOP(calc.taxAmount)} />
            <InternalRow label="Total" value={formatCOP(calc.total)} bold />
            <InternalRow label="Anticipo" value={formatCOP(calc.deposit)} />
            <InternalRow label="Saldo" value={formatCOP(calc.balance)} />
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
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onEdit} disabled={busy}>
            ✏ Editar
          </Button>
          <Button onClick={handleSave} disabled={busy}>
            💾 Guardar
          </Button>
          <Button variant="secondary" onClick={handleClientPdf} disabled={busy}>
            📄 PDF cliente
          </Button>
          <Button onClick={handleWhatsApp} disabled={busy}>
            📲 WhatsApp
          </Button>
        </div>
        {busy ? <p className="mt-2 text-center text-sm text-stone-500">Procesando…</p> : null}
      </div>
    </div>
  );
}

function InternalRow({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${bold ? 'font-semibold text-stone-900' : 'text-stone-700'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
