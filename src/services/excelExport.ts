import type { Cell, Row, SheetData } from 'write-excel-file/browser';
import type { FundContribution } from '../types';
import type { BusinessReport } from './dailyReport';
import { contributionBalance, fundByPerson, fundTotals } from './fund';
import { splitByContribution } from './partnership';
import type { SalesAnalytics } from './salesAnalytics';

const EMERALD = '#0F5B46';
const EMERALD_LIGHT = '#ECFDF5';
const WHITE = '#FFFFFF';
const GRAY_DARK = '#374151';
const GRAY = '#E5E7EB';
const GRAY_LIGHT = '#F3F4F6';
const GRAY_MUTED = '#6B7280';
const RED = '#B91C1C';

const COP_FORMAT = '"$" #,##0;[Red]-"$" #,##0';
const USD_FORMAT = '"US$" #,##0.00;[Red]-"US$" #,##0.00';
const DECIMAL_FORMAT = '#,##0.00';
const DATE_FORMAT = 'dd/mm/yyyy';

export interface ExcelSheetDefinition {
  data: SheetData;
  sheet: string;
  columns: Array<{ width: number }>;
  stickyRowsCount: number;
  showGridLines: false;
  dateFormat: string;
  orientation?: 'landscape';
}

export interface ExcelWorkbookDefinition {
  sheets: ExcelSheetDefinition[];
}

interface FundWorkbookOptions {
  /** Si se entrega la lista, el libro incluye siempre la hoja Fondo, incluso vacía. */
  fundContributions?: readonly FundContribution[];
  /** Fecha de la foto del fondo. No se toma del reloj dentro de este servicio puro. */
  fundAsOfISO?: string;
}

export interface CloseWorkbookOptions extends FundWorkbookOptions {
  jewelryName: string;
  mode: 'dia' | 'mes';
  period: string;
  periodLabel: string;
}

export interface SalesWorkbookOptions extends FundWorkbookOptions {
  jewelryName: string;
  periodLabel: string;
  consolidated?: boolean;
}

interface CloseDetailLine {
  section: string;
  concept: string;
  detail: string;
  carats?: number;
  quantity?: number;
  cashIn?: number;
  cashOut?: number;
  value?: number;
}

function textCell(value: string, options: Partial<Exclude<Cell, string | number | boolean | Date | null | undefined>> = {}): Cell {
  return { value, type: String, ...options };
}

function numberCell(
  value: number | null | undefined,
  format: string,
  options: Partial<Exclude<Cell, string | number | boolean | Date | null | undefined>> = {}
): Cell {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return {
    value,
    type: Number,
    format,
    align: 'right',
    ...(value < 0 ? { textColor: RED } : {}),
    ...options
  };
}

function moneyCell(value: number | null | undefined): Cell {
  return numberCell(value, COP_FORMAT);
}

function usdCell(value: number | null | undefined): Cell {
  return numberCell(value, USD_FORMAT);
}

function decimalCell(value: number | null | undefined): Cell {
  return numberCell(value, DECIMAL_FORMAT);
}

function dateCell(value: string, format = DATE_FORMAT): Cell {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value);
  if (!match) return textCell(value);
  return {
    value: new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3] ?? 1), 12)),
    type: Date,
    format
  };
}

function spanRow(cell: Cell, columns: number): Row {
  return [cell, ...Array<Cell>(Math.max(0, columns - 1)).fill(null)];
}

function titleRow(title: string, columns: number): Row {
  return spanRow(
    textCell(title, {
      columnSpan: columns,
      backgroundColor: EMERALD,
      textColor: WHITE,
      fontWeight: 'bold',
      fontSize: 15,
      height: 28,
      alignVertical: 'center'
    }),
    columns
  );
}

function metadataRows(
  title: string,
  columns: number,
  periodLabel: string,
  period: string,
  periodFormat = DATE_FORMAT
): Row[] {
  return [
    titleRow(title, columns),
    [
      textCell('Fecha', { backgroundColor: GRAY_DARK, textColor: WHITE, fontWeight: 'bold' }),
      dateCell(period, periodFormat),
      textCell(periodLabel, { textColor: GRAY_MUTED, columnSpan: Math.max(1, columns - 2) }),
      ...Array<Cell>(Math.max(0, columns - 3)).fill(null)
    ],
    [
      textCell('Documento', { backgroundColor: GRAY_LIGHT, textColor: GRAY_DARK, fontWeight: 'bold' }),
      textCell('Interno · no entregar al cliente', {
        backgroundColor: GRAY_LIGHT,
        textColor: GRAY_MUTED,
        columnSpan: Math.max(1, columns - 1)
      }),
      ...Array<Cell>(Math.max(0, columns - 2)).fill(null)
    ],
    Array<Cell>(columns).fill(null)
  ];
}

