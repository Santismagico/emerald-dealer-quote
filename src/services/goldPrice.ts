// Precio del oro automático (SOLO uso interno, nunca visible al cliente).
// Regla comercial de Emerald Dealer: precio internacional 24K del día + recargo
// fijo por gramo (por defecto $100.000 COP). Ver DECISIONS.md D-002.
//
// Fuentes gratuitas sin clave:
//  - Oro (USD por onza troy): https://api.gold-api.com/price/XAU
//  - Dólar (USD -> COP):      https://open.er-api.com/v6/latest/USD
//
// Si no hay internet, la app sigue funcionando con el último precio guardado.

export const GRAMS_PER_TROY_OUNCE = 31.1034768;

const GOLD_API_URL = 'https://api.gold-api.com/price/XAU';
const FX_API_URL = 'https://open.er-api.com/v6/latest/USD';
const TIMEOUT_MS = 12000;

export interface GoldPriceBreakdown {
  /** Precio internacional del oro en USD por onza troy. */
  usdPerOunce: number;
  /** Tasa de cambio USD -> COP. */
  copPerUsd: number;
  /** Precio internacional por gramo en COP (redondeado a entero). */
  internationalCopPerGram: number;
  /** Recargo fijo por gramo en COP. */
  markupPerGram: number;
  /** Precio final interno por gramo: internacional + recargo. */
  totalCopPerGram: number;
  /** Momento de la consulta (ISO). */
  fetchedAt: string;
}

/**
 * Cálculo puro y testeable: convierte USD/onza a COP/gramo y suma el recargo.
 * Lanza Error con mensaje humano si los datos de entrada no son razonables.
 */
export function computeGoldPricePerGram(
  usdPerOunce: number,
  copPerUsd: number,
  markupPerGram: number
): GoldPriceBreakdown {
  if (!Number.isFinite(usdPerOunce) || usdPerOunce <= 0) {
    throw new Error('El precio internacional del oro recibido no es válido.');
  }
  if (!Number.isFinite(copPerUsd) || copPerUsd <= 0) {
    throw new Error('La tasa de cambio USD/COP recibida no es válida.');
  }
  if (!Number.isFinite(markupPerGram) || markupPerGram < 0) {
    throw new Error('El recargo por gramo no es válido.');
  }
  const internationalCopPerGram = Math.round((usdPerOunce / GRAMS_PER_TROY_OUNCE) * copPerUsd);
  const markup = Math.round(markupPerGram);
  return {
    usdPerOunce,
    copPerUsd,
    internationalCopPerGram,
    markupPerGram: markup,
    totalCopPerGram: internationalCopPerGram + markup,
    fetchedAt: new Date().toISOString()
  };
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Respuesta ${response.status} de ${url}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Consulta el precio internacional del oro y la tasa USD/COP del día,
 * y devuelve el precio interno por gramo (internacional + recargo).
 * Lanza Error si no hay internet o alguna fuente falla.
 */
export async function fetchGoldPriceCOP(markupPerGram: number): Promise<GoldPriceBreakdown> {
  const [goldRaw, fxRaw] = await Promise.all([fetchJson(GOLD_API_URL), fetchJson(FX_API_URL)]);

  const gold = goldRaw as { price?: number };
  const fx = fxRaw as { rates?: { COP?: number } };

  const usdPerOunce = typeof gold?.price === 'number' ? gold.price : NaN;
  const copPerUsd = typeof fx?.rates?.COP === 'number' ? fx.rates.COP : NaN;

  return computeGoldPricePerGram(usdPerOunce, copPerUsd, markupPerGram);
}
