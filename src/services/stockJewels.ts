// Lógica PURA de las JOYAS EN STOCK (D-044): piezas ya fabricadas que están en
// vitrina para vender, no hechas por encargo. No pasan por el cotizador ni por
// el Taller: no tienen etapas de producción, ni anticipo, ni documento de
// cliente. Se venden SIEMPRE de contado, por decisión de Héctor.
//
// El estado "vendida" jamás se guarda: se DERIVA de que la pieza tenga venta
// (regla de D-023). Así un dato corrupto no puede dejar una joya marcada como
// vendida sin la venta que lo respalde.

import type { StockJewel, StockJewelSale } from '../types';
import { isValidISODate } from '../utils/dates';
import { newId } from '../utils/id';
import { toSafeCOP } from '../utils/money';

export type JewelFilter = 'disponibles' | 'vendidas' | 'todas';

/** Lo que se muestra. "vendida" no existe como estado guardado. */
export type StockJewelDisplayStatus = 'disponible' | 'apartada' | 'vendida';

export interface StockJewelSummary {
  jewel: StockJewel;
  displayStatus: StockJewelDisplayStatus;
  sold: boolean;
  /** Lo recibido por la pieza: 0 mientras no se vende. */
  receivedCop: number;
  /**
   * Vendida: recibido − costo (resultado real). En vitrina: precio pedido −
   * costo, que es la ganancia esperada, todavía no realizada.
   */
  resultCop: number;
}

export function summarizeStockJewel(jewel: StockJewel): StockJewelSummary {
  const cost = toSafeCOP(jewel.costCop);
  if (jewel.sale) {
    const receivedCop = toSafeCOP(jewel.sale.priceCop);
    return {
      jewel,
      displayStatus: 'vendida',
      sold: true,
      receivedCop,
      resultCop: receivedCop - cost
    };
  }
  return {
    jewel,
    displayStatus: jewel.status,
    sold: false,
    receivedCop: 0,
    resultCop: toSafeCOP(jewel.priceCop) - cost
  };
}

/** Flujo del negocio de joyas en stock: qué hay en vitrina y qué se ha vendido. */
export interface StockJewelsFlow {
  jewelCount: number;
  availableCount: number;
  soldCount: number;
  /** COP invertido en las piezas que siguen en vitrina. */
  inventoryCostCop: number;
  /** COP que se pide por lo que sigue en vitrina. */
  inventoryPriceCop: number;
  /** COP recibido por las piezas ya vendidas. */
  totalSoldCop: number;
  /** Recibido − costo de las piezas ya vendidas. */
  totalResultCop: number;
}

export function stockJewelsFlow(jewels: readonly StockJewel[]): StockJewelsFlow {
  let availableCount = 0;
  let soldCount = 0;
  let inventoryCostCop = 0;
  let inventoryPriceCop = 0;
  let totalSoldCop = 0;
  let totalResultCop = 0;

  for (const jewel of jewels) {
    const summary = summarizeStockJewel(jewel);
    if (summary.sold) {
      soldCount += 1;
      totalSoldCop += summary.receivedCop;
      totalResultCop += summary.resultCop;
      continue;
    }
    availableCount += 1;
    inventoryCostCop += toSafeCOP(jewel.costCop);
    inventoryPriceCop += toSafeCOP(jewel.priceCop);
  }

  return {
    jewelCount: jewels.length,
    availableCount,
    soldCount,
    inventoryCostCop,
    inventoryPriceCop,
    totalSoldCop,
    totalResultCop
  };
}

/** Motivo humano por el que la pieza no se puede guardar, o null si es válida. */
export function validateStockJewel(jewel: StockJewel): string | null {
  if (!jewel.name.trim()) return 'Ponle un nombre a la pieza.';
  if (!isValidISODate(jewel.acquiredDate)) {
    return 'La pieza necesita la fecha en que entró al inventario.';
  }
  if (toSafeCOP(jewel.priceCop) <= 0) return 'Indica en cuánto vendes la pieza.';
  return null;
}

