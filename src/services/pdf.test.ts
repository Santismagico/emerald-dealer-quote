import { describe, expect, it } from 'vitest';
import { calculateQuote, quoteToCalcInput } from '../calc/engine';
import { sampleQuote, sampleSettings } from '../test/fixtures';
import { createClientPdfBlob } from './pdf';

describe('PDF frente a textos hostiles', () => {
  it('genera el archivo con texto largo, saltos, controles, emoji y árabe sin colgarse', async () => {
    const quote = sampleQuote({
      pieceDescription: `${'Descripción extensa '.repeat(600)}\n\n\n\u0000\u0001 💎 مرحبا`,
      clientNotes: `${'Línea para cliente\n'.repeat(300)}✨ أهلاً وسهلاً`,
      images: []
    });
    const calc = calculateQuote(quoteToCalcInput(quote));

    const blob = await createClientPdfBlob(quote, calc, sampleSettings());

    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(1000);
  }, 10_000);
});
