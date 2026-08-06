// Lógica PURA del negocio de piedras por LOTES (decisión de Santiago 2026-07-15):
// cada compra crea un lote rastreable y cada venta se descuenta de un lote
// específico. Existencias, dinero y resultado se DERIVAN de los lotes y sus
// ventas; nunca existe un contador guardado a mano. Todo es interno (COP
// entero): ninguna piedra ni precio entra en canales de cliente.

import {
  activePartners,
  partnersFromLegacy,
  splitByContribution,
  type PartnershipSplit
} from './partnership';
import type {
  BuyerPayment,
  CuttingBatch,
  LotPartner,
  StoneInternalUse,
  StoneLot,
  StoneOrigin,
  StoneSale,
  SupplierPayment
} from '../types';
import { isValidISODate } from '../utils/dates';
import { newId } from '../utils/id';
import { toSafeCOP } from '../utils/money';
import { validateOptionalUsdRate } from './currency';

export type LotFilter = 'existencias' | 'agotados' | 'todos';

/** Redondeo a 3 decimales para que la resta de quilates no acumule ruido flotante. */
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Los lotes anteriores a C2 se compraron en bruto por definicion historica. */
export function stoneLotPurchaseOrigin(lot: Pick<StoneLot, 'purchaseOrigin'>): StoneOrigin {
  return lot.purchaseOrigin === 'tallado' ? 'tallado' : 'bruto';
}

/** Lo que se puede saber de una venta sin guardar nada: recibido y saldo (D-042). */
export interface StoneSaleSummary {
  sale: StoneSale;
  /** COP realmente recibido: el precio si fue de contado, la suma de abonos si fue a crédito. */
  receivedCop: number;
  /** Lo que el comprador aún debe. 0 en una venta de contado. */
  balanceCop: number;
  /** true cuando fue a crédito y ya no queda saldo. */
  settled: boolean;
}

export function summarizeStoneSale(sale: StoneSale): StoneSaleSummary {
  const total = toSafeCOP(sale.valueCop);
  if (!sale.onCredit) {
    return { sale, receivedCop: total, balanceCop: 0, settled: false };
  }
  let receivedCop = 0;
  for (const payment of sale.payments) receivedCop += toSafeCOP(payment.amount);
  const balanceCop = Math.max(0, total - receivedCop);
  return { sale, receivedCop, balanceCop, settled: balanceCop <= 0 };
}

/** Todo lo que se puede saber de un lote sin guardar nada: vendido, restante y resultado. */
export interface StoneLotSummary {
  lot: StoneLot;
  soldCarats: number;
  soldQuantity: number;
  soldRawCarats: number;
  soldRawQuantity: number;
  soldCutCarats: number;
  soldCutQuantity: number;
  internalUsedCarats: number;
  internalUsedQuantity: number;
  internalUsedRawCarats: number;
  internalUsedRawQuantity: number;
  internalUsedCutCarats: number;
  internalUsedCutQuantity: number;
  /** Costo que salio del lote y entro a joyas, sin mover caja. */
  internalAttributedCost: number;
  /** COP recibido por las ventas del lote. */
  soldValue: number;
  sentToCutCarats: number;
  sentToCutQuantity: number;
  inCuttingCarats: number;
  inCuttingQuantity: number;
  returnedCutCarats: number;
  returnedCutQuantity: number;
  rawAvailableCarats: number;
  rawAvailableQuantity: number;
  cutAvailableCarats: number;
  cutAvailableQuantity: number;
  /** Merma ponderada de las tandas regresadas. null mientras no haya dato real. */
  cuttingLossRatio: number | null;
  totalCuttingCost: number;
  paidCuttingCost: number;
  unpaidCuttingCost: number;
  /** Compra + tallas que ya salieron de caja. */
  totalInvested: number;
  remainingCarats: number;
  remainingQuantity: number;
  /** true cuando ya no quedan piedras ni quilates por vender. */
  exhausted: boolean;
  /** Vendido − costo del lote. Es parcial mientras queden existencias. */
  result: number;
  /** COP ya pagado al proveedor de este lote. */
  paidToSupplier: number;
  /** Lo que aún se le debe al proveedor (0 si no fue a crédito o ya se saldó). */
  supplierDebt: number;
  /** true cuando fue a crédito y ya no se debe nada. */
  creditSettled: boolean;
  /** COP ya recibido de los compradores (contado completo + abonos de crédito). */
  receivedFromBuyers: number;
  /** COP que los compradores aún deben por las ventas a crédito de este lote. */
  buyersDebt: number;
}

