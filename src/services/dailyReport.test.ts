import { describe, expect, it } from 'vitest';
import { sampleClient, sampleQuote, sampleSettings } from '../test/fixtures';
import type { Expense, StoneLot } from '../types';
import { calculateQuote, quoteToCalcInput } from '../calc/engine';
import { contentToPlainText } from './pdfContent';
import { appendSettlementPayment } from './payments';
import { formatCOP } from '../utils/money';
import {
  buildDailyReport,
  buildDailyReportPdfContent,
  buildMonthlyReport,
  buildMonthlyReportPdfContent,
  formatMonthCO,
  listMonthlySummaries,
  previousMonthlySummaries
} from './dailyReport';

const DAY = '2026-07-15';

function lote(overrides: Partial<StoneLot> = {}): StoneLot {
  return {
    id: 'l-1',
    name: 'Lote Ejemplo 12',
    stoneType: 'Esmeralda',
    description: '',
    purchaseDate: DAY,
    supplier: 'Proveedor Ejemplo',
    supplierId: null,
    carats: 5,
    quantity: 4,
    purchaseValueCop: 6000000,
    partnerId: null,
    partnerName: '',
    myPercent: 100,
    onCredit: false,
    supplierPayments: [],
    cuttingBatches: [],
    internalUses: [],
    notes: '',
    sales: [],
    createdAt: '2026-07-15T09:00:00.000Z',
    updatedAt: '2026-07-15T09:00:00.000Z',
    ...overrides
  };
}

