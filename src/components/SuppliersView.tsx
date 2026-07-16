// Gestión de proveedores (corrección C3): crear, editar y eliminar con
// confirmación, igual que los clientes. Los lotes de piedras se vinculan a
// un proveedor para no reescribir el nombre y seguir las deudas por persona.

import { useState } from 'react';
import { useStore } from '../store';
import type { Supplier } from '../types';
import { newId } from '../utils/id';
import { Button, Field, TextInput, TextArea, SectionCard, ConfirmDialog, EmptyState } from './ui';

function emptySupplier(): Supplier {
  return {
    id: newId(),
    name: '',
    phone: '',
    city: '',
    notes: '',
    createdAt: new Date().toISOString()
  };
}

export function SuppliersView() {
  const store = useStore();
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [toDelete, setToDelete] = useState<Supplier | null>(null);
  const [error, setError] = useState('');

  if (editing) {
    return (
      <div className="space-y-4">
        <SectionCard
          title={store.suppliers.some((s) => s.id === editing.id) ? 'Editar proveedor' : 'Nuevo proveedor'}
        >
          <Field label="Nombre *">
            <TextInput
              value={editing.name}
              onChange={(name) => setEditing({ ...editing, name })}
              placeholder="Nombre del proveedor o taller"
            />
          </Field>
          <Field label="Teléfono">
            <TextInput
              value={editing.phone}
              onChange={(phone) => setEditing({ ...editing, phone })}
              inputMode="tel"
              placeholder="300 123 4567"
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
                    setError('El nombre del proveedor es obligatorio.');
                    return;
                  }
                  await store.upsertSupplier({ ...editing, name: editing.name.trim() });
                  store.showToast('Proveedor guardado');
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
      <Button full onClick={() => setEditing(emptySupplier())}>
        ＋ Nuevo proveedor
      </Button>

      {store.suppliers.length === 0 ? (
        <EmptyState
          title="Sin proveedores"
          message="Registra a quiénes les compras piedras o servicios para vincularlos a tus lotes."
        />
      ) : (
        <ul className="space-y-3">
          {store.suppliers.map((supplier) => (
            <li key={supplier.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="font-semibold text-stone-900">{supplier.name}</p>
              <p className="text-sm text-stone-500">
                {[supplier.phone, supplier.city].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
              </p>
              <div className="mt-3 flex gap-2 border-t border-stone-100 pt-3">
                <button
                  type="button"
                  className="min-h-10 flex-1 rounded-lg text-sm font-medium text-brand-800 active:bg-brand-50"
                  onClick={() => setEditing(supplier)}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="min-h-10 flex-1 rounded-lg text-sm font-medium text-red-600 active:bg-red-50"
                  onClick={() => setToDelete(supplier)}
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Eliminar proveedor"
        message={`¿Eliminar a ${toDelete?.name}? Los lotes ya registrados conservan su nombre.`}
        confirmLabel="Eliminar"
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete) {
            await store.removeSupplier(toDelete.id);
            store.showToast('Proveedor eliminado');
          }
          setToDelete(null);
        }}
      />
    </div>
  );
}
