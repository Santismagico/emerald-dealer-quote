// Motor de cálculo de cotizaciones.
// Funciones puras, sin dependencia de la interfaz. Todo el dinero en COP entero.

import type { Stone, ExtraCost, DiscountType, Quote } from '../types';
import { roundCOP } from '../utils/money';

export interface CalcInput {
  weightGrams: number;
  materialPricePerGram: number;
  stones: Stone[];
  laborCost: number;
  extraCosts: ExtraCost[];
  marginPercent: number;
  discountType: DiscountType;
  discountValue: number;
  taxEnabled: boolean;
  taxPercent: number;
  deposit: number;
}

export interface CalcResult {
  materialSubtotal: number;
  stonesSubtotal: number;
  laborSubtotal: number;
  extrasSubtotal: number;
  /** Costo base = material + piedras + mano de obra + adicionales. Interno. */
  baseCost: number;
  /** Valor del margen interno. Nunca visible al cliente. */
  marginAmount: number;
  /** Subtotal comercial = costo base + margen. */
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  deposit: number;
  balance: number;
}

function num(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/** Subtotal de una piedra según su modo de precio. */
export function stoneSubtotal(stone: Stone): number {
  const qty = Math.max(num(stone.quantity), 0);
  const price = Math.max(num(stone.unitPrice), 0);
  if (stone.priceMode === 'porQuilate') {
    const carats = Math.max(num(stone.carats), 0);
    return roundCOP(carats * price * qty);
  }
  return roundCOP(price * qty);
}

/**
 * Calcula la cotización completa. Es tolerante: valores inválidos se tratan
 * como cero y el descuento/anticipo se limitan a rangos sanos. Para reportar
 * errores al usuario usar validateCalcInput.
 */
export function calculateQuote(input: CalcInput): CalcResult {
  const materialSubtotal = roundCOP(Math.max(num(input.weightGrams), 0) * Math.max(num(input.materialPricePerGram), 0));
  const stonesSubtotal = input.stones.reduce((sum, s) => sum + stoneSubtotal(s), 0);
  const laborSubtotal = roundCOP(Math.max(num(input.laborCost), 0));
  const extrasSubtotal = input.extraCosts.reduce(
    (sum, c) => sum + roundCOP(Math.max(num(c.amount), 0)),
    0
  );

  const baseCost = materialSubtotal + stonesSubtotal + laborSubtotal + extrasSubtotal;
  const marginAmount = roundCOP(baseCost * Math.max(num(input.marginPercent), 0) / 100);
  const subtotal = baseCost + marginAmount;

  const rawDiscount =
    input.discountType === 'porcentaje'
      ? roundCOP(subtotal * num(input.discountValue) / 100)
      : roundCOP(num(input.discountValue));
  const discountAmount = Math.min(Math.max(rawDiscount, 0), subtotal);

  const taxedBase = subtotal - discountAmount;
  const taxAmount = input.taxEnabled
    ? roundCOP(taxedBase * Math.max(num(input.taxPercent), 0) / 100)
    : 0;

  const total = taxedBase + taxAmount;
  const deposit = Math.min(Math.max(roundCOP(num(input.deposit)), 0), total);
  const balance = total - deposit;

  return {
    materialSubtotal,
    stonesSubtotal,
    laborSubtotal,
    extrasSubtotal,
    baseCost,
    marginAmount,
    subtotal,
    discountAmount,
    taxAmount,
    total,
    deposit,
    balance
  };
}

/** Valida la entrada y devuelve mensajes de error en lenguaje humano. */
export function validateCalcInput(input: CalcInput): string[] {
  const errors: string[] = [];

  const checks: Array<[number, string]> = [
    [input.weightGrams, 'El peso no puede ser negativo.'],
    [input.materialPricePerGram, 'El precio del material no puede ser negativo.'],
    [input.laborCost, 'La mano de obra no puede ser negativa.'],
    [input.discountValue, 'El descuento no puede ser negativo.'],
    [input.marginPercent, 'El margen no puede ser negativo.'],
    [input.taxPercent, 'El impuesto no puede ser negativo.'],
    [input.deposit, 'El anticipo no puede ser negativo.']
  ];
  for (const [value, message] of checks) {
    if (!Number.isFinite(value)) {
      errors.push('Hay campos numéricos vacíos o inválidos.');
    } else if (value < 0) {
      errors.push(message);
    }
  }

  input.stones.forEach((s, i) => {
    if (s.unitPrice < 0 || s.carats < 0 || s.quantity < 0) {
      errors.push(`La piedra ${i + 1} tiene valores negativos.`);
    }
    if (s.quantity === 0) {
      errors.push(`La piedra ${i + 1} tiene cantidad cero.`);
    }
  });

  input.extraCosts.forEach((c) => {
    if (c.amount < 0) {
      errors.push(`El costo adicional "${c.label || 'sin nombre'}" no puede ser negativo.`);
    }
  });

  if (input.discountType === 'porcentaje' && input.discountValue > 100) {
    errors.push('El descuento no puede superar el 100%.');
  }

  const result = calculateQuote({ ...input, discountValue: Math.max(input.discountValue, 0) });
  if (input.discountType === 'valor' && roundCOP(input.discountValue) > result.subtotal) {
    errors.push('El descuento supera el valor de la cotización.');
  }
  if (roundCOP(input.deposit) > result.total) {
    errors.push('El anticipo supera el total de la cotización.');
  }

  return [...new Set(errors)];
}

/** Construye la entrada de cálculo a partir de una cotización guardada. */
export function quoteToCalcInput(quote: Quote): CalcInput {
  return {
    weightGrams: quote.weightGrams,
    materialPricePerGram: quote.materialPricePerGram,
    stones: quote.stones,
    laborCost: quote.laborCost,
    extraCosts: quote.extraCosts,
    marginPercent: quote.marginPercent,
    discountType: quote.discountType,
    discountValue: quote.discountValue,
    taxEnabled: quote.taxEnabled,
    taxPercent: quote.taxPercent,
    deposit: quote.deposit
  };
}
