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

/** true si la fecha YYYY-MM-DD ya pasó respecto a hoy. */
export function isExpired(validUntil: string): boolean {
  if (!validUntil) return false;
  return validUntil < todayISO();
}
