// Reparto entre socios de igualdad (D-072, D-073, D-075). Motor PURO: no toca
// almacenamiento, red ni fechas del sistema.
//
// Tres reglas gobiernan este archivo:
//
//  1. La participación se declara en PLATA PUESTA, no en porcentaje (D-073). El
//     porcentaje se deriva para mostrarlo y jamás se guarda.
//
//  2. La plata del FONDO de inversión se excluye de la base del reparto (D-072).
//     Es deuda: no compra participación. Su costo lo asume Santiago (D-075) y
//     por eso NO aparece en este archivo — se descuenta después, a nivel de
//     negocio, solo de su lado.
//
//  3. Cada socio recibe su parte TRUNCADA y todo peso residual queda del lado de
//     Santiago. Así la suma cuadra exacta al peso, tanto en ganancia como en
//     pérdida. Es la convención que ya usaba el reparto binario anterior.

import type { LotPartner, MaterialLotPartner } from '../types';

export interface PartnerShare {
  partnerId: string | null;
  partnerName: string;
  /** Plata que puso, COP entero. */
  amountCop: number;
  /** Su parte del resultado, COP entero. Negativa si el lote perdió. */
  resultCop: number;
}

export interface PartnershipSplit {
  /** true si hay al menos un socio de igualdad. */
  shared: boolean;
  /** Resultado real que se reparte. */
  realResultCop: number;
  /** Base del reparto: lo propio + los socios. NUNCA incluye el fondo. */
  equityBaseCop: number;
  /** Lo que puso Santiago. Derivado, nunca guardado. */
  myContributionCop: number;
  /** Plata del fondo que financió la compra. Excluida del reparto (D-072). */
  fundedFromFundCop: number;
  partners: PartnerShare[];
  /** Suma de las partes de los socios. */
  partnersResultCop: number;
  /** La parte de Santiago. Incluye siempre el peso residual del redondeo. */
  myResultCop: number;
  /**
   * true si los socios declaran MÁS plata de la que costó la parte no
   * financiada. Los datos están mal; el reparto se hace igual, tratando el
   * aporte de Santiago como cero, para no inventar cifras ni reventar.
   */
  overDeclared: boolean;
}

function normalizeAmount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

/** Socios con nombre o ficha y plata puesta mayor que cero. */
export function activePartners(partners: readonly LotPartner[] | undefined): LotPartner[] {
  if (!partners) return [];
  return partners.filter(
    (partner) => normalizeAmount(partner.amountCop) > 0 || partner.partnerId !== null || partner.partnerName.trim().length > 0
  );
}

/**
 * Reparte `realResultCop` entre Santiago y los socios, en proporción a lo que
 * puso cada uno sobre la base de patrimonio.
 *
 * `totalCostCop` es el costo total de la compra. La base del reparto es ese
 * costo MENOS lo que financió el fondo.
 */
export function splitByContribution(input: {
  totalCostCop: number;
  realResultCop: number;
  partners?: readonly LotPartner[];
  fundedFromFundCop?: number;
}): PartnershipSplit {
  const totalCost = normalizeAmount(input.totalCostCop);
  const fundedFromFundCop = Math.min(normalizeAmount(input.fundedFromFundCop ?? 0), totalCost);
  const realResultCop = Number.isFinite(input.realResultCop) ? Math.trunc(input.realResultCop) : 0;

  const declared = activePartners(input.partners);
  const partnerAmounts = declared.map((partner) => normalizeAmount(partner.amountCop));
  const partnersTotal = partnerAmounts.reduce((sum, amount) => sum + amount, 0);

  const nonFunded = totalCost - fundedFromFundCop;
  const rawMine = nonFunded - partnersTotal;
  const overDeclared = rawMine < 0;
  const myContributionCop = Math.max(0, rawMine);
  const equityBaseCop = myContributionCop + partnersTotal;

  // Sin base no hay proporción posible: todo queda del lado propio. Ocurre si el
  // lote se financió por completo con el fondo y nadie más puso plata.
  if (equityBaseCop <= 0) {
    return {
      shared: declared.length > 0,
      realResultCop,
      equityBaseCop: 0,
      myContributionCop: 0,
      fundedFromFundCop,
      partners: declared.map((partner, index) => ({
        partnerId: partner.partnerId,
        partnerName: partner.partnerName,
        amountCop: partnerAmounts[index],
        resultCop: 0
      })),
      partnersResultCop: 0,
      myResultCop: realResultCop,
      overDeclared
    };
  }

  const partners: PartnerShare[] = declared.map((partner, index) => {
    const amountCop = partnerAmounts[index];
    // Truncar acerca a cero: en ganancia el socio recibe un peso de menos y en
    // pérdida pierde un peso de menos. El residuo queda siempre con Santiago.
    const resultCop = Math.trunc((realResultCop * amountCop) / equityBaseCop);
    return {
      partnerId: partner.partnerId,
      partnerName: partner.partnerName,
      amountCop,
      resultCop
    };
  });

  const partnersResultCop = partners.reduce((sum, partner) => sum + partner.resultCop, 0);

  return {
    shared: declared.length > 0,
    realResultCop,
    equityBaseCop,
    myContributionCop,
    fundedFromFundCop,
    partners,
    partnersResultCop,
    myResultCop: realResultCop - partnersResultCop,
    overDeclared
  };
}

