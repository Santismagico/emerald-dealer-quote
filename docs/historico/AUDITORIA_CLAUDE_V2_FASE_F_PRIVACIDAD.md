# Auditoría de privacidad de Claude — Plan v2, Fase F (el catálogo)

**Fecha:** 2026-08-04
**Auditor:** Claude (independiente; no escribió este código)
**Rama:** `codex/fase2-nube`
**Commit auditado:** `1155abf`
**Base de comparación:** `ca2ed53`
**Orden auditada:** `docs/V2_ORDEN_DE_TRABAJO_CODEX_FASE_F.md`
**Decisiones aplicables:** D-065 · D-056 · D-017 · D-033

---

## Veredicto

# APROBADO

El catálogo **no filtra información interna**. Lo verifiqué de tres formas
independientes: leyendo el código completo, revisando las pruebas, y **generando
catálogos reales y escaneando yo mismo los bytes del PDF**.

Esta es la única salida al cliente de todo el plan v2 y por eso recibió una
auditoría aparte.

---

## 1. Verificación mecánica

| Comprobación | Resultado |
|---|---|
| `npm test` | **APROBADO** — 970 pruebas en 66 archivos (antes 957 en 65) |
| `npm run build` | **APROBADO** |
| `npm run test:public-cloud` | **APROBADO** |
| `npm run security:secrets` | **APROBADO** |
| `main` intacto | **SÍ** — `0a86e5a` |

**Sin dependencias nuevas. Cero migraciones.** `src/calc/engine.ts` y
`src/services/pdfContent.test.ts` **sin cambios**.

---

## 2. La lista blanca es real, y el lenguaje la hace cumplir

Leí `src/services/catalog.ts` completo (162 líneas). La protección no depende de
disciplina, sino de la estructura:

- El tipo `CatalogJewel` (`:22-32`) contiene **únicamente** los campos permitidos.
  No existe `costCop`, `notes`, `sale`, `status`, `acquiredDate` ni
  `collectionId`.
- `selectCatalogJewels` (`:73-86`) copia **campo por campo**. No hay `{...jewel}`
  ni recorrido de claves.
- **Y lo más fuerte:** `buildCatalogPdfContent` recibe `readonly CatalogJewel[]`,
  **no** `StockJewel[]`. El sistema de tipos **impide** que una joya completa
  llegue al constructor del documento. Un campo que alguien agregue mañana a
  `StockJewel` no puede aparecer solo: no hay camino por donde llegue.
- `status` y `sale` se leen solo para **decidir si la pieza entra**, nunca para
  imprimirse. El comentario del código lo dice y el código lo cumple.

Esto es exactamente lo que pedía §1 de la orden, y está mejor resuelto de lo que
especifiqué: yo pedí una convención, Codex la convirtió en una garantía del
compilador.

---

## 3. El precio opcional (D-065)

- `priceCop?: number` es **opcional** y solo se asigna cuando
  `options.includePrices` (`:84`). Cuando va sin precios, la propiedad **ni
  siquiera existe** en el objeto: no hay nada que filtrar.
- `totals: []` y `totalLine: ['PIEZAS DISPONIBLES', <cantidad>]` (`:141-142`). El
  total es un **conteo de piezas, no una suma de dinero**. Así, ni con precios
  activados se publica el valor total del inventario. **No lo pedí y es correcto.**
- En la pantalla, los precios vienen **apagados por defecto**, con el aviso *"El
  PDF no llevará precios"*. El valor por defecto seguro es la decisión acertada.

---

## 4. Las dos capas

- **Capa estructural:** la de §2.
- **Capa del detector:** `prepareCatalogPdfContent` (`:151-162`) aplana el
  contenido final y lo pasa por `findSensitiveWordsInText`. Si hay hallazgo
  devuelve `{ status: 'sensitive' }` **sin contenido**, así que no existe nada que
  renderizar: **el bloqueo no se puede saltar**, ni siquiera por error de quien
  llame a la función.

---

## 5. Mi propia verificación sobre PDF reales

