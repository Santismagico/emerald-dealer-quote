// Fuente ÚNICA de verdad para: valores por defecto, migraciones de settings y
// normalización de datos. Todo dato que entra a la app (base local de versiones
// anteriores, respaldos importados, futura sincronización SaaS) pasa por aquí.
// Así ninguna vista necesita defenderse por su cuenta de datos con forma vieja
// o corrupta (hallazgo de la auditoría de seguridad 2026-07-09).

import type {
  Settings,
  Quote,
  Client,
  Stone,
  ExtraCost,
  ProductionStage,
  ClientPayment,
  QuoteStatus,
  PieceType,
  StageStatus
} from '../types';
import { QUOTE_STATUSES, PIECE_TYPES } from '../types';
import { newId } from '../utils/id';

/** Versión del esquema de settings. Súbela al agregar una migración. */
export const SETTINGS_VERSION = 3;

export function defaultSettings(): Settings {
  return {
    jewelryName: 'Emerald Dealer',
    logoDataUrl: '',
    nit: '',
    phone: '',
    whatsapp: '',
    address: '',
    city: '',
    email: '',
    commercialMessage:
      'Cada joya de nuestra casa es un emblema de lujo y distinción, creada para acompañar los momentos que merecen quedar en la memoria. Esta pieza será elaborada con dedicación artesanal, cuidando cada detalle de su fabricación para entregarle una obra digna de usted. Gracias por su confianza.',
    defaultValidityDays: 15,
    currency: 'COP',
    // 0 = aún sin actualizar. Se actualiza solo al abrir la app con internet.
    goldPricePerGram: 0,
    goldMarkupPerGram: 100000,
    goldPriceUpdatedAt: '',
    goldPriceNote:
      'Regla interna: precio internacional del oro 24K del día + $100.000 COP por gramo. Este dato es confidencial y nunca se muestra al cliente.',
    defaultMarginPercent: 0,
    taxEnabledByDefault: false,
    defaultTaxPercent: 19,
    conditions:
      'Precios sujetos a cambio según el mercado del oro y disponibilidad de piedras. Cotización válida hasta la fecha indicada. El trabajo inicia con la confirmación del anticipo.',
    quoteCounter: 1,
    lastBackupExportedAt: '',
    backupReminderSnoozedUntil: '',
    backupReminderFirstDataAt: '',
    settingsVersion: SETTINGS_VERSION
  };
}

// ---------- Coerciones seguras ----------

function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function safeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Solo se aceptan imágenes en data URL generadas por la app (nunca URLs externas: evita rastreo). */
function safeImageDataUrl(value: unknown): string {
  return typeof value === 'string' && value.startsWith('data:image/') ? value : '';
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

// ---------- Settings: normalización + migraciones ----------

const LEGACY_DEFAULT_MESSAGE = 'Gracias por su confianza. Será un gusto atenderle.';

/**
 * Copia SOLO las claves conocidas (con tipo correcto) sobre los defaults y
 * aplica las migraciones pendientes según settingsVersion. Claves desconocidas
 * de un respaldo se descartan.
 */
export function normalizeSettings(raw: unknown): Settings {
  const defaults = defaultSettings();
  if (typeof raw !== 'object' || raw === null) return defaults;
  const source = raw as Record<string, unknown>;

  const out = { ...defaults };
  for (const key of Object.keys(defaults) as Array<keyof Settings>) {
    const value = source[key];
    if (value !== undefined && typeof value === typeof defaults[key]) {
      (out as Record<string, unknown>)[key] = value;
    }
  }
  out.currency = 'COP';
  out.logoDataUrl = safeImageDataUrl(source.logoDataUrl);

  // Migraciones ordenadas. La versión guardada indica qué le falta al registro.
  const storedVersion = safeNumber(source.settingsVersion, 1);
  if (storedVersion < 2 && out.commercialMessage === LEGACY_DEFAULT_MESSAGE) {
    // v2: el mensaje comercial por defecto cambió; solo se migra si el usuario
    // conservaba exactamente el default anterior.
    out.commercialMessage = defaults.commercialMessage;
  }
  out.settingsVersion = SETTINGS_VERSION;

  return out;
}

// ---------- Quote: normalización ----------

function normalizeStone(raw: unknown): Stone {
  const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    id: safeString(s.id, newId()),
    type: safeString(s.type),
    cut: safeString(s.cut),
    size: safeString(s.size),
    carats: safeNumber(s.carats),
    quantity: safeNumber(s.quantity),
    priceMode: oneOf(s.priceMode, ['porPiedra', 'porQuilate'] as const, 'porPiedra'),
    unitPrice: safeNumber(s.unitPrice),
    treatment: safeString(s.treatment),
    quality: safeString(s.quality),
    notes: safeString(s.notes)
  };
}