function sectionRow(label: string, columns: number): Row {
  return spanRow(
    textCell(label.toUpperCase(), {
      columnSpan: columns,
      backgroundColor: GRAY_LIGHT,
      textColor: EMERALD,
      fontWeight: 'bold',
      height: 24,
      alignVertical: 'center'
    }),
    columns
  );
}

function headerRow(labels: readonly string[]): Row {
  return labels.map((label) =>
    textCell(label, {
      backgroundColor: GRAY,
      textColor: GRAY_DARK,
      fontWeight: 'bold',
      bottomBorderColor: GRAY_DARK,
      bottomBorderStyle: 'thick',
      wrap: true,
      alignVertical: 'center'
    })
  );
}

function totalRow(label: string, values: readonly Cell[], columns: number): Row {
  const row: Row = [
    textCell(label, {
      fontWeight: 'bold',
      backgroundColor: EMERALD_LIGHT,
      topBorderColor: EMERALD,
      topBorderStyle: 'thick'
    }),
    ...values
  ];
  while (row.length < columns) row.push(null);
  return row.slice(0, columns).map((cell) => {
    if (cell && typeof cell === 'object' && !(cell instanceof Date)) {
      return {
        ...cell,
        fontWeight: 'bold',
        backgroundColor: EMERALD_LIGHT,
        topBorderColor: EMERALD,
        topBorderStyle: 'thick'
      } as Cell;
    }
    return cell;
  });
}

function rawCellValue(cell: Cell): string {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date) return '00/00/0000';
  if (typeof cell !== 'object') return String(cell);
  if (!('value' in cell)) return String(cell);
  const value = cell.value;
  if (value instanceof Date) return '00/00/0000';
  if (typeof value === 'number') return Math.abs(value).toLocaleString('es-CO');
  return value === null || value === undefined ? '' : String(value);
}

export function calculateColumnWidths(data: SheetData, minimum = 11, maximum = 44): Array<{ width: number }> {
  const count = data.reduce((max, row) => Math.max(max, row.length), 0);
  return Array.from({ length: count }, (_, index) => {
    const longest = data.reduce((max, row) => Math.max(max, rawCellValue(row[index]).length), 0);
    return { width: Math.min(maximum, Math.max(minimum, longest + 2)) };
  });
}

function makeSheet(
  sheet: string,
  data: SheetData,
  options: { landscape?: boolean } = {}
): ExcelSheetDefinition {
  return {
    data,
    sheet,
    columns: calculateColumnWidths(data),
    stickyRowsCount: 6,
    showGridLines: false,
    dateFormat: DATE_FORMAT,
    ...(options.landscape ? { orientation: 'landscape' as const } : {})
  };
}

function visiblePartnerName(value: string): string {
  return value.trim() || 'Socio sin nombre';
}

interface PartnerColumn {
  key: string;
  label: string;
}

function partnerKey(partner: { partnerId: string | null; partnerName: string }): string {
  return partner.partnerId
    ? `id:${partner.partnerId}`
    : `name:${visiblePartnerName(partner.partnerName).toLocaleLowerCase('es')}`;
}

