import { describe, expect, it } from 'vitest';
import type { Cell, CellObject, SheetData } from 'write-excel-file/browser';
import { buildDailyReport } from './dailyReport';
import {
  buildCloseExcelWorkbook,
  buildExcelBlob,
  buildSalesExcelWorkbook,
  calculateColumnWidths
} from './excelExport';
import { buildSalesAnalytics } from './salesAnalytics';
import { emptyStoneLot, emptyStoneSale } from './stones';

function valueOf(cell: Cell): unknown {
  if (cell === null || cell === undefined) return cell;
  if (cell instanceof Date || typeof cell !== 'object') return cell;
  return 'value' in cell ? cell.value : cell;
}

function objectCells(data: SheetData) {
  return data.flat().filter(
    (cell): cell is CellObject =>
      Boolean(cell && typeof cell === 'object' && !(cell instanceof Date) && 'value' in cell)
  );
}

function testLot() {
  return {
    ...emptyStoneLot('2026-08-04', '2026-08-04T12:00:00.000Z'),
    id: 'lot-excel',
    name: 'Lote Excel',
    stoneType: 'Esmeralda niño',
    carats: 2.5,
    quantity: 2,
    purchaseValueCop: 500_000,
    onCredit: false,
    sales: [
      {
        ...emptyStoneSale('2026-08-04', 4_000),
        id: 'sale-excel',
        buyer: 'José',
        carats: 1.25,
        quantity: 1,
        valueCop: 200_000,
        onCredit: true,
        dueDate: '2026-08-20',
        productType: 'Anillo único'
      }
    ]
  };
}

describe('C1: Excel real con formato aprobado', () => {
  it('construye el cierre con título, fecha real, encabezado fijo, detalle y números editables', () => {
    const report = buildDailyReport('2026-08-04', [], [testLot()], [], []);
    const workbook = buildCloseExcelWorkbook(report, {
      jewelryName: 'Joyería Ñandú',
      mode: 'dia',
      period: '2026-08-04',
      periodLabel: '4 de agosto de 2026'
    });

    expect(workbook.sheets.map((sheet) => sheet.sheet)).toEqual(['Resumen', 'Detalle']);
    expect(workbook.sheets[0].stickyRowsCount).toBe(6);
    expect(valueOf(workbook.sheets[0].data[0][0])).toBe('CIERRE DEL DÍA · Joyería Ñandú');
    expect(valueOf(workbook.sheets[0].data[1][1])).toBeInstanceOf(Date);
    expect(valueOf(workbook.sheets[0].data[2][1])).toBe('Interno · no entregar al cliente');

    const summaryCells = objectCells(workbook.sheets[0].data);
    const negative = summaryCells.find((cell) => valueOf(cell) === -500_000);
    expect(negative).toMatchObject({ type: Number, textColor: '#B91C1C' });
    expect(negative?.format).toContain('#,##0');

    const detailCells = objectCells(workbook.sheets[1].data);
    expect(detailCells.some((cell) => valueOf(cell) === 2.5 && cell.type === Number)).toBe(true);
    expect(workbook.sheets[1].data.flat().map(valueOf).join(' ')).toContain('Esmeralda niño');
    expect(workbook.sheets[1].columns.every((column) => column.width >= 11)).toBe(true);
  });

  it('genera un contenedor .xlsx real bajo demanda', async () => {
    const report = buildDailyReport('2026-08-04', [], [testLot()], [], []);
    const workbook = buildCloseExcelWorkbook(report, {
      jewelryName: 'Joyería Ñandú',
      mode: 'dia',
      period: '2026-08-04',
      periodLabel: '4 de agosto de 2026'
    });

    const blob = await buildExcelBlob(workbook);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(bytes.byteLength).toBeGreaterThan(3_000);
  });

  it('mantiene fechas, dinero, pérdida, tildes y filtros en panel y consolidado', () => {
    const analytics = buildSalesAnalytics({
      period: 'dia',
      anchorDate: '2026-08-04',
      stoneLots: [testLot()]
    });
    const panel = buildSalesExcelWorkbook(analytics, {
      jewelryName: 'Joyería Ñandú',
      periodLabel: '4 de agosto de 2026'
    });

    expect(panel.sheets.map((sheet) => sheet.sheet)).toEqual(['Resumen', 'Detalle']);
    const detailCells = objectCells(panel.sheets[1].data);
    expect(detailCells.some((cell) => valueOf(cell) instanceof Date && cell.type === Date)).toBe(true);
    expect(panel.sheets[1].data.flat().map(valueOf)).toContain('Anillo único');
    const loss = detailCells.find((cell) => valueOf(cell) === -50_000);
    expect(loss).toMatchObject({ type: Number, textColor: '#B91C1C' });

    const societyFilter = analytics.filters.societies.find((option) => option.label === 'Propio')?.value;
    const productTypeFilter = analytics.filters.productTypes.find(
      (option) => option.label === 'Anillo único'
    )?.value;
    const filtered = buildSalesAnalytics({
      period: 'dia',
      anchorDate: '2026-08-04',
      stoneLots: [testLot()],
      societyFilter,
      productTypeFilter
    });
    const consolidated = buildSalesExcelWorkbook(filtered, {
      jewelryName: 'Joyería Ñandú',
      periodLabel: '4 de agosto de 2026',
      consolidated: true
    });
    const summaryValues = consolidated.sheets[0].data.flat().map(valueOf);
    expect(summaryValues).toContain('CONSOLIDADO DE VENTAS · Joyería Ñandú');
    expect(summaryValues).toContain('Anillo único');
  });

  it('calcula los anchos según el contenido y aplica límites legibles', () => {
    const widths = calculateColumnWidths([
      ['Corto', 'Una descripción bastante más larga que el encabezado'],
      ['x', 1_234_567]
    ]);

    expect(widths[1].width).toBeGreaterThan(widths[0].width);
    expect(widths[0].width).toBeGreaterThanOrEqual(11);
    expect(widths[1].width).toBeLessThanOrEqual(44);
  });
});