function normalizeExtraCost(raw: unknown): ExtraCost {
  const c = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return { id: safeString(c.id, newId()), label: safeString(c.label), amount: safeNumber(c.amount) };
}

function normalizeStage(raw: unknown): ProductionStage {
  const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    id: safeString(s.id, newId()),
    name: safeString(s.name),
    status: oneOf<StageStatus>(s.status, ['pendiente', 'enProceso', 'lista'] as const, 'pendiente'),
    completedAt: safeString(s.completedAt),
    cost: safeNumber(s.cost),
    paid: s.paid === true,
    paidAt: safeString(s.paidAt),
    paidTo: safeString(s.paidTo),
    paidBy: safeString(s.paidBy),
    notes: safeString(s.notes)
  };
}

function normalizePayment(raw: unknown): ClientPayment {
  const p = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    id: safeString(p.id, newId()),
    amount: safeNumber(p.amount),
    date: safeString(p.date),
    receivedBy: safeString(p.receivedBy),
    method: safeString(p.method),
    notes: safeString(p.notes)
  };
}

export function normalizeClient(raw: unknown): Client {
  const c = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    id: safeString(c.id, newId()),
    name: safeString(c.name),
    phone: safeString(c.phone),
    email: safeString(c.email),
    city: safeString(c.city),
    document: safeString(c.document),
    notes: safeString(c.notes),
    createdAt: safeString(c.createdAt)
  };
}

/**
 * Garantiza que una cotización tenga la forma exacta del tipo Quote actual,
 * venga de la versión de app que venga. Campos faltantes reciben defaults,
 * tipos incorrectos se corrigen, imágenes externas se descartan.
 */
export function normalizeQuote(raw: unknown): Quote {
  const q = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    id: safeString(q.id, newId()),
    number: safeString(q.number),
    clientId: typeof q.clientId === 'string' ? q.clientId : null,
    clientSnapshot:
      typeof q.clientSnapshot === 'object' && q.clientSnapshot !== null
        ? normalizeClient(q.clientSnapshot)
        : null,
    date: safeString(q.date),
    validUntil: safeString(q.validUntil),
    status: oneOf<QuoteStatus>(q.status, QUOTE_STATUSES, 'borrador'),
    pieceType: oneOf<PieceType>(q.pieceType, PIECE_TYPES, 'otro'),
    pieceDescription: safeString(q.pieceDescription),
    material: safeString(q.material, 'Oro'),
    materialPricePerGram: safeNumber(q.materialPricePerGram),
    weightGrams: safeNumber(q.weightGrams),
    stones: safeArray(q.stones).map(normalizeStone),
    laborCost: safeNumber(q.laborCost),
    extraCosts: safeArray(q.extraCosts).map(normalizeExtraCost),
    marginPercent: safeNumber(q.marginPercent),
    discountType: oneOf(q.discountType, ['porcentaje', 'valor'] as const, 'porcentaje'),
    discountValue: safeNumber(q.discountValue),
    taxEnabled: q.taxEnabled === true,
    taxPercent: safeNumber(q.taxPercent),
    deposit: safeNumber(q.deposit),
    internalNotes: safeString(q.internalNotes),
    clientNotes: safeString(q.clientNotes),
    images: safeArray(q.images).map(safeImageDataUrl).filter(Boolean),
    production: safeArray(q.production).map(normalizeStage),
    payments: safeArray(q.payments).map(normalizePayment),
    createdAt: safeString(q.createdAt),
    updatedAt: safeString(q.updatedAt)
  };
}