/**
 * Porcentaje de un socio sobre la base de patrimonio, solo para MOSTRAR.
 * Nunca se guarda ni se usa para calcular dinero (D-073).
 */
export function partnerPercent(split: PartnershipSplit, amountCop: number): number {
  if (split.equityBaseCop <= 0) return 0;
  return (amountCop * 100) / split.equityBaseCop;
}

/**
 * Convierte un registro del modelo anterior —socio único con `myPercent`— en la
 * lista de socios nueva, para poder leerlo sin romperse (D-073).
 *
 * Santiago depuró los datos el 2026-08-05, así que esto es solo robustez: no
 * pretende reconstruir historia al peso.
 */
export function partnersFromLegacy(legacy: {
  partnerId: string | null;
  partnerName: string;
  myPercent: number;
  totalCostCop: number;
}): LotPartner[] {
  const shared = legacy.partnerId !== null || legacy.partnerName.trim().length > 0;
  if (!shared) return [];
  const myPercent = Number.isFinite(legacy.myPercent) ? Math.min(100, Math.max(0, legacy.myPercent)) : 100;
  const totalCost = normalizeAmount(legacy.totalCostCop);
  const amountCop = Math.round((totalCost * (100 - myPercent)) / 100);
  return [
    {
      id: `legacy-${legacy.partnerId ?? 'sin-ficha'}`,
      partnerId: legacy.partnerId,
      partnerName: legacy.partnerName,
      amountCop
    }
  ];
}

/**
 * Valida la sociedad y la financiación de un lote o gasto (D-072, D-073).
 * Devuelve el primer problema en lenguaje llano, o null si está bien.
 */
export function validatePartnersAndFunding(input: {
  totalCostCop: number;
  partners?: readonly LotPartner[];
  fundedFromFundCop?: number;
}): string | null {
  const totalCost = normalizeAmount(input.totalCostCop);
  const funded = normalizeAmount(input.fundedFromFundCop ?? 0);
  const partners = input.partners ?? [];

  if ((input.fundedFromFundCop ?? 0) < 0) return 'La plata del fondo no puede ser negativa.';
  if (funded > totalCost) {
    return 'La plata del fondo no puede ser mayor que el costo del lote.';
  }

  const seen = new Set<string>();
  let partnersTotal = 0;
  for (const partner of partners) {
    const name = partner.partnerName.trim();
    if (partner.partnerId === null && name.length === 0) {
      return 'Falta decir quién es uno de los socios.';
    }
    if (!Number.isFinite(partner.amountCop) || partner.amountCop < 0) {
      return `La plata de ${name || 'un socio'} no es válida.`;
    }
    if (partner.amountCop === 0) {
      return `Escribe cuánto puso ${name || 'el socio'}.`;
    }
    const key = partner.partnerId ?? `name:${name.toLocaleLowerCase('es')}`;
    if (seen.has(key)) return `${name || 'Un socio'} está repetido.`;
    seen.add(key);
    partnersTotal += normalizeAmount(partner.amountCop);
  }

  if (partnersTotal + funded > totalCost) {
    return 'Entre los socios y el fondo se pasan del costo del lote.';
  }
  return null;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * MATERIAL: se comparte en GRAMOS, no en plata (D-049 + D-073)
 *
 * Del oro importa cuántos gramos son de cada quien, no cuánta plata puso. El
 * porcentaje se deriva igual que en el resto de la fase. Los gramos admiten
 * decimales —a diferencia del dinero, que es COP entero—, así que se redondean
 * a milésima, que es la precisión que ya usaba el lote.
 */

export interface MaterialShare {
  partnerId: string | null;
  partnerName: string;
  /** Gramos de este socio. */
  grams: number;
  /** Su porcentaje del lote, derivado solo para mostrar. */
  percent: number;
}

export interface MaterialSplit {
  shared: boolean;
  totalGrams: number;
  /** Gramos propios. Derivados: total menos la suma de los socios. */
  myGrams: number;
  myPercent: number;
  partners: MaterialShare[];
  partnersGrams: number;
  /** true si los socios declaran más gramos de los que tiene el lote. */
  overDeclared: boolean;
}

function roundGrams(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 1000) / 1000;
}

