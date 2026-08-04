import { describe, expect, it } from 'vitest';
import type { StoneLot } from '../types';
import { buildDailyReport, buildMonthlyReport } from './dailyReport';

const lot: StoneLot = {
  id: 'lot-cutting',
  name: 'Lote talla',
  stoneType: 'Esmeralda',
  description: '',
  purchaseDate: '2026-08-01',
  supplier: 'Proveedor',
  supplierId: null,
  carats: 5,
  quantity: 5,
  purchaseValueCop: 1_000_000,
  partnerId: null,
  partnerName: '',
  myPercent: 100,
  onCredit: false,
  supplierPayments: [],
  cuttingBatches: [
    {
      id: 'batch-paid',
      sentDate: '2026-08-02',
      sentCarats: 2,
      sentQuantity: 2,
      returnedDate: '2026-08-03',
      returnedCarats: 1.8,
      returnedQuantity: 2,
      cuttingCostCop: 250_000,
      cuttingPaidDate: '2026-08-04',
      notes: 'Pago al tallador'
    },
    {
      id: 'batch-unpaid',
      sentDate: '2026-08-03',
      sentCarats: 1,
      sentQuantity: 1,
      returnedDate: '',
      returnedCarats: 0,
      returnedQuantity: 0,
      cuttingCostCop: 300_000,
      cuttingPaidDate: '',
      notes: ''
    }
  ],
  notes: '',
  sales: [],
  createdAt: '2026-08-01T12:00:00.000Z',
  updatedAt: '2026-08-04T12:00:00.000Z'
};

describe('C1: pago de talla en caja', () => {
  it('sale únicamente en la fecha real de pago', () => {
    const paidDay = buildDailyReport('2026-08-04', [], [lot]);
    const sentDay = buildDailyReport('2026-08-02', [], [lot]);

    expect(paidDay.cuttingPayments).toHaveLength(1);
    expect(paidDay.cuttingPayments[0].amount).toBe(250_000);
    expect(paidDay.totals.cuttingPaid).toBe(250_000);
    expect(paidDay.totals.cashOut).toBe(250_000);
    expect(sentDay.cuttingPayments).toEqual([]);
    expect(sentDay.totals.cuttingPaid).toBe(0);
  });

  it('incluye el pago una sola vez en el cierre mensual', () => {
    const report = buildMonthlyReport('2026-08', [], [lot]);
    expect(report.cuttingPayments).toHaveLength(1);
    expect(report.totals.cuttingPaid).toBe(250_000);
  });
});
