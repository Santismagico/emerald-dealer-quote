import { describe, expect, it } from 'vitest';
import { sampleQuote } from '../test/fixtures';
import { emptyStoneLot, emptyStoneSale } from './stones';
import { buildSalesAnalytics, salesPeriodRange } from './salesAnalytics';

const DAY = '2026-08-04';
const NOW = '2026-08-04T12:00:00.000Z';

function sharedCreditLot() {
  const sale = {
    ...emptyStoneSale(DAY, 4_000),
    id: 'sale-credit',
    buyer: 'Comprador',
    carats: 2,
    quantity: 2,
    valueCop: 2_000_000,
    productType: 'Piedra suelta',
    onCredit: true,
    dueDate: '2026-08-20',
    payments: [
      {
        id: 'payment-later',
        date: '2026-09-02',
        amount: 400_000,
        usdRate: 4_100,
        receivedBy: 'Santiago',
        method: 'Transferencia',
        notes: ''
      }
    ]
  };
  return {
    ...emptyStoneLot(DAY, NOW),
    id: 'lot-shared',
    name: 'Lote sociedad',
    carats: 4,
    quantity: 4,
    purchaseValueCop: 1_000_000,
    partnerId: 'partner-1',
    partnerName: 'Socio Uno',
    myPercent: 60,
    sales: [sale]
  };
}

describe('E1: ventas y ganancias desde el libro', () => {
  it('construye día, semana, mes y año desde una fecha de referencia', () => {
    expect(salesPeriodRange('dia', DAY)).toEqual({ start: DAY, end: DAY });
    expect(salesPeriodRange('semana', DAY)).toEqual({
      start: '2026-08-03',
      end: '2026-08-09'
    });
    expect(salesPeriodRange('mes', DAY)).toEqual({
      start: '2026-08-01',
      end: '2026-08-31'
    });
    expect(salesPeriodRange('anio', DAY)).toEqual({
      start: '2026-01-01',
      end: '2026-12-31'
    });
  });

  it('reconoce la ganancia del crédito al vender y deja el cobro posterior fuera de caja', () => {
    const lot = sharedCreditLot();
    const august = buildSalesAnalytics({ period: 'mes', anchorDate: DAY, stoneLots: [lot] });
    const september = buildSalesAnalytics({
      period: 'mes',
      anchorDate: '2026-09-10',
      stoneLots: [lot]
    });

    expect(august.salesCop).toBe(2_000_000);
    expect(august.attributedCostCop).toBe(500_000);
    expect(august.profitCop).toBe(1_500_000);
    expect(august.cashCop).toEqual({ cashIn: 0, cashOut: 1_000_000, net: -1_000_000 });
    expect(september.salesCop).toBe(0);
    expect(september.profitCop).toBe(0);
    expect(september.cashCop.cashIn).toBe(400_000);
    expect(august.pendingStoneBuyersCop).toBe(1_600_000);
  });

  it('convierte únicamente cada venta que trae su propia tasa', () => {
    const lot = sharedCreditLot();
    const quote = sampleQuote({
      id: 'quote-no-rate',
      status: 'aprobada',
      approvedAt: NOW,
      date: DAY,
      deposit: 0,
      payments: []
    });
    const analytics = buildSalesAnalytics({
      period: 'dia',
      anchorDate: DAY,
      stoneLots: [lot],
      quotes: [quote]
    });

    expect(analytics.salesUsd.knownCount).toBe(1);
    expect(analytics.salesUsd.missingCount).toBe(1);
    expect(analytics.sales.find((sale) => sale.id.includes('quote-no-rate'))?.profitUsd).toBeNull();
    expect(analytics.sales.find((sale) => sale.id.includes('sale-credit'))?.amountUsd).toBe(500);
  });

  it('muestra ganancia por lote y ambas partes de la sociedad con rentabilidad', () => {
    const analytics = buildSalesAnalytics({
      period: 'mes',
      anchorDate: DAY,
      stoneLots: [sharedCreditLot()]
    });

    expect(analytics.byLot).toEqual([
      expect.objectContaining({
        name: 'Lote sociedad',
        salesCop: 2_000_000,
        costCop: 500_000,
        profitCop: 1_500_000
      })
    ]);
    expect(analytics.partnerships).toEqual([
      expect.objectContaining({
        partnerName: 'Socio Uno',
        myProfitCop: 900_000,
        partnerProfitCop: 600_000,
        myInvestedCop: 600_000,
        partnerInvestedCop: 400_000,
        myReturnPercent: 150,
        partnerReturnPercent: 150
      })
    ]);
  });

  it('indica que la rentabilidad no aplica cuando la inversión es cero', () => {
    const lot = sharedCreditLot();
    lot.purchaseValueCop = 0;
    const analytics = buildSalesAnalytics({ period: 'dia', anchorDate: DAY, stoneLots: [lot] });

    expect(analytics.partnerships[0].myReturnPercent).toBeNull();
    expect(analytics.partnerships[0].partnerReturnPercent).toBeNull();
  });
});
