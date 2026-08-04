import { describe, expect, it } from 'vitest';
import { sampleClient, sampleQuote } from '../test/fixtures';
import type { Expense, MaterialLot, StockJewel, StoneLot } from '../types';
import { buildDailyReport, buildMonthlyReport } from './dailyReport';
import {
  buildLedger,
  ledgerCashTotals,
  ledgerEventsForDay,
  ledgerEventsForMonth
} from './ledger';

const DAY = '2026-08-04';
const MONTH = '2026-08';

const creditLot: StoneLot = {
  id: 'lot-credit',
  name: 'Lote credito y talla',
  stoneType: 'Esmeralda',
  description: 'Lote rico para equivalencia',
  purchaseDate: DAY,
  supplier: 'Proveedor Verde',
  supplierId: 'supplier-1',
  carats: 12,
  quantity: 10,
  purchaseValueCop: 6_000_000,
  partnerId: 'partner-1',
  partnerName: 'Socio Uno',
  myPercent: 60,
  onCredit: true,
  supplierPayments: [
    { id: 'supplier-payment-day', date: DAY, amount: 1_100_000, notes: 'Primer pago' },
    { id: 'supplier-payment-next', date: '2026-09-02', amount: 500_000, notes: '' }
  ],
  cuttingBatches: [
    {
      id: 'cutting-paid',
      sentDate: '2026-08-02',
      sentCarats: 3,
      sentQuantity: 3,
      returnedDate: DAY,
      returnedCarats: 2.7,
      returnedQuantity: 3,
      cuttingCostCop: 250_001,
      cuttingPaidDate: DAY,
      notes: 'Talla pagada'
    },
    {
      id: 'cutting-unpaid',
      sentDate: '2026-08-03',
      sentCarats: 2,
      sentQuantity: 2,
      returnedDate: '',
      returnedCarats: 0,
      returnedQuantity: 0,
      cuttingCostCop: 350_000,
      cuttingPaidDate: '',
      notes: 'Todavia no sale de caja'
    }
  ],
  internalUses: [
    {
      id: 'transformation-1',
      date: DAY,
      carats: 1,
      quantity: 1,
      origin: 'bruto',
      jewelId: 'jewel-transformed',
      costCop: 300_000,
      notes: 'Piedra para joya propia'
    }
  ],
  notes: 'Compra compartida',
  sales: [
    {
      id: 'sale-credit',
      date: DAY,
      buyer: 'Comprador Credito',
      buyerId: 'buyer-credit',
      carats: 2,
      quantity: 2,
      origin: 'bruto',
      valueCop: 4_000_000,
      productType: 'Piedra suelta',
      usdRate: 4_020,
      receivedBy: '',
      method: '',
      onCredit: true,
      dueDate: '2026-09-04',
      payments: [
        {
          id: 'buyer-payment-day',
          date: DAY,
          amount: 900_001,
          usdRate: 4_010,
          receivedBy: 'Santiago',
          method: 'Transferencia',
          notes: 'Abono real'
        },
        {
          id: 'buyer-payment-next',
          date: '2026-09-04',
          amount: 500_000,
          usdRate: 4_030,
          receivedBy: 'Santiago',
          method: 'Efectivo',
          notes: ''
        }
      ],
      notes: 'Venta pactada a credito'
    }
  ],
  createdAt: '2026-08-04T08:00:00.000Z',
  updatedAt: '2026-08-04T12:00:00.000Z'
};

const cashLot: StoneLot = {
  ...creditLot,
  id: 'lot-cash',
  name: 'Lote contado',
  purchaseValueCop: 2_000_000,
  partnerId: null,
  partnerName: '',
  myPercent: 100,
  onCredit: false,
  supplierPayments: [],
  cuttingBatches: [],
  internalUses: [],
  sales: [
    {
      id: 'sale-cash',
      date: DAY,
      buyer: 'Comprador Contado',
      buyerId: null,
      carats: 1,
      quantity: 1,
      origin: 'bruto',
      valueCop: 3_000_000,
      productType: 'Piedra suelta',
      usdRate: 4_015,
      receivedBy: 'Laura',
      method: 'Efectivo',
      onCredit: false,
      dueDate: '',
      payments: [],
      notes: ''
    }
  ]
};

