// Defensas del dinero ya recibido (auditoría propia del 2026-07-22).
//
// Hallazgo H1: al editar una venta a crédito, apagar el interruptor "se la
// vendí a crédito" vaciaba los abonos ANTES de validar. Como la validación
// rechaza el cambio solo si quedan abonos, el vaciado la dejaba pasar y al
// guardar se borraban pagos reales del comprador. Estas pruebas fallan sin
// `withSaleCredit` y pasan con ella.

import { describe, expect, it } from 'vitest';
import type { BuyerPayment, StoneSale } from '../types';
import { summarizeStoneSale, validateStoneSale, withSaleCredit } from './stones';
import type { StoneLot } from '../types';

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

describe('cambiar una venta entre contado y crédito', () => {
  it('pasar a contado NUNCA borra los abonos ya recibidos', () => {
    const conAbonos = venta({
      onCredit: true,
      dueDate: '2026-08-15',
      payments: [abono({ amount: 500000 }), abono({ id: 'ab-2', amount: 300000 })]
    });

    const aContado = withSaleCredit(conAbonos, false, '2026-07-22');

    expect(aContado.onCredit).toBe(false);
    expect(aContado.payments).toHaveLength(2);
    expect(summarizeStoneSale({ ...aContado, onCredit: true }).receivedCop).toBe(800000);
  });

  it('y por eso la validación puede rechazar el cambio', () => {
    // Esta es la cadena completa del defecto: si los abonos desaparecieran,
    // validateStoneSale no tendría nada que rechazar y el guardado borraría
    // dinero real sin avisar.
    const conAbonos = venta({
      onCredit: true,
      dueDate: '2026-08-15',
      payments: [abono()]
    });

    const aContado = withSaleCredit(conAbonos, false, '2026-07-22');

    expect(validateStoneSale(lote(), aContado)).toMatch(/ya tiene abonos registrados/);
  });

  it('una venta a crédito sin abonos sí puede volver a contado y queda limpia', () => {
    const sinAbonos = venta({ onCredit: true, dueDate: '2026-08-15' });

    const aContado = withSaleCredit(sinAbonos, false, '2026-07-22');

    expect(aContado.onCredit).toBe(false);
    expect(aContado.dueDate).toBe('');
    expect(aContado.payments).toEqual([]);
    expect(validateStoneSale(lote(), aContado)).toBeNull();
  });

  it('pasar a crédito propone la fecha de la venta como fecha de pago', () => {
    const aCredito = withSaleCredit(venta({ date: '2026-07-15' }), true, '2026-07-22');
    expect(aCredito.onCredit).toBe(true);
    expect(aCredito.dueDate).toBe('2026-07-15');
  });

  it('pasar a crédito respeta una fecha de pago que ya se había escrito', () => {
    const conFecha = venta({ dueDate: '2026-09-01' });
    expect(withSaleCredit(conFecha, true, '2026-07-22').dueDate).toBe('2026-09-01');
  });

  it('una venta sin fecha propia usa la de hoy y nunca queda sin fecha', () => {
    const sinFecha = venta({ date: '' });
    expect(withSaleCredit(sinFecha, true, '2026-07-22').dueDate).toBe('2026-07-22');
  });

  it('no muta la venta original', () => {
    const original = venta({ onCredit: true, dueDate: '2026-08-15', payments: [abono()] });
    withSaleCredit(original, false, '2026-07-22');
    expect(original.onCredit).toBe(true);
    expect(original.payments).toHaveLength(1);
  });
});

describe('bajar el precio de una venta por debajo de lo ya abonado', () => {
  it('se rechaza: ese dinero ya entró y no puede desaparecer', () => {
    const conAbonos = venta({
      onCredit: true,
      dueDate: '2026-08-15',
      valueCop: 500000,
      payments: [abono({ amount: 800000 })]
    });
    expect(validateStoneSale(lote(), conAbonos)).toMatch(/superan el valor/);
  });
});
