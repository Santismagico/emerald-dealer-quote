# Orden de trabajo para Codex — Plan v2, Fase F (el catálogo)

**Fecha:** 2026-08-04
**Autor:** Claude (arquitectura)
**Rama:** `codex/fase2-nube`
**Base:** `138b3d8` (auditoría de la Fase E, aprobada)
**Punto de restauración:** tag `punto-seguro-pre-v2-2026-08-03`
**Plan completo:** `docs/PLAN_MAESTRO_V2.md`
**Decisiones aplicables:** **D-065** (nueva) · D-056 · D-050 · D-033

---

## 0. Qué se te pide, en una frase

Construir el **catálogo en PDF** que se arma solo desde el inventario real de joyas,
en **un commit**.

---

## 1. Lee esto antes que nada

Las cinco fases anteriores construyeron herramientas **internas**: todo se queda en
los dispositivos de Santiago. **Esta es distinta.**

> **El catálogo es lo único de todo el plan v2 que sale hacia un cliente.**

Un error aquí no se ve como un número mal sumado: se ve como **el costo de una
pieza en manos de la persona a la que se la estás vendiendo**. No se puede
deshacer: el archivo ya se envió.

Por eso esta fase tiene una regla de diseño propia, que está por encima de
cualquier consideración de comodidad:

> ### El catálogo se construye por lista blanca, nunca por lista negra.

No armes el documento a partir de la joya y le quites lo confidencial. **Arma el
documento a partir de una lista explícita de campos permitidos**, de modo que un
campo nuevo que alguien agregue mañana a `StockJewel` **no pueda** aparecer solo.

Nada de `{...jewel}`, nada de recorrer las claves del objeto, nada de "todo menos
estos campos". Campo por campo, escritos a mano.

---

## 2. Los campos permitidos — y solo estos

| Campo | Origen |
|---|---|
| Nombre de la pieza | `name` |
| Tipo | `pieceType` |
| Material | `material` |
| Foto | `photo` |
| Peso | `weightGrams` |
| Talla o medida | `size` |
| Número de piedras | `stoneCount` |
| Clase de piedra | `stoneKind` |
| Precio | `priceCop` — **solo si Santiago lo pidió** (§4) |

**Prohibido, sin excepción:** `costCop`, `notes`, `sale` y todo lo que contenga,
`acquiredDate`, `collectionId`, `status`, `createdAt`, `updatedAt`, la
transformación fantasía→natural y cualquier dato de socios, lotes, compradores o
proveedores.

**`notes` es la trampa más peligrosa** porque es texto libre: puede contener lo que
sea, incluido el precio al que se compró. No lo incluyas en ninguna forma.

---

## 3. Qué piezas entran

Solo las que están **realmente disponibles para ofrecer**: ni vendidas ni
apartadas. Una pieza vendida en el catálogo hace quedar mal a Santiago frente al
cliente.

**Se puede generar filtrado por clase de piedra** (D-056): solo naturales, solo
fantasía, o todas. Ese era el objetivo del negocio: saber qué se le puede ofrecer a
cada quien.

Una pieza con `stoneKind: ''` (**sin registrar**) **no entra en el catálogo de
naturales ni en el de fantasía**. Solo aparece en "todas", y como *Sin registrar*.
No adivines su clase.

---

## 4. El precio es una elección de cada generación (D-065)

Santiago decide **al generar el catálogo** si lleva precios o no.

Cuando elige **sin precios**, el precio **no puede aparecer en ninguna parte del
archivo**: ni en la ficha, ni en un pie, ni en un resumen, ni en un total. Un
precio omitido de la vista pero presente en el documento es **peor** que uno
visible, porque nadie lo revisaría.

---

## 5. Las dos capas de protección

### Capa 1 — estructural (la que de verdad protege)

La lista blanca de §1 y §2. Un `costCop` no puede llegar al documento porque
**nunca se lee** para construirlo.

