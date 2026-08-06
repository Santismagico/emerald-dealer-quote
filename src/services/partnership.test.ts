import { describe, expect, it } from 'vitest';
import type { LotPartner } from '../types';
import {
  activePartners,
  partnerPercent,
  partnersFromLegacy,
  splitByContribution
} from './partnership';

function socio(overrides: Partial<LotPartner> = {}): LotPartner {
  return { id: 's-1', partnerId: 'p-1', partnerName: 'Ana', amountCop: 0, ...overrides };
}

describe('splitByContribution — la suma siempre cuadra al peso', () => {
  it('sin socios, todo el resultado es de Santiago', () => {
    const split = splitByContribution({ totalCostCop: 1_000_000, realResultCop: 300_000 });
    expect(split.shared).toBe(false);
    expect(split.myContributionCop).toBe(1_000_000);
    expect(split.myResultCop).toBe(300_000);
    expect(split.partnersResultCop).toBe(0);
  });

  it('reparte en proporción a la plata que puso cada uno', () => {
    const split = splitByContribution({
      totalCostCop: 10_000_000,
      realResultCop: 2_000_000,
      partners: [
        socio({ id: 's-1', partnerName: 'Ana', amountCop: 3_000_000 }),
        socio({ id: 's-2', partnerId: 'p-2', partnerName: 'Luis', amountCop: 2_000_000 })
      ]
    });
    expect(split.equityBaseCop).toBe(10_000_000);
    expect(split.myContributionCop).toBe(5_000_000);
    expect(split.partners[0].resultCop).toBe(600_000);
    expect(split.partners[1].resultCop).toBe(400_000);
    expect(split.myResultCop).toBe(1_000_000);
  });

  it('(a) tres socios con montos que no dividen exacto: no se pierde un solo peso', () => {
    const partners = [
      socio({ id: 's-1', partnerId: 'p-1', partnerName: 'Ana', amountCop: 1_000_000 }),
      socio({ id: 's-2', partnerId: 'p-2', partnerName: 'Luis', amountCop: 1_000_000 }),
      socio({ id: 's-3', partnerId: 'p-3', partnerName: 'Sara', amountCop: 1_000_000 })
    ];
    const split = splitByContribution({
      totalCostCop: 3_000_000,
      realResultCop: 100,
      partners
    });
    // 100 entre tres partes iguales: cada socio 33 truncado, el peso sobrante a Santiago.
    expect(split.partners.map((partner) => partner.resultCop)).toEqual([33, 33, 33]);
    expect(split.myContributionCop).toBe(0);
    expect(split.myResultCop).toBe(1);
    expect(split.partnersResultCop + split.myResultCop).toBe(split.realResultCop);
  });

  it('en pérdida el residuo también queda de su lado: pierde un peso más, no uno menos', () => {
    const partners = [
      socio({ id: 's-1', partnerId: 'p-1', partnerName: 'Ana', amountCop: 1_000_000 }),
      socio({ id: 's-2', partnerId: 'p-2', partnerName: 'Luis', amountCop: 1_000_000 }),
      socio({ id: 's-3', partnerId: 'p-3', partnerName: 'Sara', amountCop: 1_000_000 })
    ];
    const split = splitByContribution({
      totalCostCop: 3_000_000,
      realResultCop: -100,
      partners
    });
    expect(split.partners.map((partner) => partner.resultCop)).toEqual([-33, -33, -33]);
    expect(split.myResultCop).toBe(-1);
    expect(split.partnersResultCop + split.myResultCop).toBe(-100);
  });
});

