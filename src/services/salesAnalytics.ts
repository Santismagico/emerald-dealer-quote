import type { Expense, MaterialLot, Quote, StockJewel, StoneLot } from '../types';
import { copToUsd } from './currency';
import {
  buildLedger,
  ledgerCashTotals,
  ledgerSaleProfitCop,
  type LedgerEvent
} from './ledger';
import { lotDisplayName, summarizeStoneLot } from './stones';
import { splitByContribution } from './partnership';
import { workshopJobsFromQuotes } from './workshop';

export type SalesPeriodKind = 'dia' | 'semana' | 'mes' | 'anio';

export interface SalesPeriodRange {
  start: string;
  end: string;
}

export interface SalesAnalyticsInput {
  period: SalesPeriodKind;
  anchorDate: string;
  societyFilter?: string;
  productTypeFilter?: string;
  quotes?: readonly Quote[];
  stoneLots?: readonly StoneLot[];
  stockJewels?: readonly StockJewel[];
  materialLots?: readonly MaterialLot[];
  expenses?: readonly Expense[];
}

export interface KnownUsdTotals {
  amount: number;
  cost: number;
  profit: number;
  knownCount: number;
  missingCount: number;
}

export interface SalesAnalyticsSale {
  id: string;
  date: string;
  kind: LedgerEvent['kind'];
  amountCop: number;
  attributedCostCop: number;
  profitCop: number;
  amountUsd: number | null;
  costUsd: number | null;
  profitUsd: number | null;
  usdRate: number | null;
  lotId: string | null;
  partnerId: string | null;
  partnerName: string;
  myPercent: number;
  partners: LedgerEvent['partners'];
  equityBaseCop: number;
  myContributionCop: number;
  productType: string;
  counterparty: string;
}

export interface SalesAnalyticsLot {
  lotId: string;
  name: string;
  salesCop: number;
  costCop: number;
  profitCop: number;
  profitUsd: number;
  usdKnownCount: number;
  usdMissingCount: number;
  saleCount: number;
}

/**
 * Una PERSONA dentro de los lotes compartidos del periodo (D-073 + D-076).
 *
 * Antes esto era una fila por «sociedad» con la parte de Santiago y la del
 * socio juntas, y agrupaba por el socio único del modelo viejo: con dos socios
 * en un lote, todo se le atribuía a uno. Ahora hay una fila por persona
 * —Santiago incluido, con `isOwner`— y **todas sus cifras son suyas**, así que
 * leer varias seguidas nunca lleva a sumar dos veces lo mismo.
 */
export interface SalesAnalyticsPartnership {
  key: string;
  partnerId: string | null;
  partnerName: string;
  /** true en la fila de Santiago. */
  isOwner: boolean;
  /** Plata que puso en los lotes que vendieron en el periodo. */
  investedCop: number;
  /** Su parte de la ganancia de esas ventas. */
  profitCop: number;
  /** Su rendimiento: ganancia sobre lo que puso. null si no puso nada. */
  returnPercent: number | null;
  profitUsd: number;
  usdKnownCount: number;
  usdMissingCount: number;
}

export interface SalesAnalyticsFilterOption {
  value: string;
  label: string;
}

export interface SalesAnalyticsFilters {
  societies: SalesAnalyticsFilterOption[];
  productTypes: SalesAnalyticsFilterOption[];
  societyValue: string;
  societyLabel: string;
  productTypeValue: string;
  productTypeLabel: string;
}

export interface SalesAnalyticsComparison {
  mostMoney: SalesAnalyticsPartnership | null;
  mostProfitable: SalesAnalyticsPartnership | null;
}

export interface SalesAnalytics {
  range: SalesPeriodRange;
  sales: SalesAnalyticsSale[];
  salesCop: number;
  attributedCostCop: number;
  profitCop: number;
  salesUsd: KnownUsdTotals;
  cashCop: ReturnType<typeof ledgerCashTotals>;
  cashUsd: {
    cashIn: number;
    cashOut: number;
    net: number;
    knownCount: number;
    missingCount: number;
  };
  pendingClientsCop: number;
  pendingStoneBuyersCop: number;
  byLot: SalesAnalyticsLot[];
  partnerships: SalesAnalyticsPartnership[];
  filters: SalesAnalyticsFilters;
  comparison: SalesAnalyticsComparison;
}

export const ALL_SALES_FILTER = 'todos';
export const UNREGISTERED_SALES_FILTER = 'sin-registrar';

