import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { formatMonthCO } from '../services/dailyReport';
import {
  buildSalesAnalytics,
  type SalesAnalytics,
  type SalesPeriodKind
} from '../services/salesAnalytics';
import type { CurrencyView } from '../services/currency';
import { formatCOP } from '../utils/money';
import { formatDateCO, todayISO } from '../utils/dates';
import { buildSalesExcelCsv, downloadExcelCsv } from '../services/excelExport';
import { Button, EmptyState, Field, SectionCard, SummaryRow, TextInput } from './ui';

const usdFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const PERIODS: Array<{ value: SalesPeriodKind; label: string }> = [
  { value: 'dia', label: 'Día' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
  { value: 'anio', label: 'Año' }
];

function usdValue(value: number, knownCount: number, missingCount: number): string {
  if (knownCount === 0 && missingCount > 0) return 'Sin registrar';
  return usdFormatter.format(value);
}

function periodLabel(analytics: SalesAnalytics, period: SalesPeriodKind): string {
  if (period === 'dia') return formatDateCO(analytics.range.start);
  if (period === 'semana') {
    return `${formatDateCO(analytics.range.start)} al ${formatDateCO(analytics.range.end)}`;
  }
  if (period === 'mes') return formatMonthCO(analytics.range.start.slice(0, 7));
  return analytics.range.start.slice(0, 4);
}

function percentLabel(value: number | null): string {
  return value === null ? 'No aplica' : `${value.toLocaleString('es-CO', { maximumFractionDigits: 1 })}%`;
}

function profitValue(
  cop: number,
  usd: number,
  knownCount: number,
  missingCount: number,
  currency: CurrencyView
): string {
  return currency === 'COP' ? formatCOP(cop) : usdValue(usd, knownCount, missingCount);
}

function saleKindLabel(kind: SalesAnalytics['sales'][number]['kind']): string {
  if (kind === 'cotizacion_aprobada') return 'Cotización aprobada';
  if (kind === 'venta_joya_stock') return 'Joya vendida';
  if (kind === 'venta_piedras_credito') return 'Piedras · a crédito';
  return 'Piedras · contado';
}

export function SalesDashboardView() {
  const store = useStore();
  const [period, setPeriod] = useState<SalesPeriodKind>('mes');
  const [anchorDate, setAnchorDate] = useState(todayISO());
  const [currency, setCurrency] = useState<CurrencyView>('COP');
  const analytics = useMemo(
    () =>
      buildSalesAnalytics({
        period,
        anchorDate,
        quotes: store.quotes,
        stoneLots: store.stoneLots,
        stockJewels: store.stockJewels,
        materialLots: store.materialLots,
        expenses: store.expenses
      }),
    [
      anchorDate,
      period,
      store.expenses,
      store.materialLots,
      store.quotes,
      store.stockJewels,
      store.stoneLots
    ]
  );
  const label = periodLabel(analytics, period);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">Documento interno</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Ventas y ganancias</h1>
        <p className="mt-1 text-sm text-stone-500">
          Ganancia y caja son medidas distintas. Aquí siempre se muestran por separado.
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
        <div className="grid grid-cols-2 gap-1 rounded-full bg-stone-200 p-1">
          {(['COP', 'USD'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setCurrency(option)}
              className={`min-h-11 rounded-full text-sm font-semibold ${
                currency === option ? 'bg-white text-stone-900 shadow' : 'text-stone-600'
              }`}
            >
              Ver en {option}
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Ganancia del período"
        subtitle="Se reconoce el día de la venta, aunque el cliente pague después."
      >
        <SummaryRow
          label="Vendido"
          value={
            currency === 'COP'
              ? formatCOP(analytics.salesCop)
              : usdValue(
                  analytics.salesUsd.amount,
                  analytics.salesUsd.knownCount,
                  analytics.salesUsd.missingCount
                )
          }
        />
        <SummaryRow
          label="Costo de lo vendido"
          value={
            currency === 'COP'
              ? `- ${formatCOP(analytics.attributedCostCop)}`
              : `- ${usdValue(
                  analytics.salesUsd.cost,
                  analytics.salesUsd.knownCount,
                  analytics.salesUsd.missingCount
                )}`
          }
        />
        <div className="border-t border-stone-100 pt-2">
          <SummaryRow
            label="Ganancia"
            value={
              currency === 'COP'
                ? formatCOP(analytics.profitCop)
                : usdValue(
                    analytics.salesUsd.profit,
                    analytics.salesUsd.knownCount,
                    analytics.salesUsd.missingCount
                  )
            }
            bold
            valueClass={analytics.profitCop < 0 ? 'text-red-700' : 'text-brand-800'}
          />
        </div>
        {currency === 'USD' && analytics.salesUsd.missingCount > 0 ? (
          <p className="text-xs text-amber-800">
            {analytics.salesUsd.missingCount} venta(s) dicen “Sin registrar” y no se incluyen en el total USD.
          </p>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Caja del período"
        subtitle="Solo dinero que realmente entró o salió. No se suma con la ganancia."
      >
        <SummaryRow
          label="Entró"
          value={
            currency === 'COP'
              ? formatCOP(analytics.cashCop.cashIn)
              : usdValue(
                  analytics.cashUsd.cashIn,
                  analytics.cashUsd.knownCount,
                  analytics.cashUsd.missingCount
                )
          }
        />
        <SummaryRow
          label="Salió"
          value={
            currency === 'COP'
              ? `- ${formatCOP(analytics.cashCop.cashOut)}`
              : `- ${usdValue(
                  analytics.cashUsd.cashOut,
                  analytics.cashUsd.knownCount,
                  analytics.cashUsd.missingCount
                )}`
          }
        />
        <SummaryRow
          label="Movimiento neto"
          value={
            currency === 'COP'
              ? formatCOP(analytics.cashCop.net)
              : usdValue(
                  analytics.cashUsd.net,
                  analytics.cashUsd.knownCount,
                  analytics.cashUsd.missingCount
                )
          }
          bold
          valueClass={analytics.cashCop.net < 0 ? 'text-red-700' : 'text-brand-800'}
        />
        {currency === 'USD' && analytics.cashUsd.missingCount > 0 ? (
          <p className="text-xs text-amber-800">
            {analytics.cashUsd.missingCount} movimiento(s) de caja no tienen tasa propia y no se incluyen en USD.
          </p>
        ) : null}
      </SectionCard>

      <SectionCard title="Cobros pendientes" subtitle="Foto actual. No son ganancia que falte.">
        <SummaryRow
          label="Clientes de joyería"
          value={currency === 'COP' ? formatCOP(analytics.pendingClientsCop) : 'Sin registrar'}
        />
        <SummaryRow
          label="Compradores de piedras"
          value={currency === 'COP' ? formatCOP(analytics.pendingStoneBuyersCop) : 'Sin registrar'}
        />
      </SectionCard>

      {analytics.byLot.length === 0 ? (
        <EmptyState title="Sin ventas de lotes" message={`No hay ventas de piedras en ${label}.`} />
      ) : (
        <SectionCard title="Ganancia por lote de piedras">
          {analytics.byLot.map((lot) => (
            <div key={lot.lotId} className="min-w-0 rounded-xl bg-stone-50 p-3">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-stone-900">{lot.name}</p>
                  <p className="mt-1 text-xs text-stone-500">
                    {lot.saleCount} venta(s) · vendido {formatCOP(lot.salesCop)} · costo {formatCOP(lot.costCop)}
                  </p>
                </div>
                <p className={`shrink-0 text-right text-sm font-bold ${lot.profitCop < 0 ? 'text-red-700' : 'text-brand-800'}`}>
                  {profitValue(
                    lot.profitCop,
                    lot.profitUsd,
                    lot.usdKnownCount,
                    lot.usdMissingCount,
                    currency
                  )}
                </p>
              </div>
              {currency === 'USD' && lot.usdMissingCount > 0 ? (
                <p className="mt-2 text-xs text-amber-800">Hay venta(s) sin tasa propia.</p>
              ) : null}
            </div>
          ))}
        </SectionCard>
      )}

      {analytics.partnerships.length > 0 ? (
        <SectionCard title="Sociedades" subtitle="Monto y rentabilidad siempre aparecen juntos.">
          {analytics.partnerships.map((partnership) => (
            <div key={partnership.key} className="min-w-0 rounded-xl border border-stone-200 p-3">
              <p className="break-words text-sm font-semibold text-stone-900">Con {partnership.partnerName}</p>
              <div className="mt-3 space-y-2">
                <SummaryRow
                  label="Tu parte"
                  value={`${profitValue(
                    partnership.myProfitCop,
                    partnership.myProfitUsd,
                    partnership.usdKnownCount,
                    partnership.usdMissingCount,
                    currency
                  )} · ${percentLabel(partnership.myReturnPercent)}`}
                />
                <SummaryRow
                  label={`Parte de ${partnership.partnerName}`}
                  value={`${profitValue(
                    partnership.partnerProfitCop,
                    partnership.partnerProfitUsd,
                    partnership.usdKnownCount,
                    partnership.usdMissingCount,
                    currency
                  )} · ${percentLabel(partnership.partnerReturnPercent)}`}
                />
              </div>
              {currency === 'USD' && partnership.usdMissingCount > 0 ? (
                <p className="mt-2 text-xs text-amber-800">Hay venta(s) sin tasa propia.</p>
              ) : null}
            </div>
          ))}
        </SectionCard>
      ) : null}

      {analytics.sales.length > 0 ? (
        <SectionCard title={`Ventas del período (${analytics.sales.length})`}>
          {analytics.sales.map((sale) => (
            <div key={sale.id} className="min-w-0 border-b border-stone-100 pb-3 last:border-b-0 last:pb-0">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-stone-900">{saleKindLabel(sale.kind)}</p>
                  <p className="mt-1 break-words text-xs text-stone-500">
                    {formatDateCO(sale.date)} · {sale.productType || 'Sin registrar'}
                    {sale.counterparty ? ` · ${sale.counterparty}` : ''}
                  </p>
                </div>
                <p className="shrink-0 text-right text-sm font-bold text-brand-800">
                  {currency === 'COP'
                    ? formatCOP(sale.profitCop)
                    : sale.profitUsd === null
                      ? 'Sin registrar'
                      : usdFormatter.format(sale.profitUsd)}
                </p>
              </div>
            </div>
          ))}
        </SectionCard>
      ) : null}

      <Button
        variant="secondary"
        full
        onClick={() => {
          downloadExcelCsv(
            buildSalesExcelCsv(analytics, label),
            `ventas-ganancias-${analytics.range.start}-${analytics.range.end}.csv`
          );
          store.showToast('Excel de ventas y ganancias generado');
        }}
      >
        Descargar Excel del panel
      </Button>

      <p className="text-center text-[11px] text-stone-400">
        Información interna. No se envía ni aparece en documentos del cliente.
      </p>
    </div>
  );
}
