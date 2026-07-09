// Mensaje corto y profesional para compartir la cotización por WhatsApp.
// NUNCA incluye datos internos (margen, costos, fórmula del oro).

import type { Quote, Settings } from '../types';
import type { CalcResult } from '../calc/engine';
import { formatCOP } from '../utils/money';
import { formatDateCO } from '../utils/dates';

export function buildWhatsAppMessage(quote: Quote, calc: CalcResult, settings: Settings): string {
  const lines: string[] = [];
  const clientName = quote.clientSnapshot?.name?.trim();

  lines.push(clientName ? `Hola ${clientName},` : 'Hola,');
  lines.push(`le saludamos de ${settings.jewelryName}.`);
  lines.push('');

  const piece = quote.pieceDescription.trim()
    ? `${quote.pieceType} — ${quote.pieceDescription.trim()}`
    : quote.pieceType;
  lines.push(`Le compartimos la cotización ${quote.number}: ${piece} en ${quote.material}.`);
  lines.push(`Valor total: ${formatCOP(calc.total)}.`);
  if (calc.deposit > 0) {
    lines.push(`Anticipo: ${formatCOP(calc.deposit)} — Saldo: ${formatCOP(calc.balance)}.`);
  }
  if (quote.validUntil) {
    lines.push(`Válida hasta el ${formatDateCO(quote.validUntil)}.`);
  }
  lines.push('');
  lines.push('Le enviamos el PDF con el detalle. Quedamos atentos a cualquier inquietud.');

  return lines.join('\n');
}

/** Construye el enlace wa.me. El teléfono es opcional (abre selector de chat si falta). */
export function whatsAppLink(message: string, phone?: string): string {
  const clean = (phone ?? '').replace(/[^\d]/g, '');
  const encoded = encodeURIComponent(message);
  return clean ? `https://wa.me/${clean}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}
