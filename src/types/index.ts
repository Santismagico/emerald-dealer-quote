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

/** Categoría administrable de gastos. Nunca se borra: solo cambia `active`. */
export interface ExpenseCategoryOption {
  name: string;
  active: boolean;
}

/** Tipo de producto administrable. Nunca se borra: solo cambia `active` (D-058). */
export interface ProductTypeOption {
  name: string;
  active: boolean;
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
  /** Categorías internas disponibles al crear gastos (D-059). */
  expenseCategories: ExpenseCategoryOption[];
  /** Tipos de producto disponibles en ventas nuevas (D-058). */
  productTypes: ProductTypeOption[];
  /** Momento del último cambio real al catálogo de tipos de producto. */
  productTypesUpdatedAt: string;
  /** Última tasa USD→COP válida conocida; null hasta la primera consulta exitosa. */
  lastKnownUsdRate: number | null;
  /** Momento de la última consulta exitosa de la tasa USD→COP. */
  usdRateUpdatedAt: string;
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
  /** Tasa USD→COP propia de este abono. null significa histórico sin registrar. */
  usdRate: number | null;
  /** Quién recibió el dinero en la joyería. */
  receivedBy: string;
  /** Medio: efectivo, transferencia, etc. */
  method: string;
  notes: string;
}

/**
 * Socio con quien se comparte material, gastos o lotes de piedras. SOLO uso interno.
 * Lista aparte de proveedores y compradores: es un CO-DUEÑO del negocio, no
 * alguien a quien se le compra ni a quien se le vende (D-049/D-053).
 */
export interface MaterialPartner {
  id: string;
  name: string;
  phone: string;
  city: string;
  notes: string;
  createdAt: string;
}

/**
 * Salida de caja del negocio (SOLO uso interno; D-059).
 * Si pertenece a una sociedad, conserva nombre y reparto aunque se borre la ficha del socio.
 */
