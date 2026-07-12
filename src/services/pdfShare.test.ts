import { describe, expect, it, vi } from 'vitest';
import { calculateQuote, quoteToCalcInput } from '../calc/engine';
import { sampleQuote, sampleSettings } from '../test/fixtures';
import { buildInternalPdfContent, contentToPlainText } from './pdfContent';
import {
  clientPdfFileName,
  createClientPdfBlob,
  createClientPdfFile,
  downloadClientPdf,
  getClientPdfContent
} from './pdf';
import {
  clientPdfShareMessage,
  createPdfShareController,
  runClientPdfShareFlow,
  shareClientPdf,
  shareClientPdfFile,
  type PdfShareEnvironment
} from './pdfShare';

const quote = sampleQuote();
const settings = sampleSettings();
const calc = calculateQuote(quoteToCalcInput(quote));

function pdfFile(name = 'Cotizacion-ED-2026-0001.pdf'): File {
  return new File([new Uint8Array([37, 80, 68, 70])], name, { type: 'application/pdf' });
}

function namedError(name: string): Error {
  return Object.assign(new Error(name), { name });
}

function environment(overrides: Partial<PdfShareEnvironment> = {}): PdfShareEnvironment {
  return {
    share: vi.fn(async (_data: ShareData) => undefined),
    canShare: vi.fn((_data: ShareData) => true),
    download: vi.fn(),
    ...overrides
  };
}

