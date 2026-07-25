# PLAN — Inventario de materiales (con dueños) y espacio propio para joyas

_Escrito el 2026-07-24 por Claude (arquitectura). Rama: `codex/fase2-nube`.
Base verificada: 673 pruebas en verde, IndexedDB v6, `BACKUP_VERSION 6`.
Continúa la ampliación de inventario de D-042..D-047. Sin código todavía._

---

## 1. Qué pidió Héctor y qué decidió

**Petición (2026-07-24):**

- **A)** Un **espacio propio para las joyas en stock**, pensando en armar
  **colecciones** de joyería a mediano plazo.
- **B)** Un **inventario de materiales** (el oro que tiene) donde pueda clasificar
  **el material** y **de quién es**: tiene oro compartido con su socio de Emerald
  Dealer, y otro oro con un joyero amigo.

**Decisiones de negocio (2026-07-24):**

| # | Pregunta | Decisión |
|---|---|---|
| 1 | ¿Cómo es la sociedad sobre el oro? | **Se reparte: una parte suya, otra del socio, por cada lote** |
| 2 | ¿Dónde van los dueños del material? | **Lista nueva de "Socios de material"** |
| 3 | ¿El inventario de oro se conecta al cotizador? | **No: lista aparte que se ajusta a mano** |

Quedan como **D-048, D-049 y D-050** en `DECISIONS.md`.

**Lo que decido yo (Héctor puede vetarlo):**

- **El menú de abajo se queda en 5 botones** (un sexto se corta en teléfonos de
  320 px, D-030/D-046). "Inventario" pasa a tener **cuatro secciones**:
  **Piedras · Materiales · Joyas · Cobros**. Ahí las joyas tienen su propio espacio.
- **Las colecciones se diseñan pero se construyen después** (mediano plazo). Para
  no tener que migrar datos más adelante, la joya estrena desde ya un campo
  `collectionId` vacío, reservado; no hay pantalla de colecciones todavía.

---

## 2. Qué NO va en esta versión (v1), y por qué

Para que la primera versión sea simple, segura y esté funcionando pronto:

- **El material no toca el cotizador ni el taller.** Usted agrega oro cuando lo
  compra y lo descuenta cuando lo usa, a mano. No se descuenta solo al aprobar una
  cotización (decisión 3).
- **El dinero del material NO entra al Cierre del día ni del mes en v1.** Motivo: al
  ser compartido, "cuánto salió de MI bolsillo" es ambiguo (solo mi parte), y Héctor
  puso el foco en gramos y dueños, no en caja. Se registra el costo como referencia.
  Si más adelante quiere que su parte entre a la caja, se agrega sin romper nada.
- **El material no maneja crédito ni pagos** (a diferencia de las piedras). Solo su
  costo. Si algún día compra oro a crédito, se añade después.
- **Sin colecciones todavía** (solo el campo reservado).

Todo esto queda escrito para que quede claro que fue una decisión, no un olvido.

---

## 3. Modelo de datos

Todo en `src/types/index.ts`. Dinero en **COP entero**; gramos con decimales.

### 3.1 Socio de material (entidad nueva)

Misma forma probada de `Supplier` y `Buyer`.

```ts
/**
 * Socio con quien Héctor comparte un material (oro, plata…). SOLO interno.
 * Lista aparte de proveedores y compradores: es un CO-DUEÑO del material,
 * no alguien a quien le compra ni a quien le vende (D-049).
 */
export interface MaterialPartner {
  id: string;
  name: string;
  phone: string;
  city: string;
  notes: string;
  createdAt: string;
}
```

### 3.2 Salida de material (entidad nueva, embebida)

```ts
/** Gramos que salieron de un lote de material al usarlos (SOLO interno). */
export interface MaterialUse {
  id: string;
  /** Fecha del uso (YYYY-MM-DD). */
  date: string;
  /** Gramos usados. */
  grams: number;
  /** En qué se usó (texto libre: "argolla de Fulano", "venta"…). */
  notes: string;
}
```

