import { describe, it, expect } from 'vitest';
import { calculateQuote, validateCalcInput, stoneSubtotal, type CalcInput } from './engine';
import type { Stone } from '../types';

function baseInput(overrides: Partial<CalcInput> = {}): CalcInput {
  return {
    weightGrams: 0,
    materialPricePerGram: 0,
    stones: [],
    laborCost: 0,
    extraCosts: [],
    marginPercent: 0,
    discountType: 'valor',
    discountValue: 0,
    taxEnabled: false,
    taxPercent: 0,
    deposit: 0,
    ...overrides
  };
}

function stone(overrides: Partial<Stone> = {}): Stone {
  return {
    id: 's1',
    type: 'esmeralda',
    cut: 'esmeralda',
    size: '',
    carats: 1,
    quantity: 1,
    priceMode: 'porPiedra',
    unitPrice: 0,
    treatment: '',
    quality: '',
    notes: '',
    ...overrides
  };
}

describe('cálculo de material', () => {
  it('multiplica peso por precio por gramo y redondea a entero', () => {
    const r = calculateQuote(baseInput({ weightGrams: 5.5, materialPricePerGram: 450000 }));
    expect(r.materialSubtotal).toBe(2475000);
  });

  it('redondea decimales al peso más cercano', () => {
    const r = calculateQuote(baseInput({ weightGrams: 3.33, materialPricePerGram: 100001 }));
    expect(r.materialSubtotal).toBe(Math.round(3.33 * 100001));
    expect(Number.isInteger(r.materialSubtotal)).toBe(true);
  });

  it('peso cero da subtotal cero', () => {
    const r = calculateQuote(baseInput({ weightGrams: 0, materialPricePerGram: 450000 }));
    expect(r.materialSubtotal).toBe(0);
  });
});

describe('cálculo de piedras', () => {
  it('precio por piedra multiplica por cantidad', () => {
    expect(stoneSubtotal(stone({ unitPrice: 800000, quantity: 3 }))).toBe(2400000);
  });

  it('precio por quilate multiplica quilates x precio x cantidad', () => {
    expect(
      stoneSubtotal(stone({ priceMode: 'porQuilate', carats: 1.5, unitPrice: 2000000, quantity: 2 }))
    ).toBe(6000000);
  });

  it('suma varias piedras en la cotización', () => {
    const r = calculateQuote(
      baseInput({
        stones: [
          stone({ unitPrice: 500000, quantity: 1 }),
          stone({ id: 's2', priceMode: 'porQuilate', carats: 0.5, unitPrice: 1000000, quantity: 2 })
        ]
      })
    );
    expect(r.stonesSubtotal).toBe(500000 + 1000000);
  });
});

describe('margen interno', () => {
  it('aplica el margen sobre el costo base', () => {
    const r = calculateQuote(baseInput({ laborCost: 1000000, marginPercent: 30 }));
    expect(r.baseCost).toBe(1000000);
    expect(r.marginAmount).toBe(300000);
    expect(r.subtotal).toBe(1300000);
  });
});

describe('descuentos', () => {
  it('descuento porcentual sobre el subtotal', () => {
    const r = calculateQuote(
      baseInput({ laborCost: 2000000, discountType: 'porcentaje', discountValue: 10 })
    );
    expect(r.discountAmount).toBe(200000);
    expect(r.total).toBe(1800000);
  });

  it('descuento fijo en pesos', () => {
    const r = calculateQuote(baseInput({ laborCost: 2000000, discountType: 'valor', discountValue: 150000 }));
    expect(r.discountAmount).toBe(150000);
    expect(r.total).toBe(1850000);
  });

  it('el descuento nunca supera el subtotal (no hay totales negativos)', () => {
    const r = calculateQuote(baseInput({ laborCost: 100000, discountType: 'valor', discountValue: 999999999 }));
    expect(r.discountAmount).toBe(100000);
    expect(r.total).toBe(0);
  });
});

