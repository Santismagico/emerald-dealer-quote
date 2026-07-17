// Abonos recibidos del cliente. Funciones puras y testeables.
// USO INTERNO: nunca aparecen en el PDF ni el mensaje del cliente.

import type { ClientPayment } from '../types';
import { newId } from '../utils/id';
import { isValidISODate, todayISO } from '../utils/dates';
import { toSafeCOP } from '../utils/money';

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

/** Lo que el cliente todavía debe. Nunca negativo: pagar de más no es saldo a favor. */
export function clientPendingBalance(
  quoteTotal: number,
  deposit: number,
  payments: ClientPayment[]
): number {
  return Math.max(0, toSafeCOP(quoteTotal) - clientPaidTotal(deposit, payments));
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
  const total = toSafeCOP(quoteTotal);
  return total > 0 && clientPaidTotal(deposit, payments) >= total;
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
  const pending = clientPendingBalance(quoteTotal, deposit, payments);
  if (pending <= 0) return null;
  return { ...emptyPayment(), amount: pending, notes: 'Pago del saldo pendiente' };
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
