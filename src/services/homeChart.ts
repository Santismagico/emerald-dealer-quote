import { isValidISODate } from '../utils/dates';
import {
  ledgerSaleProfitCop,
  type LedgerEvent
} from './ledger';
import {
  salesPeriodRange,
  type SalesPeriodKind,
  type SalesPeriodRange
} from './salesAnalytics';

export type HomeChartMetric = 'profit' | 'cash';
export type HomeChartPeriod = SalesPeriodKind;

export interface HomeChartPoint {
  date: string;
  valueCop: number;
  changeCop: number;
}

export interface HomeChartSeries {
  range: SalesPeriodRange;
  points: HomeChartPoint[];
  totalCop: number;
  changeCop: number;
  activeDays: number;
  hasEnoughData: boolean;
}

function parseDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function eventChange(entry: LedgerEvent, metric: HomeChartMetric): number {
  if (metric === 'profit') return ledgerSaleProfitCop(entry) ?? 0;
  if (entry.direction === 'entra') return entry.amountCop;
  if (entry.direction === 'sale') return -entry.amountCop;
  return 0;
}

/**
 * Filtra un libro ya construido. Cambiar período o medida nunca reconstruye
 * las entidades de origen: únicamente vuelve a recorrer sus eventos.
 */
export function buildHomeChartSeries(
  ledger: readonly LedgerEvent[],
  period: HomeChartPeriod,
  metric: HomeChartMetric,
  anchorDate: string
): HomeChartSeries {
  const range = salesPeriodRange(period, anchorDate);
  const changesByDay = new Map<string, number>();

  for (const entry of ledger) {
    if (!isValidISODate(entry.date) || entry.date < range.start || entry.date > range.end) continue;
    const change = eventChange(entry, metric);
    if (change === 0) continue;
    changesByDay.set(entry.date, (changesByDay.get(entry.date) ?? 0) + change);
  }

  const points: HomeChartPoint[] = [];
  let totalCop = 0;
  const cursor = parseDate(range.start);
  const end = parseDate(range.end);
  while (cursor <= end) {
    const date = isoDate(cursor);
    const changeCop = changesByDay.get(date) ?? 0;
    totalCop += changeCop;
    points.push({ date, valueCop: totalCop, changeCop });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const activeDays = [...changesByDay.values()].filter((value) => value !== 0).length;
  return {
    range,
    points,
    totalCop,
    changeCop: totalCop,
    activeDays,
    hasEnoughData: points.length > 1 && activeDays > 1
  };
}