export function summarizeStoneLot(lot: StoneLot): StoneLotSummary {
  let soldCarats = 0;
  let soldQuantity = 0;
  let soldRawCarats = 0;
  let soldRawQuantity = 0;
  let soldCutCarats = 0;
  let soldCutQuantity = 0;
  let internalUsedCarats = 0;
  let internalUsedQuantity = 0;
  let internalUsedRawCarats = 0;
  let internalUsedRawQuantity = 0;
  let internalUsedCutCarats = 0;
  let internalUsedCutQuantity = 0;
  let internalAttributedCost = 0;
  let soldValue = 0;
  let receivedFromBuyers = 0;
  let buyersDebt = 0;
  for (const sale of lot.sales) {
    soldCarats += sale.carats;
    soldQuantity += sale.quantity;
    if (sale.origin === 'tallado') {
      soldCutCarats += sale.carats;
      soldCutQuantity += sale.quantity;
    } else {
      soldRawCarats += sale.carats;
      soldRawQuantity += sale.quantity;
    }
    // `soldValue` es el precio ACORDADO: así el resultado del lote no cambia de
    // significado por vender a crédito. El dinero real va aparte (D-042).
    soldValue += toSafeCOP(sale.valueCop);
    const summary = summarizeStoneSale(sale);
    receivedFromBuyers += summary.receivedCop;
    buyersDebt += summary.balanceCop;
  }
  for (const use of lot.internalUses ?? []) {
    internalUsedCarats += use.carats;
    internalUsedQuantity += use.quantity;
    internalAttributedCost += toSafeCOP(use.costCop);
    if (use.origin === 'tallado') {
      internalUsedCutCarats += use.carats;
      internalUsedCutQuantity += use.quantity;
    } else {
      internalUsedRawCarats += use.carats;
      internalUsedRawQuantity += use.quantity;
    }
  }
  soldCarats = round3(soldCarats);
  soldRawCarats = round3(soldRawCarats);
  soldCutCarats = round3(soldCutCarats);
  internalUsedCarats = round3(internalUsedCarats);
  internalUsedRawCarats = round3(internalUsedRawCarats);
  internalUsedCutCarats = round3(internalUsedCutCarats);

  let sentToCutCarats = 0;
  let sentToCutQuantity = 0;
  let inCuttingCarats = 0;
  let inCuttingQuantity = 0;
  let returnedCutCarats = 0;
  let returnedCutQuantity = 0;
  let returnedSentCarats = 0;
  let totalCuttingCost = 0;
  let paidCuttingCost = 0;
  for (const batch of lot.cuttingBatches ?? []) {
    sentToCutCarats += batch.sentCarats;
    sentToCutQuantity += batch.sentQuantity;
    totalCuttingCost += toSafeCOP(batch.cuttingCostCop);
    if (batch.cuttingPaidDate) paidCuttingCost += toSafeCOP(batch.cuttingCostCop);
    if (batch.returnedDate) {
      returnedSentCarats += batch.sentCarats;
      returnedCutCarats += batch.returnedCarats;
      returnedCutQuantity += batch.returnedQuantity;
    } else {
      inCuttingCarats += batch.sentCarats;
      inCuttingQuantity += batch.sentQuantity;
    }
  }
  sentToCutCarats = round3(sentToCutCarats);
  inCuttingCarats = round3(inCuttingCarats);
  returnedCutCarats = round3(returnedCutCarats);
  returnedSentCarats = round3(returnedSentCarats);

  const purchaseOrigin = stoneLotPurchaseOrigin(lot);
  const purchasedRawCarats = purchaseOrigin === 'bruto' ? lot.carats : 0;
  const purchasedRawQuantity = purchaseOrigin === 'bruto' ? lot.quantity : 0;
  const purchasedCutCarats = purchaseOrigin === 'tallado' ? lot.carats : 0;
  const purchasedCutQuantity = purchaseOrigin === 'tallado' ? lot.quantity : 0;
  const rawAvailableCarats = round3(
    purchasedRawCarats - sentToCutCarats - soldRawCarats - internalUsedRawCarats
  );
  const rawAvailableQuantity =
    purchasedRawQuantity - sentToCutQuantity - soldRawQuantity - internalUsedRawQuantity;
  const cutAvailableCarats = round3(
    purchasedCutCarats + returnedCutCarats - soldCutCarats - internalUsedCutCarats
  );
  const cutAvailableQuantity =
    purchasedCutQuantity + returnedCutQuantity - soldCutQuantity - internalUsedCutQuantity;
  const remainingCarats = round3(rawAvailableCarats + inCuttingCarats + cutAvailableCarats);
  const remainingQuantity = rawAvailableQuantity + inCuttingQuantity + cutAvailableQuantity;

  let paidToSupplier = 0;
  for (const payment of lot.supplierPayments) {
    paidToSupplier += toSafeCOP(payment.amount);
  }
  const purchaseValue = toSafeCOP(lot.purchaseValueCop);
  const totalInvested = purchaseValue + paidCuttingCost;
  const supplierDebt = lot.onCredit ? Math.max(0, purchaseValue - paidToSupplier) : 0;

  return {
    lot,
    soldCarats,
    soldQuantity,
    soldRawCarats,
    soldRawQuantity,
    soldCutCarats,
    soldCutQuantity,
    internalUsedCarats,
    internalUsedQuantity,
    internalUsedRawCarats,
    internalUsedRawQuantity,
    internalUsedCutCarats,
    internalUsedCutQuantity,
    internalAttributedCost,
    soldValue,
    sentToCutCarats,
    sentToCutQuantity,
    inCuttingCarats,
    inCuttingQuantity,
    returnedCutCarats,
    returnedCutQuantity,
    rawAvailableCarats,
    rawAvailableQuantity,
    cutAvailableCarats,
    cutAvailableQuantity,
    cuttingLossRatio:
      returnedSentCarats > 0
        ? (returnedSentCarats - returnedCutCarats) / returnedSentCarats
        : null,
    totalCuttingCost,
    paidCuttingCost,
    unpaidCuttingCost: Math.max(0, totalCuttingCost - paidCuttingCost),
    totalInvested,
    remainingCarats,
    remainingQuantity,
    exhausted: remainingCarats <= 0 && remainingQuantity <= 0,
    result: soldValue + internalAttributedCost - totalInvested,
    paidToSupplier,
    supplierDebt,
    creditSettled: lot.onCredit && supplierDebt <= 0,
    receivedFromBuyers,
    buyersDebt
  };
}

/** Reparto de una sociedad sobre dinero real recibido, nunca sobre el precio acordado (D-053). */
export interface StonePartnershipSummary {
  shared: boolean;
  realResult: number;
  myResult: number;
  partnerResult: number;
}

/**
 * Los socios de igualdad del lote (D-073). Si el lote todavía guarda el modelo
 * anterior de socio único, se convierte al vuelo para poder leerlo sin romperse.
 */
export function stoneLotPartners(lot: StoneLot): LotPartner[] {
  const declared = activePartners(lot.partners);
  if (declared.length > 0) return declared;
  return partnersFromLegacy({
    partnerId: lot.partnerId,
    partnerName: lot.partnerName,
    myPercent: lot.myPercent,
    totalCostCop: lot.purchaseValueCop
  });
}

/**
 * Reparto completo del lote entre Santiago y sus socios de igualdad (D-073).
 *
 * La base del reparto es el VALOR DE COMPRA menos lo que financió el fondo: es
 * la plata que cada uno puso para adquirir el lote. La plata del fondo se
 * excluye porque es deuda, no participación (D-072).
 *
 * El costo del financiamiento NO se descuenta aquí. Se resta después y solo del
 * lado de Santiago (D-075): un socio nunca paga un préstamo que no pidió.
 */
export function summarizeStoneLotSplit(lot: StoneLot): PartnershipSplit {
  const summary = summarizeStoneLot(lot);
  return splitByContribution({
    totalCostCop: lot.purchaseValueCop,
    realResultCop: summary.receivedFromBuyers - summary.totalInvested,
    partners: stoneLotPartners(lot),
    fundedFromFundCop: lot.fundedFromFundCop ?? 0
  });
}

/**
 * Forma resumida del reparto, con la parte de TODOS los socios sumada. Se
 * conserva para las pantallas que aún no muestran socio por socio; internamente
 * ya usa el motor de N partes.
 */
export function summarizeStonePartnership(lot: StoneLot): StonePartnershipSummary {
  const split = summarizeStoneLotSplit(lot);
  return {
    shared: split.shared,
    realResult: split.realResultCop,
    myResult: split.myResultCop,
    partnerResult: split.partnersResultCop
  };
}

export interface PartnerStoneResult {
  partnerId: string | null;
  partnerName: string;
  realResult: number;
  myResult: number;
  partnerResult: number;
  lotCount: number;
}

function stonePartnerKey(lot: StoneLot): string {
  if (lot.partnerId) return `id:${lot.partnerId}`;
  return `name:${lot.partnerName.trim().toLocaleLowerCase('es')}`;
}

/** Resultado real acumulado de los lotes compartidos con cada socio. */
export function stonesByPartner(lots: readonly StoneLot[]): PartnerStoneResult[] {
  const byPartner = new Map<string, PartnerStoneResult>();
  for (const lot of lots) {
    const split = summarizeStonePartnership(lot);
    if (!split.shared) continue;
    const key = stonePartnerKey(lot);
    const current = byPartner.get(key) ?? {
      partnerId: lot.partnerId,
      partnerName: lot.partnerName.trim() || 'Sin nombre',
      realResult: 0,
      myResult: 0,
      partnerResult: 0,
      lotCount: 0
    };
    current.realResult += split.realResult;
    current.myResult += split.myResult;
    current.partnerResult += split.partnerResult;
    current.lotCount += 1;
    byPartner.set(key, current);
  }
  return [...byPartner.values()].sort((a, b) => b.realResult - a.realResult);
}

