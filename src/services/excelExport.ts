import type { BusinessReport } from './dailyReport';
import type { SalesAnalytics } from './salesAnalytics';

export type ExcelCell = string | number | null | undefined;
export type ExcelRow = readonly ExcelCell[];

function escapeCell(cell: ExcelCell): string {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'number') return Number.isFinite(cell) ? String(cell) : '';
  return /[;"\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

/** CSV compatible con Excel en español: BOM UTF-8, punto y coma y CRLF. */
export function buildExcelCsv(rows: readonly ExcelRow[]): string {
  return `\uFEFF${rows.map((row) => row.map(escapeCell).join(';')).join('\r\n')}\r\n`;
}

const CLOSE_HEADER: ExcelRow = [
  'Sección',
  'Concepto',
  'Detalle',
  'Entrada COP',
  'Salida COP',
  'Valor COP'
];

export function buildCloseExcelCsv(report: BusinessReport, periodLabel: string): string {
  const rows: ExcelRow[] = [
    ['CIERRE DEL NEGOCIO'],
    ['Período', periodLabel],
    ['Documento interno', 'No entregar al cliente'],
    [],
    CLOSE_HEADER,
    ['Resumen', 'Entró en total', '', report.totals.cashIn, '', ''],
    ['Resumen', 'Salió en total', '', '', report.totals.cashOut, ''],
    ['Resumen', 'Movimiento neto', '', '', '', report.totals.net],
    ['Resumen', 'Clientes deben', 'Foto actual', '', '', report.totals.clientsOwe],
    ['Resumen', 'Compradores de piedras deben', 'Foto actual', '', '', report.totals.buyersOwe],
    ['Resumen', 'Deuda con proveedores', 'Foto actual', '', '', report.totals.supplierDebt]
  ];

  for (const expense of report.expenses) {
    rows.push([
      'Gastos',
      expense.concept,
      `${expense.category} · ${expense.method} · pagó ${expense.paidBy}`,
      '',
      expense.amountCop,
      ''
    ]);
  }
  for (const payment of report.payments) {
    rows.push([
      'Joyería',
      payment.kind === 'anticipo' ? 'Anticipo de cliente' : 'Abono de cliente',
      `${payment.clientName} · ${payment.quoteNumber || 'Sin número'}`,
      payment.amount,
      '',
      ''
    ]);
  }
  for (const payment of report.workshopPayments) {
    rows.push([
      'Taller',
      payment.stageName,
      `${payment.quoteNumber || 'Sin número'} · ${payment.clientName}`,
      '',
      payment.cost,
      ''
    ]);
  }
  for (const quote of report.quotesCreated) {
    rows.push([
      'Cotizaciones creadas',
      quote.number || 'Sin número',
      `${quote.clientName} · ${quote.pieceType}`,
      '',
      '',
      quote.total
    ]);
  }
  for (const quote of report.quotesApproved) {
    rows.push([
      'Cotizaciones aprobadas',
      quote.number || 'Sin número',
      `${quote.clientName} · ${quote.pieceType}`,
      '',
      '',
      quote.total
    ]);
  }
  for (const purchase of report.stonePurchases) {
    rows.push([
      'Piedras',
      'Compra de lote',
      `${purchase.lotName} · ${purchase.stoneType}${purchase.onCredit ? ' · A crédito' : ''}`,
      '',
      purchase.onCredit ? '' : purchase.valueCop,
      purchase.onCredit ? purchase.valueCop : ''
    ]);
  }
  for (const sale of report.stoneSales) {
    rows.push([
      'Piedras',
      'Venta',
      `${sale.lotName} · ${sale.buyer || 'Sin registrar'}${sale.onCredit ? ' · A crédito' : ''}`,
      sale.onCredit ? '' : sale.valueCop,
      '',
      sale.onCredit ? sale.valueCop : ''
    ]);
  }
  for (const payment of report.buyerPayments) {
    rows.push([
      'Piedras',
      'Abono de comprador',
      `${payment.lotName} · ${payment.buyer || 'Sin registrar'}`,
      payment.amount,
      '',
      ''
    ]);
  }
  for (const payment of report.supplierPayments) {
    rows.push([
      'Piedras',
      'Pago a proveedor',
      `${payment.lotName} · ${payment.supplier || 'Sin registrar'}`,
      '',
      payment.amount,
      ''
    ]);
  }
  for (const payment of report.cuttingPayments) {
    rows.push(['Piedras', 'Pago de talla', payment.lotName, '', payment.amount, '']);
  }
  for (const jewel of report.jewelPurchases) {
    rows.push(['Joyas', 'Entrada de joya', `${jewel.jewelName} · ${jewel.pieceType}`, '', jewel.costCop, '']);
  }
  for (const jewel of report.jewelSales) {
    rows.push([
      'Joyas',
      'Venta de joya',
      `${jewel.jewelName} · ${jewel.buyer || 'Sin registrar'}`,
      jewel.priceCop,
      '',
      jewel.resultCop
    ]);
  }

  return buildExcelCsv(rows);
}

export function buildSalesExcelCsv(analytics: SalesAnalytics, periodLabel: string): string {
  const rows: ExcelRow[] = [
    ['VENTAS Y GANANCIAS'],
    ['Período', periodLabel],
    ['Documento interno', 'No entregar al cliente'],
    [],
    ['Resumen', 'Vendido COP', analytics.salesCop],
    ['Resumen', 'Costo de lo vendido COP', analytics.attributedCostCop],
    ['Resumen', 'Ganancia COP', analytics.profitCop],
    ['Caja', 'Entró COP', analytics.cashCop.cashIn],
    ['Caja', 'Salió COP', analytics.cashCop.cashOut],
    ['Caja', 'Movimiento neto COP', analytics.cashCop.net],
    ['Cobros pendientes', 'Clientes COP', analytics.pendingClientsCop],
    ['Cobros pendientes', 'Compradores de piedras COP', analytics.pendingStoneBuyersCop],
    [],
    [
      'Fecha',
      'Tipo',
      'Producto',
      'Contraparte',
      'Lote',
      'Socio',
      'Vendido COP',
      'Costo COP',
      'Ganancia COP',
      'Tasa USD/COP',
      'Vendido USD',
      'Costo USD',
      'Ganancia USD'
    ]
  ];

  for (const sale of analytics.sales) {
    rows.push([
      sale.date,
      sale.kind,
      sale.productType || 'Sin registrar',
      sale.counterparty || 'Sin registrar',
      sale.lotId || 'Sin registrar',
      sale.partnerName || 'Sin registrar',
      sale.amountCop,
      sale.attributedCostCop,
      sale.profitCop,
      sale.usdRate,
      sale.amountUsd,
      sale.costUsd,
      sale.profitUsd
    ]);
  }

  return buildExcelCsv(rows);
}

/** Descarga local directa. Deliberadamente no usa Web Share ni WhatsApp. */
export function downloadExcelCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
