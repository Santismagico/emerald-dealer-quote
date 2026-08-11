import { describe, expect, it } from 'vitest';
import type { FundContribution, FundPayment } from '../types';
import {
  accruedReturn,
  contributionBalance,
  financingCostForOwner,
  fundByPerson,
  fundTotals,
  monthsElapsed,
  validateFundContribution
} from './fund';

function pago(overrides: Partial<FundPayment> = {}): FundPayment {
  return { id: 'pg-1', date: '2026-03-01', amountCop: 0, kind: 'rendimiento', notes: '', ...overrides };
}

function aporte(overrides: Partial<FundContribution> = {}): FundContribution {
  return {
    id: 'a-1',
    personId: 'q-1',
    personName: 'Ana',
    date: '2026-01-15',
    amountCop: 3_000_000,
    returnKind: 'mensual',
    monthlyRatePercent: 2,
    agreedTotalCop: null,
    dueDate: '',
    payments: [],
    notes: '',
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    ...overrides
  };
}

describe('monthsElapsed — se cuentan meses cumplidos, no días sueltos', () => {
  it('a los 45 días va un mes, no dos', () => {
    expect(monthsElapsed('2026-01-15', '2026-03-01')).toBe(1);
  });

  it('el mismo día del mes siguiente ya es un mes cumplido', () => {
    expect(monthsElapsed('2026-01-15', '2026-02-15')).toBe(1);
  });

  it('un día antes todavía no', () => {
    expect(monthsElapsed('2026-01-15', '2026-02-14')).toBe(0);
  });

  it('del 31 de enero al 28 de febrero SÍ es un mes: febrero no tiene día 31', () => {
    expect(monthsElapsed('2026-01-31', '2026-02-28')).toBe(1);
  });

  it('nunca devuelve negativos si la fecha de corte es anterior', () => {
    expect(monthsElapsed('2026-05-10', '2026-01-01')).toBe(0);
  });

  it('fechas inválidas devuelven cero en vez de reventar', () => {
    expect(monthsElapsed('no-es-fecha', '2026-01-01')).toBe(0);
  });
});

describe('(e) devengo del rendimiento, con redondeo a peso entero', () => {
  it('porcentaje mensual: capital por tasa por meses cumplidos', () => {
    const a = aporte({ amountCop: 3_000_000, monthlyRatePercent: 2 });
    expect(accruedReturn(a, '2026-04-15')).toBe(180_000); // 3 meses × 2 %
  });

  it('no devenga nada antes del primer mes cumplido', () => {
    expect(accruedReturn(aporte(), '2026-02-01')).toBe(0);
  });

  it('una tasa con decimales se redondea a peso entero', () => {
    const a = aporte({ amountCop: 1_000_001, monthlyRatePercent: 1.5 });
    // 1.000.001 × 1,5 % × 1 mes = 15.000,015 → 15.000
    expect(accruedReturn(a, '2026-02-15')).toBe(15_000);
    expect(Number.isInteger(accruedReturn(a, '2026-02-15'))).toBe(true);
  });

  it('sigue devengando después del plazo: una deuda no se borra por vencerse', () => {
    const a = aporte({ dueDate: '2026-03-15' });
    expect(accruedReturn(a, '2026-06-15')).toBe(300_000); // 5 meses
  });

  it('cifra fija: el rendimiento pactado se reconoce completo desde el primer día', () => {
    const a = aporte({
      returnKind: 'fijo',
      monthlyRatePercent: null,
      amountCop: 3_000_000,
      agreedTotalCop: 3_600_000,
      dueDate: '2026-07-15'
    });
    expect(accruedReturn(a, '2026-01-15')).toBe(600_000);
    expect(accruedReturn(a, '2026-07-15')).toBe(600_000);
  });
});

describe('estado de un aporte', () => {
  it('suma lo que se le debe: capital pendiente más rendimiento pendiente', () => {
    const balance = contributionBalance(aporte(), '2026-04-15');
    expect(balance.capitalCop).toBe(3_000_000);
    expect(balance.accruedReturnCop).toBe(180_000);
    expect(balance.owedCop).toBe(3_180_000);
    expect(balance.settled).toBe(false);
  });

  it('descuenta los pagos separando capital y rendimiento', () => {
    const a = aporte({
      payments: [
        pago({ id: 'pg-1', kind: 'rendimiento', amountCop: 180_000, date: '2026-04-15' }),
        pago({ id: 'pg-2', kind: 'capital', amountCop: 1_000_000, date: '2026-04-15' })
      ]
    });
    const balance = contributionBalance(a, '2026-04-15');
    expect(balance.returnOutstandingCop).toBe(0);
    expect(balance.capitalOutstandingCop).toBe(2_000_000);
    expect(balance.owedCop).toBe(2_000_000);
  });

  it('un aporte devuelto por completo queda saldado, pero NO desaparece (D-076)', () => {
    const a = aporte({
      payments: [
        pago({ id: 'pg-1', kind: 'rendimiento', amountCop: 180_000, date: '2026-04-15' }),
        pago({ id: 'pg-2', kind: 'capital', amountCop: 3_000_000, date: '2026-04-15' })
      ]
    });
    const balance = contributionBalance(a, '2026-04-15');
    expect(balance.settled).toBe(true);
    expect(balance.owedCop).toBe(0);
    expect(fundByPerson([a], '2026-04-15')).toHaveLength(1);
  });

  it('marca vencido solo si hay plazo, ya pasó y todavía se debe', () => {
    const vencido = contributionBalance(aporte({ dueDate: '2026-03-15' }), '2026-04-15');
    expect(vencido.overdue).toBe(true);

    const saldado = contributionBalance(
      aporte({
        dueDate: '2026-03-15',
        payments: [
          pago({ id: 'pg-1', kind: 'rendimiento', amountCop: 180_000, date: '2026-04-15' }),
          pago({ id: 'pg-2', kind: 'capital', amountCop: 3_000_000, date: '2026-04-15' })
        ]
      }),
      '2026-04-15'
    );
    expect(saldado.overdue).toBe(false);
  });
});

