import { validateOptionalUsdRate } from './currency';
import { validateProductTypeOptions } from './productTypes';

function validateOptionalTimestamp(value: unknown, label: string): string | null {
  if (typeof value !== 'string') return `${label} no es válida.`;
  if (value.trim() && !Number.isFinite(Date.parse(value))) return `${label} no es válida.`;
  return null;
}

/**
 * Valida los campos de B3 antes de normalizar respaldos o encolar cambios.
 * Los campos pueden faltar en datos históricos; si vienen, deben ser válidos.
 */
export function validateSettingsMetadata(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return 'Los ajustes no tienen un formato válido.';
  }
  const settings = raw as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(settings, 'lastKnownUsdRate')) {
    const rateError = validateOptionalUsdRate(settings.lastKnownUsdRate);
    if (rateError) return rateError;
  }
  if (
    Object.prototype.hasOwnProperty.call(settings, 'usdRateUpdatedAt') &&
    validateOptionalTimestamp(settings.usdRateUpdatedAt, 'La fecha de la tasa USD/COP')
  ) {
    return 'La fecha de la tasa USD/COP no es válida.';
  }
  if (Object.prototype.hasOwnProperty.call(settings, 'productTypes')) {
    const productTypesError = validateProductTypeOptions(settings.productTypes);
    if (productTypesError) return productTypesError;
  }
  if (Object.prototype.hasOwnProperty.call(settings, 'productTypesUpdatedAt')) {
    const timestampError = validateOptionalTimestamp(
      settings.productTypesUpdatedAt,
      'La fecha del catálogo de tipos de producto'
    );
    if (timestampError) return timestampError;
  }
  return null;
}
