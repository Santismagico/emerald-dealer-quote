import { describe, expect, it } from 'vitest';
import type { StoneLot } from '../types';
import { stoneLotDeletionWarning } from './StonesView';

describe('aviso al eliminar un lote', () => {
  it('enumera ventas, pagos, deuda y pérdida del historial', () => {
    const lot: StoneLot = {
      id: 'lot-1',
      name: 'Muzo 12',
      stoneType: 'Esmeralda',
      description: '',
      purchaseDate: '2026-07-16',
      supplier: 'Proveedor Muzo',
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
          notes: ''
        },
        {
          id: 'sale-2',
          date: '2026-07-16',
          buyer: '',
          carats: 0.5,
          quantity: 1,
          valueCop: 1500000,
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
});