export interface Expense {
  id: string;
  /** Día en que el dinero salió de caja (YYYY-MM-DD). */
  date: string;
  concept: string;
  category: string;
  /** Monto total pagado, siempre COP entero. */
  amountCop: number;
  /** Tasa USD→COP propia de esta salida. null significa histórico sin registrar. */
  usdRate: number | null;
  method: string;
  paidBy: string;
  /** Socio vinculado; null si es propio o si luego se borró la ficha. */
  partnerId: string | null;
  /** Nombre histórico del socio; se conserva al borrar la ficha. */
  partnerName: string;
  /**
   * @deprecated D-073. Porcentaje propio del modelo anterior. Reemplazado por
   * `partners`, que declara la plata que puso cada uno.
   */
  myPercent: number;
  /**
   * Quiénes comparten este gasto y cuánto puso cada uno (D-073). Lo propio se
   * deriva: monto total menos la suma de los socios.
   */
  partners?: LotPartner[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/** Gramos que salieron de un lote de material al usarlos (SOLO interno; D-048). */
export interface MaterialUse {
  id: string;
  /** Fecha del uso (YYYY-MM-DD). */
  date: string;
  /** Gramos usados. */
  grams: number;
  /** En qué se usó (texto libre). */
  notes: string;
}

/**
 * Lote de material comprado: oro, plata, etc. (SOLO uso interno; D-048).
 * Cada compra es un lote rastreable; las existencias se DERIVAN del lote menos
 * sus salidas, jamás un contador guardado a mano (regla de D-023). El material
 * es una lista aparte que se ajusta a mano y no toca el cotizador (decisión de
 * Héctor). Nunca aparece en ningún documento del cliente.
 */
export interface MaterialLot {
  id: string;
  /** Nombre opcional del lote. Si queda vacío, la app arma material + fecha. */
  name: string;
  /** Tipo de material: Oro, Plata, etc. Agrupa el inventario. */
  materialType: string;
  /** Pureza o ley: "18K", "24K", "925"… Libre y opcional. */
  purity: string;
  /** Fecha de la compra (YYYY-MM-DD). */
  purchaseDate: string;
  /** Gramos comprados en este lote. */
  grams: number;
  /** Costo total de la compra en COP entero. Referencia; no entra a caja en v1. */
  costCop: number;
  /** Socio con quien se comparte el lote, o null si el lote es todo suyo (D-049). */
  partnerId: string | null;
  /** Nombre visible del socio (copiado o escrito libre); se conserva al borrar la ficha. */
  partnerName: string;
  /**
   * @deprecated D-073. Gramos propios del modelo de socio único. Se conserva para
   * leer lotes guardados antes de la fase Socios y Fondo. Reemplazado por
   * `partners`, donde cada socio declara SUS gramos.
   */
  myGrams: number;
  /**
   * Socios de este lote, cada uno con los gramos que le pertenecen (D-049 + D-073).
   * Los gramos propios se DERIVAN: total menos la suma de los socios.
   */
  partners?: MaterialLotPartner[];
  notes: string;
  /** Salidas del lote, en el orden en que se registraron. */
  uses: MaterialUse[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Venta parcial o total de un lote de piedras (SOLO uso interno).
 * Vive DENTRO de su lote (como los abonos dentro de una cotización): así una
 * venta nunca puede quedar huérfana ni superar lo que el lote tiene.
 */
/** Tanda parcial enviada a talla dentro de un lote de piedras (D-055). */
export interface CuttingBatch {
  id: string;
  sentDate: string;
  sentCarats: number;
  sentQuantity: number;
  returnedDate: string;
  returnedCarats: number;
  /** Puede superar sentQuantity si una piedra se divide durante la talla. */
  returnedQuantity: number;
  /** Costo total de esta talla, COP entero. */
  cuttingCostCop: number;
  /** Fecha en que el costo salió de caja; vacía mientras no se pague. */
  cuttingPaidDate: string;
  notes: string;
}

/** Existencia fisica de piedras antes o despues de pasar por talla. */
export type StoneOrigin = 'bruto' | 'tallado';

/**
 * Piedra retirada de un lote para incorporarla a una joya del inventario.
 * No es una venta ni un movimiento de caja: es un traslado interno de costo.
 */
export interface StoneInternalUse {
  id: string;
  date: string;
  carats: number;
  quantity: number;
  origin: StoneOrigin;
  jewelId: string;
  /** Costo atribuido a la joya en el momento del traslado, COP entero. */
  costCop: number;
  notes: string;
}

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
  /** Existencia física de la que salió la venta (D-055). */
  origin: StoneOrigin;
  /**
   * Precio TOTAL acordado de la venta, en COP entero. De contado equivale a lo
   * recibido; a crédito lo recibido es la suma de `payments` (D-042).
   */
  valueCop: number;
  /** Clasificación histórica elegida al vender. Vacío significa sin registrar. */
  productType: string;
  /** Tasa USD→COP propia de esta venta. null significa histórico sin registrar. */
  usdRate: number | null;
  /** Quién recibió el dinero cuando la venta fue de contado (D-051). */
  receivedBy: string;
  /** Medio de pago de la venta de contado. En crédito vive en cada abono. */
  method: string;
  /** true si se vendió a crédito: el comprador debe hasta saldar (D-042). */
  onCredit: boolean;
  /** Fecha acordada de pago (YYYY-MM-DD). Vacía cuando es de contado. */
  dueDate: string;
  /** Abonos recibidos del comprador (aplican cuando es a crédito). */
  payments: BuyerPayment[];
  notes: string;
}

/**
 * Socio de igualdad dentro de un lote o un gasto (D-073).
 *
 * Declara la PLATA QUE PUSO, no un porcentaje: así ocurre el trato, el usuario
 * no tiene que cuadrar a 100 y no quedan centavos sueltos. El porcentaje se
 * DERIVA para mostrarlo, nunca se guarda (regla de D-023).
 *
 * Es distinto de un inversionista del fondo (`FundContribution`): el socio de
 * igualdad **gana o pierde** con el lote; el del fondo cobra pase lo que pase.
 */
/**
 * Socio de igualdad en un lote de MATERIAL (D-049 + D-073).
 *
 * A diferencia de las piedras y los gastos, el material se comparte en **gramos**,
 * no en plata: lo que importa del oro es cuántos gramos son de cada quien. El
 * porcentaje se DERIVA para mostrarlo, igual que en el resto de la fase.
 */
export interface MaterialLotPartner {
  id: string;
  partnerId: string | null;
  partnerName: string;
  /** Gramos que son de este socio. */
  grams: number;
}

export interface LotPartner {
  id: string;
  /** Ficha del socio; null si se escribió libre o si luego se borró. */
  partnerId: string | null;
  /** Nombre histórico; se conserva aunque se borre la ficha. */
  partnerName: string;
  /** Plata que puso, COP entero. */
  amountCop: number;
}

/**
 * Lote de piedras compradas (SOLO uso interno). Decisión de Santiago
 * 2026-07-15: cada compra crea un lote rastreable y cada venta se descuenta
 * de un lote específico, para saber qué se ganó con cada uno. El inventario
 * se DERIVA de los lotes y sus ventas; jamás se guarda un contador a mano.
 * Nunca aparece en ningún documento del cliente.
 */
export interface StoneLot {
  /** Estado fisico en el que se compro. Ausente en historia antigua significa bruto. */
  purchaseOrigin?: StoneOrigin;
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
  /**
   * @deprecated D-073. Socio único del modelo anterior. Se conserva solo para
   * poder leer lotes guardados antes de la fase Socios y Fondo; ningún cálculo
   * nuevo lo usa. Reemplazado por `partners`.
   */
  partnerId: string | null;
  /** @deprecated D-073. Ver `partnerId`. */
  partnerName: string;
  /**
   * @deprecated D-073. Porcentaje propio del modelo anterior; la parte del socio
   * era `100 - myPercent`. Reemplazado por `partners`, que declara la PLATA que
   * puso cada uno y deriva el porcentaje.
   */
  myPercent: number;
  /**
   * Socios de igualdad de este lote (D-073). Cada uno declara la plata que puso;
   * su proporción se DERIVA. Ausente o vacío significa lote sin socios.
   * Ganan y pierden con el lote, a diferencia del fondo (D-072).
   */
  partners?: LotPartner[];
  /**
   * Cuánta plata del FONDO de inversión financió esta compra (D-072/D-074).
   * Es deuda, no patrimonio: **se excluye de la base sobre la que se reparte**
   * entre los socios de igualdad, y su costo lo asume Santiago (D-075).
   */
  fundedFromFundCop?: number;
  /** true si la compra fue a crédito: se debe al proveedor hasta saldar (C4). */
  onCredit: boolean;
  /** Pagos hechos al proveedor de este lote (aplican cuando es a crédito). */
  supplierPayments: SupplierPayment[];
  /** Envíos parciales a talla, en el orden en que se registraron. */
  cuttingBatches: CuttingBatch[];
  /** Salidas hacia joyas propias. Nunca se mezclan con ventas. */
  internalUses: StoneInternalUse[];
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
  /** Clasificación histórica elegida al vender. Vacío significa sin registrar. */
  productType: string;
  /** Tasa USD→COP propia de esta venta. null significa histórico sin registrar. */
  usdRate: number | null;
  /** Quién recibió el dinero en la joyería (D-051). */
  receivedBy: string;
  /** Medio: efectivo, transferencia, etc. */
  method: string;
  notes: string;
}

export type StockJewelStoneKind = 'fantasia' | 'natural' | '';

/** Historia inmutable de un cambio de piedra de fantasia por una natural. */
export interface StockJewelStoneTransformation {
  id: string;
  date: string;
  lotId: string;
  /** Nombre historico del lote; permite conservar la historia si el lote se elimina. */
  lotName?: string;
  jewelId: string;
  origin: StoneOrigin;
  carats: number;
  quantity: number;
  /** Costo trasladado desde el lote, COP entero. */
  costCop: number;
  notes: string;
  fromStoneKind: 'fantasia';
  toStoneKind: 'natural';
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
  /** Peso total de la pieza. 0 significa historico sin registrar. */
  weightGrams: number;
  /** Talla, largo o medida en texto libre. */
  size: string;
  /** Numero de piedras que lleva. 0 significa historico sin registrar. */
  stoneCount: number;
  /** Clase de piedra; vacio conserva honestamente los registros anteriores. */
  stoneKind: StockJewelStoneKind;
  /** Lo que costó la pieza, en COP entero. INTERNO. */
  costCop: number;
  /** Precio de venta que se pide, en COP entero. */
  priceCop: number;
  status: StockJewelStatus;
  notes: string;
  /** Venta de la pieza. null mientras siga disponible o apartada. */
  sale: StockJewelSale | null;
  /** Colección a la que pertenece, o null. Reservado para D-050 (aún sin usar). */
  collectionId: string | null;
  /** Cambios fantasia -> natural, en orden historico. No se pueden deshacer. */
  stoneTransformations: StockJewelStoneTransformation[];
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
  /** Socios de material. Los respaldos v1–v6 no los traen y se importan vacíos. */
  materialPartners: MaterialPartner[];
  /** Lotes de material con sus salidas. Los respaldos v1–v6 no los traen y se importan vacíos. */
  materialLots: MaterialLot[];
  /** Gastos del negocio. Los respaldos v1–v7 no los traen y se importan vacíos. */
  expenses: Expense[];
  /** Aportes al fondo de inversión. Los respaldos v1–v8 no los traen y se importan vacíos. */
  fundContributions: FundContribution[];
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

/* ─────────────────────────────────────────────────────────────────────────────
 * FONDO DE INVERSIÓN (D-072, D-074, D-075, D-076)
 *
 * Amigos y conocidos que entregan dinero al negocio esperando un rendimiento a
 * plazo. Santiago les paga capital más rendimiento PASE LO QUE PASE, aunque el
 * lote pierda: contablemente es DEUDA, no patrimonio.
 *
 * Por eso la plata del fondo nunca entra al reparto entre socios de igualdad, y
 * su costo lo asume Santiago solo (D-075).
 *
 * No existe "el saldo del fondo" como cifra guardada (D-076): existe esta lista
 * de aportes, cada uno con su persona, y el total se DERIVA de sumarlos.
 * ────────────────────────────────────────────────────────────────────────── */

/** Cómo se pactó el rendimiento de un aporte. Se pacta distinto con cada persona (D-074). */
export type FundReturnKind = 'mensual' | 'fijo';

export const FUND_RETURN_KINDS: FundReturnKind[] = ['mensual', 'fijo'];

/** Qué se le pagó a un inversionista: devolución de su capital o su rendimiento. */
export type FundPaymentKind = 'capital' | 'rendimiento';

export const FUND_PAYMENT_KINDS: FundPaymentKind[] = ['capital', 'rendimiento'];

/** Un pago hecho a un inversionista del fondo. */
export interface FundPayment {
  id: string;
  /** Fecha del pago (YYYY-MM-DD). */
  date: string;
  /** Monto pagado, COP entero. */
  amountCop: number;
  kind: FundPaymentKind;
  notes: string;
}

/**
 * Un aporte de una persona al fondo. Se comporta como un préstamo
 * independiente: no se mezcla con los demás ni se ata a un lote (D-074).
 *
 * Un aporte devuelto por completo NO se borra: queda cerrado y su historia
 * sigue visible, porque la composición del grupo cambia con el tiempo y
 * Santiago necesita reconstruirla en cualquier momento (D-076).
 */
export interface FundContribution {
  id: string;
  /** Ficha de la persona; null si se escribió libre o si luego se borró. */
  personId: string | null;
  /** Nombre histórico; se conserva aunque se borre la ficha. */
  personName: string;
  /** Fecha en que entregó la plata (YYYY-MM-DD). */
  date: string;
  /** Capital entregado, COP entero. */
  amountCop: number;
  returnKind: FundReturnKind;
  /**
   * Porcentaje mensual sobre el capital. Solo cuando `returnKind` es 'mensual'.
   * Admite decimales (1,5 % mensual); el rendimiento se redondea a peso entero.
   */
  monthlyRatePercent: number | null;
  /**
   * Total pactado a devolver (capital + rendimiento), COP entero. Solo cuando
   * `returnKind` es 'fijo'.
   */
  agreedTotalCop: number | null;
  /** Fecha pactada de devolución (YYYY-MM-DD). Cadena vacía si no se pactó plazo. */
  dueDate: string;
  /** Pagos hechos a esta persona por este aporte. */
  payments: FundPayment[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}