describe('la plata del fondo no compra participación (D-072)', () => {
  it('(b) lote que GANA: el socio recibe su proporción sin descontar el financiamiento', () => {
    // 10 millones: 4 del fondo, 3 del socio, 3 de Santiago.
    const split = splitByContribution({
      totalCostCop: 10_000_000,
      realResultCop: 3_000_000,
      partners: [socio({ partnerName: 'Ana', amountCop: 3_000_000 })],
      fundedFromFundCop: 4_000_000
    });
    // La base excluye el fondo: 6 millones, mitad y mitad.
    expect(split.equityBaseCop).toBe(6_000_000);
    expect(split.myContributionCop).toBe(3_000_000);
    expect(split.partners[0].resultCop).toBe(1_500_000);
    expect(split.myResultCop).toBe(1_500_000);
  });

  it('el fondo NO diluye al socio: sin fondo y con fondo, su parte es la misma', () => {
    const conFondo = splitByContribution({
      totalCostCop: 10_000_000,
      realResultCop: 3_000_000,
      partners: [socio({ partnerName: 'Ana', amountCop: 3_000_000 })],
      fundedFromFundCop: 4_000_000
    });
    const sinFondo = splitByContribution({
      totalCostCop: 6_000_000,
      realResultCop: 3_000_000,
      partners: [socio({ partnerName: 'Ana', amountCop: 3_000_000 })]
    });
    expect(conFondo.partners[0].resultCop).toBe(sinFondo.partners[0].resultCop);
  });

  it('(c) lote que PIERDE: el socio queda en negativo y Santiago igual de negativo aquí; el financiamiento se le resta después', () => {
    // Esta prueba existe para proteger D-075. El motor de reparto NO descuenta el
    // rendimiento del fondo: eso ocurre a nivel de negocio y solo del lado de
    // Santiago. Si alguien "arregla" esto restando el financiamiento aquí, el
    // socio pagaría un préstamo que no pidió.
    const split = splitByContribution({
      totalCostCop: 10_000_000,
      realResultCop: -500_000,
      partners: [socio({ partnerName: 'Ana', amountCop: 3_000_000 })],
      fundedFromFundCop: 4_000_000
    });
    expect(split.partners[0].resultCop).toBe(-250_000);
    expect(split.myResultCop).toBe(-250_000);
    // El costo del financiamiento NO está aquí, a propósito.
    expect(split.partnersResultCop + split.myResultCop).toBe(-500_000);
  });

  it('lote financiado por completo con el fondo y sin socios: todo el resultado es suyo', () => {
    const split = splitByContribution({
      totalCostCop: 5_000_000,
      realResultCop: 800_000,
      fundedFromFundCop: 5_000_000
    });
    expect(split.equityBaseCop).toBe(0);
    expect(split.myResultCop).toBe(800_000);
  });
});

describe('datos mal declarados no revientan el cálculo', () => {
  it('si los socios declaran más plata de la que costó, se marca y se reparte igual', () => {
    const split = splitByContribution({
      totalCostCop: 1_000_000,
      realResultCop: 200_000,
      partners: [
        socio({ id: 's-1', partnerName: 'Ana', amountCop: 800_000 }),
        socio({ id: 's-2', partnerId: 'p-2', partnerName: 'Luis', amountCop: 800_000 })
      ]
    });
    expect(split.overDeclared).toBe(true);
    expect(split.myContributionCop).toBe(0);
    expect(split.partnersResultCop + split.myResultCop).toBe(200_000);
  });

  it('montos negativos o no numéricos se tratan como cero', () => {
    const split = splitByContribution({
      totalCostCop: 1_000_000,
      realResultCop: 100_000,
      partners: [socio({ partnerName: 'Ana', amountCop: -5_000 })]
    });
    expect(split.partners[0].amountCop).toBe(0);
    expect(split.myResultCop).toBe(100_000);
  });
});

describe('porcentaje derivado, solo para mostrar', () => {
  it('deriva el porcentaje de cada socio sobre la base de patrimonio', () => {
    const split = splitByContribution({
      totalCostCop: 10_000_000,
      realResultCop: 0,
      partners: [socio({ partnerName: 'Ana', amountCop: 3_000_000 })],
      fundedFromFundCop: 4_000_000
    });
    expect(partnerPercent(split, 3_000_000)).toBe(50);
  });
});

describe('(d) un registro viejo se lee sin romperse', () => {
  it('convierte el socio único con myPercent en la lista nueva', () => {
    const partners = partnersFromLegacy({
      partnerId: 'p-1',
      partnerName: 'Ana',
      myPercent: 70,
      totalCostCop: 10_000_000
    });
    expect(partners).toHaveLength(1);
    expect(partners[0].amountCop).toBe(3_000_000);

    const split = splitByContribution({
      totalCostCop: 10_000_000,
      realResultCop: 1_000_000,
      partners
    });
    expect(split.partners[0].resultCop).toBe(300_000);
    expect(split.myResultCop).toBe(700_000);
  });

  it('un lote sin socio queda sin lista', () => {
    expect(
      partnersFromLegacy({ partnerId: null, partnerName: '  ', myPercent: 100, totalCostCop: 5_000_000 })
    ).toEqual([]);
  });
});

describe('activePartners', () => {
  it('descarta filas vacías dejadas por la pantalla', () => {
    const partners = activePartners([
      socio({ id: 's-1', partnerId: null, partnerName: '   ', amountCop: 0 }),
      socio({ id: 's-2', partnerName: 'Ana', amountCop: 1_000 })
    ]);
    expect(partners).toHaveLength(1);
    expect(partners[0].partnerName).toBe('Ana');
  });
});
