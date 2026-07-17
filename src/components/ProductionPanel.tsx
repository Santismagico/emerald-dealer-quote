// Panel de seguimiento de producción del taller (SOLO vista interna).
// Etapas con estado (pendiente / en proceso / lista), control de pagos
// (cuánto, cuándo, a quién y quién pagó) y resumen de gasto real.

import { useState } from 'react';
import type { ProductionStage, StageStatus } from '../types';
import { runAfterSuccessfulFlush, type QuoteSaveMode } from '../services/quoteAutosave';
import { emptyStage, productionSummary, defaultProductionStages } from '../services/production';
import { formatCOP } from '../utils/money';
import { formatDateCO, todayISO } from '../utils/dates';
import { patchById } from '../utils/collections';
import { Button, Field, TextInput, MoneyInput, Toggle, ConfirmDialog, SummaryRow } from './ui';

const STATUS_LABEL: Record<StageStatus, string> = {
  pendiente: 'Pendiente',
  enProceso: 'En proceso',
  lista: 'Lista ✓'
};

const STATUS_STYLE: Record<StageStatus, string> = {
  pendiente: 'bg-stone-200 text-stone-700',
  enProceso: 'bg-amber-100 text-amber-800',
  lista: 'bg-emerald-100 text-emerald-800'
};

const NEXT_STATUS: Record<StageStatus, StageStatus> = {
  pendiente: 'enProceso',
  enProceso: 'lista',
  lista: 'pendiente'
};

