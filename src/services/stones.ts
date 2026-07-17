// Lógica PURA del negocio de piedras por LOTES (decisión de Santiago 2026-07-15):
// cada compra crea un lote rastreable y cada venta se descuenta de un lote
// específico. Existencias, dinero y resultado se DERIVAN de los lotes y sus
// ventas; nunca existe un contador guardado a mano. Todo es interno (COP
// entero): ninguna piedra ni precio entra en canales de cliente.

import type { StoneLot, StoneSale, SupplierPayment } from '../types';
import { isValidISODate } from '../utils/dates';
import { newId } from '../utils/id';
import { toSafeCOP } from '../utils/money';

export type LotFilter = 'existencias' | 'agotados' | 'todos';

/** Redondeo a 3 decimales para que la resta de quilates no acumule ruido flotante. */
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
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
}

export function summarizeStoneLot(lot: StoneLot): StoneLotSummary {
  let soldCarats = 0;
  let soldQuantity = 0;
  let soldValue = 0;
  for (const sale of lot.sales) {
    soldCarats += sale.carats;
    soldQuantity += sale.quantity;
    soldValue += toSafeCOP(sale.valueCop);
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
    creditSettled: lot.onCredit && supplierDebt <= 0
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
          sale.carats !== candidate.carats ||
          sale.quantity !== candidate.quantity ||
          sale.valueCop !== candidate.valueCop ||
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
  /** COP recibido por todas las ventas. */
  totalEarned: number;
  /** Ventas − compras. Negativo es normal si hay lotes sin vender todavía. */
  balance: number;
  /** COP que aún se les debe a los proveedores por lotes a crédito (C4). */
  totalDebt: number;
  lotCount: number;
  saleCount: number;
}

export function stonesFlow(lots: readonly StoneLot[]): StonesFlow {
  let totalSpent = 0;
  let totalEarned = 0;
  let totalDebt = 0;
  let saleCount = 0;
  for (const lot of lots) {
    totalSpent += toSafeCOP(lot.purchaseValueCop);
    totalDebt += summarizeStoneLot(lot).supplierDebt;
    for (const sale of lot.sales) {
      totalEarned += toSafeCOP(sale.valueCop);
      saleCount += 1;
    }
  }
  return {
    totalSpent,
    totalEarned,
    balance: totalEarned - totalSpent,
    totalDebt,
    lotCount: lots.length,
    saleCount
  };
}

/** Nombre visible del lote; si no tiene, se arma con la piedra. */
export function lotDisplayName(lot: Pick<StoneLot, 'name' | 'stoneType'>): string {
  return lot.name.trim() || `Lote de ${lot.stoneType.trim() || 'piedras'}`;
}

export function matchesLotSearch(
  lot: Pick<StoneLot, 'name' | 'stoneType' | 'description' | 'supplier'>,
  search: string
): boolean {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return `${lot.name} ${lot.stoneType} ${lot.description} ${lot.supplier}`
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
  if (!isValidISODate(sale.date)) return 'La venta necesita una fecha válida.';
  if (sale.quantity <= 0 && sale.carats <= 0) {
    return 'Indica cuántas piedras o cuántos quilates se vendieron.';
  }
  if (toSafeCOP(sale.valueCop) <= 0) return 'Indica el valor recibido por la venta.';

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
    onCredit: false,
    supplierPayments: [],
    notes: '',
    sales: [],
    createdAt: nowIso,
    updatedAt: nowIso
  };
}

/** Venta en blanco para el formulario de registrar venta. */
export function emptyStoneSale(today: string): StoneSale {
  return {
    id: newId(),
    date: today,
    buyer: '',
    carats: 0,
    quantity: 1,
    valueCop: 0,
    notes: ''
  };
}
