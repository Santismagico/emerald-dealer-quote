import { describe, expect, it } from 'vitest';
import { defaultSettings, normalizeStockJewel, normalizeStoneLot } from './schema';
import {
  BASE_PRODUCT_TYPES,
  activeProductTypes,
  addProductType,
  productTypeHistory,
  setProductTypeActive,
  validateProductTypeOptions,
  withProductTypesUpdate
} from './productTypes';

describe('catálogo de tipos de producto', () => {
  it('trae exactamente la lista base decidida para el negocio', () => {
    expect(BASE_PRODUCT_TYPES).toEqual([
      'Esmeralda en bruto',
      'Esmeralda tallada',
      'Joya con piedra natural',
      'Joya con piedra de fantasía',
      'Material (oro/plata)',
      'Trabajo por encargo'
    ]);
  });

  it('valida listas externas sin aceptar nombres vacíos, estados falsos ni duplicados', () => {
    expect(validateProductTypeOptions([{ name: 'Anillo', active: true }])).toBeNull();
    expect(validateProductTypeOptions('Anillo')).toMatch(/lista/);
    expect(validateProductTypeOptions([{ name: '  ', active: true }])).toMatch(/sin nombre/);
    expect(validateProductTypeOptions([{ name: 'Anillo', active: 'sí' }])).toMatch(/estado/);
    expect(validateProductTypeOptions([
      { name: 'Anillo', active: true },
      { name: ' anillo ', active: false }
    ])).toMatch(/repetido/);
  });

  it('agrega tipos propios y reactiva uno existente sin duplicarlo', () => {
    const initial = [{ name: 'Anillo', active: false }];
    expect(addProductType(initial, ' Dije ')).toEqual([
      { name: 'Anillo', active: false },
      { name: 'Dije', active: true }
    ]);
    expect(addProductType(initial, 'anillo')).toEqual([{ name: 'Anillo', active: true }]);
    expect(addProductType(initial, '   ')).toEqual(initial);
  });

  it('adelanta la fecha del catálogo solo cuando su contenido cambia', () => {
    const initial = defaultSettings();
    const noChange = withProductTypesUpdate(
      initial,
      (options) => options.map((option) => ({ ...option })),
      '2026-08-03T15:00:00.000Z'
    );
    expect(noChange).toBe(initial);
    expect(noChange.productTypesUpdatedAt).toBe('');

    const changed = withProductTypesUpdate(
      initial,
      (options) => addProductType(options, 'Edición especial'),
      '2026-08-03T15:00:00.000Z'
    );
    expect(changed.productTypesUpdatedAt).toBe('2026-08-03T15:00:00.000Z');
    expect(changed.productTypes).toContainEqual({ name: 'Edición especial', active: true });
  });

  it('deja de ofrecer un tipo sin borrar su nombre ni el historial', () => {
    const options = [
      { name: 'Anillo', active: true },
      { name: 'Tipo retirado', active: false }
    ];
    const deactivated = setProductTypeActive(options, 'Anillo', false);
    expect(deactivated).toEqual([
      { name: 'Anillo', active: false },
      { name: 'Tipo retirado', active: false }
    ]);
    expect(activeProductTypes(deactivated)).toEqual([]);

    const stoneLot = normalizeStoneLot({
      id: 'lot-history',
      sales: [{ id: 'sale-history', productType: 'Venta histórica especial' }]
    });
    const stockJewel = normalizeStockJewel({
      id: 'jewel-history',
      sale: { id: 'jewel-sale-history', productType: 'Tipo retirado' }
    });
    const history = productTypeHistory(deactivated, [stoneLot], [stockJewel]);
    expect(history).toContain('Anillo');
    expect(history).toContain('Tipo retirado');
    expect(history).toContain('Venta histórica especial');
  });
});
