# PLAN — Piedras con crédito y Joyas en stock

_Escrito el 2026-07-21 por Claude (arquitectura). Rama de trabajo: `codex/fase2-nube`.
Base verificada antes de escribir: 521 pruebas en 35 archivos, árbol limpio, IndexedDB v5,
`BACKUP_VERSION = 5`. Este documento es la especificación; **todavía no hay código**._

---

## 1. Qué se pidió y qué se decidió

Un comerciante grande de esmeraldas, cliente real, le dijo a Héctor:

> «Muchas veces vende a crédito a sus clientes, y necesita revisar si ya le pagaron en
> las fechas que acordaron.»

Héctor pidió, en consecuencia, dos cosas:

- **A)** Una parte de **piedras e inventario** más detallada y con más protagonismo:
  compras, ventas, crédito al comprar y **crédito al vender**.
- **B)** Una parte nueva de **joyas en stock**: piezas ya fabricadas que están en vitrina
  para vender, no hechas por encargo.

### Decisiones de negocio tomadas por Héctor (2026-07-21)

| # | Pregunta | Decisión |
|---|---|---|
| 1 | ¿El comprador de piedras va en la lista de Clientes? | **Lista aparte: "Compradores"** |
| 2 | ¿Una venta a crédito se pacta con una fecha o con cuotas? | **Una fecha límite + abonos libres** |
| 3 | ¿Qué ver de un deudor? | **Saldo + días vencidos + semáforo de color** |
| 4 | ¿Dónde viven las joyas en stock? | **Área propia, aparte del cotizador y del Taller** |
| 5 | ¿Qué datos de cada joya? | **Solo lo básico** (sin piedras montadas, sin peso, sin ubicación) |
| 6 | ¿Las joyas también se venden a crédito? | **No: las joyas siempre de contado** |
| 7 | ¿Entran a los cierres del día y del mes? | **Sí, contando la plata real** |

Estas decisiones quedan registradas como **D-042 a D-046** en `DECISIONS.md`.

### Dos consecuencias de diseño que Héctor puede vetar

1. **La lista de "Compradores" es una sola, compartida por piedras y joyas.** Él decidió
   separarla de Clientes; crear además una tercera lista solo para joyas sería peor. Con
   una sola lista, la ficha de un comerciante muestra todo lo que le compró, sean piedras
   o joyas.
2. **La pestaña "Piedras" pasa a llamarse "Inventario"** y por dentro tiene tres
   secciones: **Piedras · Joyas · Cobros**. El menú de abajo sigue teniendo 5 botones.
   Motivo: un sexto botón deja los nombres ilegibles en teléfonos de 320 px, un ancho que
   la app ya cuida desde D-030. Las dos áreas nuevas siguen siendo de primer nivel y
   "Cobros" —lo que de verdad pidió el comerciante— queda a un solo toque.

---

## 2. Qué ya existe y NO se reconstruye

| Ya existe | Dónde |
|---|---|
| Lote de compra rastreable (`StoneLot`) con sus ventas embebidas | `src/types/index.ts`, `src/services/stones.ts` |
| **Crédito al COMPRAR**: `onCredit` + `supplierPayments[]`, deuda derivada | idem (D-025 C4) |
| Proveedores como entidad propia, con nombre conservado al borrarlos | `src/services/storage.ts` |
| Validación de sobreventa (`validateStoneSale`) | `src/services/stones.ts` |
| Existencias por tipo y flujo del negocio, siempre derivados | `stonesInventory`, `stonesFlow` |
| Cierre del día y del mes con caja honesta frente al crédito | `src/services/dailyReport.ts` (D-024, C5/C6) |

**El hueco real** es uno solo: `StoneSale` guarda `valueCop` y nada más. No hay fecha
acordada de pago, ni abonos del comprador, ni saldo, ni señal de vencido. Y `buyer` es
texto libre, así que hoy es imposible responder "¿cuánto me debe Fulano en total?".

---

## 3. Modelo de datos

Todo en `src/types/index.ts`. Dinero **siempre en COP entero**.

### 3.1 Comprador (entidad nueva)

Copia exacta de la forma de `Supplier`, que ya está probada en producción.