/** Reparte los gramos de un lote de material entre Santiago y sus socios. */
export function splitMaterialByGrams(input: {
  totalGrams: number;
  partners?: readonly MaterialLotPartner[];
}): MaterialSplit {
  const totalGrams = roundGrams(input.totalGrams);
  const declared = (input.partners ?? []).filter(
    (partner) =>
      roundGrams(partner.grams) > 0 ||
      partner.partnerId !== null ||
      partner.partnerName.trim().length > 0
  );
  const amounts = declared.map((partner) => roundGrams(partner.grams));
  const partnersGrams = roundGrams(amounts.reduce((sum, grams) => sum + grams, 0));
  const overDeclared = partnersGrams > totalGrams;
  const myGrams = roundGrams(Math.max(0, totalGrams - partnersGrams));
  const base = roundGrams(myGrams + partnersGrams);

  return {
    shared: declared.length > 0,
    totalGrams,
    myGrams,
    myPercent: base > 0 ? (myGrams * 100) / base : 0,
    partners: declared.map((partner, index) => ({
      partnerId: partner.partnerId,
      partnerName: partner.partnerName,
      grams: amounts[index],
      percent: base > 0 ? (amounts[index] * 100) / base : 0
    })),
    partnersGrams,
    overDeclared
  };
}

/** Convierte un lote de material del modelo de socio único a la lista nueva. */
export function materialPartnersFromLegacy(legacy: {
  partnerId: string | null;
  partnerName: string;
  myGrams: number;
  grams: number;
}): MaterialLotPartner[] {
  const shared = legacy.partnerId !== null || legacy.partnerName.trim().length > 0;
  if (!shared) return [];
  const grams = roundGrams(Math.max(0, legacy.grams - legacy.myGrams));
  return [
    {
      id: `legacy-${legacy.partnerId ?? 'sin-ficha'}`,
      partnerId: legacy.partnerId,
      partnerName: legacy.partnerName,
      grams
    }
  ];
}

/** Validación de los socios de un lote de material. */
export function validateMaterialPartners(input: {
  totalGrams: number;
  partners?: readonly MaterialLotPartner[];
}): string | null {
  const partners = input.partners ?? [];
  const seen = new Set<string>();
  let total = 0;
  for (const partner of partners) {
    const name = partner.partnerName.trim();
    if (partner.partnerId === null && name.length === 0) {
      return 'Falta decir quién es uno de los socios.';
    }
    if (!Number.isFinite(partner.grams) || partner.grams <= 0) {
      return `Escribe cuántos gramos son de ${name || 'el socio'}.`;
    }
    const key = partner.partnerId ?? `name:${name.toLocaleLowerCase('es')}`;
    if (seen.has(key)) return `${name || 'Un socio'} está repetido.`;
    seen.add(key);
    total += roundGrams(partner.grams);
  }
  if (roundGrams(total) > roundGrams(input.totalGrams)) {
    return 'Los socios suman más gramos de los que tiene el lote.';
  }
  return null;
}
