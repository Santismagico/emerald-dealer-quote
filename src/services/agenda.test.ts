import { describe, expect, it } from 'vitest';
import type { Appointment } from '../types';
import {
  compareAppointments,
  countAgenda,
  emptyAppointment,
  filterAgenda,
  isAppointmentPast,
  matchesAgendaSearch,
  sortAgenda,
  todaysPendingAppointments,
  withAppointmentStatus
} from './agenda';

const TODAY = '2026-07-14';

function cita(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 'a-1',
    clientId: null,
    clientName: 'María Gómez',
    date: TODAY,
    time: '10:00',
    durationMinutes: 60,
    reason: 'Asesoría anillo de compromiso',
    notes: '',
    status: 'programada',
    createdAt: '2026-07-10T09:00:00.000Z',
    updatedAt: '2026-07-10T09:00:00.000Z',
    ...overrides
  };
}

describe('orden natural de la agenda', () => {
  it('ordena por fecha, luego hora, y las citas sin hora van al final del día', () => {
    const tarde = cita({ id: 'a-tarde', date: '2026-07-15', time: '15:00' });
    const manana = cita({ id: 'a-manana', date: '2026-07-15', time: '09:00' });
    const sinHora = cita({ id: 'a-sin-hora', date: '2026-07-15', time: '' });
    const otroDia = cita({ id: 'a-otro-dia', date: '2026-07-16', time: '08:00' });

    const sorted = sortAgenda([otroDia, sinHora, tarde, manana]);
    expect(sorted.map((a) => a.id)).toEqual(['a-manana', 'a-tarde', 'a-sin-hora', 'a-otro-dia']);
  });

  it('desempata por id para que el orden sea estable', () => {
    const a = cita({ id: 'a-1' });
    const b = cita({ id: 'a-2' });
    expect(compareAppointments(a, b)).toBeLessThan(0);
  });
});

describe('citas pasadas y de hoy', () => {
  it('una cita de ayer es pasada; una de hoy o mañana no', () => {
    expect(isAppointmentPast(cita({ date: '2026-07-13' }), TODAY)).toBe(true);
    expect(isAppointmentPast(cita({ date: TODAY }), TODAY)).toBe(false);
    expect(isAppointmentPast(cita({ date: '2026-07-15' }), TODAY)).toBe(false);
  });

  it('una fecha inválida o vacía nunca cuenta como pasada', () => {
    expect(isAppointmentPast(cita({ date: '' }), TODAY)).toBe(false);
    expect(isAppointmentPast(cita({ date: '2026-02-30' }), TODAY)).toBe(false);
  });

  it('el aviso de hoy solo cuenta las programadas de hoy, en orden de hora', () => {
    const citas = [
      cita({ id: 'a-hoy-2', date: TODAY, time: '16:00' }),
      cita({ id: 'a-hoy-1', date: TODAY, time: '09:00' }),
      cita({ id: 'a-cumplida', date: TODAY, status: 'cumplida' }),
      cita({ id: 'a-manana', date: '2026-07-15' })
    ];
    const today = todaysPendingAppointments(citas, TODAY);
    expect(today.map((a) => a.id)).toEqual(['a-hoy-1', 'a-hoy-2']);
  });
});

describe('búsqueda, filtros y conteos', () => {
  const pasada = cita({ id: 'a-pasada', date: '2026-07-10', clientName: 'Ana Torres' });
  const hoy = cita({ id: 'a-hoy', date: TODAY, clientName: 'Beatriz Rojas' });
  const futura = cita({ id: 'a-futura', date: '2026-07-20', reason: 'Ver esmeraldas nuevas' });
  const citas = [pasada, hoy, futura];

  it('próximas incluye las de hoy y excluye las pasadas', () => {
    expect(filterAgenda(citas, '', 'proximas', TODAY).map((a) => a.id)).toEqual(['a-hoy', 'a-futura']);
  });

  it('pasadas se listan de la más reciente a la más antigua', () => {
    const masVieja = cita({ id: 'a-vieja', date: '2026-07-01' });
    const result = filterAgenda([...citas, masVieja], '', 'pasadas', TODAY);
    expect(result.map((a) => a.id)).toEqual(['a-pasada', 'a-vieja']);
  });

  it('busca por nombre y por motivo sin distinguir mayúsculas', () => {
    expect(matchesAgendaSearch(futura, 'ESMERALDAS')).toBe(true);
    expect(filterAgenda(citas, 'ana', 'todas', TODAY).map((a) => a.id)).toEqual(['a-pasada']);
  });

  it('los conteos respetan la búsqueda', () => {
    expect(countAgenda(citas, '', TODAY)).toEqual({ proximas: 2, pasadas: 1, todas: 3 });
    expect(countAgenda(citas, 'Beatriz', TODAY)).toEqual({ proximas: 1, pasadas: 0, todas: 1 });
  });
});

describe('cambio de estado y cita nueva', () => {
  const NOW = '2026-07-14T10:00:00.000Z';

  it('cambia el estado y updatedAt sin tocar el objeto original', () => {
    const original = cita();
    const copia = structuredClone(original);
    const cambiada = withAppointmentStatus(original, 'cumplida', NOW);

    expect(cambiada.status).toBe('cumplida');
    expect(cambiada.updatedAt).toBe(NOW);
    expect(original).toEqual(copia);
  });

  it('la cita en blanco nace hoy, programada y de una hora', () => {
    const nueva = emptyAppointment(TODAY, NOW);
    expect(nueva.date).toBe(TODAY);
    expect(nueva.status).toBe('programada');
    expect(nueva.durationMinutes).toBe(60);
    expect(nueva.clientId).toBeNull();
    expect(nueva.id).not.toBe(emptyAppointment(TODAY, NOW).id);
  });
});
