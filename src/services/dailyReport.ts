// Motor PURO de los cierres del negocio (D-020 "todo el negocio", correcciones
// C5/C6): dado un día o un mes reúne, SEPARADO por negocio (Joyería vs
// Piedras), los abonos, pagos del taller, cotizaciones, compras/ventas de
// piedras y pagos a proveedores, con caja honesta frente al crédito: una
// compra a crédito NO saca dinero el día de la compra; los pagos al proveedor
// sí, el día en que se hacen. Documentos SOLO internos: descarga directa,
// sin Web Share ni WhatsApp.

import type { Quote, StockJewel, StoneLot, Settings } from '../types';
import type { PdfContent, PdfSection } from './pdfContent';
import { calculateQuote, quoteToCalcInput } from '../calc/engine';
import { lotDisplayName, summarizeStoneLot } from './stones';
import { jewelDisplayName, summarizeStockJewel } from './stockJewels';
import { clientPaidTotal } from './payments';
import { formatCOP } from '../utils/money';
import { formatDateCO, isValidISODate, parseISODate, toISODate } from '../utils/dates';

export interface DailyStonePurchase {
  lotName: string;
  stoneType: string;
  carats: number;
  quantity: number;
  valueCop: number;
  supplier: string;
  /** true si fue a crédito: se lista, pero NO cuenta como salida de caja. */
  onCredit: boolean;
}

export interface DailyStoneSale {
  lotName: string;
  stoneType: string;
  buyer: string;
  carats: number;
  quantity: number;
  /** Precio acordado de la venta. */
  valueCop: number;
  /** true si fue a crédito: se lista, pero NO cuenta como entrada de caja (D-045). */
  onCredit: boolean;
  /** Fecha acordada de pago. Vacía en una venta de contado. */
  dueDate: string;
}

export interface DailySupplierPayment {
  lotName: string;
  supplier: string;
  amount: number;
}

/** Abono que un comprador entregó ese día por una venta a crédito (D-042). */
export interface DailyBuyerPayment {
  lotName: string;
  buyer: string;
  amount: number;
}

/** Joya en stock que entró al inventario ese día: el dinero salió de la caja. */
export interface DailyJewelPurchase {
  jewelName: string;
  pieceType: string;
  costCop: number;
}

/** Joya en stock vendida ese día. Siempre de contado (D-044). */
export interface DailyJewelSale {
  jewelName: string;
  pieceType: string;
  buyer: string;
  priceCop: number;
  /** Recibido − costo de la pieza. */
  resultCop: number;
}

export interface DailyPayment {
  kind: 'anticipo' | 'abono';
  quoteNumber: string;
  clientName: string;
  amount: number;
  receivedBy: string;
  method: string;
}

export interface DailyWorkshopPayment {
  quoteNumber: string;
  clientName: string;
  stageName: string;
  cost: number;
  paidTo: string;
  paidBy: string;
}

export interface DailyQuoteLine {
  number: string;
  clientName: string;
  pieceType: string;
  total: number;
}

export interface BusinessTotals {
  /** COP recibido en anticipos y abonos de clientes (Joyería, entra). */
  paymentsReceived: number;
  /** COP pagado al taller (Joyería, sale). */
  workshopPaid: number;
  /** COP recibido por ventas de piedras DE CONTADO (Piedras, entra). */
  stonesSold: number;
  /** COP vendido A CRÉDITO: se informa, pero no entró a caja (D-045). */
  stonesSoldCredit: number;
  /** COP recibido en abonos de compradores por ventas a crédito (Piedras, entra). */
  buyerPaymentsReceived: number;
  /** COP en compras de piedras DE CONTADO (Piedras, sale). */
  stonesPurchasedCash: number;
  /** COP en compras A CRÉDITO: se informa, pero no salió de caja. */
  stonesPurchasedCredit: number;
  /** COP pagado a proveedores por créditos (Piedras, sale). */
  supplierPaymentsPaid: number;
  /** COP invertido en joyas que entraron al inventario (Joyas, sale). */
  jewelsAcquiredCost: number;
  /** COP recibido por joyas en stock vendidas (Joyas, entra). */
  jewelsSold: number;
  /** Recibido − costo de las joyas vendidas en el periodo. */
  jewelsResult: number;
  cashIn: number;
  cashOut: number;
  /** Entradas − salidas del periodo. */
  net: number;
  /** Deuda total con proveedores AL MOMENTO del reporte (foto actual). */
  supplierDebt: number;
  /** Saldos que los clientes deben en piezas aprobadas AL MOMENTO (foto actual). */
  clientsOwe: number;
  /** Saldos que los compradores deben por piedras AL MOMENTO (foto actual, D-042). */
  buyersOwe: number;
}

