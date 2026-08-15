// Lógica PURA de las JOYAS EN STOCK (D-044): piezas ya fabricadas que están en
// vitrina para vender, no hechas por encargo. No pasan por el cotizador ni por
// el Taller: no tienen etapas de producción, ni anticipo, ni documento de
// cliente. Se venden SIEMPRE de contado, por decisión de Héctor.
//
// El estado "vendida" jamás se guarda: se DERIVA de que la pieza tenga venta
// (regla de D-023). Así un dato corrupto no puede dejar una joya marcada como
// vendida sin la venta que lo respalde.

import type {
  StockJewel,
  StockJewelSale,
  StockJewelStoneTransformation
} from '../types';
import { isValidISODate } from '../utils/dates';
import { newId } from '../utils/id';
import { toSafeCOP } from '../utils/money';
import { validateOptionalUsdRate } from './currency';

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
/** Costo trasladado desde lotes de piedras; no representa una nueva salida de caja. */
export function stockJewelTransformationCostCop(jewel: StockJewel): number {
  return (jewel.stoneTransformations ?? []).reduce(
    (total, transformation) => total + toSafeCOP(transformation.costCop),
    0
  );
}

/**
 * Dinero que salio de caja cuando entro la joya. El costo agregado despues por
 * transformaciones es un traslado interno y se excluye para conservar cierres.
 */
export function stockJewelAcquisitionCostCop(jewel: StockJewel): number {
  return Math.max(0, toSafeCOP(jewel.costCop) - stockJewelTransformationCostCop(jewel));
}

function validateStoneTransformation(
  jewel: StockJewel,
  transformation: StockJewelStoneTransformation
): string | null {
  if (!transformation.id.trim()) return 'La transformacion necesita un identificador.';
  if (!isValidISODate(transformation.date)) return 'La transformacion necesita una fecha valida.';
  if (transformation.date < jewel.acquiredDate) {
    return 'No puedes transformar la joya antes de que entrara al inventario.';
  }
  if (!transformation.lotId.trim() || transformation.jewelId !== jewel.id) {
    return 'La transformacion no coincide con su joya y lote de origen.';
  }
  if (transformation.lotName !== undefined && !transformation.lotName.trim()) {
    return 'El nombre historico del lote no puede quedar vacio.';
  }
  if (transformation.origin !== 'bruto' && transformation.origin !== 'tallado') {
    return 'El origen de la piedra transformada no es valido.';
  }
  if (!Number.isFinite(transformation.carats) || transformation.carats <= 0) {
    return 'La transformacion necesita quilates validos.';
  }
  if (!Number.isInteger(transformation.quantity) || transformation.quantity <= 0) {
    return 'La transformacion necesita un numero entero de piedras.';
  }
  if (!Number.isSafeInteger(transformation.costCop) || transformation.costCop < 0) {
    return 'El costo atribuido debe guardarse en pesos enteros.';
  }
  if (jewel.sale && transformation.date > jewel.sale.date) {
    return 'La transformacion no puede quedar despues de la fecha de venta.';
  }
  if (
    transformation.fromStoneKind !== 'fantasia' ||
    transformation.toStoneKind !== 'natural'
  ) {
    return 'La historia de la transformacion no es valida.';
  }
  return null;
}

