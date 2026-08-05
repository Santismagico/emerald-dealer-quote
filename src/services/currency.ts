import { formatCOP } from '../utils/money';
import { isValidUsdRate, MAX_COP_PER_USD, MIN_COP_PER_USD } from './goldPrice';

export type CurrencyView = 'COP' | 'USD';

/** Lectura compatible: históricos o datos corruptos quedan sin tasa, nunca inventados. */
export function normalizeUsdRate(value: unknown): number | null {
  return isValidUsdRate(value) ? value : null;
}

/** Validación previa al guardado: null es el estado histórico permitido. */
export function validateOptionalUsdRate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (!isValidUsdRate(value)) {
    return `La tasa USD/COP debe estar entre ${MIN_COP_PER_USD.toLocaleString('es-CO')} y ${MAX_COP_PER_USD.toLocaleString('es-CO')}.`;
  }
  return null;
}

/** Una operación nueva toma la última tasa válida conocida; una histórica no pasa por aquí. */
export function newOperationUsdRate(lastKnownUsdRate: number | null): number | null {
  return normalizeUsdRate(lastKnownUsdRate);
}

/**
 * Resuelve una consulta tardía sin perder lo que la persona ya escribió.
 * Se mantiene pura para probar la regla sin depender de tiempos de pantalla.
 */
export function resolveUsdRatePrefill(
  currentUsdRate: number | null,
  fetchedUsdRate: unknown,
  wasManuallyTouched: boolean
): number | null {
  if (wasManuallyTouched) return currentUsdRate;
  return normalizeUsdRate(fetchedUsdRate) ?? currentUsdRate;
}

function storedRateDate(updatedAt: string): string {
  const date = updatedAt.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const [year, month, day] = date.split('-');
  return ` del ${day}/${month}/${year}`;
}

export function storedUsdRateSource(
  usdRate: number | null,
  updatedAt: string,
  offline = false
): string {
  if (normalizeUsdRate(usdRate) === null) {
    return offline ? 'Sin conexión y sin tasa guardada' : 'Sin tasa guardada';
  }
  const label = `última tasa guardada${storedRateDate(updatedAt)}`;
  return offline ? `Sin conexión · ${label}` : label[0].toLocaleUpperCase('es') + label.slice(1);
}

/** Convierte cada operación por separado. Nunca sirve para sumar montos con tasas mezcladas. */
export function copToUsd(cop: number, usdRate: number | null): number | null {
  const rate = normalizeUsdRate(usdRate);
  return rate === null ? null : cop / rate;
}

const usdFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

/** Presentación pura; no escribe ni devuelve una copia alterada de la operación. */
export function formatOperationMoney(
  cop: number,
  usdRate: number | null,
  view: CurrencyView
): string {
  if (view === 'COP') return formatCOP(cop);
  const usd = copToUsd(cop, usdRate);
  return usd === null ? 'Sin registrar' : usdFormatter.format(usd);
}

export function usdRateLabel(usdRate: number | null): string {
  return usdRate === null
    ? 'Sin registrar'
    : `1 USD = ${Math.round(usdRate).toLocaleString('es-CO')} COP`;
}