/** Núcleo compartido por el cierre del día y el del mes. */
export interface BusinessReport {
  stonePurchases: DailyStonePurchase[];
  stoneSales: DailyStoneSale[];
  supplierPayments: DailySupplierPayment[];
  buyerPayments: DailyBuyerPayment[];
  jewelPurchases: DailyJewelPurchase[];
  jewelSales: DailyJewelSale[];
  payments: DailyPayment[];
  workshopPayments: DailyWorkshopPayment[];
  quotesCreated: DailyQuoteLine[];
  quotesApproved: DailyQuoteLine[];
  totals: BusinessTotals;
  /** true cuando el periodo no registró ni un movimiento ni una cotización. */
  isEmpty: boolean;
}

export interface DailyReport extends BusinessReport {
  /** Día del cierre (YYYY-MM-DD). */
  date: string;
}

export interface MonthlyReport extends BusinessReport {
  /** Mes del cierre (YYYY-MM). */
  month: string;
}

/** Neto de un mes, para la comparación entre meses. */
export interface MonthlySummary {
  month: string;
  cashIn: number;
  cashOut: number;
  net: number;
}

/** true si el instante ISO cae en el día local indicado. Vacío o inválido: false. */
function isSameLocalDay(iso: string, day: string): boolean {
  if (!iso.trim()) return false;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return false;
  return toISODate(parsed) === day;
}

function clientNameOf(quote: Quote): string {
  return quote.clientSnapshot?.name || 'Sin cliente';
}

/**
 * Reúne el periodo definido por dos filtros: `matchDate` para fechas
 * YYYY-MM-DD y `matchInstant` para instantes ISO (approvedAt).
 */
