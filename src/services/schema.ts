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
  StageStatus,
  Appointment,
  AppointmentStatus,
  StoneLot,
  StoneSale,
  Supplier,
  SupplierPayment,
  Buyer,
  BuyerPayment,
  StockJewel,
  StockJewelSale,
  StockJewelStatus
} from '../types';
import {
  QUOTE_STATUSES,
  PIECE_TYPES,
  APPOINTMENT_STATUSES,
  STOCK_JEWEL_STATUSES
} from '../types';
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

export function normalizeSupplier(raw: unknown): Supplier {
  const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    id: safeString(s.id, newId()),
    name: safeString(s.name),
    phone: safeString(s.phone),
    city: safeString(s.city),
    notes: safeString(s.notes),
    createdAt: safeString(s.createdAt)
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
 * Garantiza que una cita de asesoría tenga la forma exacta del tipo actual.
 * Una hora que no sea HH:MM se descarta (queda "sin hora definida") y una
 * duración inválida vuelve al estándar de 60 minutos.
 */
export function normalizeAppointment(raw: unknown): Appointment {
  const a = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const time = safeString(a.time);
  const duration = safeNumber(a.durationMinutes, 60);
  return {
    id: safeString(a.id, newId()),
    clientId: typeof a.clientId === 'string' ? a.clientId : null,
    clientName: safeString(a.clientName),
    date: safeString(a.date),
    time: /^\d{2}:\d{2}$/.test(time) ? time : '',
    durationMinutes: duration > 0 ? Math.round(duration) : 60,
    reason: safeString(a.reason),
    notes: safeString(a.notes),
    status: oneOf<AppointmentStatus>(a.status, APPOINTMENT_STATUSES, 'programada'),
    createdAt: safeString(a.createdAt),
    updatedAt: safeString(a.updatedAt)
  };
}

function normalizeSupplierPayment(raw: unknown): SupplierPayment {
  const p = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    id: safeString(p.id, newId()),
    date: safeString(p.date),
    amount: Math.max(0, Math.round(safeNumber(p.amount))),
    notes: safeString(p.notes)
  };
}

export function normalizeBuyer(raw: unknown): Buyer {
  const b = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    id: safeString(b.id, newId()),
    name: safeString(b.name),
    phone: safeString(b.phone),
    city: safeString(b.city),
    notes: safeString(b.notes),
    createdAt: safeString(b.createdAt)
  };
}

function normalizeBuyerPayment(raw: unknown): BuyerPayment {
  const p = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    id: safeString(p.id, newId()),
    date: safeString(p.date),
    amount: Math.max(0, Math.round(safeNumber(p.amount))),
    notes: safeString(p.notes)
  };
}

/**
 * Una venta sin las marcas de crédito (D-042) es de CONTADO: así las ventas
 * anteriores a la decisión conservan exactamente el dinero y el resultado que
 * ya tenían. Una venta de contado nunca conserva abonos: lo recibido es su
 * precio, y un abono suelto duplicaría el dinero al calcular la caja.
 */
function normalizeStoneSale(raw: unknown): StoneSale {
  const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const onCredit = s.onCredit === true;
  return {
    id: safeString(s.id, newId()),
    date: safeString(s.date),
    buyer: safeString(s.buyer),
    buyerId: typeof s.buyerId === 'string' ? s.buyerId : null,
    carats: Math.max(0, safeNumber(s.carats)),
    quantity: Math.max(0, safeNumber(s.quantity)),
    valueCop: Math.max(0, Math.round(safeNumber(s.valueCop))),
    onCredit,
    dueDate: onCredit ? safeString(s.dueDate) : '',
    payments: onCredit ? safeArray(s.payments).map(normalizeBuyerPayment) : [],
    notes: safeString(s.notes)
  };
}

function normalizeStockJewelSale(raw: unknown): StockJewelSale {
  const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    id: safeString(s.id, newId()),
    date: safeString(s.date),
    buyer: safeString(s.buyer),
    buyerId: typeof s.buyerId === 'string' ? s.buyerId : null,
    priceCop: Math.max(0, Math.round(safeNumber(s.priceCop))),
    notes: safeString(s.notes)
  };
}

/**
 * Garantiza que una joya en stock tenga la forma exacta del tipo actual.
 * El estado guardado solo puede ser disponible o apartada: "vendida" se deriva
 * de tener venta (D-044), así que un dato corrupto jamás puede dejar una pieza
 * marcada como vendida sin la venta que lo respalde.
 */
export function normalizeStockJewel(raw: unknown): StockJewel {
  const j = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    id: safeString(j.id, newId()),
    name: safeString(j.name),
    pieceType: oneOf(j.pieceType, PIECE_TYPES, 'otro'),
    material: safeString(j.material),
    photo: safeImageDataUrl(j.photo),
    acquiredDate: safeString(j.acquiredDate),
    costCop: Math.max(0, Math.round(safeNumber(j.costCop))),
    priceCop: Math.max(0, Math.round(safeNumber(j.priceCop))),
    status: oneOf<StockJewelStatus>(j.status, STOCK_JEWEL_STATUSES, 'disponible'),
    notes: safeString(j.notes),
    sale:
      typeof j.sale === 'object' && j.sale !== null ? normalizeStockJewelSale(j.sale) : null,
    createdAt: safeString(j.createdAt),
    updatedAt: safeString(j.updatedAt)
  };
}

/**
 * Garantiza que un lote de piedras tenga la forma exacta del tipo actual.
 * Cantidades negativas o no numéricas se llevan a 0 y las ventas embebidas se
 * normalizan una por una: un dato corrupto nunca infla existencias ni dinero.
 */
export function normalizeStoneLot(raw: unknown): StoneLot {
  const l = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    id: safeString(l.id, newId()),
    name: safeString(l.name),
    stoneType: safeString(l.stoneType),
    description: safeString(l.description),
    purchaseDate: safeString(l.purchaseDate),
    supplier: safeString(l.supplier),
    supplierId: typeof l.supplierId === 'string' ? l.supplierId : null,
    carats: Math.max(0, safeNumber(l.carats)),
    quantity: Math.max(0, safeNumber(l.quantity)),
    purchaseValueCop: Math.max(0, Math.round(safeNumber(l.purchaseValueCop))),
    onCredit: l.onCredit === true,
    supplierPayments: safeArray(l.supplierPayments).map(normalizeSupplierPayment),
    notes: safeString(l.notes),
    sales: safeArray(l.sales).map(normalizeStoneSale),
    createdAt: safeString(l.createdAt),
    updatedAt: safeString(l.updatedAt)
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
    approvedAt: safeString(q.approvedAt),
    deliveredAt: safeString(q.deliveredAt),
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
    depositDate: safeString(q.depositDate),
    internalNotes: safeString(q.internalNotes),
    clientNotes: safeString(q.clientNotes),
    images: safeArray(q.images).map(safeImageDataUrl).filter(Boolean),
    production: safeArray(q.production).map(normalizeStage),
    payments: safeArray(q.payments).map(normalizePayment),
    createdAt: safeString(q.createdAt),
    updatedAt: safeString(q.updatedAt)
  };
}