/** Valida la forma del reparto antes de normalizar para no corregirlo en silencio. */
export function validateStoneLotOwnership(raw: unknown): string | null {
  const lot = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const hasPartnerId = Object.prototype.hasOwnProperty.call(lot, 'partnerId');
  const hasPartnerName = Object.prototype.hasOwnProperty.call(lot, 'partnerName');
  const hasMyPercent = Object.prototype.hasOwnProperty.call(lot, 'myPercent');

  if (
    hasPartnerId &&
    lot.partnerId !== null &&
    (typeof lot.partnerId !== 'string' || !lot.partnerId.trim())
  ) {
    return 'El socio vinculado no es válido.';
  }
  if (hasPartnerName && typeof lot.partnerName !== 'string') {
    return 'El nombre del socio no es válido.';
  }

  const partnerId = typeof lot.partnerId === 'string' && lot.partnerId.trim() ? lot.partnerId : null;
  const partnerName = typeof lot.partnerName === 'string' ? lot.partnerName.trim() : '';
  const myPercent = hasMyPercent ? lot.myPercent : 100;
  if (
    typeof myPercent !== 'number' ||
    !Number.isFinite(myPercent) ||
    !Number.isInteger(myPercent) ||
    myPercent < 0 ||
    myPercent > 100
  ) {
    return 'Tu porcentaje debe ser un número entero entre 0 y 100.';
  }

  const shared = partnerId !== null || partnerName.length > 0;
  if (partnerId !== null && !partnerName) return 'Elige el socio del lote.';
  if (!shared && myPercent !== 100) return 'Un lote sin socio debe ser 100% propio.';
  return null;
}

/**
 * Protege los metadatos B3 antes de normalizar. Sin registro anterior acepta
 * los vacíos históricos; las pantallas exigen los campos en operaciones nuevas.
 */
export function validateStoneLotSalesMetadata(
  raw: unknown,
  previous?: StoneLot | null
): string | null {
  const candidate = (
    typeof raw === 'object' && raw !== null ? raw : {}
  ) as Record<string, unknown>;
  const hasInternalUses = Object.prototype.hasOwnProperty.call(candidate, 'internalUses');
  if (hasInternalUses && !Array.isArray(candidate.internalUses)) {
    return 'Los usos internos del lote no son validos.';
  }
  if (!hasInternalUses && (previous?.internalUses?.length ?? 0) > 0) {
    return 'Esta version no conserva los usos internos ya registrados.';
  }
  const rawInternalUses = Array.isArray(candidate.internalUses) ? candidate.internalUses : [];
  const internalUseIds = new Set<string>();
  for (const value of rawInternalUses) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return 'El lote contiene un uso interno invalido.';
    }
    const use = value as Record<string, unknown>;
    const id = typeof use.id === 'string' ? use.id.trim() : '';
    if (!id || internalUseIds.has(id)) {
      return 'El lote contiene usos internos repetidos o sin identificar.';
    }
    internalUseIds.add(id);
    if (
      typeof use.date !== 'string' ||
      typeof use.carats !== 'number' ||
      !Number.isFinite(use.carats) ||
      typeof use.quantity !== 'number' ||
      !Number.isInteger(use.quantity) ||
      (use.origin !== 'bruto' && use.origin !== 'tallado') ||
      typeof use.jewelId !== 'string' ||
      typeof use.costCop !== 'number' ||
      !Number.isSafeInteger(use.costCop) ||
      typeof use.notes !== 'string'
    ) {
      return 'El lote contiene datos invalidos en un uso interno.';
    }
  }
  const lot = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  if (!Array.isArray(lot.sales)) return 'Las ventas del lote no son válidas.';
  const hasCuttingBatches = Object.prototype.hasOwnProperty.call(lot, 'cuttingBatches');
  if (hasCuttingBatches && !Array.isArray(lot.cuttingBatches)) {
    return 'Las tandas de talla del lote no son válidas.';
  }
  if (!hasCuttingBatches && (previous?.cuttingBatches.length ?? 0) > 0) {
    return 'Esta versión no conserva las tandas de talla ya registradas.';
  }
  const rawBatches = Array.isArray(lot.cuttingBatches) ? lot.cuttingBatches : [];
  const batchIds = new Set<string>();
  for (const value of rawBatches) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return 'El lote contiene una tanda de talla inválida.';
    }
    const batch = value as Record<string, unknown>;
    const id = typeof batch.id === 'string' ? batch.id.trim() : '';
    if (!id || batchIds.has(id)) return 'El lote contiene tandas de talla repetidas o sin identificar.';
    batchIds.add(id);
    if (
      typeof batch.sentDate !== 'string' ||
      typeof batch.sentCarats !== 'number' ||
      !Number.isFinite(batch.sentCarats) ||
      typeof batch.sentQuantity !== 'number' ||
      !Number.isInteger(batch.sentQuantity) ||
      typeof batch.returnedDate !== 'string' ||
      typeof batch.returnedCarats !== 'number' ||
      !Number.isFinite(batch.returnedCarats) ||
      typeof batch.returnedQuantity !== 'number' ||
      !Number.isInteger(batch.returnedQuantity) ||
      typeof batch.cuttingCostCop !== 'number' ||
      !Number.isInteger(batch.cuttingCostCop) ||
      typeof batch.cuttingPaidDate !== 'string' ||
      typeof batch.notes !== 'string'
    ) {
      return 'El lote contiene datos inválidos en una tanda de talla.';
    }
  }
  const sales = lot.sales;
  for (const value of sales) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return 'El lote contiene una venta inválida.';
    }
    const sale = value as Record<string, unknown>;
    const id = typeof sale.id === 'string' ? sale.id : '';
    const previousSale = previous?.sales.find((candidate) => candidate.id === id);
    if (
      previousSale?.origin === 'tallado' &&
      !Object.prototype.hasOwnProperty.call(sale, 'origin')
    ) {
      return 'Esta versión no conserva el origen tallado de una venta existente.';
    }
    if (
      Object.prototype.hasOwnProperty.call(sale, 'origin') &&
      sale.origin !== 'bruto' &&
      sale.origin !== 'tallado'
    ) {
      return 'El origen de la venta no es válido.';
    }
    if (
      Object.prototype.hasOwnProperty.call(sale, 'productType') &&
      typeof sale.productType !== 'string'
    ) {
      return 'El tipo de producto de la venta no es válido.';
    }

    const rate = Object.prototype.hasOwnProperty.call(sale, 'usdRate') ? sale.usdRate : null;
    const rateError = validateOptionalUsdRate(rate);
    if (rateError) return rateError;
    if (previousSale && previousSale.usdRate !== rate) {
      return 'La tasa guardada de una venta no se puede cambiar.';
    }

    if (
      Object.prototype.hasOwnProperty.call(sale, 'payments') &&
      !Array.isArray(sale.payments)
    ) {
      return 'Los abonos de la venta no son válidos.';
    }
    const payments = Array.isArray(sale.payments) ? sale.payments : [];
    for (const paymentValue of payments) {
      if (
        typeof paymentValue !== 'object' ||
        paymentValue === null ||
        Array.isArray(paymentValue)
      ) {
        return 'La venta contiene un abono inválido.';
      }
      const payment = paymentValue as Record<string, unknown>;
      const paymentId = typeof payment.id === 'string' ? payment.id : '';
      const previousPayment = previousSale?.payments.find(
        (candidate) => candidate.id === paymentId
      );
      const paymentRate = Object.prototype.hasOwnProperty.call(payment, 'usdRate')
        ? payment.usdRate
        : null;
      const paymentRateError = validateOptionalUsdRate(paymentRate);
      if (paymentRateError) return paymentRateError;
      if (previousPayment && previousPayment.usdRate !== paymentRate) {
        return 'La tasa guardada de un abono no se puede cambiar.';
      }
    }
  }
  return null;
}

