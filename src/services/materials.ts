// Lógica PURA del inventario de MATERIALES (oro, plata…) por lotes (D-048).
// Cada compra crea un lote rastreable y cada uso descuenta gramos de un lote
// específico. Existencias y reparto de propiedad se DERIVAN de los lotes y sus
// salidas; nunca hay un contador guardado a mano (regla de D-023). Todo es
// interno: ni el material ni su costo entran en documentos del cliente. El
// material es una lista aparte que se ajusta a mano y no toca el cotizador.

import type { MaterialLot, MaterialLotPartner, MaterialUse } from '../types';
import {
  materialPartnersFromLegacy,
  splitMaterialByGrams,
  validateMaterialPartners
} from './partnership';
import { isValidISODate } from '../utils/dates';
import { newId } from '../utils/id';

export type MaterialFilter = 'existencias' | 'agotados' | 'todos';

/** Redondeo a 3 decimales para que la resta de gramos no acumule ruido flotante. */
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Todo lo que se puede saber de un lote sin guardar nada: usado, restante y reparto. */
export interface MaterialLotSummary {
  lot: MaterialLot;
  usedGrams: number;
  remainingGrams: number;
  /** Gramos del restante que son suyos (mantiene el reparto del lote). */
  myRemainingGrams: number;
  /** Gramos del restante que son del socio. */
  partnerRemainingGrams: number;
  /** Porcentaje suyo del lote (0–100), derivado de myGrams/grams. 100 sin socio. */
  myPercent: number;
  /** true cuando el lote tiene socio y comparte propiedad. */
  shared: boolean;
  /** true cuando ya no quedan gramos por usar. */
  exhausted: boolean;
}

export function summarizeMaterialLot(lot: MaterialLot): MaterialLotSummary {
  let usedGrams = 0;
  for (const use of lot.uses) usedGrams += use.grams;
  usedGrams = round3(usedGrams);

  const remainingGrams = round3(Math.max(0, lot.grams - usedGrams));
  // El reparto vive en `partners` (D-073). Un lote guardado con el modelo de
  // socio único se convierte al vuelo, así que los lotes viejos dan lo mismo
  // que antes sin tocar lo guardado.
  const split = splitMaterialByGrams({ totalGrams: lot.grams, partners: materialLotPartners(lot) });
  const shared = split.shared;
  // El reparto se mantiene sobre lo que va quedando: si el lote era 60% suyo,
  // el 60% de lo que resta sigue siendo suyo.
  const myRatio = lot.grams > 0 ? Math.min(1, Math.max(0, split.myGrams / lot.grams)) : 1;
  const myRemainingGrams = round3(remainingGrams * myRatio);
  const partnerRemainingGrams = round3(remainingGrams - myRemainingGrams);

  return {
    lot,
    usedGrams,
    remainingGrams,
    myRemainingGrams,
    partnerRemainingGrams,
    myPercent: Math.round(myRatio * 100),
    shared,
    exhausted: remainingGrams <= 0
  };
}

/** Existencias por tipo+pureza, sumando lo que queda en cada lote. */
export interface MaterialInventoryEntry {
  /** Nombre mostrado del material (primera aparición con texto). */
  materialType: string;
  purity: string;
  activeLots: number;
  remainingGrams: number;
  /** De esos gramos, cuántos son suyos. */
  myRemainingGrams: number;
}

function inventoryKey(materialType: string, purity: string): string {
  const t = materialType.trim().toLowerCase() || 'sin especificar';
  const p = purity.trim().toLowerCase();
  return `${t}|${p}`;
}

export function materialsInventory(lots: readonly MaterialLot[]): MaterialInventoryEntry[] {
  const byKey = new Map<string, MaterialInventoryEntry>();
  for (const lot of lots) {
    const summary = summarizeMaterialLot(lot);
    if (summary.exhausted) continue;
    const key = inventoryKey(lot.materialType, lot.purity);
    const entry =
      byKey.get(key) ??
      {
        materialType: lot.materialType.trim() || 'Sin especificar',
        purity: lot.purity.trim(),
        activeLots: 0,
        remainingGrams: 0,
        myRemainingGrams: 0
      };
    entry.activeLots += 1;
    entry.remainingGrams = round3(entry.remainingGrams + summary.remainingGrams);
    entry.myRemainingGrams = round3(entry.myRemainingGrams + summary.myRemainingGrams);
    byKey.set(key, entry);
  }
  return [...byKey.values()].sort((a, b) => {
    const byType = a.materialType.localeCompare(b.materialType, 'es', { sensitivity: 'base' });
    return byType || a.purity.localeCompare(b.purity, 'es', { sensitivity: 'base' });
  });
}

