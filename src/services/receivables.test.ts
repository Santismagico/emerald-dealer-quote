import { describe, expect, it } from 'vitest';
import type { BuyerPayment, StoneLot, StoneSale } from '../types';
import {
  buyerDebtKey,
  listBuyerDebts,
  listReceivables,
  receivableStatus,
  receivablesOfBuyer,
  receivablesTotals
} from './receivables';

const HOY = '2026-07-21';

function abono(overrides: Partial<BuyerPayment> = {}): BuyerPayment {
  return { id: 'ab-1', date: '2026-07-15', amount: 1000000, notes: '', ...overrides };
}

function venta(overrides: Partial<StoneSale> = {}): StoneSale {
  return {
    id: 'v-1',
    date: '2026-07-01',
    buyer: 'Joyería Ejemplo',
    buyerId: null,
    carats: 1,
    quantity: 1,
    valueCop: 3000000,
    onCredit: true,
    dueDate: '2026-08-01',
    payments: [],
    notes: '',
    ...overrides
  };
}

function lote(sales: StoneSale[], overrides: Partial<StoneLot> = {}): StoneLot {
  return {
    id: 'l-1',
    name: 'Lote Ejemplo',
    stoneType: 'Esmeralda',
    description: '',
    purchaseDate: '2026-06-01',
    supplier: '',
    supplierId: null,
    carats: 10,
    quantity: 10,
    purchaseValueCop: 5000000,
    onCredit: false,
    supplierPayments: [],
    notes: '',
    sales,
    createdAt: '2026-06-01T09:00:00.000Z',
    updatedAt: '2026-06-01T09:00:00.000Z',
    ...overrides
  };
}

describe('semáforo de una deuda', () => {
  it('el día anterior a la fecha acordada todavía no está vencida', () => {
    expect(receivableStatus('2026-07-22', HOY)).toBe('porVencer');
  });

  it('el mismo día de la fecha acordada tampoco está vencida', () => {
    // Quedaron de pagar HOY: el día aún no termina.
    expect(receivableStatus(HOY, HOY)).toBe('porVencer');
  });

  it('el día siguiente a la fecha acordada ya está vencida', () => {
    expect(receivableStatus('2026-07-20', HOY)).toBe('vencido');
  });

  it('una fecha lejana está al día', () => {
    expect(receivableStatus('2026-09-01', HOY)).toBe('alDia');
  });

  it('justo en el borde de los 7 días empieza a avisar', () => {
    expect(receivableStatus('2026-07-28', HOY)).toBe('porVencer');
    expect(receivableStatus('2026-07-29', HOY)).toBe('alDia');
  });

  it('una fecha vacía o inválida nunca se presenta como vencida', () => {
    expect(receivableStatus('', HOY)).toBe('alDia');
    expect(receivableStatus('cuando pueda', HOY)).toBe('alDia');
  });
});

describe('listReceivables', () => {
  it('ignora las ventas de contado', () => {
    const lots = [lote([venta({ onCredit: false, dueDate: '', payments: [] })])];
    expect(listReceivables(lots, HOY)).toEqual([]);
  });

  it('una venta a crédito sin abonos debe su valor completo', () => {
    const [r] = listReceivables([lote([venta()])], HOY);
    expect(r.totalCop).toBe(3000000);
    expect(r.paidCop).toBe(0);
    expect(r.balanceCop).toBe(3000000);
  });

  it('descuenta los abonos recibidos', () => {
    const lots = [
      lote([venta({ payments: [abono({ amount: 1000000 }), abono({ id: 'ab-2', amount: 500000 })] })])
    ];
    const [r] = listReceivables(lots, HOY);
    expect(r.paidCop).toBe(1500000);
    expect(r.balanceCop).toBe(1500000);
  });

  it('una venta ya saldada desaparece aunque su fecha esté vencida', () => {
    const lots = [
      lote([venta({ dueDate: '2026-07-01', payments: [abono({ amount: 3000000 })] })])
    ];
    expect(listReceivables(lots, HOY)).toEqual([]);
  });

  it('cuenta los días vencidos desde la fecha acordada', () => {
    const [r] = listReceivables([lote([venta({ dueDate: '2026-07-11' })])], HOY);
    expect(r.status).toBe('vencido');
    expect(r.daysOverdue).toBe(10);
    expect(r.daysUntilDue).toBe(0);
  });

  it('cuenta los días que faltan cuando aún no se vence', () => {
    const [r] = listReceivables([lote([venta({ dueDate: '2026-07-26' })])], HOY);
    expect(r.daysOverdue).toBe(0);
    expect(r.daysUntilDue).toBe(5);
  });

  it('pone primero al más atrasado', () => {
    const lots = [
      lote([
        venta({ id: 'v-nueva', dueDate: '2026-07-20' }),
        venta({ id: 'v-vieja', dueDate: '2026-06-01' }),
        venta({ id: 'v-futura', dueDate: '2026-09-01' })
      ])
    ];
    expect(listReceivables(lots, HOY).map((r) => r.saleId)).toEqual([
      'v-vieja',
      'v-nueva',
      'v-futura'
    ]);
  });

  it('conserva de qué lote salió cada cobro', () => {
    const [r] = listReceivables([lote([venta()], { id: 'l-x', name: 'Lote Ejemplo 12' })], HOY);
    expect(r.lotId).toBe('l-x');
    expect(r.lotName).toBe('Lote Ejemplo 12');
    expect(r.stoneType).toBe('Esmeralda');
  });
});

