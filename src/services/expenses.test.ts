import { describe, expect, it } from 'vitest';
import type { Expense, ExpenseCategoryOption } from '../types';
import {
  activeExpenseCategories,
  addExpenseCategory,
  expenseCategoryHistory,
  expenseSplit,
  expensesByPartner,
  filterExpenses,
  setExpenseCategoryActive,
  sortExpenses,
  validateExpense
} from './expenses';

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'g-1',
    date: '2026-08-03',
    concept: 'Arriendo del local',
    category: 'Arriendo',
    amountCop: 100001,
    method: 'Transferencia',
    paidBy: 'Santiago',
    partnerId: null,
    partnerName: '',
    myPercent: 100,
    notes: '',
    createdAt: '2026-08-03T10:00:00.000Z',
    updatedAt: '2026-08-03T10:00:00.000Z',
    ...overrides
  };
}

describe('gastos del negocio', () => {
  it('exige fecha, concepto, categoría, COP entero, medio y pagador', () => {
    expect(validateExpense(expense())).toBeNull();
    expect(validateExpense(expense({ date: 'ayer' }))).toMatch(/fecha/);
    expect(validateExpense(expense({ concept: ' ' }))).toMatch(/concepto/);
    expect(validateExpense(expense({ category: '' }))).toMatch(/categoría/);
    expect(validateExpense(expense({ amountCop: 10.5 }))).toMatch(/monto/);
    expect(validateExpense(expense({ method: '' }))).toMatch(/forma de pago/);
    expect(validateExpense(expense({ paidBy: '' }))).toMatch(/quién pagó/);
  });

  it('reparte COP enteros sin perder ni crear un peso', () => {
    const split = expenseSplit(
      expense({ partnerId: 'soc-1', partnerName: 'Socio', myPercent: 60 })
    );
    expect(split).toEqual({ myAmountCop: 60001, partnerAmountCop: 40000 });
    expect(split.myAmountCop + split.partnerAmountCop).toBe(100001);
  });

  it('sin socio siempre es 100% propio y un socio exige porcentaje válido', () => {
    expect(validateExpense(expense({ myPercent: 80 }))).toMatch(/100%/);
    expect(
      validateExpense(expense({ partnerId: 'soc-1', partnerName: 'Socio', myPercent: 101 }))
    ).toMatch(/porcentaje/);
    expect(
      validateExpense(expense({ partnerId: 'soc-1', partnerName: '', myPercent: 60 }))
    ).toMatch(/socio/);
  });

  it('resume por socio los gastos compartidos sin alterar su historial', () => {
    const result = expensesByPartner([
      expense({ partnerId: 'soc-1', partnerName: 'Socio', myPercent: 60, amountCop: 100001 }),
      expense({ id: 'g-2', partnerId: 'soc-1', partnerName: 'Socio', myPercent: 50, amountCop: 100 })
    ]);
    expect(result).toEqual([expect.objectContaining({
      partnerId: 'soc-1',
      totalAmountCop: 100101,
      myAmountCop: 60051,
      partnerAmountCop: 40050,
      expenseCount: 2
    })]);
  });

  it('ordena y filtra por fecha, categoría y texto', () => {
    const values = [
      expense({ id: 'a', date: '2026-08-01', category: 'Arriendo' }),
      expense({ id: 'b', date: '2026-08-03', category: 'Transporte', concept: 'Taxi' })
    ];
    expect(sortExpenses(values).map((item) => item.id)).toEqual(['b', 'a']);
    expect(filterExpenses(values, { from: '2026-08-02' }).map((item) => item.id)).toEqual(['b']);
    expect(filterExpenses(values, { category: 'Arriendo' }).map((item) => item.id)).toEqual(['a']);
    expect(filterExpenses(values, { search: 'taxi' }).map((item) => item.id)).toEqual(['b']);
  });
});

describe('categorías administrables', () => {
  const options: ExpenseCategoryOption[] = [
    { name: 'Arriendo', active: true },
    { name: 'Ferias', active: true }
  ];

  it('agrega, reactiva y desactiva sin borrar el nombre', () => {
    const hidden = setExpenseCategoryActive(options, 'Ferias', false);
    expect(activeExpenseCategories(hidden)).toEqual(['Arriendo']);
    expect(hidden.map((option) => option.name)).toContain('Ferias');
    expect(addExpenseCategory(hidden, ' ferias ')).toEqual(options);
    expect(addExpenseCategory(options, 'Seguros')).toContainEqual({ name: 'Seguros', active: true });
  });

  it('conserva en filtros una categoría histórica aunque ya no se ofrezca', () => {
    const hidden = setExpenseCategoryActive(options, 'Ferias', false);
    expect(expenseCategoryHistory(hidden, [expense({ category: 'Categoría antigua' })])).toEqual([
      'Arriendo',
      'Categoría antigua',
      'Ferias'
    ]);
  });
});
