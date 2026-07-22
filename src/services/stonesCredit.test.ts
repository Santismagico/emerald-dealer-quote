// Pruebas del CRÉDITO AL VENDER (D-042). Van aparte de stones.test.ts porque
// cubren un tema propio: el dinero que los compradores aún deben.

import { describe, expect, it } from 'vitest';
import type { BuyerPayment, StoneLot, StoneSale } from '../types';
import {
  emptyBuyerPayment,
  emptyStoneSale,
  summarizeStoneLot,
  summarizeStoneSale,
  validateBuyerPayment,
  validateStoneLotPurchaseUpdate,
  validateStoneSale,
  withBuyerPayment,
  withoutBuyerPayment
} from './stones';

function abono(overrides: Partial<BuyerPayment> = {}): BuyerPayment {
  return { id: 'ab-1', date: '2026-07-16', amount: 500000, notes: '', ...overrides };
}

function venta(overrides: Partial<StoneSale> = {}): StoneSale {
  return {
    id: 'v-1',
    date: '2026-07-15',
    buyer: 'Joyería Ejemplo',
    buyerId: null,
    carats: 1,
    quantity: 1,
    valueCop: 2000000,
    onCredit: false,
    dueDate: '',
    payments: [],
    notes: '',
    ...overrides
  };
}

function aCredito(overrides: Partial<StoneSale> = {}): StoneSale {
  return venta({ onCredit: true, dueDate: '2026-08-15', ...overrides });
}

function lote(overrides: Partial<StoneLot> = {}): StoneLot {
  return {
    id: 'l-1',
    name: 'Lote Ejemplo',
    stoneType: 'Esmeralda',
    description: '',
    purchaseDate: '2026-07-01',
    supplier: '',
    supplierId: null,
    carats: 10,
    quantity: 10,
    purchaseValueCop: 1000000,
    onCredit: false,
    supplierPayments: [],
    notes: '',
    sales: [],
    createdAt: '2026-07-01T09:00:00.000Z',
    updatedAt: '2026-07-01T09:00:00.000Z',
    ...overrides
  };
}

describe('cuánto se recibió de una venta', () => {
  it('una venta de contado da por recibido su precio completo', () => {
    const s = summarizeStoneSale(venta({ valueCop: 2000000 }));
    expect(s.receivedCop).toBe(2000000);
    expect(s.balanceCop).toBe(0);
  });

  it('una venta a crédito sin abonos no ha recibido nada', () => {
    const s = summarizeStoneSale(aCredito({ valueCop: 2000000 }));
    expect(s.receivedCop).toBe(0);
    expect(s.balanceCop).toBe(2000000);
    expect(s.settled).toBe(false);
  });

  it('dos abonos dejan el saldo correcto', () => {
    const s = summarizeStoneSale(
      aCredito({
        valueCop: 2000000,
        payments: [abono({ amount: 500000 }), abono({ id: 'ab-2', amount: 300000 })]
      })
    );
    expect(s.receivedCop).toBe(800000);
    expect(s.balanceCop).toBe(1200000);
  });

  it('el saldo llega exactamente a cero y la venta queda saldada', () => {
    const s = summarizeStoneSale(
      aCredito({ valueCop: 2000000, payments: [abono({ amount: 2000000 })] })
    );
    expect(s.balanceCop).toBe(0);
    expect(s.settled).toBe(true);
  });

  it('un abono corrupto nunca vuelve el saldo negativo', () => {
    const s = summarizeStoneSale(
      aCredito({ valueCop: 1000000, payments: [abono({ amount: 5000000 })] })
    );
    expect(s.balanceCop).toBe(0);
  });
});

describe('el lote separa el resultado del dinero real', () => {
  it('vender a crédito no cambia si el lote fue buen o mal negocio', () => {
    const contado = summarizeStoneLot(
      lote({ purchaseValueCop: 1000000, sales: [venta({ valueCop: 2000000 })] })
    );
    const credito = summarizeStoneLot(
      lote({ purchaseValueCop: 1000000, sales: [aCredito({ valueCop: 2000000 })] })
    );
    expect(credito.result).toBe(contado.result);
    expect(credito.soldValue).toBe(contado.soldValue);
  });

  it('distingue lo recibido de lo que aún le deben', () => {
    const s = summarizeStoneLot(
      lote({
        sales: [
          venta({ id: 'v-contado', valueCop: 1000000 }),
          aCredito({
            id: 'v-credito',
            valueCop: 3000000,
            payments: [abono({ amount: 1000000 })]
          })
        ]
      })
    );
    expect(s.receivedFromBuyers).toBe(2000000);
    expect(s.buyersDebt).toBe(2000000);
  });

  it('un lote sin ventas a crédito no reporta deuda de compradores', () => {
    const s = summarizeStoneLot(lote({ sales: [venta()] }));
    expect(s.buyersDebt).toBe(0);
    expect(s.receivedFromBuyers).toBe(2000000);
  });
});

