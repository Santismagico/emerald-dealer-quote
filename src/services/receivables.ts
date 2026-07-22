// Lógica PURA de los COBROS: quién le debe a la joyería, cuánto y hace cuántos
// días (D-042/D-046). Nace de una petición concreta de un comerciante real:
// «vendo a crédito y necesito revisar si ya me pagaron en las fechas acordadas».
//
// Igual que el vencimiento de cotizaciones (D-013), nada de esto se guarda:
// saldo, semáforo y días de atraso se DERIVAN en el momento de mostrarlos, y
// `today` entra siempre como parámetro para que el motor no lea el reloj.

import type { StoneLot, StoneSale } from '../types';
import { isValidISODate, parseISODate } from '../utils/dates';
import { lotDisplayName, summarizeStoneSale } from './stones';

/** Días de anticipación con los que una deuda empieza a avisar en amarillo. */
export const DUE_SOON_DAYS = 7;

export type ReceivableStatus = 'alDia' | 'porVencer' | 'vencido';

/** Una venta a crédito con saldo, vista como cobro pendiente. */
export interface Receivable {
  saleId: string;
  lotId: string;
  lotName: string;
  stoneType: string;
  buyerId: string | null;
  buyerName: string;
  /** Fecha de la venta (YYYY-MM-DD). */
  date: string;
  /** Fecha acordada de pago (YYYY-MM-DD). */
  dueDate: string;
  totalCop: number;
  paidCop: number;
  balanceCop: number;
  status: ReceivableStatus;
  /** Días transcurridos desde la fecha acordada. 0 si aún no se vence. */
  daysOverdue: number;
  /** Días que faltan para la fecha acordada. 0 si ya se venció. */
  daysUntilDue: number;
}

/** Todo lo que un mismo comprador debe, sumando sus ventas a crédito. */
export interface BuyerDebt {
  buyerId: string | null;
  buyerName: string;
  balanceCop: number;
  /** Parte del saldo que ya está vencida. */
  overdueCop: number;
  /** La fecha acordada más antigua que sigue sin saldar. */
  oldestDueDate: string;
  maxDaysOverdue: number;
  /** Días que faltan para el cobro más próximo. 0 si ya hay algo vencido. */
  daysUntilDue: number;
  saleCount: number;
  status: ReceivableStatus;
}

/** Diferencia en días entre dos fechas YYYY-MM-DD, leídas como fechas locales. */
function daysBetween(from: string, to: string): number {
  const start = parseISODate(from).getTime();
  const end = parseISODate(to).getTime();
  return Math.round((end - start) / 86_400_000);
}

/**
 * Semáforo de una deuda. Una fecha inválida o vacía nunca se presenta como
 * vencida: no se inventa un atraso que no se puede demostrar.
 */
export function receivableStatus(dueDate: string, today: string): ReceivableStatus {
  if (!isValidISODate(dueDate) || !isValidISODate(today)) return 'alDia';
  if (dueDate < today) return 'vencido';
  return daysBetween(today, dueDate) <= DUE_SOON_DAYS ? 'porVencer' : 'alDia';
}

/**
 * Clave con la que se agrupa a un comprador. Un comprador registrado se agrupa
 * por su id; uno escrito a mano, por su nombre normalizado, para que "Pedro" y
 * "pedro " no aparezcan como dos deudores distintos.
 */
export function buyerDebtKey(buyerId: string | null, buyerName: string): string {
  if (buyerId) return `id:${buyerId}`;
  return `name:${buyerName.trim().toLowerCase()}`;
}

function buyerDisplayName(sale: StoneSale): string {
  return sale.buyer.trim() || 'Sin nombre';
}

/**
 * Todas las ventas a crédito que aún tienen saldo, de la más atrasada a la más
 * reciente. Una venta saldada desaparece de la lista aunque su fecha ya pasara.
 */
export function listReceivables(lots: readonly StoneLot[], today: string): Receivable[] {
  const receivables: Receivable[] = [];
  for (const lot of lots) {
    for (const sale of lot.sales) {
      if (!sale.onCredit) continue;
      const summary = summarizeStoneSale(sale);
      if (summary.balanceCop <= 0) continue;

      const status = receivableStatus(sale.dueDate, today);
      const valid = isValidISODate(sale.dueDate) && isValidISODate(today);
      receivables.push({
        saleId: sale.id,
        lotId: lot.id,
        lotName: lotDisplayName(lot),
        stoneType: lot.stoneType,
        buyerId: sale.buyerId,
        buyerName: buyerDisplayName(sale),
        date: sale.date,
        dueDate: sale.dueDate,
        totalCop: summary.receivedCop + summary.balanceCop,
        paidCop: summary.receivedCop,
        balanceCop: summary.balanceCop,
        status,
        daysOverdue: valid && status === 'vencido' ? daysBetween(sale.dueDate, today) : 0,
        daysUntilDue: valid && status !== 'vencido' ? Math.max(0, daysBetween(today, sale.dueDate)) : 0
      });
    }
  }
  return sortReceivables(receivables);
}

