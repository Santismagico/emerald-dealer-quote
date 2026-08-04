// Lógica PURA del negocio de piedras por LOTES (decisión de Santiago 2026-07-15):
// cada compra crea un lote rastreable y cada venta se descuenta de un lote
// específico. Existencias, dinero y resultado se DERIVAN de los lotes y sus
// ventas; nunca existe un contador guardado a mano. Todo es interno (COP
// entero): ninguna piedra ni precio entra en canales de cliente.

import type { BuyerPayment, StoneLot, StoneSale, SupplierPayment } from '../types';
import { isValidISODate } from '../utils/dates';
import { newId } from '../utils/id';
import { toSafeCOP } from '../utils/money';
import { validateOptionalUsdRate } from './currency';

export type LotFilter = 'existencias' | 'agotados' | 'todos';

/** Redondeo a 3 decimales para que la resta de quilates no acumule ruido flotante. */
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
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
  /** COP recibido por las ventas del lote. */
  soldValue: number;
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
  let soldValue = 0;
  let receivedFromBuyers = 0;
  let buyersDebt = 0;
  for (const sale of lot.sales) {
    soldCarats += sale.carats;
    soldQuantity += sale.quantity;
    // `soldValue` es el precio ACORDADO: así el resultado del lote no cambia de
    // significado por vender a crédito. El dinero real va aparte (D-042).
    soldValue += toSafeCOP(sale.valueCop);
    const summary = summarizeStoneSale(sale);
    receivedFromBuyers += summary.receivedCop;
    buyersDebt += summary.balanceCop;
  }
  soldCarats = round3(soldCarats);
  const remainingCarats = round3(lot.carats - soldCarats);
  const remainingQuantity = lot.quantity - soldQuantity;

  let paidToSupplier = 0;
  for (const payment of lot.supplierPayments) {
    paidToSupplier += toSafeCOP(payment.amount);
  }
  const purchaseValue = toSafeCOP(lot.purchaseValueCop);
  const supplierDebt = lot.onCredit ? Math.max(0, purchaseValue - paidToSupplier) : 0;

  return {
    lot,
    soldCarats,
    soldQuantity,
    soldValue,
    remainingCarats,
    remainingQuantity,
    exhausted: remainingCarats <= 0 && remainingQuantity <= 0,
    result: soldValue - purchaseValue,
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

export function summarizeStonePartnership(lot: StoneLot): StonePartnershipSummary {
  const summary = summarizeStoneLot(lot);
  const shared = lot.partnerId !== null || lot.partnerName.trim().length > 0;
  const realResult = summary.receivedFromBuyers - toSafeCOP(lot.purchaseValueCop);
  const myPercent = shared ? lot.myPercent : 100;
  // El socio recibe la parte truncada y el peso residual queda siempre del lado
  // propio. Esto conserva la suma exacta tanto en ganancias como en pérdidas.
  const partnerResult = Math.trunc((realResult * (100 - myPercent)) / 100);
  const myResult = realResult - partnerResult;
  return { shared, realResult, myResult, partnerResult };
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
  const lot = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  if (!Array.isArray(lot.sales)) return 'Las ventas del lote no son válidas.';
  const sales = lot.sales;
  for (const value of sales) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return 'El lote contiene una venta inválida.';
    }
    const sale = value as Record<string, unknown>;
    const id = typeof sale.id === 'string' ? sale.id : '';
    const previousSale = previous?.sales.find((candidate) => candidate.id === id);
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
        remainingQuantity: 0
      };
    entry.activeLots += 1;
    entry.remainingCarats = round3(entry.remainingCarats + Math.max(0, summary.remainingCarats));
    entry.remainingQuantity += Math.max(0, summary.remainingQuantity);
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
  let totalEarned = 0;
  let totalReceived = 0;
  let totalDebt = 0;
  let totalReceivable = 0;
  let saleCount = 0;
  for (const lot of lots) {
    totalSpent += toSafeCOP(lot.purchaseValueCop);
    const summary = summarizeStoneLot(lot);
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
  if (sale.quantity > summary.remainingQuantity) {
    return `El lote solo tiene ${summary.remainingQuantity} piedra(s) disponible(s).`;
  }
  if (round3(sale.carats) > round3(summary.remainingCarats)) {
    return `El lote solo tiene ${summary.remainingCarats} ct disponibles.`;
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
  return isValidISODate(lot.purchaseDate) && lot.stoneType.trim().length > 0;
}

/** Lote en blanco para el formulario de nueva compra. */
export function emptyStoneLot(today: string, nowIso: string): StoneLot {
  return {
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