/** Valida una tanda antes de agregarla o reemplazarla dentro de su lote. */
export function validateCuttingBatch(
  lot: StoneLot,
  batch: CuttingBatch,
  excludeBatchId?: string
): string | null {
  if (stoneLotPurchaseOrigin(lot) === 'tallado') {
    return 'Un lote comprado ya tallado no necesita tandas de talla.';
  }
  if (!isValidISODate(batch.sentDate)) return 'La tanda necesita una fecha de envío válida.';
  if (batch.sentDate < lot.purchaseDate) {
    return 'No puedes enviar a talla antes de la compra del lote.';
  }
  if (!Number.isFinite(batch.sentCarats) || batch.sentCarats < 0) {
    return 'Los quilates enviados no son válidos.';
  }
  if (!Number.isInteger(batch.sentQuantity) || batch.sentQuantity < 0) {
    return 'El número de piedras enviadas debe ser un entero válido.';
  }
  if (batch.sentCarats <= 0) return 'Indica cuántos quilates enviaste a talla.';
  if (batch.sentQuantity <= 0) return 'Indica cuántas piedras enviaste a talla.';
  if (!Number.isFinite(batch.returnedCarats) || batch.returnedCarats < 0) {
    return 'Los quilates que regresaron no son válidos.';
  }
  if (!Number.isInteger(batch.returnedQuantity) || batch.returnedQuantity < 0) {
    return 'El número de piezas que regresaron debe ser un entero válido.';
  }
  if (!Number.isInteger(batch.cuttingCostCop) || batch.cuttingCostCop < 0) {
    return 'El costo de talla debe guardarse en pesos enteros.';
  }
  if (!batch.returnedDate) {
    if (batch.returnedCarats > 0 || batch.returnedQuantity > 0) {
      return 'Una tanda pendiente no puede tener resultado de regreso.';
    }
  } else {
    if (!isValidISODate(batch.returnedDate)) return 'La fecha de regreso no es válida.';
    if (batch.returnedDate < batch.sentDate) {
      return 'La tanda no puede regresar antes de haber sido enviada.';
    }
    if (batch.returnedCarats > batch.sentCarats) {
      return 'La talla nunca puede devolver más quilates de los enviados.';
    }
  }
  if (batch.cuttingPaidDate) {
    if (!isValidISODate(batch.cuttingPaidDate)) return 'La fecha de pago de la talla no es válida.';
    if (batch.cuttingPaidDate < batch.sentDate) {
      return 'La talla no puede pagarse antes de enviar la tanda.';
    }
    if (batch.cuttingCostCop <= 0) return 'Indica el costo antes de marcar la talla como pagada.';
  }

  const others = lot.cuttingBatches.filter((candidate) => candidate.id !== excludeBatchId);
  const available = summarizeStoneLot({ ...lot, cuttingBatches: others });
  if (round3(batch.sentCarats) > round3(available.rawAvailableCarats)) {
    return `El lote solo tiene ${available.rawAvailableCarats} ct en bruto disponibles.`;
  }
  if (batch.sentQuantity > available.rawAvailableQuantity) {
    return `El lote solo tiene ${available.rawAvailableQuantity} piedra(s) en bruto disponibles.`;
  }
  return null;
}

/** Valida una salida interna antes de enlazarla con la historia de una joya. */
export function validateStoneInternalUse(
  lot: StoneLot,
  use: StoneInternalUse,
  excludeUseId?: string
): string | null {
  if (!use.id.trim()) return 'El uso interno necesita un identificador.';
  if (!isValidISODate(use.date)) return 'El uso interno necesita una fecha valida.';
  if (use.date < lot.purchaseDate) return 'No puedes usar la piedra antes de comprar el lote.';
  if (!use.jewelId.trim()) return 'El uso interno necesita la joya que recibio la piedra.';
  if (use.origin !== 'bruto' && use.origin !== 'tallado') {
    return 'El origen del uso interno no es valido.';
  }
  if (!Number.isFinite(use.carats) || use.carats <= 0) {
    return 'El uso interno necesita quilates validos.';
  }
  if (Math.abs(use.carats - round3(use.carats)) > 1e-9) {
    return 'Los quilates del uso interno admiten maximo tres decimales.';
  }
  if (!Number.isInteger(use.quantity) || use.quantity <= 0) {
    return 'El uso interno necesita un numero entero de piedras.';
  }
  if (!Number.isSafeInteger(use.costCop) || use.costCop < 0) {
    return 'El costo atribuido debe guardarse en pesos enteros.';
  }

  const others = (lot.internalUses ?? []).filter((candidate) => candidate.id !== excludeUseId);
  const available = summarizeStoneLot({ ...lot, internalUses: others });
  const availableCarats =
    use.origin === 'tallado' ? available.cutAvailableCarats : available.rawAvailableCarats;
  const availableQuantity =
    use.origin === 'tallado' ? available.cutAvailableQuantity : available.rawAvailableQuantity;
  const label = use.origin === 'tallado' ? 'tallados' : 'en bruto';
  if (round3(use.carats) > round3(availableCarats)) {
    return `El lote solo tiene ${availableCarats} ct ${label} disponibles.`;
  }
  if (use.quantity > availableQuantity) {
    return `El lote solo tiene ${availableQuantity} piedra(s) ${label} disponibles.`;
  }
  return null;
}

function returnedBatchInventoryChanged(
  previous: CuttingBatch,
  next: CuttingBatch | undefined
): boolean {
  return (
    !next ||
    previous.sentDate !== next.sentDate ||
    previous.sentCarats !== next.sentCarats ||
    previous.sentQuantity !== next.sentQuantity ||
    previous.returnedDate !== next.returnedDate ||
    previous.returnedCarats !== next.returnedCarats ||
    previous.returnedQuantity !== next.returnedQuantity
  );
}

