import type { CalcResult } from '../calc/engine';
import type { Quote, Settings } from '../types';
import { findSensitiveWordsInClientText } from './pdfContent';
import { createClientPdfFile, downloadPdfFile } from './pdf';

export type ClientPdfShareResult =
  | { status: 'shared' }
  | { status: 'cancelled' }
  | { status: 'downloaded' }
  | { status: 'error'; error: unknown };

export function clientPdfShareMessage(result: ClientPdfShareResult): string {
  if (result.status === 'shared') return 'PDF entregado al menú de compartir.';
  if (result.status === 'cancelled') return 'Compartir cancelado.';
  if (result.status === 'downloaded') {
    return 'Este dispositivo no permite compartir el PDF. Se descargó para enviarlo manualmente.';
  }
  return 'No se pudo abrir el menú de compartir. Puedes descargar el PDF manualmente.';
}

export interface PdfShareEnvironment {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
  download: (file: File) => void;
}

function browserShareEnvironment(): PdfShareEnvironment {
  return {
    share: typeof navigator.share === 'function' ? (data) => navigator.share(data) : undefined,
    canShare: typeof navigator.canShare === 'function' ? (data) => navigator.canShare(data) : undefined,
    download: downloadPdfFile
  };
}

function errorName(error: unknown): string {
  return typeof error === 'object' && error !== null && 'name' in error
    ? String((error as { name: unknown }).name)
    : '';
}

function isCompatibilityError(error: unknown): boolean {
  return ['NotSupportedError', 'NotAllowedError', 'SecurityError', 'TypeError'].includes(errorName(error));
}

function downloadFallback(file: File, environment: PdfShareEnvironment): ClientPdfShareResult {
  try {
    environment.download(file);
    return { status: 'downloaded' };
  } catch (error) {
    return { status: 'error', error };
  }
}

/** Entrega un PDF cliente ya creado al sistema operativo o lo descarga como fallback. */
export async function shareClientPdfFile(
  file: File,
  environment: PdfShareEnvironment = browserShareEnvironment()
): Promise<ClientPdfShareResult> {
  if (!environment.share || !environment.canShare) return downloadFallback(file, environment);

  const shareData: ShareData = {
    files: [file],
    title: 'Cotización para cliente'
  };

  let compatible = false;
  try {
    compatible = environment.canShare(shareData);
  } catch {
    return downloadFallback(file, environment);
  }
  if (!compatible) return downloadFallback(file, environment);

  try {
    await environment.share(shareData);
    return { status: 'shared' };
  } catch (error) {
    if (errorName(error) === 'AbortError') return { status: 'cancelled' };
    if (isCompatibilityError(error)) return downloadFallback(file, environment);
    return { status: 'error', error };
  }
}

/** Esta acción solo puede construir el PDF cliente; no acepta PDF interno ni respaldos. */
export async function shareClientPdf(
  quote: Quote,
  calc: CalcResult,
  settings: Settings,
  environment?: PdfShareEnvironment
): Promise<ClientPdfShareResult> {
  const file = await createClientPdfFile(quote, calc, settings);
  return shareClientPdfFile(file, environment);
}

export type ClientPdfShareFlowResult =
  | { status: 'sensitive'; words: string[] }
  | { status: 'completed'; result: ClientPdfShareResult };

/** Verifica privacidad antes de guardar, numerar, crear o compartir el archivo. */
export async function runClientPdfShareFlow(options: {
  quote: Quote;
  calc: CalcResult;
  settings: Settings;
  persist: () => Promise<Quote>;
  share: (savedQuote: Quote) => Promise<ClientPdfShareResult>;
}): Promise<ClientPdfShareFlowResult> {
  const words = findSensitiveWordsInClientText(options.quote, options.calc, options.settings);
  if (words.length > 0) return { status: 'sensitive', words };

  const savedQuote = await options.persist();
  const savedWords = findSensitiveWordsInClientText(savedQuote, options.calc, options.settings);
  if (savedWords.length > 0) return { status: 'sensitive', words: savedWords };
  return { status: 'completed', result: await options.share(savedQuote) };
}

export interface PdfShareController {
  start: <T>(task: () => Promise<T>) => Promise<T | null>;
  isRunning: () => boolean;
}

/** Evita dos archivos, dos descargas o dos menús nativos por doble toque. */
export function createPdfShareController(onBusyChange?: (busy: boolean) => void): PdfShareController {
  let running = false;
  return {
    async start<T>(task: () => Promise<T>): Promise<T | null> {
      if (running) return null;
      running = true;
      onBusyChange?.(true);
      try {
        return await task();
      } finally {
        running = false;
        onBusyChange?.(false);
      }
    },
    isRunning: () => running
  };
}
