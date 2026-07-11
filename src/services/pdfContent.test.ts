import { describe, it, expect } from 'vitest';
import {
  buildClientPdfContent,
  buildInternalPdfContent,
  contentToPlainText,
  findSensitiveWordsInClientText,
  findSensitiveWordsInText
} from './pdfContent';
import { calculateQuote, quoteToCalcInput } from '../calc/engine';
import { sampleQuote, sampleSettings } from '../test/fixtures';
import type { Quote, Settings } from '../types';

const quote = sampleQuote();
const settings = sampleSettings();
const calc = calculateQuote(quoteToCalcInput(quote));

function detectedInClientPdf(
  quoteOverrides: Partial<Quote> = {},
  settingsOverrides: Partial<Settings> = {}
): string[] {
  const candidateQuote = sampleQuote(quoteOverrides);
  const candidateSettings = sampleSettings(settingsOverrides);
  const candidateCalc = calculateQuote(quoteToCalcInput(candidateQuote));
  return findSensitiveWordsInClientText(candidateQuote, candidateCalc, candidateSettings);
}

describe('detector de información sensible', () => {
  it.each([
    ['costo', 'costo'],
    ['costos', 'costo'],
    ['margen', 'margen'],
    ['utilidad', 'utilidad'],
    ['ganancia', 'ganancia'],
    ['precio por gramo', 'precio por gramo'],
    ['$/g', '$/g'],
    ['18K', '18K'],
    ['24K', '24K'],
    ['interno', 'interno']
  ])('detecta el término individual "%s"', (text, label) => {
    expect(findSensitiveWordsInText(text)).toEqual([label]);
  });

  it.each([
    ['COSTO', 'costo'],
    ['CoStOs', 'costo'],
    ['MARGEN', 'margen'],
    ['UTILIDAD', 'utilidad'],
    ['GaNaNcIaS', 'ganancia'],
    ['PRECIO POR GRAMO', 'precio por gramo'],
    ['$ / G', '$/g'],
    ['INTERNA', 'interno']
  ])('ignora mayúsculas y minúsculas en "%s"', (text, label) => {
    expect(findSensitiveWordsInText(text)).toContain(label);
  });

  it.each([
    ['cósto', 'costo'],
    ['MÁRGENES', 'margen'],
    ['FÓRMULA del oro', 'fórmula']
  ])('ignora tildes en "%s"', (text, label) => {
    expect(findSensitiveWordsInText(text)).toContain(label);
  });

  it.each([
    ['18K', '18K'],
    ['18 k', '18K'],
    ['18 kilates', '18K'],
    ['18 quilates', '18K'],
    ['18 kt', '18K'],
    ['24K', '24K'],
    ['24 k', '24K'],
    ['24 kilates', '24K'],
    ['24 quilates', '24K'],
    ['24 kt', '24K']
  ])('detecta la variante de pureza "%s"', (text, label) => {
    expect(findSensitiveWordsInText(text)).toContain(label);
  });

  it.each([
    ['precio por gramo', 'precio por gramo'],
    ['precio-por-gramo', 'precio por gramo'],
    ['valor por gramo', 'precio por gramo'],
    ['precio del gramo', 'precio por gramo'],
    ['$/g', '$/g'],
    ['$ / gramo', '$/g'],
    ['COP/g', '$/g']
  ])('detecta la referencia unitaria "%s"', (text, label) => {
    expect(findSensitiveWordsInText(text)).toContain(label);
  });

  it.each([
    ['coste', 'costo'],
    ['costes', 'costo'],
    ['rentabilidad', 'rentabilidad'],
    ['pureza', 'pureza'],
    ['fórmula', 'fórmula'],
    ['confidencial', 'confidencial'],
    ['markup', 'markup'],
    ['mark-up', 'markup'],
    ['mark up', 'markup']
  ])('detecta el equivalente confidencial "%s"', (text, label) => {
    expect(findSensitiveWordsInText(text)).toContain(label);
  });

  it('detecta términos en la descripción de la pieza', () => {
    expect(detectedInClientPdf({ pieceDescription: 'Anillo con costo interno revisado' })).toEqual(
      expect.arrayContaining(['costo', 'interno'])
    );
  });

  it('detecta términos en las observaciones para el cliente', () => {
    expect(detectedInClientPdf({ clientNotes: 'Margen reservado para la joyería' })).toContain('margen');
  });

  it('detecta términos en la descripción comercial de las piedras', () => {
    const stone = sampleQuote().stones[0];
    expect(
      detectedInClientPdf({ stones: [{ ...stone, quality: 'Pureza con fórmula confidencial' }] })
    ).toEqual(expect.arrayContaining(['pureza', 'fórmula', 'confidencial']));
  });

  it('detecta términos en las condiciones configurables', () => {
    expect(detectedInClientPdf({}, { conditions: 'El precio por gramo es confidencial.' })).toEqual(
      expect.arrayContaining(['precio por gramo', 'confidencial'])
    );
  });

  it('detecta términos en el mensaje comercial', () => {
    expect(detectedInClientPdf({}, { commercialMessage: 'La rentabilidad incluye markup.' })).toEqual(
      expect.arrayContaining(['rentabilidad', 'markup'])
    );
  });

  it('detecta términos en el material visible al cliente', () => {
    expect(detectedInClientPdf({ material: 'Oro amarillo 18K' })).toContain('18K');
  });

  it('detecta términos en otros textos dinámicos del PDF cliente', () => {
    const unsafeClient = { ...sampleQuote().clientSnapshot!, name: 'Cliente Costo Interno' };
    expect(
      detectedInClientPdf(
        { clientSnapshot: unsafeClient },
        { jewelryName: 'Joyas Margen', address: 'Calle Fórmula Confidencial' }
      )
    ).toEqual(expect.arrayContaining(['costo', 'interno', 'margen', 'fórmula', 'confidencial']));
  });

  it('no activa falsas alarmas con textos comerciales normales', () => {
    const normalText = [
      'Valor total de la cotización',
      'Pieza costosa de uso cotidiano',
      'Colección internacional de diseño utilitario',
      'Régimen ganancial',
      '18 kg de material',
      '24 kilómetros',
      '$/galón',
      'Oro amarillo con esmeralda'
    ].join('\n');

    expect(findSensitiveWordsInText(normalText)).toEqual([]);
  });

  it('una cotización limpia no produce advertencia', () => {
    expect(detectedInClientPdf()).toEqual([]);
  });

  it('devuelve varias palabras sensibles sin duplicarlas', () => {
    const found = findSensitiveWordsInText(
      'Costo y COSTOS; márgenes, utilidad, GANANCIAS, 18 k, $/g y uso interno.'
    );

    expect(found).toEqual(
      expect.arrayContaining(['costo', 'margen', 'utilidad', 'ganancia', '$/g', '18K', 'interno'])
    );
    expect(new Set(found).size).toBe(found.length);
  });

  it('no incorpora ni analiza como cliente los campos exclusivamente internos', () => {
    const baseQuote = sampleQuote();
    const internalOnlyQuote = sampleQuote({
      internalNotes: 'SENTINELA_NOTA_INTERNA costo margen utilidad',
      stones: [
        {
          ...baseQuote.stones[0],
          notes: 'SENTINELA_PIEDRA_INTERNA precio por gramo 24K'
        }
      ],
      payments: [
        {
          ...baseQuote.payments[0],
          notes: 'SENTINELA_ABONO_INTERNO ganancia'
        }
      ],
      production: [
        {
          ...baseQuote.production[0],
          notes: 'SENTINELA_PRODUCCION_INTERNA confidencial'
        }
      ]
    });
    const internalOnlySettings = sampleSettings({
      goldPriceNote: 'SENTINELA_ORO_INTERNA fórmula 24K'
    });
    const internalOnlyCalc = calculateQuote(quoteToCalcInput(internalOnlyQuote));
    const clientText = contentToPlainText(
      buildClientPdfContent(internalOnlyQuote, internalOnlyCalc, internalOnlySettings)
    );
    const internalText = contentToPlainText(
      buildInternalPdfContent(internalOnlyQuote, internalOnlyCalc, internalOnlySettings)
    );

    expect(findSensitiveWordsInText(clientText)).toEqual([]);
    for (const sentinel of [
      'SENTINELA_NOTA_INTERNA',
      'SENTINELA_PIEDRA_INTERNA',
      'SENTINELA_ABONO_INTERNO',
      'SENTINELA_PRODUCCION_INTERNA',
      'SENTINELA_ORO_INTERNA'
    ]) {
      expect(clientText).not.toContain(sentinel);
      expect(internalText).toContain(sentinel);
    }
  });
});

