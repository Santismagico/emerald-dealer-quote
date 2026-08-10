import { describe, expect, it } from 'vitest';
import type { MaterialLot, MaterialUse } from '../types';
import {
  compareMaterialLots,
  countMaterialLots,
  emptyMaterialLot,
  emptyMaterialUse,
  filterMaterialLots,
  materialLotDisplayName,
  materialsByPartner,
  materialsFlow,
  materialsInventory,
  summarizeMaterialLot,
  validateMaterialLot,
  validateMaterialUse,
  withMaterialUse,
  withoutMaterialUse
} from './materials';

function uso(overrides: Partial<MaterialUse> = {}): MaterialUse {
  return { id: 'u-1', date: '2026-07-20', grams: 10, notes: '', ...overrides };
}

function lote(overrides: Partial<MaterialLot> = {}): MaterialLot {
  return {
    id: 'l-1',
    name: '',
    materialType: 'Oro',
    purity: '18K',
    purchaseDate: '2026-07-10',
    grams: 100,
    costCop: 20000000,
    partnerId: null,
    partnerName: '',
    myGrams: 100,
    notes: '',
    uses: [],
    createdAt: '2026-07-10T09:00:00.000Z',
    updatedAt: '2026-07-10T09:00:00.000Z',
    ...overrides
  };
}

/** Lote compartido: 100 g, 60 míos y 40 del socio. */
function compartido(overrides: Partial<MaterialLot> = {}): MaterialLot {
  return lote({
    partnerId: 'soc-1',
    partnerName: 'Socio Emerald',
    myGrams: 60,
    ...overrides
  });
}

describe('resumen de un lote de material', () => {
  it('un lote sin socio es 100% suyo', () => {
    const s = summarizeMaterialLot(lote());
    expect(s.shared).toBe(false);
    expect(s.myPercent).toBe(100);
    expect(s.remainingGrams).toBe(100);
    expect(s.myRemainingGrams).toBe(100);
    expect(s.partnerRemainingGrams).toBe(0);
  });

  it('descuenta las salidas del restante', () => {
    const s = summarizeMaterialLot(lote({ uses: [uso({ grams: 30 }), uso({ id: 'u-2', grams: 20 })] }));
    expect(s.usedGrams).toBe(50);
    expect(s.remainingGrams).toBe(50);
  });

  it('nunca deja el restante en negativo', () => {
    const s = summarizeMaterialLot(lote({ grams: 10, myGrams: 10, uses: [uso({ grams: 25 })] }));
    expect(s.remainingGrams).toBe(0);
    expect(s.exhausted).toBe(true);
  });

  it('mantiene el reparto sobre lo que va quedando', () => {
    // 60/40 de 100 g; se usan 50 g → quedan 50 g, siguen 60% míos = 30 g.
    const s = summarizeMaterialLot(compartido({ uses: [uso({ grams: 50 })] }));
    expect(s.shared).toBe(true);
    expect(s.myPercent).toBe(60);
    expect(s.remainingGrams).toBe(50);
    expect(s.myRemainingGrams).toBe(30);
    expect(s.partnerRemainingGrams).toBe(20);
  });
});

describe('existencias por tipo y pureza', () => {
  it('agrupa oro 18K aparte del oro 24K', () => {
    const inv = materialsInventory([
      lote({ id: 'a', materialType: 'Oro', purity: '18K', grams: 50, myGrams: 50 }),
      lote({ id: 'b', materialType: 'Oro', purity: '18K', grams: 30, myGrams: 30 }),
      lote({ id: 'c', materialType: 'Oro', purity: '24K', grams: 20, myGrams: 20 })
    ]);
    expect(inv).toHaveLength(2);
    const dieciocho = inv.find((e) => e.purity === '18K');
    expect(dieciocho?.remainingGrams).toBe(80);
    expect(dieciocho?.activeLots).toBe(2);
  });

  it('separa cuántos gramos son míos dentro de las existencias', () => {
    const inv = materialsInventory([compartido()]); // 60 míos de 100
    expect(inv[0].remainingGrams).toBe(100);
    expect(inv[0].myRemainingGrams).toBe(60);
  });

  it('ignora los lotes agotados', () => {
    const inv = materialsInventory([lote({ grams: 10, myGrams: 10, uses: [uso({ grams: 10 })] })]);
    expect(inv).toEqual([]);
  });
});