export function ProductionPanel({
  stages,
  quoteTotal,
  onChange,
  onCommit
}: {
  stages: ProductionStage[];
  quoteTotal: number;
  onChange: (updater: (current: ProductionStage[]) => ProductionStage[], mode: QuoteSaveMode) => void;
  onCommit: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<ProductionStage | null>(null);

  const summary = productionSummary(stages);
  const estimatedProfit = quoteTotal - summary.totalCost;
  const commitInBackground = () => void onCommit().catch(() => {});

  const patchStage = (id: string, partial: Partial<ProductionStage>) =>
    onChange((current) => patchById(current, id, partial), 'deferred');

  const cycleStatus = (stage: ProductionStage) => {
    onChange(
      (current) =>
        current.map((item) => {
          if (item.id !== stage.id) return item;
          const status = NEXT_STATUS[item.status];
          return {
            ...item,
            status,
            completedAt: status === 'lista' ? item.completedAt || todayISO() : ''
          };
        }),
      'immediate'
    );
  };

  const toggleExpanded = async (id: string) => {
    const action = () => setExpanded(expanded === id ? null : id);
    if (expanded === null) {
      action();
      return;
    }
    await runAfterSuccessfulFlush(onCommit, action);
  };

  return (
    <div className="mt-4 border-t border-amber-200 pt-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
          Producción del taller
        </p>
        <span className="text-xs text-stone-500">
          {summary.stagesDone}/{summary.stagesTotal} listas
        </span>
      </div>

      {stages.length === 0 && (
        <div className="mb-2">
          <Button
            variant="secondary"
            full
            onClick={() =>
              onChange((current) => (current.length === 0 ? defaultProductionStages() : current), 'immediate')
            }
          >
            ＋ Crear etapas estándar del taller
          </Button>
        </div>
      )}

      <ul className="space-y-2">
        {stages.map((stage) => (
          <li key={stage.id} className="rounded-xl bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="min-h-11 min-w-0 flex-1 text-left"
                onClick={() => void toggleExpanded(stage.id)}
              >
                <p className="truncate text-sm font-medium text-stone-800">{stage.name}</p>
                <p className="text-xs text-stone-500">
                  {stage.cost > 0
                    ? `${formatCOP(stage.cost)} · ${stage.paid ? `pagado${stage.paidTo ? ` a ${stage.paidTo}` : ''}` : 'por pagar'}`
                    : 'Toca para registrar pago y detalles'}
                </p>
              </button>
              <button
                type="button"
                onClick={() => cycleStatus(stage)}
                className={`min-h-11 shrink-0 rounded-full px-3.5 py-2 text-xs font-medium ${STATUS_STYLE[stage.status]}`}
              >
                {STATUS_LABEL[stage.status]}
                {stage.status === 'lista' && stage.completedAt ? (
                  <span className="block text-[10px] font-normal">{formatDateCO(stage.completedAt)}</span>
                ) : null}
              </button>
            </div>

            {expanded === stage.id && (
              <div className="mt-3 space-y-3 border-t border-stone-100 pt-3">
                <Field label="Nombre de la etapa">
                  <TextInput
                    value={stage.name}
                    onChange={(name) => patchStage(stage.id, { name })}
                    onBlur={commitInBackground}
                  />
                </Field>
                <Field label="Costo de la etapa">
                  <MoneyInput
                    value={stage.cost}
                    onValue={(cost) => patchStage(stage.id, { cost })}
                    onBlur={commitInBackground}
                  />
                </Field>
                <Toggle
                  checked={stage.paid}
                  onChange={() =>
                    onChange(
                      (current) =>
                        current.map((item) => {
                          if (item.id !== stage.id) return item;
                          const paid = !item.paid;
                          return { ...item, paid, paidAt: paid ? item.paidAt || todayISO() : '' };
                        }),
                      'immediate'
                    )
                  }
                  label="¿Ya se pagó?"
                />
                {stage.paid && (
                  <>
                    <Field label="Fecha del pago">
                      <TextInput
                        type="date"
                        value={stage.paidAt}
                        onChange={(paidAt) =>
                          onChange((current) => patchById(current, stage.id, { paidAt }), 'immediate')
                        }
                      />
                    </Field>
                    <Field label="A quién se le pagó">
                      <TextInput
                        value={stage.paidTo}
                        onChange={(paidTo) => patchStage(stage.id, { paidTo })}
                        onBlur={commitInBackground}
                        placeholder="Taller o proveedor"
                      />
                    </Field>
                    <Field label="Quién hizo el pago">
                      <TextInput
                        value={stage.paidBy}
                        onChange={(paidBy) => patchStage(stage.id, { paidBy })}
                        onBlur={commitInBackground}
                        placeholder="Nombre"
                      />
                    </Field>
                  </>
                )}
                <Field label="Nota">
                  <TextInput
                    value={stage.notes}
                    onChange={(notes) => patchStage(stage.id, { notes })}
                    onBlur={commitInBackground}
                  />
                </Field>
                <Button variant="danger" full onClick={() => setToRemove(stage)}>
                  Quitar etapa
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-2">
        <Button
          variant="secondary"
          full
          onClick={() => {
            const stage = emptyStage('Nueva etapa');
            onChange((current) => [...current, stage], 'immediate');
            setExpanded(stage.id);
          }}
        >
          ＋ Agregar etapa
        </Button>
      </div>

      <div className="mt-3 space-y-1 rounded-xl bg-white p-3 shadow-sm">
        <SummaryRow label="Gasto registrado del taller" value={formatCOP(summary.totalCost)} />
        <SummaryRow label="Ya pagado" value={formatCOP(summary.paidCost)} />
        <SummaryRow label="Por pagar" value={formatCOP(summary.pendingCost)} />
        <div className="border-t border-stone-100 pt-1">
          <SummaryRow
            label="Utilidad estimada (cotizado − gastos registrados)"
            value={formatCOP(estimatedProfit)}
            bold
            valueClass={estimatedProfit < 0 ? 'text-red-600' : undefined}
          />
        </div>
        <p className="text-[11px] text-stone-400">
          Calculada solo con los pagos registrados aquí; no incluye costos que no hayas anotado.
        </p>
      </div>

      <ConfirmDialog
        open={toRemove !== null}
        title="Quitar etapa"
        message={`¿Quitar la etapa "${toRemove?.name}"${toRemove && toRemove.cost > 0 ? ' y su pago registrado' : ''}? Esta acción no se puede deshacer.`}
        confirmLabel="Quitar"
        danger
        onCancel={() => setToRemove(null)}
        onConfirm={() => {
          if (toRemove) onChange((current) => current.filter((stage) => stage.id !== toRemove.id), 'immediate');
          setToRemove(null);
        }}
      />
    </div>
  );
}
