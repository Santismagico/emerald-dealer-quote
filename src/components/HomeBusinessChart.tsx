import { useEffect, useMemo, useState, type PointerEvent } from 'react';
import type { LedgerEvent, LedgerInput } from '../services/ledger';
import { buildLedger } from '../services/ledger';
import {
  buildHomeChartSeries,
  type HomeChartMetric,
  type HomeChartPeriod,
  type HomeChartPoint
} from '../services/homeChart';
import { formatCOP } from '../utils/money';
import { formatDateCO } from '../utils/dates';

const PERIODS: Array<{ value: HomeChartPeriod; label: string }> = [
  { value: 'dia', label: '1 día' },
  { value: 'semana', label: '7 días' },
  { value: 'mes', label: '30 días' },
  { value: 'anio', label: '1 año' }
];

const WIDTH = 640;
const HEIGHT = 236;
const PAD_X = 18;
const PAD_Y = 18;

interface DrawPoint extends HomeChartPoint {
  x: number;
  y: number;
}

function drawPoints(points: readonly HomeChartPoint[]): DrawPoint[] {
  const values = points.map((point) => point.valueCop);
  let min = Math.min(0, ...values);
  let max = Math.max(0, ...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  return points.map((point, index) => ({
    ...point,
    x: PAD_X + (index * (WIDTH - PAD_X * 2)) / Math.max(1, points.length - 1),
    y: PAD_Y + ((max - point.valueCop) / span) * (HEIGHT - PAD_Y * 2)
  }));
}

function pathFrom(points: readonly DrawPoint[]): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

export function HomeBusinessChart({
  anchorDate,
  ledgerInput
}: {
  anchorDate: string;
  ledgerInput: LedgerInput;
}) {
  const [ledger, setLedger] = useState<readonly LedgerEvent[] | null>(null);
  const [buildDurationMs, setBuildDurationMs] = useState<number | null>(null);
  const [period, setPeriod] = useState<HomeChartPeriod>('mes');
  const [metric, setMetric] = useState<HomeChartMetric>('cash');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Se ejecuta después del primer pintado. Cambiar período o medida reutiliza
  // este mismo libro y solo lo filtra (D-057 y riesgo de velocidad de R2-2).
  useEffect(() => {
    let cancelled = false;
    setLedger(null);
    setBuildDurationMs(null);
    const timer = window.setTimeout(() => {
      const startedAt = window.performance.now();
      const next = buildLedger(ledgerInput);
      const duration = window.performance.now() - startedAt;
      if (!cancelled) {
        setLedger(next);
        setBuildDurationMs(duration);
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [ledgerInput]);

  const series = useMemo(
    () => (ledger ? buildHomeChartSeries(ledger, period, metric, anchorDate) : null),
    [anchorDate, ledger, metric, period]
  );
  const points = useMemo(() => drawPoints(series?.points ?? []), [series]);
  const activePoint = activeIndex === null ? null : points[activeIndex] ?? null;
  const zeroY = useMemo(() => {
    if (points.length === 0) return HEIGHT - PAD_Y;
    const values = points.map((point) => point.valueCop);
    let min = Math.min(0, ...values);
    let max = Math.max(0, ...values);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    return PAD_Y + ((max - 0) / (max - min)) * (HEIGHT - PAD_Y * 2);
  }, [points]);

  const updateActivePoint = (event: PointerEvent<SVGSVGElement>) => {
    if (points.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const localX = ((event.clientX - rect.left) / Math.max(1, rect.width)) * WIDTH;
    const ratio = Math.min(1, Math.max(0, (localX - PAD_X) / (WIDTH - PAD_X * 2)));
    setActiveIndex(Math.round(ratio * (points.length - 1)));
  };

  const linePath = pathFrom(points);
  const areaPath = points.length > 0
    ? `M ${points[0].x} ${zeroY} ${linePath} L ${points[points.length - 1].x} ${zeroY} Z`
    : '';
  const tooltipWidth = 210;
  const tooltipX = activePoint
    ? Math.min(WIDTH - PAD_X - tooltipWidth, Math.max(PAD_X, activePoint.x - tooltipWidth / 2))
    : 0;
  const tooltipY = activePoint
    ? Math.min(HEIGHT - 58, Math.max(8, activePoint.y < 72 ? activePoint.y + 14 : activePoint.y - 54))
    : 0;

  return (
    <section
      className="home-business-chart luxury-card overflow-hidden rounded-3xl p-4 sm:p-6"
      data-ledger-build-ms={buildDurationMs === null ? undefined : buildDurationMs.toFixed(3)}
    >
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-stone-200 p-1" role="group" aria-label="Medida de la gráfica">
        {([
          ['profit', 'Ganancia'],
          ['cash', 'Caja']
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={metric === value}
            onClick={() => {
              setMetric(value);
              setActiveIndex(null);
            }}
            className={`min-h-11 rounded-xl px-3 text-sm font-semibold ${
              metric === value ? 'bg-white text-stone-900 shadow' : 'text-stone-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex min-h-20 flex-col justify-end">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
          {metric === 'profit' ? 'Ganancia del período' : 'Movimiento de caja'}
        </p>
        <p
          className={`mt-1 break-words font-display text-3xl font-semibold sm:text-4xl ${
            (series?.totalCop ?? 0) < 0 ? 'text-red-700' : 'text-brand-800'
          }`}
        >
          {series ? formatCOP(series.totalCop) : '—'}
        </p>
        <p className="mt-1 min-h-5 text-sm text-stone-500">
          {!series
            ? 'La pantalla ya está lista; preparando la gráfica…'
            : series.changeCop === 0
              ? 'Sin cambio en este período.'
              : `${series.changeCop > 0 ? 'Subió' : 'Bajó'} ${formatCOP(Math.abs(series.changeCop))} en este período.`}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-1" role="group" aria-label="Período de la gráfica">
        {PERIODS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={period === option.value}
            onClick={() => {
              setPeriod(option.value);
              setActiveIndex(null);
            }}
            className={`min-h-11 rounded-xl px-1 text-xs font-semibold sm:text-sm ${
              period === option.value
                ? 'bg-brand-600 text-white'
                : 'border border-stone-200 bg-white text-stone-600'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-4 min-h-[236px]">
        {series?.hasEnoughData ? (
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="block h-auto w-full touch-pan-y"
            role="img"
            aria-label={`${metric === 'profit' ? 'Ganancia' : 'Caja'} entre ${formatDateCO(series.range.start)} y ${formatDateCO(series.range.end)}`}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              updateActivePoint(event);
            }}
            onPointerMove={(event) => {
              if (event.pointerType === 'mouse' || event.currentTarget.hasPointerCapture(event.pointerId)) {
                updateActivePoint(event);
              }
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === 'mouse' && !event.currentTarget.hasPointerCapture(event.pointerId)) {
                setActiveIndex(null);
              }
            }}
            onPointerUp={(event) => {
              updateActivePoint(event);
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
          >
            <defs>
              <linearGradient id="home-chart-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--home-chart-series)" stopOpacity="0.28" />
                <stop offset="1" stopColor="var(--home-chart-series)" stopOpacity="0.03" />
              </linearGradient>
            </defs>
            <line x1={PAD_X} y1={zeroY} x2={WIDTH - PAD_X} y2={zeroY} stroke="var(--line)" strokeWidth="1" />
            <path d={areaPath} fill="url(#home-chart-fill)" />
            <path d={linePath} fill="none" stroke="var(--home-chart-series)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            {activePoint ? (
              <>
                <line x1={activePoint.x} y1={PAD_Y} x2={activePoint.x} y2={HEIGHT - PAD_Y} stroke="var(--home-chart-series)" strokeWidth="1.5" strokeDasharray="5 5" />
                <circle cx={activePoint.x} cy={activePoint.y} r="6" fill="var(--surface)" stroke="var(--home-chart-series)" strokeWidth="4" />
                <g transform={`translate(${tooltipX} ${tooltipY})`}>
                  <rect width={tooltipWidth} height="46" rx="10" fill="var(--surface)" stroke="var(--line-strong)" />
                  <text x="12" y="18" fill="var(--ink-2)" fontSize="12">{formatDateCO(activePoint.date)}</text>
                  <text x="12" y="36" fill="var(--ink)" fontSize="14" fontWeight="700">{formatCOP(activePoint.valueCop)}</text>
                </g>
              </>
            ) : null}
          </svg>
        ) : (
          <div className="flex min-h-[236px] items-center justify-center rounded-2xl bg-stone-50 px-5 text-center">
            <p className="max-w-sm text-sm leading-relaxed text-stone-500">
              {series
                ? 'Aún no hay suficientes movimientos en días distintos para dibujar la gráfica.'
                : 'Preparando la gráfica…'}
            </p>
          </div>
        )}
      </div>

      {series ? (
        <p className="mt-3 text-xs leading-relaxed text-stone-500">
          {metric === 'cash' && period === 'mes'
            ? 'Es exactamente la misma cifra del Cierre mensual. El período de 30 días representa el mes calendario del cierre.'
            : metric === 'profit'
              ? 'La ganancia se reconoce el día de la venta, aunque el pago llegue después.'
              : 'Caja muestra únicamente dinero que entró o salió de verdad.'}
        </p>
      ) : null}
      {activePoint ? (
        <p className="sr-only" aria-live="polite">
          {formatDateCO(activePoint.date)}: {formatCOP(activePoint.valueCop)}
        </p>
      ) : null}
    </section>
  );
}
