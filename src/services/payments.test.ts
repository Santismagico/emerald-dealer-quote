import { describe, it, expect } from 'vitest';
import { emptyPayment, paymentsTotal } from './payments';

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

  it('un abono nuevo nace con la fecha de hoy y monto cero', () => {
    const p = emptyPayment();
    expect(p.amount).toBe(0);
    expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