No me quedé en las pruebas de Codex. Creé en la aplicación una joya trampa:

- **Costo:** `$ 987.654`
- **Precio:** `$ 7.654.321`
- **Nota interna:** `NOTA-INTERNA-31415926 lo compre barato`
- Clase: Natural · Estado: Disponible

Generé los dos catálogos y **escaneé los bytes crudos del PDF**:

| | Sin precios | Con precios |
|---|---|---|
| Archivo válido | PDF, 6.411 bytes | PDF, 6.624 bytes |
| ¿Comprimido? | **No** — la búsqueda es concluyente | **No** |
| Costo `987654` | **AUSENTE** | **AUSENTE** |
| Nota `31415926` / `NOTA-INTERNA` | **AUSENTE** | **AUSENTE** |
| Precio `7654321` | **AUSENTE** (correcto) | Presente (correcto) |
| Palabras *costo/margen/utilidad/ganancia* | — | **AUSENTES** |
| Nombre de la pieza | Presente | Presente |

**Dos notas de método que hacen válida esta prueba:**

1. El PDF **no usa compresión** (`/FlateDecode` ausente), así que un resultado
   negativo significa de verdad que el dato no está, y no que esté escondido tras
   un algoritmo.
2. Comprobé que el **nombre de la pieza sí aparece**. Eso demuestra que mi
   búsqueda encuentra contenido cuando lo hay: los "ausente" de arriba no son un
   falso negativo sobre un documento vacío.

---

## 6. El resto de la orden

- **Solo piezas disponibles:** doble condición `status === 'disponible' && sale ===
  null` (`:69-70`). La pantalla lo dice: *"Las vendidas y apartadas quedan fuera."* ✔
- **Filtro por clase de piedra:** naturales, fantasía o todas; una pieza *sin
  registrar* **no entra** en naturales ni en fantasía, solo en "todas". ✔
- **Peso del archivo:** existe la prueba *"bloquea un archivo que supera el límite
  antes de entregarlo"*. Se atendió el riesgo de generar un catálogo imposible de
  mandar por WhatsApp. ✔
- **Entrega:** descarga directa y Web Share con descarga de respaldo, reutilizando
  el mecanismo existente (D-017). Sin canal nuevo. ✔
- **Pieza sin foto** no rompe el documento. ✔
- **Medidas:** sin desbordamiento a 320, 375 ni 1280 px; ningún botón bajo 44 px;
  **consola sin errores.** ✔

**Sobre la prueba del número delator que exigí:** existe y está **mejor construida
que mi especificación**. Convierte el texto a solo dígitos antes de buscar
(`digitsOnly`), de modo que atrapa el costo aunque se imprima formateado como
`$ 987.654`. Mi versión habría dejado pasar ese caso.

---

## 7. Observaciones

### O1 — El catálogo incluye los datos de contacto del negocio

`customerContactLines` añade dirección, ciudad, teléfono, WhatsApp, correo y
**NIT**. Es correcto —son los datos que el negocio quiere que el cliente tenga, y
el PDF de cotización ya los lleva— pero conviene que quede dicho: **el catálogo
identifica públicamente al negocio**, incluido su NIT. Si alguna vez Santiago
quisiera un catálogo anónimo, hoy no lo es. **No pido cambio.**

### O2 — Riesgo residual sin cambios: la prueba N6

Esta fase no toca la nube. Sigue pendiente y Santiago decidió resolverlo al
publicar.

---

## 8. Estado

Fase F **aprobada** y **sin publicar**.

**Con esto el PLAN MAESTRO v2 queda COMPLETO:** seis fases, todas construidas por
Codex y auditadas de forma independiente por Claude. `main` y las 7 joyerías del
piloto no fueron tocadas en ningún momento.

Lo que sigue **ya no es técnico**: decidir con Santiago **si publicar, cuándo y
cómo**, y resolver antes el único punto que quedó abierto desde la Fase B — la
demostración en vivo de que una joyería no ve los datos de otra.
