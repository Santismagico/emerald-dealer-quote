import { describe, expect, it } from 'vitest';
import type { Cell, CellObject, SheetData } from 'write-excel-file/browser';
import type { FundContribution } from '../types';
import { buildDailyReport } from './dailyReport';
import { emptyExpense } from './expenses';
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

function partneredTestLot() {
  return {
    ...testLot(),
    partners: [
      { id: 'partner-ana', partnerId: 'ana', partnerName: 'Ana Restrepo', amountCop: 200_000 },
      { id: 'partner-beto', partnerId: 'beto', partnerName: 'Beto Cárdenas', amountCop: 100_000 }
    ]
  };
}

function testFund(): FundContribution[] {
  return [
    {
      id: 'fund-ana',
      personId: 'ana',
      personName: 'Ana Restrepo',
      date: '2026-06-01',
      amountCop: 1_000_000,
      returnKind: 'mensual',
      monthlyRatePercent: 2,
      agreedTotalCop: null,
      dueDate: '2026-09-01',
      payments: [
        {
          id: 'payment-ana',
          date: '2026-08-01',
          amountCop: 100_000,
          kind: 'capital',
          notes: 'Primer abono'
        }
      ],
      notes: 'Aporte mensual',
      createdAt: '2026-06-01T12:00:00.000Z',
      updatedAt: '2026-08-01T12:00:00.000Z'
    },
    {
      id: 'fund-beto',
      personId: 'beto',
      personName: 'Beto Cárdenas',
      date: '2026-07-01',
      amountCop: 500_000,
      returnKind: 'fijo',
      monthlyRatePercent: null,
      agreedTotalCop: 550_000,
      dueDate: '2026-08-01',
      payments: [],
      notes: 'Total fijo',
      createdAt: '2026-07-01T12:00:00.000Z',
      updatedAt: '2026-07-01T12:00:00.000Z'
    }
  ];
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

  it('separa el resultado por socio y añade la hoja completa del fondo en los cierres', () => {
    const report = buildDailyReport('2026-08-04', [], [partneredTestLot()], [], []);
    const workbook = buildCloseExcelWorkbook(report, {
      jewelryName: 'Joyería Ñandú',
      mode: 'dia',
      period: '2026-08-04',
      periodLabel: '4 de agosto de 2026',
      fundContributions: testFund(),
      fundAsOfISO: '2026-08-10'
    });

    expect(workbook.sheets.map((sheet) => sheet.sheet)).toEqual([
      'Resumen',
      'Detalle',
      'Socios',
      'Fondo'
    ]);
    const partnerValues = workbook.sheets[2].data.flat().map(valueOf);
    expect(partnerValues).toContain('Tú');
    expect(partnerValues).toContain('Ana Restrepo');
    expect(partnerValues).toContain('Beto Cárdenas');
    expect(partnerValues).toContain(-20_000);
    expect(partnerValues).toContain(-10_000);
    const saleRow = workbook.sheets[2].data.find((row) => valueOf(row[0]) === 'Lote Excel');
    expect(saleRow?.map(valueOf)).toEqual([
      'Lote Excel',
      'Ganancia de la venta',
      -50_000,
      -20_000,
      -20_000,
      -10_000
    ]);

    const fundValues = workbook.sheets[3].data.flat().map(valueOf);
    expect(fundValues).toContain('FONDO POR PERSONA');
    expect(fundValues).toContain('HISTORIAL DE PAGOS');
    expect(fundValues).toContain('Vencido');
    expect(fundValues).toContain(940_000);
    expect(fundValues).toContain(550_000);
    expect(fundValues).toContain('Primer abono');
    const anaRow = workbook.sheets[3].data.find((row) => valueOf(row[0]) === 'Ana Restrepo');
    expect(anaRow?.slice(1, 10).map(valueOf)).toEqual([
      1,
      1,
      1_000_000,
      40_000,
      100_000,
      0,
      900_000,
      40_000,
      940_000
    ]);
  });

  it('lleva a columnas separadas la ganancia de cada socio en panel y consolidado', () => {
    const analytics = buildSalesAnalytics({
      period: 'dia',
      anchorDate: '2026-08-04',
      stoneLots: [partneredTestLot()]
    });
    const workbook = buildSalesExcelWorkbook(analytics, {
      jewelryName: 'Joyería Ñandú',
      periodLabel: '4 de agosto de 2026',
      consolidated: true,
      fundContributions: testFund(),
      fundAsOfISO: '2026-08-10'
    });

    expect(workbook.sheets.map((sheet) => sheet.sheet)).toEqual([
      'Resumen',
      'Detalle',
      'Socios',
      'Fondo'
    ]);
    const partnerValues = workbook.sheets[2].data.flat().map(valueOf);
    expect(partnerValues).toContain('Ganancia total COP');
    expect(partnerValues).toContain('Tú');
    expect(partnerValues).toContain('Ana Restrepo');
    expect(partnerValues).toContain('Beto Cárdenas');
    expect(partnerValues).toContain(-20_000);
    expect(partnerValues).toContain(-10_000);
    const saleRow = workbook.sheets[2].data.find((row) => valueOf(row[1]) === 'Anillo único');
    expect(saleRow?.slice(1).map(valueOf)).toEqual([
      'Anillo único',
      -50_000,
      -20_000,
      -20_000,
      -10_000
    ]);
    expect(workbook.sheets[1].data.flat().map(valueOf)).toContain('Ana Restrepo · Beto Cárdenas');
  });

  it('separa también lo que puso cada socio en un gasto compartido', () => {
    const expense = {
      ...emptyExpense('2026-08-04', '2026-08-04T12:00:00.000Z'),
      concept: 'Arriendo compartido',
      amountCop: 1_000_000,
      method: 'Transferencia',
      paidBy: 'Santiago',
      partners: [
        { id: 'expense-ana', partnerId: 'ana', partnerName: 'Ana Restrepo', amountCop: 300_000 },
        { id: 'expense-beto', partnerId: 'beto', partnerName: 'Beto Cárdenas', amountCop: 200_000 }
      ]
    };
    const report = buildDailyReport('2026-08-04', [], [], [], [expense]);
    const workbook = buildCloseExcelWorkbook(report, {
      jewelryName: 'Emerald Dealer',
      mode: 'dia',
      period: '2026-08-04',
      periodLabel: '4 de agosto de 2026'
    });

    expect(workbook.sheets.map((sheet) => sheet.sheet)).toEqual(['Resumen', 'Detalle', 'Socios']);
    const expenseRow = workbook.sheets[2].data.find(
      (row) => valueOf(row[0]) === 'Arriendo compartido'
    );
    expect(expenseRow?.map(valueOf)).toEqual([
      'Arriendo compartido',
      'Aporte al gasto',
      1_000_000,
      500_000,
      300_000,
      200_000
    ]);
  });

  it('incluye la hoja Fondo aunque todavía no haya aportes', () => {
    const report = buildDailyReport('2026-08-04', [], [testLot()], [], []);
    const workbook = buildCloseExcelWorkbook(report, {
      jewelryName: 'Emerald Dealer',
      mode: 'dia',
      period: '2026-08-04',
      periodLabel: '4 de agosto de 2026',
      fundContributions: [],
      fundAsOfISO: '2026-08-10'
    });

    expect(workbook.sheets.map((sheet) => sheet.sheet)).toEqual(['Resumen', 'Detalle', 'Fondo']);
    expect(workbook.sheets[2].data.flat().map(valueOf)).toContain('Sin aportes registrados');
  });

  it('mantiene separadas a dos personas distintas aunque tengan el mismo nombre', () => {
    const lot = {
      ...testLot(),
      partners: [
        { id: 'ana-1', partnerId: 'ana-1', partnerName: 'Ana', amountCop: 200_000 },
        { id: 'ana-2', partnerId: 'ana-2', partnerName: 'Ana', amountCop: 100_000 }
      ]
    };
    const report = buildDailyReport('2026-08-04', [], [lot], [], []);
    const workbook = buildCloseExcelWorkbook(report, {
      jewelryName: 'Emerald Dealer',
      mode: 'dia',
      period: '2026-08-04',
      periodLabel: '4 de agosto de 2026'
    });

    const partnerSheet = workbook.sheets.find((sheet) => sheet.sheet === 'Socios');
    expect(partnerSheet?.data.flat().map(valueOf)).toContain('Ana (1)');
    expect(partnerSheet?.data.flat().map(valueOf)).toContain('Ana (2)');
    const saleRow = partnerSheet?.data.find((row) => valueOf(row[0]) === 'Lote Excel');
    expect(saleRow?.slice(2).map(valueOf)).toEqual([-50_000, -20_000, -20_000, -10_000]);
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