function buildBusinessReport(
  quotes: readonly Quote[],
  stoneLots: readonly StoneLot[],
  stockJewels: readonly StockJewel[],
  matchDate: (ymd: string) => boolean,
  matchInstant: (iso: string) => boolean
): BusinessReport {
  const stonePurchases: DailyStonePurchase[] = [];
  const stoneSales: DailyStoneSale[] = [];
  const supplierPayments: DailySupplierPayment[] = [];
  const buyerPayments: DailyBuyerPayment[] = [];
  let supplierDebt = 0;
  let buyersOwe = 0;
  for (const lot of stoneLots) {
    const lotSummary = summarizeStoneLot(lot);
    supplierDebt += lotSummary.supplierDebt;
    buyersOwe += lotSummary.buyersDebt;
    if (matchDate(lot.purchaseDate)) {
      stonePurchases.push({
        lotName: lotDisplayName(lot),
        stoneType: lot.stoneType,
        carats: lot.carats,
        quantity: lot.quantity,
        valueCop: lot.purchaseValueCop,
        supplier: lot.supplier,
        onCredit: lot.onCredit
      });
    }
    for (const sale of lot.sales) {
      if (matchDate(sale.date)) {
        stoneSales.push({
          lotName: lotDisplayName(lot),
          stoneType: lot.stoneType,
          buyer: sale.buyer,
          carats: sale.carats,
          quantity: sale.quantity,
          valueCop: sale.valueCop,
          onCredit: sale.onCredit,
          dueDate: sale.dueDate
        });
      }
      // Los abonos del comprador entran a caja el día en que se reciben, no el
      // día de la venta: es la misma regla honesta de las compras a crédito.
      for (const payment of sale.payments) {
        if (matchDate(payment.date)) {
          buyerPayments.push({
            lotName: lotDisplayName(lot),
            buyer: sale.buyer,
            amount: payment.amount
          });
        }
      }
    }
    for (const payment of lot.supplierPayments) {
      if (matchDate(payment.date)) {
        supplierPayments.push({
          lotName: lotDisplayName(lot),
          supplier: lot.supplier,
          amount: payment.amount
        });
      }
    }
  }

  const jewelPurchases: DailyJewelPurchase[] = [];
  const jewelSales: DailyJewelSale[] = [];
  for (const jewel of stockJewels) {
    // Una joya que entra al inventario ya se pagó: el dinero salió ese día,
    // igual que una compra de piedras de contado.
    if (matchDate(jewel.acquiredDate) && jewel.costCop > 0) {
      jewelPurchases.push({
        jewelName: jewelDisplayName(jewel),
        pieceType: jewel.pieceType,
        costCop: jewel.costCop
      });
    }
    if (jewel.sale && matchDate(jewel.sale.date)) {
      jewelSales.push({
        jewelName: jewelDisplayName(jewel),
        pieceType: jewel.pieceType,
        buyer: jewel.sale.buyer,
        priceCop: jewel.sale.priceCop,
        resultCop: summarizeStockJewel(jewel).resultCop
      });
    }
  }

  const payments: DailyPayment[] = [];
  const workshopPayments: DailyWorkshopPayment[] = [];
  const quotesCreated: DailyQuoteLine[] = [];
  const quotesApproved: DailyQuoteLine[] = [];
  let clientsOwe = 0;
  for (const quote of quotes) {
    const calc = calculateQuote(quoteToCalcInput(quote));
    const total = calc.total;
    if (quote.status === 'aprobada') {
      clientsOwe += Math.max(0, total - clientPaidTotal(calc.deposit, quote.payments ?? []));
    }
    if (calc.deposit > 0 && matchDate(quote.depositDate)) {
      payments.push({
        kind: 'anticipo',
        quoteNumber: quote.number,
        clientName: clientNameOf(quote),
        amount: calc.deposit,
        receivedBy: '',
        method: ''
      });
    }
    for (const payment of quote.payments ?? []) {
      if (matchDate(payment.date)) {
        payments.push({
          kind: 'abono',
          quoteNumber: quote.number,
          clientName: clientNameOf(quote),
          amount: payment.amount,
          receivedBy: payment.receivedBy,
          method: payment.method
        });
      }
    }
    for (const stage of quote.production ?? []) {
      if (stage.paid && matchDate(stage.paidAt)) {
        workshopPayments.push({
          quoteNumber: quote.number,
          clientName: clientNameOf(quote),
          stageName: stage.name,
          cost: stage.cost,
          paidTo: stage.paidTo,
          paidBy: stage.paidBy
        });
      }
    }
    const line: DailyQuoteLine = {
      number: quote.number,
      clientName: clientNameOf(quote),
      pieceType: quote.pieceType,
      total
    };
    if (matchDate(quote.date)) quotesCreated.push(line);
    // approvedAt existe desde la Etapa 9: aprobaciones anteriores no se
    // pueden fechar con certeza y por honestidad no se inventan.
    if (matchInstant(quote.approvedAt)) quotesApproved.push(line);
  }

  const sum = (values: number[]) => values.reduce((acc, v) => acc + v, 0);
  const paymentsReceived = sum(payments.map((p) => p.amount));
  const workshopPaid = sum(workshopPayments.map((w) => w.cost));
  // Solo las ventas de CONTADO entran a caja el día de la venta. Las de crédito
  // se informan aparte y entran cuando el comprador abona (D-045).
  const stonesSold = sum(stoneSales.filter((s) => !s.onCredit).map((s) => s.valueCop));
  const stonesSoldCredit = sum(stoneSales.filter((s) => s.onCredit).map((s) => s.valueCop));
  const buyerPaymentsReceived = sum(buyerPayments.map((p) => p.amount));
  const stonesPurchasedCash = sum(stonePurchases.filter((p) => !p.onCredit).map((p) => p.valueCop));
  const stonesPurchasedCredit = sum(stonePurchases.filter((p) => p.onCredit).map((p) => p.valueCop));
  const supplierPaymentsPaid = sum(supplierPayments.map((p) => p.amount));
  const jewelsAcquiredCost = sum(jewelPurchases.map((j) => j.costCop));
  const jewelsSold = sum(jewelSales.map((j) => j.priceCop));
  const jewelsResult = sum(jewelSales.map((j) => j.resultCop));
  const cashIn = stonesSold + buyerPaymentsReceived + jewelsSold + paymentsReceived;
  const cashOut =
    stonesPurchasedCash + supplierPaymentsPaid + jewelsAcquiredCost + workshopPaid;

  return {
    stonePurchases,
    stoneSales,
    supplierPayments,
    buyerPayments,
    jewelPurchases,
    jewelSales,
    payments,
    workshopPayments,
    quotesCreated,
    quotesApproved,
    totals: {
      paymentsReceived,
      workshopPaid,
      stonesSold,
      stonesSoldCredit,
      buyerPaymentsReceived,
      stonesPurchasedCash,
      stonesPurchasedCredit,
      supplierPaymentsPaid,
      jewelsAcquiredCost,
      jewelsSold,
      jewelsResult,
      cashIn,
      cashOut,
      net: cashIn - cashOut,
      supplierDebt,
      clientsOwe,
      buyersOwe
    },
    isEmpty:
      stonePurchases.length === 0 &&
      stoneSales.length === 0 &&
      supplierPayments.length === 0 &&
      buyerPayments.length === 0 &&
      jewelPurchases.length === 0 &&
      jewelSales.length === 0 &&
      payments.length === 0 &&
      workshopPayments.length === 0 &&
      quotesCreated.length === 0 &&
      quotesApproved.length === 0
  };
}