/**
 * Defensa completa de existencias para almacenamiento, nube e importaciones.
 * La pantalla usa validaciones específicas, pero ninguna escritura puede
 * confiar únicamente en la pantalla (regla 6.4.14).
 */
function validateStoneLotInventoryBase(
  lot: StoneLot,
  previous?: StoneLot | null
): string | null {
  if (
    lot.purchaseOrigin !== undefined &&
    lot.purchaseOrigin !== 'bruto' &&
    lot.purchaseOrigin !== 'tallado'
  ) {
    return 'El estado de compra del lote no es valido.';
  }
  if (!Array.isArray(lot.cuttingBatches)) return 'Las tandas de talla no son válidas.';
  if (!Array.isArray(lot.sales)) return 'Las ventas del lote no son válidas.';
  if (stoneLotPurchaseOrigin(lot) === 'tallado' && lot.cuttingBatches.length > 0) {
    return 'Un lote comprado ya tallado no puede tener tandas de talla.';
  }
  if (new Set(lot.cuttingBatches.map((batch) => batch.id)).size !== lot.cuttingBatches.length) {
    return 'El lote contiene tandas de talla repetidas.';
  }
  for (const sale of lot.sales) {
    if (sale.origin !== 'bruto' && sale.origin !== 'tallado') {
      return 'El origen de una venta de piedras no es válido.';
    }
  }
  for (const batch of lot.cuttingBatches) {
    const error = validateCuttingBatch(lot, batch, batch.id);
    if (error) return error;
  }

  if (previous) {
    const purchaseOriginChanged =
      stoneLotPurchaseOrigin(previous) !== stoneLotPurchaseOrigin(lot);
    const hasPhysicalHistory =
      previous.sales.length > 0 ||
      previous.cuttingBatches.length > 0 ||
      (previous.internalUses ?? []).length > 0 ||
      lot.sales.length > 0 ||
      lot.cuttingBatches.length > 0 ||
      (lot.internalUses ?? []).length > 0;
    if (purchaseOriginChanged && hasPhysicalHistory) {
      return 'El estado de compra no se puede cambiar porque el lote ya tiene movimientos.';
    }
  }

  const summary = summarizeStoneLot(lot);
  if (summary.rawAvailableCarats < 0 || summary.rawAvailableQuantity < 0) {
    return 'Las salidas en bruto superan las existencias compradas del lote.';
  }
  if (summary.cutAvailableCarats < 0 || summary.cutAvailableQuantity < 0) {
    return 'Las ventas talladas superan lo que ya regresó de talla.';
  }

  if (previous) {
    const talladoAlreadyUsed =
      previous.sales.some((sale) => sale.origin === 'tallado') ||
      lot.sales.some((sale) => sale.origin === 'tallado');
    if (talladoAlreadyUsed) {
      for (const oldBatch of previous.cuttingBatches) {
        if (!oldBatch.returnedDate) continue;
        const nextBatch = lot.cuttingBatches.find((candidate) => candidate.id === oldBatch.id);
        if (returnedBatchInventoryChanged(oldBatch, nextBatch)) {
          return 'Esta tanda ya regresó y parte de lo tallado ya se vendió; cambiar sus datos físicos borraría el origen de esas ventas.';
        }
      }
    }
  }
  return null;
}

/** Copia del lote con una tanda agregada o reemplazada. */
export function validateStoneLotInventory(
  lot: StoneLot,
  previous?: StoneLot | null
): string | null {
  if (!Array.isArray(lot.internalUses)) return 'Los usos internos no son validos.';
  if (new Set(lot.internalUses.map((use) => use.id)).size !== lot.internalUses.length) {
    return 'El lote contiene usos internos repetidos.';
  }
  for (const use of lot.internalUses) {
    const error = validateStoneInternalUse(lot, use, use.id);
    if (error) return error;
  }

  if (previous) {
    for (const oldUse of previous.internalUses ?? []) {
      const nextUse = lot.internalUses.find((candidate) => candidate.id === oldUse.id);
      if (!nextUse || JSON.stringify(nextUse) !== JSON.stringify(oldUse)) {
        return 'Un uso interno ya registrado no se puede cambiar ni deshacer.';
      }
    }

    const talladoUsedInternally =
      (previous.internalUses ?? []).some((use) => use.origin === 'tallado') ||
      lot.internalUses.some((use) => use.origin === 'tallado');
    if (talladoUsedInternally) {
      for (const oldBatch of previous.cuttingBatches) {
        if (!oldBatch.returnedDate) continue;
        const nextBatch = lot.cuttingBatches.find((candidate) => candidate.id === oldBatch.id);
        if (returnedBatchInventoryChanged(oldBatch, nextBatch)) {
          return 'Esta tanda ya produjo piedras usadas en una joya; cambiar sus datos fisicos borraria ese origen.';
        }
      }
    }
  }

  return validateStoneLotInventoryBase(lot, previous);
}

export function withCuttingBatch(lot: StoneLot, batch: CuttingBatch, nowIso: string): StoneLot {
  const exists = lot.cuttingBatches.some((candidate) => candidate.id === batch.id);
  return {
    ...lot,
    cuttingBatches: exists
      ? lot.cuttingBatches.map((candidate) => (candidate.id === batch.id ? batch : candidate))
      : [...lot.cuttingBatches, batch],
    updatedAt: nowIso
  };
}

/** Copia del lote sin una tanda. La validación decide si el historial permite borrarla. */
export function withoutCuttingBatch(lot: StoneLot, batchId: string, nowIso: string): StoneLot {
  return {
    ...lot,
    cuttingBatches: lot.cuttingBatches.filter((batch) => batch.id !== batchId),
    updatedAt: nowIso
  };
}

export function emptyCuttingBatch(today: string): CuttingBatch {
  return {
    id: newId(),
    sentDate: today,
    sentCarats: 0,
    sentQuantity: 1,
    returnedDate: '',
    returnedCarats: 0,
    returnedQuantity: 0,
    cuttingCostCop: 0,
    cuttingPaidDate: '',
    notes: ''
  };
}

/**
 * Revisa un pago al proveedor ANTES de guardarlo. Devuelve el motivo del
 * rechazo en lenguaje humano, o null si es válido. `excludePaymentId`
 * permite editar un pago sin que se cuente a sí mismo.
 */
export function validateSupplierPayment(
  lot: StoneLot,
  payment: SupplierPayment,
  excludePaymentId?: string
): string | null {
  if (!lot.onCredit) return 'Los pagos al proveedor solo se registran en compras a crédito.';
  if (!isValidISODate(payment.date)) return 'El pago necesita una fecha válida.';
  const amount = toSafeCOP(payment.amount);
  if (amount <= 0) return 'Indica el monto pagado al proveedor.';

  const others = lot.supplierPayments.filter((p) => p.id !== excludePaymentId);
  const summary = summarizeStoneLot({ ...lot, supplierPayments: others });
  if (amount > summary.supplierDebt) {
    return `Solo debes ${summary.supplierDebt.toLocaleString('es-CO')} de este lote.`;
  }
  return null;
}

