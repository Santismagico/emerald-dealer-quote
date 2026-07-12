import { describe, expect, it, vi } from 'vitest';
import {
  BACKUP_REMINDER_SNOOZE_MS,
  createBackupExportController,
  getBackupReminderSnoozedUntil,
  getBackupReminderState
} from './backupReminder';
import { sampleClient, sampleQuote, sampleSettings } from '../test/fixtures';

const NOW = new Date('2026-07-11T12:00:00.000Z');

function reminderState(options: {
  createdAt?: string;
  quoteCreatedAt?: string;
  settings?: Partial<ReturnType<typeof sampleSettings>>;
}) {
  return getBackupReminderState({
    settings: sampleSettings(options.settings),
    clients: options.createdAt === undefined ? [] : [sampleClient({ createdAt: options.createdAt })],
    quotes: options.quoteCreatedAt === undefined ? [] : [sampleQuote({ createdAt: options.quoteCreatedAt })],
    now: NOW
  });
}

describe('getBackupReminderState', () => {
  it('no aparece si la aplicación no tiene clientes ni cotizaciones', () => {
    expect(reminderState({})).toEqual({ shouldShow: false, needsFirstDataAnchor: false });
  });

  it('no aparece antes de completar el primer intervalo de siete días', () => {
    expect(reminderState({ createdAt: '2026-07-04T12:00:01.000Z' }).shouldShow).toBe(false);
  });

  it('aparece exactamente siete días después del primer dato', () => {
    expect(reminderState({ createdAt: '2026-07-04T12:00:00.000Z' }).shouldShow).toBe(true);
  });

  it('aparece cuando el primer dato tiene más de siete días', () => {
    expect(reminderState({ quoteCreatedAt: '2026-07-01T10:00:00.000Z' }).shouldShow).toBe(true);
  });

  it('usa la fecha válida más antigua entre clientes y cotizaciones', () => {
    const result = getBackupReminderState({
      settings: sampleSettings(),
      clients: [sampleClient({ createdAt: '2026-07-06T12:00:00.000Z' })],
      quotes: [sampleQuote({ createdAt: '2026-07-01T12:00:00.000Z' })],
      now: NOW
    });
    expect(result.shouldShow).toBe(true);
  });

  it('no aparece si existe una exportación reciente', () => {
    expect(
      reminderState({
        createdAt: '2026-07-01T10:00:00.000Z',
        settings: { lastBackupExportedAt: '2026-07-04T12:00:01.000Z' }
      }).shouldShow
    ).toBe(false);
  });

  it('aparece exactamente siete días después de la última exportación', () => {
    expect(
      reminderState({
        createdAt: '2026-07-01T10:00:00.000Z',
        settings: { lastBackupExportedAt: '2026-07-04T12:00:00.000Z' }
      }).shouldShow
    ).toBe(true);
  });

  it('desaparece después de registrar una exportación confirmada', () => {
    expect(
      reminderState({
        createdAt: '2026-07-01T10:00:00.000Z',
        settings: { lastBackupExportedAt: NOW.toISOString() }
      }).shouldShow
    ).toBe(false);
  });

  it('permanece visible si falla una exportación y no se registra fecha', () => {
    const settings = sampleSettings();
    expect(
      getBackupReminderState({
        settings,
        clients: [sampleClient({ createdAt: '2026-07-01T10:00:00.000Z' })],
        quotes: [],
        now: NOW
      }).shouldShow
    ).toBe(true);
    expect(settings.lastBackupExportedAt).toBe('');
  });

  it('no aparece mientras una posposición está vigente', () => {
    expect(
      reminderState({
        createdAt: '2026-07-01T10:00:00.000Z',
        settings: { backupReminderSnoozedUntil: '2026-07-12T12:00:00.000Z' }
      }).shouldShow
    ).toBe(false);
  });

  it('vuelve a aparecer cuando la posposición venció', () => {
    expect(
      reminderState({
        createdAt: '2026-07-01T10:00:00.000Z',
        settings: { backupReminderSnoozedUntil: '2026-07-11T11:59:59.999Z' }
      }).shouldShow
    ).toBe(true);
  });

  it('pospone exactamente veinticuatro horas', () => {
    const snoozedUntil = getBackupReminderSnoozedUntil(NOW);
    expect(Date.parse(snoozedUntil) - NOW.getTime()).toBe(BACKUP_REMINDER_SNOOZE_MS);
  });

  it('maneja fechas inválidas sin romper ni mutar los objetos recibidos', () => {
    const settings = sampleSettings({ backupReminderFirstDataAt: 'fecha inválida' });
    const client = sampleClient({ createdAt: 'fecha inválida' });
    const before = JSON.parse(JSON.stringify({ settings, client }));

    const result = getBackupReminderState({ settings, clients: [client], quotes: [], now: NOW });

    expect(result).toEqual({ shouldShow: false, needsFirstDataAnchor: true });
    expect({ settings, client }).toEqual(before);
  });

  it('maneja fechas futuras de forma segura', () => {
    expect(reminderState({ createdAt: '2026-07-12T12:00:00.000Z' })).toEqual({
      shouldShow: false,
      needsFirstDataAnchor: false
    });
  });

  it('compara instantes absolutos aunque las fechas tengan zona horaria distinta', () => {
    const now = new Date('2026-07-11T00:30:00-05:00');
    const result = getBackupReminderState({
      settings: sampleSettings(),
      clients: [sampleClient({ createdAt: '2026-07-04T00:30:00-05:00' })],
      quotes: [],
      now
    });
    expect(result.shouldShow).toBe(true);
  });

  it('depende únicamente de la fecha recibida, no del reloj real', () => {
    const input = {
      settings: sampleSettings(),
      clients: [sampleClient({ createdAt: '2026-07-04T12:00:00.000Z' })],
      quotes: []
    };
    expect(getBackupReminderState({ ...input, now: NOW }).shouldShow).toBe(true);
    expect(getBackupReminderState({ ...input, now: new Date('2026-07-11T11:59:59.999Z') }).shouldShow).toBe(false);
  });
});

describe('createBackupExportController', () => {
  it('registra la exportación solo después de iniciar la descarga y evita un doble toque', async () => {
    let finishDownload: (() => void) | undefined;
    const download = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishDownload = resolve;
        })
    );
    const recordExported = vi.fn(async () => {});
    const exporting: boolean[] = [];
    const controller = createBackupExportController({
      download,
      recordExported,
      now: () => NOW,
      onExportingChange: (value) => exporting.push(value)
    });

    const first = controller.start();
    const second = await controller.start();
    expect(second).toBe(false);
    expect(download).toHaveBeenCalledTimes(1);
    expect(recordExported).not.toHaveBeenCalled();

    finishDownload?.();
    await expect(first).resolves.toBe(true);
    expect(recordExported).toHaveBeenCalledWith(NOW.toISOString());
    expect(exporting).toEqual([true, false]);
  });

  it('si la descarga falla no registra una exportación inexistente', async () => {
    const recordExported = vi.fn(async () => {});
    const controller = createBackupExportController({
      download: async () => {
        throw new Error('descarga fallida');
      },
      recordExported,
      now: () => NOW
    });

    await expect(controller.start()).rejects.toThrow('descarga fallida');
    expect(recordExported).not.toHaveBeenCalled();
  });
});
