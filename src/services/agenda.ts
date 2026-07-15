// Lógica PURA de la Agenda de asesorías: orden, filtros, conteos y estado.
// Las citas son SOLO internas: Santiago las registra a mano y nada se publica
// ni se sincroniza (decisión D-020). Ninguna cita entra en canales de cliente.

import type { Appointment, AppointmentStatus } from '../types';
import { isExpired } from '../utils/dates';
import { newId } from '../utils/id';

export type AgendaFilter = 'proximas' | 'pasadas' | 'todas';

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  programada: 'Programada',
  cumplida: 'Cumplida',
  cancelada: 'Cancelada',
  noAsistio: 'No asistió'
};

/** Orden natural de agenda: fecha, luego hora (las citas sin hora van al final del día). */
export function compareAppointments(a: Appointment, b: Appointment): number {
  const dateOrder = a.date.localeCompare(b.date);
  if (dateOrder !== 0) return dateOrder;
  const timeOrder = (a.time || '99:99').localeCompare(b.time || '99:99');
  return timeOrder !== 0 ? timeOrder : a.id.localeCompare(b.id);
}

export function sortAgenda(appointments: readonly Appointment[]): Appointment[] {
  return [...appointments].sort(compareAppointments);
}

/** Una cita es pasada solo cuando su fecha es anterior a hoy; las de hoy no lo son. */
export function isAppointmentPast(appointment: Pick<Appointment, 'date'>, today: string): boolean {
  return isExpired(appointment.date, today);
}

export function matchesAgendaSearch(
  appointment: Pick<Appointment, 'clientName' | 'reason'>,
  search: string
): boolean {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return `${appointment.clientName} ${appointment.reason}`.toLowerCase().includes(term);
}

/** Próximas (incluye hoy) en orden de agenda; pasadas de la más reciente a la más antigua. */
export function filterAgenda(
  appointments: readonly Appointment[],
  search: string,
  filter: AgendaFilter,
  today: string
): Appointment[] {
  const matching = appointments.filter((appointment) => {
    if (!matchesAgendaSearch(appointment, search)) return false;
    if (filter === 'proximas') return !isAppointmentPast(appointment, today);
    if (filter === 'pasadas') return isAppointmentPast(appointment, today);
    return true;
  });
  const sorted = sortAgenda(matching);
  return filter === 'pasadas' ? sorted.reverse() : sorted;
}

export function countAgenda(
  appointments: readonly Appointment[],
  search: string,
  today: string
): Record<AgendaFilter, number> {
  const counts: Record<AgendaFilter, number> = { proximas: 0, pasadas: 0, todas: 0 };
  for (const appointment of appointments) {
    if (!matchesAgendaSearch(appointment, search)) continue;
    counts.todas += 1;
    counts[isAppointmentPast(appointment, today) ? 'pasadas' : 'proximas'] += 1;
  }
  return counts;
}

/** Citas de hoy que siguen programadas — alimenta el aviso visual de la pestaña Agenda. */
export function todaysPendingAppointments(
  appointments: readonly Appointment[],
  today: string
): Appointment[] {
  return sortAgenda(
    appointments.filter(
      (appointment) => appointment.date === today && appointment.status === 'programada'
    )
  );
}

/** Copia de la cita con el nuevo estado, sin tocar el objeto original. */
export function withAppointmentStatus(
  appointment: Appointment,
  status: AppointmentStatus,
  nowIso: string
): Appointment {
  return { ...appointment, status, updatedAt: nowIso };
}

/** Cita en blanco para el formulario de nueva cita. */
export function emptyAppointment(today: string, nowIso: string): Appointment {
  return {
    id: newId(),
    clientId: null,
    clientName: '',
    date: today,
    time: '',
    durationMinutes: 60,
    reason: '',
    notes: '',
    status: 'programada',
    createdAt: nowIso,
    updatedAt: nowIso
  };
}