/** Protege la historia y deja explicito que una transformacion no se deshace. */
export function validateStockJewelStoneHistory(
  jewel: StockJewel,
  previous?: StockJewel | null
): string | null {
  if (!['', 'fantasia', 'natural'].includes(jewel.stoneKind)) {
    return 'La clase de piedra de la joya no es valida.';
  }
  if (!Array.isArray(jewel.stoneTransformations)) {
    return 'La historia de piedras de la joya no es valida.';
  }
  if (jewel.stoneTransformations.length > 1) {
    return 'Una joya natural no puede transformarse otra vez.';
  }
  if (
    new Set(jewel.stoneTransformations.map((transformation) => transformation.id)).size !==
    jewel.stoneTransformations.length
  ) {
    return 'La joya contiene transformaciones repetidas.';
  }
  for (const transformation of jewel.stoneTransformations) {
    const error = validateStoneTransformation(jewel, transformation);
    if (error) return error;
  }
  if (jewel.stoneTransformations.length > 0 && jewel.stoneKind !== 'natural') {
    return 'Una joya transformada debe conservarse como piedra natural.';
  }
  if (
    jewel.stoneTransformations.length > 0 &&
    (!Number.isSafeInteger(jewel.costCop) || jewel.costCop < 0)
  ) {
    return 'El costo de una joya transformada debe guardarse en pesos enteros seguros.';
  }
  if (
    jewel.stoneTransformations.length > 0 &&
    jewel.stoneCount !== jewel.stoneTransformations[0].quantity
  ) {
    return 'El número de piedras debe conservar la cantidad de la transformación.';
  }
  if (toSafeCOP(jewel.costCop) < stockJewelTransformationCostCop(jewel)) {
    return 'El costo de la joya no puede ser menor que la piedra natural agregada.';
  }

  if (previous) {
    for (const oldTransformation of previous.stoneTransformations ?? []) {
      const nextTransformation = jewel.stoneTransformations.find(
        (candidate) => candidate.id === oldTransformation.id
      );
      if (
        !nextTransformation ||
        JSON.stringify(nextTransformation) !== JSON.stringify(oldTransformation)
      ) {
        return 'La transformacion ya registrada no se puede cambiar ni deshacer.';
      }
    }
    if (previous.stoneKind === 'natural' && jewel.stoneKind !== 'natural') {
      return 'Una joya natural no puede volver a fantasia ni quedar sin registrar.';
    }
    if (previous.stoneKind === 'fantasia' && jewel.stoneKind === '') {
      return 'Una joya clasificada como fantasia no puede volver a quedar sin registrar.';
    }
    if (
      previous.stoneKind === 'fantasia' &&
      jewel.stoneKind === 'natural' &&
      jewel.stoneTransformations.length !== (previous.stoneTransformations ?? []).length + 1
    ) {
      return 'El cambio de fantasia a natural necesita registrar su transformacion.';
    }
  }
  return null;
}

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
  if (!Number.isFinite(jewel.weightGrams) || jewel.weightGrams < 0) {
    return 'El peso de la pieza no es valido.';
  }
  if (!Number.isInteger(jewel.stoneCount) || jewel.stoneCount < 0) {
    return 'El numero de piedras debe ser un entero valido.';
  }
  const historyError = validateStockJewelStoneHistory(jewel);
  if (historyError) return historyError;
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
  const previousSale = jewel.sale?.id === sale.id ? jewel.sale : null;
  if (!previousSale && !sale.productType.trim()) return 'Elige el tipo de producto.';
  const rateError = validateOptionalUsdRate(sale.usdRate);
  if (rateError) return rateError;
  if (!previousSale && sale.usdRate === null) return 'Indica la tasa USD/COP de la venta.';
  if (previousSale && previousSale.usdRate !== sale.usdRate) {
    return 'La tasa guardada de una venta no se puede cambiar.';
  }
  if (!isValidISODate(sale.date)) return 'La venta necesita una fecha válida.';
  if (sale.date < jewel.acquiredDate) {
    return 'No puedes vender la pieza antes de que entrara al inventario.';
  }
  if (
    jewel.stoneTransformations.some((transformation) => transformation.date > sale.date)
  ) {
    return 'No puedes fechar la venta antes de la transformacion de la joya.';
  }
  if (toSafeCOP(sale.priceCop) <= 0) return 'Indica el valor recibido por la venta.';
  const methodMayStayBlank = previousSale && !(previousSale.method ?? '').trim();
  const receiverMayStayBlank = previousSale && !(previousSale.receivedBy ?? '').trim();
  if (!methodMayStayBlank && !(sale.method ?? '').trim()) {
    return 'Indica cómo te pagaron esta venta.';
  }
  if (!receiverMayStayBlank && !(sale.receivedBy ?? '').trim()) {
    return 'Indica quién recibió el dinero de esta venta.';
  }
  return null;
}

/**
 * Valida tipo/tasa sobre el valor original. Sin registro anterior acepta los
 * vacíos históricos; la pantalla exige los campos al crear una venta nueva.
 */
export function validateStockJewelSaleMetadata(
  raw: unknown,
  previous?: StockJewel | null
): string | null {
  const jewel = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  if (jewel.sale === null || jewel.sale === undefined) return null;
  if (typeof jewel.sale !== 'object' || Array.isArray(jewel.sale)) {
    return 'La venta de la joya no es válida.';
  }
  const sale = jewel.sale as Record<string, unknown>;
  const previousSale =
    typeof sale.id === 'string' && previous?.sale?.id === sale.id ? previous.sale : null;
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
    extraPhotos: [],
    acquiredDate: today,
    weightGrams: 0,
    size: '',
    stoneCount: 0,
    stoneKind: '',
    costCop: 0,
    priceCop: 0,
    status: 'disponible',
    notes: '',
    sale: null,
    collectionId: null,
    stoneTransformations: [],
    createdAt: nowIso,
    updatedAt: nowIso
  };
}

/** Venta en blanco para el formulario de vender una pieza. */
export function emptyStockJewelSale(
  today: string,
  usdRate: number | null = null
): StockJewelSale {
  return {
    id: newId(),
    date: today,
    buyer: '',
    buyerId: null,
    priceCop: 0,
    productType: '',
    usdRate,
    receivedBy: '',
    method: '',
    notes: ''
  };
}