### 3.3 Lote de material (entidad nueva)

Copia cercana de `StoneLot`, que ya está probado. La diferencia clave es el
**reparto de propiedad**.

```ts
/**
 * Lote de material comprado (oro, plata…). SOLO interno (D-048).
 * Cada compra es un lote rastreable; las existencias se DERIVAN del lote menos
 * sus salidas, jamás un contador guardado a mano (regla de D-023).
 */
export interface MaterialLot {
  id: string;
  /** Nombre opcional del lote. Si queda vacío, la app arma material + fecha. */
  name: string;
  /** Tipo de material: Oro, Plata, etc. Agrupa el inventario. */
  materialType: string;
  /** Pureza/ley: "18K", "24K", "925"… Libre y opcional. */
  purity: string;
  /** Fecha de la compra (YYYY-MM-DD). */
  purchaseDate: string;
  /** Gramos comprados en este lote. */
  grams: number;
  /** Costo total de la compra en COP entero. Referencia; no entra a caja en v1. */
  costCop: number;
  /**
   * Socio con quien se comparte el lote. null = el lote es TODO suyo.
   * `partnerName` guarda el nombre visible (copiado del socio o escrito libre),
   * para que borrar la ficha del socio no borre el historial (patrón D-043).
   */
  partnerId: string | null;
  partnerName: string;
  /**
   * Cuántos de los `grams` son SUYOS. El resto es del socio.
   * Sin socio, `myGrams === grams` (todo suyo). Con socio, entre 0 y grams.
   * Se guarda en gramos (exacto); el porcentaje se DERIVA para mostrarlo.
   */
  myGrams: number;
  notes: string;
  /** Salidas del lote, en el orden en que se registraron. */
  uses: MaterialUse[];
  createdAt: string;
  updatedAt: string;
}
```

**Semántica (esto es lo que se prueba):**

- **Restante** del lote = `grams − suma(uses.grams)`. Nunca puede bajar de 0: la
  validación impide sacar más de lo que queda.
- **Mi parte del restante** = `restante × (myGrams / grams)`. El reparto se mantiene
  sobre lo que va quedando (convención honesta y simple).
- **Del socio** = `restante − mi parte`.
- Sin socio (`partnerId === null` y `partnerName` vacío): todo es suyo, la interfaz
  ni siquiera muestra el reparto.

### 3.4 `StockJewel` — un campo nuevo, reservado

```ts
  /** Colección a la que pertenece la pieza, o null. Reservado para D-050 (futuro). */
  collectionId: string | null;
```

Las joyas viejas y los respaldos anteriores normalizan `collectionId` a `null`.
No hay entidad ni pantalla de colecciones todavía.

### 3.5 `BackupFile` — dos listas nuevas

```ts
  /** Socios de material. Respaldos v1–v6 no los traen: se importan vacíos. */
  materialPartners: MaterialPartner[];
  /** Lotes de material con sus salidas. Respaldos v1–v6 no los traen: vacíos. */
  materialLots: MaterialLot[];
```

---

## 4. Motor puro `src/services/materials.ts` (nuevo, con pruebas)

Espeja a `stones.ts`. Todo derivado, nada guardado a mano.

