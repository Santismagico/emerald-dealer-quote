import { describe, it, expect } from 'vitest';
import { buildWhatsAppMessage, whatsAppLink } from './whatsapp';
import { findSensitiveWordsInText } from './pdfContent';
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

  it('detecta información sensible en la descripción del mensaje real', () => {
    const unsafeQuote = sampleQuote({ pieceDescription: 'Anillo con costo interno' });
    const unsafeMessage = buildWhatsAppMessage(
      unsafeQuote,
      calculateQuote(quoteToCalcInput(unsafeQuote)),
      settings
    );

    expect(findSensitiveWordsInText(unsafeMessage)).toEqual(expect.arrayContaining(['costo', 'interno']));
  });

  it('detecta información sensible en material, joyería y cliente del mensaje real', () => {
    const unsafeQuote = sampleQuote({
      material: 'Oro 18K',
      clientSnapshot: { ...sampleQuote().clientSnapshot!, name: 'Cliente Confidencial' }
    });
    const unsafeMessage = buildWhatsAppMessage(
      unsafeQuote,
      calculateQuote(quoteToCalcInput(unsafeQuote)),
      sampleSettings({ jewelryName: 'Joyas Margen' })
    );

    expect(findSensitiveWordsInText(unsafeMessage)).toEqual(
      expect.arrayContaining(['18K', 'confidencial', 'margen'])
    );
  });

  it('no alerta por condiciones o pie comercial que WhatsApp no envía', () => {
    const cleanMessage = buildWhatsAppMessage(
      quote,
      calc,
      sampleSettings({
        conditions: 'Costo interno por gramo.',
        commercialMessage: 'Margen confidencial.'
      })
    );

    expect(findSensitiveWordsInText(cleanMessage)).toEqual([]);
  });
});

describe('enlace de WhatsApp', () => {
  it('agrega el prefijo 57 a celulares colombianos de 10 dígitos', () => {
    const link = whatsAppLink('hola', '300 123-4567');
    expect(link).toBe(`https://wa.me/573001234567?text=${encodeURIComponent('hola')}`);
  });

  it('respeta números que ya traen indicativo internacional', () => {
    const link = whatsAppLink('hola', '+57 300 123 4567');
    expect(link).toBe(`https://wa.me/573001234567?text=${encodeURIComponent('hola')}`);
  });

  it('no toca números que no parecen celular colombiano', () => {
    const link = whatsAppLink('hola', '16035550100');
    expect(link).toBe(`https://wa.me/16035550100?text=${encodeURIComponent('hola')}`);
  });

  it('agrega el prefijo 57 a fijos colombianos (60x) para no enrutar a Malasia', () => {
    const link = whatsAppLink('hola', '601 555 1234');
    expect(link).toBe(`https://wa.me/576015551234?text=${encodeURIComponent('hola')}`);
  });

  it('ignora ceros iniciales antes de normalizar', () => {
    const link = whatsAppLink('hola', '0300 123 4567');
    expect(link).toBe(`https://wa.me/573001234567?text=${encodeURIComponent('hola')}`);
  });

  it('funciona sin teléfono', () => {
    expect(whatsAppLink('hola')).toBe(`https://wa.me/?text=${encodeURIComponent('hola')}`);
  });
});