describe('cierre del día: qué entra en el reporte', () => {
  it('las compras y ventas de piedras se filtran por su fecha', () => {
    const lots = [
      lote({ id: 'l-hoy' }),
      lote({ id: 'l-ayer', purchaseDate: '2026-07-14' }),
      lote({
        id: 'l-viejo-con-venta-hoy',
        purchaseDate: '2026-07-01',
        sales: [
          { id: 'v-hoy', date: DAY, buyer: 'Comprador', carats: 1, quantity: 1, origin: 'bruto', valueCop: 2000000, productType: '', usdRate: null, buyerId: null, onCredit: false, dueDate: '', payments: [], method: 'Efectivo', receivedBy: 'Santiago', notes: '' },
          { id: 'v-ayer', date: '2026-07-14', buyer: '', carats: 1, quantity: 1, origin: 'bruto', valueCop: 900000, productType: '', usdRate: null, buyerId: null, onCredit: false, dueDate: '', payments: [], method: 'Efectivo', receivedBy: 'Santiago', notes: '' }
        ]
      })
    ];
    const report = buildDailyReport(DAY, [], lots);

    expect(report.stonePurchases.length).toBe(1);
    expect(report.stonePurchases[0].lotName).toBe('Lote Ejemplo 12');
    expect(report.stoneSales.length).toBe(1);
    expect(report.stoneSales[0].valueCop).toBe(2000000);
  });

  it('separa el resultado de una venta de piedras persona por persona y sin perder pesos', () => {
    const report = buildDailyReport(DAY, [], [
      lote({
        id: 'lote-varios-socios',
        purchaseDate: '2026-07-01',
        carats: 1,
        quantity: 1,
        purchaseValueCop: 3,
        partners: [
          { id: 'parte-ana', partnerId: 'socio-ana', partnerName: 'Ana', amountCop: 1 },
          { id: 'parte-beto', partnerId: 'socio-beto', partnerName: 'Beto', amountCop: 1 }
        ],
        sales: [
          {
            id: 'venta-impar',
            date: DAY,
            buyer: 'Comprador',
            carats: 1,
            quantity: 1,
            origin: 'bruto',
            valueCop: 104,
            productType: 'Esmeralda',
            usdRate: null,
            buyerId: null,
            onCredit: false,
            dueDate: '',
            payments: [],
            method: 'Efectivo',
            receivedBy: 'Santiago',
            notes: ''
          }
        ]
      })
    ]);
    const sale = report.stoneSales[0];

    expect(sale.profitCop).toBe(101);
    expect(sale.myProfitCop).toBe(35);
    expect(sale.partnerResults).toEqual([
      { partnerName: 'Ana', profitCop: 33 },
      { partnerName: 'Beto', profitCop: 33 }
    ]);
    expect(
      sale.myProfitCop +
        sale.partnerResults.reduce((total, partner) => total + partner.profitCop, 0)
    ).toBe(sale.profitCop);
  });

  it('los abonos y pagos del taller se filtran por su fecha', () => {
    const quote = sampleQuote({
      payments: [
        { id: 'p-hoy', amount: 1500000, date: DAY, receivedBy: 'Laura', method: 'Nequi', notes: '' },
        { id: 'p-ayer', amount: 500000, date: '2026-07-10', receivedBy: '', method: '', notes: '' }
      ],
      production: [
        {
          id: 'st-1',
          name: 'Fundición',
          status: 'lista',
          completedAt: DAY,
          cost: 300000,
          paid: true,
          paidAt: DAY,
          paidTo: 'Taller Ejemplo',
          paidBy: 'Responsable Ejemplo',
          notes: ''
        },
        {
          id: 'st-2',
          name: 'Pulido',
          status: 'pendiente',
          completedAt: '',
          cost: 120000,
          paid: false,
          paidAt: DAY,
          paidTo: '',
          paidBy: '',
          notes: ''
        }
      ]
    });
    const report = buildDailyReport(DAY, [quote], []);

    expect(report.payments.length).toBe(1);
    expect(report.payments[0].amount).toBe(1500000);
    // La etapa sin pagar no cuenta aunque tenga fecha.
    expect(report.workshopPayments.length).toBe(1);
    expect(report.workshopPayments[0].stageName).toBe('Fundición');
  });

  it('el anticipo entra como pago recibido en su fecha real', () => {
    const quote = sampleQuote({
      date: '2026-07-01',
      deposit: 2000000,
      depositDate: DAY,
      payments: [],
      production: []
    });
    const report = buildDailyReport(DAY, [quote], []);

    expect(report.payments).toHaveLength(1);
    expect(report.payments[0]).toMatchObject({ kind: 'anticipo', amount: 2000000 });
    expect(report.totals.paymentsReceived).toBe(2000000);
    expect(report.totals.cashIn).toBe(2000000);
  });

  it('un anticipo antiguo sin fecha reduce la deuda actual pero no inventa una entrada de caja', () => {
    const quote = sampleQuote({
      status: 'aprobada',
      date: '2026-07-01',
      deposit: 2000000,
      depositDate: '',
      payments: [],
      production: []
    });
    const report = buildDailyReport(DAY, [quote], []);
    const total = calculateQuote(quoteToCalcInput(quote)).total;

    expect(report.payments).toEqual([]);
    expect(report.totals.cashIn).toBe(0);
    expect(report.totals.clientsOwe).toBe(total - 2000000);
    expect(report.isEmpty).toBe(true);
  });

  it('las cotizaciones creadas usan la fecha de emisión y las aprobadas usan approvedAt', () => {
    const creadaHoy = sampleQuote({ id: 'q-1', number: 'ED-1', date: DAY, payments: [], production: [] });
    const aprobadaHoy = sampleQuote({
      id: 'q-2',
      number: 'ED-2',
      date: '2026-07-01',
      status: 'aprobada',
      approvedAt: '2026-07-15T14:30:00.000Z',
      payments: [],
      production: []
    });
    const aprobadaVieja = sampleQuote({
      id: 'q-3',
      number: 'ED-3',
      date: '2026-07-01',
      status: 'aprobada',
      approvedAt: '',
      payments: [],
      production: []
    });
    const report = buildDailyReport(DAY, [creadaHoy, aprobadaHoy, aprobadaVieja], []);

    expect(report.quotesCreated.map((q) => q.number)).toEqual(['ED-1']);
    expect(report.quotesApproved.map((q) => q.number)).toEqual(['ED-2']);
    const total = calculateQuote(quoteToCalcInput(aprobadaHoy)).total;
    expect(report.quotesApproved[0].total).toBe(total);
  });

  it('un approvedAt inválido o vacío nunca entra al reporte', () => {
    const rara = sampleQuote({ approvedAt: 'no-es-fecha', date: '2026-07-01', payments: [], production: [] });
    const report = buildDailyReport(DAY, [rara], []);
    expect(report.quotesApproved).toEqual([]);
  });
});

