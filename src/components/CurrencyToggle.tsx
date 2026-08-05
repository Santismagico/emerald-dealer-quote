import type { CurrencyView } from '../services/currency';

export function CurrencyToggle({
  value,
  onChange
}: {
  value: CurrencyView;
  onChange: (value: CurrencyView) => void;
}) {
  return (
    <div
      className="grid grid-cols-2 rounded-xl bg-stone-100 p-1"
      role="group"
      aria-label="Moneda para ver los valores"
    >
      {(['COP', 'USD'] as const).map((currency) => (
        <button
          key={currency}
          type="button"
          className={`min-h-11 rounded-lg px-4 text-sm font-semibold ${
            value === currency
              ? 'bg-white text-brand-900 shadow-sm'
              : 'text-stone-600 active:bg-stone-200'
          }`}
          aria-pressed={value === currency}
          onClick={() => onChange(currency)}
        >
          Ver en {currency}
        </button>
      ))}
    </div>
  );
}
