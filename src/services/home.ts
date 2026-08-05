import type { Appointment, Quote, StoneLot } from '../types';
import { todaysPendingAppointments } from './agenda';
import { listBuyerDebts } from './receivables';
import { countWorkshopJobs, workshopJobsFromQuotes } from './workshop';

export type HomeDestination =
  | 'history'
  | 'workshop'
  | 'agenda'
  | 'inventory'
  | 'money'
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

export type MoneySection =
  | 'panel'
  | 'dailyClose'
  | 'monthlyClose'
  | 'consolidated'
  | 'expenses';

export const MONEY_SECTIONS: readonly { key: MoneySection; label: string }[] = [
  { key: 'panel', label: 'Panel' },
  { key: 'dailyClose', label: 'Cierre del día' },
  { key: 'monthlyClose', label: 'Cierre mensual' },
  { key: 'consolidated', label: 'Consolidado' },
  { key: 'expenses', label: 'Gastos' }
];

/** Portada elegida en D-052. Solo enumera áreas que ya existen. */
export const HOME_GROUPS: readonly HomeGroup[] = [
  {
    title: 'Tu día a día',
    items: [
      { destination: 'history', label: 'Cotizador' },
      { destination: 'workshop', label: 'Taller', attention: 'workshop' },
      { destination: 'inventory', label: 'Inventario' },
      { destination: 'money', label: 'Dinero' }
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
    title: 'Otras cosas',
    items: [
      { destination: 'agenda', label: 'Agenda', attention: 'appointments' },
      { destination: 'settings', label: 'Ajustes y cuenta' }
    ]
  }
];

export interface HomeSummary {
  appointmentsToday: number;
  overdueReceivables: number;
  workshopInProgress: number;
}

export function buildHomeSummary(input: {
  today: string;
  quotes: readonly Quote[];
  appointments: readonly Appointment[];
  stoneLots: readonly StoneLot[];
}): HomeSummary {
  const workshopCounts = countWorkshopJobs(workshopJobsFromQuotes(input.quotes), '');
  const overdueReceivables = listBuyerDebts(input.stoneLots, input.today).filter(
    (debt) => debt.status === 'vencido'
  ).length;

  return {
    appointmentsToday: todaysPendingAppointments(input.appointments, input.today).length,
    overdueReceivables,
    workshopInProgress: workshopCounts.enTaller
  };
}
