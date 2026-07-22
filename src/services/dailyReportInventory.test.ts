// Cierres del día y del mes con la ampliación de inventario (D-045).
// La regla que se prueba aquí es una sola: el dinero cuenta el día que se
// mueve DE VERDAD. Una venta a crédito no es caja el día de la venta.

import { describe, expect, it } from 'vitest';
import type { StockJewel, StoneLot, StoneSale } from '../types';
import { buildDailyReport, buildMonthlyReport, listMonthlySummaries } from './dailyReport';

const DIA = '2026-07-21';
const MES = '2026-07';

function venta(overrides: Partial<StoneSale> = {}): StoneSale {
  return {
    id: 'v-1',
    date: DIA,
    buyer: 'Joyería Ejemplo',
    buyerId: null,
    carats: 1,
    quantity: 1,
    valueCop: 3000000,
    onCredit: false,
    dueDate: '',
    payments: [],
    notes: '',
    ...overrides
  };
}

function lote(overrides: Partial<StoneLot> = {}): StoneLot {
  return {
    id: 'l-1',
    name: 'Lote Ejemplo',
    stoneType: 'Esmeralda',
    description: '',
    purchaseDate: '2026-06-01',
    supplier: '',
    supplierId: null,
    carats: 10,
    quantity: 10,
    purchaseValueCop: 0,
    onCredit: false,
    supplierPayments: [],
    notes: '',
    sales: [],
    createdAt: '2026-06-01T09:00:00.000Z',
    updatedAt: '2026-06-01T09:00:00.000Z',
    ...overrides
  };
}

function joya(overrides: Partial<StockJewel> = {}): StockJewel {
  return {
    id: 'j-1',
    name: 'Anillo Ejemplo',
    pieceType: 'anillo',
    material: 'Oro',
    photo: '',
    acquiredDate: DIA,
    costCop: 2000000,
    priceCop: 3500000,
    status: 'disponible',
    notes: '',
    sale: null,
    createdAt: '2026-07-21T09:00:00.000Z',
    updatedAt: '2026-07-21T09:00:00.000Z',
    ...overrides
  };
}

describe('una venta a crédito no infla la caja del día', () => {
  it('la venta se lista pero no entra a caja el día que se hace', () => {
    const lots = [lote({ sales: [venta({ onCredit: true, dueDate: '2026-08-21' })] })];
    const report = buildDailyReport(DIA, [], lots);

    expect(report.stoneSales).toHaveLength(1);
    expect(report.stoneSales[0].onCredit).toBe(true);
    expect(report.totals.stonesSold).toBe(0);
    expect(report.totals.stonesSoldCredit).toBe(3000000);
    expect(report.totals.cashIn).toBe(0);
    expect(report.totals.net).toBe(0);
  });

  it('una venta de contado sí entra completa el día de la venta', () => {
    const report = buildDailyReport(DIA, [], [lote({ sales: [venta()] })]);
    expect(report.totals.stonesSold).toBe(3000000);
    expect(report.totals.stonesSoldCredit).toBe(0);
    expect(report.totals.cashIn).toBe(3000000);
  });

  it('el abono entra a caja el día en que lo recibe, no el de la venta', () => {
    const lots = [
      lote({
        sales: [
          venta({
            date: '2026-07-10',
            onCredit: true,
            dueDate: '2026-08-10',
            payments: [{ id: 'ab-1', date: DIA, amount: 1200000, notes: '' }]
          })
        ]
      })
    ];

    const diaDeLaVenta = buildDailyReport('2026-07-10', [], lots);
    expect(diaDeLaVenta.totals.cashIn).toBe(0);
    expect(diaDeLaVenta.totals.stonesSoldCredit).toBe(3000000);

    const diaDelAbono = buildDailyReport(DIA, [], lots);
    expect(diaDelAbono.buyerPayments).toHaveLength(1);
    expect(diaDelAbono.buyerPayments[0].amount).toBe(1200000);
    expect(diaDelAbono.totals.buyerPaymentsReceived).toBe(1200000);
    expect(diaDelAbono.totals.cashIn).toBe(1200000);
  });

  it('muestra la foto de cuánto le deben por piedras a la fecha', () => {
    const lots = [
      lote({
        sales: [
          venta({
            onCredit: true,
            dueDate: '2026-08-21',
            valueCop: 3000000,
            payments: [{ id: 'ab-1', date: DIA, amount: 1000000, notes: '' }]
          })
        ]
      })
    ];
    expect(buildDailyReport(DIA, [], lots).totals.buyersOwe).toBe(2000000);
  });

  it('sin ventas a crédito la deuda de compradores es cero', () => {
    expect(buildDailyReport(DIA, [], [lote({ sales: [venta()] })]).totals.buyersOwe).toBe(0);
  });
});

