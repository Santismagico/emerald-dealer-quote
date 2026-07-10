// Utilidades de dinero. Todo en COP como enteros.

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0
});

const groupFormatter = new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 0
});

/** Formatea un valor entero en COP, ej: $ 1.250.000 */
export function formatCOP(value: number): string {
  const safe = Number.isFinite(value) ? Math.round(value) : 0;
  return copFormatter.format(safe);
}

/** Formatea con separador de miles sin símbolo, ej: 1.250.000 */
export function formatThousands(value: number): string {
  const safe = Number.isFinite(value) ? Math.round(value) : 0;
  return groupFormatter.format(safe);
}

/** Extrae un entero de un texto con separadores, ej: "1.250.000" -> 1250000 */
export function parseMoney(text: string): number {
  const digits = text.replace(/[^\d]/g, '');
  if (!digits) return 0;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : 0;
}

/** Parsea un decimal escrito con coma o punto, ej: "2,5" -> 2.5 */
export function parseDecimal(text: string): number {
  const cleaned = text.replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Redondeo estándar a peso entero. */
export function roundCOP(value: number): number {
  return Math.round(value);
}

/** COP entero seguro para sumas: valores no numéricos o negativos cuentan como 0. */
export function toSafeCOP(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}