describe('impuestos', () => {
  it('aplica impuesto sobre subtotal menos descuento cuando está activo', () => {
    const r = calculateQuote(
      baseInput({
        laborCost: 1000000,
        discountType: 'valor',
        discountValue: 200000,
        taxEnabled: true,
        taxPercent: 19
      })
    );
    expect(r.taxAmount).toBe(152000);
    expect(r.total).toBe(952000);
  });

  it('no aplica impuesto si está desactivado', () => {
    const r = calculateQuote(baseInput({ laborCost: 1000000, taxPercent: 19, taxEnabled: false }));
    expect(r.taxAmount).toBe(0);
    expect(r.total).toBe(1000000);
  });
});

describe('total, anticipo y saldo', () => {
  it('calcula una cotización completa realista', () => {
    const r = calculateQuote(
      baseInput({
        weightGrams: 8,
        materialPricePerGram: 550000, // oro configurado internamente
        stones: [stone({ priceMode: 'porQuilate', carats: 1.2, unitPrice: 3000000, quantity: 1 })],
        laborCost: 800000,
        extraCosts: [{ id: 'e1', label: 'Certificado', amount: 250000 }],
        marginPercent: 25,
        discountType: 'porcentaje',
        discountValue: 5,
        deposit: 3000000
      })
    );
    expect(r.materialSubtotal).toBe(4400000);
    expect(r.stonesSubtotal).toBe(3600000);
    expect(r.laborSubtotal).toBe(800000);
    expect(r.extrasSubtotal).toBe(250000);
    expect(r.baseCost).toBe(9050000);
    expect(r.marginAmount).toBe(2262500);
    expect(r.subtotal).toBe(11312500);
    expect(r.discountAmount).toBe(565625);
    expect(r.total).toBe(10746875);
    expect(r.deposit).toBe(3000000);
    expect(r.balance).toBe(7746875);
    expect(r.total).toBe(r.deposit + r.balance);
  });

  it('el anticipo se limita al total', () => {
    const r = calculateQuote(baseInput({ laborCost: 500000, deposit: 900000 }));
    expect(r.deposit).toBe(500000);
    expect(r.balance).toBe(0);
  });

  it('todos los valores monetarios son enteros', () => {
    const r = calculateQuote(
      baseInput({
        weightGrams: 3.777,
        materialPricePerGram: 333333,
        marginPercent: 17.5,
        discountType: 'porcentaje',
        discountValue: 3.3,
        taxEnabled: true,
        taxPercent: 19
      })
    );
    for (const value of Object.values(r)) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});

describe('validación', () => {
  it('rechaza valores negativos', () => {
    const errors = validateCalcInput(baseInput({ weightGrams: -1, laborCost: -5 }));
    expect(errors).toContain('El peso no puede ser negativo.');
    expect(errors).toContain('La mano de obra no puede ser negativa.');
  });

  it('rechaza descuento porcentual mayor a 100', () => {
    const errors = validateCalcInput(baseInput({ discountType: 'porcentaje', discountValue: 150 }));
    expect(errors).toContain('El descuento no puede superar el 100%.');
  });

  it('rechaza descuento fijo mayor al subtotal', () => {
    const errors = validateCalcInput(
      baseInput({ laborCost: 100000, discountType: 'valor', discountValue: 200000 })
    );
    expect(errors).toContain('El descuento supera el valor de la cotización.');
  });

  it('rechaza anticipo mayor al total', () => {
    const errors = validateCalcInput(baseInput({ laborCost: 100000, deposit: 500000 }));
    expect(errors).toContain('El anticipo supera el total de la cotización.');
  });

  it('rechaza campos NaN como inválidos', () => {
    const errors = validateCalcInput(baseInput({ weightGrams: NaN }));
    expect(errors).toContain('Hay campos numéricos vacíos o inválidos.');
  });

  it('rechaza piedras con valores negativos', () => {
    const errors = validateCalcInput(baseInput({ stones: [stone({ unitPrice: -100 })] }));
    expect(errors.some((e) => e.includes('piedra 1'))).toBe(true);
  });

  it('una entrada válida no produce errores', () => {
    const errors = validateCalcInput(
      baseInput({ weightGrams: 5, materialPricePerGram: 500000, laborCost: 300000 })
    );
    expect(errors).toEqual([]);
  });
});
