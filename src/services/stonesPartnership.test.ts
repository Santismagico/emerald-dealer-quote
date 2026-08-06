// El caso completo de D-072 / D-073 / D-075 sobre un lote de verdad.
//
// La prueba que más importa aquí es la del lote que PIERDE: el socio de igualdad
// queda en negativo, y Santiago queda MÁS negativo todavía porque el rendimiento
// del fondo lo asume él solo. Si alguien "arregla" eso descontando el
// financiamiento antes de repartir, el socio pagaría un préstamo que no pidió.

import { describe, expect, it } from 'vitest';
import type { LotPartner, StoneLot, StoneSale } from '../types';
import { financingCostForOwner } from './fund';
import { stoneLotPartners, summarizeStoneLotSplit, summarizeStonePartnership } from './stones';

function venta(overrides: Partial<StoneSale> = {}): StoneSale {
  return {
    id: 'v-1',
    date: '2026-07-15',
    buyer: 'Comprador Ejemplo',
    carats: 5,
    quantity: 4,
    origin: 'bruto',
    valueCop: 13_000_000,
    productType: 'Esmeralda en bruto',
    usdRate: 4000,
    buyerId: null,
    onCredit: false,
    dueDate: '',
    payments: [],
    method: 'Efectivo',
    receivedBy: 'Santiago',
    notes: '',
    ...overrides
  };
}

function socio(overrides: Partial<LotPartner> = {}): LotPartner {
  return { id: 's-1', partnerId: 'p-1', partnerName: 'Ana', amountCop: 3_000_000, ...overrides };
}

/** Lote de 10 millones: 4 del fondo, 3 del socio, 3 de Santiago. */
function lote(overrides: Partial<StoneLot> = {}): StoneLot {
  return {
    id: 'l-1',
    name: 'Lote Ejemplo 12',
    stoneType: 'Esmeralda',
    description: '',
    purchaseDate: '2026-01-15',
    supplier: 'Proveedor Ejemplo',
    supplierId: null,
    carats: 5,
    quantity: 4,
    purchaseValueCop: 10_000_000,
    partnerId: null,
    partnerName: '',
    myPercent: 100,
    partners: [socio()],
    fundedFromFundCop: 4_000_000,
    onCredit: false,
    supplierPayments: [],
    cuttingBatches: [],
    internalUses: [],
    notes: '',
    sales: [],
    createdAt: '2026-01-15T09:00:00.000Z',
    updatedAt: '2026-01-15T09:00:00.000Z',
    ...overrides
  };
}

describe('(b) el lote GANA', () => {
  it('el socio recibe su proporción completa, sin descontar el financiamiento', () => {
    const split = summarizeStoneLotSplit(lote({ sales: [venta({ valueCop: 13_000_000 })] }));
    expect(split.realResultCop).toBe(3_000_000);
    expect(split.equityBaseCop).toBe(6_000_000); // 10 − 4 del fondo
    expect(split.myContributionCop).toBe(3_000_000);
    expect(split.partners[0].partnerName).toBe('Ana');
    expect(split.partners[0].resultCop).toBe(1_500_000);
    expect(split.myResultCop).toBe(1_500_000);
  });

  it('el financiamiento sale DESPUÉS y solo de la parte de Santiago (D-075)', () => {
    const split = summarizeStoneLotSplit(lote({ sales: [venta({ valueCop: 13_000_000 })] }));
    const aportes = [
      {
        id: 'a-1',
        personId: 'q-1',
        personName: 'Luis',
        date: '2026-01-15',
        amountCop: 4_000_000,
        returnKind: 'mensual' as const,
        monthlyRatePercent: 2,
        agreedTotalCop: null,
        dueDate: '',
        payments: [],
        notes: '',
        createdAt: '2026-01-15T00:00:00.000Z',
        updatedAt: '2026-01-15T00:00:00.000Z'
      }
    ];
    const financiamiento = financingCostForOwner(aportes, '2026-04-15'); // 3 meses × 2 %
    expect(financiamiento).toBe(240_000);

    expect(split.partners[0].resultCop).toBe(1_500_000); // el socio no lo paga
    expect(split.myResultCop - financiamiento).toBe(1_260_000); // Santiago sí
  });
});