describe('listBuyerDebts: cuánto me debe cada quien', () => {
  it('consolida dos ventas del mismo comprador registrado', () => {
    const lots = [
      lote([
        venta({ id: 'v-1', buyerId: 'buy-1', buyer: 'Joyería Ejemplo', valueCop: 3000000 }),
        venta({ id: 'v-2', buyerId: 'buy-1', buyer: 'Joyería Ejemplo', valueCop: 2000000 })
      ])
    ];
    const debts = listBuyerDebts(lots, HOY);
    expect(debts).toHaveLength(1);
    expect(debts[0].balanceCop).toBe(5000000);
    expect(debts[0].saleCount).toBe(2);
  });

  it('agrupa a un comprador sin registrar por su nombre, sin importar mayúsculas ni espacios', () => {
    const lots = [
      lote([
        venta({ id: 'v-1', buyer: 'Pedro', valueCop: 1000000 }),
        venta({ id: 'v-2', buyer: '  pedro ', valueCop: 2000000 })
      ])
    ];
    const debts = listBuyerDebts(lots, HOY);
    expect(debts).toHaveLength(1);
    expect(debts[0].balanceCop).toBe(3000000);
  });

  it('no mezcla a dos compradores distintos', () => {
    const lots = [
      lote([
        venta({ id: 'v-1', buyer: 'Pedro', valueCop: 1000000 }),
        venta({ id: 'v-2', buyer: 'Ana', valueCop: 2000000 })
      ])
    ];
    expect(listBuyerDebts(lots, HOY)).toHaveLength(2);
  });

  it('separa la parte vencida del saldo total', () => {
    const lots = [
      lote([
        venta({ id: 'v-vencida', buyerId: 'buy-1', dueDate: '2026-07-01', valueCop: 1000000 }),
        venta({ id: 'v-al-dia', buyerId: 'buy-1', dueDate: '2026-09-01', valueCop: 4000000 })
      ])
    ];
    const [debt] = listBuyerDebts(lots, HOY);
    expect(debt.balanceCop).toBe(5000000);
    expect(debt.overdueCop).toBe(1000000);
    expect(debt.maxDaysOverdue).toBe(20);
    expect(debt.status).toBe('vencido');
  });

  it('pone primero al comprador más atrasado', () => {
    const lots = [
      lote([
        venta({ id: 'v-1', buyer: 'Ana', dueDate: '2026-07-19' }),
        venta({ id: 'v-2', buyer: 'Pedro', dueDate: '2026-07-01' }),
        venta({ id: 'v-3', buyer: 'Luisa', dueDate: '2026-09-01' })
      ])
    ];
    expect(listBuyerDebts(lots, HOY).map((d) => d.buyerName)).toEqual(['Pedro', 'Ana', 'Luisa']);
  });

  it('guarda la fecha acordada más antigua sin saldar', () => {
    const lots = [
      lote([
        venta({ id: 'v-1', buyerId: 'buy-1', dueDate: '2026-08-15' }),
        venta({ id: 'v-2', buyerId: 'buy-1', dueDate: '2026-08-01' })
      ])
    ];
    expect(listBuyerDebts(lots, HOY)[0].oldestDueDate).toBe('2026-08-01');
  });
});

describe('totales de la cabecera de Cobros', () => {
  it('suma lo que deben y cuánto de eso está vencido', () => {
    const lots = [
      lote([
        venta({ id: 'v-1', buyer: 'Pedro', dueDate: '2026-07-01', valueCop: 2000000 }),
        venta({ id: 'v-2', buyer: 'Ana', dueDate: '2026-09-01', valueCop: 3000000 }),
        venta({ id: 'v-3', buyer: 'Luisa', onCredit: false, dueDate: '', valueCop: 9000000 })
      ])
    ];
    expect(receivablesTotals(lots, HOY)).toEqual({
      balanceCop: 5000000,
      overdueCop: 2000000,
      buyerCount: 2,
      saleCount: 2
    });
  });

  it('sin ventas a crédito todo queda en cero', () => {
    expect(receivablesTotals([lote([venta({ onCredit: false, dueDate: '', payments: [] })])], HOY))
      .toEqual({ balanceCop: 0, overdueCop: 0, buyerCount: 0, saleCount: 0 });
  });
});

describe('cobros de un comprador concreto', () => {
  it('encuentra los de un comprador registrado', () => {
    const lots = [
      lote([
        venta({ id: 'v-1', buyerId: 'buy-1', buyer: 'Joyería Ejemplo' }),
        venta({ id: 'v-2', buyerId: 'buy-2', buyer: 'Otra Joyería' })
      ])
    ];
    expect(receivablesOfBuyer(lots, HOY, 'buy-1', 'Joyería Ejemplo').map((r) => r.saleId)).toEqual([
      'v-1'
    ]);
  });

  it('encuentra los de un comprador escrito a mano', () => {
    const lots = [
      lote([venta({ id: 'v-1', buyer: 'Pedro' }), venta({ id: 'v-2', buyer: 'Ana' })])
    ];
    expect(receivablesOfBuyer(lots, HOY, null, 'PEDRO').map((r) => r.saleId)).toEqual(['v-1']);
  });

  it('una venta sin nombre se puede volver a encontrar', () => {
    const lots = [lote([venta({ id: 'v-1', buyer: '' })])];
    const [debt] = listBuyerDebts(lots, HOY);
    expect(receivablesOfBuyer(lots, HOY, debt.buyerId, debt.buyerName).map((r) => r.saleId)).toEqual(
      ['v-1']
    );
  });
});

describe('clave de agrupación', () => {
  it('un comprador registrado se agrupa por su id, no por su nombre', () => {
    expect(buyerDebtKey('buy-1', 'Pedro')).toBe(buyerDebtKey('buy-1', 'Pedro Renombrado'));
  });

  it('sin id, dos escrituras del mismo nombre coinciden', () => {
    expect(buyerDebtKey(null, ' Pedro ')).toBe(buyerDebtKey(null, 'pedro'));
  });
});
