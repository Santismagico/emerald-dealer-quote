// Socios de material (D-049): con quién comparte el oro (u otro material).
// Lista aparte de clientes, proveedores y compradores: son co-dueños del
// material, no alguien a quien se le compra ni a quien se le vende.

import { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { MaterialPartner } from '../types';
import { materialsByPartner } from '../services/materials';
import { newId } from '../utils/id';
import { Button, Field, TextInput, TextArea, SectionCard, ConfirmDialog, EmptyState } from './ui';

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

  // Cuánto material comparto con cada socio: derivado, nunca guardado (D-023).
  const shares = useMemo(() => materialsByPartner(store.materialLots), [store.materialLots]);
  const shareOf = (partnerId: string) => shares.find((s) => s.partnerId === partnerId);

  if (editing) {
    return (
      <div className="space-y-4">
        <SectionCard
          title={
            store.materialPartners.some((p) => p.id === editing.id)
              ? 'Editar socio'
              : 'Nuevo socio de material'
          }
          subtitle="Con quién comparte oro u otro material. Es una lista aparte de sus proveedores y compradores."
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
        ＋ Nuevo socio de material
      </Button>

      {store.materialPartners.length === 0 ? (
        <EmptyState
          title="Sin socios"
          message="Registra con quién compartes oro u otro material para ver cuánto comparten en total."
        />
      ) : (
        <ul className="space-y-3">
          {store.materialPartners.map((partner) => {
            const share = shareOf(partner.id);
            return (
              <li key={partner.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="font-semibold text-stone-900">{partner.name}</p>
                <p className="text-sm text-stone-500">
                  {[partner.phone, partner.city].filter(Boolean).join(' · ') ||
                    'Sin datos de contacto'}
                </p>
                {share ? (
                  <p className="mt-1 text-sm text-stone-700">
                    Comparten {formatGrams(share.sharedGrams)} · suyos{' '}
                    {formatGrams(share.myGrams)} · del socio {formatGrams(share.partnerGrams)}
                  </p>
                ) : null}
                <div className="mt-3 flex gap-2 border-t border-stone-100 pt-3">
                  <button
                    type="button"
                    className="min-h-10 flex-1 rounded-lg text-sm font-medium text-brand-800 active:bg-brand-50"
                    onClick={() => setEditing(partner)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="min-h-10 flex-1 rounded-lg text-sm font-medium text-red-600 active:bg-red-50"
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
        message={`¿Eliminar a ${toDelete?.name} de la lista? Los lotes de material que comparten conservan el nombre escrito y el reparto de gramos; solo se quita el vínculo con esta ficha.`}
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