describe('joyas en stock en el cierre', () => {
  it('una joya que entra al inventario saca dinero de la caja ese día', () => {
    const report = buildDailyReport(DIA, [], [], [joya({ costCop: 2000000 })]);
    expect(report.jewelPurchases).toHaveLength(1);
    expect(report.totals.jewelsAcquiredCost).toBe(2000000);
    expect(report.totals.cashOut).toBe(2000000);
    expect(report.totals.net).toBe(-2000000);
  });

  it('una joya sin costo registrado no aparece como salida de caja', () => {
    const report = buildDailyReport(DIA, [], [], [joya({ costCop: 0 })]);
    expect(report.jewelPurchases).toEqual([]);
    expect(report.totals.cashOut).toBe(0);
  });

  it('la venta de una joya entra completa el día de la venta', () => {
    const vendida = joya({
      acquiredDate: '2026-07-01',
      costCop: 2000000,
      sale: {
        id: 's-1',
        date: DIA,
        buyer: 'Comprador Ejemplo',
        buyerId: null,
        priceCop: 3200000,
        notes: ''
      }
    });
    const report = buildDailyReport(DIA, [], [], [vendida]);

    expect(report.jewelSales).toHaveLength(1);
    expect(report.jewelSales[0].priceCop).toBe(3200000);
    expect(report.jewelSales[0].resultCop).toBe(1200000);
    expect(report.totals.jewelsSold).toBe(3200000);
    expect(report.totals.jewelsResult).toBe(1200000);
    expect(report.totals.cashIn).toBe(3200000);
  });

  it('comprar y vender la misma pieza el mismo día deja el neto correcto', () => {
    const mismoDia = joya({
      acquiredDate: DIA,
      costCop: 2000000,
      sale: { id: 's-1', date: DIA, buyer: '', buyerId: null, priceCop: 3000000, notes: '' }
    });
    const report = buildDailyReport(DIA, [], [], [mismoDia]);
    expect(report.totals.cashIn).toBe(3000000);
    expect(report.totals.cashOut).toBe(2000000);
    expect(report.totals.net).toBe(1000000);
  });
});

describe('un día sin movimientos sigue siendo un día vacío', () => {
  it('una joya de otro día no lo llena', () => {
    const report = buildDailyReport(DIA, [], [], [joya({ acquiredDate: '2026-01-01' })]);
    expect(report.isEmpty).toBe(true);
  });

  it('un abono del día ya no lo deja vacío', () => {
    const lots = [
      lote({
        sales: [
          venta({
            date: '2026-07-01',
            onCredit: true,
            dueDate: '2026-08-01',
            payments: [{ id: 'ab-1', date: DIA, amount: 100000, notes: '' }]
          })
        ]
      })
    ];
    expect(buildDailyReport(DIA, [], lots).isEmpty).toBe(false);
  });
});

describe('cierre del mes', () => {
  it('suma abonos, ventas de joyas y compras de joyas del mes', () => {
    const lots = [
      lote({
        sales: [
          venta({
            date: '2026-07-05',
            onCredit: true,
            dueDate: '2026-08-05',
            valueCop: 4000000,
            payments: [
              { id: 'ab-1', date: '2026-07-10', amount: 1000000, notes: '' },
              { id: 'ab-2', date: '2026-08-02', amount: 1000000, notes: '' }
            ]
          })
        ]
      })
    ];
    const jewels = [
      joya({
        acquiredDate: '2026-07-02',
        costCop: 1500000,
        sale: { id: 's-1', date: '2026-07-25', buyer: '', buyerId: null, priceCop: 2500000, notes: '' }
      })
    ];

    const report = buildMonthlyReport(MES, [], lots, jewels);
    // Solo el abono de julio cuenta; el de agosto pertenece a otro mes.
    expect(report.totals.buyerPaymentsReceived).toBe(1000000);
    expect(report.totals.stonesSoldCredit).toBe(4000000);
    expect(report.totals.jewelsAcquiredCost).toBe(1500000);
    expect(report.totals.jewelsSold).toBe(2500000);
    expect(report.totals.cashIn).toBe(3500000);
    expect(report.totals.cashOut).toBe(1500000);
    expect(report.totals.net).toBe(2000000);
  });

  it('un mes con solo un abono aparece en la lista de meses con actividad', () => {
    const lots = [
      lote({
        sales: [
          venta({
            date: '2026-06-01',
            onCredit: true,
            dueDate: '2026-07-01',
            payments: [{ id: 'ab-1', date: '2026-09-15', amount: 500000, notes: '' }]
          })
        ]
      })
    ];
    expect(listMonthlySummaries([], lots).map((m) => m.month)).toContain('2026-09');
  });

  it('un mes con solo la entrada de una joya aparece en la lista', () => {
    const jewels = [joya({ acquiredDate: '2026-05-10', costCop: 1000000 })];
    expect(listMonthlySummaries([], [], jewels).map((m) => m.month)).toContain('2026-05');
  });
});

describe('el PDF interno no cambia de naturaleza', () => {
  it('sin nada del inventario nuevo, los totales quedan en cero y no rompen el neto', () => {
    const report = buildDailyReport(DIA, [], []);
    expect(report.totals.buyerPaymentsReceived).toBe(0);
    expect(report.totals.stonesSoldCredit).toBe(0);
    expect(report.totals.jewelsSold).toBe(0);
    expect(report.totals.jewelsAcquiredCost).toBe(0);
    expect(report.totals.buyersOwe).toBe(0);
    expect(report.totals.net).toBe(0);
  });
});
