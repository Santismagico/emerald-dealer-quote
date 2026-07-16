import { describe, expect, it } from 'vitest';
import { sampleClient, sampleQuote, sampleSettings } from '../test/fixtures';
import type { StoneLot } from '../types';
import { calculateQuote, quoteToCalcInput } from '../calc/engine';
import { contentToPlainText } from './pdfContent';
import { buildDailyReport, buildDailyReportPdfContent } from './dailyReport';

const DAY = '2026-07-15';

function lote(overrides: Partial<StoneLot> = {}): StoneLot {
  return {
    id: 'l-1',
    name: 'Muzo 12',
    stoneType: 'Esmeralda',
    description: '',
    purchaseDate: DAY,
    supplier: 'Proveedor Muzo',
    supplierId: null,
    carats: 5,
    quantity: 4,
    purchaseValueCop: 6000000,
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
          { id: 'v-hoy', date: DAY, buyer: 'Comprador', carats: 1, quantity: 1, valueCop: 2000000, notes: '' },
          { id: 'v-ayer', date: '2026-07-14', buyer: '', carats: 1, quantity: 1, valueCop: 900000, notes: '' }
        ]
      })
    ];
    const report = buildDailyReport(DAY, [], lots);

    expect(report.stonePurchases.length).toBe(1);
    expect(report.stonePurchases[0].lotName).toBe('Muzo 12');
    expect(report.stoneSales.length).toBe(1);
    expect(report.stoneSales[0].valueCop).toBe(2000000);
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
          paidTo: 'Taller Ramírez',
          paidBy: 'Santiago',
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

describe('cierre del día: totales y día vacío', () => {
  it('suma entradas, salidas y calcula el neto', () => {
    const lots = [
      lote({ id: 'l-compra', purchaseValueCop: 6000000 }),
      lote({
        id: 'l-venta',
        purchaseDate: '2026-07-01',
        sales: [{ id: 'v-1', date: DAY, buyer: '', carats: 1, quantity: 1, valueCop: 2500000, notes: '' }]
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
    expect(text).toContain('Muzo 12');
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
});