function parseDate(date: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return new Date(Date.UTC(1970, 0, 1));
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function salesPeriodRange(period: SalesPeriodKind, anchorDate: string): SalesPeriodRange {
  const anchor = parseDate(anchorDate);
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth();

  if (period === 'dia') return { start: isoDate(anchor), end: isoDate(anchor) };
  if (period === 'semana') {
    const day = anchor.getUTCDay() || 7;
    const start = new Date(anchor);
    start.setUTCDate(anchor.getUTCDate() - day + 1);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    return { start: isoDate(start), end: isoDate(end) };
  }
  if (period === 'mes') {
    return {
      start: isoDate(new Date(Date.UTC(year, month, 1))),
      end: isoDate(new Date(Date.UTC(year, month + 1, 0)))
    };
  }
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`
  };
}

function eventsInRange(events: readonly LedgerEvent[], range: SalesPeriodRange): LedgerEvent[] {
  return events.filter((entry) => entry.date >= range.start && entry.date <= range.end);
}

function partnershipKey(event: Pick<LedgerEvent, 'partnerId' | 'partnerName'>): string | null {
  if (event.partnerId) return `id:${event.partnerId}`;
  const name = event.partnerName.trim();
  return name ? `name:${name.toLocaleLowerCase('es')}` : null;
}

function societyFilterKey(event: Pick<LedgerEvent, 'partnerId' | 'partnerName'>): string {
  return partnershipKey(event) ?? UNREGISTERED_SALES_FILTER;
}

/**
 * Personas por las que puede encontrarse una venta en el Consolidado.
 *
 * Los registros nuevos llevan una lista de socios. El trío antiguo se conserva
 * únicamente para encontrar datos anteriores a D-073.
 */
function societyFilterEntries(event: LedgerEvent): SalesAnalyticsFilterOption[] {
  if (event.partners.length > 0) {
    const entries = new Map<string, string>();
    for (const partner of event.partners) {
      const value = partnershipKey(partner) ?? UNREGISTERED_SALES_FILTER;
      if (!entries.has(value)) {
        entries.set(value, partner.partnerName.trim() || 'Sin registrar');
      }
    }
    return [...entries.entries()].map(([value, label]) => ({ value, label }));
  }
  return [
    {
      value: societyFilterKey(event),
      label: event.partnerName.trim() || 'Sin registrar'
    }
  ];
}

function buildSocietyFilterOptions(
  revenueEvents: readonly LedgerEvent[]
): SalesAnalyticsFilterOption[] {
  const labels = new Map<string, string>();
  for (const event of revenueEvents) {
    for (const option of societyFilterEntries(event)) {
      if (!labels.has(option.value)) labels.set(option.value, option.label);
    }
  }
  return [
    { value: ALL_SALES_FILTER, label: 'Todos' },
    ...[...labels.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'))
  ];
}

function matchesSocietyFilter(event: LedgerEvent, societyFilter: string): boolean {
  return (
    societyFilter === ALL_SALES_FILTER ||
    societyFilterEntries(event).some((option) => option.value === societyFilter)
  );
}

function productTypeFilterKey(event: Pick<LedgerEvent, 'productType'>): string {
  const productType = event.productType.trim();
  return productType
    ? `tipo:${productType.toLocaleLowerCase('es')}`
    : UNREGISTERED_SALES_FILTER;
}

function buildFilterOptions(
  revenueEvents: readonly LedgerEvent[],
  keyFor: (event: LedgerEvent) => string,
  labelFor: (event: LedgerEvent) => string
): SalesAnalyticsFilterOption[] {
  const labels = new Map<string, string>();
  for (const event of revenueEvents) {
    const key = keyFor(event);
    if (!labels.has(key)) labels.set(key, labelFor(event));
  }
  return [
    { value: ALL_SALES_FILTER, label: 'Todos' },
    ...[...labels.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'))
  ];
}

function selectedFilterLabel(options: readonly SalesAnalyticsFilterOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? 'Todos';
}

function pendingClientBalance(quotes: readonly Quote[]): number {
  return workshopJobsFromQuotes(quotes).reduce((total, job) => total + job.balance, 0);
}

function pendingStoneBalance(lots: readonly StoneLot[]): number {
  return lots.reduce((total, lot) => total + summarizeStoneLot(lot).buyersDebt, 0);
}

export function buildSalesAnalytics({
  period,
  anchorDate,
  societyFilter = ALL_SALES_FILTER,
  productTypeFilter = ALL_SALES_FILTER,
  quotes = [],
  stoneLots = [],
  stockJewels = [],
  materialLots = [],
  expenses = []
}: SalesAnalyticsInput): SalesAnalytics {
  const range = salesPeriodRange(period, anchorDate);
  const allEvents = buildLedger({ quotes, stoneLots, stockJewels, materialLots, expenses });
  const periodEvents = eventsInRange(allEvents, range);
  const periodRevenueEvents = periodEvents.filter((entry) => ledgerSaleProfitCop(entry) !== null);
  const societyOptions = buildSocietyFilterOptions(periodRevenueEvents);
  const productTypeOptions = buildFilterOptions(
    periodRevenueEvents,
    productTypeFilterKey,
    (entry) => entry.productType.trim() || 'Sin registrar'
  );
  const revenueEvents = periodRevenueEvents.filter(
    (entry) =>
      matchesSocietyFilter(entry, societyFilter) &&
      (productTypeFilter === ALL_SALES_FILTER ||
        productTypeFilterKey(entry) === productTypeFilter)
  );
  const sales: SalesAnalyticsSale[] = revenueEvents.map((entry) => {
    const profitCop = ledgerSaleProfitCop(entry) ?? 0;
    const amountUsd = copToUsd(entry.amountCop, entry.usdRate);
    const costUsd = copToUsd(entry.attributedCostCop, entry.usdRate);
    return {
      id: entry.id,
      date: entry.date,
      kind: entry.kind,
      amountCop: entry.amountCop,
      attributedCostCop: entry.attributedCostCop,
      profitCop,
      amountUsd,
      costUsd,
      profitUsd: amountUsd === null || costUsd === null ? null : amountUsd - costUsd,
      usdRate: entry.usdRate,
      lotId: entry.lotId,
      partnerId: entry.partnerId,
      partnerName: entry.partnerName,
      myPercent: entry.myPercent,
      partners: entry.partners,
      equityBaseCop: entry.equityBaseCop,
      myContributionCop: entry.myContributionCop,
      productType: entry.productType,
      counterparty: entry.counterparty
    };
  });

  let salesCop = 0;
  let attributedCostCop = 0;
  const salesUsd: KnownUsdTotals = {
    amount: 0,
    cost: 0,
    profit: 0,
    knownCount: 0,
    missingCount: 0
  };
  for (const sale of sales) {
    salesCop += sale.amountCop;
    attributedCostCop += sale.attributedCostCop;
    if (sale.amountUsd === null || sale.costUsd === null || sale.profitUsd === null) {
      salesUsd.missingCount += 1;
    } else {
      salesUsd.amount += sale.amountUsd;
      salesUsd.cost += sale.costUsd;
      salesUsd.profit += sale.profitUsd;
      salesUsd.knownCount += 1;
    }
  }

  const cashCop = ledgerCashTotals(periodEvents);
  const cashUsd = { cashIn: 0, cashOut: 0, net: 0, knownCount: 0, missingCount: 0 };
  for (const entry of periodEvents) {
    if (entry.direction === 'ninguna') continue;
    const amountUsd = copToUsd(entry.amountCop, entry.usdRate);
    if (amountUsd === null) {
      cashUsd.missingCount += 1;
      continue;
    }
    if (entry.direction === 'entra') cashUsd.cashIn += amountUsd;
    if (entry.direction === 'sale') cashUsd.cashOut += amountUsd;
    cashUsd.knownCount += 1;
  }
  cashUsd.net = cashUsd.cashIn - cashUsd.cashOut;

  const lotById = new Map(stoneLots.map((lot) => [lot.id, lot]));
  const byLotMap = new Map<string, SalesAnalyticsLot>();
  for (const sale of sales) {
    if (!sale.lotId) continue;
    const lot = lotById.get(sale.lotId);
    const current = byLotMap.get(sale.lotId) ?? {
      lotId: sale.lotId,
      name: lot ? lotDisplayName(lot) : 'Sin registrar',
      salesCop: 0,
      costCop: 0,
      profitCop: 0,
      profitUsd: 0,
      usdKnownCount: 0,
      usdMissingCount: 0,
      saleCount: 0
    };
    current.salesCop += sale.amountCop;
    current.costCop += sale.attributedCostCop;
    current.profitCop += sale.profitCop;
    current.saleCount += 1;
    if (sale.profitUsd === null) current.usdMissingCount += 1;
    else {
      current.profitUsd += sale.profitUsd;
      current.usdKnownCount += 1;
    }
    byLotMap.set(sale.lotId, current);
  }

  // Una fila por PERSONA, Santiago incluido. Cada quien recibe su parte en
  // proporción a lo que puso, sobre la base de patrimonio que excluye el fondo.
  const partnershipsMap = new Map<string, SalesAnalyticsPartnership>();
  const OWNER_KEY = 'owner';

  const personRow = (
    key: string,
    partnerId: string | null,
    partnerName: string,
    isOwner: boolean
  ): SalesAnalyticsPartnership => {
    const existing = partnershipsMap.get(key);
    if (existing) return existing;
    const created: SalesAnalyticsPartnership = {
      key,
      partnerId,
      partnerName,
      isOwner,
      investedCop: 0,
      profitCop: 0,
      returnPercent: null,
      profitUsd: 0,
      usdKnownCount: 0,
      usdMissingCount: 0
    };
    partnershipsMap.set(key, created);
    return created;
  };

  for (const sale of sales) {
    const base = sale.equityBaseCop;
    // Sin socios no hay nada que separar: el lote es entero de Santiago y ya
    // está contado en los totales generales del periodo.
    if (sale.partners.length === 0 || base <= 0) continue;

    // Reutiliza la única convención de redondeo del proyecto: los socios se
    // truncan y el peso residual queda del lado de Santiago (D-073).
    const split = splitByContribution({
      totalCostCop: base,
      realResultCop: sale.profitCop,
      partners: sale.partners
    });
    const partnerProfitUsd =
      sale.profitUsd === null
        ? []
        : split.partners.map((partner) => (sale.profitUsd! * partner.amountCop) / base);
    const ownerProfitUsd =
      sale.profitUsd === null
        ? null
        : sale.profitUsd - partnerProfitUsd.reduce((total, amount) => total + amount, 0);

    const owner = personRow(OWNER_KEY, null, 'Tú', true);
    owner.profitCop += split.myResultCop;
    if (ownerProfitUsd === null) owner.usdMissingCount += 1;
    else {
      owner.profitUsd += ownerProfitUsd;
      owner.usdKnownCount += 1;
    }

    split.partners.forEach((partner, index) => {
      if (partner.amountCop <= 0) return;
      const key =
        partnershipKey(partner) ??
        `name:${partner.partnerName.trim().toLocaleLowerCase('es')}`;
      const row = personRow(
        key,
        partner.partnerId,
        partner.partnerName.trim() || 'Sin registrar',
        false
      );
      row.profitCop += partner.resultCop;
      if (sale.profitUsd === null) row.usdMissingCount += 1;
      else {
        row.profitUsd += partnerProfitUsd[index] ?? 0;
        row.usdKnownCount += 1;
      }
    });
  }

  // Lo puesto se cuenta una sola vez por lote, aunque el lote tenga varias ventas.
  const investedLots = new Set<string>();
  for (const sale of sales) {
    if (!sale.lotId || investedLots.has(sale.lotId)) continue;
    const lot = lotById.get(sale.lotId);
    if (!lot || sale.partners.length === 0 || sale.equityBaseCop <= 0) continue;
    const investmentSplit = splitByContribution({
      totalCostCop: sale.equityBaseCop,
      realResultCop: summarizeStoneLot(lot).totalInvested,
      partners: sale.partners
    });
    const owner = partnershipsMap.get(OWNER_KEY);
    if (owner) owner.investedCop += investmentSplit.myResultCop;
    for (const partner of investmentSplit.partners) {
      const key =
        partnershipKey(partner) ??
        `name:${partner.partnerName.trim().toLocaleLowerCase('es')}`;
      const row = partnershipsMap.get(key);
      if (row) row.investedCop += partner.resultCop;
    }
    investedLots.add(sale.lotId);
  }

  const partnerships = [...partnershipsMap.values()].map((item) => ({
    ...item,
    returnPercent: item.investedCop > 0 ? (item.profitCop / item.investedCop) * 100 : null
  }));
  // Santiago primero; los demás por lo que ganaron.
  const sortedPartnerships = partnerships.sort((a, b) =>
    a.isOwner === b.isOwner ? b.profitCop - a.profitCop : a.isOwner ? -1 : 1
  );
  // La comparación mira SOLO a los socios: incluir a Santiago no dice nada,
  // porque él está en todos los lotes y siempre ganaría las dos tarjetas.
  const comparables = sortedPartnerships.filter((item) => !item.isOwner);
  const mostMoney = [...comparables].sort((a, b) => b.profitCop - a.profitCop)[0] ?? null;
  const mostProfitable =
    [...comparables]
      .filter((item) => item.returnPercent !== null)
      .sort((a, b) => (b.returnPercent ?? 0) - (a.returnPercent ?? 0))[0] ?? null;

  return {
    range,
    sales,
    salesCop,
    attributedCostCop,
    profitCop: salesCop - attributedCostCop,
    salesUsd,
    cashCop,
    cashUsd,
    pendingClientsCop: pendingClientBalance(quotes),
    pendingStoneBuyersCop: pendingStoneBalance(stoneLots),
    byLot: [...byLotMap.values()].sort((a, b) => b.profitCop - a.profitCop),
    partnerships: sortedPartnerships,
    filters: {
      societies: societyOptions,
      productTypes: productTypeOptions,
      societyValue: societyFilter,
      societyLabel: selectedFilterLabel(societyOptions, societyFilter),
      productTypeValue: productTypeFilter,
      productTypeLabel: selectedFilterLabel(productTypeOptions, productTypeFilter)
    },
    comparison: { mostMoney, mostProfitable }
  };
}
