// Reparto del MATERIAL entre socios (D-049 + D-073). A diferencia de las piedras
// y los gastos, el oro se comparte en GRAMOS, no en plata: lo que importa es
// cuántos gramos son de cada quien. El porcentaje se DERIVA solo para mostrarlo,
// y los gramos propios se DERIVAN del total menos lo declarado por los socios.

import { describe, expect, it } from 'vitest';
import type { MaterialLotPartner } from '../types';
import {
  materialPartnersFromLegacy,
  splitMaterialByGrams,
  validateMaterialPartners
} from './partnership';

function socio(overrides: Partial<MaterialLotPartner> = {}): MaterialLotPartner {
  return { id: 'p-1', partnerId: 'soc-1', partnerName: 'Socio Emerald', grams: 40, ...overrides };
}

describe('splitMaterialByGrams', () => {
  it('sin socios, el lote entero es suyo', () => {
    const split = splitMaterialByGrams({ totalGrams: 100, partners: [] });
    expect(split.shared).toBe(false);
    expect(split.myGrams).toBe(100);
    expect(split.myPercent).toBe(100);
    expect(split.partners).toEqual([]);
    expect(split.overDeclared).toBe(false);
  });

  it('con un socio, lo propio se deriva del total menos lo suyo', () => {
    const split = splitMaterialByGrams({ totalGrams: 100, partners: [socio({ grams: 40 })] });
    expect(split.shared).toBe(true);
    expect(split.myGrams).toBe(60);
    expect(split.myPercent).toBe(60);
    expect(split.partners[0].grams).toBe(40);
    expect(split.partners[0].percent).toBe(40);
  });

  it('reparte entre varios socios y deja el resto como propio', () => {
    const split = splitMaterialByGrams({
      totalGrams: 100,
      partners: [
        socio({ id: 'p-1', partnerId: 'soc-1', partnerName: 'Ana', grams: 30 }),
        socio({ id: 'p-2', partnerId: 'soc-2', partnerName: 'Beto', grams: 20 })
      ]
    });
    expect(split.myGrams).toBe(50);
    expect(split.myPercent).toBe(50);
    expect(split.partners.map((p) => p.percent)).toEqual([30, 20]);
    expect(split.partnersGrams).toBe(50);
  });

  it('avisa cuando los socios declaran más gramos de los que tiene el lote', () => {
    const split = splitMaterialByGrams({
      totalGrams: 100,
      partners: [
        socio({ id: 'p-1', partnerId: 'soc-1', partnerName: 'Ana', grams: 60 }),
        socio({ id: 'p-2', partnerId: 'soc-2', partnerName: 'Beto', grams: 60 })
      ]
    });
    expect(split.overDeclared).toBe(true);
    // Lo propio nunca queda negativo: el aviso es de la pantalla, no del número.
    expect(split.myGrams).toBe(0);
  });

  it('redondea los gramos a la milésima, que es la precisión del lote', () => {
    const split = splitMaterialByGrams({
      totalGrams: 10,
      partners: [socio({ grams: 3.33339 })]
    });
    expect(split.partners[0].grams).toBe(3.333);
    expect(split.myGrams).toBe(6.667);
  });

  it('ignora la fila vacía que deja el botón de añadir socio', () => {
    const split = splitMaterialByGrams({
      totalGrams: 100,
      partners: [socio({ id: 'p-1', partnerId: null, partnerName: '', grams: 0 })]
    });
    expect(split.shared).toBe(false);
    expect(split.myGrams).toBe(100);
  });

  it('un socio recién elegido, todavía sin gramos, ya cuenta como compartido', () => {
    const split = splitMaterialByGrams({
      totalGrams: 100,
      partners: [socio({ grams: 0 })]
    });
    expect(split.shared).toBe(true);
    expect(split.partners[0].percent).toBe(0);
    expect(split.myGrams).toBe(100);
  });
});

describe('validateMaterialPartners', () => {
  it('sin socios no hay nada que reclamar', () => {
    expect(validateMaterialPartners({ totalGrams: 100, partners: [] })).toBeNull();
  });

  it('un reparto que cabe en el lote es válido', () => {
    expect(
      validateMaterialPartners({ totalGrams: 100, partners: [socio({ grams: 40 })] })
    ).toBeNull();
  });

  it('exige decir quién es el socio', () => {
    expect(
      validateMaterialPartners({
        totalGrams: 100,
        partners: [socio({ partnerId: null, partnerName: '  ', grams: 10 })]
      })
    ).toBe('Falta decir quién es uno de los socios.');
  });

  it('exige los gramos de cada socio', () => {
    expect(
      validateMaterialPartners({
        totalGrams: 100,
        partners: [socio({ partnerName: 'Ana', grams: 0 })]
      })
    ).toBe('Escribe cuántos gramos son de Ana.');
  });

  it('no deja repetir a la misma persona', () => {
    expect(
      validateMaterialPartners({
        totalGrams: 100,
        partners: [socio({ id: 'p-1', partnerName: 'Ana' }), socio({ id: 'p-2', partnerName: 'Ana' })]
      })
    ).toBe('Ana está repetido.');
  });

  it('detecta el mismo nombre escrito con otras mayúsculas', () => {
    expect(
      validateMaterialPartners({
        totalGrams: 100,
        partners: [
          socio({ id: 'p-1', partnerId: null, partnerName: 'Ana', grams: 10 }),
          socio({ id: 'p-2', partnerId: null, partnerName: 'ANA', grams: 10 })
        ]
      })
    ).toBe('ANA está repetido.');
  });

  it('no deja que los socios se pasen del lote', () => {
    expect(
      validateMaterialPartners({
        totalGrams: 100,
        partners: [
          socio({ id: 'p-1', partnerId: 'soc-1', partnerName: 'Ana', grams: 60 }),
          socio({ id: 'p-2', partnerId: 'soc-2', partnerName: 'Beto', grams: 60 })
        ]
      })
    ).toBe('Los socios suman más gramos de los que tiene el lote.');
  });

  it('deja repartir el lote completo entre los socios, sin parte propia', () => {
    expect(
      validateMaterialPartners({ totalGrams: 100, partners: [socio({ grams: 100 })] })
    ).toBeNull();
  });
});

describe('materialPartnersFromLegacy', () => {
  it('un lote sin socio no estrena lista', () => {
    expect(
      materialPartnersFromLegacy({ partnerId: null, partnerName: '', myGrams: 100, grams: 100 })
    ).toEqual([]);
  });

  it('convierte el socio único en una lista de uno, con sus gramos', () => {
    const partners = materialPartnersFromLegacy({
      partnerId: 'soc-1',
      partnerName: 'Socio Emerald',
      myGrams: 60,
      grams: 100
    });
    expect(partners).toHaveLength(1);
    expect(partners[0].partnerId).toBe('soc-1');
    expect(partners[0].grams).toBe(40);
  });

  it('conserva al socio escrito a mano, sin ficha', () => {
    const partners = materialPartnersFromLegacy({
      partnerId: null,
      partnerName: 'Don Hernando',
      myGrams: 70,
      grams: 100
    });
    expect(partners).toHaveLength(1);
    expect(partners[0].partnerId).toBeNull();
    expect(partners[0].partnerName).toBe('Don Hernando');
    expect(partners[0].grams).toBe(30);
  });
});
