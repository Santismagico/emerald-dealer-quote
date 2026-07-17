import { describe, it, expect } from 'vitest';
import { formatCOP, parseMoney, parseDecimal, formatThousands, toSafeCOP } from './money';

describe('toSafeCOP', () => {
  it('convierte cualquier entrada monetaria a entero no negativo', () => {
    expect(toSafeCOP(500000.4)).toBe(500000);
    expect(toSafeCOP(Number.NaN)).toBe(0);
    expect(toSafeCOP(-1)).toBe(0);
    expect(toSafeCOP(Number.POSITIVE_INFINITY)).toBe(0);
    expect(toSafeCOP(1e12)).toBe(1e12);
  });
});

describe('formatCOP', () => {
  it('formatea COP sin decimales', () => {
    const text = formatCOP(1250000);
    expect(text).toContain('1.250.000');
    expect(text).toContain('$');
    expect(text).not.toContain(',00');
  });

  it('valores no finitos se tratan como cero', () => {
    expect(formatCOP(NaN)).toContain('0');
    expect(formatCOP(Infinity)).toContain('0');
  });
});

describe('parseMoney', () => {
  it('extrae enteros de texto con separadores', () => {
    expect(parseMoney('1.250.000')).toBe(1250000);
    expect(parseMoney('$ 500.000')).toBe(500000);
    expect(parseMoney('')).toBe(0);
    expect(parseMoney('abc')).toBe(0);
  });
});

describe('parseDecimal', () => {
  it('acepta coma o punto decimal', () => {
    expect(parseDecimal('2,5')).toBe(2.5);
    expect(parseDecimal('2.5')).toBe(2.5);
    expect(parseDecimal('')).toBe(0);
  });
});

describe('formatThousands', () => {
  it('agrupa miles al estilo colombiano', () => {
    expect(formatThousands(1250000)).toBe('1.250.000');
  });
});
