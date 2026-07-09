// Tipos centrales del dominio. Todo el dinero se maneja en pesos colombianos (COP)
// como números enteros para evitar errores de decimales.

export type QuoteStatus = 'borrador' | 'pendiente' | 'aprobada' | 'rechazada' | 'vencida';

export type PieceType =
  | 'anillo'
  | 'dije'
  | 'aretes'
  | 'pulsera'
  | 'cadena'
  | 'argolla'
  | 'set'
  | 'otro';

export type StonePriceMode = 'porPiedra' | 'porQuilate';

export interface Stone {
  id: string;
  /** Tipo de piedra: esmeralda, diamante, zafiro, etc. */
  type: string;
  /** Talla o forma: esmeralda, brillante, oval, etc. */
  cut: string;
  /** Medida en mm u otra unidad descriptiva. */
  size: string;
  /** Peso en quilates por piedra. */
  carats: number;
  quantity: number;
  priceMode: StonePriceMode;
  /** Precio unitario en COP: por piedra o por quilate según priceMode. */
  unitPrice: number;
  treatment: string;
  quality: string;
  notes: string;
}

export interface ExtraCost {
  id: string;
  label: string;
  amount: number;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  document: string;
  notes: string;
  createdAt: string;
}

export type DiscountType = 'porcentaje' | 'valor';

export type StageStatus = 'pendiente' | 'enProceso' | 'lista';

/**
 * Etapa de producción del taller (SOLO uso interno, nunca visible al cliente).
 * Controla el avance de fabricación y los pagos de cada etapa.
 */
export interface ProductionStage {
  id: string;
  /** Nombre de la etapa: Diseño, Fundición, etc. */
  name: string;
  status: StageStatus;
  /** Fecha (YYYY-MM-DD) en que la etapa quedó lista. Vacío si no. */
  completedAt: string;
  /** Costo de la etapa en COP. */
  cost: number;
  paid: boolean;
  /** Fecha del pago (YYYY-MM-DD). */
  paidAt: string;
  /** A quién se le pagó (taller o proveedor). */
  paidTo: string;
  /** Quién hizo el pago. */
  paidBy: string;
  notes: string;
}

export interface Quote {
  id: string;
  /** Número visible de la cotización, ej: ED-2026-0001 */
  number: string;
  clientId: string | null;
  /** Copia de los datos del cliente al momento de cotizar (por si el cliente se edita o borra). */
  clientSnapshot: Client | null;
  /** Fecha de emisión (ISO). */
  date: string;
  /** Fecha de vencimiento (ISO). */
  validUntil: string;
  status: QuoteStatus;
  pieceType: PieceType;
  pieceDescription: string;
  material: string;
  /** Precio del material por gramo en COP (interno, no visible al cliente). */
  materialPricePerGram: number;
  weightGrams: number;
  stones: Stone[];
  laborCost: number;
  extraCosts: ExtraCost[];
  /** Margen interno en porcentaje. Nunca visible al cliente. */
  marginPercent: number;
  discountType: DiscountType;
  discountValue: number;
  taxEnabled: boolean;
  taxPercent: number;
  /** Anticipo en COP. */
  deposit: number;
  /** Observaciones internas: nunca aparecen en el PDF del cliente. */
  internalNotes: string;
  /** Observaciones visibles para el cliente. */
  clientNotes: string;
  /** Imágenes de referencia como data URLs comprimidas. */
  images: string[];
  /**
   * Seguimiento de producción del taller (interno). Se inicializa con las
   * etapas estándar cuando la cotización pasa a estado "aprobada".
   */
  production: ProductionStage[];
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  /** Nombre visible de la joyería. Por defecto: Emerald Dealer. */
  jewelryName: string;
  logoDataUrl: string;
  nit: string;
  phone: string;
  whatsapp: string;
  address: string;
  city: string;
  email: string;
  /** Mensaje comercial de cierre en el PDF. */
  commercialMessage: string;
  /** Días de validez por defecto de una cotización. */
  defaultValidityDays: number;
  currency: 'COP';
  /**
   * Precio interno del oro por gramo (COP). SOLO uso interno.
   * Regla comercial del negocio: precio internacional 24K del día + recargo fijo
   * por gramo (goldMarkupPerGram). Se actualiza automáticamente con internet;
   * sin conexión se usa el último valor guardado. Nunca se muestra al cliente.
   */
  goldPricePerGram: number;
  /** Recargo fijo por gramo que se suma al precio internacional (COP). */
  goldMarkupPerGram: number;
  /** Última actualización automática del precio del oro (ISO). Vacío si nunca. */
  goldPriceUpdatedAt: string;
  /** Nota interna sobre cómo se calcula el precio del oro. */
  goldPriceNote: string;
  /** Margen interno por defecto (%) aplicado sobre el costo base. */
  defaultMarginPercent: number;
  taxEnabledByDefault: boolean;
  defaultTaxPercent: number;
  /** Condiciones comerciales que aparecen en el PDF del cliente. */
  conditions: string;
  /** Consecutivo para numerar cotizaciones. */
  quoteCounter: number;
}

export interface BackupFile {
  app: 'emerald-dealer-quote';
  version: 1;
  exportedAt: string;
  settings: Settings | null;
  clients: Client[];
  quotes: Quote[];
}

export const PIECE_TYPES: PieceType[] = [
  'anillo',
  'dije',
  'aretes',
  'pulsera',
  'cadena',
  'argolla',
  'set',
  'otro'
];

export const QUOTE_STATUSES: QuoteStatus[] = [
  'borrador',
  'pendiente',
  'aprobada',
  'rechazada',
  'vencida'
];