describe('cuánto material comparto con cada socio', () => {
  it('consolida los lotes de un socio y separa mi parte', () => {
    const shares = materialsByPartner([
      compartido({ id: 'a', grams: 100, myGrams: 60 }),
      compartido({ id: 'b', grams: 40, myGrams: 10 })
    ]);
    expect(shares).toHaveLength(1);
    expect(shares[0].sharedGrams).toBe(140);
    expect(shares[0].myGrams).toBe(70);
    expect(shares[0].partnerGrams).toBe(70);
    expect(shares[0].lotCount).toBe(2);
  });

  it('no mezcla dos socios distintos', () => {
    const shares = materialsByPartner([
      compartido({ id: 'a', partnerId: 'soc-1', partnerName: 'Socio Emerald' }),
      compartido({ id: 'b', partnerId: 'soc-2', partnerName: 'Joyero Amigo' })
    ]);
    expect(shares).toHaveLength(2);
  });

  it('los lotes 100% suyos no aparecen como compartidos', () => {
    expect(materialsByPartner([lote()])).toEqual([]);
  });

  it('agrupa a un socio sin registrar por su nombre', () => {
    const shares = materialsByPartner([
      compartido({ id: 'a', partnerId: null, partnerName: 'Pedro' }),
      compartido({ id: 'b', partnerId: null, partnerName: ' pedro ' })
    ]);
    expect(shares).toHaveLength(1);
  });
});

describe('flujo total de materiales', () => {
  it('separa lo mío de lo compartido', () => {
    const flow = materialsFlow([
      lote({ id: 'a', grams: 50, myGrams: 50 }),
      compartido({ id: 'b', grams: 100, myGrams: 60 })
    ]);
    expect(flow.totalRemainingGrams).toBe(150);
    expect(flow.myRemainingGrams).toBe(110);
    expect(flow.sharedRemainingGrams).toBe(100);
    expect(flow.lotCount).toBe(2);
  });
});

describe('validación de un lote', () => {
  it('exige fecha, material y gramos', () => {
    expect(validateMaterialLot(lote({ purchaseDate: '' }))).toMatch(/fecha/);
    expect(validateMaterialLot(lote({ materialType: '  ' }))).toMatch(/material/);
    expect(validateMaterialLot(lote({ grams: 0 }))).toMatch(/gramos/);
  });

  it('rechaza que mi parte sea mayor que el lote', () => {
    expect(validateMaterialLot(lote({ grams: 100, myGrams: 150 }))).toMatch(/no puede ser mayor/);
  });

  it('acepta un lote compartido bien formado', () => {
    expect(validateMaterialLot(compartido())).toBeNull();
  });
});

describe('salidas de material', () => {
  it('rechaza sacar más gramos de los que quedan', () => {
    const error = validateMaterialUse(lote({ grams: 40, myGrams: 40 }), uso({ grams: 50 }));
    expect(error).toMatch(/solo tiene 40 g/);
  });

  it('rechaza una salida sin fecha o sin gramos', () => {
    expect(validateMaterialUse(lote(), uso({ date: 'ayer' }))).toMatch(/fecha/);
    expect(validateMaterialUse(lote(), uso({ grams: 0 }))).toMatch(/gramos salieron/);
  });

  it('editar una salida no la cuenta contra sí misma', () => {
    const conUso = lote({ grams: 100, myGrams: 100, uses: [uso({ grams: 100 })] });
    expect(validateMaterialUse(conUso, uso({ grams: 80 }), 'u-1')).toBeNull();
  });

  it('agregar y quitar salidas no muta el lote original', () => {
    const original = lote();
    const conUso = withMaterialUse(original, uso({ grams: 10 }), '2026-07-21T10:00:00.000Z');
    expect(original.uses).toEqual([]);
    expect(conUso.uses).toHaveLength(1);
    expect(withoutMaterialUse(conUso, 'u-1', '2026-07-21T10:00:00.000Z').uses).toEqual([]);
  });

  it('reemplaza una salida con el mismo id en vez de duplicarla', () => {
    const conUso = withMaterialUse(lote(), uso({ grams: 10 }), 'x');
    const editado = withMaterialUse(conUso, uso({ grams: 15 }), 'y');
    expect(editado.uses).toHaveLength(1);
    expect(editado.uses[0].grams).toBe(15);
  });
});

