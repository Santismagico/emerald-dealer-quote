import type { HomeDestination, HomeSummary } from '../services/home';
import { HOME_GROUPS } from '../services/home';
import { formatCOP } from '../utils/money';

export function HomeView({
  monthLabel,
  summary,
  showAccount,
  onOpen
}: {
  monthLabel: string;
  summary: HomeSummary;
  showAccount: boolean;
  onOpen: (destination: HomeDestination) => void;
}) {
  const attention = {
    appointments: summary.appointmentsToday,
    receivables: summary.overdueReceivables,
    workshop: summary.workshopInProgress
  };

  return (
    <div className="space-y-5">
      <section className="luxury-card overflow-hidden rounded-3xl p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Resultado de {monthLabel}</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-stone-600">Movimiento neto</p>
            <p
              className={`mt-1 font-display text-3xl font-semibold sm:text-4xl ${
                summary.monthlyNet < 0 ? 'text-red-700' : 'text-brand-800'
              }`}
            >
              {formatCOP(summary.monthlyNet)}
            </p>
          </div>
          <p className="max-w-xs text-xs leading-relaxed text-stone-500">
            Es la misma cifra del Cierre mensual.
          </p>
        </div>
      </section>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {HOME_GROUPS.map((group) => {
          const items = group.items.filter((item) => showAccount || !item.requiresCloudAccount);
          if (items.length === 0) return null;
          return (
            <section key={group.title} className="luxury-card min-w-0 rounded-2xl p-3">
              <h2 className="px-2 pb-2 text-xs font-bold uppercase tracking-[0.16em] text-stone-500">
                {group.title}
              </h2>
              <div className="divide-y divide-stone-100">
                {items.map((item) => {
                  const badge = item.attention ? attention[item.attention] : 0;
                  return (
                    <button
                      key={item.destination}
                      type="button"
                      onClick={() => onOpen(item.destination)}
                      className="flex min-h-12 w-full min-w-0 items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-stone-50 active:bg-stone-100"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-stone-800">
                        {item.label}
                      </span>
                      {badge > 0 ? (
                        <span
                          className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold text-white"
                          aria-label={`${badge} pendientes`}
                        >
                          {badge > 99 ? '99+' : badge}
                        </span>
                      ) : null}
                      <span className="shrink-0 text-stone-400" aria-hidden>
                        ›
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
