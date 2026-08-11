# Auditoría de Claude — Correcciones R1 de la prueba de Santiago

**Fecha:** 2026-08-04
**Auditor:** Claude (independiente; no escribió este código)
**Rama:** `codex/fase2-nube`
**Commits auditados:** `81335b4` (C1 Excel) · `500206e` (C2 bruto/tallado) · `27a723c` (C3 joya visible) · `1a2088c` (C4 borrar lote)
**Orden auditada:** `docs/V2_ORDEN_CORRECCIONES_SANTIAGO_R1.md`
**Decisiones:** D-066 · D-067 · D-068 · D-069

---

## Veredicto

# APROBADO

Las cuatro correcciones están bien resueltas. Verifiqué el Excel **abriendo el archivo
real por dentro** y la corrección de la joya **usando la aplicación**.

Hay una observación que **me corrige a mí, no a Codex** (§6.1).

No publiqué nada, no modifiqué `main` y no modifiqué el workflow de despliegue.

---

## 1. Verificación mecánica

| Comprobación | Resultado |
|---|---|
| `npm test` | **APROBADO** — 981 pruebas en 67 archivos (antes 970 en 66) |
| `npm run build` | **APROBADO** |
| `npm run test:public-cloud` | **APROBADO** |
| `npm run security:secrets` | **APROBADO** |
| `main` intacto | **SÍ** — `0a86e5a` |

`src/calc/engine.ts`, `src/services/pdfContent.test.ts` y el workflow: **sin cambios**.

**Nota de método:** al principio creí que faltaba el commit del Excel, porque busqué solo
desde la orden R2. Estaba antes en la historia. **No hubo tal ausencia.**

---

## 2. C1 · El Excel — verificado abriendo el archivo

### La dependencia cumple las cinco condiciones

| Condición (D-066) | Resultado |
|---|---|
| Solo `write-excel-file` | **Sí**, es la única añadida |
| Versión exacta | **`"write-excel-file": "4.1.1"`**, sin `^` |
| Carga diferida | **Sí** — `import('write-excel-file/browser')` |
| Sin cambios de CSP | **Sí**, `test:public-cloud` aprobado |
| Peso reportado | Trozo aparte de **151 kB (49 kB comprimidos)**; el paquete principal no lo incluye |

### Abrí el archivo generado y miré su interior

Generé un cierre desde la aplicación, capturé el archivo, lo descomprimí y leí su XML:

| Comprobación | Resultado |
|---|---|
| Estructura | `[Content_Types].xml`, `xl/workbook.xml`, `sheet1.xml`, `styles.xml`, `sharedStrings.xml` — un `.xlsx` correcto |
| **Encabezados fijos** | `<pane ySplit="6" state="frozen"/>` — **sí** |
| **Anchos de columna** | `width="33"`, `34`, `24`, `11`, `24` — calculados, no por defecto |
| **Dinero como número** | 9 celdas numéricas `<v>` **sin** `t="s"`: son números, se pueden sumar |
| **Formato de moneda** | `"$" #,##0;[Red]-"$" #,##0` — miles, símbolo y **negativos en rojo** |
| **Fechas como fechas** | `46238.5` con formato `dd/mm/yyyy` |
| Colores | banda `#0F5B46`, grises `#374151`/`#F3F4F6`, total `#ECFDF5`, texto blanco |

Es exactamente la estructura que Santiago aprobó. **Este archivo abre bien en Excel en
español y sus números son sumables**, que era todo el punto de pedirlo.

La prueba de Codex también es buena: comprueba la firma `PK\x03\x04` y el tipo MIME
oficial, es decir que el contenedor es un `.xlsx` de verdad y no un texto renombrado.

---

## 3. C2 · Bruto o tallado

`StoneLot` gana **`purchaseOrigin?: StoneOrigin`** —opcional, de modo que los lotes
existentes se leen como `'bruto'` a través de `stoneLotPurchaseOrigin`
(`src/services/stones.ts:29-30`)—. Las existencias se reparten según el origen
(`:190-194`): comprado en bruto va al montón de bruto, comprado tallado al de talladas.

