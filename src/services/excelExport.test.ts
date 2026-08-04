import { describe, expect, it } from 'vitest';
import { buildDailyReport } from './dailyReport';
import { buildExcelCsv, buildCloseExcelCsv, buildSalesExcelCsv } from './excelExport';
import { buildSalesAnalytics } from './salesAnalytics';
import { emptyStoneLot, emptyStoneSale } from './stones';

describe('E2: archivos editables para Excel en español', () => {
  it('usa BOM UTF-8, punto y coma, CRLF y protege texto con separadores', () => {
    const csv = buildExcelCsv([
      ['Descripción', 'Valor COP'],
      ['Talla; "pera"', 1_234_567],
      ['Niño', null]
    ]);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('Descripción;Valor COP\r\n');
    expect(csv).toContain('"Talla; ""pera""";1234567\r\n');
    expect(csv).toContain('Niño;\r\n');
    expect(csv).not.toContain('$');
    expect(csv).not.toContain('1.234.567');
  });

  it('genera el cierre con números editables y conserva el detalle a crédito fuera de caja', () => {
    const lot = {
      ...emptyStoneLot('2026-08-04', '2026-08-04T12:00:00.000Z'),
      id: 'lot-excel',
      name: 'Lote Excel',
      carats: 2,
      quantity: 2,
      purchaseValueCop: 500_000,
      onCredit: true,
      sales: [
        {
          ...emptyStoneSale('2026-08-04', 4_000),
          id: 'sale-excel',
          buyer: 'José',
          carats: 1,
          quantity: 1,
          valueCop: 900_000,
          onCredit: true,
          dueDate: '2026-08-20'
        }
      ]
    };
    const report = buildDailyReport('2026-08-04', [], [lot], [], []);
    const csv = buildCloseExcelCsv(report, '4 de agosto de 2026');

    expect(csv).toContain('CIERRE DEL NEGOCIO');
    expect(csv).toContain('Lote Excel · José · A crédito;;;900000');
    expect(csv).toContain('Movimiento neto');
  });

  it('reutiliza el mismo formato para ventas y ganancias', () => {
    const analytics = buildSalesAnalytics({
      period: 'dia',
      anchorDate: '2026-08-04',
      stoneLots: []
    });
    const csv = buildSalesExcelCsv(analytics, '4 de agosto de 2026');

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('VENTAS Y GANANCIAS');
    expect(csv).toContain('Vendido COP;0');
    expect(csv).toContain('Tasa USD/COP');
  });
});
