import { describe, expect, it } from 'vitest';
import type { StockJewel, StockJewelSale } from '../types';
import {
  compareStockJewels,
  countStockJewels,
  emptyStockJewel,
  emptyStockJewelSale,
  filterStockJewels,
  jewelDisplayName,
  matchesJewelSearch,
  stockJewelsFlow,
  summarizeStockJewel,
  validateStockJewel,
  validateStockJewelSale,
  withJewelSale,
  withoutJewelSale
} from './stockJewels';

function joya(overrides: Partial<StockJewel> = {}): StockJewel {
  return {
    id: 'j-1',
    name: 'Anillo Ejemplo',
    pieceType: 'anillo',
    material: 'Oro',
    photo: '',
    acquiredDate: '2026-07-01',
    costCop: 3000000,
    priceCop: 5000000,
    status: 'disponible',
    notes: '',
    sale: null,
    createdAt: '2026-07-01T09:00:00.000Z',
    updatedAt: '2026-07-01T09:00:00.000Z',
    ...overrides
  };
}

function venta(overrides: Partial<StockJewelSale> = {}): StockJewelSale {
  return {
    id: 's-1',
    date: '2026-07-20',
    buyer: 'Comprador Ejemplo',
    buyerId: null,
    priceCop: 4800000,
    notes: '',
    ...overrides
  };
}

describe('estado derivado de una joya (D-044)', () => {
  it('una pieza sin venta está disponible', () => {
    expect(summarizeStockJewel(joya()).displayStatus).toBe('disponible');
    expect(summarizeStockJewel(joya()).sold).toBe(false);
  });

  it('una pieza apartada se muestra apartada', () => {
    expect(summarizeStockJewel(joya({ status: 'apartada' })).displayStatus).toBe('apartada');
  });

  it('tener venta la muestra vendida sin guardar el estado a mano', () => {
    const vendida = joya({ sale: venta() });
    // El estado GUARDADO sigue siendo "disponible": lo que manda es la venta.
    expect(vendida.status).toBe('disponible');
    expect(summarizeStockJewel(vendida).displayStatus).toBe('vendida');
    expect(summarizeStockJewel(vendida).sold).toBe(true);
  });

  it('una pieza apartada que se vende se muestra vendida', () => {
    const vendida = joya({ status: 'apartada', sale: venta() });
    expect(summarizeStockJewel(vendida).displayStatus).toBe('vendida');
  });
});

describe('resultado de una joya', () => {
  it('en vitrina muestra la ganancia esperada, todavía no recibida', () => {
    const s = summarizeStockJewel(joya({ costCop: 3000000, priceCop: 5000000 }));
    expect(s.receivedCop).toBe(0);
    expect(s.resultCop).toBe(2000000);
  });

  it('vendida muestra el resultado real: lo recibido menos el costo', () => {
    const s = summarizeStockJewel(
      joya({ costCop: 3000000, priceCop: 5000000, sale: venta({ priceCop: 4200000 }) })
    );
    expect(s.receivedCop).toBe(4200000);
    expect(s.resultCop).toBe(1200000);
  });

  it('vender por debajo del costo da un resultado negativo, sin maquillarlo', () => {
    const s = summarizeStockJewel(joya({ costCop: 3000000, sale: venta({ priceCop: 2500000 }) }));
    expect(s.resultCop).toBe(-500000);
  });
});

describe('flujo del negocio de joyas', () => {
  it('separa lo que está en vitrina de lo ya vendido', () => {
    const flow = stockJewelsFlow([
      joya({ id: 'j-1', costCop: 1000000, priceCop: 2000000 }),
      joya({ id: 'j-2', costCop: 500000, priceCop: 900000 }),
      joya({ id: 'j-3', costCop: 2000000, priceCop: 3000000, sale: venta({ priceCop: 2800000 }) })
    ]);
    expect(flow.jewelCount).toBe(3);
    expect(flow.availableCount).toBe(2);
    expect(flow.soldCount).toBe(1);
    expect(flow.inventoryCostCop).toBe(1500000);
    expect(flow.inventoryPriceCop).toBe(2900000);
    expect(flow.totalSoldCop).toBe(2800000);
    expect(flow.totalResultCop).toBe(800000);
  });

  it('sin joyas todo queda en cero', () => {
    expect(stockJewelsFlow([])).toEqual({
      jewelCount: 0,
      availableCount: 0,
      soldCount: 0,
      inventoryCostCop: 0,
      inventoryPriceCop: 0,
      totalSoldCop: 0,
      totalResultCop: 0
    });
  });
});

describe('validación de una pieza', () => {
  it('exige nombre', () => {
    expect(validateStockJewel(joya({ name: '   ' }))).toMatch(/nombre/);
  });

  it('exige la fecha en que entró al inventario', () => {
    expect(validateStockJewel(joya({ acquiredDate: '' }))).toMatch(/entró al inventario/);
  });

  it('exige un precio de venta', () => {
    expect(validateStockJewel(joya({ priceCop: 0 }))).toMatch(/en cuánto vendes/);
  });

  it('acepta una pieza sin costo registrado', () => {
    // Puede ser una pieza heredada o recibida: el costo no es obligatorio.
    expect(validateStockJewel(joya({ costCop: 0 }))).toBeNull();
  });
});

