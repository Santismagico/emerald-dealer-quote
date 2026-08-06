// Fondo de inversión (D-072, D-074, D-076). Motor PURO: no toca almacenamiento,
// red ni el reloj del sistema — la fecha de corte siempre entra por parámetro.
//
// Reglas que gobiernan este archivo:
//
//  1. NO EXISTE "el saldo del fondo" como cifra guardada (D-076). Existe una
//     lista de aportes, cada uno con su persona, y todo se DERIVA de sumarlos.
//
//  2. Cada aporte es un préstamo independiente: no se mezcla con los demás ni se
//     ata a un lote (D-074). El "bolsillo común" es solo cuánta plata hay
//     disponible, no un problema de reparto.
//
//  3. Se paga PASE LO QUE PASE (D-072). Nada aquí depende de si un lote ganó o
//     perdió. Por eso este archivo no conoce lotes.

import type { FundContribution, FundPayment, FundReturnKind } from '../types';

export interface FundContributionBalance {
  contributionId: string;
  personId: string | null;
  personName: string;
  returnKind: FundReturnKind;
  /** Capital entregado, COP entero. */
  capitalCop: number;
  /** Meses cumplidos desde el aporte hasta la fecha de corte. */
  monthsElapsed: number;
  /** Rendimiento devengado a la fecha de corte, COP entero. */
  accruedReturnCop: number;
  /** Capital ya devuelto. */
  capitalRepaidCop: number;
  /** Rendimiento ya pagado. */
  returnPaidCop: number;
  /** Capital que falta por devolver. */
  capitalOutstandingCop: number;
  /** Rendimiento devengado que falta por pagar. */
  returnOutstandingCop: number;
  /** Todo lo que se le debe hoy: capital pendiente + rendimiento pendiente. */
  owedCop: number;
  /** true cuando ya no se le debe nada. El aporte NO se borra (D-076). */
  settled: boolean;
  /** Fecha pactada de devolución, o cadena vacía si no se pactó. */
  dueDate: string;
  /** true si hay plazo, ya pasó y todavía se le debe algo. */
  overdue: boolean;
}

export interface PersonFundSummary {
  personId: string | null;
  personName: string;
  contributionCount: number;
  /** Aportes que todavía deben algo. */
  openCount: number;
  capitalCop: number;
  accruedReturnCop: number;
  capitalRepaidCop: number;
  returnPaidCop: number;
  owedCop: number;
  /** Vencimiento más próximo entre sus aportes abiertos. Vacío si ninguno tiene plazo. */
  nextDueDate: string;
  overdue: boolean;
}

export interface FundTotals {
  personCount: number;
  contributionCount: number;
  capitalCop: number;
  accruedReturnCop: number;
  capitalRepaidCop: number;
  returnPaidCop: number;
  /** Deuda total del negocio con el fondo. */
  owedCop: number;
}