/**
 * Protege el historial de una compra cuando se edita el lote. Los pagos ya
 * registrados nunca se borran ni pueden quedar por encima del costo, ligados
 * a otro proveedor o dentro de una compra marcada como contado.
 */
export function validateStoneLotPurchaseUpdate(
  previous: StoneLot | null,
  next: StoneLot
): string | null {
  const ownershipError = validateStoneLotOwnership(next);
  if (ownershipError) return ownershipError;
  if (previous) {
    const paymentsChanged =
      previous.supplierPayments.length !== next.supplierPayments.length ||
      previous.supplierPayments.some((payment, index) => {
        const candidate = next.supplierPayments[index];
        return (
          !candidate ||
          payment.id !== candidate.id ||
          payment.date !== candidate.date ||
          payment.amount !== candidate.amount ||
          payment.notes !== candidate.notes
        );
      });
    if (paymentsChanged) {
      return 'Los pagos existentes no se pueden borrar ni cambiar desde la edición de la compra.';
    }

    const salesChanged =
      previous.sales.length !== next.sales.length ||
      previous.sales.some((sale, index) => {
        const candidate = next.sales[index];
        return (
          !candidate ||
          sale.id !== candidate.id ||
          sale.date !== candidate.date ||
          sale.buyer !== candidate.buyer ||
          sale.buyerId !== candidate.buyerId ||
          sale.carats !== candidate.carats ||
          sale.quantity !== candidate.quantity ||
          sale.origin !== candidate.origin ||
          sale.valueCop !== candidate.valueCop ||
          sale.productType !== candidate.productType ||
          sale.usdRate !== candidate.usdRate ||
          sale.onCredit !== candidate.onCredit ||
          sale.dueDate !== candidate.dueDate ||
          // Los abonos ya recibidos son historial: no se tocan desde la compra.
          JSON.stringify(sale.payments) !== JSON.stringify(candidate.payments) ||
          sale.notes !== candidate.notes
        );
      });
    if (salesChanged) {
      return 'Las ventas existentes no se pueden borrar ni cambiar desde la edición de la compra.';
    }
    if (JSON.stringify(previous.cuttingBatches) !== JSON.stringify(next.cuttingBatches)) {
      return 'Las tandas de talla no se pueden cambiar desde la edición de la compra.';
    }
  }

  if (
    previous &&
    JSON.stringify(previous.internalUses ?? []) !== JSON.stringify(next.internalUses ?? [])
  ) {
    return 'Los usos internos no se pueden cambiar desde la edicion de la compra.';
  }

  const paidToSupplier = next.supplierPayments.reduce(
    (total, payment) => total + toSafeCOP(payment.amount),
    0
  );

  if (toSafeCOP(next.purchaseValueCop) < paidToSupplier) {
    return `El costo del lote no puede ser menor que los ${paidToSupplier.toLocaleString(
      'es-CO'
    )} ya pagados al proveedor.`;
  }

  if (!next.onCredit && next.supplierPayments.length > 0) {
    return 'No puedes cambiar esta compra a contado porque ya tiene pagos al proveedor.';
  }

  if (previous && previous.supplierPayments.length > 0) {
    const supplierChanged =
      previous.supplierId !== next.supplierId ||
      previous.supplier.trim() !== next.supplier.trim();
    if (supplierChanged) {
      return 'No puedes cambiar el proveedor porque este lote ya tiene pagos registrados.';
    }
  }

  return null;
}

/** Copia del lote con un pago al proveedor agregado o reemplazado. */
export function withSupplierPayment(lot: StoneLot, payment: SupplierPayment, nowIso: string): StoneLot {
  const exists = lot.supplierPayments.some((p) => p.id === payment.id);
  return {
    ...lot,
    supplierPayments: exists
      ? lot.supplierPayments.map((p) => (p.id === payment.id ? payment : p))
      : [...lot.supplierPayments, payment],
    updatedAt: nowIso
  };
}

/** Copia del lote sin el pago indicado. */
export function withoutSupplierPayment(lot: StoneLot, paymentId: string, nowIso: string): StoneLot {
  return {
    ...lot,
    supplierPayments: lot.supplierPayments.filter((p) => p.id !== paymentId),
    updatedAt: nowIso
  };
}

/** Pago al proveedor en blanco para el formulario. */
export function emptySupplierPayment(today: string): SupplierPayment {
  return { id: newId(), date: today, amount: 0, notes: '' };
}

/** Existencias por tipo de piedra, sumando lo que queda en cada lote. */
export interface StoneInventoryEntry {
  /** Nombre mostrado del tipo (primera aparición con texto). */
  stoneType: string;
  /** Lotes que aún tienen existencias. */
  activeLots: number;
  remainingCarats: number;
  remainingQuantity: number;
  rawAvailableCarats: number;
  rawAvailableQuantity: number;
  inCuttingCarats: number;
  inCuttingQuantity: number;
  cutAvailableCarats: number;
  cutAvailableQuantity: number;
}

function typeKey(stoneType: string): string {
  return stoneType.trim().toLowerCase() || 'sin especificar';
}

export function stonesInventory(lots: readonly StoneLot[]): StoneInventoryEntry[] {
  const byType = new Map<string, StoneInventoryEntry>();
  for (const lot of lots) {
    const summary = summarizeStoneLot(lot);
    if (summary.exhausted) continue;
    const key = typeKey(lot.stoneType);
    const entry =
      byType.get(key) ??
      {
        stoneType: lot.stoneType.trim() || 'Sin especificar',
        activeLots: 0,
        remainingCarats: 0,
        remainingQuantity: 0,
        rawAvailableCarats: 0,
        rawAvailableQuantity: 0,
        inCuttingCarats: 0,
        inCuttingQuantity: 0,
        cutAvailableCarats: 0,
        cutAvailableQuantity: 0
      };
    entry.activeLots += 1;
    entry.remainingCarats = round3(entry.remainingCarats + Math.max(0, summary.remainingCarats));
    entry.remainingQuantity += Math.max(0, summary.remainingQuantity);
    entry.rawAvailableCarats = round3(
      entry.rawAvailableCarats + Math.max(0, summary.rawAvailableCarats)
    );
    entry.rawAvailableQuantity += Math.max(0, summary.rawAvailableQuantity);
    entry.inCuttingCarats = round3(entry.inCuttingCarats + Math.max(0, summary.inCuttingCarats));
    entry.inCuttingQuantity += Math.max(0, summary.inCuttingQuantity);
    entry.cutAvailableCarats = round3(
      entry.cutAvailableCarats + Math.max(0, summary.cutAvailableCarats)
    );
    entry.cutAvailableQuantity += Math.max(0, summary.cutAvailableQuantity);
    byType.set(key, entry);
  }
  return [...byType.values()].sort((a, b) =>
    a.stoneType.localeCompare(b.stoneType, 'es', { sensitivity: 'base' })
  );
}