function partnerColumnsFrom(
  partners: readonly { partnerId: string | null; partnerName: string }[]
): PartnerColumn[] {
  const byKey = new Map<string, string>();
  for (const partner of partners) {
    const key = partnerKey(partner);
    if (!byKey.has(key)) byKey.set(key, visiblePartnerName(partner.partnerName));
  }
  const sorted = [...byKey.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es') || a.key.localeCompare(b.key));
  const labelCounts = new Map<string, number>();
  for (const column of sorted) {
    const key = column.label.toLocaleLowerCase('es');
    labelCounts.set(key, (labelCounts.get(key) ?? 0) + 1);
  }
  const labelIndexes = new Map<string, number>();
  return sorted.map((column) => {
    const key = column.label.toLocaleLowerCase('es');
    if ((labelCounts.get(key) ?? 0) <= 1) return column;
    const index = (labelIndexes.get(key) ?? 0) + 1;
    labelIndexes.set(key, index);
    return { ...column, label: `${column.label} (${index})` };
  });
}

function closePartnerColumns(report: BusinessReport): PartnerColumn[] {
  return partnerColumnsFrom([
    ...report.stoneSales.flatMap((sale) => sale.partnerResults),
    ...report.expenses.flatMap((expense) => expense.partners)
  ]);
}

function amountForPartnerColumn(
  rows: readonly {
    partnerId: string | null;
    partnerName: string;
    amountCop?: number;
    profitCop?: number;
  }[],
  column: PartnerColumn
): number {
  return rows.reduce((sum, row) => {
    if (partnerKey(row) !== column.key) return sum;
    return sum + (row.amountCop ?? row.profitCop ?? 0);
  }, 0);
}

function buildClosePartnersData(
  report: BusinessReport,
  options: CloseWorkbookOptions,
  partnerColumns: readonly PartnerColumn[]
): SheetData {
  const columns = 4 + partnerColumns.length;
  const periodFormat = options.mode === 'mes' ? 'mmmm yyyy' : DATE_FORMAT;
  const data: SheetData = [
    ...metadataRows(closeTitle(options), columns, options.periodLabel, options.period, periodFormat)
  ];
  const headers = ['Movimiento', 'Tipo', 'Total COP', 'Tú', ...partnerColumns.map((item) => item.label)];

  if (report.stoneSales.length > 0) {
    data.push(sectionRow('Resultado de ventas de piedras', columns), headerRow(headers));
    for (const sale of report.stoneSales) {
      data.push([
        sale.lotName,
        'Ganancia de la venta',
        moneyCell(sale.profitCop),
        moneyCell(sale.myProfitCop),
        ...partnerColumns.map((column) => moneyCell(amountForPartnerColumn(sale.partnerResults, column)))
      ]);
    }
    data.push(
      totalRow(
        'TOTAL RESULTADO DE VENTAS',
        [
          null,
          moneyCell(report.stoneSales.reduce((sum, sale) => sum + sale.profitCop, 0)),
          moneyCell(report.stoneSales.reduce((sum, sale) => sum + sale.myProfitCop, 0)),
          ...partnerColumns.map((column) =>
            moneyCell(
              report.stoneSales.reduce(
                (sum, sale) => sum + amountForPartnerColumn(sale.partnerResults, column),
                0
              )
            )
          )
        ],
        columns
      )
    );
  }

  if (report.expenses.some((expense) => expense.partners.length > 0)) {
    if (data.length > 4) data.push(Array<Cell>(columns).fill(null));
    const sharedExpenses = report.expenses.filter((expense) => expense.partners.length > 0);
    data.push(sectionRow('Aportes a gastos compartidos', columns), headerRow(headers));
    for (const expense of sharedExpenses) {
      data.push([
        expense.concept,
        'Aporte al gasto',
        moneyCell(expense.amountCop),
        moneyCell(expense.myAmountCop),
        ...partnerColumns.map((column) => moneyCell(amountForPartnerColumn(expense.partners, column)))
      ]);
    }
    data.push(
      totalRow(
        'TOTAL GASTOS COMPARTIDOS',
        [
          null,
          moneyCell(sharedExpenses.reduce((sum, expense) => sum + expense.amountCop, 0)),
          moneyCell(sharedExpenses.reduce((sum, expense) => sum + expense.myAmountCop, 0)),
          ...partnerColumns.map((column) =>
            moneyCell(
              sharedExpenses.reduce(
                (sum, expense) => sum + amountForPartnerColumn(expense.partners, column),
                0
              )
            )
          )
        ],
        columns
      )
    );
  }

  return data;
}

function salesPartnerColumns(analytics: SalesAnalytics): PartnerColumn[] {
  return partnerColumnsFrom(analytics.sales.flatMap((sale) => sale.partners));
}

function buildSalesPartnersData(
  analytics: SalesAnalytics,
  options: SalesWorkbookOptions,
  partnerColumns: readonly PartnerColumn[]
): SheetData {
  const sharedSales = analytics.sales.filter((sale) => sale.partners.length > 0);
  const columns = 4 + partnerColumns.length;
  const headers = ['Fecha', 'Producto', 'Ganancia total COP', 'Tú', ...partnerColumns.map((item) => item.label)];
  const owner = analytics.partnerships.find((person) => person.isOwner);
  const peopleByKey = new Map(analytics.partnerships.map((person) => [person.key, person]));
  const totalInvested = analytics.partnerships.reduce((sum, person) => sum + person.investedCop, 0);
  const totalProfit = analytics.partnerships.reduce((sum, person) => sum + person.profitCop, 0);
  const data: SheetData = [
    ...metadataRows(salesTitle(options), columns, options.periodLabel, analytics.range.start),
    sectionRow('Resumen por persona', columns),
    headerRow(['Concepto', 'Período', 'Total COP', 'Tú', ...partnerColumns.map((item) => item.label)]),
    [
      'Plata puesta en las ventas',
      options.periodLabel,
      moneyCell(totalInvested),
      moneyCell(owner?.investedCop ?? 0),
      ...partnerColumns.map((column) => moneyCell(peopleByKey.get(column.key)?.investedCop ?? 0))
    ],
    [
      'Ganancia',
      options.periodLabel,
      moneyCell(totalProfit),
      moneyCell(owner?.profitCop ?? 0),
      ...partnerColumns.map((column) => moneyCell(peopleByKey.get(column.key)?.profitCop ?? 0))
    ],
    totalRow(
      'TOTAL GANANCIA POR PERSONA',
      [
        null,
        moneyCell(totalProfit),
        moneyCell(owner?.profitCop ?? 0),
        ...partnerColumns.map((column) => moneyCell(peopleByKey.get(column.key)?.profitCop ?? 0))
      ],
      columns
    ),
    Array<Cell>(columns).fill(null),
    sectionRow('Resultado por venta', columns),
    headerRow(headers)
  ];

  for (const sale of sharedSales) {
    const split = splitByContribution({
      totalCostCop: sale.equityBaseCop,
      realResultCop: sale.profitCop,
      partners: sale.partners
    });
    const partnerResults = new Map(split.partners.map((partner) => [partnerKey(partner), partner.resultCop]));
    data.push([
      dateCell(sale.date),
      sale.productType || sale.kind,
      moneyCell(sale.profitCop),
      moneyCell(split.myResultCop),
      ...partnerColumns.map((column) => moneyCell(partnerResults.get(column.key) ?? 0))
    ]);
  }
  data.push(
    totalRow(
      'TOTAL RESULTADO POR VENTA',
      [
        null,
        moneyCell(totalProfit),
        moneyCell(owner?.profitCop ?? 0),
        ...partnerColumns.map((column) => moneyCell(peopleByKey.get(column.key)?.profitCop ?? 0))
      ],
      columns
    )
  );
  return data;
}

function fundStatus(owedCop: number, overdue: boolean): string {
  if (owedCop <= 0) return 'Saldado';
  return overdue ? 'Vencido' : 'Abierto';
}

function buildFundData(
  contributions: readonly FundContribution[],
  asOfISO: string,
  jewelryName: string
): SheetData {
  const columns = 13;
  const people = fundByPerson(contributions, asOfISO);
  const totals = fundTotals(contributions, asOfISO);
  const balances = contributions.map((contribution) => ({
    contribution,
    balance: contributionBalance(contribution, asOfISO)
  }));
  const personBalanceKey = (personId: string | null, personName: string) =>
    personId ? `id:${personId}` : `name:${visiblePartnerName(personName).toLocaleLowerCase('es')}`;
  const outstandingByPerson = new Map<string, { capitalCop: number; returnCop: number }>();
  for (const { contribution, balance } of balances) {
    const key = personBalanceKey(contribution.personId, contribution.personName);
    const current = outstandingByPerson.get(key) ?? { capitalCop: 0, returnCop: 0 };
    current.capitalCop += balance.capitalOutstandingCop;
    current.returnCop += balance.returnOutstandingCop;
    outstandingByPerson.set(key, current);
  }
  const data: SheetData = [
    ...metadataRows(
      `FONDO DE INVERSIÓN · ${jewelryName.trim() || 'Emerald Dealer'}`,
      columns,
      'Foto actual del fondo',
      asOfISO
    ),
    sectionRow('Fondo por persona', columns),
    headerRow([
      'Persona',
      'Aportes',
      'Abiertos',
      'Capital COP',
      'Rendimiento COP',
      'Capital devuelto COP',
      'Rendimiento pagado COP',
      'Capital pendiente COP',
      'Rendimiento pendiente COP',
      'Debes hoy COP',
      'Próximo vencimiento',
      'Estado',
      'Observación'
    ])
  ];

  if (people.length === 0) {
    data.push(spanRow(textCell('Sin aportes registrados', { textColor: GRAY_MUTED }), columns));
  } else {
    for (const person of people) {
      const outstanding = outstandingByPerson.get(personBalanceKey(person.personId, person.personName));
      data.push([
        person.personName,
        numberCell(person.contributionCount, '0'),
        numberCell(person.openCount, '0'),
        moneyCell(person.capitalCop),
        moneyCell(person.accruedReturnCop),
        moneyCell(person.capitalRepaidCop),
        moneyCell(person.returnPaidCop),
        moneyCell(outstanding?.capitalCop ?? 0),
        moneyCell(outstanding?.returnCop ?? 0),
        moneyCell(person.owedCop),
        person.nextDueDate ? dateCell(person.nextDueDate) : null,
        fundStatus(person.owedCop, person.overdue),
        person.overdue ? 'Plazo vencido' : ''
      ]);
    }
  }
  data.push(
    totalRow(
      'TOTAL FONDO',
      [
        numberCell(totals.contributionCount, '0'),
        numberCell(people.reduce((sum, person) => sum + person.openCount, 0), '0'),
        moneyCell(totals.capitalCop),
        moneyCell(totals.accruedReturnCop),
        moneyCell(totals.capitalRepaidCop),
        moneyCell(totals.returnPaidCop),
        moneyCell(totals.capitalCop - totals.capitalRepaidCop),
        moneyCell(totals.accruedReturnCop - totals.returnPaidCop),
        moneyCell(totals.owedCop),
        null,
        null,
        ''
      ],
      columns
    ),
    Array<Cell>(columns).fill(null),
    sectionRow('Detalle de aportes', columns),
    headerRow([
      'Persona',
      'Fecha del aporte',
      'Trato',
      'Tasa mensual %',
      'Total pactado COP',
      'Capital COP',
      'Rendimiento COP',
      'Capital devuelto COP',
      'Rendimiento pagado COP',
      'Debes hoy COP',
      'Vencimiento',
      'Estado',
      'Notas'
    ])
  );

  if (balances.length === 0) {
    data.push(spanRow(textCell('Sin aportes registrados', { textColor: GRAY_MUTED }), columns));
  } else {
    for (const { contribution, balance } of balances) {
      const deal = contribution.returnKind === 'mensual'
        ? `Mensual · ${contribution.monthlyRatePercent ?? 0}%`
        : 'Total fijo pactado';
      data.push([
        balance.personName,
        dateCell(contribution.date),
        deal,
        decimalCell(contribution.returnKind === 'mensual' ? contribution.monthlyRatePercent : null),
        moneyCell(contribution.returnKind === 'fijo' ? contribution.agreedTotalCop : null),
        moneyCell(balance.capitalCop),
        moneyCell(balance.accruedReturnCop),
        moneyCell(balance.capitalRepaidCop),
        moneyCell(balance.returnPaidCop),
        moneyCell(balance.owedCop),
        balance.dueDate ? dateCell(balance.dueDate) : null,
        fundStatus(balance.owedCop, balance.overdue),
        contribution.notes
      ]);
    }
  }

  data.push(
    Array<Cell>(columns).fill(null),
    sectionRow('Historial de pagos', columns),
    headerRow(['Persona', 'Fecha del aporte', 'Fecha del pago', 'Tipo', 'Monto COP', 'Notas'])
  );
  const payments = contributions.flatMap((contribution) =>
    contribution.payments.map((payment) => ({ contribution, payment }))
  );
  if (payments.length === 0) {
    data.push(spanRow(textCell('Sin pagos registrados', { textColor: GRAY_MUTED }), columns));
  } else {
    for (const { contribution, payment } of payments) {
      data.push([
        contribution.personName,
        dateCell(contribution.date),
        dateCell(payment.date),
        payment.kind === 'capital' ? 'Capital' : 'Rendimiento',
        moneyCell(payment.amountCop),
        payment.notes
      ]);
    }
  }
  return data;
}

function fundAsOfForClose(options: CloseWorkbookOptions): string {
  if (options.fundAsOfISO) return options.fundAsOfISO;
  if (options.mode === 'dia') return options.period;
  const match = /^(\d{4})-(\d{2})$/.exec(options.period);
  if (!match) return options.period;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]), 0)).toISOString().slice(0, 10);
}

