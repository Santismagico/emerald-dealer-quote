import { describe, expect, it } from 'vitest';
import type { Expense, StockJewel, StoneLot } from '../types';
import { expenseSplit } from './expenses';
import { normalizeExpense, normalizeStockJewel, normalizeStoneLot } from './schema';
import { summarizeStockJewel } from './stockJewels';
import { summarizeStoneLot } from './stones';

describe('no regresión de dinero en B3', () => {
  it('conserva exactamente ventas, abonos, resultados y gastos anteriores', () => {
    const legacyLot = {
      id: 'lot-before-b3',
      name: 'Lote anterior a B3',
      purchaseDate: '2026-08-01',
      carats: 10,
      quantity: 10,
      purchaseValueCop: 1_250_000,
      supplierPayments: [],
      sales: [
        {
          id: 'cash-before-b3',
          date: '2026-08-02',
          carats: 1,
          quantity: 1,
          valueCop: 2_000_000,
          onCredit: false,
          payments: []
        },
        {
          id: 'credit-before-b3',
          date: '2026-08-03',
          carats: 2,
          quantity: 2,
          valueCop: 3_000_000,
          onCredit: true,
          payments: [{
            id: 'payment-before-b3',
            date: '2026-08-03',
            amount: 1_000_000
          }]
        }
      ]
    };
    const stoneBefore = summarizeStoneLot(legacyLot as unknown as StoneLot);
    const normalizedLot = normalizeStoneLot(legacyLot);
    const stoneAfter = summarizeStoneLot(normalizedLot);

    expect({
      soldValue: stoneAfter.soldValue,
      result: stoneAfter.result,
      receivedFromBuyers: stoneAfter.receivedFromBuyers,
      buyersDebt: stoneAfter.buyersDebt
    }).toEqual({
      soldValue: stoneBefore.soldValue,
      result: stoneBefore.result,
      receivedFromBuyers: stoneBefore.receivedFromBuyers,
      buyersDebt: stoneBefore.buyersDebt
    });
    expect(stoneAfter).toMatchObject({
      soldValue: 5_000_000,
      result: 3_750_000,
      receivedFromBuyers: 3_000_000,
      buyersDebt: 2_000_000
    });
    expect(normalizedLot.sales).toEqual([
      expect.objectContaining({ productType: '', usdRate: null }),
      expect.objectContaining({
        productType: '',
        usdRate: null,
        payments: [expect.objectContaining({ usdRate: null })]
      })
    ]);

    const legacyJewel = {
      id: 'jewel-before-b3',
      name: 'Joya anterior a B3',
      acquiredDate: '2026-08-01',
      costCop: 1_400_000,
      priceCop: 2_800_000,
      status: 'disponible',
      sale: {
        id: 'stock-sale-before-b3',
        date: '2026-08-03',
        priceCop: 2_600_000
      }
    };
    const jewelBefore = summarizeStockJewel(legacyJewel as unknown as StockJewel);
    const normalizedJewel = normalizeStockJewel(legacyJewel);
    const jewelAfter = summarizeStockJewel(normalizedJewel);
    expect({ receivedCop: jewelAfter.receivedCop, resultCop: jewelAfter.resultCop }).toEqual({
      receivedCop: jewelBefore.receivedCop,
      resultCop: jewelBefore.resultCop
    });
    expect(jewelAfter).toMatchObject({ receivedCop: 2_600_000, resultCop: 1_200_000 });
    expect(normalizedJewel.sale).toMatchObject({ productType: '', usdRate: null });

    const legacyExpense = {
      id: 'expense-before-b3',
      date: '2026-08-01',
      concept: 'Gasto anterior',
      category: 'Otro',
      amountCop: 1_000_001,
      method: 'Transferencia',
      paidBy: 'Santiago',
      partnerId: 'partner-before-b3',
      partnerName: 'Socio',
      myPercent: 60
    };
    const expenseBefore = expenseSplit(legacyExpense as unknown as Expense);
    const normalizedExpense = normalizeExpense(legacyExpense);
    expect(expenseSplit(normalizedExpense)).toEqual(expenseBefore);
    expect(expenseSplit(normalizedExpense)).toEqual({
      myAmountCop: 600_001,
      partnerAmountCop: 400_000
    });
    expect(normalizedExpense.usdRate).toBeNull();
  });
});
