import type { Expense, ExpenseCategoryOption } from '../types';
import { isValidISODate } from '../utils/dates';
import { newId } from '../utils/id';
import { toSafeCOP } from '../utils/money';

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

export function emptyExpense(date: string, nowIso: string): Expense {
  return {
    id: newId(),
    date,
    concept: '',
    category: BASE_EXPENSE_CATEGORIES[0],
    amountCop: 0,
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

export function validateExpense(expense: Expense): string | null {
  if (!isValidISODate(expense.date)) return 'El gasto necesita una fecha válida.';
  if (!expense.concept.trim()) return 'Escribe el concepto del gasto.';
  if (!expense.category.trim()) return 'Elige una categoría.';
  if (!Number.isInteger(expense.amountCop) || toSafeCOP(expense.amountCop) <= 0) {
    return 'Indica un monto válido en pesos.';
  }
  if (!expense.method.trim()) return 'Escribe la forma de pago.';
  if (!expense.paidBy.trim()) return 'Escribe quién pagó.';
  const shared = expense.partnerId !== null || expense.partnerName.trim().length > 0;
  if (shared && !expense.partnerName.trim()) return 'Elige el socio del gasto.';
  if (!Number.isInteger(expense.myPercent) || expense.myPercent < 0 || expense.myPercent > 100) {
    return 'Tu porcentaje debe estar entre 0 y 100.';
  }
  if (!shared && expense.myPercent !== 100) return 'Un gasto sin socio debe ser 100% propio.';
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

function expensePartnerKey(expense: Expense): string {
  if (expense.partnerId) return `id:${expense.partnerId}`;
  return `name:${expense.partnerName.trim().toLocaleLowerCase('es')}`;
}

/** Gastos compartidos acumulados por socio, derivados del historial guardado. */
export function expensesByPartner(expenses: readonly Expense[]): PartnerExpenseShare[] {
  const byPartner = new Map<string, PartnerExpenseShare>();
  for (const expense of expenses) {
    const shared = expense.partnerId !== null || expense.partnerName.trim().length > 0;
    if (!shared) continue;
    const split = expenseSplit(expense);
    const key = expensePartnerKey(expense);
    const current = byPartner.get(key) ?? {
      partnerId: expense.partnerId,
      partnerName: expense.partnerName.trim() || 'Sin nombre',
      totalAmountCop: 0,
      myAmountCop: 0,
      partnerAmountCop: 0,
      expenseCount: 0
    };
    current.totalAmountCop += toSafeCOP(expense.amountCop);
    current.myAmountCop += split.myAmountCop;
    current.partnerAmountCop += split.partnerAmountCop;
    current.expenseCount += 1;
    byPartner.set(key, current);
  }
  return [...byPartner.values()].sort((a, b) => b.totalAmountCop - a.totalAmountCop);
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
