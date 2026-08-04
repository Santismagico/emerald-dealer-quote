import { describe, expect, it } from 'vitest';
import type { BuyerPayment, StockJewelSale, StoneSale } from '../types';
import { normalizeStockJewel, normalizeStoneLot } from './schema';
import { validateStockJewelSale } from './stockJewels';
import { validateBuyerPayment, validateStoneSale } from './stones';

function stoneSale(overrides: Partial<StoneSale> = {}): StoneSale {
  return {
    id: 'stone-sale-b3',
    date: '2026-08-03',
    buyer: 'Comprador',
    buyerId: null,
    carats: 1,
    quantity: 1,
    valueCop: 2_000_000,
    productType: 'Esmeralda tallada',
    usdRate: 4_000,
    receivedBy: 'Santiago',
    method: 'Transferencia',
    onCredit: false,
    dueDate: '',
    payments: [],
    notes: '',
    ...overrides
  };
}

function buyerPayment(overrides: Partial<BuyerPayment> = {}): BuyerPayment {
  return {
    id: 'buyer-payment-b3',
    date: '2026-08-03',
    amount: 500_000,
    usdRate: 4_000,
    receivedBy: 'Santiago',
    method: 'Transferencia',
    notes: '',
    ...overrides
  };
}

function stockSale(overrides: Partial<StockJewelSale> = {}): StockJewelSale {
  return {
    id: 'stock-sale-b3',
    date: '2026-08-03',
    buyer: 'Comprador',
    buyerId: null,
    priceCop: 2_000_000,
    productType: 'Joya con piedra natural',
    usdRate: 4_000,
    receivedBy: 'Santiago',
    method: 'Transferencia',
    notes: '',
    ...overrides
  };
}

describe('tasa histórica fija por operación', () => {
  it('exige tipo y tasa al crear una venta de piedras', () => {
    const lot = normalizeStoneLot({
      id: 'lot-b3',
      name: 'Lote B3',
      purchaseDate: '2026-08-01',
      carats: 10,
      quantity: 10,
      sales: []
    });
    expect(validateStoneSale(lot, stoneSale({ productType: '' }))).toMatch(/tipo de producto/);
    expect(validateStoneSale(lot, stoneSale({ usdRate: null }))).toMatch(/tasa USD\/COP/);
  });

  it('no permite completar ni cambiar la tasa de una venta de piedras guardada', () => {
    const historical = stoneSale({ productType: '', usdRate: null });
    const historicalLot = normalizeStoneLot({
      id: 'lot-history-b3',
      name: 'Lote histórico',
      purchaseDate: '2026-08-01',
      carats: 10,
      quantity: 10,
      sales: [historical]
    });
    expect(
      validateStoneSale(historicalLot, { ...historical, notes: 'aclaración' }, historical.id)
    ).toBeNull();
    expect(
      validateStoneSale(historicalLot, { ...historical, usdRate: 4_100 }, historical.id)
    ).toMatch(/no se puede cambiar/);

    const registered = stoneSale();
    const registeredLot = normalizeStoneLot({
      id: 'lot-registered-b3',
      name: 'Lote registrado',
      purchaseDate: '2026-08-01',
      carats: 10,
      quantity: 10,
      sales: [registered]
    });
    expect(
      validateStoneSale(registeredLot, { ...registered, usdRate: 4_100 }, registered.id)
    ).toMatch(/no se puede cambiar/);
  });

  it('no permite completar ni cambiar la tasa de un abono guardado', () => {
    const historical = buyerPayment({ usdRate: null });
    const historicalSale = stoneSale({
      onCredit: true,
      dueDate: '2026-09-03',
      method: '',
      receivedBy: '',
      payments: [historical]
    });
    expect(
      validateBuyerPayment(
        historicalSale,
        { ...historical, notes: 'aclaración' },
        historical.id
      )
    ).toBeNull();
    expect(
      validateBuyerPayment(historicalSale, { ...historical, usdRate: 4_100 }, historical.id)
    ).toMatch(/no se puede cambiar/);

    const registered = buyerPayment();
    const registeredSale = { ...historicalSale, payments: [registered] };
    expect(
      validateBuyerPayment(registeredSale, { ...registered, usdRate: 4_100 }, registered.id)
    ).toMatch(/no se puede cambiar/);
  });

  it('no permite completar ni cambiar la tasa de una venta de joya guardada', () => {
    const historical = stockSale({ productType: '', usdRate: null });
    const historicalJewel = normalizeStockJewel({
      id: 'jewel-history-b3',
      name: 'Joya histórica',
      acquiredDate: '2026-08-01',
      priceCop: 2_000_000,
      sale: historical
    });
    expect(
      validateStockJewelSale(historicalJewel, { ...historical, notes: 'aclaración' })
    ).toBeNull();
    expect(validateStockJewelSale(historicalJewel, { ...historical, usdRate: 4_100 })).toMatch(
      /no se puede cambiar/
    );

    const registered = stockSale();
    const registeredJewel = normalizeStockJewel({
      id: 'jewel-registered-b3',
      name: 'Joya registrada',
      acquiredDate: '2026-08-01',
      priceCop: 2_000_000,
      sale: registered
    });
    expect(
      validateStockJewelSale(registeredJewel, { ...registered, usdRate: 4_100 })
    ).toMatch(/no se puede cambiar/);
  });
});
