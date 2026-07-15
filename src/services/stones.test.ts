import { describe, expect, it } from 'vitest';
import type { StoneLot, StoneSale } from '../types';
import {
  countStoneLots,
  emptyStoneLot,
  emptyStoneSale,
  filterStoneLots,
  isStoneLotValid,
  lotDisplayName,
  matchesLotSearch,
  sortStoneLots,
  stonesFlow,
  stonesInventory,
  summarizeStoneLot,
  validateStoneSale,
  withLotSale,
  withoutLotSale
} from './stones';

function venta(overrides: Partial<StoneSale> = {}): StoneSale {
  return {
    id: 'v-1',
    date: '2026-07-15',
    buyer: 'Comprador Bogotá',
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
    name: 'Muzo 12',
    stoneType: 'Esmeralda',
    description: 'Talla esmeralda, calidad alta',
    purchaseDate: '2026-07-10',
    supplier: 'Proveedor Muzo',
    carats: 5,
    quantity: 4,
    purchaseValueCop: 6000000,
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
});

describe('existencias y flujo', () => {
  const esmeralda = lote({ id: 'l-1', stoneType: 'Esmeralda', carats: 5, quantity: 4 });
  const esmeraldaMin = lote({
    id: 'l-2',
    name: 'Chivor 3',
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
    expect(matchesLotSearch(esmeraldaMin, 'chivor')).toBe(true);
    expect(matchesLotSearch(esmeralda, 'muzo')).toBe(true);
    expect(matchesLotSearch(zafiro, 'muzo')).toBe(true); // proveedor "Proveedor Muzo"
    expect(matchesLotSearch(lote({ supplier: 'Otro' }), 'inexistente')).toBe(false);
  });

  it('ordena del lote más reciente al más antiguo', () => {
    const viejo = lote({ id: 'l-viejo', purchaseDate: '2026-07-01' });
    const nuevo = lote({ id: 'l-nuevo', purchaseDate: '2026-07-14' });
    expect(sortStoneLots([viejo, nuevo]).map((l) => l.id)).toEqual(['l-nuevo', 'l-viejo']);
  });

  it('un lote sin nombre se muestra con su tipo de piedra', () => {
    expect(lotDisplayName(zafiro)).toBe('Lote de Zafiro');
    expect(lotDisplayName(esmeralda)).toBe('Muzo 12');
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
