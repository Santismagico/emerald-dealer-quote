import { describe, expect, it } from 'vitest';
import type { Appointment, Expense } from '../types';
import { sampleQuote } from '../test/fixtures';
import { buildMonthlyReport } from './dailyReport';
import { buildHomeSummary, HOME_GROUPS } from './home';
import { emptyStoneLot, emptyStoneSale } from './stones';

const TODAY = '2026-08-03';
const MONTH = '2026-08';

describe('portada de inicio', () => {
  it('usa exactamente el movimiento neto del cierre mensual', () => {
    const quotes = [
      sampleQuote({
        id: 'q-mes',
        status: 'aprobada',
        date: TODAY,
        approvedAt: '2026-08-03T15:00:00.000Z',
        deposit: 450_001,
        depositDate: TODAY,
        payments: [],
        production: []
      })
    ];
    const expenses: Expense[] = [{
      id: 'g-mes', date: TODAY, concept: 'Publicidad', category: 'Publicidad',
      amountCop: 125_001, usdRate: null, method: 'Transferencia', paidBy: 'Santiago',
      partnerId: null, partnerName: '', myPercent: 100, notes: '',
      createdAt: '2026-08-03T10:00:00.000Z', updatedAt: '2026-08-03T10:00:00.000Z'
    }];

    const home = buildHomeSummary({
      month: MONTH,
      today: TODAY,
      quotes,
      appointments: [],
      stoneLots: [],
      stockJewels: [],
      expenses
    });
    const monthly = buildMonthlyReport(MONTH, quotes, [], [], expenses);

    expect(home.monthlyNet).toBe(monthly.totals.net);
  });

  it('cuenta únicamente los tres avisos definidos por D-052', () => {
    const appointment: Appointment = {
      id: 'a-hoy',
      clientId: null,
      clientName: 'Cliente',
      date: TODAY,
      time: '10:00',
      durationMinutes: 30,
      reason: 'Asesoría',
      notes: '',
      status: 'programada',
      createdAt: '2026-08-01T10:00:00.000Z',
      updatedAt: '2026-08-01T10:00:00.000Z'
    };
    const lot = {
      ...emptyStoneLot(TODAY, '2026-08-03T10:00:00.000Z'),
      id: 'lote-cobro',
      stoneType: 'Esmeralda',
      carats: 2,
      quantity: 2,
      sales: [
        {
          ...emptyStoneSale(TODAY),
          id: 'venta-vencida',
          buyer: 'Comprador',
          carats: 1,
          quantity: 1,
          valueCop: 900_000,
          onCredit: true,
          dueDate: '2026-08-02'
        }
      ]
    };
    const quote = sampleQuote({
      id: 'q-taller',
      status: 'aprobada',
      deliveredAt: '',
      production: [{ ...sampleQuote().production[0], status: 'enProceso', completedAt: '' }]
    });

    const home = buildHomeSummary({
      month: MONTH,
      today: TODAY,
      quotes: [quote],
      appointments: [appointment, { ...appointment, id: 'a-cancelada', status: 'cancelada' }],
      stoneLots: [lot]
    });

    expect(home).toMatchObject({
      appointmentsToday: 1,
      overdueReceivables: 1,
      workshopInProgress: 1
    });
  });

  it('conserva todos los destinos actuales y no adelanta fases futuras', () => {
    const destinations = HOME_GROUPS.flatMap((group) => group.items.map((item) => item.destination));

    expect(destinations).toEqual([
      'history',
      'workshop',
      'agenda',
      'inventoryStones',
      'inventoryMaterials',
      'inventoryJewels',
      'inventoryReceivables',
      'dailyClose',
      'monthlyClose',
      'expenses',
      'clients',
      'buyers',
      'suppliers',
      'partners',
      'settings',
      'account'
    ]);
    expect(destinations).not.toContain('dashboard');
    expect(destinations).not.toContain('catalog');
  });
});