describe('gastos en los cierres (B1)', () => {
  const expense: Expense = {
    id: 'g-1',
    date: DAY,
    concept: 'Publicidad de feria',
    category: 'Publicidad',
    amountCop: 450001,
    usdRate: null,
    method: 'Transferencia',
    paidBy: 'Santiago',
    partnerId: 'soc-1',
    partnerName: 'Socio Emerald',
    myPercent: 60,
    notes: 'Stand principal',
    createdAt: '2026-07-15T09:00:00.000Z',
    updatedAt: '2026-07-15T09:00:00.000Z'
  };

  it('con cero gastos devuelve exactamente el reporte y el dinero anteriores', () => {
    const previousDaily = buildDailyReport(DAY, [], [lote()]);
    const withExplicitZero = buildDailyReport(DAY, [], [lote()], [], []);
    expect(withExplicitZero).toEqual(previousDaily);
    expect(withExplicitZero.totals).toMatchObject({
      cashIn: 0,
      cashOut: 6000000,
      net: -6000000,
      expensesPaid: 0
    });

    const previousMonthly = buildMonthlyReport('2026-07', [], [lote()]);
    expect(buildMonthlyReport('2026-07', [], [lote()], [], [])).toEqual(previousMonthly);
  });

  it('el gasto sale de caja solo en el día y mes en que se pagó', () => {
    const day = buildDailyReport(DAY, [], [], [], [expense]);
    expect(day.expenses).toHaveLength(1);
    expect(day.totals).toMatchObject({ cashIn: 0, cashOut: 450001, net: -450001 });
    expect(day.expenses[0]).toMatchObject({ myAmountCop: 270001, partnerAmountCop: 180000 });

    expect(buildDailyReport('2026-07-16', [], [], [], [expense]).expenses).toEqual([]);
    expect(buildMonthlyReport('2026-07', [], [], [], [expense]).totals.expensesPaid).toBe(450001);
    expect(buildMonthlyReport('2026-08', [], [], [], [expense]).totals.expensesPaid).toBe(0);
  });

  it('el cierre dice quién puso cuánto, persona por persona', () => {
    const compartido = {
      ...expense,
      id: 'g-varios',
      amountCop: 1000000,
      partners: [
        { id: 'p-1', partnerId: 'soc-1', partnerName: 'Ana', amountCop: 300000 },
        { id: 'p-2', partnerId: 'soc-2', partnerName: 'Beto', amountCop: 200000 }
      ]
    };
    const day = buildDailyReport(DAY, [], [], [], [compartido]);
    expect(day.expenses[0].partners).toEqual([
      { partnerName: 'Ana', amountCop: 300000 },
      { partnerName: 'Beto', amountCop: 200000 }
    ]);
    // Lo propio se deriva: el millón menos lo que pusieron los dos.
    expect(day.expenses[0].myAmountCop).toBe(500000);
  });

  it('un gasto sin socios no inventa reparto', () => {
    const propio = { ...expense, id: 'g-propio', partnerId: null, partnerName: '', myPercent: 100 };
    expect(buildDailyReport(DAY, [], [], [], [propio]).expenses[0].partners).toEqual([]);
  });

  it('un mes que solo tiene gastos aparece en el historial mensual', () => {
    expect(listMonthlySummaries([], [], [], [expense])).toEqual([
      { month: '2026-07', cashIn: 0, cashOut: 450001, net: -450001 }
    ]);
  });

  it('el PDF interno conserva trazabilidad del gasto y su sociedad', () => {
    const report = buildDailyReport(DAY, [], [], [], [expense]);
    const content = buildDailyReportPdfContent(report, sampleSettings());
    const text = contentToPlainText(content);
    expect(content.internal).toBe(true);
    expect(text).toContain('Publicidad de feria');
    expect(text).toContain('Transferencia');
    expect(text).toContain('Santiago');
    expect(text).toContain('Socio Emerald');
  });
});

