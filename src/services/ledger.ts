// Libro PURO del negocio (D-057): convierte las entidades guardadas en un
// flujo unico de eventos. El sentido de caja se decide aqui y no en quien lo
// presenta. No usa almacenamiento, red, UI ni tiempo implicito.

import type {
  Expense,
  MaterialLot,
  Quote,
  StockJewel,
  StoneLot
} from '../types';
import { calculateQuote, quoteToCalcInput } from '../calc/engine';
import { isValidISODate, toISODate } from '../utils/dates';
import { toSafeCOP } from '../utils/money';
import { stockJewelAcquisitionCostCop } from './stockJewels';
import { attributedStoneCostCop } from './stoneJewelTransformation';

export type LedgerDirection = 'entra' | 'sale' | 'ninguna';

export type LedgerModule =
  | 'cotizador'
  | 'taller'
  | 'piedras'
  | 'material'
  | 'joyas'
  | 'gastos';

export type LedgerEventKind =
  | 'compra_lote_piedras'
  | 'venta_piedras_contado'
  | 'venta_piedras_credito'
  | 'abono_comprador'
  | 'pago_proveedor'
  | 'pago_talla'
  | 'uso_interno_piedra'
  | 'compra_joya_stock'
  | 'venta_joya_stock'
  | 'transformacion_joya'
  | 'abono_cliente'
  | 'pago_taller'
  | 'gasto'
  | 'cotizacion_creada'
  | 'cotizacion_aprobada'
  | 'movimiento_material';

export interface LedgerEvent {
  /** Identificador estable y derivado de la entidad de origen. */
  id: string;
  /** Fecha local del evento (YYYY-MM-DD). */
  date: string;
  kind: LedgerEventKind;
  direction: LedgerDirection;
  /** COP entero y nunca negativo. El signo lo expresa direction. */
  amountCop: number;
  /** Costo COP de lo vendido en este evento. Cero cuando no es una venta. */
  attributedCostCop: number;
  /** null conserva honestamente una tasa historica no registrada. */
  usdRate: number | null;
  module: LedgerModule;
  lotId: string | null;
  partnerId: string | null;
  partnerName: string;
  myPercent: number;
  /** Vacio conserva honestamente un tipo de producto no registrado. */
  productType: string;
  counterparty: string;
  counterpartyId: string | null;
  /** Identificador de la entidad concreta que produjo el evento. */
  reference: string;
  notes: string;
}

export interface LedgerInput {
  quotes?: readonly Quote[];
  stoneLots?: readonly StoneLot[];
  stockJewels?: readonly StockJewel[];
  materialLots?: readonly MaterialLot[];
  expenses?: readonly Expense[];
}

export interface LedgerCashTotals {
  cashIn: number;
  cashOut: number;
  net: number;
}

type EventFields = Omit<LedgerEvent, 'amountCop' | 'attributedCostCop' | 'myPercent'> & {
  amountCop: number;
  attributedCostCop?: number;
  myPercent?: number;
};

function event(fields: EventFields): LedgerEvent {
  return {
    ...fields,
    amountCop: toSafeCOP(fields.amountCop),
    attributedCostCop: toSafeCOP(fields.attributedCostCop ?? 0),
    myPercent: Math.min(100, Math.max(0, Math.round(fields.myPercent ?? 100)))
  };
}

/**
 * Reutiliza la regla de costo por quilate de C2 y deja cualquier residuo COP
 * en la ultima venta que agota el lote. Asi nunca se atribuye mas de lo
 * invertido y un lote vendido por completo cierra peso por peso.
 */
function stoneSaleAttributedCosts(lot: StoneLot): Map<string, number> {
  const costs = new Map<string, number>();
  const purchasedMilliCarats = Math.max(0, Math.round(lot.carats * 1000));
  const investedCop = toSafeCOP(
    lot.purchaseValueCop +
      (lot.cuttingBatches ?? []).reduce(
        (total, batch) => total + (batch.cuttingPaidDate.trim() ? toSafeCOP(batch.cuttingCostCop) : 0),
        0
      )
  );
  let soldMilliCarats = 0;
  let attributedCop = 0;

  for (const sale of lot.sales) {
    soldMilliCarats += Math.max(0, Math.round(sale.carats * 1000));
    const remainingCop = Math.max(0, investedCop - attributedCop);
    const proportionalCop = attributedStoneCostCop(lot, sale.carats);
    const saleCostCop =
      purchasedMilliCarats > 0 && soldMilliCarats >= purchasedMilliCarats
        ? remainingCop
        : Math.min(remainingCop, proportionalCop);
    costs.set(sale.id, saleCostCop);
    attributedCop += saleCostCop;
  }

  return costs;
}

