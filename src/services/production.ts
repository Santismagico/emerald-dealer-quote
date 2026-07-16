// Seguimiento de producción del taller. Funciones puras y testeables.
// TODO ESTO ES INTERNO: nunca aparece en el PDF ni el mensaje del cliente.

import type { ProductionStage } from '../types';
import { newId } from '../utils/id';
import { toSafeCOP } from '../utils/money';

/**
 * Etapas estándar del proceso de joyería, en orden de fabricación.
 * Nombres definidos por Santiago (corrección C1, 2026-07-16). Solo aplican a
 * trabajos que se aprueben desde ahora; las piezas ya aprobadas conservan
 * sus etapas tal cual (y siempre pueden renombrarse a mano).
 */
export const DEFAULT_STAGE_NAMES = [
  'Diseño',
  'Fundición',
  'Terminado y engaste',
  'Material',
  'Varios'
] as const;

export function emptyStage(name: string): ProductionStage {
  return {
    id: newId(),
    name,
    status: 'pendiente',
    completedAt: '',
    cost: 0,
    paid: false,
    paidAt: '',
    paidTo: '',
    paidBy: '',
    notes: ''
  };
}

/** Crea el seguimiento estándar para una pieza recién aprobada. */
export function defaultProductionStages(): ProductionStage[] {
  return DEFAULT_STAGE_NAMES.map((name) => emptyStage(name));
}

export interface ProductionSummary {
  /** Gasto total registrado en etapas (COP entero). */
  totalCost: number;
  /** Parte ya pagada. */
  paidCost: number;
  /** Parte pendiente por pagar. */
  pendingCost: number;
  /** Etapas marcadas como listas. */
  stagesDone: number;
  stagesTotal: number;
}

export function productionSummary(stages: ProductionStage[]): ProductionSummary {
  let totalCost = 0;
  let paidCost = 0;
  let stagesDone = 0;
  for (const stage of stages) {
    const cost = toSafeCOP(stage.cost);
    totalCost += cost;
    if (stage.paid) paidCost += cost;
    if (stage.status === 'lista') stagesDone += 1;
  }
  return {
    totalCost,
    paidCost,
    pendingCost: totalCost - paidCost,
    stagesDone,
    stagesTotal: stages.length
  };
}
