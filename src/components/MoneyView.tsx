// DINERO (D-070): panel, cierres, consolidado y gastos viven dentro de una
// sola área. Copia el patrón de secciones que ya usa Inventario.

import { useState } from 'react';
import { MONEY_SECTIONS, type MoneySection } from '../services/home';
import { DailyCloseView } from './DailyCloseView';
import { ExpensesView } from './ExpensesView';
import { SalesDashboardView } from './SalesDashboardView';
import { SalesConsolidatedView } from './SalesConsolidatedView';

export function MoneyView({ initialSection = 'panel' }: { initialSection?: MoneySection }) {
  const [section, setSection] = useState<MoneySection>(initialSection);

  return (
    <div className="space-y-4">
      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-5"
        role="tablist"
        aria-label="Secciones de Dinero"
      >
        {MONEY_SECTIONS.map((tab, index) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={section === tab.key}
            onClick={() => setSection(tab.key)}
            className={`min-h-11 rounded-xl border px-2 py-2 text-sm font-semibold ${
              index === MONEY_SECTIONS.length - 1 ? 'col-span-2 sm:col-span-1' : ''
            } ${
              section === tab.key
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-stone-200 bg-white text-stone-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {section === 'panel' ? <SalesDashboardView /> : null}
      {section === 'dailyClose' ? (
        <DailyCloseView initialMode="dia" showModeSelector={false} />
      ) : null}
      {section === 'monthlyClose' ? (
        <DailyCloseView initialMode="mes" showModeSelector={false} />
      ) : null}
      {section === 'consolidated' ? <SalesConsolidatedView /> : null}
      {section === 'expenses' ? <ExpensesView /> : null}
    </div>
  );
}