/** Flujo de dinero del negocio de piedras (decisión: existencias + flujo). */
export interface StonesFlow {
  /** COP invertido comprando lotes (contado + crédito). */
  totalSpent: number;
  /** COP pagado por tandas de talla. Ya está incluido en totalSpent. */
  totalCuttingPaid: number;
  /** COP trasladado a joyas. No entra a caja y sale del costo pendiente del lote. */
  totalInternalAttributed: number;
  /** COP vendido al PRECIO ACORDADO, haya entrado o no (D-042). */
  totalEarned: number;
  /** COP realmente recibido: contado completo + abonos de las ventas a crédito. */
  totalReceived: number;
  /** Ventas − compras. Negativo es normal si hay lotes sin vender todavía. */
  balance: number;
  /** COP que aún se les debe a los proveedores por lotes a crédito (C4). */
  totalDebt: number;
  /** COP que los compradores aún deben por ventas a crédito (D-042). */
  totalReceivable: number;
  lotCount: number;
  saleCount: number;
}

export function stonesFlow(lots: readonly StoneLot[]): StonesFlow {
  let totalSpent = 0;
  let totalCuttingPaid = 0;
  let totalInternalAttributed = 0;
  let totalEarned = 0;
  let totalReceived = 0;
  let totalDebt = 0;
  let totalReceivable = 0;
  let saleCount = 0;
  for (const lot of lots) {
    const summary = summarizeStoneLot(lot);
    totalSpent += summary.totalInvested;
    totalCuttingPaid += summary.paidCuttingCost;
    totalInternalAttributed += summary.internalAttributedCost;
    totalDebt += summary.supplierDebt;
    totalReceived += summary.receivedFromBuyers;
    totalReceivable += summary.buyersDebt;
    for (const sale of lot.sales) {
      totalEarned += toSafeCOP(sale.valueCop);
      saleCount += 1;
    }
  }
  return {
    totalSpent,
    totalCuttingPaid,
    totalInternalAttributed,
    totalEarned,
    totalReceived,
    balance: totalEarned - totalSpent,
    totalDebt,
    totalReceivable,
    lotCount: lots.length,
    saleCount
  };
}

/** Nombre visible del lote; si no tiene, se arma con la piedra. */
export function lotDisplayName(lot: Pick<StoneLot, 'name' | 'stoneType'>): string {
  return lot.name.trim() || `Lote de ${lot.stoneType.trim() || 'piedras'}`;
}

export function matchesLotSearch(
  lot: Pick<StoneLot, 'name' | 'stoneType' | 'description' | 'supplier' | 'partnerName'>,
  search: string
): boolean {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return `${lot.name} ${lot.stoneType} ${lot.description} ${lot.supplier} ${lot.partnerName}`
    .toLowerCase()
    .includes(term);
}

/** Lotes del más reciente al más antiguo, con desempate estable. */
export function compareStoneLots(a: StoneLot, b: StoneLot): number {
  const byDate = b.purchaseDate.localeCompare(a.purchaseDate);
  if (byDate !== 0) return byDate;
  const byCreated = (b.createdAt || '').localeCompare(a.createdAt || '');
  return byCreated !== 0 ? byCreated : b.id.localeCompare(a.id);
}

export function sortStoneLots(lots: readonly StoneLot[]): StoneLot[] {
  return [...lots].sort(compareStoneLots);
}

export function filterStoneLots(
  lots: readonly StoneLot[],
  search: string,
  filter: LotFilter
): StoneLot[] {
  const matching = lots.filter((lot) => {
    if (!matchesLotSearch(lot, search)) return false;
    if (filter === 'todos') return true;
    const exhausted = summarizeStoneLot(lot).exhausted;
    return filter === 'agotados' ? exhausted : !exhausted;
  });
  return sortStoneLots(matching);
}

export function countStoneLots(
  lots: readonly StoneLot[],
  search: string
): Record<LotFilter, number> {
  const counts: Record<LotFilter, number> = { existencias: 0, agotados: 0, todos: 0 };
  for (const lot of lots) {
    if (!matchesLotSearch(lot, search)) continue;
    counts.todos += 1;
    counts[summarizeStoneLot(lot).exhausted ? 'agotados' : 'existencias'] += 1;
  }
  return counts;
}

/**
 * Revisa una venta ANTES de guardarla. Devuelve el motivo del rechazo en
 * lenguaje humano, o null si la venta es válida. `excludeSaleId` permite
 * editar una venta existente sin que se cuente a sí misma.
 */
export function validateStoneSale(
  lot: StoneLot,
  sale: StoneSale,
  excludeSaleId?: string
): string | null {
  const previousSale = excludeSaleId
    ? lot.sales.find((candidate) => candidate.id === excludeSaleId)
    : undefined;
  if (sale.origin !== 'bruto' && sale.origin !== 'tallado') {
    return 'Elige si la venta sale de piedra en bruto o tallada.';
  }
  if (!previousSale && !sale.productType.trim()) return 'Elige el tipo de producto.';
  const rateError = validateOptionalUsdRate(sale.usdRate);
  if (rateError) return rateError;
  if (!previousSale && sale.usdRate === null) return 'Indica la tasa USD/COP de la venta.';
  if (previousSale && previousSale.usdRate !== sale.usdRate) {
    return 'La tasa guardada de una venta no se puede cambiar.';
  }
  if (!isValidISODate(sale.date)) return 'La venta necesita una fecha válida.';
  if (sale.quantity <= 0 && sale.carats <= 0) {
    return 'Indica cuántas piedras o cuántos quilates se vendieron.';
  }
  if (toSafeCOP(sale.valueCop) <= 0) return 'Indica el valor acordado de la venta.';
  if (!sale.onCredit) {
    const legacyCashSale = previousSale?.onCredit === false;
    const methodMayStayBlank = legacyCashSale && !(previousSale.method ?? '').trim();
    const receiverMayStayBlank = legacyCashSale && !(previousSale.receivedBy ?? '').trim();
    if (!methodMayStayBlank && !(sale.method ?? '').trim()) {
      return 'Indica cómo te pagaron esta venta.';
    }
    if (!receiverMayStayBlank && !(sale.receivedBy ?? '').trim()) {
      return 'Indica quién recibió el dinero de esta venta.';
    }
  }

  if (sale.onCredit) {
    if (!isValidISODate(sale.dueDate)) {
      return 'Una venta a crédito necesita la fecha en que quedaron de pagarte.';
    }
    if (sale.dueDate < sale.date) {
      return 'La fecha de pago no puede ser anterior a la venta.';
    }
    let abonado = 0;
    for (const payment of sale.payments) {
      if (!isValidISODate(payment.date)) return 'Un abono quedó sin fecha válida.';
      const amount = toSafeCOP(payment.amount);
      if (amount <= 0) return 'Un abono quedó sin monto.';
      abonado += amount;
    }
    if (abonado > toSafeCOP(sale.valueCop)) {
      return `Los abonos suman ${abonado.toLocaleString(
        'es-CO'
      )} y superan el valor de la venta.`;
    }
  } else if (sale.payments.length > 0) {
    // Una venta de contado ya cuenta su precio completo como dinero recibido:
    // conservar abonos duplicaría la plata al calcular la caja.
    return 'No puedes pasar esta venta a contado porque ya tiene abonos registrados.';
  }

  const others = lot.sales.filter((s) => s.id !== excludeSaleId);
  const summary = summarizeStoneLot({ ...lot, sales: others });
  const availableQuantity =
    sale.origin === 'tallado' ? summary.cutAvailableQuantity : summary.rawAvailableQuantity;
  const availableCarats =
    sale.origin === 'tallado' ? summary.cutAvailableCarats : summary.rawAvailableCarats;
  const label = sale.origin === 'tallado' ? 'tallada(s)' : 'en bruto';
  if (sale.quantity > availableQuantity) {
    return `El lote solo tiene ${availableQuantity} piedra(s) ${label} disponible(s).`;
  }
  if (round3(sale.carats) > round3(availableCarats)) {
    return `El lote solo tiene ${availableCarats} ct ${label} disponibles.`;
  }
  return null;
}