```ts
/**
 * Comprador de piedras o de joyas en stock (SOLO uso interno).
 * Decisión de Héctor 2026-07-21: lista aparte de Clientes, porque suelen ser
 * otros joyeros y comerciantes, no el consumidor final que encarga una pieza.
 */
export interface Buyer {
  id: string;
  name: string;
  phone: string;
  city: string;
  notes: string;
  createdAt: string;
}
```

### 3.2 Abono del comprador (entidad nueva, embebida)

Copia exacta de `SupplierPayment`, pero en el sentido contrario del dinero.

```ts
/**
 * Abono recibido DEL COMPRADOR por una venta a crédito.
 * Vive dentro de su venta: el saldo siempre es precio − abonos, jamás un
 * contador guardado a mano (regla de D-023).
 */
export interface BuyerPayment {
  id: string;
  /** Fecha del abono (YYYY-MM-DD). */
  date: string;
  /** Monto recibido en COP entero. */
  amount: number;
  notes: string;
}
```

### 3.3 `StoneSale` — cuatro campos nuevos

```ts
export interface StoneSale {
  id: string;
  date: string;
  buyer: string;                 // ya existía: nombre visible
  buyerId: string | null;        // NUEVO: comprador registrado, o null si fue texto libre
  carats: number;
  quantity: number;
  valueCop: number;              // AHORA significa: precio TOTAL acordado de la venta
  onCredit: boolean;             // NUEVO
  dueDate: string;               // NUEVO: fecha acordada de pago (vacía si es de contado)
  payments: BuyerPayment[];      // NUEVO: abonos recibidos del comprador
  notes: string;
}
```

**Semántica exacta (esto es lo que hay que probar):**

- **De contado** (`onCredit === false`): lo recibido es `valueCop`, el día `date`.
  Idéntico a como funciona hoy. `payments` debe quedar vacío.
- **A crédito** (`onCredit === true`): lo recibido es la **suma de `payments`**; el saldo
  es `valueCop − recibido`. Una cuota inicial es simplemente un abono con fecha igual a la
  de la venta: no hace falta un campo aparte.
- **Ventas viejas**: la normalización las deja en `onCredit: false`, `dueDate: ''`,
  `payments: []`, `buyerId: null`. El resultado es **exactamente el comportamiento de
  hoy**, incluidos los cierres ya emitidos. Riesgo de regresión: ninguno.

### 3.4 Joya en stock (entidad nueva)

```ts
/** Estado guardado. "Vendida" NO se guarda: se deriva de tener venta. */
export type StockJewelStatus = 'disponible' | 'apartada';

/** Venta de una joya en stock. Siempre de contado (decisión de Héctor 2026-07-21). */
export interface StockJewelSale {
  id: string;
  /** Fecha de la venta (YYYY-MM-DD). */
  date: string;
  buyer: string;
  buyerId: string | null;
  /** Valor realmente recibido en COP entero. */
  priceCop: number;
  notes: string;
}

/**
 * Joya YA FABRICADA que está en vitrina para vender (SOLO uso interno).
 * No es una cotización a la medida: no tiene etapas de taller, ni anticipo, ni
 * documento de cliente. Área propia por decisión de Héctor 2026-07-21.
 */
export interface StockJewel {
  id: string;
  name: string;
  pieceType: PieceType;          // reutiliza los tipos del cotizador
  material: string;
  /** Foto en data URL comprimida por la app. Nunca una URL externa. */
  photo: string;
  /** Fecha en que la pieza entró al inventario (YYYY-MM-DD). */
  acquiredDate: string;
  /** Lo que le costó, en COP entero. INTERNO: jamás sale a un documento de cliente. */
  costCop: number;
  /** Precio de venta que pide, en COP entero. */
  priceCop: number;
  status: StockJewelStatus;
  notes: string;
  /** Venta de la pieza. null mientras siga disponible o apartada. */
  sale: StockJewelSale | null;
  createdAt: string;
  updatedAt: string;
}
```

**Por qué `sale` es un objeto y no una lista:** una joya es una pieza única, se vende una
sola vez. Modelarlo como lista invitaría a estados imposibles (dos ventas de la misma
pieza). Deshacer una venta es poner `sale = null`, con confirmación en la interfaz.

