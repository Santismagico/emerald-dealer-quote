import type { Expense, ExpenseCategoryOption, LotPartner } from '../types';
import {
  activePartners,
  partnersFromLegacy,
  splitByContribution,
  validatePartnersAndFunding
} from './partnership';
import { isValidISODate } from '../utils/dates';
import { newId } from '../utils/id';
import { toSafeCOP } from '../utils/money';
import { validateOptionalUsdRate } from './currency';

export const BASE_EXPENSE_CATEGORIES = [
  'Arriendo',
  'Servicios',
  'Transporte',
  'Herramientas',
  'Publicidad',
  'Nómina',
  'Impuestos',
  'Otro'
] as const;

export function emptyExpense(
  date: string,
  nowIso: string,
  usdRate: number | null = null
): Expense {
  return {
    id: newId(),
    date,
    concept: '',
    category: BASE_EXPENSE_CATEGORIES[0],
    amountCop: 0,
    usdRate,
    method: '',
    paidBy: '',
    partnerId: null,
    partnerName: '',
    myPercent: 100,
    notes: '',
    createdAt: nowIso,
    updatedAt: nowIso
  };
}

export function validateExpense(expense: Expense, previous?: Expense | null): string | null {
  const rateError = validateExpenseRateMetadata(expense, previous);
  if (rateError) return rateError;
  if (!isValidISODate(expense.date)) return 'El gasto necesita una fecha válida.';
  if (!expense.concept.trim()) return 'Escribe el concepto del gasto.';
  if (!expense.category.trim()) return 'Elige una categoría.';
  if (!Number.isInteger(expense.amountCop) || toSafeCOP(expense.amountCop) <= 0) {
    return 'Indica un monto válido en pesos.';
  }
  if (!expense.method.trim()) return 'Escribe la forma de pago.';
  if (!expense.paidBy.trim()) return 'Escribe quién pagó.';
  // Con lista de socios (D-073) manda la lista: los campos del socio único son
  // un reflejo derivado y no pueden contradecirla. Un socio escrito a mano no
  // tiene ficha, así que `partnerId` queda en null y el chequeo viejo —pensado
  // para UN socio— lo leería como "sin socio" y rechazaría el gasto.
  const hasPartnerList = activePartners(expense.partners).length > 0;
  if (!Number.isInteger(expense.myPercent) || expense.myPercent < 0 || expense.myPercent > 100) {
    return 'Tu porcentaje debe estar entre 0 y 100.';
  }
  if (hasPartnerList) {
    return validatePartnersAndFunding({
      totalCostCop: expense.amountCop,
      partners: expense.partners,
      subject: 'gasto'
    });
  }
  const shared = expense.partnerId !== null || expense.partnerName.trim().length > 0;
  if (shared && !expense.partnerName.trim()) return 'Elige el socio del gasto.';
  if (!shared && expense.myPercent !== 100) return 'Un gasto sin socio debe ser 100% propio.';
  return null;
}

/** Valida la tasa sobre datos externos sin normalizar ni exigir campos de una alta nueva. */
export function validateExpenseRateMetadata(
  raw: unknown,
  previous?: Expense | null
): string | null {
  const expense = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const rate = Object.prototype.hasOwnProperty.call(expense, 'usdRate')
    ? expense.usdRate
    : null;
  const rateError = validateOptionalUsdRate(rate);
  if (rateError) return rateError;
  if (previous && previous.usdRate !== rate) {
    return 'La tasa guardada de un gasto no se puede cambiar.';
  }
  return null;
}

/** Regla del formulario: un gasto nuevo necesita tasa; un histórico puede seguir en null. */
export function validateExpenseOperation(
  expense: Expense,
  previous: Expense | null
): string | null {
  const error = validateExpense(expense, previous);
  if (error) return error;
  if (!previous && expense.usdRate === null) return 'Indica la tasa USD/COP del gasto.';
  return null;
}

export function compareExpenses(a: Expense, b: Expense): number {
  return (
    b.date.localeCompare(a.date) ||
    b.createdAt.localeCompare(a.createdAt) ||
    a.id.localeCompare(b.id, 'es')
  );
}

export function sortExpenses(expenses: readonly Expense[]): Expense[] {
  return [...expenses].sort(compareExpenses);
}

export function expenseSplit(expense: Expense): { myAmountCop: number; partnerAmountCop: number } {
  const total = toSafeCOP(expense.amountCop);
  // Con lista de socios (D-073) lo propio se DERIVA: total menos lo que pusieron
  // ellos. Un gasto viejo, sin lista, sigue por el porcentaje de siempre y da
  // exactamente el mismo número que antes.
  const declared = activePartners(expense.partners);
  if (declared.length > 0) {
    const partnersTotal = declared.reduce(
      (sum, partner) => sum + Math.max(0, Math.trunc(partner.amountCop || 0)),
      0
    );
    const myAmountCop = Math.max(0, total - partnersTotal);
    return { myAmountCop, partnerAmountCop: total - myAmountCop };
  }
  const shared = expense.partnerId !== null || expense.partnerName.trim().length > 0;
  const percent = shared ? Math.min(100, Math.max(0, Math.round(expense.myPercent))) : 100;
  const myAmountCop = Math.round((total * percent) / 100);
  return { myAmountCop, partnerAmountCop: total - myAmountCop };
}

