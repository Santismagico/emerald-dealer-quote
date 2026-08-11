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

function comparisonLot(input: {
  id: string;
  name: string;
  partnerId: string | null;
  partnerName: string;
  purchaseValueCop: number;
  saleValueCop: number;
  productType: string;
}) {
  return {
    ...emptyStoneLot(DAY, NOW),
    id: input.id,
    name: input.name,
    carats: 1,
    quantity: 1,
    purchaseValueCop: input.purchaseValueCop,
    partnerId: input.partnerId,
    partnerName: input.partnerName,
    myPercent: 50,
    sales: [
      {
        ...emptyStoneSale(DAY, 4_000),
        id: `sale-${input.id}`,
        buyer: 'Comprador',
        carats: 1,
        quantity: 1,
        valueCop: input.saleValueCop,
        productType: input.productType
      }
    ]
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
    // Una fila POR PERSONA, Santiago primero. Cada cifra es solo suya: antes la
    // fila mezclaba «tu parte» y «la del socio», y agrupaba por el socio único.
    expect(analytics.partnerships).toEqual([
      expect.objectContaining({
        partnerName: 'Tú',
        isOwner: true,
        investedCop: 600_000,
        profitCop: 900_000,
        returnPercent: 150
      }),
      expect.objectContaining({
        partnerName: 'Socio Uno',
        isOwner: false,
        investedCop: 400_000,
        profitCop: 600_000,
        returnPercent: 150
      })
    ]);
  });

  it('indica que la rentabilidad no aplica cuando la inversión es cero', () => {
    const lot = sharedCreditLot();
    lot.purchaseValueCop = 0;
    const analytics = buildSalesAnalytics({ period: 'dia', anchorDate: DAY, stoneLots: [lot] });

    expect(analytics.partnerships.every((item) => item.returnPercent === null)).toBe(true);
  });
});

describe('E3: consolidado con filtros y comparación', () => {
  const largeSociety = comparisonLot({
    id: 'lot-large',
    name: 'Lote grande',
    partnerId: 'partner-large',
    partnerName: 'Sociedad Grande',
    purchaseValueCop: 1_000_000,
    saleValueCop: 2_000_000,
    productType: 'Anillo'
  });
  const efficientSociety = comparisonLot({
    id: 'lot-efficient',
    name: 'Lote eficiente',
    partnerId: 'partner-efficient',
    partnerName: 'Sociedad Eficiente',
    purchaseValueCop: 100_000,
    saleValueCop: 300_000,
    productType: 'Piedra suelta'
  });
  const unregistered = comparisonLot({
    id: 'lot-unregistered',
    name: 'Lote anterior',
    partnerId: null,
    partnerName: '',
    purchaseValueCop: 50_000,
    saleValueCop: 100_000,
    productType: ''
  });
  const lots = [largeSociety, efficientSociety, unregistered];

  it('permite filtrar sociedades y tipos viejos como Sin registrar', () => {
    const all = buildSalesAnalytics({ period: 'mes', anchorDate: DAY, stoneLots: lots });
    const noSocietyValue = all.filters.societies.find(
      (option) => option.label === 'Sin registrar'
    )?.value;
    const noProductValue = all.filters.productTypes.find(
      (option) => option.label === 'Sin registrar'
    )?.value;

    expect(noSocietyValue).toBe('sin-registrar');
    expect(noProductValue).toBe('sin-registrar');
    expect(all.filters.societies.map((option) => option.label)).toEqual(
      expect.arrayContaining(['Todos', 'Sociedad Grande', 'Sociedad Eficiente', 'Sin registrar'])
    );
    expect(all.filters.productTypes.map((option) => option.label)).toEqual(
      expect.arrayContaining(['Todos', 'Anillo', 'Piedra suelta', 'Sin registrar'])
    );

    const filtered = buildSalesAnalytics({
      period: 'mes',
      anchorDate: DAY,
      stoneLots: lots,
      societyFilter: noSocietyValue,
      productTypeFilter: noProductValue
    });

    expect(filtered.sales).toHaveLength(1);
    expect(filtered.sales[0]).toMatchObject({
      lotId: 'lot-unregistered',
      partnerName: '',
      productType: ''
    });
    expect(filtered.salesCop).toBe(100_000);
  });

  it('señala por separado la sociedad que deja más dinero y la más rentable', () => {
    const analytics = buildSalesAnalytics({ period: 'mes', anchorDate: DAY, stoneLots: lots });

    // La comparación mira solo a los socios: Santiago está en todos los lotes y
    // ganaría siempre las dos tarjetas, que es justo lo que no se quiere saber.
    expect(analytics.comparison.mostMoney).toMatchObject({
      partnerName: 'Sociedad Grande',
      isOwner: false,
      profitCop: 500_000,
      returnPercent: 100
    });
    expect(analytics.comparison.mostProfitable).toMatchObject({
      partnerName: 'Sociedad Eficiente',
      isOwner: false,
      profitCop: 100_000,
      returnPercent: 200
    });
  });

  it('filtra una sociedad y un tipo de producto concretos en cualquier período', () => {
    const all = buildSalesAnalytics({ period: 'anio', anchorDate: DAY, stoneLots: lots });
    const society = all.filters.societies.find(
      (option) => option.label === 'Sociedad Grande'
    )?.value;
    const product = all.filters.productTypes.find((option) => option.label === 'Anillo')?.value;
    const filtered = buildSalesAnalytics({
      period: 'anio',
      anchorDate: DAY,
      stoneLots: lots,
      societyFilter: society,
      productTypeFilter: product
    });

    expect(filtered.sales.map((sale) => sale.lotId)).toEqual(['lot-large']);
    expect(filtered.filters.societyLabel).toBe('Sociedad Grande');
    expect(filtered.filters.productTypeLabel).toBe('Anillo');
  });
});