**Por qué existe `acquiredDate`:** para que el cierre del día sea honesto. Cuando una
joya entra al inventario, ese dinero salió de la caja ese día, igual que la compra de un
lote de piedras. Se llena solo con la fecha de hoy; Héctor no tiene que pensarlo.

**Sobre `notes`:** Héctor no marcó "ubicación y notas internas". No se agregan ubicación,
peso, código de vitrina ni piedras montadas. Sí se conserva un campo `notes` simple,
porque toda entidad de la app lo tiene y porque una venta necesita poder anotar algo.

**Foto:** se reutiliza `src/utils/images.ts` tal cual (`MAX_SOURCE_IMAGE_BYTES`,
`MAX_IMAGE_FILE_BYTES = 1.5 MB`), con la misma regla de D-033/D-034: el límite se mide
sobre lo que se guarda, no sobre el archivo original. **Una foto por pieza.**

---

## 4. Reglas derivadas (nunca contadores guardados)

Regla de D-023, que este plan respeta sin excepción:

| Dato | Cómo se obtiene |
|---|---|
| Recibido de una venta | contado → `valueCop`; crédito → suma de `payments` |
| Saldo de una venta | `valueCop − recibido` |
| ¿Vencida? | `dueDate < hoy` **y** saldo > 0. `hoy` entra como parámetro, nunca `new Date()` dentro del motor |
| Días vencidos | diferencia entre `hoy` y `dueDate` |
| Deuda de un comprador | suma de los saldos de todas sus ventas a crédito |
| Estado visible de una joya | `sale ? 'vendida' : status` |
| Resultado de una joya | `sale.priceCop − costCop` |
| Existencias de joyas | joyas sin venta |

Igual que el vencimiento de cotizaciones (D-013), **nada de esto se escribe en la base**:
son estados calculados en el momento de mostrarlos.

---

## 5. Motores puros y sus pruebas

### 5.1 `src/services/stones.ts` (se amplía)

```ts
export interface StoneSaleSummary {
  sale: StoneSale;
  receivedCop: number;
  balanceCop: number;
  settled: boolean;
}
export function summarizeStoneSale(sale: StoneSale): StoneSaleSummary;

/** Motivo humano del rechazo, o null. Espeja a validateSupplierPayment. */
export function validateBuyerPayment(
  sale: StoneSale, payment: BuyerPayment, excludePaymentId?: string
): string | null;

export function withSaleBuyerPayment(sale: StoneSale, payment: BuyerPayment): StoneSale;
export function withoutSaleBuyerPayment(sale: StoneSale, paymentId: string): StoneSale;
export function emptyBuyerPayment(today: string): BuyerPayment;
```

Cambios en funciones existentes:

- `summarizeStoneLot`: `soldValue` sigue siendo el **precio acordado** de las ventas (así
  el resultado del lote no cambia de significado), y se agregan `receivedFromBuyers` y
  `buyersDebt`.
- `validateStoneSale`: rechaza `onCredit === true` sin `dueDate` válida, rechaza abonos
  que superen el precio, y rechaza `payments` no vacíos en una venta de contado.
- `validateStoneLotPurchaseUpdate`: la protección del historial se extiende a los abonos
  del comprador — un abono ya registrado no se puede borrar ni cambiar desde la edición
  de la venta.
- `emptyStoneSale`: estrena los campos nuevos vacíos.

**Pruebas que deben fallar antes y pasar después:** venta de contado se comporta igual que
hoy · venta a crédito con dos abonos deja el saldo correcto · un abono mayor al saldo se
rechaza con mensaje humano · el saldo llega exactamente a cero y marca `settled` ·
crédito sin fecha acordada se rechaza · pasar una venta a crédito a contado con abonos ya
registrados se rechaza.

### 5.2 `src/services/receivables.ts` (nuevo)

```ts
export type ReceivableStatus = 'alDia' | 'porVencer' | 'vencido';

export interface Receivable {
  saleId: string; lotId: string; lotName: string; stoneType: string;
  buyerId: string | null; buyerName: string;
  date: string; dueDate: string;
  totalCop: number; paidCop: number; balanceCop: number;
  status: ReceivableStatus; daysOverdue: number;
}

export interface BuyerDebt {
  buyerId: string | null; buyerName: string;
  balanceCop: number; overdueCop: number;
  oldestDueDate: string; maxDaysOverdue: number; saleCount: number;
}

export function listReceivables(lots: readonly StoneLot[], today: string): Receivable[];
export function listBuyerDebts(lots: readonly StoneLot[], today: string): BuyerDebt[];
export function totalReceivable(lots: readonly StoneLot[]): number;
```