function closeTitle(options: CloseWorkbookOptions): string {
  const kind = options.mode === 'dia' ? 'CIERRE DEL DÍA' : 'CIERRE DEL MES';
  return `${kind} · ${options.jewelryName.trim() || 'Emerald Dealer'}`;
}

function buildCloseSummaryData(report: BusinessReport, options: CloseWorkbookOptions): SheetData {
  const columns = 5;
  const periodFormat = options.mode === 'mes' ? 'mmmm yyyy' : DATE_FORMAT;
  return [
    ...metadataRows(closeTitle(options), columns, options.periodLabel, options.period, periodFormat),
    sectionRow(options.mode === 'dia' ? 'Resumen del día' : 'Resumen del mes', columns),
    headerRow(['Concepto', 'Entrada COP', 'Salida COP', 'Valor COP', 'Observación']),
    ['Entró en total', moneyCell(report.totals.cashIn), null, null, 'Caja del período'],
    ['Salió en total', null, moneyCell(report.totals.cashOut), null, 'Caja del período'],
    ['Movimiento neto', null, null, moneyCell(report.totals.net), 'Entradas menos salidas'],
    totalRow('TOTAL MOVIMIENTO NETO', [null, null, moneyCell(report.totals.net), ''], columns),
    Array<Cell>(columns).fill(null),
    sectionRow('Saldos actuales', columns),
    headerRow(['Concepto', 'Entrada COP', 'Salida COP', 'Valor COP', 'Observación']),
    ['Clientes deben', null, null, moneyCell(report.totals.clientsOwe), 'Foto actual'],
    ['Compradores de piedras deben', null, null, moneyCell(report.totals.buyersOwe), 'Foto actual'],
    ['Deuda con proveedores', null, null, moneyCell(report.totals.supplierDebt), 'Foto actual'],
    totalRow(
      'TOTAL POR COBRAR',
      [null, null, moneyCell(report.totals.clientsOwe + report.totals.buyersOwe), ''],
      columns
    )
  ];
}