describe('cierre del día: totales y día vacío', () => {
  it('suma entradas, salidas y calcula el neto', () => {
    const lots = [
      lote({ id: 'l-compra', purchaseValueCop: 6000000 }),
      lote({
        id: 'l-venta',
        purchaseDate: '2026-07-01',
        sales: [{ id: 'v-1', date: DAY, buyer: '', carats: 1, quantity: 1, origin: 'bruto', valueCop: 2500000, productType: '', usdRate: null, buyerId: null, onCredit: false, dueDate: '', payments: [], method: 'Efectivo', receivedBy: 'Santiago', notes: '' }]
      })
    ];
    const quote = sampleQuote({
      date: '2026-07-01',
      payments: [{ id: 'p-1', amount: 1000000, date: DAY, receivedBy: '', method: '', notes: '' }],
      production: [
        {
          id: 'st-1',
          name: 'Engaste',
          status: 'lista',
          completedAt: DAY,
          cost: 400000,
          paid: true,
          paidAt: DAY,
          paidTo: '',
          paidBy: '',
          notes: ''
        }
      ]
    });
    const { totals } = buildDailyReport(DAY, [quote], lots);

    expect(totals.cashIn).toBe(2500000 + 1000000);
    expect(totals.cashOut).toBe(6000000 + 400000);
    expect(totals.net).toBe(3500000 - 6400000);
  });

  it('un pago del saldo entra una sola vez al cierre diario y mensual aunque se reintente', () => {
    const quote = sampleQuote({
      status: 'aprobada',
      date: '2026-07-01',
      deposit: 0,
      payments: [],
      production: []
    });
    const total = calculateQuote(quoteToCalcInput(quote)).total;
    const candidate = {
      id: 'pago-saldo-unico',
      amount: 0,
      date: DAY,
      receivedBy: '',
      method: '',
      notes: 'Pago del saldo pendiente'
    };

    const first = appendSettlementPayment(total, quote.deposit, quote.payments, candidate);
    const retried = appendSettlementPayment(total, quote.deposit, first.payments, candidate);
    const settledQuote = { ...quote, payments: retried.payments };
    const daily = buildDailyReport(DAY, [settledQuote], []);
    const monthly = buildMonthlyReport('2026-07', [settledQuote], []);

    expect(retried.payments).toHaveLength(1);
    expect(daily.payments.filter((payment) => payment.amount === total)).toHaveLength(1);
    expect(daily.totals.paymentsReceived).toBe(total);
    expect(monthly.payments.filter((payment) => payment.amount === total)).toHaveLength(1);
    expect(monthly.totals.paymentsReceived).toBe(total);
  });

  it('un día sin nada queda marcado como vacío', () => {
    const quote = sampleQuote({ date: '2026-07-01', payments: [], production: [] });
    const report = buildDailyReport(DAY, [quote], [lote({ purchaseDate: '2026-07-01' })]);
    expect(report.isEmpty).toBe(true);
    expect(report.totals.net).toBe(0);
  });
});

describe('PDF del cierre del día', () => {
  it('es interno, lo advierte y presenta el neto del día', () => {
    const report = buildDailyReport(DAY, [], [lote()]);
    const content = buildDailyReportPdfContent(report, sampleSettings());

    expect(content.internal).toBe(true);
    const text = contentToPlainText(content);
    expect(text).toContain('DOCUMENTO INTERNO — NO ENTREGAR AL CLIENTE');
    expect(text).toContain('CIERRE DEL DÍA');
    expect(text).toContain('Lote Ejemplo 12');
    expect(text).toContain('MOVIMIENTO NETO DEL DÍA');
    expect(content.quoteNumber).toBe('');
  });

  it('nombra al cliente del abono con su cotización', () => {
    const quote = sampleQuote({
      clientSnapshot: sampleClient({ name: 'Ana Torres' }),
      date: '2026-07-01',
      payments: [{ id: 'p-1', amount: 1000000, date: DAY, receivedBy: 'Laura', method: 'Nequi', notes: '' }],
      production: []
    });
    const text = contentToPlainText(
      buildDailyReportPdfContent(buildDailyReport(DAY, [quote], []), sampleSettings())
    );
    expect(text).toContain('Ana Torres');
    expect(text).toContain('recibió Laura');
  });

  it('un día vacío lo dice expresamente en vez de ir en blanco', () => {
    const text = contentToPlainText(
      buildDailyReportPdfContent(buildDailyReport(DAY, [], []), sampleSettings())
    );
    expect(text).toContain('Sin movimientos');
  });

  it('el PDF interno muestra el resultado de la venta separado por persona', () => {
    const sharedLot = lote({
      id: 'lote-pdf-socios',
      purchaseDate: '2026-07-01',
      carats: 1,
      quantity: 1,
      purchaseValueCop: 1_000_000,
      partners: [
        { id: 'parte-ana', partnerId: 'socio-ana', partnerName: 'Ana', amountCop: 300_000 },
        { id: 'parte-beto', partnerId: 'socio-beto', partnerName: 'Beto', amountCop: 200_000 }
      ],
      sales: [
        {
          id: 'venta-pdf-socios',
          date: DAY,
          buyer: 'Comprador',
          carats: 1,
          quantity: 1,
          origin: 'bruto',
          valueCop: 2_000_000,
          productType: 'Esmeralda',
          usdRate: null,
          buyerId: null,
          onCredit: false,
          dueDate: '',
          payments: [],
          method: 'Efectivo',
          receivedBy: 'Santiago',
          notes: ''
        }
      ]
    });
    const text = contentToPlainText(
      buildDailyReportPdfContent(buildDailyReport(DAY, [], [sharedLot]), sampleSettings())
    );

    expect(text).toContain('Resultado por persona');
    expect(text).toContain(`tú ${formatCOP(500_000)}`);
    expect(text).toContain(`Ana ${formatCOP(300_000)}`);
    expect(text).toContain(`Beto ${formatCOP(200_000)}`);
  });
});