Existe la migración **`20260804184500_compra_lote_bruto_tallado.sql`**, que valida
`purchaseOrigin` en el servidor y renombra las funciones anteriores en vez de romperlas.
La lección H1 se respetó.

---

## 4. C3 · La joya vendida — verificado usando la aplicación

Creé una joya, la vendí y miré qué pasaba. **Antes de la corrección, aquí aparecía
"Sin piezas".** Ahora:

- La pieza **permanece visible** con toda su venta: fecha, comprador, medio de pago,
  quién recibió, tasa, costo y resultado.
- Sus cuatro acciones están presentes y **ahora se ven como botones**:

| Botón | Borde | Fondo | Alto |
|---|---|---|---|
| Editar venta | sí | verde tenue | 44 px |
| Deshacer venta | sí | blanco | 44 px |
| Editar pieza | sí | blanco | 44 px |
| Eliminar | sí | rojo tenue | 44 px |

Antes los cuatro eran texto sin borde ni fondo. Las dos mitades del hallazgo quedaron
corregidas.

---

## 5. C4 · Borrar el lote

El bloqueo *"Este lote no se puede eliminar porque ya respalda piedras usadas en joyas"*
**ya no existe** en `StonesView.tsx`. La prueba
`stoneJewelTransformation.test.ts:299` — *"conserva una historia autosuficiente cuando el
lote ya fue eliminado"* — cubre justamente el caso: la joya sobrevive al borrado del lote
con su costo y su historia.

---

## 6. Observaciones

### O1 — Me equivoqué al describirle el peso a Santiago

Le dije que la librería del Excel *"solo se carga cuando exportas, así que la app no se
vuelve más lenta de abrir ni ocupa más en tu teléfono"*. **La segunda mitad es falsa.**

Comprobé el manifiesto del service worker: el trozo `index.es-*.js` **sí está
precargado**, así que se descarga al instalar. Son unos **49 kB comprimidos** más.

**La implementación es correcta y no pido cambio**, por una razón que al revisarlo me
parece mejor que la alternativa: si no se precargara, **exportar sin internet fallaría**,
y esta aplicación es de uso sin conexión por diseño. El intercambio —49 kB a cambio de
que el Excel funcione sin señal— es el correcto.

Lo que estuvo mal fue mi frase, no el código. Queda corregido aquí.

### O2 — El verde del Excel no es el de la aplicación, y no está documentado

`EMERALD = '#0F5B46'` (`excelExport.ts:5`), más oscuro que el acento `#0b7f57`. Se usa
como fondo de la banda con texto blanco y como color de los rótulos de sección sobre gris
claro; en ambos casos un verde más profundo da mejor contraste, así que la elección es
correcta. **Pero no hay una línea que lo explique**, y el proyecto exige registrar por
escrito las desviaciones de la identidad. Deuda de documentación, no de código.

### O3 — Sigo sin abrir Microsoft Excel

Verifiqué el interior del archivo —estructura, paneles congelados, tipos de celda,
formatos y colores—, que es mucho más que la vez pasada. Pero **no lo abrí en Excel**: no
está disponible aquí. La comprobación es fuerte pero indirecta. **Basta con que Santiago
abra uno y sume una columna** para cerrarlo del todo.

### O4 — Sigue pendiente la prueba N6

Sin cambios. Santiago decidió resolverla al publicar.

---

## 7. Estado y siguiente paso

R1 **aprobada** y **sin publicar**. `main` y las 7 joyerías del piloto no fueron tocadas.

Queda desbloqueada **R2** (`docs/V2_ORDEN_CORRECCIONES_SANTIAGO_R2.md`): un solo
vocabulario de navegación y la gráfica del inicio. La orden ya está escrita y aprobada por
Santiago.
