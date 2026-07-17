// Gestión de clientes: crear, editar y eliminar con confirmación.

import { useState } from 'react';
import { useStore } from '../store';
import type { Client } from '../types';
import { newId } from '../utils/id';
import { Button, Field, TextInput, TextArea, SectionCard, ConfirmDialog, EmptyState } from './ui';

function emptyClient(): Client {
  return {
    id: newId(),
    name: '',
    phone: '',
    email: '',
    city: '',
    document: '',
    notes: '',
    createdAt: new Date().toISOString()
  };
}

export function ClientsView() {
  const store = useStore();
  const [editing, setEditing] = useState<Client | null>(null);
  const [toDelete, setToDelete] = useState<Client | null>(null);
  const [error, setError] = useState('');

  if (editing) {
    return (
      <div className="space-y-4">
        <SectionCard title={store.clients.some((c) => c.id === editing.id) ? 'Editar cliente' : 'Nuevo cliente'}>
          <Field label="Nombre *">
            <TextInput value={editing.name} onChange={(name) => setEditing({ ...editing, name })} placeholder="Nombre completo" />
          </Field>
          <Field label="Teléfono">
            <TextInput value={editing.phone} onChange={(phone) => setEditing({ ...editing, phone })} inputMode="tel" placeholder="300 000 0000" />
          </Field>
          <Field label="Email (opcional)">
            <TextInput value={editing.email} onChange={(email) => setEditing({ ...editing, email })} inputMode="email" type="email" />
          </Field>
          <Field label="Ciudad">
            <TextInput value={editing.city} onChange={(city) => setEditing({ ...editing, city })} />
          </Field>
          <Field label="Documento (opcional)">
            <TextInput value={editing.document} onChange={(document) => setEditing({ ...editing, document })} />
          </Field>
          <Field label="Notas">
            <TextArea value={editing.notes} onChange={(notes) => setEditing({ ...editing, notes })} />
          </Field>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex gap-3 pt-1">
            <div className="flex-1">
              <Button variant="ghost" full onClick={() => { setEditing(null); setError(''); }}>
                Cancelar
              </Button>
            </div>
            <div className="flex-1">
              <Button
                full
                onClick={async () => {
                  if (!editing.name.trim()) {
                    setError('El nombre del cliente es obligatorio.');
                    return;
                  }
                  await store.upsertClient({ ...editing, name: editing.name.trim() });
                  store.showToast('Cliente guardado');
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
      <Button full onClick={() => setEditing(emptyClient())}>
        ＋ Nuevo cliente
      </Button>

      {store.clients.length === 0 ? (
        <EmptyState title="Sin clientes" message="Registra clientes para asignarlos a tus cotizaciones." />
      ) : (
        <ul className="space-y-3">
          {store.clients.map((client) => (
            <li key={client.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="font-semibold text-stone-900">{client.name}</p>
              <p className="text-sm text-stone-500">
                {[client.phone, client.city].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
              </p>
              <div className="mt-3 flex gap-2 border-t border-stone-100 pt-3">
                <button
                  type="button"
                  className="min-h-10 flex-1 rounded-lg text-sm font-medium text-brand-800 active:bg-brand-50"
                  onClick={() => setEditing(client)}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="min-h-10 flex-1 rounded-lg text-sm font-medium text-red-600 active:bg-red-50"
                  onClick={() => setToDelete(client)}
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
        title="Eliminar cliente"
        message={`¿Eliminar a ${toDelete?.name}? Las cotizaciones ya creadas conservan sus datos.`}
        confirmLabel="Eliminar"
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete) {
            await store.removeClient(toDelete.id);
            store.showToast('Cliente eliminado');
          }
          setToDelete(null);
        }}
      />
    </div>
  );
}