export function buildDailyReport(
  day: string,
  quotes: readonly Quote[],
  stoneLots: readonly StoneLot[],
  stockJewels: readonly StockJewel[] = []
): DailyReport {
  return {
    date: day,
    ...buildBusinessReport(
      quotes,
      stoneLots,
      stockJewels,
      (ymd) => ymd === day,
      (iso) => isSameLocalDay(iso, day)
    )
  };
}

/** true si el instante ISO cae en el mes local indicado (YYYY-MM). */
function isSameLocalMonth(iso: string, month: string): boolean {
  if (!iso.trim()) return false;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return false;
  return toISODate(parsed).slice(0, 7) === month;
}

export function buildMonthlyReport(
  month: string,
  quotes: readonly Quote[],
  stoneLots: readonly StoneLot[],
  stockJewels: readonly StockJewel[] = []
): MonthlyReport {
  return {
    month,
    ...buildBusinessReport(
      quotes,
      stoneLots,
      stockJewels,
      (ymd) => isValidISODate(ymd) && ymd.slice(0, 7) === month,
      (iso) => isSameLocalMonth(iso, month)
    )
  };
}

/**
 * Meses con actividad (del más reciente al más antiguo) con su neto de caja,
 * para comparar cómo va el mes contra los anteriores.
 */
