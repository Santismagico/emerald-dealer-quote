import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { formatMonthCO } from '../services/dailyReport';
import { buildSalesExcelWorkbook, downloadExcelWorkbook } from '../services/excelExport';
import {
  ALL_SALES_FILTER,
  buildSalesAnalytics,
  type SalesAnalytics,
  type SalesAnalyticsPartnership,
  type SalesPeriodKind
} from '../services/salesAnalytics';
import { formatDateCO, todayISO } from '../utils/dates';
import { formatCOP } from '../utils/money';
import { Button, EmptyState, Field, SectionCard, Select, SummaryRow, TextInput } from './ui';

const PERIODS: Array<{ value: SalesPeriodKind; label: string }> = [
  { value: 'dia', label: 'Día' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
  { value: 'anio', label: 'Año' }
];

function periodLabel(analytics: SalesAnalytics, period: SalesPeriodKind): string {
  if (period === 'dia') return formatDateCO(analytics.range.start);
  if (period === 'semana') {
    return `${formatDateCO(analytics.range.start)} al ${formatDateCO(analytics.range.end)}`;
  }
  if (period === 'mes') return formatMonthCO(analytics.range.start.slice(0, 7));
  return analytics.range.start.slice(0, 4);
}

function percentLabel(value: number | null): string {
  return value === null
    ? 'No aplica'
    : `${value.toLocaleString('es-CO', { maximumFractionDigits: 1 })}%`;
}

function ComparisonCard({
  title,
  partnership,
  emphasizePercent = false
}: {
  title: string;
  partnership: SalesAnalyticsPartnership | null;
  emphasizePercent?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-stone-200 bg-stone-50 p-3">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-700">{title}</p>
      {partnership ? (
        <>
          <p className="mt-2 break-words text-sm font-semibold text-stone-900">
            {partnership.partnerName}
          </p>
          <p className="mt-2 break-words text-sm font-bold text-brand-800">
            {emphasizePercent
              ? `${percentLabel(partnership.returnPercent)} · ${formatCOP(partnership.profitCop)}`
              : `${formatCOP(partnership.profitCop)} · ${percentLabel(partnership.returnPercent)}`}
          </p>
          <p className="mt-1 text-xs text-stone-500">Su ganancia · rentabilidad</p>
        </>
      ) : (
        <p className="mt-2 text-sm text-stone-500">Sin sociedades para comparar</p>
      )}
    </div>
  );
}

export function SalesConsolidatedView() {
  const store = useStore();
  const [period, setPeriod] = useState<SalesPeriodKind>('mes');
  const [anchorDate, setAnchorDate] = useState(todayISO());
  const [societyFilter, setSocietyFilter] = useState(ALL_SALES_FILTER);
  const [productTypeFilter, setProductTypeFilter] = useState(ALL_SALES_FILTER);
  const [excelBusy, setExcelBusy] = useState(false);
  const analytics = useMemo(
    () =>
      buildSalesAnalytics({
        period,
        anchorDate,
        societyFilter,
        productTypeFilter,
        quotes: store.quotes,
        stoneLots: store.stoneLots,
        stockJewels: store.stockJewels,
        materialLots: store.materialLots,
        expenses: store.expenses
      }),
    [
      anchorDate,
      period,
      productTypeFilter,
      societyFilter,
      store.expenses,
      store.materialLots,
      store.quotes,
      store.stockJewels,
      store.stoneLots
    ]
  );
  const label = periodLabel(analytics, period);

  useEffect(() => {
    if (!analytics.filters.societies.some((option) => option.value === societyFilter)) {
      setSocietyFilter(ALL_SALES_FILTER);
    }
    if (!analytics.filters.productTypes.some((option) => option.value === productTypeFilter)) {
      setProductTypeFilter(ALL_SALES_FILTER);
    }
  }, [analytics.filters.productTypes, analytics.filters.societies, productTypeFilter, societyFilter]);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">Documento interno</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">
          Consolidado de ventas
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Compara sociedades y encuentra ventas por producto, incluso datos sin registrar.
        </p>
      </div>

      <SectionCard subtitle={`Período: ${label}`}>
        <div className="grid grid-cols-4 gap-1 rounded-2xl bg-stone-200 p-1">
          {PERIODS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPeriod(option.value)}
              className={`min-h-11 rounded-xl px-1 text-xs font-semibold sm:text-sm ${
                period === option.value ? 'bg-white text-stone-900 shadow' : 'text-stone-600'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <Field label="Fecha de referencia">
          <TextInput type="date" value={anchorDate} onChange={setAnchorDate} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Sociedad">
            <Select
              value={societyFilter}
              onChange={setSocietyFilter}
              options={analytics.filters.societies}
            />
          </Field>
          <Field label="Tipo de producto">
            <Select
              value={productTypeFilter}
              onChange={setProductTypeFilter}
              options={analytics.filters.productTypes}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Resultado filtrado"
        subtitle="Ganancia de ventas. La caja se consulta aparte y no se suma aquí."
      >
        <p className="break-words text-xs text-stone-500">
          Sociedad: {analytics.filters.societyLabel} · Producto: {analytics.filters.productTypeLabel}
        </p>
        <SummaryRow label="Vendido" value={formatCOP(analytics.salesCop)} />
        <SummaryRow label="Costo de lo vendido" value={`- ${formatCOP(analytics.attributedCostCop)}`} />
        <div className="border-t border-stone-100 pt-2">
          <SummaryRow
            label="Ganancia"
            value={formatCOP(analytics.profitCop)}
            bold
            valueClass={analytics.profitCop < 0 ? 'text-red-700' : 'text-brand-800'}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Comparación entre socios"
        subtitle="El monto y el porcentaje aparecen juntos para no decidir con una sola cifra."
      >
        <div className="grid grid-cols-2 gap-2">
          <ComparisonCard title="Más dinero" partnership={analytics.comparison.mostMoney} />
          <ComparisonCard
            title="Más rentable"
            partnership={analytics.comparison.mostProfitable}
            emphasizePercent
          />
        </div>
      </SectionCard>

      {analytics.partnerships.length === 0 ? (
        <EmptyState
          title="Sin sociedades en este resultado"
          message="Cambia el período o los filtros para comparar otras ventas."
        />
      ) : (
        <SectionCard
          title={`Cada quien en los lotes compartidos (${analytics.partnerships.length})`}
          subtitle="Una fila por persona, tú incluido. Cada cifra es solo suya, así que no se suman entre sí."
        >
          {analytics.partnerships.map((partnership) => (
            <div
              key={partnership.key}
              className={`min-w-0 rounded-xl border p-3 ${
                partnership.isOwner ? 'border-brand-200 bg-brand-50' : 'border-stone-200'
              }`}
            >
              <p className="break-words text-sm font-semibold text-stone-900">
                {partnership.partnerName}
              </p>
              <div className="mt-3 space-y-2">
                <SummaryRow label="Puso" value={formatCOP(partnership.investedCop)} />
                <SummaryRow
                  label="Ganó"
                  value={`${formatCOP(partnership.profitCop)} · ${percentLabel(partnership.returnPercent)}`}
                  bold
                />
              </div>
            </div>
          ))}
        </SectionCard>
      )}

      {analytics.sales.length === 0 ? (
        <EmptyState title="Sin ventas" message={`No hay ventas que coincidan con los filtros en ${label}.`} />
      ) : (
        <SectionCard title={`Ventas encontradas (${analytics.sales.length})`}>
          {analytics.sales.map((sale) => (
            <div key={sale.id} className="min-w-0 border-b border-stone-100 pb-3 last:border-b-0 last:pb-0">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-stone-900">
                    {sale.productType || 'Sin registrar'}
                  </p>
                  <p className="mt-1 break-words text-xs text-stone-500">
                    {formatDateCO(sale.date)} · {sale.partnerName || 'Sin registrar'}
                  </p>
                </div>
                <p className="shrink-0 text-right text-sm font-bold text-brand-800">
                  {formatCOP(sale.profitCop)}
                </p>
              </div>
            </div>
          ))}
        </SectionCard>
      )}

      <Button
        variant="secondary"
        full
        disabled={excelBusy}
        onClick={() => {
          setExcelBusy(true);
          void downloadExcelWorkbook(
            buildSalesExcelWorkbook(analytics, {
              jewelryName: store.settings.jewelryName,
              periodLabel: label,
              consolidated: true
            }),
            `consolidado-ventas-${analytics.range.start}-${analytics.range.end}.xlsx`
          ).then(() => {
            store.showToast('Excel del consolidado generado');
          }).catch(() => {
            store.showToast('No se pudo generar el Excel. Intenta de nuevo.');
          }).finally(() => {
            setExcelBusy(false);
          });
        }}
      >
        {excelBusy ? 'Generando Excel…' : 'Descargar Excel del consolidado'}
      </Button>

      <p className="text-center text-[11px] text-stone-400">
        Información interna. No se envía ni aparece en documentos del cliente.
      </p>
    </div>
  );
}