describe('validación de la venta de una pieza', () => {
  it('no se puede vender una pieza ya vendida', () => {
    const vendida = joya({ sale: venta({ id: 's-1' }) });
    expect(validateStockJewelSale(vendida, venta({ id: 's-2' }))).toMatch(/ya está vendida/);
  });

  it('sí se puede corregir la venta que ya tiene', () => {
    const vendida = joya({ sale: venta({ id: 's-1' }) });
    expect(validateStockJewelSale(vendida, venta({ id: 's-1', priceCop: 4000000 }))).toBeNull();
  });

  it('no se puede vender antes de que la pieza entrara al inventario', () => {
    expect(
      validateStockJewelSale(joya({ acquiredDate: '2026-07-10' }), venta({ date: '2026-07-01' }))
    ).toMatch(/antes de que entrara/);
  });

  it('exige un valor recibido', () => {
    expect(validateStockJewelSale(joya(), venta({ priceCop: 0 }))).toMatch(/valor recibido/);
  });

  it('exige una fecha válida', () => {
    expect(validateStockJewelSale(joya(), venta({ date: 'ayer' }))).toMatch(/fecha válida/);
  });

  it('acepta una venta bien formada', () => {
    expect(validateStockJewelSale(joya(), venta())).toBeNull();
  });
});

describe('registrar y deshacer una venta', () => {
  it('registrar la venta no muta la pieza original', () => {
    const original = joya();
    const vendida = withJewelSale(original, venta(), '2026-07-20T10:00:00.000Z');
    expect(original.sale).toBeNull();
    expect(vendida.sale?.priceCop).toBe(4800000);
    expect(vendida.updatedAt).toBe('2026-07-20T10:00:00.000Z');
  });

  it('deshacer la venta devuelve la pieza a la vitrina como disponible', () => {
    const vendida = joya({ status: 'apartada', sale: venta() });
    const devuelta = withoutJewelSale(vendida, '2026-07-21T10:00:00.000Z');
    expect(devuelta.sale).toBeNull();
    expect(devuelta.status).toBe('disponible');
    expect(summarizeStockJewel(devuelta).displayStatus).toBe('disponible');
  });
});

describe('lista de joyas', () => {
  const disponible = joya({ id: 'j-disp', name: 'Dije Ejemplo', acquiredDate: '2026-07-10' });
  const vendida = joya({ id: 'j-vend', name: 'Anillo Ejemplo', acquiredDate: '2026-07-05', sale: venta() });

  it('filtra disponibles y vendidas', () => {
    expect(filterStockJewels([disponible, vendida], '', 'disponibles').map((j) => j.id)).toEqual([
      'j-disp'
    ]);
    expect(filterStockJewels([disponible, vendida], '', 'vendidas').map((j) => j.id)).toEqual([
      'j-vend'
    ]);
    expect(filterStockJewels([disponible, vendida], '', 'todas')).toHaveLength(2);
  });

  it('cuenta cada filtro', () => {
    expect(countStockJewels([disponible, vendida], '')).toEqual({
      disponibles: 1,
      vendidas: 1,
      todas: 2
    });
  });

  it('busca por nombre, tipo, material y notas', () => {
    expect(matchesJewelSearch(disponible, 'dije')).toBe(true);
    expect(matchesJewelSearch(disponible, 'oro')).toBe(true);
    expect(matchesJewelSearch(disponible, 'collar')).toBe(false);
    expect(matchesJewelSearch(disponible, '  ')).toBe(true);
  });

  it('ordena de la más reciente a la más antigua', () => {
    expect([vendida, disponible].sort(compareStockJewels).map((j) => j.id)).toEqual([
      'j-disp',
      'j-vend'
    ]);
  });

  it('a igual fecha el orden es estable', () => {
    const a = joya({ id: 'a', acquiredDate: '2026-07-10', createdAt: '2026-07-10T08:00:00.000Z' });
    const b = joya({ id: 'b', acquiredDate: '2026-07-10', createdAt: '2026-07-10T09:00:00.000Z' });
    expect([a, b].sort(compareStockJewels).map((j) => j.id)).toEqual(['b', 'a']);
  });

  it('una pieza sin nombre se muestra con su tipo', () => {
    expect(jewelDisplayName({ name: '  ', pieceType: 'aretes' })).toBe('aretes sin nombre');
    expect(jewelDisplayName({ name: 'Dije Ejemplo', pieceType: 'dije' })).toBe('Dije Ejemplo');
  });
});

describe('formularios en blanco', () => {
  it('una pieza nueva nace disponible y sin venta', () => {
    const j = emptyStockJewel('2026-07-21', '2026-07-21T09:00:00.000Z');
    expect(j.status).toBe('disponible');
    expect(j.sale).toBeNull();
    expect(j.acquiredDate).toBe('2026-07-21');
    expect(j.id).not.toBe(emptyStockJewel('2026-07-21', '2026-07-21T09:00:00.000Z').id);
  });

  it('una venta nueva nace con la fecha de hoy y sin comprador', () => {
    const s = emptyStockJewelSale('2026-07-21');
    expect(s.date).toBe('2026-07-21');
    expect(s.buyerId).toBeNull();
    expect(s.priceCop).toBe(0);
  });
});