- `porVencer` = vence dentro de los próximos **7 días**. Es el amarillo del semáforo.
- Ambas listas salen ordenadas **por el más atrasado primero**, con desempate estable.
- Las ventas a compradores sin registrar (texto libre) se agrupan por nombre normalizado,
  para que "Pedro" y "pedro " no aparezcan como dos deudores distintos.
- `today` es siempre un parámetro. El motor no lee el reloj ni escribe nada.

**Pruebas:** vencido, por vencer y al día se clasifican en los bordes exactos (día antes,
mismo día, día después) · una venta saldada desaparece de la lista aunque esté vencida ·
dos ventas del mismo comprador se consolidan en una sola deuda · el orden pone primero al
más atrasado · comprador sin registrar se agrupa por nombre.

### 5.3 `src/services/stockJewels.ts` (nuevo)

```ts
export type JewelFilter = 'disponibles' | 'vendidas' | 'todas';
export type StockJewelDisplayStatus = 'disponible' | 'apartada' | 'vendida';

export interface StockJewelSummary {
  jewel: StockJewel;
  displayStatus: StockJewelDisplayStatus;
  /** priceCop − costCop mientras no se vende; sale.priceCop − costCop cuando se vendió. */
  resultCop: number;
  sold: boolean;
}
export function summarizeStockJewel(jewel: StockJewel): StockJewelSummary;

export interface StockJewelsFlow {
  jewelCount: number; availableCount: number; soldCount: number;
  /** COP invertido en las piezas que siguen en vitrina. */
  inventoryCostCop: number;
  /** COP que pide por lo que sigue en vitrina. */
  inventoryPriceCop: number;
  totalSoldCop: number;
  totalResultCop: number;
}
export function stockJewelsFlow(jewels: readonly StockJewel[]): StockJewelsFlow;

export function validateStockJewel(jewel: StockJewel): string | null;
export function validateStockJewelSale(jewel: StockJewel, sale: StockJewelSale): string | null;
export function withJewelSale(jewel: StockJewel, sale: StockJewelSale, nowIso: string): StockJewel;
export function withoutJewelSale(jewel: StockJewel, nowIso: string): StockJewel;
export function emptyStockJewel(today: string, nowIso: string): StockJewel;
export function emptyStockJewelSale(today: string): StockJewelSale;
export function filterStockJewels(jewels, search: string, filter: JewelFilter): StockJewel[];
export function matchesJewelSearch(jewel, search: string): boolean;
export function compareStockJewels(a: StockJewel, b: StockJewel): number;
```

**Pruebas:** una joya sin venta está disponible · vender la marca vendida sin guardar el
estado a mano · no se puede vender una joya ya vendida · no se puede vender en $0 · el
resultado es precio recibido menos costo · el flujo separa inventario de vendido ·
deshacer una venta devuelve la pieza al estado que tenía.

---

## 6. Migraciones

### 6.1 IndexedDB: escalón nuevo v6 (append-only)

En `src/services/db.ts`, **sin tocar los cinco escalones existentes**:

```ts
  // v6 — compradores y joyas en stock (ampliación de inventario, 2026-07-21).
  (db) => {
    createStoreIfMissing(db, 'buyers');
    createStoreIfMissing(db, 'stockJewels');
  }
```

`StoreName` gana `'buyers'` y `'stockJewels'`. `DB_VERSION` pasa de 5 a 6 solo.

**Prueba obligatoria:** abrir una base **v5 real** con datos y comprobar que después de
migrar siguen intactos ajustes, clientes, cotizaciones, citas, lotes, proveedores y la
cola de la nube, y que existen los dos almacenes nuevos. Es el mismo patrón ya usado en
`db.test.ts` para v1→v2 y v2→v3.

### 6.2 Respaldo: `BACKUP_VERSION` 5 → 6

