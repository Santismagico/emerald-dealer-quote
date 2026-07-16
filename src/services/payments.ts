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