function closeDetailLines(report: BusinessReport): CloseDetailLine[] {
  const lines: CloseDetailLine[] = [];
  const add = (line: CloseDetailLine) => lines.push(line);

  for (const expense of report.expenses) {
    add({
      section: 'Gastos',
      concept: expense.concept,
      detail: `${expense.category} · ${expense.method} · pagó ${expense.paidBy}`,
      cashOut: expense.amountCop
    });
  }
  for (const payment of report.payments) {
    add({
      section: 'Joyería',
      concept: payment.kind === 'anticipo' ? 'Anticipo de cliente' : 'Abono de cliente',
      detail: `${payment.clientName} · ${payment.quoteNumber || 'Sin número'}`,
      cashIn: payment.amount
    });
  }
  for (const payment of report.workshopPayments) {
    add({
      section: 'Taller',
      concept: payment.stageName,
      detail: `${payment.quoteNumber || 'Sin número'} · ${payment.clientName}`,
      cashOut: payment.cost
    });
  }
  for (const quote of report.quotesCreated) {
    add({
      section: 'Cotizaciones creadas',
      concept: quote.number || 'Sin número',
      detail: `${quote.clientName} · ${quote.pieceType}`,
      value: quote.total
    });
  }
  for (const quote of report.quotesApproved) {
    add({
      section: 'Cotizaciones aprobadas',
      concept: quote.number || 'Sin número',
      detail: `${quote.clientName} · ${quote.pieceType}`,
      value: quote.total
    });
  }
  for (const purchase of report.stonePurchases) {
    add({
      section: 'Piedras · compras',
      concept: 'Compra de lote',
      detail: `${purchase.lotName} · ${purchase.stoneType}${purchase.onCredit ? ' · A crédito' : ''}`,
      carats: purchase.carats,
      quantity: purchase.quantity,
      cashOut: purchase.onCredit ? undefined : purchase.valueCop,
      value: purchase.onCredit ? purchase.valueCop : undefined
    });
  }
  for (const sale of report.stoneSales) {
    add({
      section: 'Piedras · ventas',
      concept: 'Venta',
      detail: `${sale.lotName} · ${sale.buyer || 'Sin registrar'}${sale.onCredit ? ' · A crédito' : ''}`,
      carats: sale.carats,
      quantity: sale.quantity,
      cashIn: sale.onCredit ? undefined : sale.valueCop,
      value: sale.onCredit ? sale.valueCop : undefined
    });
  }
  for (const payment of report.buyerPayments) {
    add({
      section: 'Piedras · cobros',
      concept: 'Abono de comprador',
      detail: `${payment.lotName} · ${payment.buyer || 'Sin registrar'}`,
      cashIn: payment.amount
    });
  }
  for (const payment of report.supplierPayments) {
    add({
      section: 'Piedras · pagos',
      concept: 'Pago a proveedor',
      detail: `${payment.lotName} · ${payment.supplier || 'Sin registrar'}`,
      cashOut: payment.amount
    });
  }
  for (const payment of report.cuttingPayments) {
    add({
      section: 'Piedras · talla',
      concept: 'Pago de talla',
      detail: payment.lotName,
      cashOut: payment.amount
    });
  }
  for (const jewel of report.jewelPurchases) {
    add({
      section: 'Joyas · entradas',
      concept: 'Entrada de joya',
      detail: `${jewel.jewelName} · ${jewel.pieceType}`,
      cashOut: jewel.costCop
    });
  }
  for (const jewel of report.jewelSales) {
    add({
      section: 'Joyas · ventas',
      concept: 'Venta de joya',
      detail: `${jewel.jewelName} · ${jewel.buyer || 'Sin registrar'}`,
      cashIn: jewel.priceCop,
      value: jewel.resultCop
    });
  }
  return lines;
}