// Palabras que JAMÁS pueden aparecer en el documento del cliente.
const FORBIDDEN_FOR_CLIENT = [
  'margen',
  'ganancia',
  'utilidad',
  'costo interno',
  'costo base',
  'costo real',
  'fórmula',
  'formula',
  '24k',
  '18k',
  'pureza',
  'confidencial',
  'interno'
];

describe('PDF del cliente: privacidad', () => {
  const text = contentToPlainText(buildClientPdfContent(quote, calc, settings)).toLowerCase();

  it.each(FORBIDDEN_FOR_CLIENT)('no contiene la palabra sensible "%s"', (word) => {
    expect(text).not.toContain(word);
  });

  it('no contiene el precio por gramo del material', () => {
    expect(text).not.toContain('550.000');
    expect(text).not.toContain('por gramo');
  });

  it('no contiene las observaciones internas', () => {
    expect(text).not.toContain('proveedor');
    expect(text).not.toContain(quote.internalNotes.toLowerCase().slice(0, 20));
  });

  it('no contiene el desglose interno de costos', () => {
    expect(text).not.toContain('mano de obra');
    expect(text).not.toContain('subtotal material');
  });

  it('no contiene las notas internas de las piedras', () => {
    expect(text).not.toContain('muzo');
    expect(text).not.toContain('lote 12');
  });

  it('no contiene el seguimiento de producción del taller', () => {
    expect(text).not.toContain('producción');
    expect(text).not.toContain('fundición');
    expect(text).not.toContain('taller ramírez');
    expect(text).not.toContain('pagó');
  });

  it('no contiene los abonos internos ni quién los recibió', () => {
    expect(text).not.toContain('abono');
    expect(text).not.toContain('laura');
    expect(text).not.toContain('transferencia');
    expect(text).not.toContain('recibió');
  });
});

