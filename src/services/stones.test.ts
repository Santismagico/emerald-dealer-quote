import { describe, expect, it } from 'vitest';
import type { StoneLot, StoneSale } from '../types';
import {
  countStoneLots,
  emptyStoneLot,
  emptyStoneSale,
  emptySupplierPayment,
  filterStoneLots,
  isStoneLotValid,
  lotDisplayName,
  matchesLotSearch,
  sortStoneLots,
  stonesFlow,
  stonesInventory,
  summarizeStoneLot,
  validateStoneLotPurchaseUpdate,
  validateStoneSale,
  validateSupplierPayment,
  withLotSale,
  withoutLotSale,
  withSupplierPayment,
  withoutSupplierPayment
} from './stones';

function venta(overrides: Partial<StoneSale> = {}): StoneSale {
  return {
    id: 'v-1',
    date: '2026-07-15',
    buyer: 'Comprador Ciudad Ejemplo',
    carats: 1,
    quantity: 1,
    valueCop: 2000000,
    notes: '',
    ...overrides
  };
}

function lote(overrides: Partial<StoneLot> = {}): StoneLot {
  return {
    id: 'l-1',
    name: 'Lote Ejemplo 12',
    stoneType: 'Esmeralda',
    description: 'Talla esmeralda, calidad alta',
    purchaseDate: '2026-07-10',
    supplier: 'Proveedor Ejemplo',
    supplierId: null,
    carats: 5,
    quantity: 4,
    purchaseValueCop: 6000000,
    onCredit: false,
    supplierPayments: [],
    notes: '',
    sales: [],
    createdAt: '2026-07-10T09:00:00.000Z',
    updatedAt: '2026-07-10T09:00:00.000Z',
    ...overrides
  };
}

