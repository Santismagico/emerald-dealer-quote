import type { Appointment, Client, Quote, Settings, StoneLot } from '../types';

export const BACKUP_REMINDER_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
export const BACKUP_REMINDER_SNOOZE_MS = 24 * 60 * 60 * 1000;

export interface BackupReminderState {
  shouldShow: boolean;
  /** Indica que hay datos pero ninguna fecha fiable para iniciar el primer intervalo. */
  needsFirstDataAnchor: boolean;
}

export interface BackupReminderInput {
  settings: Pick<
    Settings,
    'lastBackupExportedAt' | 'backupReminderSnoozedUntil' | 'backupReminderFirstDataAt'
  >;
  clients: ReadonlyArray<Pick<Client, 'createdAt'>>;
  quotes: ReadonlyArray<Pick<Quote, 'createdAt'>>;
  /** Citas de la agenda; también son datos que merecen respaldo. Opcional por compatibilidad. */
  appointments?: ReadonlyArray<Pick<Appointment, 'createdAt'>>;
  /** Lotes de piedras; también son datos que merecen respaldo. Opcional por compatibilidad. */
  stoneLots?: ReadonlyArray<Pick<StoneLot, 'createdAt'>>;
  now: Date;
}

function timestamp(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Decide el aviso sin leer el reloj ni modificar datos. Las fechas se comparan
 * como instantes absolutos para que un cambio de zona horaria no adelante el aviso.
 */
export function getBackupReminderState({
  settings,
  clients,
  quotes,
  appointments = [],
  stoneLots = [],
  now
}: BackupReminderInput): BackupReminderState {
  const nowTime = now.getTime();
  if (!Number.isFinite(nowTime)) return { shouldShow: false, needsFirstDataAnchor: false };
  if (
    clients.length === 0 &&
    quotes.length === 0 &&
    appointments.length === 0 &&
    stoneLots.length === 0
  ) {
    return { shouldShow: false, needsFirstDataAnchor: false };
  }

  const snoozedUntil = timestamp(settings.backupReminderSnoozedUntil);
  if (snoozedUntil !== null && snoozedUntil > nowTime) {
    return { shouldShow: false, needsFirstDataAnchor: false };
  }

  const lastExported = timestamp(settings.lastBackupExportedAt);
  if (lastExported !== null) {
    if (lastExported > nowTime) return { shouldShow: false, needsFirstDataAnchor: false };
    return {
      shouldShow: nowTime - lastExported >= BACKUP_REMINDER_INTERVAL_MS,
      needsFirstDataAnchor: false
    };
  }

  const dataTimes = [...clients, ...quotes, ...appointments, ...stoneLots]
    .map((item) => timestamp(item.createdAt))
    .filter((value): value is number => value !== null);
  const pastOrPresentDataTimes = dataTimes.filter((value) => value <= nowTime);
  if (pastOrPresentDataTimes.length > 0) {
    const firstDataAt = Math.min(...pastOrPresentDataTimes);
    return {
      shouldShow: nowTime - firstDataAt >= BACKUP_REMINDER_INTERVAL_MS,
      needsFirstDataAnchor: false
    };
  }

  // Una fecha futura no genera una alarma inmediata ni se reemplaza por "ahora".
  if (dataTimes.length > 0) return { shouldShow: false, needsFirstDataAnchor: false };

  const fallbackAnchor = timestamp(settings.backupReminderFirstDataAt);
  if (fallbackAnchor !== null) {
    if (fallbackAnchor > nowTime) return { shouldShow: false, needsFirstDataAnchor: false };
    return {
      shouldShow: nowTime - fallbackAnchor >= BACKUP_REMINDER_INTERVAL_MS,
      needsFirstDataAnchor: false
    };
  }

  return { shouldShow: false, needsFirstDataAnchor: true };
}

export function getBackupReminderSnoozedUntil(now: Date): string {
  return new Date(now.getTime() + BACKUP_REMINDER_SNOOZE_MS).toISOString();
}

export interface BackupExportController {
  start: () => Promise<boolean>;
  isExporting: () => boolean;
}

interface BackupExportControllerOptions {
  download: () => Promise<void>;
  recordExported: (exportedAt: string) => Promise<void>;
  now: () => Date;
  onExportingChange?: (exporting: boolean) => void;
}

/** Evita descargas duplicadas y registra la fecha solo después de iniciar la descarga. */
export function createBackupExportController(options: BackupExportControllerOptions): BackupExportController {
  let inFlight: Promise<void> | null = null;

  const setExporting = (exporting: boolean) => options.onExportingChange?.(exporting);

  return {
    async start(): Promise<boolean> {
      if (inFlight) return false;
      setExporting(true);
      inFlight = (async () => {
        await options.download();
        await options.recordExported(options.now().toISOString());
      })();
      try {
        await inFlight;
        return true;
      } finally {
        inFlight = null;
        setExporting(false);
      }
    },
    isExporting: () => inFlight !== null
  };
}
