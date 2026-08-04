// Operacion PURA de C2: una sola decision transforma la joya y descuenta el
// lote. Persistencia y nube deben guardar ambos resultados atomicamente.

import type {
  StockJewel,
  StockJewelStoneTransformation,
  StoneInternalUse,
  StoneLot,
  StoneOrigin
} from '../types';
import { isValidISODate } from '../utils/dates';
import { toSafeCOP } from '../utils/money';
import { summarizeStoneLot, validateStoneLotInventory } from './stones';
import { validateStockJewelStoneHistory } from './stockJewels';

export interface StoneJewelTransformationInput {
  id: string;
  date: string;
  lotId: string;
  jewelId: string;
  origin: StoneOrigin;
  carats: number;
  quantity: number;
  notes: string;
}

export interface StoneJewelTransformationResult {
  lot: StoneLot;
  jewel: StockJewel;
  internalUse: StoneInternalUse;
  transformation: StockJewelStoneTransformation;
  attributedCostCop: number;
}

/** Comprueba que las dos mitades persistidas describen el mismo traslado. */
export function validateStoneJewelTransformationLink(
  internalUse: StoneInternalUse,
  transformation: StockJewelStoneTransformation
): string | null {
  if (
    internalUse.id !== transformation.id ||
    internalUse.date !== transformation.date ||
    internalUse.jewelId !== transformation.jewelId ||
    internalUse.origin !== transformation.origin ||
    internalUse.carats !== transformation.carats ||
    internalUse.quantity !== transformation.quantity ||
    internalUse.costCop !== transformation.costCop ||
    internalUse.notes !== transformation.notes ||
    transformation.fromStoneKind !== 'fantasia' ||
    transformation.toStoneKind !== 'natural'
  ) {
    return 'El uso del lote y la transformacion de la joya no coinciden.';
  }
  return null;
}

/** Comprueba que toda la historia C2 exista una sola vez y cuadre en ambos módulos. */
export function validateStoneJewelTransformationCollections(
  stoneLots: readonly StoneLot[],
  stockJewels: readonly StockJewel[]
): string | null {
  const transformations = new Map<
    string,
    { jewel: StockJewel; transformation: StockJewelStoneTransformation }
  >();
  for (const jewel of stockJewels) {
    const historyError = validateStockJewelStoneHistory(jewel);
    if (historyError) return historyError;
    for (const transformation of jewel.stoneTransformations ?? []) {
      if (transformations.has(transformation.id)) {
        return 'Hay una transformación de joya repetida.';
      }
      transformations.set(transformation.id, { jewel, transformation });
    }
  }

  const useIds = new Set<string>();
  for (const lot of stoneLots) {
    for (const use of lot.internalUses ?? []) {
      if (useIds.has(use.id)) return 'Hay un uso interno de piedras repetido.';
      useIds.add(use.id);
      const linked = transformations.get(use.id);
      if (!linked) {
        return 'Un uso interno de piedras no tiene su transformación de joya correspondiente.';
      }
      if (
        linked.transformation.lotId !== lot.id ||
        linked.jewel.id !== use.jewelId ||
        validateStoneJewelTransformationLink(use, linked.transformation) !== null
      ) {
        return 'El uso interno y la transformación de joya no coinciden.';
      }
    }
  }
  for (const id of transformations.keys()) {
    if (!useIds.has(id)) {
      return 'Una transformación de joya no tiene su uso interno de piedras correspondiente.';
    }
  }
  return null;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Costo fijo que se traslada; se calcula en milésimas de quilate. */
export function attributedStoneCostCop(lot: StoneLot, carats: number): number {
  const purchasedMilliCarats = Math.round(lot.carats * 1000);
  const consumedMilliCarats = Math.round(carats * 1000);
  if (purchasedMilliCarats <= 0 || consumedMilliCarats <= 0) return 0;
  return Math.round(
    (toSafeCOP(summarizeStoneLot(lot).totalInvested) * consumedMilliCarats) /
      purchasedMilliCarats
  );
}

export function validateStoneJewelTransformation(
  lot: StoneLot,
  jewel: StockJewel,
  input: StoneJewelTransformationInput
): string | null {
  if (!input.id.trim()) return 'La transformacion necesita un identificador.';
  if (input.lotId !== lot.id || input.jewelId !== jewel.id) {
    return 'La joya o el lote no coinciden con la transformacion.';
  }
  if ((lot.internalUses ?? []).some((use) => use.id === input.id)) {
    return 'Esta transformacion ya fue descontada del lote.';
  }
  if ((jewel.stoneTransformations ?? []).some((item) => item.id === input.id)) {
    return 'Esta transformacion ya existe en la joya.';
  }
  if (jewel.sale) return 'Una joya vendida no se puede transformar.';
  if (jewel.stoneKind === 'natural') return 'Esta joya ya tiene piedra natural.';
  if (jewel.stoneKind !== 'fantasia') {
    return 'Primero clasifica la joya como piedra de fantasia.';
  }
  if ((jewel.stoneTransformations ?? []).length > 0) {
    return 'Una joya transformada no se puede transformar otra vez.';
  }
  if (!isValidISODate(lot.purchaseDate)) {
    return 'El lote necesita una fecha de compra valida antes de usar sus piedras.';
  }
  if (!isValidISODate(jewel.acquiredDate)) {
    return 'La joya necesita una fecha de entrada valida antes de transformarse.';
  }
  if (!isValidISODate(input.date)) return 'La transformacion necesita una fecha valida.';
  if (input.date < lot.purchaseDate) {
    return 'No puedes usar la piedra antes de comprar el lote.';
  }
  if (input.date < jewel.acquiredDate) {
    return 'No puedes transformar la joya antes de que entrara al inventario.';
  }
  if (input.origin !== 'bruto' && input.origin !== 'tallado') {
    return 'Elige si la piedra sale de bruto o tallado.';
  }
  if (!Number.isFinite(input.carats) || round3(input.carats) <= 0) {
    return 'Indica cuantos quilates naturales entran a la joya.';
  }
  if (Math.abs(input.carats - round3(input.carats)) > 1e-9) {
    return 'Los quilates admiten maximo tres decimales.';
  }
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    return 'Indica un numero entero de piedras naturales.';
  }
  if (jewel.stoneCount > 0 && input.quantity !== jewel.stoneCount) {
    return `La joya ya tiene registradas ${jewel.stoneCount} piedra(s); la transformacion debe conservar esa cantidad.`;
  }
  if (Math.round(lot.carats * 1000) <= 0) {
    return 'El lote no tiene quilates comprados para atribuir el costo.';
  }

  const attributedCostCop = attributedStoneCostCop(lot, input.carats);
  const currentJewelCostCop = toSafeCOP(jewel.costCop);
  if (
    !Number.isSafeInteger(attributedCostCop) ||
    !Number.isSafeInteger(currentJewelCostCop) ||
    !Number.isSafeInteger(currentJewelCostCop + attributedCostCop)
  ) {
    return 'El costo de la transformacion supera el rango seguro en pesos.';
  }

  const summary = summarizeStoneLot(lot);
  const availableCarats =
    input.origin === 'tallado' ? summary.cutAvailableCarats : summary.rawAvailableCarats;
  const availableQuantity =
    input.origin === 'tallado' ? summary.cutAvailableQuantity : summary.rawAvailableQuantity;
  const label = input.origin === 'tallado' ? 'tallados' : 'en bruto';
  if (round3(input.carats) > round3(availableCarats)) {
    return `El lote solo tiene ${availableCarats} ct ${label} disponibles.`;
  }
  if (input.quantity > availableQuantity) {
    return `El lote solo tiene ${availableQuantity} piedra(s) ${label} disponibles.`;
  }
  return null;
}