function instantToLocalDate(iso: string): string | null {
  if (!iso.trim()) return null;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : toISODate(parsed);
}

function quoteClientName(quote: Quote): string {
  return quote.clientSnapshot?.name || 'Sin cliente';
}

function materialMyPercent(lot: MaterialLot): number {
  if (lot.grams <= 0) return 100;
  return (lot.myGrams / lot.grams) * 100;
}

/**
 * Construye el libro completo una sola vez. Quien lo consume lo filtra luego
 * por fecha, mes o dimension sin reconstruir las entidades de origen.
 */
export function buildLedger({
  quotes = [],
  stoneLots = [],
  stockJewels = [],
  materialLots = [],
  expenses = []
}: LedgerInput): LedgerEvent[] {
  const events: LedgerEvent[] = [];

  for (const quote of quotes) {
    const calculation = calculateQuote(quoteToCalcInput(quote));
    const total = calculation.total;
    const clientName = quoteClientName(quote);

    events.push(
      event({
        id: `quote:${quote.id}:created`,
        date: quote.date,
        kind: 'cotizacion_creada',
        direction: 'ninguna',
        amountCop: total,
        usdRate: null,
        module: 'cotizador',
        lotId: null,
        partnerId: null,
        partnerName: '',
        productType: quote.pieceType,
        counterparty: clientName,
        counterpartyId: quote.clientId,
        reference: quote.id,
        notes: quote.internalNotes
      })
    );

    const approvedDate = instantToLocalDate(quote.approvedAt);
    if (approvedDate) {
      events.push(
        event({
          id: `quote:${quote.id}:approved`,
          date: approvedDate,
          kind: 'cotizacion_aprobada',
          direction: 'ninguna',
          amountCop: total,
          attributedCostCop: calculation.baseCost,
          usdRate: null,
          module: 'cotizador',
          lotId: null,
          partnerId: null,
          partnerName: '',
          productType: quote.pieceType,
          counterparty: clientName,
          counterpartyId: quote.clientId,
          reference: quote.id,
          notes: quote.internalNotes
        })
      );
    }

    if (calculation.deposit > 0 && quote.depositDate.trim()) {
      events.push(
        event({
          id: `quote:${quote.id}:deposit`,
          date: quote.depositDate,
          kind: 'abono_cliente',
          direction: 'entra',
          amountCop: calculation.deposit,
          usdRate: null,
          module: 'cotizador',
          lotId: null,
          partnerId: null,
          partnerName: '',
          productType: quote.pieceType,
          counterparty: clientName,
          counterpartyId: quote.clientId,
          reference: quote.id,
          notes: 'Anticipo'
        })
      );
    }

    for (const payment of quote.payments ?? []) {
      events.push(
        event({
          id: `quote:${quote.id}:payment:${payment.id}`,
          date: payment.date,
          kind: 'abono_cliente',
          direction: 'entra',
          amountCop: payment.amount,
          usdRate: null,
          module: 'cotizador',
          lotId: null,
          partnerId: null,
          partnerName: '',
          productType: quote.pieceType,
          counterparty: clientName,
          counterpartyId: quote.clientId,
          reference: payment.id,
          notes: payment.notes
        })
      );
    }

    for (const stage of quote.production ?? []) {
      if (!stage.paid) continue;
      events.push(
        event({
          id: `quote:${quote.id}:workshop-payment:${stage.id}`,
          date: stage.paidAt,
          kind: 'pago_taller',
          direction: 'sale',
          amountCop: stage.cost,
          usdRate: null,
          module: 'taller',
          lotId: null,
          partnerId: null,
          partnerName: '',
          productType: quote.pieceType,
          counterparty: stage.paidTo,
          counterpartyId: null,
          reference: stage.id,
          notes: stage.notes
        })
      );
    }
  }

  for (const lot of stoneLots) {
    const saleAttributedCosts = stoneSaleAttributedCosts(lot);
    // Una compra a credito se registra, pero no mueve caja hasta cada pago al
    // proveedor. Es la misma regla honesta que ya aplicaban los cierres.
    events.push(
      event({
        id: `stone-lot:${lot.id}:purchase`,
        date: lot.purchaseDate,
        kind: 'compra_lote_piedras',
        direction: lot.onCredit ? 'ninguna' : 'sale',
        amountCop: lot.purchaseValueCop,
        usdRate: null,
        module: 'piedras',
        lotId: lot.id,
        partnerId: lot.partnerId,
        partnerName: lot.partnerName,
        myPercent: lot.myPercent,
        productType: '',
        counterparty: lot.supplier,
        counterpartyId: lot.supplierId,
        reference: lot.id,
        notes: lot.notes
      })
    );

    for (const sale of lot.sales) {
      events.push(
        event({
          id: `stone-lot:${lot.id}:sale:${sale.id}`,
          date: sale.date,
          kind: sale.onCredit ? 'venta_piedras_credito' : 'venta_piedras_contado',
          direction: sale.onCredit ? 'ninguna' : 'entra',
          amountCop: sale.valueCop,
          attributedCostCop: saleAttributedCosts.get(sale.id) ?? 0,
          usdRate: sale.usdRate,
          module: 'piedras',
          lotId: lot.id,
          partnerId: lot.partnerId,
          partnerName: lot.partnerName,
          myPercent: lot.myPercent,
          productType: sale.productType,
          counterparty: sale.buyer,
          counterpartyId: sale.buyerId,
          reference: sale.id,
          notes: sale.notes
        })
      );

      for (const payment of sale.payments) {
        events.push(
          event({
            id: `stone-lot:${lot.id}:sale:${sale.id}:buyer-payment:${payment.id}`,
            date: payment.date,
            kind: 'abono_comprador',
            direction: 'entra',
            amountCop: payment.amount,
            usdRate: payment.usdRate,
            module: 'piedras',
            lotId: lot.id,
            partnerId: lot.partnerId,
            partnerName: lot.partnerName,
            myPercent: lot.myPercent,
            productType: sale.productType,
            counterparty: sale.buyer,
            counterpartyId: sale.buyerId,
            reference: payment.id,
            notes: payment.notes
          })
        );
      }
    }

    for (const payment of lot.supplierPayments) {
      events.push(
        event({
          id: `stone-lot:${lot.id}:supplier-payment:${payment.id}`,
          date: payment.date,
          kind: 'pago_proveedor',
          direction: 'sale',
          amountCop: payment.amount,
          usdRate: null,
          module: 'piedras',
          lotId: lot.id,
          partnerId: lot.partnerId,
          partnerName: lot.partnerName,
          myPercent: lot.myPercent,
          productType: '',
          counterparty: lot.supplier,
          counterpartyId: lot.supplierId,
          reference: payment.id,
          notes: payment.notes
        })
      );
    }

    for (const batch of lot.cuttingBatches ?? []) {
      if (!batch.cuttingPaidDate.trim()) continue;
      events.push(
        event({
          id: `stone-lot:${lot.id}:cutting-payment:${batch.id}`,
          date: batch.cuttingPaidDate,
          kind: 'pago_talla',
          direction: 'sale',
          amountCop: batch.cuttingCostCop,
          usdRate: null,
          module: 'piedras',
          lotId: lot.id,
          partnerId: lot.partnerId,
          partnerName: lot.partnerName,
          myPercent: lot.myPercent,
          productType: '',
          counterparty: '',
          counterpartyId: null,
          reference: batch.id,
          notes: batch.notes
        })
      );
    }

    for (const use of lot.internalUses ?? []) {
      events.push(
        event({
          id: `stone-lot:${lot.id}:internal-use:${use.id}`,
          date: use.date,
          kind: 'uso_interno_piedra',
          direction: 'ninguna',
          amountCop: use.costCop,
          usdRate: null,
          module: 'piedras',
          lotId: lot.id,
          partnerId: lot.partnerId,
          partnerName: lot.partnerName,
          myPercent: lot.myPercent,
          productType: '',
          counterparty: '',
          counterpartyId: null,
          reference: use.id,
          notes: use.notes
        })
      );
    }
  }

  for (const jewel of stockJewels) {
    const acquisitionCostCop = stockJewelAcquisitionCostCop(jewel);
    if (acquisitionCostCop > 0) {
      events.push(
        event({
          id: `stock-jewel:${jewel.id}:purchase`,
          date: jewel.acquiredDate,
          kind: 'compra_joya_stock',
          direction: 'sale',
          amountCop: acquisitionCostCop,
          usdRate: null,
          module: 'joyas',
          lotId: null,
          partnerId: null,
          partnerName: '',
          productType: jewel.pieceType,
          counterparty: '',
          counterpartyId: null,
          reference: jewel.id,
          notes: jewel.notes
        })
      );
    }

    if (jewel.sale) {
      events.push(
        event({
          id: `stock-jewel:${jewel.id}:sale:${jewel.sale.id}`,
          date: jewel.sale.date,
          kind: 'venta_joya_stock',
          direction: 'entra',
          amountCop: jewel.sale.priceCop,
          attributedCostCop: jewel.costCop,
          usdRate: jewel.sale.usdRate,
          module: 'joyas',
          lotId: null,
          partnerId: null,
          partnerName: '',
          productType: jewel.sale.productType,
          counterparty: jewel.sale.buyer,
          counterpartyId: jewel.sale.buyerId,
          reference: jewel.sale.id,
          notes: jewel.sale.notes
        })
      );
    }

    for (const transformation of jewel.stoneTransformations ?? []) {
      events.push(
        event({
          id: `stock-jewel:${jewel.id}:transformation:${transformation.id}`,
          date: transformation.date,
          kind: 'transformacion_joya',
          direction: 'ninguna',
          amountCop: transformation.costCop,
          usdRate: null,
          module: 'joyas',
          lotId: transformation.lotId,
          partnerId: null,
          partnerName: '',
          productType: jewel.pieceType,
          counterparty: '',
          counterpartyId: null,
          reference: transformation.id,
          notes: transformation.notes
        })
      );
    }
  }

  for (const lot of materialLots) {
    const myPercent = materialMyPercent(lot);
    events.push(
      event({
        id: `material-lot:${lot.id}:purchase`,
        date: lot.purchaseDate,
        kind: 'movimiento_material',
        direction: 'ninguna',
        amountCop: lot.costCop,
        usdRate: null,
        module: 'material',
        lotId: lot.id,
        partnerId: lot.partnerId,
        partnerName: lot.partnerName,
        myPercent,
        productType: '',
        counterparty: lot.partnerName,
        counterpartyId: lot.partnerId,
        reference: lot.id,
        notes: lot.notes
      })
    );

    for (const use of lot.uses) {
      events.push(
        event({
          id: `material-lot:${lot.id}:use:${use.id}`,
          date: use.date,
          kind: 'movimiento_material',
          direction: 'ninguna',
          // El uso guarda gramos, no dinero. Cero conserva el dato real sin
          // inventar un costo unitario que el negocio nunca registro.
          amountCop: 0,
          usdRate: null,
          module: 'material',
          lotId: lot.id,
          partnerId: lot.partnerId,
          partnerName: lot.partnerName,
          myPercent,
          productType: '',
          counterparty: lot.partnerName,
          counterpartyId: lot.partnerId,
          reference: use.id,
          notes: use.notes
        })
      );
    }
  }

  for (const expense of expenses) {
    events.push(
      event({
        id: `expense:${expense.id}`,
        date: expense.date,
        kind: 'gasto',
        direction: 'sale',
        amountCop: expense.amountCop,
        usdRate: expense.usdRate,
        module: 'gastos',
        lotId: null,
        partnerId: expense.partnerId,
        partnerName: expense.partnerName,
        myPercent: expense.myPercent,
        productType: '',
        counterparty: expense.partnerName,
        counterpartyId: expense.partnerId,
        reference: expense.id,
        notes: expense.notes
      })
    );
  }

  return events;
}

export function ledgerEventsForDay(
  events: readonly LedgerEvent[],
  day: string
): LedgerEvent[] {
  return events.filter((entry) => entry.date === day);
}

export function ledgerEventsForMonth(
  events: readonly LedgerEvent[],
  month: string
): LedgerEvent[] {
  return events.filter(
    (entry) => isValidISODate(entry.date) && entry.date.slice(0, 7) === month
  );
}

export function ledgerCashTotals(events: readonly LedgerEvent[]): LedgerCashTotals {
  let cashIn = 0;
  let cashOut = 0;
  for (const entry of events) {
    if (entry.direction === 'entra') cashIn += entry.amountCop;
    if (entry.direction === 'sale') cashOut += entry.amountCop;
  }
  return { cashIn, cashOut, net: cashIn - cashOut };
}

export function sumLedgerEvents(
  events: readonly LedgerEvent[],
  kind: LedgerEventKind,
  direction?: LedgerDirection
): number {
  return events.reduce(
    (total, entry) =>
      entry.kind === kind && (direction === undefined || entry.direction === direction)
        ? total + entry.amountCop
        : total,
    0
  );
}
