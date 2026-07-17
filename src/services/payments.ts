// Abonos recibidos del cliente. Funciones puras y testeables.
// USO INTERNO: nunca aparecen en el PDF ni el mensaje del cliente.

import type { ClientPayment } from '../types';
import { newId } from '../utils/id';
import { isValidISODate, todayISO } from '../utils/dates';
import { toSafeCOP } from '../utils/money';

export type ClientBalanceStatus = 'sinTotal' | 'pendiente' | 'pagada' | 'sobrepago';

export interface ClientBalanceSummary {
  /** Total cotizado normalizado como COP entero. */
  quoteTotal: number;
  /** Anticipo + abonos posteriores, normalizados como COP enteros. */
  paid: number;
  /** Lo que todavía falta. Nunca es negativo. */
  pending: number;
  /** Dinero recibido por encima del total. Nunca queda oculto dentro de "Pagada". */
  overpayment: number;
  status: ClientBalanceStatus;
}

export interface SettlementPaymentResult {
  payments: ClientPayment[];
  /** El único abono añadido por esta operación; null cuando no había un saldo válido. */
  addedPayment: ClientPayment | null;
}

export function emptyPayment(): ClientPayment {
  return {
    id: newId(),
    amount: 0,
    date: todayISO(),
    receivedBy: '',
    method: '',
    notes: ''
  };
}

/** Total abonado en COP entero. Montos inválidos o negativos cuentan como cero. */
export function paymentsTotal(payments: ClientPayment[]): number {
  return payments.reduce((sum, p) => sum + toSafeCOP(p.amount), 0);
}

/** Total ya pagado por el cliente: anticipo inicial + abonos posteriores. */
export function clientPaidTotal(deposit: number, payments: ClientPayment[]): number {
  return toSafeCOP(deposit) + paymentsTotal(payments);
}

/**
 * Estado completo y puro del dinero recibido. Distingue un pago exacto de un
 * sobrepago y evita tratar una cotización de $0 como si ya estuviera pagada.
 */
export function clientBalanceSummary(
  quoteTotal: number,
  deposit: number,
  payments: ClientPayment[]
): ClientBalanceSummary {
  const total = toSafeCOP(quoteTotal);
  const paid = clientPaidTotal(deposit, payments);

  if (total <= 0) {
    return { quoteTotal: 0, paid, pending: 0, overpayment: 0, status: 'sinTotal' };
  }
  if (paid < total) {
    return {
      quoteTotal: total,
      paid,
      pending: total - paid,
      overpayment: 0,
      status: 'pendiente'
    };
  }
  if (paid > total) {
    return {
      quoteTotal: total,
      paid,
      pending: 0,
      overpayment: paid - total,
      status: 'sobrepago'
    };
  }
  return { quoteTotal: total, paid, pending: 0, overpayment: 0, status: 'pagada' };
}

/** Lo que el cliente todavía debe. Nunca negativo: pagar de más no es saldo a favor. */
export function clientPendingBalance(
  quoteTotal: number,
  deposit: number,
  payments: ClientPayment[]
): number {
  return clientBalanceSummary(quoteTotal, deposit, payments).pending;
}

/**
 * Una joya está pagada cuando lo recibido cubre el total cotizado (D-028).
 * Es un estado DERIVADO del dinero, nunca una marca guardada: así la etiqueta
 * jamás puede contradecir las cuentas.
 */
export function isQuotePaidInFull(
  quoteTotal: number,
  deposit: number,
  payments: ClientPayment[]
): boolean {
  const status = clientBalanceSummary(quoteTotal, deposit, payments).status;
  return status === 'pagada' || status === 'sobrepago';
}

/**
 * Añade una sola vez un abono que cubre el saldo actual. Es idempotente:
 * repetirla sobre el resultado anterior devuelve la misma lista, y repetir el
 * mismo intento sobre datos antiguos tampoco duplica un id ya registrado.
 */
export function appendSettlementPayment(
  quoteTotal: number,
  deposit: number,
  payments: ClientPayment[],
  candidate: ClientPayment
): SettlementPaymentResult {
  if (payments.some((payment) => payment.id === candidate.id)) {
    return { payments, addedPayment: null };
  }

  const { pending, status } = clientBalanceSummary(quoteTotal, deposit, payments);
  if (status !== 'pendiente' || pending <= 0) {
    return { payments, addedPayment: null };
  }

  const addedPayment = {
    ...candidate,
    amount: pending,
    notes: candidate.notes.trim() || 'Pago del saldo pendiente'
  };
  return { payments: [...payments, addedPayment], addedPayment };
}

/**
 * Abono que salda exactamente lo que falta, fechado hoy (D-028). Devuelve null
 * si no hay nada pendiente, para no crear pagos de cero.
 */
export function settlementPayment(
  quoteTotal: number,
  deposit: number,
  payments: ClientPayment[]
): ClientPayment | null {
  return appendSettlementPayment(quoteTotal, deposit, payments, emptyPayment()).addedPayment;
}

/**
 * Compatibilidad con cotizaciones antiguas: un anticipo sin fecha puede seguir
 * igual, pero al crear o cambiar su monto ya necesita una fecha real.
 */
export function keepsLegacyUndatedDeposit(
  deposit: number,
  depositDate: string,
  initialDeposit: number,
  initialDepositDate: string
): boolean {
  return (
    toSafeCOP(initialDeposit) > 0 &&
    !isValidISODate(initialDepositDate) &&
    toSafeCOP(deposit) === toSafeCOP(initialDeposit) &&
    !isValidISODate(depositDate)
  );
}
