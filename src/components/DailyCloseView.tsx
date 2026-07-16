// Cierre del día: vista previa de todos los movimientos del negocio en un día
// y descarga del PDF interno. SOLO interno: este documento nunca se comparte
// por Web Share ni WhatsApp; únicamente descarga directa (D-020/D-024).

import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { buildDailyReport, buildDailyReportPdfContent } from '../services/dailyReport';
import { downloadDailyReportPdf } from '../services/pdf';
import { formatCOP } from '../utils/money';
import { formatDateCO, isValidISODate, todayISO } from '../utils/dates';
import { Button, EmptyState, Field, SectionCard, SummaryRow, TextInput } from './ui';

export function DailyCloseView() {
  const store = useStore();
  const [day, setDay] = useState(todayISO());
  const [busy, setBusy] = useState(false);

  const validDay = isValidISODate(day);
  const report = useMemo(
    () => buildDailyReport(validDay ? day : todayISO(), store.quotes, store.stoneLots),
    [day, validDay, store.quotes, store.stoneLots]
  );

  const download = async () => {
    setBusy(true);
    try {
      await downloadDailyReportPdf(buildDailyReportPdfContent(report, store.settings), report.date);
      store.showToast('PDF del cierre generado');
    } catch {
      store.showToast('No se pudo generar el PDF. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <SectionCard
        title="Cierre del día"
        subtitle="Documento interno con todo lo que pasó en el negocio ese día. No se comparte con clientes."
      >
        <Field label="Día del cierre">
          <TextInput type="date" value={day} onChange={setDay} />
        </Field>
      </SectionCard>

      {report.isEmpty ? (
        <EmptyState
          title="Sin movimientos"
          message={`El ${formatDateCO(report.date)} no registró compras, ventas, abonos, pagos ni cotizaciones.`}
        />
      ) : (
        <>
          <SectionCard title="Dinero del día">
            <SummaryRow label="Entró por ventas de piedras" value={formatCOP(report.totals.stonesSold)} />
            <SummaryRow label="Entró por abonos" value={formatCOP(report.totals.paymentsReceived)} />
            <SummaryRow
              label="Salió por compras de piedras"
              value={`- ${formatCOP(report.totals.stonesPurchased)}`}
            />
            <SummaryRow label="Salió por pagos del taller" value={`- ${formatCOP(report.totals.workshopPaid)}`} />
            <div className="border-t border-stone-100 pt-1">
              <SummaryRow
                label="Movimiento neto del día"
                value={formatCOP(report.totals.net)}
                bold
                valueClass={report.totals.net < 0 ? 'text-red-600' : 'text-brand-800'}
              />
            </div>
          </SectionCard>

          {report.stonePurchases.length > 0 && (
            <SectionCard title={`Piedras compradas (${report.stonePurchases.length})`}>
              {report.stonePurchases.map((p, i) => (
                <ReportLine
                  key={i}
                  main={`${p.lotName} · ${p.quantity} pz`}
                  detail={p.supplier ? `a ${p.supplier}` : ''}
                  value={`- ${formatCOP(p.valueCop)}`}
                />
              ))}
            </SectionCard>
          )}

          {report.stoneSales.length > 0 && (
            <SectionCard title={`Piedras vendidas (${report.stoneSales.length})`}>
              {report.stoneSales.map((s, i) => (
                <ReportLine
                  key={i}
                  main={`${s.lotName} · ${s.quantity} pz`}
                  detail={s.buyer ? `a ${s.buyer}` : ''}
                  value={formatCOP(s.valueCop)}
                />
              ))}
            </SectionCard>
          )}

          {report.payments.length > 0 && (
            <SectionCard title={`Abonos recibidos (${report.payments.length})`}>
              {report.payments.map((p, i) => (
                <ReportLine
                  key={i}
                  main={p.clientName}
                  detail={p.quoteNumber || 'sin número'}
                  value={formatCOP(p.amount)}
                />
              ))}
            </SectionCard>
          )}

          {report.workshopPayments.length > 0 && (
            <SectionCard title={`Pagos del taller (${report.workshopPayments.length})`}>
              {report.workshopPayments.map((w, i) => (
                <ReportLine
                  key={i}
                  main={w.stageName}
                  detail={`${w.quoteNumber || 'sin número'}${w.paidTo ? ` · a ${w.paidTo}` : ''}`}
                  value={`- ${formatCOP(w.cost)}`}
                />
              ))}
            </SectionCard>
          )}

          {report.quotesCreated.length > 0 && (
            <SectionCard title={`Cotizaciones creadas (${report.quotesCreated.length})`}>
              {report.quotesCreated.map((q, i) => (
                <ReportLine
                  key={i}
                  main={q.clientName}
                  detail={`${q.number || 'Sin número'} · ${q.pieceType}`}
                  value={formatCOP(q.total)}
                />
              ))}
            </SectionCard>
          )}

          {report.quotesApproved.length > 0 && (
            <SectionCard title={`Cotizaciones aprobadas (${report.quotesApproved.length})`}>
              {report.quotesApproved.map((q, i) => (
                <ReportLine
                  key={i}
                  main={q.clientName}
                  detail={q.number || 'Sin número'}
                  value={formatCOP(q.total)}
                />
              ))}
            </SectionCard>
          )}
        </>
      )}

      <Button full disabled={busy || !validDay} onClick={() => void download()}>
        {busy ? 'Generando…' : '📄 Descargar PDF del cierre'}
      </Button>
      <p className="text-center text-[11px] text-stone-400">
        Documento interno: solo se descarga en este dispositivo. Nunca se envía ni se comparte.
      </p>
    </div>
  );
}

function ReportLine({ main, detail, value }: { main: string; detail: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <div className="min-w-0">
        <p className="truncate text-stone-800">{main}</p>
        {detail ? <p className="truncate text-xs text-stone-500">{detail}</p> : null}
      </div>
      <span className="shrink-0 font-medium text-stone-900">{value}</span>
    </div>
  );
}