const transformedJewel: StockJewel = {
  id: 'jewel-transformed',
  name: 'Anillo transformado',
  pieceType: 'anillo',
  material: 'Oro',
  photo: '',
  acquiredDate: DAY,
  weightGrams: 5,
  size: '7',
  stoneCount: 1,
  stoneKind: 'natural',
  // Un millon salio al adquirirla; 300.000 se trasladaron despues desde el lote.
  costCop: 1_300_000,
  priceCop: 2_800_000,
  status: 'disponible',
  notes: 'Joya de inventario',
  sale: {
    id: 'jewel-sale',
    date: DAY,
    buyer: 'Compradora Joya',
    buyerId: 'buyer-jewel',
    priceCop: 2_500_000,
    productType: 'Anillo terminado',
    usdRate: 4_018,
    receivedBy: 'Santiago',
    method: 'Tarjeta',
    notes: 'Venta de contado'
  },
  collectionId: null,
  stoneTransformations: [
    {
      id: 'transformation-1',
      date: DAY,
      lotId: creditLot.id,
      jewelId: 'jewel-transformed',
      origin: 'bruto',
      carats: 1,
      quantity: 1,
      costCop: 300_000,
      notes: 'Fantasia a natural',
      fromStoneKind: 'fantasia',
      toStoneKind: 'natural'
    }
  ],
  createdAt: '2026-08-04T08:00:00.000Z',
  updatedAt: '2026-08-04T12:00:00.000Z'
};

const expense: Expense = {
  id: 'expense-1',
  date: DAY,
  concept: 'Publicidad compartida',
  category: 'Publicidad',
  amountCop: 450_001,
  usdRate: 4_000,
  method: 'Transferencia',
  paidBy: 'Santiago',
  partnerId: 'partner-1',
  partnerName: 'Socio Uno',
  myPercent: 60,
  notes: 'Feria',
  createdAt: '2026-08-04T08:00:00.000Z',
  updatedAt: '2026-08-04T08:00:00.000Z'
};

const materialLot: MaterialLot = {
  id: 'material-1',
  name: 'Oro compartido',
  materialType: 'Oro',
  purity: '18K',
  purchaseDate: DAY,
  grams: 10,
  costCop: 5_000_000,
  partnerId: 'partner-1',
  partnerName: 'Socio Uno',
  myGrams: 6,
  notes: 'No toca caja en v1',
  uses: [{ id: 'material-use-1', date: DAY, grams: 1.5, notes: 'Uso en encargo' }],
  createdAt: '2026-08-04T08:00:00.000Z',
  updatedAt: '2026-08-04T12:00:00.000Z'
};

const quote = sampleQuote({
  id: 'quote-rich',
  number: 'ED-2026-D1',
  clientId: 'client-rich',
  clientSnapshot: sampleClient({ id: 'client-rich', name: 'Cliente Libro' }),
  date: DAY,
  status: 'aprobada',
  approvedAt: '2026-08-04T15:00:00.000Z',
  deposit: 700_000,
  depositDate: DAY,
  payments: [
    {
      id: 'client-payment-day',
      amount: 800_000,
      date: DAY,
      receivedBy: 'Laura',
      method: 'Transferencia',
      notes: 'Abono de cliente'
    },
    {
      id: 'client-payment-next',
      amount: 200_000,
      date: '2026-09-01',
      receivedBy: 'Laura',
      method: 'Efectivo',
      notes: ''
    }
  ],
  production: [
    {
      id: 'workshop-paid',
      name: 'Engaste',
      status: 'lista',
      completedAt: DAY,
      cost: 350_000,
      paid: true,
      paidAt: DAY,
      paidTo: 'Taller Central',
      paidBy: 'Santiago',
      notes: 'Pago real'
    },
    {
      id: 'workshop-unpaid',
      name: 'Pulido',
      status: 'enProceso',
      completedAt: '',
      cost: 180_000,
      paid: false,
      paidAt: DAY,
      paidTo: '',
      paidBy: '',
      notes: 'No pagado'
    }
  ]
});

const input = {
  quotes: [quote],
  stoneLots: [creditLot, cashLot],
  stockJewels: [transformedJewel],
  materialLots: [materialLot],
  expenses: [expense]
};