function buildCloseDetailData(
  lines: readonly CloseDetailLine[],
  options: CloseWorkbookOptions
): SheetData {
  const columns = 7;
  const data: SheetData = [
    ...metadataRows(
      closeTitle(options),
      columns,
      options.periodLabel,
      options.period,
      options.mode === 'mes' ? 'mmmm yyyy' : DATE_FORMAT
    )
  ];
  const sections = [...new Set(lines.map((line) => line.section))];
  sections.forEach((section, index) => {
    if (index > 0) data.push(Array<Cell>(columns).fill(null));
    const sectionLines = lines.filter((line) => line.section === section);
    data.push(
      sectionRow(section, columns),
      headerRow(['Concepto', 'Detalle', 'Quilates', 'Piedras', 'Entrada COP', 'Salida COP', 'Valor COP'])
    );
    for (const line of sectionLines) {
      data.push([
        line.concept,
        line.detail,
        decimalCell(line.carats),
        numberCell(line.quantity, '0'),
        moneyCell(line.cashIn),
        moneyCell(line.cashOut),
        moneyCell(line.value)
      ]);
    }
    data.push(
      totalRow(
        `TOTAL ${section.toUpperCase()}`,
        [
          null,
          decimalCell(sectionLines.reduce((sum, line) => sum + (line.carats ?? 0), 0)),
          numberCell(sectionLines.reduce((sum, line) => sum + (line.quantity ?? 0), 0), '0'),
          moneyCell(sectionLines.reduce((sum, line) => sum + (line.cashIn ?? 0), 0)),
          moneyCell(sectionLines.reduce((sum, line) => sum + (line.cashOut ?? 0), 0)),
          moneyCell(sectionLines.reduce((sum, line) => sum + (line.value ?? 0), 0))
        ],
        columns
      )
    );
  });
  return data;
}

