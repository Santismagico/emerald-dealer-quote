import { describe, it, expect } from 'vitest';
import {
  appendSettlementPayment,
  clientBalanceSummary,
  clientPaidTotal,
  clientPendingBalance,
  emptyPayment,
  isQuotePaidInFull,
  keepsLegacyUndatedDeposit,
  paymentsTotal,
  settlementPayment
} from './payments';
import { todayISO } from '../utils/dates';

describe('abonos del cliente', () => {
  it('suma el total abonado como entero', () => {
    const total = paymentsTotal([
      { ...emptyPayment(), amount: 1000000 },
      { ...emptyPayment(), amount: 500000.4 }
    ]);
    expect(total).toBe(1500000);
    expect(Number.isInteger(total)).toBe(true);
  });

  it('los montos negativos o inválidos cuentan como cero', () => {
    const total = paymentsTotal([
      { ...emptyPayment(), amount: -200000 },
      { ...emptyPayment(), amount: NaN },
      { ...emptyPayment(), amount: 300000 }
    ]);
    expect(total).toBe(300000);
  });

  it('lista vacía suma cero', () => {
    expect(paymentsTotal([])).toBe(0);
  });

  it('el anticipo pagado se suma a los abonos posteriores', () => {
    expect(
      clientPaidTotal(2000000, [
        { ...emptyPayment(), amount: 500000 },
        { ...emptyPayment(), amount: 250000 }
      ])
    ).toBe(2750000);
  });

  it('un anticipo inválido o negativo nunca resta dinero pagado', () => {
    expect(clientPaidTotal(-100000, [{ ...emptyPayment(), amount: 300000 }])).toBe(300000);
    expect(clientPaidTotal(Number.NaN, [])).toBe(0);
  });

  it('permite conservar un anticipo antiguo sin fecha si el monto no cambia', () => {
    expect(keepsLegacyUndatedDeposit(2000000, '', 2000000, '')).toBe(true);
    expect(keepsLegacyUndatedDeposit(2000000, 'fecha-inválida', 2000000, '')).toBe(true);
  });

  it('un anticipo nuevo o modificado sí necesita una fecha real', () => {
    expect(keepsLegacyUndatedDeposit(500000, '', 0, '')).toBe(false);
    expect(keepsLegacyUndatedDeposit(2500000, '', 2000000, '')).toBe(false);
    expect(keepsLegacyUndatedDeposit(2000000, '', 2000000, '2026-07-01')).toBe(false);
  });

  it('un abono nuevo nace con la fecha de hoy y monto cero', () => {
    const p = emptyPayment();
    expect(p.amount).toBe(0);
    expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('joya pagada como estado derivado del dinero (D-028)', () => {
  const total = 5000000;

  it('el saldo pendiente descuenta anticipo y abonos', () => {
    expect(clientPendingBalance(total, 2000000, [{ ...emptyPayment(), amount: 1000000 }])).toBe(
      2000000
    );
  });

  it('pagar de más deja el saldo en cero, nunca en negativo', () => {
    expect(clientPendingBalance(total, 6000000, [])).toBe(0);
    expect(clientBalanceSummary(total, 6000000, [])).toEqual({
      quoteTotal: total,
      paid: 6000000,
      pending: 0,
      overpayment: 1000000,
      status: 'sobrepago'
    });
  });

  it('distingue un pago exacto de un sobrepago', () => {
    expect(clientBalanceSummary(total, total, []).status).toBe('pagada');
    expect(clientBalanceSummary(total, total, []).overpayment).toBe(0);
    expect(clientBalanceSummary(total, total + 1, []).status).toBe('sobrepago');
    expect(clientBalanceSummary(total, total + 1, []).overpayment).toBe(1);
  });

  it('no está pagada mientras falte dinero', () => {
    expect(isQuotePaidInFull(total, 0, [])).toBe(false);
    expect(isQuotePaidInFull(total, 4999999, [])).toBe(false);
  });

  it('el anticipo solo ya puede dejarla pagada', () => {
    expect(isQuotePaidInFull(total, total, [])).toBe(true);
  });

  it('anticipo más abonos que cubren el total la dejan pagada', () => {
    expect(
      isQuotePaidInFull(total, 2000000, [
        { ...emptyPayment(), amount: 2000000 },
        { ...emptyPayment(), amount: 1000000 }
      ])
    ).toBe(true);
  });

  it('pagar de más también cuenta como pagada', () => {
    expect(isQuotePaidInFull(total, 0, [{ ...emptyPayment(), amount: 6000000 }])).toBe(true);
  });

  it('una cotización sin total no se marca pagada sola', () => {
    expect(isQuotePaidInFull(0, 0, [])).toBe(false);
    expect(clientBalanceSummary(0, 0, [])).toEqual({
      quoteTotal: 0,
      paid: 0,
      pending: 0,
      overpayment: 0,
      status: 'sinTotal'
    });
  });
});

describe('registrar el pago del saldo (D-028)', () => {
  const total = 5000000;

  it('crea un abono por lo que falta, fechado hoy', () => {
    const payment = settlementPayment(total, 2000000, [{ ...emptyPayment(), amount: 500000 }]);
    expect(payment?.amount).toBe(2500000);
    expect(payment?.date).toBe(todayISO());
  });

  it('el abono creado deja la joya pagada', () => {
    const payments = [{ ...emptyPayment(), amount: 500000 }];
    const settlement = settlementPayment(total, 0, payments);
    expect(isQuotePaidInFull(total, 0, [...payments, settlement!])).toBe(true);
  });

  it('salda el total completo cuando no se ha pagado nada', () => {
    expect(settlementPayment(total, 0, [])?.amount).toBe(total);
  });

  it('no crea un abono de cero si ya está pagada', () => {
    expect(settlementPayment(total, total, [])).toBeNull();
    expect(settlementPayment(total, 6000000, [])).toBeNull();
  });

  it('no crea una acción falsa para una cotización con total cero', () => {
    expect(settlementPayment(0, 0, [])).toBeNull();
  });

  it('es idempotente ante doble toque o reintento del mismo pago', () => {
    const candidate = {
      ...emptyPayment(),
      id: 'saldo-unico',
      date: '2026-07-16',
      notes: 'Pago del saldo pendiente'
    };

    const first = appendSettlementPayment(total, 1000000, [], candidate);
    const repeated = appendSettlementPayment(total, 1000000, first.payments, candidate);

    expect(first.addedPayment?.amount).toBe(4000000);
    expect(first.payments).toHaveLength(1);
    expect(repeated.addedPayment).toBeNull();
    expect(repeated.payments).toBe(first.payments);
  });

  it('el mismo id tampoco se duplica aunque el reintento llegue con datos antiguos', () => {
    const candidate = { ...emptyPayment(), id: 'saldo-unico' };
    const alreadyStored = [{ ...candidate, amount: 1000000 }];
    const repeated = appendSettlementPayment(total, 0, alreadyStored, candidate);

    expect(repeated.addedPayment).toBeNull();
    expect(repeated.payments).toBe(alreadyStored);
  });
});