describe('caja honesta con crédito (C5)', () => {
  it('una compra a crédito no sale de caja; los pagos al proveedor sí', () => {
    const lots = [
      lote({ id: 'l-contado', purchaseValueCop: 1000000 }),
      lote({
        id: 'l-credito',
        onCredit: true,
        purchaseValueCop: 4000000,
        supplierPayments: [
          { id: 'sp-hoy', date: DAY, amount: 1500000, notes: '' },
          { id: 'sp-otro-dia', date: '2026-07-10', amount: 500000, notes: '' }
        ]
      })
    ];
    const report = buildDailyReport(DAY, [], lots);

    expect(report.totals.stonesPurchasedCash).toBe(1000000);
    expect(report.totals.stonesPurchasedCredit).toBe(4000000);
    expect(report.totals.supplierPaymentsPaid).toBe(1500000);
    expect(report.totals.cashOut).toBe(1000000 + 1500000);
    expect(report.supplierPayments.length).toBe(1);
    expect(report.totals.supplierDebt).toBe(4000000 - 2000000);
  });

  it('un día solo con pago a proveedor no es un día vacío', () => {
    const lots = [
      lote({
        id: 'l-credito',
        purchaseDate: '2026-07-01',
        onCredit: true,
        supplierPayments: [{ id: 'sp-1', date: DAY, amount: 1000000, notes: '' }]
      })
    ];
    const report = buildDailyReport(DAY, [], lots);
    expect(report.isEmpty).toBe(false);
    expect(report.totals.cashOut).toBe(1000000);
  });

  it('calcula lo que los clientes deben en piezas aprobadas', () => {
    const aprobada = sampleQuote({
      status: 'aprobada',
      date: '2026-07-01',
      production: [],
      payments: [{ id: 'p-1', amount: 1000000, date: '2026-07-01', receivedBy: '', method: '', notes: '' }]
    });
    const report = buildDailyReport(DAY, [aprobada], []);
    const total = calculateQuote(quoteToCalcInput(aprobada)).total;
    expect(report.totals.clientsOwe).toBe(total - 3000000);
  });

  it('el PDF separa joyería de piedras y marca las compras a crédito', () => {
    const lots = [lote({ id: 'l-cr', onCredit: true })];
    const quote = sampleQuote({
      date: '2026-07-01',
      production: [],
      payments: [{ id: 'p-1', amount: 500000, date: DAY, receivedBy: '', method: '', notes: '' }]
    });
    const content = buildDailyReportPdfContent(buildDailyReport(DAY, [quote], lots), sampleSettings());
    const titles = content.sections.map((s) => s.title);
    expect(titles).toContain('Joyería · Pagos recibidos');
    expect(titles).toContain('Piedras · Compras');
    const text = contentToPlainText(content);
    expect(text).toContain('A CRÉDITO (no salió de caja)');
    expect(text).toContain('Debes a proveedores (a la fecha)');
  });
});

