// Abonos recibidos del cliente. Funciones puras y testeables.
// USO INTERNO: nunca aparecen en el PDF ni el mensaje del cliente.

import type { ClientPayment } from '../types';
import { newId } from '../utils/id';
import { todayISO } from '../utils/dates';
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