describe('archivo PDF cliente reutilizable', () => {
  it('genera un Blob PDF cliente', async () => {
    const blob = await createClientPdfBlob(quote, calc, settings);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('genera un File con MIME application/pdf', async () => {
    const file = await createClientPdfFile(quote, calc, settings);
    expect(file).toBeInstanceOf(File);
    expect(file.type).toBe('application/pdf');
  });

  it('usa el nombre exacto basado en el número de cotización', () => {
    expect(clientPdfFileName('ED-2026-0001')).toBe('Cotizacion-ED-2026-0001.pdf');
  });

  it('limpia caracteres problemáticos del nombre', () => {
    expect(clientPdfFileName(' ED/2026:Á 0001 ')).toBe('Cotizacion-ED-2026-A-0001.pdf');
  });

  it('obtiene el contenido desde el constructor exclusivo del cliente', () => {
    const content = getClientPdfContent(quote, calc, settings);
    expect(content.internal).toBe(false);
    expect(content.docTitle).toMatch(/cotizaci/i);
  });

  it('excluye del contenido cliente las notas y valores internos', () => {
    const clientText = contentToPlainText(getClientPdfContent(quote, calc, settings));
    const internalText = contentToPlainText(buildInternalPdfContent(quote, calc, settings));
    expect(internalText).toContain(quote.internalNotes);
    expect(clientText).not.toContain(quote.internalNotes);
    expect(clientText).not.toContain(String(quote.materialPricePerGram));
  });

  it('la descarga tradicional conserva el archivo PDF esperado', async () => {
    const download = vi.fn();
    await downloadClientPdf(quote, calc, settings, download);
    expect(download).toHaveBeenCalledTimes(1);
    expect(download.mock.calls[0][0]).toMatchObject({
      name: 'Cotizacion-ED-2026-0001.pdf',
      type: 'application/pdf'
    });
  });

  it('descarga y comparte desde la misma representación File del generador cliente', async () => {
    const downloaded = vi.fn();
    await downloadClientPdf(quote, calc, settings, downloaded);
    const shared = vi.fn(async (_data: ShareData) => undefined);
    await shareClientPdf(quote, calc, settings, environment({ share: shared }));

    const downloadedFile = downloaded.mock.calls[0][0] as File;
    const sharedFile = (shared.mock.calls[0][0] as ShareData).files?.[0];
    expect(sharedFile).toMatchObject({ name: downloadedFile.name, type: downloadedFile.type });
  });
});

describe('Web Share y fallback seguro', () => {
  it('abre el menú nativo cuando share y canShare aceptan el archivo', async () => {
    const env = environment();
    const result = await shareClientPdfFile(pdfFile(), env);
    expect(result).toEqual({ status: 'shared' });
    expect(env.canShare).toHaveBeenCalledOnce();
    expect(env.share).toHaveBeenCalledOnce();
    expect(env.download).not.toHaveBeenCalled();
  });

  it('descarga cuando canShare rechaza archivos', async () => {
    const env = environment({ canShare: vi.fn(() => false) });
    expect(await shareClientPdfFile(pdfFile(), env)).toEqual({ status: 'downloaded' });
    expect(env.share).not.toHaveBeenCalled();
    expect(env.download).toHaveBeenCalledOnce();
  });

  it('descarga cuando navigator.share no existe', async () => {
    const env = environment({ share: undefined });
    expect(await shareClientPdfFile(pdfFile(), env)).toEqual({ status: 'downloaded' });
    expect(env.download).toHaveBeenCalledOnce();
  });

  it('descarga cuando navigator.canShare no existe', async () => {
    const env = environment({ canShare: undefined });
    expect(await shareClientPdfFile(pdfFile(), env)).toEqual({ status: 'downloaded' });
    expect(env.download).toHaveBeenCalledOnce();
  });

  it('el fallback descarga exactamente el archivo preparado', async () => {
    const file = pdfFile('Cotizacion-segura.pdf');
    const env = environment({ share: undefined });
    await shareClientPdfFile(file, env);
    expect(env.download).toHaveBeenCalledWith(file);
  });

  it('AbortError se trata como cancelación normal', async () => {
    const env = environment({ share: vi.fn(async () => Promise.reject(namedError('AbortError'))) });
    expect(await shareClientPdfFile(pdfFile(), env)).toEqual({ status: 'cancelled' });
    expect(clientPdfShareMessage({ status: 'cancelled' })).toBe('Compartir cancelado.');
  });

  it('AbortError no provoca una descarga', async () => {
    const env = environment({ share: vi.fn(async () => Promise.reject(namedError('AbortError'))) });
    await shareClientPdfFile(pdfFile(), env);
    expect(env.download).not.toHaveBeenCalled();
  });

  it.each(['NotSupportedError', 'NotAllowedError', 'SecurityError', 'TypeError'])(
    'el error de compatibilidad %s usa la descarga',
    async (errorName) => {
      const env = environment({ share: vi.fn(async () => Promise.reject(namedError(errorName))) });
      expect(await shareClientPdfFile(pdfFile(), env)).toEqual({ status: 'downloaded' });
      expect(env.download).toHaveBeenCalledOnce();
    }
  );

  it('un error inesperado no afirma éxito ni descarga automáticamente', async () => {
    const failure = namedError('UnknownError');
    const env = environment({ share: vi.fn(async () => Promise.reject(failure)) });
    const result = await shareClientPdfFile(pdfFile(), env);
    expect(result).toEqual({ status: 'error', error: failure });
    expect(env.download).not.toHaveBeenCalled();
    expect(clientPdfShareMessage(result)).toBe(
      'No se pudo abrir el menú de compartir. Puedes descargar el PDF manualmente.'
    );
  });

  it('un doble toque no inicia dos acciones', async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const action = vi.fn(async () => pending);
    const controller = createPdfShareController();
    const first = controller.start(action);
    const second = await controller.start(action);
    expect(second).toBeNull();
    expect(action).toHaveBeenCalledOnce();
    release();
    await first;
  });

  it('restablece el control después de un error', async () => {
    const controller = createPdfShareController();
    await expect(controller.start(async () => Promise.reject(new Error('falló')))).rejects.toThrow('falló');
    expect(controller.isRunning()).toBe(false);
    expect(await controller.start(async () => 'listo')).toBe('listo');
  });
});

describe('orden y privacidad del flujo de compartir', () => {
  it('la cotización recibe número antes de crear o compartir el archivo', async () => {
    const withoutNumber = sampleQuote({ number: '' });
    const persist = vi.fn(async () => ({ ...withoutNumber, number: 'ED-2026-0002' }));
    const share = vi.fn(async (saved) => {
      expect(saved.number).toBe('ED-2026-0002');
      return { status: 'shared' as const };
    });
    await runClientPdfShareFlow({
      quote: withoutNumber,
      calc: calculateQuote(quoteToCalcInput(withoutNumber)),
      settings,
      confirmedSensitive: false,
      persist,
      share
    });
    expect(persist).toHaveBeenCalledBefore(share);
  });

  it('el detector sensible bloquea antes de guardar o compartir', async () => {
    const unsafe = sampleQuote({ pieceDescription: 'Anillo con costo interno' });
    const persist = vi.fn(async () => unsafe);
    const share = vi.fn(async () => ({ status: 'shared' as const }));
    const result = await runClientPdfShareFlow({
      quote: unsafe,
      calc: calculateQuote(quoteToCalcInput(unsafe)),
      settings,
      confirmedSensitive: false,
      persist,
      share
    });
    expect(result).toMatchObject({ status: 'sensitive' });
    expect(persist).not.toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();
  });

  it('cancelar el aviso sensible impide guardar, generar y compartir', async () => {
    const unsafe = sampleQuote({ clientNotes: 'Margen confidencial' });
    const persist = vi.fn(async () => unsafe);
    const share = vi.fn(async () => ({ status: 'shared' as const }));
    const result = await runClientPdfShareFlow({
      quote: unsafe,
      calc: calculateQuote(quoteToCalcInput(unsafe)),
      settings,
      confirmedSensitive: false,
      persist,
      share
    });
    expect(result.status).toBe('sensitive');
    expect(persist).not.toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();
  });

  it('confirmar el aviso sensible permite continuar conscientemente', async () => {
    const unsafe = sampleQuote({ clientNotes: 'Margen confidencial' });
    const persist = vi.fn(async () => unsafe);
    const share = vi.fn(async () => ({ status: 'shared' as const }));
    const result = await runClientPdfShareFlow({
      quote: unsafe,
      calc: calculateQuote(quoteToCalcInput(unsafe)),
      settings,
      confirmedSensitive: true,
      persist,
      share
    });
    expect(result).toEqual({ status: 'completed', result: { status: 'shared' } });
    expect(persist).toHaveBeenCalledOnce();
    expect(share).toHaveBeenCalledOnce();
  });

  it('la acción de compartir nunca selecciona el PDF interno', async () => {
    const share = vi.fn(async (_data: ShareData) => undefined);
    await shareClientPdf(quote, calc, settings, environment({ share }));
    const file = (share.mock.calls[0][0] as ShareData).files?.[0];
    expect(file?.name).toBe('Cotizacion-ED-2026-0001.pdf');
    expect(getClientPdfContent(quote, calc, settings).internal).toBe(false);
  });

  it('la acción nunca ofrece un respaldo JSON', async () => {
    const canShare = vi.fn((_data: ShareData) => true);
    const share = vi.fn(async (_data: ShareData) => undefined);
    await shareClientPdf(quote, calc, settings, environment({ canShare, share }));
    const data = canShare.mock.calls[0][0] as ShareData;
    expect(data.files).toHaveLength(1);
    expect(data.files?.[0].type).toBe('application/pdf');
    expect(data.files?.[0].name.endsWith('.json')).toBe(false);
  });
});
