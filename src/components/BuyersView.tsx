// Gestión de compradores (D-043): a quién le vende piedras y joyas en stock.
// Lista aparte de los Clientes del cotizador, porque suelen ser otros joyeros
// y comerciantes, no el consumidor final que encarga una pieza a la medida.
// Vincularlos permite responder "¿cuánto me debe Fulano en total?".

import { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { Buyer } from '../types';
import { listBuyerDebts } from '../services/receivables';
import { todayISO } from '../utils/dates';
import { formatCOP } from '../utils/money';
import { newId } from '../utils/id';
import { Button, Field, TextInput, TextArea, SectionCard, ConfirmDialog, EmptyState } from './ui';

function emptyBuyer(): Buyer {
  return {
    id: newId(),
    name: '',
    phone: '',
    city: '',
    notes: '',
    createdAt: new Date().toISOString()
  };
}

export function BuyersView() {
  const store = useStore();
  const [editing, setEditing] = useState<Buyer | null>(null);
  const [toDelete, setToDelete] = useState<Buyer | null>(null);
  const [error, setError] = useState('');

  // La deuda es derivada: se calcula al mostrarla, nunca se guarda (D-023).
  const debts = useMemo(() => listBuyerDebts(store.stoneLots, todayISO()), [store.stoneLots]);
  const debtOf = (buyerId: string) => debts.find((d) => d.buyerId === buyerId);

  if (editing) {
    return (
      <div className="space-y-4">
        <SectionCard
          title={store.buyers.some((b) => b.id === editing.id) ? 'Editar comprador' : 'Nuevo comprador'}
          subtitle="Quien le compra piedras o joyas. Es una lista aparte de sus clientes del cotizador."
        >
          <Field label="Nombre *">
            <TextInput
              value={editing.name}
              onChange={(name) => setEditing({ ...editing, name })}
              placeholder="Nombre del comerciante o joyería"
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
                    setError('El nombre del comprador es obligatorio.');
                    return;
                  }
                  await store.upsertBuyer({ ...editing, name: editing.name.trim() });
                  store.showToast('Comprador guardado');
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
      <Button full onClick={() => setEditing(emptyBuyer())}>
        ＋ Nuevo comprador
      </Button>

      {store.buyers.length === 0 ? (
        <EmptyState
          title="Sin compradores"
          message="Registra a quiénes les vendes piedras o joyas para ver cuánto te debe cada uno y todo su historial."
        />
      ) : (
        <ul className="space-y-3">
          {store.buyers.map((buyer) => {
            const debt = debtOf(buyer.id);
            return (
              <li key={buyer.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="font-semibold text-stone-900">{buyer.name}</p>
                <p className="text-sm text-stone-500">
                  {[buyer.phone, buyer.city].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
                </p>
                {debt ? (
                  <p
                    className={`mt-1 text-sm font-medium ${
                      debt.status === 'vencido' ? 'text-red-600' : 'text-stone-700'
                    }`}
                  >
                    Le debe {formatCOP(debt.balanceCop)}
                    {debt.status === 'vencido' ? ` · vencido hace ${debt.maxDaysOverdue} día(s)` : ''}
                  </p>
                ) : null}
                <div className="mt-3 flex gap-2 border-t border-stone-100 pt-3">
                  <button
                    type="button"
                    className="min-h-10 flex-1 rounded-lg text-sm font-medium text-brand-800 active:bg-brand-50"
                    onClick={() => setEditing(buyer)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="min-h-10 flex-1 rounded-lg text-sm font-medium text-red-600 active:bg-red-50"
                    onClick={() => setToDelete(buyer)}
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
        title="Eliminar comprador"
        message={`¿Eliminar a ${toDelete?.name} de la lista? Sus ventas, abonos y saldos se conservan con el nombre escrito; solo se quita el vínculo con esta ficha.`}
        confirmLabel="Eliminar"
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete) {
            await store.removeBuyer(toDelete.id);
            store.showToast('Comprador eliminado');
          }
          setToDelete(null);
        }}
      />
    </div>
  );
}
