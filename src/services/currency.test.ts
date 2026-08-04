import { describe, expect, it } from 'vitest';
import { formatCOP } from '../utils/money';
import {
  copToUsd,
  formatOperationMoney,
  newOperationUsdRate,
  normalizeUsdRate,
  resolveUsdRatePrefill,
  storedUsdRateSource,
  usdRateLabel,
  validateOptionalUsdRate
} from './currency';

describe('vista COP/USD por operación', () => {
  it('acepta únicamente tasas finitas dentro del rango aprobado', () => {
    expect(normalizeUsdRate(1_000)).toBe(1_000);
    expect(normalizeUsdRate(4_123.45)).toBe(4_123.45);
    expect(normalizeUsdRate(20_000)).toBe(20_000);
    expect(normalizeUsdRate(999)).toBeNull();
    expect(normalizeUsdRate(20_001)).toBeNull();
    expect(normalizeUsdRate(Number.NaN)).toBeNull();
    expect(normalizeUsdRate(Number.POSITIVE_INFINITY)).toBeNull();
    expect(normalizeUsdRate('4200')).toBeNull();

    expect(validateOptionalUsdRate(null)).toBeNull();
    expect(validateOptionalUsdRate(4_200)).toBeNull();
    expect(validateOptionalUsdRate(999)).toMatch(/entre/);
  });

  it('prellena una operación nueva solo con una última tasa válida', () => {
    expect(newOperationUsdRate(4_200)).toBe(4_200);
    expect(newOperationUsdRate(null)).toBeNull();
    expect(newOperationUsdRate(999)).toBeNull();
  });

  it('una respuesta tardía nunca pisa la tasa escrita manualmente', () => {
    expect(resolveUsdRatePrefill(4_100, 4_300, true)).toBe(4_100);
    expect(resolveUsdRatePrefill(null, 4_300, true)).toBeNull();
    expect(resolveUsdRatePrefill(4_100, 4_300, false)).toBe(4_300);
    expect(resolveUsdRatePrefill(4_100, 999, false)).toBe(4_100);
  });

  it('explica con honestidad si usa una tasa anterior o no tiene ninguna', () => {
    expect(storedUsdRateSource(4_200, '2026-08-03T10:00:00.000Z')).toBe(
      'Última tasa guardada del 03/08/2026'
    );
    expect(storedUsdRateSource(4_200, '2026-08-03T10:00:00.000Z', true)).toBe(
      'Sin conexión · última tasa guardada del 03/08/2026'
    );
    expect(storedUsdRateSource(null, '', true)).toBe('Sin conexión y sin tasa guardada');
  });

  it('convierte cada operación con su propia tasa y conserva COP como valor oficial', () => {
    expect(copToUsd(4_200_000, 4_200)).toBe(1_000);
    expect(copToUsd(4_200_000, null)).toBeNull();
    expect(formatOperationMoney(4_200_000, 4_200, 'COP')).toBe(formatCOP(4_200_000));
    expect(formatOperationMoney(4_200_000, 4_200, 'USD')).toContain('1.000,00');
    expect(formatOperationMoney(4_200_000, null, 'USD')).toBe('Sin registrar');
    expect(usdRateLabel(null)).toBe('Sin registrar');
  });
});
