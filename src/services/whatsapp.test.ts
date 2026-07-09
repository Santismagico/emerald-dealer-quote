import { describe, it, expect } from 'vitest';
import { buildWhatsAppMessage, whatsAppLink } from './whatsapp';
import { calculateQuote, quoteToCalcInput } from '../calc/engine';
import { sampleQuote, sampleSettings } from '../test/fixtures';

const quote = sampleQuote();
const settings = sampleSettings();
const calc = calculateQuote(quoteToCalcInput(quote));

describe('mensaje de WhatsApp', () => {
  const message = buildWhatsAppMessage(quote, calc, settings);

  it('saluda al cliente por su nombre', () => {
    expect(message).toContain('Hola María Gómez');
  });

  it('incluye número, total y vigencia', () => {
    expect(message).toContain('ED-2026-0001');
    expect(message.replace(/ /g, ' ')).toContain('Valor total');
    expect(message).toContain('Válida hasta');
  });

  it('menciona el envío del PDF', () => {
    expect(message.toLowerCase()).toContain('pdf');
  });

  it('no contiene datos internos', () => {
    const lower = message.toLowerCase();
    for (const word of ['margen', 'utilidad', 'ganancia', 'costo', 'fórmula', '24k', 'gramo']) {
      expect(lower).not.toContain(word);
    }
  });

  it('saluda genérico si no hay cliente', () => {
    const anon = buildWhatsAppMessage(sampleQuote({ clientSnapshot: null }), calc, settings);
    expect(anon.startsWith('Hola,')).toBe(true);
  });
});

describe('enlace de WhatsApp', () => {
  it('usa el teléfono del cliente si existe', () => {
    const link = whatsAppLink('hola', '300 123-4567');
    expect(link).toBe(`https://wa.me/3001234567?text=${encodeURIComponent('hola')}`);
  });

  it('funciona sin teléfono', () => {
    expect(whatsAppLink('hola')).toBe(`https://wa.me/?text=${encodeURIComponent('hola')}`);
  });
});