```ts
export interface MaterialLotSummary {
  lot: MaterialLot;
  usedGrams: number;
  remainingGrams: number;
  myRemainingGrams: number;
  partnerRemainingGrams: number;
  /** Porcentaje suyo del lote (0–100), derivado de myGrams/grams. */
  myPercent: number;
  exhausted: boolean;
}
export function summarizeMaterialLot(lot: MaterialLot): MaterialLotSummary;

/** Existencias por tipo+pureza: "Oro 18K: 250 g (180 míos)". */
export interface MaterialInventoryEntry {
  materialType: string; purity: string;
  remainingGrams: number; myRemainingGrams: number; activeLots: number;
}
export function materialsInventory(lots: readonly MaterialLot[]): MaterialInventoryEntry[];

/** Cuánto material comparto con cada socio, y cuánto es mío. */
export interface PartnerMaterialShare {
  partnerId: string | null; partnerName: string;
  sharedGrams: number; myGrams: number; partnerGrams: number; lotCount: number;
}
export function materialsByPartner(lots: readonly MaterialLot[]): PartnerMaterialShare[];

export function validateMaterialLot(lot: MaterialLot): string | null;
export function validateMaterialUse(lot: MaterialLot, use: MaterialUse, excludeId?: string): string | null;
export function withMaterialUse(lot: MaterialLot, use: MaterialUse, nowIso: string): MaterialLot;
export function withoutMaterialUse(lot: MaterialLot, useId: string, nowIso: string): MaterialLot;
export function emptyMaterialLot(today: string, nowIso: string): MaterialLot;
export function emptyMaterialUse(today: string): MaterialUse;
export function filterMaterialLots(...): MaterialLot[];   // como en piedras
export function materialLotDisplayName(lot): string;
```

**Pruebas que deben fallar antes y pasar después:** restante correcto tras varias
salidas · no se puede sacar más gramos de los que quedan · el reparto se mantiene
en el restante · un lote sin socio es 100% suyo y no muestra reparto · `myGrams`
mayor que `grams` se rechaza al validar · existencias agrupan por tipo+pureza ·
consolidación por socio suma bien y separa mi parte.

---

## 5. Migraciones

### 5.1 IndexedDB: escalón nuevo **v7** (solo se agrega, D-023)

```ts
  // v7 — socios y lotes de material (inventario de materiales, D-048/D-049).
  (db) => {
    createStoreIfMissing(db, 'materialPartners');
    createStoreIfMissing(db, 'materialLots');
  }
```

`DB_VERSION` pasa de 6 a 7. **Prueba obligatoria:** abrir una base **v6 real** con
datos (piedras, compradores, joyas) y comprobar que nada se pierde y aparecen los
dos almacenes nuevos.

### 5.2 Respaldo: `BACKUP_VERSION` 6 → 7

Acepta respaldos v1–v6 (listas nuevas vacías). Importación atómica (D-015): los dos
almacenes nuevos entran en la misma transacción; si algo falla, todo lo anterior
queda intacto. La joya suma `collectionId` en su normalización.

---

## 6. Cadena técnica completa (no se salta ningún eslabón)

| # | Archivo | Cambio |
|---|---|---|
| 1 | `types/index.ts` | `MaterialPartner`, `MaterialUse`, `MaterialLot`; `collectionId` en `StockJewel`; `BackupFile` |
| 2 | `services/schema.ts` | `normalizeMaterialPartner`, `normalizeMaterialUse`, `normalizeMaterialLot`; `collectionId` en joya |
| 3 | `services/materials.ts` | motor puro (§4) |
| 4 | `services/db.ts` | escalón v7 |
| 5 | `services/backup.ts` | `BACKUP_VERSION = 7`, exportar/importar/validar |
| 6 | `services/storage.ts` | `listMaterialPartners/save/delete` (borrado conserva nombre en lotes), `listMaterialLots/save/delete` |
| 7 | `services/dataSource.ts` | seis métodos nuevos |
| 8 | `store.tsx` | `materialPartners` y `materialLots` en el estado |
| 9 | `cloud/outbox.ts` | `CloudTable` += `material_partners \| material_lots` |
| 10 | `cloud/sync.ts` | tablas, `storeByTable`, `normalized()` |
| 11 | `cloud/api.ts` | `functionNames` + métodos; borrar/renombrar socio arrastra sus lotes |
| 12 | `cloud/importer.ts` | tareas, conteo, `hasLocalDataToImport`, `isCloudEmpty` |
| 13 | `supabase/migrations/2026…sql` | tablas + RLS + funciones protegidas (§7) |
| 14 | `components/…` | sección Materiales, vista Socios, cablear en Inventario y Más |
| 15 | pruebas | en cada paso, fallando antes y pasando después |