describe('cierre del mes (C6)', () => {
  const julio = [
    lote({ id: 'l-1', purchaseDate: '2026-07-02', purchaseValueCop: 1000000 }),
    lote({
      id: 'l-2',
      purchaseDate: '2026-06-20',
      sales: [{ id: 'v-jul', date: '2026-07-20', buyer: '', carats: 1, quantity: 1, origin: 'bruto', valueCop: 3000000, productType: '', usdRate: null, buyerId: null, onCredit: false, dueDate: '', payments: [], method: 'Efectivo', receivedBy: 'Santiago', notes: '' }]
    })
  ];

  it('agrupa todo el mes y respeta los límites', () => {
    const report = buildMonthlyReport('2026-07', [], julio);
    expect(report.stonePurchases.map((p) => p.lotName)).toEqual(['Lote Ejemplo 12']);
    expect(report.stoneSales.length).toBe(1);
    expect(report.totals.cashIn).toBe(3000000);
    expect(report.totals.cashOut).toBe(1000000);

    const junio = buildMonthlyReport('2026-06', [], julio);
    expect(junio.stonePurchases.length).toBe(1);
    expect(junio.stoneSales.length).toBe(0);
  });

  it('lista los meses con actividad del más reciente al más antiguo', () => {
    const summaries = listMonthlySummaries([], julio);
    expect(summaries.map((s) => s.month)).toEqual(['2026-07', '2026-06']);
    expect(summaries[0].net).toBe(3000000 - 1000000);
    expect(summaries[1].net).toBe(-6000000);
  });

  it('solo compara con meses realmente anteriores al seleccionado', () => {
    const summaries = [
      { month: '2026-08', cashIn: 8, cashOut: 0, net: 8 },
      { month: '2026-07', cashIn: 7, cashOut: 0, net: 7 },
      { month: '2026-06', cashIn: 6, cashOut: 0, net: 6 },
      { month: '2026-05', cashIn: 5, cashOut: 0, net: 5 }
    ];

    expect(previousMonthlySummaries('2026-07', summaries).map((s) => s.month)).toEqual([
      '2026-06',
      '2026-05'
    ]);
  });

  it('la fecha de un anticipo crea actividad en su mes, sin moverlo al mes de la cotización', () => {
    const quote = sampleQuote({
      date: '2026-05-10',
      deposit: 500000,
      depositDate: '2026-07-12',
      payments: [],
      production: []
    });
    const summaries = listMonthlySummaries([quote], []);
    const july = summaries.find((summary) => summary.month === '2026-07');

    expect(july?.cashIn).toBe(500000);
  });

  it('un mes sin movimientos conserva visibles las deudas vivas', () => {
    const oldCredit = lote({
      purchaseDate: '2026-05-10',
      purchaseValueCop: 6000000,
      onCredit: true,
      supplierPayments: [
        { id: 'p-old', date: '2026-06-01', amount: 1000000, notes: '' }
      ]
    });
    const oldApproved = sampleQuote({
      date: '2026-05-10',
      approvedAt: '2026-05-11T10:00:00.000Z',
      status: 'aprobada',
      deposit: 0,
      depositDate: '',
      payments: [],
      production: []
    });

    const report = buildMonthlyReport('2026-07', [oldApproved], [oldCredit]);
    expect(report.stonePurchases).toHaveLength(0);
    expect(report.stoneSales).toHaveLength(0);
    expect(report.payments).toHaveLength(0);
    expect(report.isEmpty).toBe(true);
    expect(report.totals.supplierDebt).toBe(5000000);
    expect(report.totals.clientsOwe).toBeGreaterThan(0);
  });

  it('formatea el mes en español', () => {
    expect(formatMonthCO('2026-07').toLowerCase()).toContain('julio de 2026');
  });

  it('el PDF del mes compara con los meses anteriores', () => {
    const report = buildMonthlyReport('2026-07', [], julio);
    const summaries = listMonthlySummaries([], julio);
    const content = buildMonthlyReportPdfContent(report, summaries, sampleSettings());
    const text = contentToPlainText(content);
    expect(text).toContain('CIERRE DEL MES');
    expect(text).toContain('Actividad del mes');
    expect(text).toContain('Comparación con meses anteriores');
    expect(text.toLowerCase()).toContain('junio de 2026');
    expect(text).toContain('MOVIMIENTO NETO DEL MES');
  });

  it('el PDF nunca presenta un mes futuro como si fuera anterior', () => {
    const report = buildMonthlyReport('2026-07', [], julio);
    const summaries = [
      { month: '2026-08', cashIn: 1, cashOut: 0, net: 1 },
      ...listMonthlySummaries([], julio)
    ];
    const text = contentToPlainText(buildMonthlyReportPdfContent(report, summaries, sampleSettings()));

    expect(text.toLowerCase()).not.toContain('agosto de 2026');
    expect(text.toLowerCase()).toContain('junio de 2026');
  });
});
