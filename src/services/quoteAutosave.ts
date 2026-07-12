import type { Quote } from '../types';

export const QUOTE_AUTOSAVE_DELAY_MS = 650;

export type QuoteAutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';
export type QuoteSaveMode = 'deferred' | 'immediate';
export type QuoteUpdater = (current: Quote) => Quote;

export interface QuoteUpdateResult {
  quote: Quote;
  savePromise: Promise<Quote> | null;
}

interface QuoteAutosaveOptions {
  initialQuote: Quote;
  save: (quote: Quote) => Promise<void>;
  onDraft: (quote: Quote) => void;
  onStatus?: (status: QuoteAutosaveStatus) => void;
  delayMs?: number;
  now?: () => string;
}

export interface QuoteAutosaveController {
  update: (updater: QuoteUpdater, mode?: QuoteSaveMode) => QuoteUpdateResult;
  flush: () => Promise<Quote>;
  commit: () => Promise<Quote>;
  retry: () => Promise<Quote>;
  dispose: () => Promise<Quote>;
  getLatest: () => Quote;
  getStatus: () => QuoteAutosaveStatus;
  hasPendingChanges: () => boolean;
}

/**
 * Conserva la versión local más reciente y agrupa las escrituras de una cotización.
 * Nunca ejecuta dos guardados al mismo tiempo y, si llegan cambios durante uno,
 * guarda después únicamente la última versión disponible.
 */
export function createQuoteAutosaveController(options: QuoteAutosaveOptions): QuoteAutosaveController {
  const delayMs = options.delayMs ?? QUOTE_AUTOSAVE_DELAY_MS;
  const now = options.now ?? (() => new Date().toISOString());
  let latest = options.initialQuote;
  let revision = 0;
  let savedRevision = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;
  let status: QuoteAutosaveStatus = 'idle';
  let disposed = false;

  const setStatus = (next: QuoteAutosaveStatus) => {
    if (status === next) return;
    status = next;
    options.onStatus?.(next);
  };

  const clearTimer = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  };

  const schedule = () => {
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      void flush().catch(() => {
        // El estado "error" conserva la última versión y permite reintentar.
      });
    }, delayMs);
  };

  const update = (updater: QuoteUpdater, mode: QuoteSaveMode = 'deferred'): QuoteUpdateResult => {
    if (disposed) throw new Error('La sesión de guardado ya fue cerrada.');
    const updated = updater(latest);
    latest = { ...updated, updatedAt: now() };
    revision += 1;
    options.onDraft(latest);
    setStatus('pending');
    schedule();
    const savePromise = mode === 'immediate' ? flush() : null;
    if (savePromise) void savePromise.catch(() => {});
    return { quote: latest, savePromise };
  };

  const flush = async (): Promise<Quote> => {
    clearTimer();

    if (inFlight) {
      await inFlight;
      return savedRevision < revision ? flush() : latest;
    }
    if (savedRevision >= revision) return latest;

    const drain = async () => {
      while (savedRevision < revision) {
        const target = latest;
        const targetRevision = revision;
        setStatus('saving');
        try {
          await options.save(target);
        } catch (error) {
          setStatus('error');
          throw error;
        }
        savedRevision = targetRevision;
      }
      clearTimer();
      setStatus('saved');
    };

    inFlight = drain();
    try {
      await inFlight;
      return latest;
    } finally {
      inFlight = null;
    }
  };

  const commit = async (): Promise<Quote> => {
    update((current) => current);
    return flush();
  };

  const dispose = async (): Promise<Quote> => {
    clearTimer();
    try {
      return await flush();
    } finally {
      disposed = true;
    }
  };

  return {
    update,
    flush,
    commit,
    retry: flush,
    dispose,
    getLatest: () => latest,
    getStatus: () => status,
    hasPendingChanges: () => savedRevision < revision
  };
}

/** Ejecuta una acción de salida solo después de confirmar el guardado. */
export async function runAfterSuccessfulFlush(
  flush: () => Promise<unknown>,
  action: () => void
): Promise<boolean> {
  try {
    await flush();
    action();
    return true;
  } catch {
    return false;
  }
}