describe('validación de una venta a crédito', () => {
  it('rechaza una venta a crédito sin fecha acordada', () => {
    expect(validateStoneSale(lote(), aCredito({ dueDate: '' }))).toMatch(
      /fecha en que quedaron de pagarte/
    );
  });

  it('rechaza una fecha de pago anterior a la venta', () => {
    expect(
      validateStoneSale(lote(), aCredito({ date: '2026-07-15', dueDate: '2026-07-01' }))
    ).toMatch(/no puede ser anterior/);
  });

  it('rechaza abonos que superen el valor de la venta', () => {
    expect(
      validateStoneSale(
        lote(),
        aCredito({ valueCop: 1000000, payments: [abono({ amount: 1500000 })] })
      )
    ).toMatch(/superan el valor/);
  });

  it('rechaza un abono sin fecha o sin monto', () => {
    expect(
      validateStoneSale(lote(), aCredito({ payments: [abono({ date: 'cuando pueda' })] }))
    ).toMatch(/sin fecha válida/);
    expect(validateStoneSale(lote(), aCredito({ payments: [abono({ amount: 0 })] }))).toMatch(
      /sin monto/
    );
  });

  it('rechaza pasar a contado una venta que ya tiene abonos', () => {
    expect(validateStoneSale(lote(), venta({ payments: [abono()] }))).toMatch(
      /ya tiene abonos registrados/
    );
  });

  it('acepta una venta a crédito bien formada', () => {
    expect(validateStoneSale(lote(), aCredito({ valueCop: 1000000 }))).toBeNull();
  });

  it('sigue impidiendo vender más de lo que tiene el lote, también a crédito', () => {
    expect(validateStoneSale(lote({ quantity: 1, carats: 1 }), aCredito({ quantity: 5 }))).toMatch(
      /solo tiene 1 piedra/
    );
  });
});

describe('abonos del comprador', () => {
  const conSaldo = aCredito({ valueCop: 2000000 });

  it('no se pueden registrar en una venta de contado', () => {
    expect(validateBuyerPayment(venta(), emptyBuyerPayment('2026-07-21'))).toMatch(
      /solo se registran en ventas a crédito/
    );
  });

  it('rechaza un abono sin monto', () => {
    expect(validateBuyerPayment(conSaldo, emptyBuyerPayment('2026-07-21'))).toMatch(
      /Indica el monto/
    );
  });

  it('rechaza un abono mayor al saldo', () => {
    expect(validateBuyerPayment(conSaldo, abono({ amount: 3000000 }))).toMatch(/Solo te deben/);
  });

  it('acepta un abono igual al saldo restante', () => {
    const conAbono = withBuyerPayment(conSaldo, abono({ amount: 500000 }));
    expect(validateBuyerPayment(conAbono, abono({ id: 'ab-2', amount: 1500000 }))).toBeNull();
  });

  it('editar un abono no lo cuenta contra sí mismo', () => {
    const conAbono = withBuyerPayment(conSaldo, abono({ amount: 2000000 }));
    expect(
      validateBuyerPayment(conAbono, abono({ amount: 1800000 }), 'ab-1')
    ).toBeNull();
  });

  it('agregar y quitar abonos no muta la venta original', () => {
    const conAbono = withBuyerPayment(conSaldo, abono());
    expect(conSaldo.payments).toEqual([]);
    expect(conAbono.payments).toHaveLength(1);
    expect(withoutBuyerPayment(conAbono, 'ab-1').payments).toEqual([]);
  });

  it('reemplaza un abono con el mismo id en vez de duplicarlo', () => {
    const conAbono = withBuyerPayment(conSaldo, abono({ amount: 500000 }));
    const editado = withBuyerPayment(conAbono, abono({ amount: 700000, notes: 'corregido' }));
    expect(editado.payments).toHaveLength(1);
    expect(editado.payments[0].amount).toBe(700000);
  });

  it('un abono en blanco nace con id propio y la fecha de hoy', () => {
    const p = emptyBuyerPayment('2026-07-21');
    expect(p.date).toBe('2026-07-21');
    expect(p.amount).toBe(0);
    expect(p.id).not.toBe(emptyBuyerPayment('2026-07-21').id);
  });
});

describe('la edición de la compra no toca el historial de cobro', () => {
  it('rechaza borrar un abono desde la edición del lote', () => {
    const conAbono = aCredito({ payments: [abono()] });
    const previous = lote({ sales: [conAbono] });
    const next = lote({ sales: [{ ...conAbono, payments: [] }] });
    expect(validateStoneLotPurchaseUpdate(previous, next)).toMatch(/no se pueden borrar/);
  });

  it('rechaza cambiar la fecha acordada desde la edición del lote', () => {
    const conCredito = aCredito();
    const previous = lote({ sales: [conCredito] });
    const next = lote({ sales: [{ ...conCredito, dueDate: '2026-12-31' }] });
    expect(validateStoneLotPurchaseUpdate(previous, next)).toMatch(/no se pueden borrar/);
  });

  it('rechaza cambiar el comprador vinculado desde la edición del lote', () => {
    const conCredito = aCredito({ buyerId: 'buy-1' });
    const previous = lote({ sales: [conCredito] });
    const next = lote({ sales: [{ ...conCredito, buyerId: 'buy-2' }] });
    expect(validateStoneLotPurchaseUpdate(previous, next)).toMatch(/no se pueden borrar/);
  });
});

describe('venta en blanco', () => {
  it('nace de contado, sin fecha de pago y sin abonos', () => {
    const s = emptyStoneSale('2026-07-21');
    expect(s.onCredit).toBe(false);
    expect(s.dueDate).toBe('');
    expect(s.payments).toEqual([]);
    expect(s.buyerId).toBeNull();
  });
});
