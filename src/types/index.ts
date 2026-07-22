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
 * Abono recibido del cliente (SOLO uso interno).
 * Registra cuánto entró, cuándo y quién lo recibió.
 */
export interface ClientPayment {
  id: string;
  /** Monto del abono en COP. */
  amount: number;
  /** Fecha del abono (YYYY-MM-DD). */
  date: string;
  /** Quién recibió el abono en la joyería. */
  receivedBy: string;
  /** Medio: efectivo, transferencia, etc. */
  method: string;
  notes: string;
}

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
  /**
   * Última vez que la cotización ENTRÓ al estado aprobada (ISO). Vacío si
   * nunca, o si se aprobó antes de existir este campo. Alimenta el Cierre
   * del día; no afecta el cálculo ni el vencimiento.
   */
  approvedAt: string;
  /**
   * Fecha (YYYY-MM-DD) en que la joya se ENTREGÓ al cliente. Vacío si aún no.
   * Una pieza puede estar lista (todas las etapas) sin haberse entregado:
   * son dos cosas distintas (corrección C2 de Santiago, 2026-07-16).
   */
  deliveredAt: string;
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
  /** Anticipo ya pagado por el cliente, en COP. */
  deposit: number;
  /** Fecha real del anticipo (YYYY-MM-DD). Vacía en registros antiguos sin fecha conocida. */
  depositDate: string;
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
  /** Abonos recibidos del cliente (interno). */
  payments: ClientPayment[];
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
  /** Última exportación de respaldo iniciada correctamente (ISO). */
  lastBackupExportedAt: string;
  /** Hasta cuándo se oculta el recordatorio de respaldo (ISO). */
  backupReminderSnoozedUntil: string;
  /** Referencia segura para datos antiguos que no conservan fecha de creación válida. */
  backupReminderFirstDataAt: string;
  /** Versión del esquema de settings (para migraciones). Ver services/schema.ts. */
  settingsVersion: number;
}

export type AppointmentStatus = 'programada' | 'cumplida' | 'cancelada' | 'noAsistio';

/**
 * Cita de asesoría personalizada (SOLO uso interno).
 * Santiago la registra a mano: la app nunca publica horarios ni permite
 * reservas desde internet (decisión D-020).
 */