describe('D1: libro del negocio en paralelo', () => {
  it('iguala peso por peso los cierres diario y mensual con un conjunto rico', () => {
    const ledger = buildLedger(input);
    const dailyLedger = ledgerCashTotals(ledgerEventsForDay(ledger, DAY));
    const monthlyLedger = ledgerCashTotals(ledgerEventsForMonth(ledger, MONTH));
    const dailyReport = buildDailyReport(
      DAY,
      input.quotes,
      input.stoneLots,
      input.stockJewels,
      input.expenses
    );
    const monthlyReport = buildMonthlyReport(
      MONTH,
      input.quotes,
      input.stoneLots,
      input.stockJewels,
      input.expenses
    );

    expect(dailyLedger).toEqual({
      cashIn: dailyReport.totals.cashIn,
      cashOut: dailyReport.totals.cashOut,
      net: dailyReport.totals.net
    });
    expect(monthlyLedger).toEqual({
      cashIn: monthlyReport.totals.cashIn,
      cashOut: monthlyReport.totals.cashOut,
      net: monthlyReport.totals.net
    });
    expect(dailyLedger).toEqual({ cashIn: 7_900_001, cashOut: 5_150_002, net: 2_749_999 });
  });

  it('registra actividad sin caja y conserva las dimensiones honestas', () => {
    const ledger = buildLedger(input);
    const creditPurchase = ledger.find(
      (entry) => entry.id === 'stone-lot:lot-credit:purchase'
    );
    const creditSale = ledger.find((entry) => entry.kind === 'venta_piedras_credito');
    const transformation = ledger.find((entry) => entry.kind === 'transformacion_joya');
    const materialEvents = ledger.filter((entry) => entry.kind === 'movimiento_material');

    expect(creditPurchase).toMatchObject({
      direction: 'ninguna',
      amountCop: 6_000_000,
      partnerId: 'partner-1',
      partnerName: 'Socio Uno',
      myPercent: 60
    });
    expect(creditSale).toMatchObject({
      direction: 'ninguna',
      usdRate: 4_020,
      productType: 'Piedra suelta',
      counterpartyId: 'buyer-credit'
    });
    expect(transformation).toMatchObject({
      direction: 'ninguna',
      amountCop: 300_000,
      lotId: 'lot-credit'
    });
    expect(materialEvents).toHaveLength(2);
    expect(materialEvents.every((entry) => entry.direction === 'ninguna')).toBe(true);
    expect(ledger.some((entry) => entry.reference === 'cutting-unpaid')).toBe(false);
    expect(ledgerCashTotals(materialEvents)).toEqual({ cashIn: 0, cashOut: 0, net: 0 });
  });

  it('produce ids estables, unicos y montos COP enteros no negativos', () => {
    const first = buildLedger(input);
    const second = buildLedger(input);

    expect(second).toEqual(first);
    expect(new Set(first.map((entry) => entry.id)).size).toBe(first.length);
    expect(
      first.every((entry) => Number.isSafeInteger(entry.amountCop) && entry.amountCop >= 0)
    ).toBe(true);
    expect(
      first.every(
        (entry) => Number.isSafeInteger(entry.attributedCostCop) && entry.attributedCostCop >= 0
      )
    ).toBe(true);
  });

  it('atribuye el costo a la venta sin duplicarlo en los cobros posteriores', () => {
    const ledger = buildLedger(input);
    const approvedQuote = ledger.find((entry) => entry.id === 'quote:quote-rich:approved');
    const creditSale = ledger.find((entry) => entry.id === 'stone-lot:lot-credit:sale:sale-credit');
    const buyerPayments = ledger.filter((entry) => entry.kind === 'abono_comprador');
    const jewelSale = ledger.find((entry) => entry.kind === 'venta_joya_stock');

    expect(approvedQuote?.attributedCostCop).toBeGreaterThan(0);
    expect(creditSale).toMatchObject({
      date: DAY,
      direction: 'ninguna',
      attributedCostCop: 1_041_667
    });
    expect(buyerPayments.every((entry) => entry.attributedCostCop === 0)).toBe(true);
    expect(jewelSale?.attributedCostCop).toBe(1_300_000);
  });

  it('no supera lo invertido y entrega el residuo COP al agotar un lote impar', () => {
    const baseSale = cashLot.sales[0];
    const oddLot: StoneLot = {
      ...cashLot,
      id: 'lot-odd',
      carats: 3,
      quantity: 3,
      purchaseValueCop: 1_001,
      sales: [
        { ...baseSale, id: 'odd-1', carats: 1, quantity: 1 },
        { ...baseSale, id: 'odd-2', carats: 1, quantity: 1 },
        { ...baseSale, id: 'odd-3', carats: 1, quantity: 1 }
      ]
    };
    const costs = buildLedger({ stoneLots: [oddLot] })
      .filter((entry) => entry.kind === 'venta_piedras_contado')
      .map((entry) => entry.attributedCostCop);

    expect(costs).toEqual([334, 334, 333]);
    expect(costs.reduce((total, cost) => total + cost, 0)).toBe(oddLot.purchaseValueCop);
    expect(costs.slice(0, 2).reduce((total, cost) => total + cost, 0)).toBeLessThan(
      oddLot.purchaseValueCop
    );
  });
});
