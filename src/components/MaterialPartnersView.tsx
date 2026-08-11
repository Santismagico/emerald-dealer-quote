// Socios del negocio (D-049/D-053): una sola lista para material, gastos y piedras.

import { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { MaterialPartner } from '../types';
import { materialsByPartner } from '../services/materials';
import { expensesByPartner } from '../services/expenses';
import { stonesByPartner } from '../services/stones';
import { fundByPerson } from '../services/fund';
import { newId } from '../utils/id';
import { formatDateCO, todayISO } from '../utils/dates';
import { formatCOP } from '../utils/money';
import {
  Button,
  Field,
  TextInput,
  TextArea,
  SectionCard,
  ConfirmDialog,
  EmptyState,
  SummaryRow
} from './ui';

function emptyPartner(): MaterialPartner {
  return {
    id: newId(),
    name: '',
    phone: '',
    city: '',
    notes: '',
    createdAt: new Date().toISOString()
  };
}

function formatGrams(grams: number): string {
  return `${grams.toLocaleString('es-CO', { maximumFractionDigits: 3 })} g`;
}

export function MaterialPartnersView() {
  const store = useStore();
  const [editing, setEditing] = useState<MaterialPartner | null>(null);
  const [toDelete, setToDelete] = useState<MaterialPartner | null>(null);
  const [error, setError] = useState('');

  // Todos los resúmenes se derivan del historial; nunca son contadores guardados.
  const materialShares = useMemo(() => materialsByPartner(store.materialLots), [store.materialLots]);
  const stoneShares = useMemo(() => stonesByPartner(store.stoneLots), [store.stoneLots]);
  const expenseShares = useMemo(() => expensesByPartner(store.expenses), [store.expenses]);
  const fundShares = useMemo(
    () => fundByPerson(store.fundContributions, todayISO()),
    [store.fundContributions]
  );

  if (editing) {
    return (
      <div className="space-y-4">
        <SectionCard
          title={
            store.materialPartners.some((p) => p.id === editing.id)
              ? 'Editar socio'
              : 'Nuevo socio'
          }
          subtitle="Con quién compartes material, gastos o lotes de piedras. Es una lista aparte de proveedores y compradores."
        >
          <Field label="Nombre *">
            <TextInput
              value={editing.name}
              onChange={(name) => setEditing({ ...editing, name })}
              placeholder="Nombre del socio o joyero"
            />
          </Field>
          <Field label="Teléfono">
            <TextInput
              value={editing.phone}
              onChange={(phone) => setEditing({ ...editing, phone })}
              inputMode="tel"
              placeholder="300 000 0000"
            />
          </Field>
          <Field label="Ciudad">
            <TextInput value={editing.city} onChange={(city) => setEditing({ ...editing, city })} />
          </Field>
          <Field label="Notas">
            <TextArea value={editing.notes} onChange={(notes) => setEditing({ ...editing, notes })} />
          </Field>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex gap-3 pt-1">
            <div className="flex-1">
              <Button
                variant="ghost"
                full
                onClick={() => {
                  setEditing(null);
                  setError('');
                }}
              >
                Cancelar
              </Button>
            </div>
            <div className="flex-1">
              <Button
                full
                onClick={async () => {
                  if (!editing.name.trim()) {
                    setError('El nombre del socio es obligatorio.');
                    return;
                  }
                  await store.upsertMaterialPartner({ ...editing, name: editing.name.trim() });
                  store.showToast('Socio guardado');
                  setEditing(null);
                  setError('');
                }}
              >
                Guardar
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button full onClick={() => setEditing(emptyPartner())}>
        ＋ Nuevo socio
      </Button>

      {store.materialPartners.length === 0 ? (
        <EmptyState
          title="Sin socios"
          message="Registra con quién compartes material, gastos o lotes de piedras para ver cada sociedad por separado."
        />
      ) : (
        <ul className="space-y-3">
          {store.materialPartners.map((partner) => {
            const materialShare = materialShares.find((share) => share.partnerId === partner.id);
            const stoneShare = stoneShares.find((share) => share.partnerId === partner.id);
            const expenseShare = expenseShares.find((share) => share.partnerId === partner.id);
            const fundShare = fundShares.find((share) => share.personId === partner.id);
            return (
              <li key={partner.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="font-semibold text-stone-900">{partner.name}</p>
                <p className="text-sm text-stone-500">
                  {[partner.phone, partner.city].filter(Boolean).join(' · ') ||
                    'Sin datos de contacto'}
                </p>
                {materialShare ? (
                  <p className="mt-1 text-sm text-stone-700">
                    Material: {formatGrams(materialShare.partnerGrams)} suyos, dentro de{' '}
                    {formatGrams(materialShare.sharedGrams)} compartidos
                  </p>
                ) : null}
                {expenseShare ? (
                  <p className="mt-1 text-sm text-stone-700">
                    Gastos: {formatCOP(expenseShare.partnerAmountCop)} suyos, dentro de{' '}
                    {formatCOP(expenseShare.totalAmountCop)} compartidos
                  </p>
                ) : null}

                {/* Como SOCIO DE IGUALDAD: gana y pierde con el lote (§6 del plan).
                    Todas las cifras son suyas; ninguna repite la parte de Santiago. */}
                {stoneShare ? (
                  <div className="mt-3 rounded-xl bg-stone-50 p-3">
                    <p className="text-sm font-semibold text-stone-800">
                      Como socio · {stoneShare.lotCount} lote
                      {stoneShare.lotCount === 1 ? '' : 's'} de piedras
                    </p>
                    <SummaryRow label="Ha puesto" value={formatCOP(stoneShare.contributedCop)} />
                    <SummaryRow
                      label="Ganancia ya realizada"
                      value={formatCOP(stoneShare.realizedResultCop)}
                      valueClass={stoneShare.realizedResultCop < 0 ? 'text-red-600' : 'text-brand-800'}
                    />
                    <SummaryRow
                      label="Puesto en lotes con existencias"
                      value={formatCOP(stoneShare.openContributionCop)}
                    />
                    <SummaryRow
                      label="Le falta cobrar a compradores"
                      value={formatCOP(stoneShare.pendingFromBuyersCop)}
                      valueClass={stoneShare.pendingFromBuyersCop > 0 ? 'text-red-600' : undefined}
                    />
                    <p className="mt-1 text-xs text-stone-500">
                      La ganancia se cuenta cuando el lote se vendió entero y ya se cobró
                      entero. Si quedan piedras o falta cobrar, la plata todavía no ha
                      entrado y llamarla ganancia sería adelantarse.
                    </p>
                  </div>
                ) : null}

                {/* Como INVERSIONISTA DEL FONDO: presta y se le devuelve, no gana
                    ni pierde con el lote. Son dos papeles distintos (§2 del plan). */}
                {fundShare ? (
                  <div className="mt-3 rounded-xl bg-amber-50 p-3">
                    <p className="text-sm font-semibold text-stone-800">
                      En el fondo · {fundShare.contributionCount} aporte
                      {fundShare.contributionCount === 1 ? '' : 's'}
                      {fundShare.openCount === 0 ? ' · todo saldado' : ''}
                    </p>
                    <SummaryRow label="Te prestó" value={formatCOP(fundShare.capitalCop)} />
                    <SummaryRow
                      label="Rendimiento hasta hoy"
                      value={formatCOP(fundShare.accruedReturnCop)}
                    />
                    <SummaryRow label="Le has devuelto" value={formatCOP(fundShare.capitalRepaidCop)} />
                    <SummaryRow
                      label="Rendimiento ya pagado"
                      value={formatCOP(fundShare.returnPaidCop)}
                    />
                    <SummaryRow
                      label="Le debes hoy"
                      value={formatCOP(fundShare.owedCop)}
                      bold
                      valueClass={fundShare.owedCop > 0 ? 'text-red-600' : 'text-brand-800'}
                    />
                    {fundShare.nextDueDate ? (
                      <p
                        className={`mt-1 text-xs ${
                          fundShare.overdue ? 'font-medium text-red-600' : 'text-stone-500'
                        }`}
                      >
                        {fundShare.overdue ? 'Vencido desde el ' : 'Próximo vencimiento: '}
                        {formatDateCO(fundShare.nextDueDate)}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-3 flex gap-2 border-t border-stone-100 pt-3">
                  <button
                    type="button"
                    className="min-h-11 flex-1 rounded-lg text-sm font-medium text-brand-800 active:bg-brand-50"
                    onClick={() => setEditing(partner)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="min-h-11 flex-1 rounded-lg text-sm font-medium text-red-600 active:bg-red-50"
                    onClick={() => setToDelete(partner)}
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Eliminar socio"
        message={`¿Eliminar a ${toDelete?.name} de la lista? Material, gastos y lotes de piedras conservan el nombre y su reparto histórico. Solo se quita el vínculo con esta ficha.`}
        confirmLabel="Eliminar"
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete) {
            await store.removeMaterialPartner(toDelete.id);
            store.showToast('Socio eliminado');
          }
          setToDelete(null);
        }}
      />
    </div>
  );
}