describe('el fondo se lee por persona, no como un saldo único (D-076)', () => {
  it('agrupa varios aportes de la misma persona', () => {
    const gente = fundByPerson(
      [
        aporte({ id: 'a-1', amountCop: 1_000_000 }),
        aporte({ id: 'a-2', amountCop: 3_000_000 }),
        aporte({ id: 'a-3', personId: 'q-2', personName: 'Luis', amountCop: 5_000_000 })
      ],
      '2026-02-15'
    );
    expect(gente).toHaveLength(2);
    const ana = gente.find((persona) => persona.personId === 'q-1');
    expect(ana?.contributionCount).toBe(2);
    expect(ana?.capitalCop).toBe(4_000_000);
  });

  it('agrupa por nombre a quien no tiene ficha', () => {
    const gente = fundByPerson(
      [
        aporte({ id: 'a-1', personId: null, personName: 'Pedro' }),
        aporte({ id: 'a-2', personId: null, personName: '  pedro  ' })
      ],
      '2026-02-15'
    );
    expect(gente).toHaveLength(1);
    expect(gente[0].contributionCount).toBe(2);
  });

  it('el vencimiento más próximo es el del primer aporte abierto', () => {
    const gente = fundByPerson(
      [
        aporte({ id: 'a-1', dueDate: '2026-09-01' }),
        aporte({ id: 'a-2', dueDate: '2026-06-01' })
      ],
      '2026-02-15'
    );
    expect(gente[0].nextDueDate).toBe('2026-06-01');
  });

  it('el total se DERIVA de las personas; no es un contador aparte', () => {
    const aportes = [
      aporte({ id: 'a-1', amountCop: 1_000_000 }),
      aporte({ id: 'a-2', personId: 'q-2', personName: 'Luis', amountCop: 5_000_000 })
    ];
    const totales = fundTotals(aportes, '2026-02-15');
    const gente = fundByPerson(aportes, '2026-02-15');
    expect(totales.capitalCop).toBe(6_000_000);
    expect(totales.owedCop).toBe(gente.reduce((suma, persona) => suma + persona.owedCop, 0));
    expect(totales.personCount).toBe(2);
  });
});

describe('el costo del financiamiento lo asume Santiago solo (D-075)', () => {
  it('es el rendimiento devengado del fondo, sin tocar el reparto entre socios', () => {
    const aportes = [aporte({ amountCop: 4_000_000, monthlyRatePercent: 2 })];
    expect(financingCostForOwner(aportes, '2026-04-15')).toBe(240_000); // 3 meses × 2 %
  });
});

describe('validación', () => {
  it('acepta un aporte bien hecho', () => {
    expect(validateFundContribution(aporte())).toBeNull();
  });

  it('exige saber de quién es', () => {
    expect(validateFundContribution(aporte({ personId: null, personName: '  ' }))).toBe(
      'Escribe de quién es el aporte.'
    );
  });

  it('exige plata mayor que cero', () => {
    expect(validateFundContribution(aporte({ amountCop: 0 }))).toBe('El aporte debe ser mayor que cero.');
  });

  it('rechaza dinero no entero y pagos repetidos', () => {
    expect(validateFundContribution(aporte({ amountCop: 10.5 }))).toMatch(/pesos/);
    const payment = {
      id: 'pago-1', date: '2026-02-15', amountCop: 100_000,
      kind: 'capital' as const, notes: ''
    };
    expect(validateFundContribution(aporte({ payments: [payment, payment] }))).toMatch(/repetido/);
  });

  it('exige la tasa cuando el trato es mensual', () => {
    expect(validateFundContribution(aporte({ monthlyRatePercent: null }))).toBe(
      'Escribe el porcentaje mensual pactado.'
    );
  });

  it('el total pactado no puede ser menor que la plata que puso', () => {
    const a = aporte({ returnKind: 'fijo', monthlyRatePercent: null, agreedTotalCop: 2_000_000 });
    expect(validateFundContribution(a)).toBe('El total pactado no puede ser menor que la plata que puso.');
  });

  it('rechaza un pago anterior al aporte', () => {
    const a = aporte({ payments: [pago({ date: '2025-12-01', amountCop: 1_000 })] });
    expect(validateFundContribution(a)).toBe('Un pago quedó antes del aporte.');
  });

  it('rechaza una devolución pactada antes del aporte', () => {
    expect(validateFundContribution(aporte({ dueDate: '2025-12-01' }))).toBe(
      'La devolución no puede ser antes del aporte.'
    );
  });
});
