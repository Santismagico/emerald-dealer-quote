// Abonos recibidos del cliente. Funciones puras y testeables.
// USO INTERNO: nunca aparecen en el PDF ni el mensaje del cliente.

import type { ClientPayment } from '../types';
import { newId } from '../utils/id';
import { todayISO } from '../utils/dates';
import { roundCOP } from '../utils/money';

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
  return payments.reduce(
    (sum, p) => sum + roundCOP(Math.max(Number.isFinite(p.amount) ? p.amount : 0, 0)),
    0
  );
}
