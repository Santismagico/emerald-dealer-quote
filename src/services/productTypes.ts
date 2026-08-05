import type { ProductTypeOption, Settings, StockJewel, StoneLot } from '../types';

/** Lista base elegida por Santiago para clasificar ventas (D-058). */
export const BASE_PRODUCT_TYPES = [
  'Esmeralda en bruto',
  'Esmeralda tallada',
  'Joya con piedra natural',
  'Joya con piedra de fantasía',
  'Material (oro/plata)',
  'Trabajo por encargo'
] as const;

/** Valida datos externos antes de normalizarlos para no ocultar un respaldo dañado. */
export function validateProductTypeOptions(raw: unknown): string | null {
  if (!Array.isArray(raw)) return 'Los tipos de producto deben ser una lista.';
  const seen = new Set<string>();
  for (const value of raw) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return 'Hay un tipo de producto inválido.';
    }
    const option = value as Record<string, unknown>;
    if (typeof option.name !== 'string' || !option.name.trim()) {
      return 'Hay un tipo de producto sin nombre.';
    }
    if (typeof option.active !== 'boolean') {
      return `El estado de ${option.name.trim()} no es válido.`;
    }
    const key = option.name.trim().toLocaleLowerCase('es');
    if (seen.has(key)) return `El tipo de producto ${option.name.trim()} está repetido.`;
    seen.add(key);
  }
  return null;
}

export function activeProductTypes(options: readonly ProductTypeOption[]): string[] {
  return options.filter((option) => option.active).map((option) => option.name);
}

/** Incluye tipos desactivados y nombres históricos sin inventar clasificaciones. */
export function productTypeHistory(
  options: readonly ProductTypeOption[],
  stoneLots: readonly StoneLot[],
  stockJewels: readonly StockJewel[]
): string[] {
  const names = new Map<string, string>();
  for (const option of options) names.set(option.name.toLocaleLowerCase('es'), option.name);
  for (const lot of stoneLots) {
    for (const sale of lot.sales) {
      const name = sale.productType.trim();
      if (name) names.set(name.toLocaleLowerCase('es'), name);
    }
  }
  for (const jewel of stockJewels) {
    const name = jewel.sale?.productType.trim() ?? '';
    if (name) names.set(name.toLocaleLowerCase('es'), name);
  }
  return [...names.values()].sort((a, b) =>
    a.localeCompare(b, 'es', { sensitivity: 'base' })
  );
}

/** Agrega un tipo propio o reactiva uno existente; nunca borra historial. */
export function addProductType(
  options: readonly ProductTypeOption[],
  rawName: string
): ProductTypeOption[] {
  const name = rawName.trim();
  if (!name) return [...options];
  const key = name.toLocaleLowerCase('es');
  let found = false;
  const next = options.map((option) => {
    if (option.name.toLocaleLowerCase('es') !== key) return option;
    found = true;
    return { ...option, active: true };
  });
  return found ? next : [...next, { name, active: true }];
}

/** Activa o deja de ofrecer un tipo, conservando siempre su nombre. */
export function setProductTypeActive(
  options: readonly ProductTypeOption[],
  name: string,
  active: boolean
): ProductTypeOption[] {
  const key = name.trim().toLocaleLowerCase('es');
  return options.map((option) =>
    option.name.toLocaleLowerCase('es') === key ? { ...option, active } : option
  );
}

function sameProductTypes(
  current: readonly ProductTypeOption[],
  next: readonly ProductTypeOption[]
): boolean {
  return current.length === next.length && current.every((option, index) => {
    const other = next[index];
    return option.name === other?.name && option.active === other.active;
  });
}

/** Adelanta el reloj del catálogo solo cuando la lista cambió de verdad. */
export function withProductTypesUpdate(
  current: Settings,
  update: (options: ProductTypeOption[]) => ProductTypeOption[],
  updatedAt: string
): Settings {
  const productTypes = update(current.productTypes);
  if (sameProductTypes(current.productTypes, productTypes)) return current;
  return { ...current, productTypes, productTypesUpdatedAt: updatedAt };
}
