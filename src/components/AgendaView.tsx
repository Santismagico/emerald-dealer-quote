// Área Agenda: asesorías personalizadas registradas por Santiago.
// Todo es interno y local: el cliente contacta por WhatsApp y aquí solo se
// anota la cita (D-020). Nada se publica, sincroniza ni notifica por internet.

import { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { Appointment, AppointmentStatus } from '../types';
import { APPOINTMENT_STATUSES } from '../types';
import {
  APPOINTMENT_STATUS_LABEL,
  countAgenda,
  emptyAppointment,
  filterAgenda,
  todaysPendingAppointments,
  withAppointmentStatus,
  type AgendaFilter
} from '../services/agenda';
import { formatDateCO, isValidISODate, todayISO } from '../utils/dates';
import { Button, ConfirmDialog, EmptyState, Field, Select, TextArea, TextInput } from './ui';

const FILTERS: Array<{ value: AgendaFilter; label: string }> = [
  { value: 'proximas', label: 'Próximas' },
  { value: 'pasadas', label: 'Pasadas' },
  { value: 'todas', label: 'Todas' }
];

const DURATIONS = [
  { value: '30', label: '30 minutos' },
  { value: '60', label: '1 hora' },
  { value: '90', label: '1 hora y media' },
  { value: '120', label: '2 horas' }
];

const STATUS_STYLE: Record<AppointmentStatus, string> = {
  programada: 'bg-amber-100 text-amber-800',
  cumplida: 'bg-emerald-100 text-emerald-800',
  cancelada: 'bg-stone-200 text-stone-600',
  noAsistio: 'bg-red-100 text-red-700'
};

function StatusChip({ status }: { status: AppointmentStatus }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>
      {APPOINTMENT_STATUS_LABEL[status]}
    </span>
  );
}

