import type { Appointment, Expense, Quote, StockJewel, StoneLot } from '../types';
import { todaysPendingAppointments } from './agenda';
import { buildMonthlyReport } from './dailyReport';
import { listBuyerDebts } from './receivables';
import { countWorkshopJobs, workshopJobsFromQuotes } from './workshop';

export type HomeDestination =
  | 'history'
  | 'workshop'
  | 'agenda'
  | 'inventoryStones'
  | 'inventoryMaterials'
  | 'inventoryJewels'
  | 'inventoryReceivables'
  | 'dailyClose'
  | 'monthlyClose'
  | 'salesDashboard'
  | 'salesConsolidated'
  | 'expenses'
  | 'clients'
  | 'buyers'
  | 'suppliers'
  | 'partners'
  | 'settings'
  | 'account';

export interface HomeDestinationItem {
  destination: HomeDestination;
  label: string;
  attention?: 'appointments' | 'receivables' | 'workshop';
  requiresCloudAccount?: boolean;
}

export interface HomeGroup {
  title: string;
  items: readonly HomeDestinationItem[];
}

/** Portada elegida en D-052. Solo enumera áreas que ya existen. */
export const HOME_GROUPS: readonly HomeGroup[] = [
  {
    title: 'Vender',
    items: [{ destination: 'history', label: 'Cotizador' }]
  },
  {
    title: 'Producir y atender',
    items: [
      { destination: 'workshop', label: 'Taller', attention: 'workshop' },
      { destination: 'agenda', label: 'Agenda', attention: 'appointments' }
    ]
  },
  {
    title: 'Inventario',
    items: [
      { destination: 'inventoryStones', label: 'Piedras' },
      { destination: 'inventoryMaterials', label: 'Material' },
      { destination: 'inventoryJewels', label: 'Joyas' },
      { destination: 'inventoryReceivables', label: 'Cobros', attention: 'receivables' }
    ]
  },
  {
    title: 'La plata',
    items: [
      { destination: 'dailyClose', label: 'Cierre del día' },
      { destination: 'monthlyClose', label: 'Cierre mensual' },
      { destination: 'salesDashboard', label: 'Ventas y ganancias' },
      { destination: 'salesConsolidated', label: 'Consolidado de ventas' },
      { destination: 'expenses', label: 'Gastos' }
    ]
  },
  {
    title: 'Tu gente',
    items: [
      { destination: 'clients', label: 'Clientes' },
      { destination: 'buyers', label: 'Compradores' },
      { destination: 'suppliers', label: 'Proveedores' },
      { destination: 'partners', label: 'Socios' }
    ]
  },
  {
    title: 'Cuenta',
    items: [
      { destination: 'settings', label: 'Ajustes' },
      { destination: 'account', label: 'Cuenta', requiresCloudAccount: true }
    ]
  }
];

export interface HomeSummary {
  monthlyNet: number;
  appointmentsToday: number;
  overdueReceivables: number;
  workshopInProgress: number;
}

export function buildHomeSummary(input: {
  month: string;
  today: string;
  quotes: readonly Quote[];
  appointments: readonly Appointment[];
  stoneLots: readonly StoneLot[];
  stockJewels?: readonly StockJewel[];
  expenses?: readonly Expense[];
}): HomeSummary {
  const monthly = buildMonthlyReport(
    input.month,
    input.quotes,
    input.stoneLots,
    input.stockJewels ?? [],
    input.expenses ?? []
  );
  const workshopCounts = countWorkshopJobs(workshopJobsFromQuotes(input.quotes), '');
  const overdueReceivables = listBuyerDebts(input.stoneLots, input.today).filter(
    (debt) => debt.status === 'vencido'
  ).length;

  return {
    monthlyNet: monthly.totals.net,
    appointmentsToday: todaysPendingAppointments(input.appointments, input.today).length,
    overdueReceivables,
    workshopInProgress: workshopCounts.enTaller
  };
}
