// Lógica PURA del negocio de piedras por LOTES (decisión de Santiago 2026-07-15):
// cada compra crea un lote rastreable y cada venta se descuenta de un lote
// específico. Existencias, dinero y resultado se DERIVAN de los lotes y sus
// ventas; nunca existe un contador guardado a mano. Todo es interno (COP
// entero): ninguna piedra ni precio entra en canales de cliente.

import type { StoneLot, StoneSale } from '../types';
import { isValidISODate } from '../utils/dates';
import { newId } from '../utils/id';

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
}

export function summarizeStoneLot(lot: StoneLot): StoneLotSummary {
  let soldCarats = 0;
  let soldQuantity = 0;
  let soldValue = 0;
  for (const sale of lot.sales) {
    soldCarats += sale.carats;
    soldQuantity += sale.quantity;
    soldValue += sale.valueCop;
  }
  soldCarats = round3(soldCarats);
  const remainingCarats = round3(lot.carats - soldCarats);
  const remainingQuantity = lot.quantity - soldQuantity;
  return {
    lot,
    soldCarats,
    soldQuantity,
    soldValue,
    remainingCarats,
    remainingQuantity,
    exhausted: remainingCarats <= 0 && remainingQuantity <= 0,
    result: soldValue - lot.purchaseValueCop
  };
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
  /** COP invertido comprando lotes. */
  totalSpent: number;
  /** COP recibido por todas las ventas. */
  totalEarned: number;
  /** Ventas − compras. Negativo es normal si hay lotes sin vender todavía. */
  balance: number;
  lotCount: number;
  saleCount: number;
}

export function stonesFlow(lots: readonly StoneLot[]): StonesFlow {
  let totalSpent = 0;
  let totalEarned = 0;
  let saleCount = 0;
  for (const lot of lots) {
    totalSpent += lot.purchaseValueCop;
    for (const sale of lot.sales) {
      totalEarned += sale.valueCop;
      saleCount += 1;
    }
  }
  return { totalSpent, totalEarned, balance: totalEarned - totalSpent, lotCount: lots.length, saleCount };
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
  if (sale.valueCop <= 0) return 'Indica el valor recibido por la venta.';

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
    carats: 0,
    quantity: 1,
    purchaseValueCop: 0,
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