export function listMonthlySummaries(
  quotes: readonly Quote[],
  stoneLots: readonly StoneLot[],
  stockJewels: readonly StockJewel[] = []
): MonthlySummary[] {
  const months = new Set<string>();
  const addDate = (ymd: string) => {
    if (isValidISODate(ymd)) months.add(ymd.slice(0, 7));
  };
  const addInstant = (iso: string) => {
    if (!iso.trim()) return;
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) months.add(toISODate(parsed).slice(0, 7));
  };
  for (const lot of stoneLots) {
    addDate(lot.purchaseDate);
    for (const sale of lot.sales) {
      addDate(sale.date);
      for (const payment of sale.payments) addDate(payment.date);
    }
    for (const payment of lot.supplierPayments) addDate(payment.date);
  }
  for (const jewel of stockJewels) {
    if (jewel.costCop > 0) addDate(jewel.acquiredDate);
    if (jewel.sale) addDate(jewel.sale.date);
  }
  for (const quote of quotes) {
    addDate(quote.date);
    addInstant(quote.approvedAt);
    if (quote.deposit > 0) addDate(quote.depositDate);
    for (const payment of quote.payments ?? []) addDate(payment.date);
    for (const stage of quote.production ?? []) {
      if (stage.paid) addDate(stage.paidAt);
    }
  }
  return [...months]
    .sort((a, b) => b.localeCompare(a))
    .map((month) => {
      const { totals } = buildMonthlyReport(month, quotes, stoneLots, stockJewels);
      return { month, cashIn: totals.cashIn, cashOut: totals.cashOut, net: totals.net };
    });
}

/** "2026-07" → "julio de 2026". */
export function formatMonthCO(month: string): string {
  if (!/^\d{4}-\d{2}$/.test(month)) return month;
  return parseISODate(`${month}-01`).toLocaleDateString('es-CO', {
    month: 'long',
    year: 'numeric'
  });
}

/** Solo meses realmente anteriores al seleccionado, del más reciente al más antiguo. */
export function previousMonthlySummaries(
  selectedMonth: string,
  summaries: readonly MonthlySummary[],
  limit = 6
): MonthlySummary[] {
  return [...summaries]
    .filter((summary) => summary.month < selectedMonth)
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, Math.max(0, limit));
}

function formatCarats(carats: number): string {
  return `${carats.toLocaleString('es-CO', { maximumFractionDigits: 3 })} ct`;
}