/** Motivo humano por el que la venta no se puede registrar, o null si es válida. */
export function validateStockJewelSale(
  jewel: StockJewel,
  sale: StockJewelSale
): string | null {
  if (jewel.sale && jewel.sale.id !== sale.id) return 'Esta pieza ya está vendida.';
  if (!isValidISODate(sale.date)) return 'La venta necesita una fecha válida.';
  if (sale.date < jewel.acquiredDate) {
    return 'No puedes vender la pieza antes de que entrara al inventario.';
  }
  if (toSafeCOP(sale.priceCop) <= 0) return 'Indica el valor recibido por la venta.';
  return null;
}

/** Copia de la joya con su venta registrada. */
export function withJewelSale(
  jewel: StockJewel,
  sale: StockJewelSale,
  nowIso: string
): StockJewel {
  return { ...jewel, sale, updatedAt: nowIso };
}

/** Copia de la joya sin venta: vuelve a la vitrina como disponible. */
export function withoutJewelSale(jewel: StockJewel, nowIso: string): StockJewel {
  return { ...jewel, sale: null, status: 'disponible', updatedAt: nowIso };
}

/** Nombre visible de la pieza; si no tiene, se arma con el tipo. */
export function jewelDisplayName(jewel: Pick<StockJewel, 'name' | 'pieceType'>): string {
  return jewel.name.trim() || `${jewel.pieceType} sin nombre`;
}

export function matchesJewelSearch(
  jewel: Pick<StockJewel, 'name' | 'pieceType' | 'material' | 'notes'>,
  search: string
): boolean {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return `${jewel.name} ${jewel.pieceType} ${jewel.material} ${jewel.notes}`
    .toLowerCase()
    .includes(term);
}

/** De la más reciente a la más antigua, con desempate estable. */
export function compareStockJewels(a: StockJewel, b: StockJewel): number {
  const byDate = b.acquiredDate.localeCompare(a.acquiredDate);
  if (byDate !== 0) return byDate;
  const byCreated = (b.createdAt || '').localeCompare(a.createdAt || '');
  return byCreated !== 0 ? byCreated : b.id.localeCompare(a.id);
}

export function sortStockJewels(jewels: readonly StockJewel[]): StockJewel[] {
  return [...jewels].sort(compareStockJewels);
}

export function filterStockJewels(
  jewels: readonly StockJewel[],
  search: string,
  filter: JewelFilter
): StockJewel[] {
  const matching = jewels.filter((jewel) => {
    if (!matchesJewelSearch(jewel, search)) return false;
    if (filter === 'todas') return true;
    const sold = summarizeStockJewel(jewel).sold;
    return filter === 'vendidas' ? sold : !sold;
  });
  return sortStockJewels(matching);
}

export function countStockJewels(
  jewels: readonly StockJewel[],
  search: string
): Record<JewelFilter, number> {
  const counts: Record<JewelFilter, number> = { disponibles: 0, vendidas: 0, todas: 0 };
  for (const jewel of jewels) {
    if (!matchesJewelSearch(jewel, search)) continue;
    counts.todas += 1;
    counts[summarizeStockJewel(jewel).sold ? 'vendidas' : 'disponibles'] += 1;
  }
  return counts;
}

/** Joya en blanco para el formulario de nueva pieza. */
export function emptyStockJewel(today: string, nowIso: string): StockJewel {
  return {
    id: newId(),
    name: '',
    pieceType: 'anillo',
    material: 'Oro',
    photo: '',
    acquiredDate: today,
    costCop: 0,
    priceCop: 0,
    status: 'disponible',
    notes: '',
    sale: null,
    createdAt: nowIso,
    updatedAt: nowIso
  };
}

/** Venta en blanco para el formulario de vender una pieza. */
export function emptyStockJewelSale(today: string): StockJewelSale {
  return { id: newId(), date: today, buyer: '', buyerId: null, priceCop: 0, notes: '' };
}