export function buildCloseExcelWorkbook(
  report: BusinessReport,
  options: CloseWorkbookOptions
): ExcelWorkbookDefinition {
  const sheets = [makeSheet('Resumen', buildCloseSummaryData(report, options))];
  const detail = closeDetailLines(report);
  if (detail.length > 0) {
    sheets.push(makeSheet('Detalle', buildCloseDetailData(detail, options), { landscape: true }));
  }
  const partnerColumns = closePartnerColumns(report);
  if (partnerColumns.length > 0) {
    sheets.push(
      makeSheet('Socios', buildClosePartnersData(report, options, partnerColumns), { landscape: true })
    );
  }
  if (options.fundContributions !== undefined) {
    sheets.push(
      makeSheet(
        'Fondo',
        buildFundData(options.fundContributions, fundAsOfForClose(options), options.jewelryName),
        { landscape: true }
      )
    );
  }
  return { sheets };
}

function salesTitle(options: SalesWorkbookOptions): string {
  const title = options.consolidated ? 'CONSOLIDADO DE VENTAS' : 'VENTAS Y GANANCIAS';
  return `${title} · ${options.jewelryName.trim() || 'Emerald Dealer'}`;
}

function salesSummaryData(analytics: SalesAnalytics, options: SalesWorkbookOptions): SheetData {
  const columns = 5;
  const data: SheetData = [
    ...metadataRows(salesTitle(options), columns, options.periodLabel, analytics.range.start),
    sectionRow(options.consolidated ? 'Resumen consolidado' : 'Resumen de ventas', columns),
    headerRow(['Concepto', 'Valor COP', 'Valor USD', 'Registros sin tasa', 'Observación']),
    [
      'Vendido',
      moneyCell(analytics.salesCop),
      usdCell(analytics.salesUsd.amount),
      analytics.salesUsd.missingCount,
      options.periodLabel
    ],
    [
      'Costo de lo vendido',
      moneyCell(analytics.attributedCostCop),
      usdCell(analytics.salesUsd.cost),
      analytics.salesUsd.missingCount,
      options.periodLabel
    ],
    [
      'Ganancia',
      moneyCell(analytics.profitCop),
      usdCell(analytics.salesUsd.profit),
      analytics.salesUsd.missingCount,
      options.periodLabel
    ],
    totalRow(
      'TOTAL GANANCIA',
      [moneyCell(analytics.profitCop), usdCell(analytics.salesUsd.profit), analytics.salesUsd.missingCount, ''],
      columns
    )
  ];

  if (options.consolidated) {
    const mostMoney = analytics.comparison.mostMoney;
    const mostProfitable = analytics.comparison.mostProfitable;
    data.push(
      Array<Cell>(columns).fill(null),
      sectionRow('Comparación por persona', columns),
      headerRow(['Comparación', 'Persona', 'Su ganancia COP', 'Rentabilidad', 'Observación']),
      [
        'Más dinero',
        mostMoney?.partnerName ?? 'Sin registrar',
        moneyCell(mostMoney?.profitCop),
        decimalCell(mostMoney?.returnPercent),
        'Rentabilidad en porcentaje'
      ],
      [
        'Más rentable',
        mostProfitable?.partnerName ?? 'Sin registrar',
        moneyCell(mostProfitable?.profitCop),
        decimalCell(mostProfitable?.returnPercent),
        'Rentabilidad en porcentaje'
      ],
      totalRow('FILTROS APLICADOS', [analytics.filters.societyLabel, analytics.filters.productTypeLabel, null, ''], columns)
    );
  } else {
    data.push(
      Array<Cell>(columns).fill(null),
      sectionRow('Caja del período', columns),
      headerRow(['Concepto', 'Valor COP', 'Valor USD', 'Registros sin tasa', 'Observación']),
      ['Entró', moneyCell(analytics.cashCop.cashIn), usdCell(analytics.cashUsd.cashIn), analytics.cashUsd.missingCount, 'Caja'],
      ['Salió', moneyCell(analytics.cashCop.cashOut), usdCell(analytics.cashUsd.cashOut), analytics.cashUsd.missingCount, 'Caja'],
      ['Movimiento neto', moneyCell(analytics.cashCop.net), usdCell(analytics.cashUsd.net), analytics.cashUsd.missingCount, 'Caja'],
      totalRow('TOTAL MOVIMIENTO NETO', [moneyCell(analytics.cashCop.net), usdCell(analytics.cashUsd.net), analytics.cashUsd.missingCount, ''], columns),
      Array<Cell>(columns).fill(null),
      sectionRow('Cobros pendientes', columns),
      headerRow(['Concepto', 'Valor COP', 'Valor USD', 'Registros sin tasa', 'Observación']),
      ['Clientes', moneyCell(analytics.pendingClientsCop), null, null, 'Foto actual'],
      ['Compradores de piedras', moneyCell(analytics.pendingStoneBuyersCop), null, null, 'Foto actual'],
      totalRow(
        'TOTAL POR COBRAR',
        [moneyCell(analytics.pendingClientsCop + analytics.pendingStoneBuyersCop), null, null, ''],
        columns
      )
    );
  }
  return data;
}