export function AgendaView() {
  const store = useStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<AgendaFilter>('proximas');
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [statusMenuFor, setStatusMenuFor] = useState<Appointment | null>(null);
  const today = todayISO();

  const filtered = useMemo(
    () => filterAgenda(store.appointments, search, filter, today),
    [store.appointments, search, filter, today]
  );
  const counts = useMemo(
    () => countAgenda(store.appointments, search, today),
    [store.appointments, search, today]
  );
  const todayCount = useMemo(
    () => todaysPendingAppointments(store.appointments, today).length,
    [store.appointments, today]
  );

  const changeStatus = async (appointment: Appointment, status: AppointmentStatus) => {
    setStatusMenuFor(null);
    if (status === appointment.status) return;
    await store.upsertAppointment(withAppointmentStatus(appointment, status, new Date().toISOString()));
    store.showToast(`Cita marcada como ${APPOINTMENT_STATUS_LABEL[status].toLowerCase()}`);
  };

  return (
    <div className="space-y-4">
      <Button full onClick={() => setEditing(emptyAppointment(today, new Date().toISOString()))}>
        ＋ Nueva cita
      </Button>

      {todayCount > 0 && (
        <div className="luxury-card-soft flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-ivory-200">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-gold-400/40 bg-gold-400/10 text-gold-300" aria-hidden>
            ◆
          </span>
          <span>
            Hoy tienes <strong className="text-gold-300">{todayCount === 1 ? '1 cita programada' : `${todayCount} citas programadas`}</strong>.
          </span>
        </div>
      )}

      <TextInput value={search} onChange={setSearch} placeholder="Buscar por nombre o motivo…" />

      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-2 pb-1">
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`whitespace-nowrap rounded-full px-3.5 py-2 text-sm ${
                filter === value
                  ? 'border border-gold-300/70 bg-gold-400 font-semibold text-brand-950'
                  : 'border border-gold-400/20 bg-white text-stone-600'
              }`}
            >
              {label} ({counts[value]})
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Sin citas"
          message={
            store.appointments.length === 0
              ? 'Registra aquí las asesorías que acuerdes con tus clientes por WhatsApp o en persona.'
              : 'Ninguna cita coincide con la búsqueda o el filtro.'
          }
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((appointment) => (
            <li key={appointment.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setEditing(appointment)}
                >
                  <p className="text-xs font-medium text-brand-800">
                    {appointment.date === today ? 'HOY' : formatDateCO(appointment.date)}
                    {appointment.time ? ` · ${appointment.time}` : ' · Sin hora'}
                    {` · ${appointment.durationMinutes} min`}
                  </p>
                  <p className="mt-0.5 truncate font-semibold text-stone-900">
                    {appointment.clientName || 'Sin nombre'}
                  </p>
                  {appointment.reason ? (
                    <p className="truncate text-sm text-stone-600">{appointment.reason}</p>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => setStatusMenuFor(appointment)}
                  className="-mr-1.5 flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-1.5 active:bg-stone-100"
                  aria-label={`Cambiar estado de la cita de ${appointment.clientName || 'sin nombre'}`}
                >
                  <StatusChip status={appointment.status} />
                  <span className="text-xs text-stone-400">▾</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {statusMenuFor !== null && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setStatusMenuFor(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-stone-900">Estado de la cita</h3>
            <p className="mt-1 text-sm text-stone-600">
              {statusMenuFor.clientName || 'Sin nombre'} ·{' '}
              {formatDateCO(statusMenuFor.date) || 'sin fecha'}
            </p>
            <div className="mt-4 space-y-2">
              {APPOINTMENT_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void changeStatus(statusMenuFor, s)}
                  className={`flex min-h-12 w-full items-center justify-between rounded-xl border px-3 ${
                    statusMenuFor.status === s
                      ? 'border-brand-700 bg-brand-50'
                      : 'border-stone-200 bg-white active:bg-stone-50'
                  }`}
                >
                  <StatusChip status={s} />
                  <span className="text-xs text-stone-500">
                    {statusMenuFor.status === s ? 'Actual' : '›'}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-4">
              <Button variant="ghost" full onClick={() => setStatusMenuFor(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {editing !== null && (
        <AppointmentForm
          key={editing.id}
          initial={editing}
          isNew={!store.appointments.some((a) => a.id === editing.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

/** Formulario de crear/editar cita con guardado explícito (botón Guardar). */
function AppointmentForm({
  initial,
  isNew,
  onClose
}: {
  initial: Appointment;
  isNew: boolean;
  onClose: () => void;
}) {
  const store = useStore();
  const [form, setForm] = useState<Appointment>(initial);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const patch = (partial: Partial<Appointment>) => setForm((current) => ({ ...current, ...partial }));

  const selectClient = (clientId: string) => {
    if (!clientId) {
      patch({ clientId: null });
      return;
    }
    const client = store.clients.find((c) => c.id === clientId);
    patch({ clientId, clientName: client ? client.name : form.clientName });
  };

  const save = async () => {
    if (!isValidISODate(form.date)) {
      store.showToast('La cita necesita una fecha válida.');
      return;
    }
    if (!form.clientName.trim()) {
      store.showToast('Escribe el nombre de quien asiste.');
      return;
    }
    setBusy(true);
    try {
      await store.upsertAppointment({ ...form, updatedAt: new Date().toISOString() });
      store.showToast(isNew ? 'Cita registrada' : 'Cita actualizada');
      onClose();
    } catch {
      store.showToast('No se pudo guardar la cita. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[85dvh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-stone-900">
          {isNew ? 'Nueva cita' : 'Editar cita'}
        </h3>
        <div className="mt-4 space-y-3">
          {store.clients.length > 0 && (
            <Field label="Cliente registrado (opcional)">
              <Select
                value={form.clientId ?? ''}
                onChange={selectClient}
                options={[
                  { value: '', label: '— Sin vincular —' },
                  ...store.clients.map((c) => ({ value: c.id, label: c.name }))
                ]}
              />
            </Field>
          )}
          <Field label="Nombre de quien asiste">
            <TextInput
              value={form.clientName}
              onChange={(clientName) => patch({ clientName })}
              placeholder="Nombre del cliente o interesado"
            />
          </Field>
          <Field label="Fecha">
            <TextInput type="date" value={form.date} onChange={(date) => patch({ date })} />
          </Field>
          <Field label="Hora" hint="Déjala vacía si aún no está definida.">
            <TextInput type="time" value={form.time} onChange={(time) => patch({ time })} />
          </Field>
          <Field label="Duración estimada">
            <Select
              value={String(form.durationMinutes)}
              onChange={(v) => patch({ durationMinutes: parseInt(v, 10) || 60 })}
              options={DURATIONS}
            />
          </Field>
          <Field label="Motivo">
            <TextInput
              value={form.reason}
              onChange={(reason) => patch({ reason })}
              placeholder="Ej: asesoría para anillo de compromiso"
            />
          </Field>
          <Field label="Notas internas">
            <TextArea value={form.notes} onChange={(notes) => patch({ notes })} rows={2} />
          </Field>
        </div>
        <div className="mt-5 flex gap-3">
          <div className="flex-1">
            <Button variant="ghost" full disabled={busy} onClick={onClose}>
              Cancelar
            </Button>
          </div>
          <div className="flex-1">
            <Button full disabled={busy} onClick={() => void save()}>
              Guardar
            </Button>
          </div>
        </div>
        {!isNew && (
          <div className="mt-3">
            <Button variant="danger" full disabled={busy} onClick={() => setConfirmDelete(true)}>
              Eliminar cita
            </Button>
          </div>
        )}

        <ConfirmDialog
          open={confirmDelete}
          title="Eliminar cita"
          message={`¿Eliminar la cita de ${form.clientName || 'sin nombre'} del ${
            formatDateCO(form.date) || 'sin fecha'
          }? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          danger
          busy={busy}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            setBusy(true);
            try {
              await store.removeAppointment(form.id);
              store.showToast('Cita eliminada');
              setConfirmDelete(false);
              onClose();
            } catch {
              store.showToast('No se pudo eliminar la cita. Intenta de nuevo.');
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
    </div>
  );
}