/**
 * Revisa un abono del comprador ANTES de guardarlo. Devuelve el motivo del
 * rechazo en lenguaje humano, o null si es válido. `excludePaymentId` permite
 * editar un abono sin que se cuente a sí mismo. Espeja a validateSupplierPayment.
 */
export function validateBuyerPayment(
  sale: StoneSale,
  payment: BuyerPayment,
  excludePaymentId?: string
): string | null {
  const previousPayment = excludePaymentId
    ? sale.payments.find((candidate) => candidate.id === excludePaymentId)
    : undefined;
  if (!sale.onCredit) return 'Los abonos solo se registran en ventas a crédito.';
  if (!isValidISODate(payment.date)) return 'El abono necesita una fecha válida.';
  const amount = toSafeCOP(payment.amount);
  if (amount <= 0) return 'Indica el monto que te abonaron.';
  const methodMayStayBlank = previousPayment && !(previousPayment.method ?? '').trim();
  const receiverMayStayBlank = previousPayment && !(previousPayment.receivedBy ?? '').trim();
  if (!methodMayStayBlank && !(payment.method ?? '').trim()) {
    return 'Indica cómo te pagaron este abono.';
  }
  if (!receiverMayStayBlank && !(payment.receivedBy ?? '').trim()) {
    return 'Indica quién recibió este abono.';
  }
  const rateError = validateOptionalUsdRate(payment.usdRate);
  if (rateError) return rateError;
  if (!previousPayment && payment.usdRate === null) return 'Indica la tasa USD/COP del abono.';
  if (previousPayment && previousPayment.usdRate !== payment.usdRate) {
    return 'La tasa guardada de un abono no se puede cambiar.';
  }

  const others = sale.payments.filter((p) => p.id !== excludePaymentId);
  const summary = summarizeStoneSale({ ...sale, payments: others });
  if (amount > summary.balanceCop) {
    return `Solo te deben ${summary.balanceCop.toLocaleString('es-CO')} de esta venta.`;
  }
  return null;
}

/** Copia de la venta con un abono del comprador agregado o reemplazado. */
export function withBuyerPayment(sale: StoneSale, payment: BuyerPayment): StoneSale {
  const exists = sale.payments.some((p) => p.id === payment.id);
  return {
    ...sale,
    payments: exists
      ? sale.payments.map((p) => (p.id === payment.id ? payment : p))
      : [...sale.payments, payment]
  };
}

/** Copia de la venta sin el abono indicado. */
export function withoutBuyerPayment(sale: StoneSale, paymentId: string): StoneSale {
  return { ...sale, payments: sale.payments.filter((p) => p.id !== paymentId) };
}

/** Abono del comprador en blanco para el formulario. */
export function emptyBuyerPayment(today: string, usdRate: number | null = null): BuyerPayment {
  return { id: newId(), date: today, amount: 0, usdRate, receivedBy: '', method: '', notes: '' };
}

/**
 * Cambia una venta entre contado y crédito SIN perder nunca los abonos ya
 * recibidos (hallazgo H1 de la auditoría propia, 2026-07-22).
 *
 * Vaciar los abonos aquí borraría dinero real del comprador y, peor todavía,
 * dejaría pasar a `validateStoneSale`: esa validación rechaza el cambio
 * precisamente porque quedan abonos, así que si desaparecen antes, nadie
 * avisa y el guardado destruye el historial de cobro.
 *
 * La fecha de pago solo se limpia cuando no hay nada que cobrar.
 */
export function withSaleCredit(sale: StoneSale, onCredit: boolean, today: string): StoneSale {
  if (onCredit) {
    return { ...sale, onCredit: true, dueDate: sale.dueDate || sale.date || today };
  }
  return {
    ...sale,
    onCredit: false,
    dueDate: sale.payments.length > 0 ? sale.dueDate : ''
  };
}

/** Copia del lote con una venta agregada o reemplazada, sin tocar el original. */
export function withLotSale(lot: StoneLot, sale: StoneSale, nowIso: string): StoneLot {
  const exists = lot.sales.some((s) => s.id === sale.id);
  return {
    ...lot,
    sales: exists ? lot.sales.map((s) => (s.id === sale.id ? sale : s)) : [...lot.sales, sale],
    updatedAt: nowIso
  };
}

/** Copia del lote sin la venta indicada. */
export function withoutLotSale(lot: StoneLot, saleId: string, nowIso: string): StoneLot {
  return { ...lot, sales: lot.sales.filter((s) => s.id !== saleId), updatedAt: nowIso };
}

/** Un lote es válido para guardar si tiene fecha real y tipo de piedra. */
export function isStoneLotValid(lot: StoneLot): boolean {
  return (
    isValidISODate(lot.purchaseDate) &&
    lot.stoneType.trim().length > 0 &&
    (lot.purchaseOrigin === undefined ||
      lot.purchaseOrigin === 'bruto' ||
      lot.purchaseOrigin === 'tallado')
  );
}

/** Lote en blanco para el formulario de nueva compra. */
export function emptyStoneLot(today: string, nowIso: string): StoneLot {
  return {
    purchaseOrigin: 'bruto',
    id: newId(),
    name: '',
    stoneType: '',
    description: '',
    purchaseDate: today,
    supplier: '',
    supplierId: null,
    carats: 0,
    quantity: 1,
    purchaseValueCop: 0,
    partnerId: null,
    partnerName: '',
    myPercent: 100,
    onCredit: false,
    supplierPayments: [],
    cuttingBatches: [],
    internalUses: [],
    notes: '',
    sales: [],
    createdAt: nowIso,
    updatedAt: nowIso
  };
}

/** Venta en blanco para el formulario de registrar venta. */
export function emptyStoneSale(today: string, usdRate: number | null = null): StoneSale {
  return {
    id: newId(),
    date: today,
    buyer: '',
    buyerId: null,
    carats: 0,
    quantity: 1,
    origin: 'bruto',
    valueCop: 0,
    productType: '',
    usdRate,
    receivedBy: '',
    method: '',
    onCredit: false,
    dueDate: '',
    payments: [],
    notes: ''
  };
}
