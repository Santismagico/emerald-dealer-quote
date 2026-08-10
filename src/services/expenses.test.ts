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
  validateExpense,
  validateExpenseOperation
} from './expenses';

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'g-1',
    date: '2026-08-03',
    concept: 'Arriendo del local',
    category: 'Arriendo',
    amountCop: 100001,
    usdRate: null,
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

  it('exige tasa al crear y la deja fija después del primer guardado', () => {
    expect(validateExpenseOperation(expense(), null)).toMatch(/tasa USD\/COP/);
    expect(validateExpenseOperation(expense({ usdRate: 4100 }), null)).toBeNull();
    expect(validateExpenseOperation(expense(), expense())).toBeNull();
    expect(
      validateExpenseOperation(expense({ usdRate: 4100 }), expense())
    ).toMatch(/no se puede cambiar/);
    expect(
      validateExpenseOperation(
        expense({ usdRate: 4200 }),
        expense({ usdRate: 4100 })
      )
    ).toMatch(/no se puede cambiar/);
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

describe('gastos compartidos con varios socios (D-073)', () => {
  it('reparte un gasto entre dos socios y deriva lo propio', () => {
    const split = expenseSplit(
      expense({
        amountCop: 1000000,
        partners: [
          { id: 'p-1', partnerId: 'soc-1', partnerName: 'Ana', amountCop: 300000 },
          { id: 'p-2', partnerId: 'soc-2', partnerName: 'Beto', amountCop: 200000 }
        ]
      })
    );
    expect(split.myAmountCop).toBe(500000);
    expect(split.partnerAmountCop).toBe(500000);
  });

  it('la lista manda sobre el porcentaje viejo', () => {
    // myPercent quedó desactualizado a propósito.
    const split = expenseSplit(
      expense({
        amountCop: 1000000,
        partnerId: 'soc-1',
        partnerName: 'Ana',
        myPercent: 90,
        partners: [{ id: 'p-1', partnerId: 'soc-1', partnerName: 'Ana', amountCop: 400000 }]
      })
    );
    expect(split.myAmountCop).toBe(600000);
  });

  it('un gasto viejo, sin lista, sigue dando exactamente lo mismo', () => {
    const split = expenseSplit(
      expense({ amountCop: 1000000, partnerId: 'soc-1', partnerName: 'Ana', myPercent: 70 })
    );
    expect(split.myAmountCop).toBe(700000);
    expect(split.partnerAmountCop).toBe(300000);
  });

  it('un gasto sin socios es entero suyo', () => {
    const split = expenseSplit(expense({ amountCop: 1000000 }));
    expect(split.myAmountCop).toBe(1000000);
    expect(split.partnerAmountCop).toBe(0);
  });

  it('el informe da una fila por persona, no una por gasto', () => {
    const filas = expensesByPartner([
      expense({
        id: 'g-1',
        amountCop: 1000000,
        partners: [
          { id: 'p-1', partnerId: 'soc-1', partnerName: 'Ana', amountCop: 300000 },
          { id: 'p-2', partnerId: 'soc-2', partnerName: 'Beto', amountCop: 200000 }
        ]
      }),
      expense({
        id: 'g-2',
        amountCop: 400000,
        partners: [{ id: 'p-3', partnerId: 'soc-1', partnerName: 'Ana', amountCop: 100000 }]
      })
    ]);
    expect(filas).toHaveLength(2);
    const ana = filas.find((fila) => fila.partnerId === 'soc-1');
    expect(ana?.partnerAmountCop).toBe(400000);
    expect(ana?.expenseCount).toBe(2);
    const beto = filas.find((fila) => fila.partnerId === 'soc-2');
    expect(beto?.partnerAmountCop).toBe(200000);
    expect(beto?.expenseCount).toBe(1);
  });
});