- `BackupFile` gana `buyers: Buyer[]` y `stockJewels: StockJewel[]`.
- Un respaldo **v1–v5 se sigue aceptando**: las listas nuevas se importan vacías, igual
  que se hizo con `appointments`, `stoneLots` y `suppliers`.
- `normalizeBackup` valida ids no vacíos y sin duplicar, como ya hace con proveedores.
- `importBackup` incluye los dos almacenes nuevos **dentro de la misma transacción
  atómica**: si algo falla, los datos anteriores quedan completos (D-015).

**Pruebas:** exportar e importar un respaldo v6 completo · importar un v5 deja las listas
nuevas vacías sin romper nada · un respaldo con comprador sin id se rechaza con mensaje
humano · un fallo a mitad de la importación conserva todo lo anterior.

---

## 7. Cadena técnica completa

Ninguno de estos pasos se puede saltar.

| # | Archivo | Qué cambia |
|---|---|---|
| 1 | `src/types/index.ts` | `Buyer`, `BuyerPayment`, `StockJewel`, `StockJewelSale`, `StockJewelStatus`; campos nuevos de `StoneSale`; `BackupFile` |
| 2 | `src/services/schema.ts` | `normalizeBuyer`, `normalizeBuyerPayment`, `normalizeStockJewel`, `normalizeStockJewelSale`; `normalizeStoneSale` ampliada. **Única fuente de defaults** (D-010) |
| 3 | `src/services/stones.ts` | crédito al vender (§5.1) |
| 4 | `src/services/receivables.ts` | motor de cobros (§5.2) |
| 5 | `src/services/stockJewels.ts` | motor de joyas (§5.3) |
| 6 | `src/services/db.ts` | escalón v6 |
| 7 | `src/services/backup.ts` | `BACKUP_VERSION = 6`, exportar/importar/validar |
| 8 | `src/services/storage.ts` | `listBuyers/saveBuyer/deleteBuyer`, `listStockJewels/saveStockJewel/deleteStockJewel` |
| 9 | `src/services/dataSource.ts` | los seis métodos nuevos en `StoreDataSource` |
| 10 | `src/store.tsx` | `buyers` y `stockJewels` en el estado global |
| 11 | `src/services/cloud/outbox.ts` | `CloudTable` += `'buyers' \| 'stock_jewels'` |
| 12 | `src/services/cloud/sync.ts` | `CLOUD_TABLES`, `storeByTable`, `normalized()` |
| 13 | `src/services/cloud/api.ts` | `functionNames` + métodos del `CloudDataSource` |
| 14 | `src/services/cloud/importer.ts` | tareas, `countImportRecords`, `hasLocalDataToImport`, `isCloudEmpty` |
| 15 | `supabase/migrations/2026….sql` | tablas, RLS y funciones protegidas (§8) |
| 16 | `src/components/…` | pantallas (§9) |
| 17 | `src/services/dailyReport.ts` | cierres del día y del mes (§10) |
| 18 | pruebas | en cada paso, fallando antes y pasando después |

**Borrado que conserva el historial (patrón ya probado con proveedores, C3):** borrar un
comprador **no** borra ni altera sus ventas. Dentro de una sola transacción se borra el
comprador y se pone `buyerId = null` en las ventas que lo apuntaban, dejando el **nombre**
escrito. Guardar un comprador con otro nombre actualiza ese nombre en sus ventas. Ambas
operaciones tocan `stoneLots` y `stockJewels`, así que `saveBuyer`/`deleteBuyer` deben
encolar en la nube **también los lotes y joyas que cambiaron**, exactamente como hace hoy
`saveSupplier` en `cloud/api.ts`.

---

## 8. Nube (Supabase)

### 8.1 Forma de las tablas nuevas

Idéntica a `suppliers` y `stone_lots`: `id text`, `organization_id uuid`, `data jsonb`,
`updated_at timestamptz`, clave primaria `(organization_id, id)`, índice por
`(organization_id, updated_at desc)`.

### 8.2 Seguridad

- **RLS activada** en ambas, con una única política de **SELECT** por membresía. Nada de
  políticas de escritura: desde la migración de endurecimiento (S1) el navegador **no
  escribe directo**, solo por funciones protegidas.
- **Los objetos nuevos nacen cerrados** por los `alter default privileges` de S1: hay que
  dar `grant select … to authenticated` explícitamente, o la app no podrá ni leer.