/** Secciones del PDF separadas por negocio: primero Joyería, luego Piedras (C5). */
function businessSections(report: BusinessReport): PdfSection[] {
  const sections: PdfSection[] = [];

  if (report.payments.length > 0) {
    sections.push({
      title: 'Joyería · Pagos recibidos',
      paragraphs: report.payments.map((p) => {
        const kind = p.kind === 'anticipo' ? 'Anticipo pagado' : 'Abono';
        const who = p.receivedBy ? ` — recibió ${p.receivedBy}` : '';
        const how = p.method ? ` (${p.method})` : '';
        return `• ${kind}: ${formatCOP(p.amount)} de ${p.clientName} (${p.quoteNumber || 'sin número'})${who}${how}`;
      })
    });
  }

  if (report.workshopPayments.length > 0) {
    sections.push({
      title: 'Joyería · Pagos del taller',
      paragraphs: report.workshopPayments.map((w) => {
        const to = w.paidTo ? ` a ${w.paidTo}` : '';
        const by = w.paidBy ? ` (pagó ${w.paidBy})` : '';
        return `• ${w.stageName} de ${w.quoteNumber || 'sin número'} (${w.clientName})${to}${by} — ${formatCOP(w.cost)}`;
      })
    });
  }

  if (report.quotesCreated.length > 0) {
    sections.push({
      title: 'Joyería · Cotizaciones creadas',
      paragraphs: report.quotesCreated.map(
        (q) => `• ${q.number || 'Sin número'} — ${q.clientName} · ${q.pieceType} · ${formatCOP(q.total)}`
      )
    });
  }

  if (report.quotesApproved.length > 0) {
    sections.push({
      title: 'Joyería · Cotizaciones aprobadas',
      paragraphs: report.quotesApproved.map(
        (q) => `• ${q.number || 'Sin número'} — ${q.clientName} · ${formatCOP(q.total)}`
      )
    });
  }

  if (report.stonePurchases.length > 0) {
    sections.push({
      title: 'Piedras · Compras',
      paragraphs: report.stonePurchases.map((p) => {
        const supplier = p.supplier ? ` a ${p.supplier}` : '';
        const credit = p.onCredit ? ' — A CRÉDITO (no salió de caja)' : '';
        return `• ${p.lotName} (${p.stoneType || 'sin tipo'}): ${formatCarats(p.carats)} · ${p.quantity} pz${supplier} — ${formatCOP(p.valueCop)}${credit}`;
      })
    });
  }

  if (report.stoneSales.length > 0) {
    sections.push({
      title: 'Piedras · Ventas',
      paragraphs: report.stoneSales.map((s) => {
        const buyer = s.buyer ? ` a ${s.buyer}` : '';
        const credit = s.onCredit
          ? ` — A CRÉDITO (no entró a caja; pagan el ${formatDateCO(s.dueDate)})`
          : '';
        return `• ${s.lotName}: ${formatCarats(s.carats)} · ${s.quantity} pz${buyer} — ${formatCOP(s.valueCop)}${credit}`;
      })
    });
  }

  if (report.buyerPayments.length > 0) {
    sections.push({
      title: 'Piedras · Abonos de compradores',
      paragraphs: report.buyerPayments.map((p) => {
        const buyer = p.buyer ? ` de ${p.buyer}` : '';
        return `• ${p.lotName}${buyer} — ${formatCOP(p.amount)}`;
      })
    });
  }

  if (report.supplierPayments.length > 0) {
    sections.push({
      title: 'Piedras · Pagos a proveedores',
      paragraphs: report.supplierPayments.map((p) => {
        const supplier = p.supplier ? ` a ${p.supplier}` : '';
        return `• ${p.lotName}${supplier} — ${formatCOP(p.amount)}`;
      })
    });
  }

  if (report.jewelPurchases.length > 0) {
    sections.push({
      title: 'Joyas en stock · Entradas al inventario',
      paragraphs: report.jewelPurchases.map(
        (j) => `• ${j.jewelName} (${j.pieceType}) — ${formatCOP(j.costCop)}`
      )
    });
  }

  if (report.jewelSales.length > 0) {
    sections.push({
      title: 'Joyas en stock · Ventas',
      paragraphs: report.jewelSales.map((j) => {
        const buyer = j.buyer ? ` a ${j.buyer}` : '';
        return `• ${j.jewelName} (${j.pieceType})${buyer} — ${formatCOP(j.priceCop)} · resultado ${formatCOP(j.resultCop)}`;
      })
    });
  }

  return sections;
}

/** Renglones de dinero del PDF, agrupados por negocio (C5). */
function businessTotalsRows(totals: BusinessTotals): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    ['Joyería · entró por pagos de clientes', formatCOP(totals.paymentsReceived)],
    ['Joyería · salió al taller', `- ${formatCOP(totals.workshopPaid)}`],
    ['Piedras · entró por ventas de contado', formatCOP(totals.stonesSold)],
    ['Piedras · entró por abonos de compradores', formatCOP(totals.buyerPaymentsReceived)],
    ['Piedras · salió en compras de contado', `- ${formatCOP(totals.stonesPurchasedCash)}`],
    ['Piedras · salió a proveedores', `- ${formatCOP(totals.supplierPaymentsPaid)}`]
  ];
  if (totals.jewelsSold > 0) {
    rows.push(['Joyas en stock · entró por ventas', formatCOP(totals.jewelsSold)]);
  }
  if (totals.jewelsAcquiredCost > 0) {
    rows.push(['Joyas en stock · salió en piezas nuevas', `- ${formatCOP(totals.jewelsAcquiredCost)}`]);
  }
  if (totals.stonesSoldCredit > 0) {
    rows.push(['Ventas a crédito (no entró a caja)', formatCOP(totals.stonesSoldCredit)]);
  }
  if (totals.stonesPurchasedCredit > 0) {
    rows.push(['Compras a crédito (no salió de caja)', formatCOP(totals.stonesPurchasedCredit)]);
  }
  if (totals.supplierDebt > 0) {
    rows.push(['Debes a proveedores (a la fecha)', formatCOP(totals.supplierDebt)]);
  }
  if (totals.clientsOwe > 0) {
    rows.push(['Clientes te deben (a la fecha)', formatCOP(totals.clientsOwe)]);
  }
  if (totals.buyersOwe > 0) {
    rows.push(['Te deben por piedras (a la fecha)', formatCOP(totals.buyersOwe)]);
  }
  return rows;
}

