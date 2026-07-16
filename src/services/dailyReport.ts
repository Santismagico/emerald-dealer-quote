// Motor PURO del Cierre del día (Etapa 9, decisión D-020: "todo el negocio").
// Dado un día, reúne: compras y ventas de piedras, abonos recibidos, pagos del
// taller y cotizaciones creadas/aprobadas, con totales en COP enteros. Es un
// documento SOLO interno: se descarga directo, sin Web Share ni WhatsApp.

import type { Quote, StoneLot, Settings } from '../types';
import type { PdfContent, PdfSection } from './pdfContent';
import { calculateQuote, quoteToCalcInput } from '../calc/engine';
import { lotDisplayName } from './stones';
import { formatCOP } from '../utils/money';
import { formatDateCO, toISODate } from '../utils/dates';

export interface DailyStonePurchase {
  lotName: string;
  stoneType: string;
  carats: number;
  quantity: number;
  valueCop: number;
  supplier: string;
}

export interface DailyStoneSale {
  lotName: string;
  stoneType: string;
  buyer: string;
  carats: number;
  quantity: number;
  valueCop: number;
}

export interface DailyPayment {
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

export interface DailyReport {
  /** Día del cierre (YYYY-MM-DD). */
  date: string;
  stonePurchases: DailyStonePurchase[];
  stoneSales: DailyStoneSale[];
  payments: DailyPayment[];
  workshopPayments: DailyWorkshopPayment[];
  quotesCreated: DailyQuoteLine[];
  quotesApproved: DailyQuoteLine[];
  totals: {
    /** COP invertido comprando piedras hoy (sale dinero). */
    stonesPurchased: number;
    /** COP recibido por ventas de piedras hoy (entra dinero). */
    stonesSold: number;
    /** COP recibido en abonos de clientes hoy (entra dinero). */
    paymentsReceived: number;
    /** COP pagado al taller hoy (sale dinero). */
    workshopPaid: number;
    cashIn: number;
    cashOut: number;
    /** Entradas − salidas del día. */
    net: number;
  };
  /** true cuando el día no tiene ni un solo movimiento ni cotización. */
  isEmpty: boolean;
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

export function buildDailyReport(
  day: string,
  quotes: readonly Quote[],
  stoneLots: readonly StoneLot[]
): DailyReport {
  const stonePurchases: DailyStonePurchase[] = [];
  const stoneSales: DailyStoneSale[] = [];
  for (const lot of stoneLots) {
    if (lot.purchaseDate === day) {
      stonePurchases.push({
        lotName: lotDisplayName(lot),
        stoneType: lot.stoneType,
        carats: lot.carats,
        quantity: lot.quantity,
        valueCop: lot.purchaseValueCop,
        supplier: lot.supplier
      });
    }
    for (const sale of lot.sales) {
      if (sale.date === day) {
        stoneSales.push({
          lotName: lotDisplayName(lot),
          stoneType: lot.stoneType,
          buyer: sale.buyer,
          carats: sale.carats,
          quantity: sale.quantity,
          valueCop: sale.valueCop
        });
      }
    }
  }

  const payments: DailyPayment[] = [];
  const workshopPayments: DailyWorkshopPayment[] = [];
  const quotesCreated: DailyQuoteLine[] = [];
  const quotesApproved: DailyQuoteLine[] = [];
  for (const quote of quotes) {
    for (const payment of quote.payments ?? []) {
      if (payment.date === day) {
        payments.push({
          quoteNumber: quote.number,
          clientName: clientNameOf(quote),
          amount: payment.amount,
          receivedBy: payment.receivedBy,
          method: payment.method
        });
      }
    }
    for (const stage of quote.production ?? []) {
      if (stage.paid && stage.paidAt === day) {
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
      total: calculateQuote(quoteToCalcInput(quote)).total
    };
    if (quote.date === day) quotesCreated.push(line);
    // approvedAt existe desde la Etapa 9: aprobaciones anteriores no se
    // pueden fechar con certeza y por honestidad no se inventan.
    if (isSameLocalDay(quote.approvedAt, day)) quotesApproved.push(line);
  }

  const sum = (values: number[]) => values.reduce((acc, v) => acc + v, 0);
  const stonesPurchased = sum(stonePurchases.map((p) => p.valueCop));
  const stonesSold = sum(stoneSales.map((s) => s.valueCop));
  const paymentsReceived = sum(payments.map((p) => p.amount));
  const workshopPaid = sum(workshopPayments.map((w) => w.cost));
  const cashIn = stonesSold + paymentsReceived;
  const cashOut = stonesPurchased + workshopPaid;

  return {
    date: day,
    stonePurchases,
    stoneSales,
    payments,
    workshopPayments,
    quotesCreated,
    quotesApproved,
    totals: {
      stonesPurchased,
      stonesSold,
      paymentsReceived,
      workshopPaid,
      cashIn,
      cashOut,
      net: cashIn - cashOut
    },
    isEmpty:
      stonePurchases.length === 0 &&
      stoneSales.length === 0 &&
      payments.length === 0 &&
      workshopPayments.length === 0 &&
      quotesCreated.length === 0 &&
      quotesApproved.length === 0
  };
}

function formatCarats(carats: number): string {
  return `${carats.toLocaleString('es-CO', { maximumFractionDigits: 3 })} ct`;
}

/**
 * Contenido del PDF del cierre, reutilizando el mismo renderizador de la app.
 * SIEMPRE interno: el encabezado lo advierte y la interfaz solo ofrece
 * descarga directa (nunca Web Share ni WhatsApp).
 */
export function buildDailyReportPdfContent(report: DailyReport, settings: Settings): PdfContent {
  const sections: PdfSection[] = [];

  if (report.stonePurchases.length > 0) {
    sections.push({
      title: 'Piedras compradas',
      paragraphs: report.stonePurchases.map((p) => {
        const supplier = p.supplier ? ` a ${p.supplier}` : '';
        return `• ${p.lotName} (${p.stoneType || 'sin tipo'}): ${formatCarats(p.carats)} · ${p.quantity} pz${supplier} — ${formatCOP(p.valueCop)}`;
      })
    });
  }

  if (report.stoneSales.length > 0) {
    sections.push({
      title: 'Piedras vendidas',
      paragraphs: report.stoneSales.map((s) => {
        const buyer = s.buyer ? ` a ${s.buyer}` : '';
        return `• ${s.lotName}: ${formatCarats(s.carats)} · ${s.quantity} pz${buyer} — ${formatCOP(s.valueCop)}`;
      })
    });
  }

  if (report.payments.length > 0) {
    sections.push({
      title: 'Abonos recibidos',
      paragraphs: report.payments.map((p) => {
        const who = p.receivedBy ? ` — recibió ${p.receivedBy}` : '';
        const how = p.method ? ` (${p.method})` : '';
        return `• ${formatCOP(p.amount)} de ${p.clientName} (${p.quoteNumber || 'sin número'})${who}${how}`;
      })
    });
  }

  if (report.workshopPayments.length > 0) {
    sections.push({
      title: 'Pagos del taller',
      paragraphs: report.workshopPayments.map((w) => {
        const to = w.paidTo ? ` a ${w.paidTo}` : '';
        const by = w.paidBy ? ` (pagó ${w.paidBy})` : '';
        return `• ${w.stageName} de ${w.quoteNumber || 'sin número'} (${w.clientName})${to}${by} — ${formatCOP(w.cost)}`;
      })
    });
  }

  if (report.quotesCreated.length > 0) {
    sections.push({
      title: 'Cotizaciones creadas hoy',
      paragraphs: report.quotesCreated.map(
        (q) => `• ${q.number || 'Sin número'} — ${q.clientName} · ${q.pieceType} · ${formatCOP(q.total)}`
      )
    });
  }

  if (report.quotesApproved.length > 0) {
    sections.push({
      title: 'Cotizaciones aprobadas hoy',
      paragraphs: report.quotesApproved.map(
        (q) => `• ${q.number || 'Sin número'} — ${q.clientName} · ${formatCOP(q.total)}`
      )
    });
  }

  if (report.isEmpty) {
    sections.push({
      title: 'Sin movimientos',
      paragraphs: ['Este día no registró compras, ventas, abonos, pagos ni cotizaciones.']
    });
  }

  return {
    internal: true,
    jewelryName: settings.jewelryName,
    contactLines: ['DOCUMENTO INTERNO — NO ENTREGAR AL CLIENTE'],
    docTitle: 'CIERRE DEL DÍA',
    quoteNumber: '',
    dateLine: `Día: ${formatDateCO(report.date)}`,
    sections,
    totals: [
      ['Entró por ventas de piedras', formatCOP(report.totals.stonesSold)],
      ['Entró por abonos', formatCOP(report.totals.paymentsReceived)],
      ['Salió por compras de piedras', `- ${formatCOP(report.totals.stonesPurchased)}`],
      ['Salió por pagos del taller', `- ${formatCOP(report.totals.workshopPaid)}`]
    ],
    totalLine: ['MOVIMIENTO NETO DEL DÍA', formatCOP(report.totals.net)],
    footer: 'Uso exclusivo de la joyería.'
  };
}