/** Cuánto material se comparte con cada socio, y cuánto es suyo (D-049). */
export interface PartnerMaterialShare {
  partnerId: string | null;
  partnerName: string;
  /** Gramos restantes en los lotes compartidos con este socio. */
  sharedGrams: number;
  /** De esos gramos, cuántos son suyos. */
  myGrams: number;
  /** De esos gramos, cuántos son del socio. */
  partnerGrams: number;
  lotCount: number;
}

/**
 * Los socios de un lote de material (D-049 + D-073). Si el lote todavía guarda el
 * modelo de socio único, se convierte al vuelo.
 */
export function materialLotPartners(lot: MaterialLot): MaterialLotPartner[] {
  if (lot.partners && lot.partners.length > 0) return lot.partners;
  return materialPartnersFromLegacy({
    partnerId: lot.partnerId,
    partnerName: lot.partnerName,
    myGrams: lot.myGrams,
    grams: lot.grams
  });
}

/**
 * Material compartido acumulado **por cada socio** (D-073).
 *
 * Los gramos que quedan se reparten en proporción a lo que puso cada uno: si un
 * lote de 100 g con 40 de Ana y 20 de Luis ya gastó la mitad, a Ana le quedan 20
 * y a Luis 10.
 */
export function materialsByPartner(lots: readonly MaterialLot[]): PartnerMaterialShare[] {
  const byPartner = new Map<string, PartnerMaterialShare>();
  for (const lot of lots) {
    const summary = summarizeMaterialLot(lot);
    if (summary.remainingGrams <= 0) continue;
    const partners = materialLotPartners(lot);
    if (partners.length === 0) continue;

    const split = splitMaterialByGrams({ totalGrams: lot.grams, partners });
    if (split.totalGrams <= 0) continue;
    const ratio = summary.remainingGrams / split.totalGrams;

    for (const partner of split.partners) {
      const name = partner.partnerName.trim();
      const key = partner.partnerId ? `id:${partner.partnerId}` : `name:${name.toLowerCase()}`;
      const entry =
        byPartner.get(key) ??
        {
          partnerId: partner.partnerId,
          partnerName: name || 'Sin nombre',
          sharedGrams: 0,
          myGrams: 0,
          partnerGrams: 0,
          lotCount: 0
        };
      entry.sharedGrams = round3(entry.sharedGrams + summary.remainingGrams);
      entry.myGrams = round3(entry.myGrams + split.myGrams * ratio);
      entry.partnerGrams = round3(entry.partnerGrams + partner.grams * ratio);
      entry.lotCount += 1;
      byPartner.set(key, entry);
    }
  }
  return [...byPartner.values()].sort((a, b) => b.partnerGrams - a.partnerGrams);
}

/** Total de gramos por material en TODO el inventario, separando lo suyo. */
export interface MaterialsFlow {
  totalRemainingGrams: number;
  myRemainingGrams: number;
  sharedRemainingGrams: number;
  lotCount: number;
}

export function materialsFlow(lots: readonly MaterialLot[]): MaterialsFlow {
  let totalRemainingGrams = 0;
  let myRemainingGrams = 0;
  let sharedRemainingGrams = 0;
  for (const lot of lots) {
    const summary = summarizeMaterialLot(lot);
    totalRemainingGrams = round3(totalRemainingGrams + summary.remainingGrams);
    myRemainingGrams = round3(myRemainingGrams + summary.myRemainingGrams);
    if (summary.shared) {
      sharedRemainingGrams = round3(sharedRemainingGrams + summary.remainingGrams);
    }
  }
  return { totalRemainingGrams, myRemainingGrams, sharedRemainingGrams, lotCount: lots.length };
}

/** Motivo humano por el que un lote no se puede guardar, o null si es válido. */
export function validateMaterialLot(lot: MaterialLot): string | null {
  if (!isValidISODate(lot.purchaseDate)) return 'El lote necesita una fecha de compra válida.';
  if (!lot.materialType.trim()) return 'Indica qué material es (oro, plata…).';
  if (lot.grams <= 0) return 'Indica cuántos gramos compraste.';
  if (lot.myGrams < 0) return 'Los gramos que son tuyos no pueden ser negativos.';
  if (round3(lot.myGrams) > round3(lot.grams)) {
    return `Tu parte (${lot.myGrams} g) no puede ser mayor que el lote (${lot.grams} g).`;
  }
  const partnersError = validateMaterialPartners({
    totalGrams: lot.grams,
    partners: lot.partners
  });
  if (partnersError) return partnersError;
  return null;
}