describe('PDF del cliente: contenido esperado', () => {
  const content = buildClientPdfContent(quote, calc, settings);
  const text = contentToPlainText(content);

  it('incluye la marca, el número y la fecha', () => {
    expect(text).toContain('Emerald Dealer');
    expect(text).toContain('ED-2026-0001');
    expect(text).toContain('2026');
  });

  it('incluye los datos del cliente', () => {
    expect(text).toContain('María Gómez');
  });

  it('incluye el total, anticipo y saldo formateados en COP', () => {
    expect(text).toContain('VALOR TOTAL');
    expect(text.replace(/ /g, ' ')).toContain('Anticipo');
    expect(text).toContain('Saldo pendiente');
  });

  it('describe las piedras de forma comercial', () => {
    expect(text).toContain('Esmeralda');
    expect(text).toContain('1.2 ct');
  });

  it('incluye vigencia y condiciones', () => {
    expect(text).toContain('válida hasta');
    expect(text).toContain(settings.conditions.slice(0, 30));
  });

  it('incluye las observaciones visibles para el cliente', () => {
    expect(text).toContain('Incluye estuche de lujo.');
  });
});

describe('documento interno', () => {
  const text = contentToPlainText(buildInternalPdfContent(quote, calc, settings));

  it('incluye el desglose completo de costos', () => {
    expect(text).toContain('Subtotal material');
    expect(text).toContain('Mano de obra');
    expect(text).toContain('Margen');
    expect(text).toContain('Costo base');
  });

  it('incluye las notas internas y la nota del oro', () => {
    expect(text).toContain('proveedor');
    expect(text).toContain('24K');
  });

  it('incluye los abonos con quién los recibió y el saldo real', () => {
    expect(text).toContain('Abonos recibidos (interno)');
    expect(text).toContain('1.000.000 el 5 de julio de 2026 — recibió Laura (Transferencia)');
    expect(text).toContain('Total abonado');
    expect(text).toContain('Saldo real');
  });

  it('incluye el seguimiento de producción con estados y pagos', () => {
    expect(text).toContain('Fundición: lista el 6 de julio de 2026');
    expect(text).toContain('300.000 pagado el 6 de julio de 2026 a Taller Ramírez (pagó Santiago)');
    expect(text).toContain('Pulido: en proceso');
    expect(text).toContain('120.000 por pagar');
  });

  it('está marcado como documento interno', () => {
    expect(text).toContain('NO ENTREGAR AL CLIENTE');
  });

  it('el flag internal distingue ambos documentos', () => {
    expect(buildInternalPdfContent(quote, calc, settings).internal).toBe(true);
    expect(buildClientPdfContent(quote, calc, settings).internal).toBe(false);
  });
});