export interface PartnerExpenseShare {
  partnerId: string | null;
  partnerName: string;
  totalAmountCop: number;
  myAmountCop: number;
  partnerAmountCop: number;
  expenseCount: number;
}

/**
 * Los socios de un gasto (D-073). Si todavía guarda el modelo de socio único, se
 * convierte al vuelo para poder leerlo sin romperse.
 */
export function expensePartners(expense: Expense): LotPartner[] {
  const declared = activePartners(expense.partners);
  if (declared.length > 0) return declared;
  return partnersFromLegacy({
    partnerId: expense.partnerId,
    partnerName: expense.partnerName,
    myPercent: expense.myPercent,
    totalCostCop: toSafeCOP(expense.amountCop)
  });
}

/**
 * Gastos compartidos acumulados **por cada socio**, no por gasto (D-073).
 *
 * Un mismo gasto con tres socios aporta una fila a cada uno, con lo que le toca
 * a él. `myAmountCop` es lo que le tocó a Santiago dentro de ese gasto.
 */
export function expensesByPartner(expenses: readonly Expense[]): PartnerExpenseShare[] {
  const byPartner = new Map<string, PartnerExpenseShare>();
  for (const expense of expenses) {
    const partners = expensePartners(expense);
    if (partners.length === 0) continue;
    const total = toSafeCOP(expense.amountCop);
    const split = splitByContribution({
      totalCostCop: total,
      realResultCop: total,
      partners
    });
    for (const partner of split.partners) {
      const name = partner.partnerName.trim();
      const key = partner.partnerId ? `id:${partner.partnerId}` : `name:${name.toLocaleLowerCase('es')}`;
      const current = byPartner.get(key) ?? {
        partnerId: partner.partnerId,
        partnerName: name || 'Sin nombre',
        totalAmountCop: 0,
        myAmountCop: 0,
        partnerAmountCop: 0,
        expenseCount: 0
      };
      current.totalAmountCop += total;
      current.myAmountCop += split.myResultCop;
      current.partnerAmountCop += partner.resultCop;
      current.expenseCount += 1;
      byPartner.set(key, current);
    }
  }
  return [...byPartner.values()].sort((a, b) => b.partnerAmountCop - a.partnerAmountCop);
}

export function activeExpenseCategories(options: readonly ExpenseCategoryOption[]): string[] {
  return options.filter((option) => option.active).map((option) => option.name);
}

export function expenseCategoryHistory(
  options: readonly ExpenseCategoryOption[],
  expenses: readonly Expense[]
): string[] {
  const names = new Map<string, string>();
  for (const option of options) names.set(option.name.toLocaleLowerCase('es'), option.name);
  for (const expense of expenses) {
    const name = expense.category.trim();
    if (name) names.set(name.toLocaleLowerCase('es'), name);
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
}

/** Agrega una categoría propia o reactiva una existente; nunca borra historial. */
export function addExpenseCategory(
  options: readonly ExpenseCategoryOption[],
  rawName: string
): ExpenseCategoryOption[] {
  const name = rawName.trim();
  if (!name) return [...options];
  const key = name.toLocaleLowerCase('es');
  let found = false;
  const next = options.map((option) => {
    if (option.name.toLocaleLowerCase('es') !== key) return option;
    found = true;
    return { ...option, active: true };
  });
  return found ? next : [...next, { name, active: true }];
}

/** Activa o deja de ofrecer una categoría, conservando siempre su nombre. */
export function setExpenseCategoryActive(
  options: readonly ExpenseCategoryOption[],
  name: string,
  active: boolean
): ExpenseCategoryOption[] {
  const key = name.trim().toLocaleLowerCase('es');
  return options.map((option) =>
    option.name.toLocaleLowerCase('es') === key ? { ...option, active } : option
  );
}

export function filterExpenses(
  expenses: readonly Expense[],
  filters: { from?: string; to?: string; category?: string; search?: string }
): Expense[] {
  const query = (filters.search ?? '').trim().toLocaleLowerCase('es');
  return sortExpenses(
    expenses.filter((expense) => {
      if (filters.from && expense.date < filters.from) return false;
      if (filters.to && expense.date > filters.to) return false;
      if (filters.category && expense.category !== filters.category) return false;
      if (
        query &&
        ![expense.concept, expense.category, expense.method, expense.paidBy, expense.partnerName, expense.notes]
          .join(' ')
          .toLocaleLowerCase('es')
          .includes(query)
      ) return false;
      return true;
    })
  );
}
