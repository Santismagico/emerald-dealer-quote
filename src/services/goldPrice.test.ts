import { describe, it, expect, vi } from 'vitest';
import {
  computeGoldPricePerGram,
  fetchUsdRateCOP,
  GRAMS_PER_TROY_OUNCE
} from './goldPrice';

describe('precio del oro: internacional + recargo por gramo', () => {
  it('convierte USD/onza a COP/gramo y suma el recargo de $100.000', () => {
    const r = computeGoldPricePerGram(4000, 3300, 100000);
    const expectedInternational = Math.round((4000 / GRAMS_PER_TROY_OUNCE) * 3300);
    expect(r.internationalCopPerGram).toBe(expectedInternational);
    expect(r.markupPerGram).toBe(100000);
    expect(r.totalCopPerGram).toBe(expectedInternational + 100000);
  });

  it('el resultado siempre es un entero en COP', () => {
    const r = computeGoldPricePerGram(4063.800049, 3340.628721, 100000);
    expect(Number.isInteger(r.internationalCopPerGram)).toBe(true);
    expect(Number.isInteger(r.totalCopPerGram)).toBe(true);
  });

  it('caso realista: valores del 2026-07-08 dan un precio plausible', () => {
    const r = computeGoldPricePerGram(4063.8, 3340.63, 100000);
    // ~436.500 internacional + 100.000
    expect(r.internationalCopPerGram).toBeGreaterThan(400000);
    expect(r.internationalCopPerGram).toBeLessThan(500000);
    expect(r.totalCopPerGram).toBe(r.internationalCopPerGram + 100000);
  });

  it('acepta recargo distinto (configurable)', () => {
    const r = computeGoldPricePerGram(4000, 3300, 150000);
    expect(r.totalCopPerGram).toBe(r.internationalCopPerGram + 150000);
  });

  it('rechaza valores fuera de rango razonable (API comprometida o dañada)', () => {
    expect(() => computeGoldPricePerGram(3.5, 3300, 100000)).toThrow('fuera de un rango razonable');
    expect(() => computeGoldPricePerGram(999999, 3300, 100000)).toThrow('fuera de un rango razonable');
    expect(() => computeGoldPricePerGram(4000, 33, 100000)).toThrow('fuera de un rango razonable');
    expect(() => computeGoldPricePerGram(4000, 999999, 100000)).toThrow('fuera de un rango razonable');
  });

  it('rechaza datos inválidos de las fuentes', () => {
    expect(() => computeGoldPricePerGram(NaN, 3300, 100000)).toThrow('oro');
    expect(() => computeGoldPricePerGram(0, 3300, 100000)).toThrow('oro');
    expect(() => computeGoldPricePerGram(-5, 3300, 100000)).toThrow('oro');
    expect(() => computeGoldPricePerGram(4000, NaN, 100000)).toThrow('tasa de cambio');
    expect(() => computeGoldPricePerGram(4000, 0, 100000)).toThrow('tasa de cambio');
    expect(() => computeGoldPricePerGram(4000, 3300, -1)).toThrow('recargo');
    expect(() => computeGoldPricePerGram(4000, 3300, NaN)).toThrow('recargo');
  });

  it('consulta la misma fuente USD/COP aprobada sin depender del proveedor de oro', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => ({
      ok: true,
      json: async () => ({ rates: { COP: 4100.25 } })
    }));
    vi.stubGlobal('fetch', fetchMock);

    const snapshot = await fetchUsdRateCOP();

    expect(snapshot.rate).toBe(4100.25);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://open.er-api.com/v6/latest/USD');
    vi.unstubAllGlobals();
  });

  it('rechaza una tasa consultada fuera de los límites existentes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ rates: { COP: 999 } })
    })));

    await expect(fetchUsdRateCOP()).rejects.toThrow(/fuera de un rango razonable/);
    vi.unstubAllGlobals();
  });
});
