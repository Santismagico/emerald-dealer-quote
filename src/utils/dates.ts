/** Fecha de hoy en formato YYYY-MM-DD (hora local). */
export function todayISO(): string {
  return toISODate(new Date());
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Comprueba que el texto sea una fecha real con formato YYYY-MM-DD. */
export function isValidISODate(isoDate: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** Suma días a una fecha YYYY-MM-DD. */
export function addDays(isoDate: string, days: number): string {
  const d = parseISODate(isoDate);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Interpreta YYYY-MM-DD como fecha local (evita el corrimiento de zona horaria de new Date(iso)). */
export function parseISODate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map((n) => parseInt(n, 10));
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}

/** Formatea YYYY-MM-DD como fecha legible en español, ej: 7 de julio de 2026. */
export function formatDateCO(isoDate: string): string {
  if (!isoDate) return '';
  const d = parseISODate(isoDate);
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** true si validUntil ya pasó respecto a una fecha YYYY-MM-DD fija. */
export function isExpired(validUntil: string, today: string): boolean {
  if (!isValidISODate(validUntil) || !isValidISODate(today)) return false;
  return validUntil < today;
}