export interface Appointment {
  id: string;
  /** Cliente registrado vinculado, o null si es un interesado sin registrar. */
  clientId: string | null;
  /** Nombre de quien asiste (copiado del cliente o escrito libre). */
  clientName: string;
  /** Fecha de la cita (YYYY-MM-DD). */
  date: string;
  /** Hora local en formato HH:MM (24 horas). Vacío si aún no se define. */
  time: string;
  /** Duración estimada en minutos. */
  durationMinutes: number;
  /** Motivo o tema de la asesoría. */
  reason: string;
  notes: string;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Proveedor de piedras o servicios (SOLO uso interno; corrección C3, 2026-07-16).
 * Funciona como los clientes: se registra una vez y se vincula a los lotes
 * para no reescribir el nombre y para seguir las deudas por proveedor.
 */
export interface Supplier {
  id: string;
  name: string;
  phone: string;
  city: string;
  notes: string;
  createdAt: string;
}

/**
 * Pago hecho AL PROVEEDOR por un lote comprado a crédito (corrección C4).
 * Vive dentro de su lote: la deuda siempre es costo − pagos, nunca un
 * contador guardado a mano.
 */
export interface SupplierPayment {
  id: string;
  /** Fecha del pago (YYYY-MM-DD). */
  date: string;
  /** Monto pagado en COP entero. */
  amount: number;
  notes: string;
}

/**
 * Comprador de piedras o de joyas en stock (SOLO uso interno; decisión D-043).
 * Lista aparte de los clientes del cotizador: quien compra piedras suele ser
 * otro joyero o comerciante, no el consumidor final que encarga una pieza.
 */
export interface Buyer {
  id: string;
  name: string;
  phone: string;
  city: string;
  notes: string;
  createdAt: string;
}

/**
 * Abono recibido DEL COMPRADOR por una venta a crédito (D-042).
 * Vive dentro de su venta: el saldo siempre es precio − abonos, nunca un
 * contador guardado a mano.
 */
export interface BuyerPayment {
  id: string;
  /** Fecha del abono (YYYY-MM-DD). */
  date: string;
  /** Monto recibido en COP entero. */
  amount: number;
  notes: string;
}

/**
 * Venta parcial o total de un lote de piedras (SOLO uso interno).
 * Vive DENTRO de su lote (como los abonos dentro de una cotización): así una
 * venta nunca puede quedar huérfana ni superar lo que el lote tiene.
 */
export interface StoneSale {
  id: string;
  /** Fecha de la venta (YYYY-MM-DD). */
  date: string;
  /** A quién se le vendió (nombre visible; copiado del comprador o escrito libre). */
  buyer: string;
  /** Comprador registrado vinculado, o null si fue texto libre (D-043). */
  buyerId: string | null;
  /** Quilates vendidos en esta venta. */
  carats: number;
  /** Número de piedras vendidas. */
  quantity: number;
  /**
   * Precio TOTAL acordado de la venta, en COP entero. De contado equivale a lo
   * recibido; a crédito lo recibido es la suma de `payments` (D-042).
   */
  valueCop: number;
  /** true si se vendió a crédito: el comprador debe hasta saldar (D-042). */
  onCredit: boolean;
  /** Fecha acordada de pago (YYYY-MM-DD). Vacía cuando es de contado. */
  dueDate: string;
  /** Abonos recibidos del comprador (aplican cuando es a crédito). */
  payments: BuyerPayment[];
  notes: string;
}

/**
 * Lote de piedras compradas (SOLO uso interno). Decisión de Santiago
 * 2026-07-15: cada compra crea un lote rastreable y cada venta se descuenta
 * de un lote específico, para saber qué se ganó con cada uno. El inventario
 * se DERIVA de los lotes y sus ventas; jamás se guarda un contador a mano.
 * Nunca aparece en ningún documento del cliente.
 */
export interface StoneLot {
  id: string;
  /** Nombre del lote, ej: "Lote Ejemplo 12". Si queda vacío, la app muestra piedra + fecha. */
  name: string;
  /** Tipo de piedra: Esmeralda, Zafiro, etc. Agrupa el inventario. */
  stoneType: string;
  /** Descripción libre (talla, calidad, origen…). */
  description: string;
  /** Fecha de la compra (YYYY-MM-DD). */
  purchaseDate: string;
  /** A quién se le compró (nombre visible; copiado del proveedor o escrito libre). */
  supplier: string;
  /** Proveedor registrado vinculado, o null si fue texto libre (C3). */
  supplierId: string | null;
  /** Quilates comprados. */
  carats: number;
  /** Número de piedras compradas. */
  quantity: number;
  /** Costo total de la compra en COP entero. */
  purchaseValueCop: number;
  /** true si la compra fue a crédito: se debe al proveedor hasta saldar (C4). */
  onCredit: boolean;
  /** Pagos hechos al proveedor de este lote (aplican cuando es a crédito). */
  supplierPayments: SupplierPayment[];
  notes: string;
  /** Ventas del lote, en el orden en que se registraron. */
  sales: StoneSale[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Estado GUARDADO de una joya en stock. "Vendida" no está aquí a propósito:
 * se DERIVA de que la pieza tenga venta (D-044, regla de D-023).
 */
export type StockJewelStatus = 'disponible' | 'apartada';

/**
 * Venta de una joya en stock (SOLO uso interno). Siempre de contado por
 * decisión de Héctor: la pieza se entrega pagada (D-044).
 */
export interface StockJewelSale {
  id: string;
  /** Fecha de la venta (YYYY-MM-DD). */
  date: string;
  /** A quién se le vendió (nombre visible; copiado del comprador o escrito libre). */
  buyer: string;
  /** Comprador registrado vinculado, o null si fue texto libre (D-043). */
  buyerId: string | null;
  /** Valor recibido en COP entero. */
  priceCop: number;
  notes: string;
}

/**
 * Joya YA FABRICADA que está en vitrina para vender (SOLO uso interno).
 * No es una cotización a la medida: no tiene etapas de taller, ni anticipo, ni
 * documento de cliente. Área propia por decisión de Héctor (D-044). El costo,
 * el resultado y las notas jamás salen de la aplicación.
 */
export interface StockJewel {
  id: string;
  name: string;
  pieceType: PieceType;
  material: string;
  /** Foto en data URL comprimida por la app. Nunca una URL externa. */
  photo: string;
  /** Fecha en que la pieza entró al inventario (YYYY-MM-DD). Es cuando salió el dinero. */
  acquiredDate: string;
  /** Lo que costó la pieza, en COP entero. INTERNO. */
  costCop: number;
  /** Precio de venta que se pide, en COP entero. */
  priceCop: number;
  status: StockJewelStatus;
  notes: string;
  /** Venta de la pieza. null mientras siga disponible o apartada. */
  sale: StockJewelSale | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackupFile {
  app: 'emerald-dealer-quote';
  /** Versión del formato de respaldo. Ver services/backup.ts. */
  version: number;
  exportedAt: string;
  settings: Settings | null;
  clients: Client[];
  quotes: Quote[];
  /** Citas de asesoría. Los respaldos v1/v2 no las traen y se importan como lista vacía. */
  appointments: Appointment[];
  /** Lotes de piedras con sus ventas. Los respaldos v1/v2/v3 no los traen y se importan vacíos. */
  stoneLots: StoneLot[];
  /** Proveedores. Los respaldos v1–v4 no los traen y se importan vacíos. */
  suppliers: Supplier[];
  /** Compradores. Los respaldos v1–v5 no los traen y se importan vacíos. */
  buyers: Buyer[];
  /** Joyas en stock. Los respaldos v1–v5 no las traen y se importan vacías. */
  stockJewels: StockJewel[];
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

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  'programada',
  'cumplida',
  'cancelada',
  'noAsistio'
];

export const STOCK_JEWEL_STATUSES: StockJewelStatus[] = ['disponible', 'apartada'];