---

## 7. Nube (Supabase) — migración SQL nueva y aditiva

Dos tablas nuevas `material_partners` y `material_lots`, misma forma de `suppliers`
(id text, organization_id uuid, data jsonb, updated_at). **RLS solo de lectura**;
las escrituras van por funciones protegidas `upsert_material_partner`,
`delete_material_partner`, `upsert_material_lot`, `delete_material_lot`, todas
`security definer`, con el `organization_id` resuelto **en el servidor**.

`private.assert_material_lot_payload` valida en la base que `grams`, `costCop` y
`myGrams` sean números válidos y que las salidas tengan gramos válidos.

Es **puramente aditiva** (solo `create if not exists`, `create or replace`, `grant`;
ningún `drop` de tablas). Segura sobre la producción con datos reales.

> ⚠ Quedan **dos** migraciones SQL pendientes de pegar por Héctor: la de
> compradores/joyas (`docs/SQL_PRODUCCION_INVENTARIO.md`, aún sin aplicar) y esta.
> Se le entregarán juntas y en orden en un solo documento cuando estén listas.

---

## 8. Pantallas

### 8.1 "Inventario" con cuatro secciones

`Piedras · Materiales · Joyas · Cobros`. Si "Materiales" aprieta a 320 px, el
selector de secciones pasa a dos filas o etiquetas cortas. Se verifica a 320/390 px.

**Materiales:** resumen arriba (gramos por tipo, y cuánto es mío vs. compartido),
alta de lote (material, pureza, gramos, socio + "¿cuántos gramos son suyos?", costo,
fecha), lista de lotes con su restante y su reparto, y registrar/eliminar salidas.

**Joyas:** la de hoy, con su espacio propio dentro de Inventario y lista para
agrupar por colección cuando exista.

### 8.2 Más → Socios de material

Pantalla igual a Proveedores/Compradores: alta, edición y borrado que **conserva el
nombre en los lotes** con un aviso claro.

### 8.3 Reglas que se mantienen

Español · gramos con `DecimalInput` · COP con `formatCOP` · inputs 16 px · botones
44 px · sin desbordamiento horizontal · overlays con colchón del menú y desplazamiento
interno · nada interno llega a documentos del cliente (los tests de
`pdfContent.test.ts` siguen siendo ley).

---

## 9. Etapas

| Etapa | Entrega | Verificación |
|---|---|---|
| **E1** | Tipos, normalización, motor `materials.ts`, db v7, respaldo v7, storage, dataSource, store | Migración contra base v6 real; motor probado; `collectionId` en joyas |
| **E2** | Nube: outbox, sync, api, importer + SQL | Pruebas de la cadena; borrar/renombrar socio arrastra sus lotes |
| **E3** | Pantallas: sección Materiales + Socios + cablear | Recorrido real en navegador a 320/390/1280 px |

Cada etapa: `npm test && npm run build` en verde antes de seguir. No se toca `main`
ni el workflow de despliegue.

---

## 10. Riesgos

| Riesgo | Control |
|---|---|
| Cambiar el significado de gramos "míos" confunde | Sin socio no se muestra reparto; con socio, la app dice en palabras "180 g míos, 70 del socio" |
| Otra lista de personas más (Socios) | Se explica en la propia pantalla; roles claros: Clientes, Proveedores, Compradores, Socios |
| Dos SQL pendientes para producción | Se entregan juntas, en orden, en un solo documento, cuando E2 esté probado |
| Cuatro secciones en Inventario a 320 px | Se verifica y, si aprieta, dos filas o etiquetas cortas |

**Sin dependencias nuevas.**
