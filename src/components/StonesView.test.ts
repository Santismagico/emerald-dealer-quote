import { describe, expect, it } from 'vitest';
import type { StoneLot, StoneSale } from '../types';
import { stoneLotDeletionWarning, stoneSaleDeletionWarning } from './StonesView';

describe('aviso al eliminar un lote', () => {
  it('enumera ventas, pagos, deuda y pérdida del historial', () => {
    const lot: StoneLot = {
      id: 'lot-1',
      name: 'Lote Ejemplo 12',
      stoneType: 'Esmeralda',
      description: '',
      purchaseDate: '2026-07-16',
      supplier: 'Proveedor Ejemplo',
      supplierId: 'sup-1',
      carats: 3,
      quantity: 3,
      purchaseValueCop: 6000000,
      onCredit: true,
      supplierPayments: [
        { id: 'pay-1', date: '2026-07-16', amount: 2000000, notes: '' }
      ],
      notes: '',
      sales: [
        {
          id: 'sale-1',
          date: '2026-07-16',
          buyer: '',
          carats: 0.5,
          quantity: 1,
          valueCop: 1500000,
          buyerId: null,
          onCredit: false,
          dueDate: '',
          payments: [],
          notes: ''
        },
        {
          id: 'sale-2',
          date: '2026-07-16',
          buyer: '',
          carats: 0.5,
          quantity: 1,
          valueCop: 1500000,
          buyerId: null,
          onCredit: false,
          dueDate: '',
          payments: [],
          notes: ''
        }
      ],
      createdAt: '2026-07-16T09:00:00.000Z',
      updatedAt: '2026-07-16T09:00:00.000Z'
    };

    const warning = stoneLotDeletionWarning(lot);
    expect(warning).toContain('todo su historial');
    expect(warning).toContain('2 venta(s)');
    expect(warning).toContain('1 pago(s)');
    expect(warning).toContain('deuda pendiente');
    expect(warning).toContain('4.000.000');
  });

  // Hallazgo H2 de la auditoría propia (2026-07-22): el aviso callaba el
  // dinero que los COMPRADORES deben. Borrar el lote lo borraba de Cobros sin
  // que nadie se enterara.
  it('avisa cuando se va a perder plata que le deben a la joyería', () => {
    const lot = loteConCobro();
    const warning = stoneLotDeletionWarning(lot);
    expect(warning).toContain('te deben');
    expect(warning).toContain('1.800.000');
  });

  it('no habla de cobros cuando no hay ninguno pendiente', () => {
    const lot = loteConCobro({
      sales: [venta({ onCredit: false, dueDate: '', payments: [] })]
    });
    expect(stoneLotDeletionWarning(lot)).not.toContain('te deben');
  });
});

describe('aviso al eliminar una venta', () => {
  it('advierte que se pierden los abonos ya recibidos', () => {
    const warning = stoneSaleDeletionWarning(venta());
    expect(warning).toContain('3.000.000');
    expect(warning).toContain('1 abono');
    expect(warning).toContain('1.200.000');
  });

  it('una venta de contado se elimina con el aviso simple de siempre', () => {
    const warning = stoneSaleDeletionWarning(
      venta({ onCredit: false, dueDate: '', payments: [] })
    );
    expect(warning).toContain('3.000.000');
    expect(warning).not.toContain('abono');
  });
});

function venta(overrides: Partial<StoneSale> = {}): StoneSale {
  return {
    id: 'sale-credito',
    date: '2026-07-15',
    buyer: 'Joyería Ejemplo',
    buyerId: null,
    carats: 1,
    quantity: 1,
    valueCop: 3000000,
    onCredit: true,
    dueDate: '2026-08-15',
    payments: [{ id: 'ab-1', date: '2026-07-20', amount: 1200000, notes: '' }],
    notes: '',
    ...overrides
  };
}

function loteConCobro(overrides: Partial<StoneLot> = {}): StoneLot {
  return {
    id: 'lot-cobro',
    name: 'Lote con cobro',
    stoneType: 'Esmeralda',
    description: '',
    purchaseDate: '2026-07-10',
    supplier: '',
    supplierId: null,
    carats: 5,
    quantity: 5,
    purchaseValueCop: 2000000,
    onCredit: false,
    supplierPayments: [],
    notes: '',
    sales: [venta()],
    createdAt: '2026-07-10T09:00:00.000Z',
    updatedAt: '2026-07-10T09:00:00.000Z',
    ...overrides
  };
}