function emptySection(label: string): PdfSection {
  return {
    title: 'Sin movimientos',
    paragraphs: [`${label} no registró compras, ventas, pagos de clientes, otros pagos ni cotizaciones.`]
  };
}

/**
 * Contenido del PDF del cierre del día, reutilizando el renderizador de la app.
 * SIEMPRE interno: el encabezado lo advierte y la interfaz solo ofrece
 * descarga directa (nunca Web Share ni WhatsApp).
 */
export function buildDailyReportPdfContent(report: DailyReport, settings: Settings): PdfContent {
  const sections = businessSections(report);
  if (report.isEmpty) sections.push(emptySection('Este día'));

  return {
    internal: true,
    jewelryName: settings.jewelryName,
    contactLines: ['DOCUMENTO INTERNO — NO ENTREGAR AL CLIENTE'],
    docTitle: 'CIERRE DEL DÍA',
    quoteNumber: '',
    dateLine: `Día: ${formatDateCO(report.date)}`,
    sections,
    totals: businessTotalsRows(report.totals),
    totalLine: ['MOVIMIENTO NETO DEL DÍA', formatCOP(report.totals.net)],
    footer: 'Uso exclusivo de la joyería.'
  };
}

/** Contenido del PDF del cierre del mes (C6). Mismas reglas internas. */
export function buildMonthlyReportPdfContent(
  report: MonthlyReport,
  previous: readonly MonthlySummary[],
  settings: Settings
): PdfContent {
  const sections: PdfSection[] = [
    {
      title: 'Actividad del mes',
      paragraphs: [
        `Cotizaciones creadas: ${report.quotesCreated.length} · aprobadas: ${report.quotesApproved.length}`,
        `Pagos de clientes: ${report.payments.length} · pagos del taller: ${report.workshopPayments.length}`,
        `Lotes comprados: ${report.stonePurchases.length} · ventas de piedras: ${report.stoneSales.length} · abonos de compradores: ${report.buyerPayments.length} · pagos a proveedores: ${report.supplierPayments.length}`,
        `Joyas que entraron al inventario: ${report.jewelPurchases.length} · joyas vendidas: ${report.jewelSales.length}`
      ]
    },
    ...businessSections(report)
  ];
  if (report.isEmpty) sections.push(emptySection('Este mes'));

  const others = previousMonthlySummaries(report.month, previous);
  if (others.length > 0) {
    sections.push({
      title: 'Comparación con meses anteriores',
      paragraphs: others.map(
        (s) =>
          `• ${formatMonthCO(s.month)}: entró ${formatCOP(s.cashIn)} · salió ${formatCOP(s.cashOut)} · neto ${formatCOP(s.net)}`
      )
    });
  }

  return {
    internal: true,
    jewelryName: settings.jewelryName,
    contactLines: ['DOCUMENTO INTERNO — NO ENTREGAR AL CLIENTE'],
    docTitle: 'CIERRE DEL MES',
    quoteNumber: '',
    dateLine: `Mes: ${formatMonthCO(report.month)}`,
    sections,
    totals: businessTotalsRows(report.totals),
    totalLine: ['MOVIMIENTO NETO DEL MES', formatCOP(report.totals.net)],
    footer: 'Uso exclusivo de la joyería.'
  };
}