function toInteger(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return 0;
  return Math.trunc(value);
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parts(value: string): { year: number; month: number; day: number } | null {
  if (!isIsoDate(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Meses CUMPLIDOS entre dos fechas. Se cuentan meses enteros, no días sueltos,
 * porque así se habla el trato: "me da el 2 % cada mes". A los 45 días van dos
 * por ciento, no tres.
 *
 * Caso de borde cuidado: del 31 de enero al 28 de febrero sí es un mes cumplido,
 * aunque 28 < 31, porque febrero no tiene día 31.
 */
export function monthsElapsed(fromISO: string, toISO: string): number {
  const from = parts(fromISO);
  const to = parts(toISO);
  if (!from || !to) return 0;
  let months = (to.year - from.year) * 12 + (to.month - from.month);
  if (to.day < from.day) {
    const endOfToMonth = lastDayOfMonth(to.year, to.month);
    // Si el corte cae en el último día de su mes, el mes se considera cumplido.
    if (to.day < endOfToMonth) months -= 1;
  }
  return Math.max(0, months);
}

function paidOf(payments: readonly FundPayment[] | undefined, kind: FundPayment['kind']): number {
  if (!payments) return 0;
  return payments.reduce((sum, payment) => (payment.kind === kind ? sum + toInteger(payment.amountCop) : sum), 0);
}

/**
 * Rendimiento devengado de un aporte a la fecha de corte, COP entero.
 *
 * - `mensual`: capital × tasa × meses cumplidos. Sigue devengando después del
 *   plazo, porque la deuda no desaparece por vencerse.
 * - `fijo`: el rendimiento pactado se reconoce COMPLETO desde el primer día. Es
 *   una obligación que Santiago ya adquirió y no depende del tiempo ni del
 *   resultado; mostrarlo a plazos entendería mal el trato y subestimaría la deuda.
 */
export function accruedReturn(contribution: FundContribution, asOfISO: string): number {
  const capital = Math.max(0, toInteger(contribution.amountCop));
  if (capital === 0) return 0;

  if (contribution.returnKind === 'fijo') {
    const agreed = Math.max(0, toInteger(contribution.agreedTotalCop));
    return Math.max(0, agreed - capital);
  }

  const rate = contribution.monthlyRatePercent;
  if (rate === null || rate === undefined || !Number.isFinite(rate) || rate <= 0) return 0;
  const months = monthsElapsed(contribution.date, asOfISO);
  if (months === 0) return 0;
  return Math.round((capital * rate * months) / 100);
}

/** Estado de un aporte a una fecha de corte. Todo derivado, nada guardado (D-076). */
export function contributionBalance(
  contribution: FundContribution,
  asOfISO: string
): FundContributionBalance {
  const capitalCop = Math.max(0, toInteger(contribution.amountCop));
  const accruedReturnCop = accruedReturn(contribution, asOfISO);
  const capitalRepaidCop = paidOf(contribution.payments, 'capital');
  const returnPaidCop = paidOf(contribution.payments, 'rendimiento');
  const capitalOutstandingCop = capitalCop - capitalRepaidCop;
  const returnOutstandingCop = accruedReturnCop - returnPaidCop;
  const owedCop = capitalOutstandingCop + returnOutstandingCop;
  const dueDate = isIsoDate(contribution.dueDate) ? contribution.dueDate : '';

  return {
    contributionId: contribution.id,
    personId: contribution.personId,
    personName: contribution.personName,
    returnKind: contribution.returnKind,
    capitalCop,
    monthsElapsed: monthsElapsed(contribution.date, asOfISO),
    accruedReturnCop,
    capitalRepaidCop,
    returnPaidCop,
    capitalOutstandingCop,
    returnOutstandingCop,
    owedCop,
    settled: owedCop <= 0,
    dueDate,
    overdue: dueDate !== '' && dueDate < asOfISO && owedCop > 0
  };
}

function personKey(contribution: FundContribution): string {
  if (contribution.personId) return `id:${contribution.personId}`;
  return `name:${contribution.personName.trim().toLocaleLowerCase('es')}`;
}

/**
 * El fondo leído POR PERSONA (D-076). Nunca se devuelve un saldo único: el total
 * es la suma de estas filas, y va al pie de la pantalla, no al encabezado.
 */
export function fundByPerson(
  contributions: readonly FundContribution[],
  asOfISO: string
): PersonFundSummary[] {
  const byPerson = new Map<string, PersonFundSummary>();

  for (const contribution of contributions) {
    const balance = contributionBalance(contribution, asOfISO);
    const key = personKey(contribution);
    const current =
      byPerson.get(key) ??
      ({
        personId: contribution.personId,
        personName: contribution.personName.trim() || 'Sin nombre',
        contributionCount: 0,
        openCount: 0,
        capitalCop: 0,
        accruedReturnCop: 0,
        capitalRepaidCop: 0,
        returnPaidCop: 0,
        owedCop: 0,
        nextDueDate: '',
        overdue: false
      } satisfies PersonFundSummary);

    current.contributionCount += 1;
    current.capitalCop += balance.capitalCop;
    current.accruedReturnCop += balance.accruedReturnCop;
    current.capitalRepaidCop += balance.capitalRepaidCop;
    current.returnPaidCop += balance.returnPaidCop;
    current.owedCop += balance.owedCop;
    if (!balance.settled) {
      current.openCount += 1;
      if (balance.dueDate !== '' && (current.nextDueDate === '' || balance.dueDate < current.nextDueDate)) {
        current.nextDueDate = balance.dueDate;
      }
    }
    current.overdue = current.overdue || balance.overdue;

    byPerson.set(key, current);
  }

  return [...byPerson.values()].sort((a, b) => b.owedCop - a.owedCop);
}

/** Totales del fondo. Se DERIVAN de las personas; nunca son un contador guardado. */
export function fundTotals(contributions: readonly FundContribution[], asOfISO: string): FundTotals {
  const people = fundByPerson(contributions, asOfISO);
  return {
    personCount: people.length,
    contributionCount: contributions.length,
    capitalCop: people.reduce((sum, person) => sum + person.capitalCop, 0),
    accruedReturnCop: people.reduce((sum, person) => sum + person.accruedReturnCop, 0),
    capitalRepaidCop: people.reduce((sum, person) => sum + person.capitalRepaidCop, 0),
    returnPaidCop: people.reduce((sum, person) => sum + person.returnPaidCop, 0),
    owedCop: people.reduce((sum, person) => sum + person.owedCop, 0)
  };
}

/**
 * Costo del financiamiento que asume SANTIAGO SOLO (D-075).
 *
 * Es el rendimiento devengado del fondo. No se descuenta del reparto entre
 * socios de igualdad: se resta después, únicamente de su lado. Un socio nunca
 * paga un préstamo que no pidió.
 */
export function financingCostForOwner(
  contributions: readonly FundContribution[],
  asOfISO: string
): number {
  return fundTotals(contributions, asOfISO).accruedReturnCop;
}

export function emptyFundPayment(dateISO: string): FundPayment {
  return { id: crypto.randomUUID(), date: dateISO, amountCop: 0, kind: 'rendimiento', notes: '' };
}

export function emptyFundContribution(dateISO: string): FundContribution {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    personId: null,
    personName: '',
    date: dateISO,
    amountCop: 0,
    returnKind: 'mensual',
    monthlyRatePercent: null,
    agreedTotalCop: null,
    dueDate: '',
    payments: [],
    notes: '',
    createdAt: now,
    updatedAt: now
  };
}

/** Validación de negocio. Devuelve el primer problema, o null si está bien. */
export function validateFundContribution(contribution: FundContribution): string | null {
  if (contribution.personName.trim().length === 0 && contribution.personId === null) {
    return 'Escribe de quién es el aporte.';
  }
  if (!isIsoDate(contribution.date)) return 'La fecha del aporte no es válida.';
  const capital = toInteger(contribution.amountCop);
  if (capital <= 0) return 'El aporte debe ser mayor que cero.';

  if (contribution.returnKind === 'mensual') {
    const rate = contribution.monthlyRatePercent;
    if (rate === null || !Number.isFinite(rate) || rate < 0) {
      return 'Escribe el porcentaje mensual pactado.';
    }
    if (rate > 100) return 'El porcentaje mensual no puede pasar de 100.';
  } else {
    const agreed = toInteger(contribution.agreedTotalCop);
    if (agreed < capital) {
      return 'El total pactado no puede ser menor que la plata que puso.';
    }
  }

  if (contribution.dueDate !== '' && !isIsoDate(contribution.dueDate)) {
    return 'La fecha de devolución no es válida.';
  }
  if (contribution.dueDate !== '' && contribution.dueDate < contribution.date) {
    return 'La devolución no puede ser antes del aporte.';
  }

  for (const payment of contribution.payments) {
    if (!isIsoDate(payment.date)) return 'Un pago tiene una fecha que no es válida.';
    if (payment.date < contribution.date) return 'Un pago quedó antes del aporte.';
    if (toInteger(payment.amountCop) <= 0) return 'Un pago debe ser mayor que cero.';
  }

  return null;
}