/**
 * Devuelve las dos entidades nuevas sin tocar las originales. Deshacer queda
 * bloqueado a proposito: borrar una mitad rompería inventario, costo e historia.
 */
export function transformStockJewelToNatural(
  lot: StoneLot,
  jewel: StockJewel,
  input: StoneJewelTransformationInput,
  nowIso: string
): StoneJewelTransformationResult {
  const error = validateStoneJewelTransformation(lot, jewel, input);
  if (error) throw new Error(error);

  const carats = round3(input.carats);
  const attributedCostCop = attributedStoneCostCop(lot, carats);
  const internalUse: StoneInternalUse = {
    id: input.id,
    date: input.date,
    carats,
    quantity: input.quantity,
    origin: input.origin,
    jewelId: jewel.id,
    costCop: attributedCostCop,
    notes: input.notes
  };
  const transformation: StockJewelStoneTransformation = {
    id: input.id,
    date: input.date,
    lotId: lot.id,
    jewelId: jewel.id,
    origin: input.origin,
    carats,
    quantity: input.quantity,
    costCop: attributedCostCop,
    notes: input.notes,
    fromStoneKind: 'fantasia',
    toStoneKind: 'natural'
  };
  const nextLot: StoneLot = {
    ...lot,
    internalUses: [...(lot.internalUses ?? []), internalUse],
    updatedAt: nowIso
  };
  const nextJewel: StockJewel = {
    ...jewel,
    stoneKind: 'natural',
    stoneCount: input.quantity,
    costCop: toSafeCOP(jewel.costCop) + attributedCostCop,
    stoneTransformations: [...(jewel.stoneTransformations ?? []), transformation],
    updatedAt: nowIso
  };

  const inventoryError = validateStoneLotInventory(nextLot, lot);
  if (inventoryError) throw new Error(inventoryError);
  const historyError = validateStockJewelStoneHistory(nextJewel, jewel);
  if (historyError) throw new Error(historyError);

  return {
    lot: nextLot,
    jewel: nextJewel,
    internalUse,
    transformation,
    attributedCostCop
  };
}