describe('(c) el lote PIERDE — la prueba que protege D-075', () => {
  it('el socio queda en negativo y Santiago MÁS negativo todavía', () => {
    const split = summarizeStoneLotSplit(lote({ sales: [venta({ valueCop: 9_500_000 })] }));
    expect(split.realResultCop).toBe(-500_000);
    expect(split.partners[0].resultCop).toBe(-250_000);
    expect(split.myResultCop).toBe(-250_000);

    const financiamiento = 240_000;
    const suyoDespues = split.myResultCop - financiamiento;
    expect(suyoDespues).toBe(-490_000);

    // Esto es lo correcto, no un error: él tomó el riesgo de conseguir la plata.
    expect(suyoDespues).toBeLessThan(split.partners[0].resultCop);
  });

  it('la suma de las partes es exactamente el resultado real, sin el financiamiento', () => {
    const split = summarizeStoneLotSplit(lote({ sales: [venta({ valueCop: 9_500_000 })] }));
    expect(split.partnersResultCop + split.myResultCop).toBe(split.realResultCop);
  });
});

describe('el fondo no diluye al socio (D-072)', () => {
  it('su parte es la misma con fondo que sin él', () => {
    const conFondo = summarizeStoneLotSplit(
      lote({ sales: [venta({ valueCop: 13_000_000 })] })
    );
    const sinFondo = summarizeStoneLotSplit(
      lote({
        purchaseValueCop: 6_000_000,
        fundedFromFundCop: 0,
        sales: [venta({ valueCop: 9_000_000 })]
      })
    );
    expect(conFondo.realResultCop).toBe(sinFondo.realResultCop);
    expect(conFondo.partners[0].resultCop).toBe(sinFondo.partners[0].resultCop);
  });
});

describe('(d) un lote guardado con el modelo anterior se lee sin romperse', () => {
  it('convierte el socio único con myPercent y reparte igual que antes', () => {
    const viejo = lote({
      partners: undefined,
      fundedFromFundCop: undefined,
      purchaseValueCop: 10_000_000,
      partnerId: 'p-9',
      partnerName: 'Socio Viejo',
      myPercent: 70,
      sales: [venta({ valueCop: 11_000_000 })]
    });
    const partners = stoneLotPartners(viejo);
    expect(partners).toHaveLength(1);
    expect(partners[0].amountCop).toBe(3_000_000);

    const resumen = summarizeStonePartnership(viejo);
    expect(resumen.shared).toBe(true);
    expect(resumen.realResult).toBe(1_000_000);
    expect(resumen.partnerResult).toBe(300_000);
    expect(resumen.myResult).toBe(700_000);
  });

  it('un lote propio de siempre sigue siendo todo suyo', () => {
    const propio = lote({ partners: undefined, fundedFromFundCop: undefined, sales: [venta()] });
    const resumen = summarizeStonePartnership(propio);
    expect(resumen.shared).toBe(false);
    expect(resumen.myResult).toBe(resumen.realResult);
    expect(resumen.partnerResult).toBe(0);
  });
});

describe('varios socios en un mismo lote — lo que Santiago pidió', () => {
  it('cinco socios quedan discriminados uno por uno y la suma cuadra', () => {
    const cinco = lote({
      purchaseValueCop: 15_000_000,
      fundedFromFundCop: 0,
      partners: [
        socio({ id: 's-1', partnerId: 'p-1', partnerName: 'Ana', amountCop: 1_000_000 }),
        socio({ id: 's-2', partnerId: 'p-2', partnerName: 'Luis', amountCop: 3_000_000 }),
        socio({ id: 's-3', partnerId: 'p-3', partnerName: 'Sara', amountCop: 5_000_000 }),
        socio({ id: 's-4', partnerId: 'p-4', partnerName: 'Pedro', amountCop: 2_000_000 }),
        socio({ id: 's-5', partnerId: 'p-5', partnerName: 'Marta', amountCop: 1_000_000 })
      ],
      sales: [venta({ valueCop: 18_000_000 })]
    });
    const split = summarizeStoneLotSplit(cinco);

    expect(split.partners).toHaveLength(5);
    expect(split.myContributionCop).toBe(3_000_000);
    expect(split.realResultCop).toBe(3_000_000);
    // Cada uno recibe en proporción a lo suyo, sobre una base de 15 millones.
    expect(split.partners.map((p) => p.resultCop)).toEqual([
      200_000,
      600_000,
      1_000_000,
      400_000,
      200_000
    ]);
    expect(split.myResultCop).toBe(600_000);
    expect(split.partnersResultCop + split.myResultCop).toBe(3_000_000);
  });
});
