import { describe, expect, it } from 'vitest';
import type { Expense } from '../types';
import { sampleQuote } from '../test/fixtures';
import { buildMonthlyReport } from './dailyReport';
import { buildHomeChartSeries } from './homeChart';
import { buildLedger, type LedgerEvent } from './ledger';

const DAY = '2026-08-04';

function event(overrides: Partial<LedgerEvent>): LedgerEvent {
  return {
    id: 'event',
    date: DAY,
    kind: 'gasto',
    direction: 'sale',
    amountCop: 0,
    attributedCostCop: 0,
    usdRate: null,
    module: 'gastos',
    lotId: null,
    partnerId: null,
    partnerName: '',
    myPercent: 100,
    partners: [],
    equityBaseCop: 0,
    myContributionCop: 0,
    productType: '',
    counterparty: '',
    counterpartyId: null,
    reference: 'event',
    notes: '',
    ...overrides
  };
}

describe('R2-2: gráfica del inicio desde el libro', () => {
  it('usa los períodos calendario detrás de 1 día, 7 días, 30 días y 1 año', () => {
    expect(buildHomeChartSeries([], 'dia', 'cash', DAY).points).toHaveLength(1);
    expect(buildHomeChartSeries([], 'semana', 'cash', DAY)).toMatchObject({
      range: { start: '2026-08-03', end: '2026-08-09' }
    });
    expect(buildHomeChartSeries([], 'semana', 'cash', DAY).points).toHaveLength(7);
    expect(buildHomeChartSeries([], 'mes', 'cash', DAY).points).toHaveLength(31);
    expect(buildHomeChartSeries([], 'anio', 'cash', DAY).points).toHaveLength(365);
  });

  it('iguala exactamente la Caja mensual del inicio con el Cierre mensual', () => {
    const quote = sampleQuote({
      id: 'quote-month',
      status: 'aprobada',
      date: DAY,
      approvedAt: '2026-08-04T15:00:00.000Z',
      deposit: 800_001,
      depositDate: DAY,
      payments: [],
      production: []
    });
    const expense: Expense = {
      id: 'expense-month',
      date: DAY,
      concept: 'Publicidad',
      category: 'Publicidad',
      amountCop: 125_001,
      usdRate: null,
      method: 'Transferencia',
      paidBy: 'Santiago',
      partnerId: null,
      partnerName: '',
      myPercent: 100,
      notes: '',
      createdAt: '2026-08-04T10:00:00.000Z',
      updatedAt: '2026-08-04T10:00:00.000Z'
    };
    const ledger = buildLedger({ quotes: [quote], expenses: [expense] });
    const chart = buildHomeChartSeries(ledger, 'mes', 'cash', DAY);
    const monthly = buildMonthlyReport('2026-08', [quote], [], [], [expense]);

    expect(chart.totalCop).toBe(monthly.totals.net);
  });

  it('reconoce la ganancia el día de la venta a crédito y la caja el día del cobro', () => {
    const ledger = [
      event({
        id: 'sale-credit',
        date: '2026-08-04',
        kind: 'venta_piedras_credito',
        direction: 'ninguna',
        amountCop: 2_000_000,
        attributedCostCop: 500_000,
        module: 'piedras'
      }),
      event({
        id: 'buyer-payment',
        date: '2026-09-04',
        kind: 'abono_comprador',
        direction: 'entra',
        amountCop: 400_000,
        module: 'piedras'
      })
    ];

    expect(buildHomeChartSeries(ledger, 'mes', 'profit', DAY).totalCop).toBe(1_500_000);
    expect(buildHomeChartSeries(ledger, 'mes', 'cash', DAY).totalCop).toBe(0);
    expect(buildHomeChartSeries(ledger, 'mes', 'profit', '2026-09-04').totalCop).toBe(0);
    expect(buildHomeChartSeries(ledger, 'mes', 'cash', '2026-09-04').totalCop).toBe(400_000);
  });

  it('forma una serie acumulada y no intenta dibujar con cero o un solo día activo', () => {
    const oneDay = [event({ id: 'one', date: '2026-08-04', amountCop: 100_000 })];
    const twoDays = [
      ...oneDay,
      event({ id: 'two', date: '2026-08-05', amountCop: 25_000 })
    ];

    expect(buildHomeChartSeries([], 'semana', 'cash', DAY).hasEnoughData).toBe(false);
    expect(buildHomeChartSeries(oneDay, 'semana', 'cash', DAY).hasEnoughData).toBe(false);
    const series = buildHomeChartSeries(twoDays, 'semana', 'cash', DAY);
    expect(series.hasEnoughData).toBe(true);
    expect(series.totalCop).toBe(-125_000);
    expect(series.points.find((point) => point.date === '2026-08-05')).toMatchObject({
      valueCop: -125_000,
      changeCop: -25_000
    });
  });
});
