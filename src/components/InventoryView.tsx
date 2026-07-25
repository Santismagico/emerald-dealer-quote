// INVENTARIO (D-046): la antigua pestaña "Piedras" crece en profundidad, no
// en botones de menú. Tres secciones adentro:
//
//   Piedras · Joyas · Cobros
//
// El menú de abajo se queda en cinco botones porque un sexto deja los nombres
// ilegibles en teléfonos de 320 px, un ancho que la app cuida desde D-030.
// "Cobros" queda a un solo toque porque es exactamente lo que pidió el
// comerciante que originó esta ampliación.

import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { receivablesTotals } from '../services/receivables';
import { todayISO } from '../utils/dates';
import { StonesView } from './StonesView';
import { MaterialsView } from './MaterialsView';
import { StockJewelsView } from './StockJewelsView';
import { ReceivablesView } from './ReceivablesView';

export type InventorySection = 'piedras' | 'materiales' | 'joyas' | 'cobros';

export function InventoryView() {
  const store = useStore();
  const [section, setSection] = useState<InventorySection>('piedras');

  // Aviso en la pestaña: cuántos cobros están vencidos hoy. Derivado, nunca guardado.
  const overdueCount = useMemo(() => {
    const today = todayISO();
    return receivablesTotals(store.stoneLots, today).overdueCop > 0 ? 1 : 0;
  }, [store.stoneLots]);

  const tabs: Array<{ key: InventorySection; label: string; alert?: boolean }> = [
    { key: 'piedras', label: 'Piedras' },
    { key: 'materiales', label: 'Material' },
    { key: 'joyas', label: 'Joyas' },
    { key: 'cobros', label: 'Cobros', alert: overdueCount > 0 }
  ];

  return (
    <div className="space-y-4">
      {/* Cuatro secciones: en teléfonos angostos se ajustan a dos filas para no
          cortar ninguna etiqueta (D-046). */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="tablist" aria-label="Secciones de inventario">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={section === tab.key}
            onClick={() => setSection(tab.key)}
            className={`relative min-h-11 rounded-xl border px-2 text-sm font-semibold ${
              section === tab.key
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-stone-200 bg-white text-stone-600'
            }`}
          >
            {tab.label}
            {tab.alert ? (
              <span
                aria-label="Hay cobros vencidos"
                className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500"
              />
            ) : null}
          </button>
        ))}
      </div>

      {section === 'piedras' ? <StonesView /> : null}
      {section === 'materiales' ? <MaterialsView /> : null}
      {section === 'joyas' ? <StockJewelsView /> : null}
      {section === 'cobros' ? <ReceivablesView /> : null}
    </div>
  );
}