- Funciones nuevas `upsert_buyer`, `delete_buyer`, `upsert_stock_jewel`,
  `delete_stock_jewel`, todas `security definer` con `set search_path = ''` y con el
  `organization_id` resuelto **en el servidor** por
  `private.current_organization_id_for_roles(...)`. **Jamás se acepta un
  `organization_id` enviado por el navegador.**
- Validación de carga en el servidor: `private.assert_stock_jewel_payload` exige que
  `costCop` y `priceCop` sean enteros no negativos y que la venta, si existe, también lo
  sea. Y `private.assert_stone_lot_payload` **se amplía** (con `create or replace`) para
  validar los abonos del comprador dentro de cada venta.
- `revoke all … from public, anon, authenticated, service_role` seguido de
  `grant execute … to authenticated`, igual que las catorce funciones ya existentes.

### 8.3 Aplicarla a la producción que ya está viva

El servidor real (`wrvokfzrcmmlzekudypu`) **ya tiene datos de cuentas reales**. Por eso
la migración se entrega como **un solo texto** que Héctor pega en el SQL Editor, y es
**puramente aditiva**:

- `create table if not exists` — nunca `drop table`.
- `create index if not exists`.
- `drop policy if exists` + `create policy` **solo sobre las tablas nuevas** (Postgres no
  admite `create policy if not exists`; sobre una tabla recién creada esto es inofensivo).
- `create or replace function` — no borra funciones existentes.
- Ningún `alter` sobre columnas ya existentes. Ningún dato se toca.

Ejecutarla dos veces por error debe ser inofensivo. El texto final se guardará en
`docs/SQL_PRODUCCION_INVENTARIO.md` con instrucciones visuales paso a paso.

---

## 9. Pantallas

### 9.1 Pestaña "Inventario" (antes "Piedras")

Un control de tres secciones arriba, al estilo de los filtros que ya usa la app:

**Piedras** — la vista actual, más:
- En el formulario de venta: interruptor **"Fue a crédito"**. Al activarlo aparecen
  "Fecha acordada de pago" y el bloque de abonos.
- Selector de comprador con la misma mecánica del selector de proveedor: elegir uno
  registrado o escribir el nombre libre.
- En cada venta a crédito: saldo, fecha acordada, chip de color y botón **"Registrar
  abono"** de un toque.

**Joyas** — lista con foto, nombre, precio y chip de estado; buscador y filtros
(disponibles · vendidas · todas); formulario de pieza; acciones **Vender**, **Apartar** y
**Deshacer venta** (con confirmación). Arriba, un resumen: cuántas piezas, cuánto vale la
vitrina y cuánto ha vendido.

**Cobros** — la respuesta directa a lo que pidió el comerciante:
- Arriba: **"Le deben $X"**, y de eso **"$Y está vencido"**.
- Lista de deudores ordenada por el más atrasado, con nombre, saldo y "vencido hace N
  días" en rojo, "vence en N días" en amarillo, "al día" en verde.
- Al tocar un deudor: sus ventas a crédito, con sus abonos, y "Registrar abono".

### 9.2 Más → Compradores

Pantalla igual a Proveedores: lista, buscador, alta y edición, y borrado que avisa en
lenguaje claro que **las ventas se conservan con el nombre escrito**.

### 9.3 Reglas de interfaz que se mantienen

Textos en español · dinero con `formatCOP` · inputs de 16 px mínimo · botones táctiles de
44 px o más · sin desbordamiento horizontal · **ventanas emergentes con el colchón del
menú inferior y desplazamiento interno** (corrección del 2026-07-18, que salió de una
prueba de usuario del propio Héctor) · verificación visual a 320 px y 390 px.

### 9.4 Privacidad

Ni las joyas en stock ni los compradores generan documento de cliente. `costCop`,
`resultCop` y las notas internas **no existen fuera de la app**. Los tests de
`src/services/pdfContent.test.ts` siguen siendo ley y no se tocan.

---

## 10. Cierres del día y del mes

Se conserva la regla honesta de C5/D-025: **el dinero cuenta el día que se mueve de
verdad.** Los tipos de `dailyReport.ts` se amplían así:

| Movimiento | Día en que entra o sale de caja |
|---|---|
| Venta de piedras **de contado** | entra completa el día de la venta (igual que hoy) |
| Venta de piedras **a crédito** | **no entra nada** ese día; se informa aparte |
| **Abono de un comprador** | entra el día del abono |
| **Joya en stock adquirida** | sale el día de `acquiredDate` |
| **Joya en stock vendida** | entra el día de la venta (siempre de contado) |

`BusinessTotals` gana: `stonesSoldCredit` (informativo, no es caja), `buyerPaymentsReceived`,
`jewelsAcquiredCost`, `jewelsSold`, y la foto del momento **`buyersOwe`**, que se muestra
junto a las que ya existen (`supplierDebt`, `clientsOwe`).

El PDF interno gana las secciones **"Piedras · Abonos de compradores"**, **"Joyas ·
Compras"** y **"Joyas · Ventas"**, y el renglón **"Te deben por piedras (a la fecha)"**.
Sigue siendo descarga directa, nunca Web Share ni WhatsApp.

**Prueba clave de no regresión:** con datos que no usan crédito al vender, el cierre del
día debe dar **exactamente el mismo neto que hoy**.

---

## 11. Etapas de trabajo

Cada etapa entra con sus pruebas, fallando antes y pasando después, y con `npm test &&
npm run build` en verde antes de pasar a la siguiente.

| Etapa | Qué entrega | Cómo se verifica |
|---|---|---|
| **E1** | Tipos, normalización, escalón v6, respaldo v6 | Migración contra una base v5 real; respaldos v1–v6; ventas viejas normalizan a contado |
| **E2** | Crédito al vender en `stones.ts` | Pruebas puras de saldo, abonos, rechazos y bordes |
| **E3** | `receivables.ts` | Pruebas puras de semáforo, días vencidos, consolidación y orden |
| **E4** | `stockJewels.ts` | Pruebas puras de estado derivado, resultado y flujo |
| **E5** | `storage.ts`, `dataSource.ts`, `store.tsx` | Persistencia; borrado que conserva el nombre |
| **E6** | Nube: outbox, sync, api, importer + SQL | Pruebas de la cadena; SQL revisado línea por línea |
| **E7** | Pantallas: Inventario (3 secciones) y Compradores | Recorrido real en navegador a 320/390 px y en PC |
| **E8** | Cierres del día y del mes | Neto idéntico sin crédito; neto correcto con crédito |
| **E9** | Verificación integral, SQL a producción, publicación al enlace nuevo | Pruebas, ambas compilaciones, sitio en vivo comprobado |

**Orden de la salida a producción en E9:** primero Héctor pega el SQL (aditivo, no rompe
la app que ya está viva porque la versión publicada nunca pide las tablas nuevas), y
**después** se publica el sitio actualizado. Al revés, la app pediría tablas que aún no
existen.

---

## 12. Riesgos y qué no se toca

| Riesgo | Cómo se controla |
|---|---|
| Cambiar el significado de `valueCop` rompe cierres viejos | Las ventas viejas normalizan a contado: el resultado es idéntico. Hay prueba de no regresión del neto |
| La migración SQL sobre datos reales | Solo `create`/`replace` aditivos; ningún `drop` de tablas; repetible sin daño |
| Tablas nuevas ilegibles por los permisos cerrados de S1 | La migración incluye el `grant select … to authenticated` explícito |
| Un sexto botón de menú ilegible en 320 px | El menú se queda en 5; las áreas nuevas viven dentro de "Inventario" |
| Dos listas de personas confunden a Héctor | Compradores y Clientes se explican en la propia pantalla con una línea en español claro |
| Fotos de joyas inflando el respaldo | Mismo límite ya probado de D-033/D-034, una foto por pieza |

**No se toca:** `main` · `.github/workflows/deploy.yml` · `src/calc/engine.ts` ·
`src/services/goldPrice.ts` · `src/services/pdfContent.test.ts` ·
`src/services/cloud/legalDocuments.test.ts` (debe seguir exigiendo la marca BORRADOR
mientras haya `[COMPLETAR]`) · los cinco escalones existentes de `DB_MIGRATIONS`.

**Dependencias nuevas: ninguna.** Todo se construye con lo que el proyecto ya tiene.