/**
 * Revisa una salida ANTES de guardarla. Devuelve el motivo del rechazo en
 * lenguaje humano, o null si es válida. `excludeUseId` permite editar una
 * salida sin que se cuente a sí misma.
 */
export function validateMaterialUse(
  lot: MaterialLot,
  use: MaterialUse,
  excludeUseId?: string
): string | null {
  if (!isValidISODate(use.date)) return 'La salida necesita una fecha válida.';
  if (use.grams <= 0) return 'Indica cuántos gramos salieron.';
  const others = lot.uses.filter((u) => u.id !== excludeUseId);
  const remaining = summarizeMaterialLot({ ...lot, uses: others }).remainingGrams;
  if (round3(use.grams) > round3(remaining)) {
    return `El lote solo tiene ${remaining} g disponibles.`;
  }
  return null;
}

/** Copia del lote con una salida agregada o reemplazada, sin tocar el original. */
export function withMaterialUse(lot: MaterialLot, use: MaterialUse, nowIso: string): MaterialLot {
  const exists = lot.uses.some((u) => u.id === use.id);
  return {
    ...lot,
    uses: exists ? lot.uses.map((u) => (u.id === use.id ? use : u)) : [...lot.uses, use],
    updatedAt: nowIso
  };
}

/** Copia del lote sin la salida indicada. */
export function withoutMaterialUse(lot: MaterialLot, useId: string, nowIso: string): MaterialLot {
  return { ...lot, uses: lot.uses.filter((u) => u.id !== useId), updatedAt: nowIso };
}

/** Nombre visible del lote; si no tiene, se arma con el material y la fecha. */
export function materialLotDisplayName(
  lot: Pick<MaterialLot, 'name' | 'materialType' | 'purity'>
): string {
  if (lot.name.trim()) return lot.name.trim();
  const type = lot.materialType.trim() || 'Material';
  return lot.purity.trim() ? `${type} ${lot.purity.trim()}` : type;
}

export function matchesMaterialSearch(
  lot: Pick<MaterialLot, 'name' | 'materialType' | 'purity' | 'partnerName' | 'notes'>,
  search: string
): boolean {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return `${lot.name} ${lot.materialType} ${lot.purity} ${lot.partnerName} ${lot.notes}`
    .toLowerCase()
    .includes(term);
}

/** Lotes del más reciente al más antiguo, con desempate estable. */
export function compareMaterialLots(a: MaterialLot, b: MaterialLot): number {
  const byDate = b.purchaseDate.localeCompare(a.purchaseDate);
  if (byDate !== 0) return byDate;
  const byCreated = (b.createdAt || '').localeCompare(a.createdAt || '');
  return byCreated !== 0 ? byCreated : b.id.localeCompare(a.id);
}

export function sortMaterialLots(lots: readonly MaterialLot[]): MaterialLot[] {
  return [...lots].sort(compareMaterialLots);
}

export function filterMaterialLots(
  lots: readonly MaterialLot[],
  search: string,
  filter: MaterialFilter
): MaterialLot[] {
  const matching = lots.filter((lot) => {
    if (!matchesMaterialSearch(lot, search)) return false;
    if (filter === 'todos') return true;
    const exhausted = summarizeMaterialLot(lot).exhausted;
    return filter === 'agotados' ? exhausted : !exhausted;
  });
  return sortMaterialLots(matching);
}

export function countMaterialLots(
  lots: readonly MaterialLot[],
  search: string
): Record<MaterialFilter, number> {
  const counts: Record<MaterialFilter, number> = { existencias: 0, agotados: 0, todos: 0 };
  for (const lot of lots) {
    if (!matchesMaterialSearch(lot, search)) continue;
    counts.todos += 1;
    counts[summarizeMaterialLot(lot).exhausted ? 'agotados' : 'existencias'] += 1;
  }
  return counts;
}

/** Lote en blanco para el formulario de nueva compra: nace 100% suyo. */
export function emptyMaterialLot(today: string, nowIso: string): MaterialLot {
  return {
    id: newId(),
    name: '',
    materialType: '',
    purity: '',
    purchaseDate: today,
    grams: 0,
    costCop: 0,
    partnerId: null,
    partnerName: '',
    myGrams: 0,
    notes: '',
    uses: [],
    createdAt: nowIso,
    updatedAt: nowIso
  };
}

/** Salida en blanco para el formulario de registrar uso. */
export function emptyMaterialUse(today: string): MaterialUse {
  return { id: newId(), date: today, grams: 0, notes: '' };
}
