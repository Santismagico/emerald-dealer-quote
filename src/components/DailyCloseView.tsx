// Cierres del negocio (correcciones C5/C6): cierre del DÍA y cierre del MES,
// con la joyería (cotizador + taller) separada del negocio de piedras, deudas
// y comparación entre meses. SOLO interno: los PDF únicamente se descargan;
// jamás pasan por Web Share ni WhatsApp (D-020/D-024).

import { useMemo, useState } from 'react';
import { useStore } from '../store';
import {
  buildDailyReport,
  buildDailyReportPdfContent,
  buildMonthlyReport,
  buildMonthlyReportPdfContent,
  formatMonthCO,
  listMonthlySummaries,
  type BusinessReport
} from '../services/dailyReport';
import { downloadDailyReportPdf } from '../services/pdf';
import { formatCOP } from '../utils/money';
import { formatDateCO, isValidISODate, todayISO } from '../utils/dates';
import { Button, EmptyState, Field, SectionCard, Select, SummaryRow, TextInput } from './ui';

export function DailyCloseView() {
  const store = useStore();
  const [mode, setMode] = useState<'dia' | 'mes'>('dia');
  const today = todayISO();
  const currentMonth = today.slice(0, 7);
  const [day, setDay] = useState(today);
  const [month, setMonth] = useState(currentMonth);
  const [busy, setBusy] = useState(false);

  const validDay = isValidISODate(day);
  const dailyReport = useMemo(
    () => buildDailyReport(validDay ? day : today, store.quotes, store.stoneLots),
    [day, validDay, today, store.quotes, store.stoneLots]
  );

  const summaries = useMemo(
    () => listMonthlySummaries(store.quotes, store.stoneLots),
    [store.quotes, store.stoneLots]
  );
  const monthOptions = useMemo(() => {
    const months = new Set<string>([currentMonth, ...summaries.map((s) => s.month)]);
    return [...months].sort((a, b) => b.localeCompare(a));
  }, [currentMonth, summaries]);
  const monthlyReport = useMemo(
    () => buildMonthlyReport(month, store.quotes, store.stoneLots),
    [month, store.quotes, store.stoneLots]
  );

  const download = async () => {
    setBusy(true);
    try {
      if (mode === 'dia') {
        await downloadDailyReportPdf(
          buildDailyReportPdfContent(dailyReport, store.settings),
          dailyReport.date
        );
      } else {
        await downloadDailyReportPdf(
          buildMonthlyReportPdfContent(monthlyReport, summaries, store.settings),
          monthlyReport.month
        );
      }
      store.showToast('PDF del cierre generado');
    } catch {
      store.showToast('No se pudo generar el PDF. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const report: BusinessReport = mode === 'dia' ? dailyReport : monthlyReport;
  const periodLabel = mode === 'dia' ? `El ${formatDateCO(dailyReport.date)}` : formatMonthCO(month);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-full bg-stone-200 p-1">
        <button
          type="button"
          onClick={() => setMode('dia')}
          className={`min-h-11 rounded-full py-2 text-sm font-medium ${
            mode === 'dia' ? 'bg-white text-brand-900 shadow' : 'text-stone-600'
          }`}
        >
          Cierre del día
        </button>
        <button
          type="button"
          onClick={() => setMode('mes')}
          className={`min-h-11 rounded-full py-2 text-sm font-medium ${
            mode === 'mes' ? 'bg-white text-brand-900 shadow' : 'text-stone-600'
          }`}
        >
          Cierre del mes
        </button>
      </div>

      <SectionCard subtitle="Documento interno con todo lo que pasó en el negocio. No se comparte con clientes.">
        {mode === 'dia' ? (
          <Field label="Día del cierre">
            <TextInput type="date" value={day} onChange={setDay} />
          </Field>
        ) : (
          <Field label="Mes del cierre">
            <Select
              value={month}
              onChange={setMonth}
              options={monthOptions.map((m) => ({ value: m, label: formatMonthCO(m) }))}
            />
          </Field>
        )}
      </SectionCard>

      {report.isEmpty ? (
        <EmptyState
          title="Sin movimientos"
          message={`${periodLabel} no registró compras, ventas, abonos, pagos ni cotizaciones.`}
        />
      ) : (
        <>
          <SectionCard title={mode === 'dia' ? 'Dinero del día' : 'Dinero del mes'}>
            <SummaryRow label="Entró en total" value={formatCOP(report.totals.cashIn)} />
            <SummaryRow label="Salió en total" value={`- ${formatCOP(report.totals.cashOut)}`} />
            <div className="border-t border-stone-100 pt-1">
              <SummaryRow
                label="Movimiento neto"
                value={formatCOP(report.totals.net)}
                bold
                valueClass={report.totals.net < 0 ? 'text-red-600' : 'text-brand-800'}
              />
            </div>
            {report.totals.stonesPurchasedCredit > 0 && (
              <p className="text-[11px] text-stone-400">
                Además compraste {formatCOP(report.totals.stonesPurchasedCredit)} a crédito (no salió de
                caja).
              </p>
            )}
          </SectionCard>

          {(report.totals.supplierDebt > 0 || report.totals.clientsOwe > 0) && (
            <SectionCard title="Deudas a la fecha">
              {report.totals.supplierDebt > 0 && (
                <SummaryRow
                  label="Debes a proveedores"
                  value={formatCOP(report.totals.supplierDebt)}
                  valueClass="text-red-600"
                />
              )}
              {report.totals.clientsOwe > 0 && (
                <SummaryRow
                  label="Clientes te deben"
                  value={formatCOP(report.totals.clientsOwe)}
                  valueClass="text-brand-800"
                />
              )}
            </SectionCard>
          )}

          <SectionCard title="💍 Joyería (cotizador y taller)">
            <SummaryRow label="Entró por abonos" value={formatCOP(report.totals.paymentsReceived)} />
            <SummaryRow label="Salió al taller" value={`- ${formatCOP(report.totals.workshopPaid)}`} />
            <SummaryRow
              label="Cotizaciones"
              value={`${report.quotesCreated.length} creadas · ${report.quotesApproved.length} aprobadas`}
            />
          </SectionCard>

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

          <SectionCard title="💎 Piedras">
            <SummaryRow label="Entró por ventas" value={formatCOP(report.totals.stonesSold)} />
            <SummaryRow
              label="Salió en compras de contado"
              value={`- ${formatCOP(report.totals.stonesPurchasedCash)}`}
            />
            <SummaryRow
              label="Salió a proveedores (créditos)"
              value={`- ${formatCOP(report.totals.supplierPaymentsPaid)}`}
            />
          </SectionCard>

          {report.stonePurchases.length > 0 && (
            <SectionCard title={`Piedras compradas (${report.stonePurchases.length})`}>
              {report.stonePurchases.map((p, i) => (
                <ReportLine
                  key={i}
                  main={`${p.lotName} · ${p.quantity} pz${p.onCredit ? ' · A CRÉDITO' : ''}`}
                  detail={p.supplier ? `a ${p.supplier}` : ''}
                  value={`${p.onCredit ? '' : '- '}${formatCOP(p.valueCop)}`}
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

          {report.supplierPayments.length > 0 && (
            <SectionCard title={`Pagos a proveedores (${report.supplierPayments.length})`}>
              {report.supplierPayments.map((p, i) => (
                <ReportLine
                  key={i}
                  main={p.lotName}
                  detail={p.supplier ? `a ${p.supplier}` : ''}
                  value={`- ${formatCOP(p.amount)}`}
                />
              ))}
            </SectionCard>
          )}
        </>
      )}

      {mode === 'mes' && summaries.filter((s) => s.month !== month).length > 0 && (
        <SectionCard title="Meses anteriores" subtitle="Para comparar cómo vas.">
          {summaries
            .filter((s) => s.month !== month)
            .slice(0, 6)
            .map((s) => (
              <ReportLine
                key={s.month}
                main={formatMonthCO(s.month)}
                detail={`Entró ${formatCOP(s.cashIn)} · salió ${formatCOP(s.cashOut)}`}
                value={formatCOP(s.net)}
              />
            ))}
        </SectionCard>
      )}

      <Button full disabled={busy || (mode === 'dia' && !validDay)} onClick={() => void download()}>
        {busy ? 'Generando…' : mode === 'dia' ? '📄 Descargar PDF del día' : '📄 Descargar PDF del mes'}
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