function salesDetailData(analytics: SalesAnalytics, options: SalesWorkbookOptions): SheetData {
  const columns = 13;
  const data: SheetData = [
    ...metadataRows(salesTitle(options), columns, options.periodLabel, analytics.range.start),
    sectionRow('Detalle de ventas', columns),
    headerRow([
      'Fecha',
      'Tipo',
      'Producto',
      'Contraparte',
      'Lote',
      'Socios del lote',
      'Vendido COP',
      'Costo COP',
      'Ganancia COP',
      'Tasa USD/COP',
      'Vendido USD',
      'Costo USD',
      'Ganancia USD'
    ])
  ];
  for (const sale of analytics.sales) {
    data.push([
      dateCell(sale.date),
      sale.kind,
      sale.productType || 'Sin registrar',
      sale.counterparty || 'Sin registrar',
      sale.lotId || 'Sin registrar',
      sale.partners.length > 0
        ? sale.partners.map((partner) => visiblePartnerName(partner.partnerName)).join(' · ')
        : 'Propio',
      moneyCell(sale.amountCop),
      moneyCell(sale.attributedCostCop),
      moneyCell(sale.profitCop),
      decimalCell(sale.usdRate),
      usdCell(sale.amountUsd),
      usdCell(sale.costUsd),
      usdCell(sale.profitUsd)
    ]);
  }
  data.push(
    totalRow(
      'TOTAL VENTAS',
      [
        null,
        null,
        null,
        null,
        null,
        moneyCell(analytics.salesCop),
        moneyCell(analytics.attributedCostCop),
        moneyCell(analytics.profitCop),
        null,
        usdCell(analytics.salesUsd.amount),
        usdCell(analytics.salesUsd.cost),
        usdCell(analytics.salesUsd.profit)
      ],
      columns
    )
  );
  return data;
}

export function buildSalesExcelWorkbook(
  analytics: SalesAnalytics,
  options: SalesWorkbookOptions
): ExcelWorkbookDefinition {
  const sheets = [makeSheet('Resumen', salesSummaryData(analytics, options))];
  if (analytics.sales.length > 0) {
    sheets.push(makeSheet('Detalle', salesDetailData(analytics, options), { landscape: true }));
  }
  const partnerColumns = salesPartnerColumns(analytics);
  if (partnerColumns.length > 0) {
    sheets.push(
      makeSheet('Socios', buildSalesPartnersData(analytics, options, partnerColumns), {
        landscape: true
      })
    );
  }
  if (options.fundContributions !== undefined) {
    sheets.push(
      makeSheet(
        'Fondo',
        buildFundData(
          options.fundContributions,
          options.fundAsOfISO ?? analytics.range.end,
          options.jewelryName
        ),
        { landscape: true }
      )
    );
  }
  return { sheets };
}

async function loadExcelWriter() {
  return import('write-excel-file/browser').then((module) => module.default);
}

/** Genera un Blob real para pruebas o validaciones sin iniciar una descarga. */
export async function buildExcelBlob(workbook: ExcelWorkbookDefinition): Promise<Blob> {
  const writeExcelFile = await loadExcelWriter();
  return writeExcelFile(workbook.sheets).toBlob();
}

/** Descarga local directa. Deliberadamente no usa Web Share ni WhatsApp. */
export async function downloadExcelWorkbook(
  workbook: ExcelWorkbookDefinition,
  filename: string
): Promise<void> {
  const writeExcelFile = await loadExcelWriter();
  const safeFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  await writeExcelFile(workbook.sheets).toFile(safeFilename);
}