describe('nombre, orden y filtros', () => {
  it('un lote sin nombre se muestra con material y pureza', () => {
    expect(materialLotDisplayName(lote({ name: '', materialType: 'Oro', purity: '18K' }))).toBe(
      'Oro 18K'
    );
    expect(materialLotDisplayName(lote({ name: 'Lote Ejemplo' }))).toBe('Lote Ejemplo');
  });

  it('ordena del más reciente al más antiguo', () => {
    const a = lote({ id: 'a', purchaseDate: '2026-07-01' });
    const b = lote({ id: 'b', purchaseDate: '2026-07-20' });
    expect([a, b].sort(compareMaterialLots).map((l) => l.id)).toEqual(['b', 'a']);
  });

  it('filtra por existencias y cuenta', () => {
    const conStock = lote({ id: 'stock' });
    const agotado = lote({ id: 'vacio', grams: 10, myGrams: 10, uses: [uso({ grams: 10 })] });
    expect(filterMaterialLots([conStock, agotado], '', 'existencias').map((l) => l.id)).toEqual([
      'stock'
    ]);
    expect(countMaterialLots([conStock, agotado], '')).toEqual({
      existencias: 1,
      agotados: 1,
      todos: 2
    });
  });
});

describe('formularios en blanco', () => {
  it('un lote nuevo nace 100% suyo, sin socio', () => {
    const l = emptyMaterialLot('2026-07-24', '2026-07-24T09:00:00.000Z');
    expect(l.partnerId).toBeNull();
    expect(l.grams).toBe(0);
    expect(l.uses).toEqual([]);
    expect(l.id).not.toBe(emptyMaterialLot('2026-07-24', '2026-07-24T09:00:00.000Z').id);
  });

  it('una salida nueva nace con la fecha de hoy', () => {
    expect(emptyMaterialUse('2026-07-24').date).toBe('2026-07-24');
  });
});

describe('resumen de un lote con varios socios (D-073)', () => {
  it('manda la lista de socios, no el campo viejo', () => {
    // myGrams quedó desactualizado a propósito: el resumen debe derivarlo de la
    // lista, no creerle al campo viejo.
    const s = summarizeMaterialLot(
      lote({
        grams: 100,
        myGrams: 100,
        partners: [
          { id: 'p-1', partnerId: 'soc-1', partnerName: 'Ana', grams: 30 },
          { id: 'p-2', partnerId: 'soc-2', partnerName: 'Beto', grams: 20 }
        ]
      })
    );
    expect(s.shared).toBe(true);
    expect(s.myPercent).toBe(50);
    expect(s.myRemainingGrams).toBe(50);
    expect(s.partnerRemainingGrams).toBe(50);
  });

  it('reparte lo que queda en la misma proporción tras usar material', () => {
    const s = summarizeMaterialLot(
      lote({
        grams: 100,
        myGrams: 100,
        uses: [uso({ grams: 50 })],
        partners: [{ id: 'p-1', partnerId: 'soc-1', partnerName: 'Ana', grams: 40 }]
      })
    );
    expect(s.remainingGrams).toBe(50);
    expect(s.myRemainingGrams).toBe(30);
    expect(s.partnerRemainingGrams).toBe(20);
  });

  it('un lote viejo con socio único sigue dando exactamente lo mismo', () => {
    const s = summarizeMaterialLot(compartido());
    expect(s.shared).toBe(true);
    expect(s.myPercent).toBe(60);
    expect(s.myRemainingGrams).toBe(60);
    expect(s.partnerRemainingGrams).toBe(40);
  });
});