describe('resumen de un lote', () => {
  it('un lote sin ventas conserva todo y su resultado es el costo en negativo', () => {
    const s = summarizeStoneLot(lote());
    expect(s.remainingCarats).toBe(5);
    expect(s.remainingQuantity).toBe(4);
    expect(s.soldValue).toBe(0);
    expect(s.exhausted).toBe(false);
    expect(s.result).toBe(-6000000);
  });

  it('las ventas descuentan quilates, piedras y suman dinero', () => {
    const l = lote({
      sales: [venta({ id: 'v-1', carats: 1.5, quantity: 1, valueCop: 2500000 }), venta({ id: 'v-2', carats: 0.5, quantity: 1, valueCop: 900000 })]
    });
    const s = summarizeStoneLot(l);
    expect(s.soldCarats).toBe(2);
    expect(s.soldQuantity).toBe(2);
    expect(s.soldValue).toBe(3400000);
    expect(s.remainingCarats).toBe(3);
    expect(s.remainingQuantity).toBe(2);
    expect(s.exhausted).toBe(false);
  });

  it('un lote queda agotado al vender todas las piedras y quilates', () => {
    const l = lote({
      carats: 2,
      quantity: 2,
      purchaseValueCop: 3000000,
      sales: [venta({ id: 'v-1', carats: 2, quantity: 2, valueCop: 5000000 })]
    });
    const s = summarizeStoneLot(l);
    expect(s.exhausted).toBe(true);
    expect(s.result).toBe(2000000);
  });

  it('la resta de quilates no acumula ruido de coma flotante', () => {
    const l = lote({
      carats: 0.3,
      quantity: 3,
      sales: [venta({ id: 'v-1', carats: 0.1, quantity: 1 }), venta({ id: 'v-2', carats: 0.2, quantity: 2, valueCop: 100000 })]
    });
    const s = summarizeStoneLot(l);
    expect(s.remainingCarats).toBe(0);
    expect(s.exhausted).toBe(true);
  });

  it('normaliza a COP enteros los costos, ventas y pagos aun con entradas hostiles', () => {
    const s = summarizeStoneLot(
      lote({
        purchaseValueCop: 500000.4,
        onCredit: true,
        sales: [
          venta({ id: 'decimal', valueCop: 100000.6 }),
          venta({ id: 'nan', valueCop: Number.NaN }),
          venta({ id: 'negativo', valueCop: -1 }),
          venta({ id: 'infinito', valueCop: Number.POSITIVE_INFINITY }),
          venta({ id: 'grande', valueCop: 1e12 })
        ],
        supplierPayments: [
          { id: 'p-1', date: '2026-07-15', amount: 100000.6, notes: '' },
          { id: 'p-2', date: '2026-07-15', amount: Number.NaN, notes: '' },
          { id: 'p-3', date: '2026-07-15', amount: -1, notes: '' },
          { id: 'p-4', date: '2026-07-15', amount: Number.POSITIVE_INFINITY, notes: '' }
        ]
      })
    );

    expect(s.soldValue).toBe(1000000100001);
    expect(s.paidToSupplier).toBe(100001);
    expect(s.supplierDebt).toBe(399999);
    expect(s.result).toBe(999999600001);
    for (const value of [s.soldValue, s.paidToSupplier, s.supplierDebt, s.result]) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});

describe('existencias y flujo', () => {
  const esmeralda = lote({ id: 'l-1', stoneType: 'Esmeralda', carats: 5, quantity: 4 });
  const esmeraldaMin = lote({
    id: 'l-2',
    name: 'Lote Ejemplo 3',
    stoneType: 'esmeralda',
    carats: 2,
    quantity: 2,
    purchaseValueCop: 1500000
  });
  const zafiro = lote({ id: 'l-3', name: '', stoneType: 'Zafiro', carats: 1, quantity: 1, purchaseValueCop: 800000 });
  const agotado = lote({
    id: 'l-4',
    stoneType: 'Esmeralda',
    carats: 1,
    quantity: 1,
    purchaseValueCop: 500000,
    sales: [venta({ carats: 1, quantity: 1, valueCop: 900000 })]
  });

  it('agrupa por tipo de piedra sin distinguir mayúsculas y excluye lotes agotados', () => {
    const inventory = stonesInventory([esmeralda, esmeraldaMin, zafiro, agotado]);
    expect(inventory.map((e) => e.stoneType)).toEqual(['Esmeralda', 'Zafiro']);
    expect(inventory[0].remainingCarats).toBe(7);
    expect(inventory[0].remainingQuantity).toBe(6);
    expect(inventory[0].activeLots).toBe(2);
  });

  it('el flujo suma compras, ventas y cuenta lotes y ventas', () => {
    const flow = stonesFlow([esmeralda, esmeraldaMin, zafiro, agotado]);
    expect(flow.totalSpent).toBe(6000000 + 1500000 + 800000 + 500000);
    expect(flow.totalEarned).toBe(900000);
    expect(flow.balance).toBe(900000 - 8800000);
    expect(flow.lotCount).toBe(4);
    expect(flow.saleCount).toBe(1);
  });

  it('los filtros separan lotes con existencias de los agotados', () => {
    const all = [esmeralda, agotado];
    expect(filterStoneLots(all, '', 'existencias').map((l) => l.id)).toEqual(['l-1']);
    expect(filterStoneLots(all, '', 'agotados').map((l) => l.id)).toEqual(['l-4']);
    expect(countStoneLots(all, '')).toEqual({ existencias: 1, agotados: 1, todos: 2 });
  });

  it('busca por nombre de lote, piedra, descripción o proveedor', () => {
    expect(matchesLotSearch(esmeraldaMin, 'ejemplo 3')).toBe(true);
    expect(matchesLotSearch(esmeralda, 'esmeralda')).toBe(true);
    expect(matchesLotSearch(zafiro, 'proveedor ejemplo')).toBe(true);
    expect(matchesLotSearch(lote({ supplier: 'Otro' }), 'inexistente')).toBe(false);
  });

  it('ordena del lote más reciente al más antiguo', () => {
    const viejo = lote({ id: 'l-viejo', purchaseDate: '2026-07-01' });
    const nuevo = lote({ id: 'l-nuevo', purchaseDate: '2026-07-14' });
    expect(sortStoneLots([viejo, nuevo]).map((l) => l.id)).toEqual(['l-nuevo', 'l-viejo']);
  });

  it('un lote sin nombre se muestra con su tipo de piedra', () => {
    expect(lotDisplayName(zafiro)).toBe('Lote de Zafiro');
    expect(lotDisplayName(esmeralda)).toBe('Lote Ejemplo 12');
  });
});

describe('validación de ventas contra el lote', () => {
  const l = lote({ carats: 3, quantity: 2, sales: [venta({ id: 'v-previa', carats: 1, quantity: 1 })] });

  it('acepta una venta dentro de lo disponible', () => {
    expect(validateStoneSale(l, venta({ id: 'v-2', carats: 2, quantity: 1, valueCop: 100000 }))).toBeNull();
  });

  it('rechaza vender más piedras de las disponibles', () => {
    const error = validateStoneSale(l, venta({ id: 'v-2', carats: 0.5, quantity: 2 }));
    expect(error).toMatch(/1 piedra/);
  });

  it('rechaza vender más quilates de los disponibles', () => {
    const error = validateStoneSale(l, venta({ id: 'v-2', carats: 2.5, quantity: 1 }));
    expect(error).toMatch(/2 ct/);
  });

  it('al editar una venta no se cuenta a sí misma', () => {
    expect(validateStoneSale(l, venta({ id: 'v-previa', carats: 3, quantity: 2 }), 'v-previa')).toBeNull();
  });

  it('rechaza ventas sin fecha válida, sin cantidad o sin valor', () => {
    expect(validateStoneSale(l, venta({ id: 'v-2', date: 'ayer' }))).toMatch(/fecha/);
    expect(validateStoneSale(l, venta({ id: 'v-2', carats: 0, quantity: 0 }))).toMatch(/cuántas/);
    expect(validateStoneSale(l, venta({ id: 'v-2', valueCop: 0 }))).toMatch(/valor/);
  });
});

describe('agregar, editar y quitar ventas sin tocar el original', () => {
  const NOW = '2026-07-15T10:00:00.000Z';

  it('withLotSale agrega una venta nueva y actualiza updatedAt', () => {
    const original = lote();
    const copia = structuredClone(original);
    const conVenta = withLotSale(original, venta(), NOW);

    expect(conVenta.sales.length).toBe(1);
    expect(conVenta.updatedAt).toBe(NOW);
    expect(original).toEqual(copia);
  });

  it('withLotSale reemplaza una venta existente por id', () => {
    const l = lote({ sales: [venta({ valueCop: 100 })] });
    const editada = withLotSale(l, venta({ valueCop: 999 }), NOW);
    expect(editada.sales.length).toBe(1);
    expect(editada.sales[0].valueCop).toBe(999);
  });

  it('withoutLotSale elimina la venta indicada', () => {
    const l = lote({ sales: [venta({ id: 'v-1' }), venta({ id: 'v-2' })] });
    const sin = withoutLotSale(l, 'v-1', NOW);
    expect(sin.sales.map((s) => s.id)).toEqual(['v-2']);
  });
});

describe('lote y venta en blanco', () => {
  it('el lote nuevo nace hoy, con una piedra y sin ventas', () => {
    const l = emptyStoneLot('2026-07-15', '2026-07-15T09:00:00.000Z');
    expect(l.purchaseDate).toBe('2026-07-15');
    expect(l.quantity).toBe(1);
    expect(l.sales).toEqual([]);
    expect(l.id).not.toBe(emptyStoneLot('2026-07-15', '').id);
  });

  it('un lote necesita fecha real y tipo de piedra para guardarse', () => {
    expect(isStoneLotValid(lote())).toBe(true);
    expect(isStoneLotValid(lote({ stoneType: '  ' }))).toBe(false);
    expect(isStoneLotValid(lote({ purchaseDate: '2026-02-30' }))).toBe(false);
  });

  it('la venta en blanco nace hoy con una piedra', () => {
    const v = emptyStoneSale('2026-07-15');
    expect(v.date).toBe('2026-07-15');
    expect(v.quantity).toBe(1);
  });
});

describe('compras a credito y pagos al proveedor (C4)', () => {
  const NOW = '2026-07-16T10:00:00.000Z';
  const pago = (o = {}) => ({ id: 'p-1', date: '2026-07-16', amount: 2000000, notes: '', ...o });
  const credito = (o = {}) =>
    lote({ id: 'l-credito', onCredit: true, purchaseValueCop: 6000000, ...o });

  it('un lote de contado nunca tiene deuda', () => {
    const s = summarizeStoneLot(lote({ onCredit: false }));
    expect(s.supplierDebt).toBe(0);
    expect(s.creditSettled).toBe(false);
  });

  it('la deuda es costo menos pagos y se salda al completar', () => {
    const conPago = credito({ supplierPayments: [pago()] });
    const s = summarizeStoneLot(conPago);
    expect(s.paidToSupplier).toBe(2000000);
    expect(s.supplierDebt).toBe(4000000);
    expect(s.creditSettled).toBe(false);

    const saldado = credito({ supplierPayments: [pago(), pago({ id: 'p-2', amount: 4000000 })] });
    const s2 = summarizeStoneLot(saldado);
    expect(s2.supplierDebt).toBe(0);
    expect(s2.creditSettled).toBe(true);
  });

  it('rechaza pagar mas de lo que se debe, sin fecha valida o sin monto', () => {
    const l = credito({ supplierPayments: [pago()] });
    expect(validateSupplierPayment(l, pago({ id: 'p-2', amount: 5000000 }))).toMatch(/Solo debes/);
    expect(validateSupplierPayment(l, pago({ id: 'p-2', date: 'ayer' }))).toMatch(/fecha/);
    expect(validateSupplierPayment(l, pago({ id: 'p-2', amount: 0 }))).toMatch(/monto/);
    expect(validateSupplierPayment(l, pago({ id: 'p-2', amount: 4000000 }))).toBeNull();
  });

  it('rechaza registrar pagos en una compra de contado', () => {
    expect(validateSupplierPayment(lote({ onCredit: false }), pago())).toMatch(/crédito/);
  });

  it('no permite bajar el costo por debajo de lo que ya se pagó', () => {
    const original = credito({ supplierPayments: [pago({ amount: 3000000 })] });
    const editado = { ...original, purchaseValueCop: 2999999 };
    expect(validateStoneLotPurchaseUpdate(original, editado)).toMatch(/menor/);
  });

  it('no permite pasar a contado una compra que ya tiene pagos', () => {
    const original = credito({ supplierPayments: [pago()] });
    const editado = { ...original, onCredit: false };
    expect(validateStoneLotPurchaseUpdate(original, editado)).toMatch(/contado/);
  });

  it('no permite cambiar el proveedor de un lote que ya tiene pagos', () => {
    const original = credito({
      supplier: 'Proveedor Ejemplo',
      supplierId: 'sup-1',
      supplierPayments: [pago()]
    });
    const editado = { ...original, supplier: 'Otro proveedor', supplierId: 'sup-2' };
    expect(validateStoneLotPurchaseUpdate(original, editado)).toMatch(/proveedor/);
  });

  it('no permite borrar pagos desde la edición de la compra', () => {
    const original = credito({ supplierPayments: [pago()] });
    const editado = { ...original, supplierPayments: [] };
    expect(validateStoneLotPurchaseUpdate(original, editado)).toMatch(/no se pueden borrar/);
  });

  it('no permite borrar ventas desde la edición de la compra', () => {
    const original = lote({ sales: [venta({ id: 'v-protegida', carats: 0.5, quantity: 1 })] });
    const editado = { ...original, sales: [] };
    expect(validateStoneLotPurchaseUpdate(original, editado)).toMatch(/no se pueden borrar/);
  });

  it('permite editar otros datos sin alterar el proveedor ni los pagos', () => {
    const original = credito({
      supplier: 'Proveedor Ejemplo',
      supplierId: 'sup-1',
      supplierPayments: [pago()]
    });
    expect(validateStoneLotPurchaseUpdate(original, { ...original, notes: 'Revisado' })).toBeNull();
  });

  it('al editar un pago no se cuenta a si mismo', () => {
    const l = credito({ supplierPayments: [pago({ amount: 6000000 })] });
    expect(validateSupplierPayment(l, pago({ amount: 6000000 }), 'p-1')).toBeNull();
  });

  it('agrega, reemplaza y elimina pagos sin tocar el original', () => {
    const original = credito();
    const copia = structuredClone(original);

    const conPago = withSupplierPayment(original, pago(), NOW);
    expect(conPago.supplierPayments.length).toBe(1);
    expect(conPago.updatedAt).toBe(NOW);
    expect(original).toEqual(copia);

    const editado = withSupplierPayment(conPago, pago({ amount: 999 }), NOW);
    expect(editado.supplierPayments[0].amount).toBe(999);

    const sinPago = withoutSupplierPayment(editado, 'p-1', NOW);
    expect(sinPago.supplierPayments).toEqual([]);
  });

  it('el flujo suma las deudas de todos los lotes a credito', () => {
    const flow = stonesFlow([
      credito({ id: 'l-1', supplierPayments: [pago()] }),
      credito({ id: 'l-2', purchaseValueCop: 1000000 }),
      lote({ id: 'l-contado' })
    ]);
    expect(flow.totalDebt).toBe(4000000 + 1000000);
  });

  it('el pago en blanco nace hoy y sin monto', () => {
    const p = emptySupplierPayment('2026-07-16');
    expect(p.date).toBe('2026-07-16');
    expect(p.amount).toBe(0);
    expect(p.id).not.toBe(emptySupplierPayment('2026-07-16').id);
  });
});