/** Primero el más atrasado; a igual atraso, primero el de fecha acordada más antigua. */
export function sortReceivables(receivables: readonly Receivable[]): Receivable[] {
  return [...receivables].sort((a, b) => {
    if (a.daysOverdue !== b.daysOverdue) return b.daysOverdue - a.daysOverdue;
    const byDue = a.dueDate.localeCompare(b.dueDate);
    if (byDue !== 0) return byDue;
    return a.saleId.localeCompare(b.saleId);
  });
}

/**
 * Consolida por comprador: la respuesta a "¿cuánto me debe Fulano en total?".
 * Las ventas de un comprador registrado se agrupan por su id; las de un nombre
 * libre, por el nombre normalizado.
 */
export function listBuyerDebts(lots: readonly StoneLot[], today: string): BuyerDebt[] {
  const byBuyer = new Map<string, BuyerDebt>();
  for (const lot of lots) {
    for (const sale of lot.sales) {
      if (!sale.onCredit) continue;
      const summary = summarizeStoneSale(sale);
      if (summary.balanceCop <= 0) continue;

      const status = receivableStatus(sale.dueDate, today);
      const overdue = status === 'vencido';
      const valid = isValidISODate(sale.dueDate) && isValidISODate(today);
      const days = overdue && valid ? daysBetween(sale.dueDate, today) : 0;
      const until = !overdue && valid ? Math.max(0, daysBetween(today, sale.dueDate)) : 0;

      const key = buyerDebtKey(sale.buyerId, buyerDisplayName(sale));
      const current = byBuyer.get(key);
      if (!current) {
        byBuyer.set(key, {
          buyerId: sale.buyerId,
          buyerName: buyerDisplayName(sale),
          balanceCop: summary.balanceCop,
          overdueCop: overdue ? summary.balanceCop : 0,
          oldestDueDate: sale.dueDate,
          maxDaysOverdue: days,
          daysUntilDue: until,
          saleCount: 1,
          status
        });
        continue;
      }

      current.balanceCop += summary.balanceCop;
      if (overdue) current.overdueCop += summary.balanceCop;
      current.saleCount += 1;
      current.maxDaysOverdue = Math.max(current.maxDaysOverdue, days);
      if (!current.oldestDueDate || (sale.dueDate && sale.dueDate < current.oldestDueDate)) {
        current.oldestDueDate = sale.dueDate;
      }
      // El semáforo del comprador es el de su venta más urgente.
      if (overdue || (current.status === 'alDia' && status === 'porVencer')) {
        current.status = status;
      }
      // Los días que faltan son los del cobro más próximo; si ya hay algo
      // vencido, ese dato deja de importar y queda en cero.
      current.daysUntilDue = current.maxDaysOverdue > 0 ? 0 : Math.min(current.daysUntilDue, until);
    }
  }

  return [...byBuyer.values()].sort((a, b) => {
    if (a.maxDaysOverdue !== b.maxDaysOverdue) return b.maxDaysOverdue - a.maxDaysOverdue;
    if (a.balanceCop !== b.balanceCop) return b.balanceCop - a.balanceCop;
    return a.buyerName.localeCompare(b.buyerName, 'es', { sensitivity: 'base' });
  });
}

/** Totales de la cabecera de Cobros: cuánto le deben y cuánto de eso está vencido. */
export interface ReceivablesTotals {
  balanceCop: number;
  overdueCop: number;
  buyerCount: number;
  saleCount: number;
}

export function receivablesTotals(lots: readonly StoneLot[], today: string): ReceivablesTotals {
  const debts = listBuyerDebts(lots, today);
  let balanceCop = 0;
  let overdueCop = 0;
  let saleCount = 0;
  for (const debt of debts) {
    balanceCop += debt.balanceCop;
    overdueCop += debt.overdueCop;
    saleCount += debt.saleCount;
  }
  return { balanceCop, overdueCop, buyerCount: debts.length, saleCount };
}

/** Cobros de un comprador concreto. `buyerId` null busca por nombre libre. */
export function receivablesOfBuyer(
  lots: readonly StoneLot[],
  today: string,
  buyerId: string | null,
  buyerName: string
): Receivable[] {
  const target = buyerDebtKey(buyerId, buyerName);
  return listReceivables(lots, today).filter(
    (receivable) => buyerDebtKey(receivable.buyerId, receivable.buyerName) === target
  );
}