### Capa 2 — el detector que ya existe

El catálogo es una salida al cliente, así que pasa por el mismo control que el PDF
de cotización: construye un `PdfContent`, aplánalo con `contentToPlainText` y
pásalo por `findSensitiveWordsInText` antes de renderizar. Si hay hallazgo, **la
salida se bloquea**; no existe confirmación para saltársela.

**Entiende por qué hacen falta las dos.** El detector busca *palabras* como "costo"
o "margen". **No puede** detectar que imprimiste `1200000` en vez de `1800000`: un
número no tiene palabras. Contra eso solo protege la lista blanca. Si te apoyas
solo en el detector, la fase está mal hecha aunque pase.

---

## 6. Las pruebas que decido yo, y son obligatorias

1. **La prueba del número delator.** Crea una joya con un `costCop` de valor único e
   irrepetible (por ejemplo `987654`) y un `priceCop` distinto. Genera el catálogo
   —con precios y sin precios— y afirma que **la cadena `987654` no aparece en
   ninguna parte del contenido**. Repítelo para una nota interna con un texto
   inconfundible.
2. **Sin precios significa sin precios.** Con la opción desactivada, el `priceCop`
   tampoco aparece en el texto plano del documento.
3. **Nada vendido ni apartado** aparece en el catálogo.
4. **El filtro de clase** deja fuera lo que no corresponde, y *sin registrar* no
   entra en naturales ni en fantasía.
5. **El detector se ejecuta** sobre el contenido final y bloquea la salida ante un
   hallazgo.
6. `src/services/pdfContent.test.ts` sigue **sin cambios y pasando**.

---

## 7. Cómo se entrega el archivo

- **Descarga directa** en el dispositivo, y **compartir con el mismo mecanismo que
  ya existe** para el PDF del cliente (Web Share nivel 2 con descarga de respaldo,
  D-017). No inventes un canal nuevo.
- Reutiliza `renderPdf` y la maquinaria de `PdfContent`. **Sin dependencias
  nuevas.**
- **Cuida el peso del archivo.** Las fotos van comprimidas por la app (D-033). Un
  catálogo de muchas piezas puede volverse imposible de mandar por WhatsApp: limita
  el tamaño de las imágenes en el documento y, si el archivo queda muy grande,
  **dilo en la pantalla** en vez de generar algo que no se puede enviar.
- Una pieza sin foto no rompe el documento: se muestra sin ella.

---

## 8. Reglas que NO se rompen (confírmalas al entregar)

1. `main`, el enlace del piloto y `.github/workflows/deploy.yml` **sin tocar**.
   **Nada publicado.**
2. `src/calc/engine.ts` y `src/services/pdfContent.test.ts` sin cambios.
3. **Sin dependencias nuevas.**
4. **Ningún cambio de datos:** cero migraciones, cero campos nuevos. El catálogo se
   deriva de lo que ya existe.
5. Los cierres, el panel y el consolidado siguen dando exactamente lo mismo.
6. Textos en español; 320/390/1280 px sin desbordamiento; botones ≥ 44 px.

---

## 9. Entregable

Un commit, con el resultado literal de `npm test` y `npm run build`, qué
verificaste en navegador y en qué anchos, y `PROJECT_STATE.md`, `DECISIONS.md` y la
bitácora actualizados.

**Además, y es lo que más me sirve para auditar:** escribe **la lista exacta de
campos que tu código lee de `StockJewel` para construir el documento**. Si esa
lista es más larga que la tabla de §2, explica por qué.

**Numeración de decisiones:** antes de agregar una a `DECISIONS.md`, busca el
número más alto que ya exista. La más alta hoy es **D-065**. Hubo un choque el
2026-08-04 y no debe repetirse.

**Esta es la última fase del plan v2.** Al terminarla, Claude hará una auditoría de
privacidad aparte antes de que Santiago considere publicar cualquier cosa.
