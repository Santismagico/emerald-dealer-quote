# Orden de trabajo para Codex — El catálogo presentable y las tres fotos

**Fecha:** 2026-08-14
**Autor:** Claude (arquitectura)
**Rama:** `codex/fase2-nube`
**Origen:** feedback real de un usuario de prueba (2026-08-14)
**Decisiones aplicables:** **D-078**, **D-079**, **D-080** (nuevas) · D-065 · D-044 · D-034 · D-010
**Maqueta aprobada por Santiago:** propuesta visual del 2026-08-14 (portada, ficha grande de dos piezas por página, contraportada)

---

## 0. Qué se te pide, en una frase

Que una joya acepte **hasta tres fotos**, y que el catálogo deje de dibujarse con la
plantilla de las cotizaciones para tener **documento propio**: portada, ficha grande de
dos piezas por página y contraportada. **Dos commits, en este orden.**

---

## 1. Por qué existe esta orden

Un usuario de prueba usó la sección de Joyas y dijo dos cosas, las dos ciertas:

1. **Solo deja adjuntar una foto.** `StockJewel.photo` es un solo texto. Una joya no se
   vende con una foto: se vende con la pieza completa, el detalle y la puesta.
2. **El catálogo es feo y genérico.** No es una opinión discutible, es una consecuencia
   técnica: `createCatalogPdfFile` llama al mismo `renderPdf` de las cotizaciones
   (`src/services/pdf.ts`). Por eso hereda la foto de 46 mm, seis renglones de
   etiqueta/valor por pieza y —lo más grave— **el recuadro verde de totales**, que en una
   cotización es la cuenta a pagar y en un catálogo parece una cuenta de cobro.

Hay un tercer problema que nadie reportó y que sale del mismo sitio: hoy una joya sin
peso registrado le imprime **"Peso: Sin registrar"** al cliente. Eso también se corrige
aquí (§6.6).

---

## 2. Lo que NO se toca, bajo ninguna circunstancia

- `src/services/pdfContent.ts` y **`src/services/pdfContent.test.ts`**. Si un cambio tuyo
  rompe esas pruebas, el cambio está mal.
- `renderPdf` y todo el camino del **PDF de cotización** (cliente e interno) y del
  **Cierre del día**. El catálogo se va por su propio archivo; los documentos que ya
  funcionan no cambian ni un milímetro.
- `src/calc/engine.ts`.
- `main`, el piloto de las 7 joyerías y `.github/workflows/deploy.yml`.
- **Cero dependencias nuevas.** jsPDF ya trae todo lo que hace falta (§6.2).
- **Cero migraciones SQL.** Verificado antes de escribir esta orden: las joyas viajan a la
  nube como `data jsonb` y los validadores del servidor
  (`private.assert_stock_jewel_payload`, `assert_entity_payload`, `assert_stock_jewel_c2_payload`)
  comprueban **campos concretos**, no una lista cerrada de claves. Un campo nuevo dentro
  de la joya entra sin tocar el servidor. No inventes una migración.

---

## 3. Las decisiones de Santiago, ya cerradas

| # | Decisión | Registrada en |
|---|---|---|
| 1 | Formato **ficha grande**: 2 piezas por página | D-079 |
| 2 | **Tres fotos** por joya (1 principal + 2 secundarias) | D-078 |
| 3 | **Sí** al número de pieza visible (01, 02, 03…) | D-080 |

No hay decisiones abiertas. Si al construir aparece una, **pregunta antes de elegir**; no
la resuelvas por tu cuenta.

---

# COMMIT 1 — Tres fotos por joya

## 4. El modelo de datos: `photo` se queda, se agrega `extraPhotos`

```ts
export interface StockJewel {
  // ...
  /** Foto PRINCIPAL en data URL comprimida por la app. Nunca una URL externa. */
  photo: string;
  /** Hasta DOS fotos secundarias, en data URL comprimida. Nunca URLs externas. */
  extraPhotos: string[];
  // ...
}
```

**Por qué así y no un solo `photos: string[]`**, que sería más elegante: porque no lo es.
Durante los días en que un dispositivo todavía corre la versión anterior de la app, ese
dispositivo lee la joya, no entiende `photos`, y al guardarla **la escribe de vuelta sin
foto ninguna**. Con `photo` + `extraPhotos`, el peor caso de esa ventana es perder las dos
fotos secundarias; la principal y todas las joyas que ya existen quedan intactas. Además
**no requiere migrar un solo registro**: `photo` sigue significando exactamente lo que
significa hoy.

**Límite: 2 elementos en `extraPhotos`.** El total por pieza es 3.

## 5. Cadena completa del commit 1

### 5.1 `src/types/index.ts`
Agregar `extraPhotos: string[]` a `StockJewel`, con el comentario de arriba.

### 5.2 `src/services/schema.ts` — única fuente de normalización (D-010)
En `normalizeStockJewel`:

```ts
extraPhotos: safeArray(j.extraPhotos)
  .map((item) => safeImageDataUrl(item))
  .filter((item) => item !== '')
  .slice(0, 2),
```

Cada foto pasa por `safeImageDataUrl`, igual que la principal: una URL externa o un texto
cualquiera **no puede** entrar. Una joya vieja, un respaldo viejo o un dato corrupto
producen `[]`, nunca un fallo.

### 5.3 `src/services/stockJewels.ts`
La pieza en blanco (`photo: ''`) suma `extraPhotos: []`.

### 5.4 `src/utils/images.ts` — comprimir la secundaria más pequeña
`fileToCompressedDataUrl` recibe un segundo parámetro opcional:

```ts
export async function fileToCompressedDataUrl(
  file: File,
  options: { maxDimension?: number } = {}
): Promise<string>
```

Por omisión `MAX_DIMENSION` (1000) — **las cotizaciones y la foto principal no cambian**.
Las fotos secundarias se piden con `{ maxDimension: 700 }`: en el catálogo se imprimen a
29 mm, no necesitan más, y así tres fotos no pesan como tres.

`MAX_SOURCE_IMAGE_BYTES` y `MAX_IMAGE_FILE_BYTES` no se tocan (D-034).

### 5.5 `src/components/StockJewelsView.tsx` — la galería
Sigue el patrón **que ya existe** en `QuoteFormView.tsx` (`MAX_IMAGES = 4`); no inventes
uno nuevo.

- Etiqueta del campo: **`Fotos de la pieza (N de 3)`**.
- La **principal** se muestra grande, como hoy.
- Debajo, una fila de hasta dos miniaturas cuadradas más el botón **`＋`** mientras quede
  cupo.
- Cada foto tiene **Quitar**. Quitar la principal **asciende** a `extraPhotos[0]` si
  existe; no puede quedar una joya con secundarias y sin principal.
- Tocar una secundaria la **intercambia** con la principal. Debajo, el texto de ayuda:
  *"Toca una foto para hacerla la principal."*
- El selector puede traer varias imágenes de una vez: acepta hasta llenar el cupo y, si
  el usuario elige más, avisa **`Máximo 3 fotos por joya.`** sin descartar las que sí
  cupieron.
- Se conserva el clic programático sobre un `input` oculto por el motivo ya documentado
  en ese archivo (PWA de Android).

### 5.6 Respaldo y nube
- `BACKUP_VERSION` **no sube**. Un respaldo anterior importa con `extraPhotos: []` porque
  `normalizeStockJewel` lo resuelve. Confírmalo con una prueba (§5.7).
- Nada que hacer en `sync`, `outbox`, `api` ni SQL: la joya viaja completa como `jsonb`.

### 5.7 Pruebas exigidas del commit 1
1. `normalizeStockJewel` con `extraPhotos` ausente → `[]`.
2. …con 5 fotos → se queda con **2**.
3. …con `extraPhotos: 'texto'`, `null` o un objeto → `[]` sin lanzar.
4. …con una URL externa (`https://…`) dentro del arreglo → esa entrada **no sobrevive**.
5. Un respaldo sin `extraPhotos` importa y deja `[]`, con la foto principal intacta.
6. `fileToCompressedDataUrl` sin opciones produce exactamente el mismo resultado que hoy
   (que la firma nueva no cambie el camino existente).

---

# COMMIT 2 — El catálogo con documento propio

## 6. Arquitectura

### 6.1 Archivo nuevo: `src/services/catalogPdf.ts`
Todo el dibujo del catálogo vive ahí. `src/services/pdf.ts` conserva `renderPdf` para
cotizaciones y cierres, y `createCatalogPdfFile` pasa a delegar en el archivo nuevo.
**El catálogo y la cotización dejan de compartir plantilla** (D-079).

### 6.2 Tipografía: sin dependencias
jsPDF trae las fuentes base del formato PDF. Usa **`times`** para el nombre de la
joyería, el nombre de cada pieza y el precio, y **`helvetica`** para datos y etiquetas.
Eso solo ya separa visualmente el catálogo de la cotización, que es toda Helvetica.
El espaciado entre letras se aplica con la opción que ya existe:
`doc.text(texto, x, y, { charSpace: 1.2 })`.

> Incrustar una tipografía propia (Cormorant Garamond u otra) queda **fuera de alcance**.
> Se evaluará cuando este formato esté funcionando.

### 6.3 LA CADENA DE PRIVACIDAD NO SE PUEDE ROMPER

Esto es lo único de todo el plan que **sale hacia un cliente**. La auditoría de la Fase F
dejó una garantía que hay que conservar entera:

> **La lista blanca no depende de disciplina: la impone el compilador.**
> El constructor del documento recibe `CatalogJewel[]`, **nunca** `StockJewel[]`.

Reglas obligatorias:

- `selectCatalogJewels` sigue siendo el **único** sitio donde se copia campo por campo
  desde `StockJewel`. Suma exactamente un campo: `extraPhotos`. Nada de `{...jewel}`, nada
  de recorrer claves.
- El constructor nuevo tiene firma `(jewels: readonly CatalogJewel[], …)`. Si en algún
  momento necesitas un dato que `CatalogJewel` no tiene, **no lo traigas de la joya**:
  detente y pregunta.
- `prepareCatalogPdfContent` sigue pasando el texto final por
  `findSensitiveWordsInText`; ante un hallazgo devuelve `sensitive` y **no existe forma de
  continuar**.
- La función nueva `catalogContentToPlainText` debe incluir **todas** las cadenas que se
  van a imprimir: nombre de la joyería, líneas de contacto, mes, número de pieza, nombre,
  líneas de datos, precio y mensaje de cierre. Si olvidas una, el detector queda ciego
  justo ahí.
- Las 11 pruebas de `catalog.test.ts` se **adaptan a la forma nueva, no se debilitan**. La
  prueba del número delator (`987654` con `digitsOnly`, que lo atrapa incluso formateado
  como `$ 987.654`) sigue viva y sigue pasando con precios y sin precios.

### 6.4 La forma del contenido

```ts
export interface CatalogPiece {
  /** Número visible SOLO en este archivo: "01", "02"… Jamás el id interno (D-080). */
  code: string;
  name: string;
  /** "Oro 18K · 4,2 g · Talla 7" — vacío si no hay ningún dato. */
  detailLine: string;
  /** "3 piedras naturales" — vacío si no hay piedras registradas. */
  stoneLine: string;
  /** "$ 8.500.000" — vacío cuando el catálogo va sin precios. */
  priceLine: string;
  photo: string;
  extraPhotos: string[];
}

export interface CatalogContent {
  jewelryName: string;
  contactLines: string[];
  /** "Agosto 2026" */
  periodLine: string;
  /** Mensaje comercial de Ajustes. */
  footer: string;
  pieces: CatalogPiece[];
}
```

### 6.5 El número de pieza (D-080)
Es la posición dentro de la lista ya ordenada, empezando en 1, a dos dígitos (`01`, `02`,
… `10`). **Se genera al armar el documento y no se guarda en ninguna parte.** Nunca uses
`jewel.id`: es un dato interno y no tiene por qué viajar. Añade una prueba que confirme
que ningún id aparece en el texto del documento.

### 6.6 Nunca más "Sin registrar" para un cliente
Hoy `historicalNumber` imprime **"Sin registrar"** en el documento del cliente. En un
catálogo eso es un dato faltante puesto en la vitrina. Regla nueva: **lo que no se sabe,
no se escribe.**

- `detailLine`: une con ` · ` únicamente lo que existe → material sin espacios, peso
  (`4,2 g`) solo si es mayor que 0, talla o medida solo si no está vacía. Si no queda
  nada, la línea va vacía y no se dibuja.
- `stoneLine`: con `stoneCount > 0` → `1 piedra natural` / `3 piedras naturales` /
  `3 piedras de fantasía`; con la clase sin registrar → `3 piedras`. Con `stoneCount` en
  0, línea vacía.
- `priceLine`: solo si Santiago pidió precios (D-065 intacta) **y** `priceCop > 0`. Un
  precio en cero no se le muestra a un cliente.
- El nombre de la pieza es lo único que siempre está: si viniera vacío, usa el tipo de
  pieza capitalizado, como hoy.

> **Nota de vocabulario:** la maqueta decía *"3 esmeraldas naturales"*, pero la aplicación
> no registra la especie de la piedra. Escribe **piedras**. No inventes esmeraldas.

## 7. La maqueta, en milímetros

A4 210 × 297 mm. **Margen 20 mm** por los cuatro lados (hoy son 16). Ancho útil 170 mm.

**Colores** (nuevos en este archivo, no toques los de `pdf.ts`):

| Nombre | RGB | Uso |
|---|---|---|
| `EMERALD` | `6, 78, 59` | marca, nombre de pieza, precio |
| `GOLD` | `163, 132, 62` | filetes y número de pieza |
| `INK` | `23, 33, 28` | texto principal |
| `MUTED` | `122, 114, 104` | datos, gris **cálido**, no el gris neutro de las cotizaciones |

### 7.1 Portada (página 1)

| Elemento | Posición y estilo |
|---|---|
| Logo (si existe) | centrado, alto máx 26 mm, ancho máx 40 mm, borde superior en y = 62 |
| Nombre de la joyería | `times bold` 24 pt, EMERALD, centrado, y = 118, `charSpace: 1.1`. Si no cabe en 170 mm, baja a 18 pt |
| Filete dorado | 32 mm centrado (x 89→121), grosor 0.5, y = 132 |
| `CATÁLOGO` | `helvetica` 10 pt, MUTED, centrado, `charSpace: 3.2`, y = 146 |
| Mes y año | `times` 15 pt, INK, centrado, y = 158 |
| Mensaje comercial | `helvetica italic` 9 pt, MUTED, centrado, ancho máx 130 mm, última línea en y = 252 |

El mes va en español con inicial mayúscula (`Agosto 2026`), derivado de `generatedDate`.
Sin reloj dentro del servicio: la fecha llega por parámetro, como hoy.

### 7.2 Páginas de piezas — dos por página, posiciones fijas

Encabezado de cada página de piezas:

| Elemento | Posición |
|---|---|
| Nombre de la joyería en mayúsculas | `times` 11 pt, EMERALD, x = 20, y = 24, `charSpace: 1.4` |
| Mes y año | `helvetica` 8 pt, MUTED, alineado a la derecha en x = 190, y = 24 |
| Filete dorado | x 20 → 190, grosor 0.4, y = 29 |

**Dos ranuras fijas: la pieza 1 arranca en y = 38 y la pieza 2 en y = 157.** Son fijas a
propósito: garantizan que ninguna página se desborde y que todas se vean iguales. Dentro
de cada ranura, con `yTop` como origen:

| Elemento | Posición |
|---|---|
| Foto principal | cuadrada de **76 mm**, x = 20, y = yTop |
| Fotos secundarias | cuadradas de **29 mm**, y = yTop + 80; la primera en x = 20, la segunda en x = 53 |
| Número de pieza | `helvetica bold` 8 pt, GOLD, `charSpace: 1.6`, x = 106, y = yTop + 6 |
| Nombre | `times` 17 pt, INK, x = 106, ancho 84 mm, primera línea en y = yTop + 15, interlínea 8 mm, **máximo 2 líneas** (si sobra, recorta con `…`) |
| Filete corto | 18 mm, grosor 0.25, color `222, 216, 204`, 6 mm bajo la última línea del nombre |
| `detailLine` y `stoneLine` | `helvetica` 8.5 pt, MUTED, x = 106, interlínea 5 mm, empezando 7 mm bajo el filete |
| Precio | `times` 14 pt, EMERALD, x = 106, 10 mm bajo la última línea de datos |

Pie de las páginas de piezas:

| Elemento | Posición |
|---|---|
| Mensaje comercial | `helvetica italic` 8 pt, MUTED, centrado, ancho máx 150 mm, y = 283 |
| Número de página | `helvetica` 7.5 pt, MUTED, derecha en x = 190, y = 283 |

Portada y contraportada **no llevan número de página**.

### 7.3 Contraportada (última página)

| Elemento | Posición |
|---|---|
| Nombre de la joyería | `times` 18 pt, EMERALD, centrado, y = 120, `charSpace: 1.2` |
| Líneas de contacto | `helvetica` 9.5 pt, INK, centradas desde y = 132, interlínea 6 mm |
| Filete dorado | 32 mm centrado, grosor 0.4, 10 mm bajo la última línea |
| Cierre | `helvetica italic` 8.5 pt, MUTED, centrado, 12 mm más abajo: *"Para reservar una pieza, indícanos su número."* |

**El catálogo NO lleva NIT.** Decisión de Santiago del 2026-08-14: un catálogo es una
pieza comercial, no un documento tributario, y el número de identificación del negocio no
tiene por qué circular por WhatsApp entre desconocidos.

Quita esa línea de `customerContactLines` en `src/services/catalog.ts:103`. Esa función es
**exclusiva del catálogo** —ya lo verifiqué—, así que el cambio no toca ningún otro
documento: el PDF de cotización conserva su NIT en `src/services/pdfContent.ts:114` y **no
se modifica**.

Quedan entonces: dirección y ciudad, teléfono y WhatsApp, y correo. Cualquiera de esas
líneas se omite si está vacía, como hoy.

### 7.4 Recorte cuadrado — la regla que más se nota
Hoy cada foto conserva su proporción y la página queda despareja. Nuevo helper en
`catalogPdf.ts`:

```ts
async function cropToSquare(dataUrl: string, targetPx: number): Promise<string>
```

Recorte **centrado tipo "cubrir"**: toma el cuadrado más grande que quepa en el centro de
la foto y escálalo a `targetPx`. Fondo blanco antes de dibujar, salida JPEG.

- Foto principal: `targetPx = 1000`, calidad **0.72** (76 mm a 1000 px ≈ 330 ppp: imprime
  nítido). Reemplaza el `CATALOG_IMAGE_MAX_PX = 640` actual, que a este tamaño se vería
  borroso.
- Fotos secundarias: `targetPx = 420`, calidad **0.68**.
- Una foto ilegible se omite sin impedir que la pieza aparezca, exactamente como hoy.
- Una pieza **sin foto** ocupa su ranura igual, con el texto en su sitio; no se dibuja
  marco ni recuadro vacío.

Peso estimado: ~180 KB por pieza con tres fotos → 24 piezas ≈ 4,5 MB. El tope de 15 MB y
su mensaje en pantalla (`CatalogPdfTooLargeError`) **se conservan tal cual**.

## 8. Pruebas exigidas del commit 2

1. **Privacidad (adaptadas, no debilitadas):** las 11 actuales de `catalog.test.ts`,
   incluida la del número delator, con precios y sin precios.
2. `priceCop` no aparece por ninguna parte cuando el catálogo va sin precios.
3. **Ningún `jewel.id` aparece** en el texto del documento; los números de pieza son
   `01, 02, 03…` en el orden ya ordenado.
4. `catalogContentToPlainText` incluye número, nombre, ambas líneas de datos, precio,
   contacto y cierre. *(Prueba concreta: una pieza cuyo nombre contenga una palabra
   sensible debe bloquear la salida.)*
5. Nunca aparece la cadena **"Sin registrar"** en el contenido del catálogo.
6. Peso 0, talla vacía, `stoneCount` 0 y clase sin registrar → líneas omitidas, sin
   ` · ` sueltos ni espacios dobles.
7. Precio en 0 con precios activados → no se imprime línea de precio.
8. Una joya con 3 fotos aporta 3 imágenes; con 1 foto aporta 1 y no falla; con 0 fotos
   sigue apareciendo en el catálogo.
9. El tope de 15 MB sigue disparando `CatalogPdfTooLargeError`.
10. `renderPdf` y el PDF de cotización quedan **sin un solo cambio de comportamiento**:
    las pruebas de `pdf.test.ts` y `pdfContent.test.ts` pasan sin tocarlas.
11. **El NIT no aparece en el catálogo.** Con un NIT configurado en Ajustes, ni la cadena
    `NIT` ni el número aparecen en el contenido del catálogo (compáralo con `digitsOnly`,
    igual que la prueba del número delator). La misma prueba debe confirmar que el PDF de
    cotización **sí lo conserva**: son dos documentos distintos y esa diferencia es
    deliberada.

---

## 9. Verificación final obligatoria (los dos commits)

```bash
npm test && npm run build
```

Además, y sin excepciones:

- Recorrido real en navegador a **320, 390 y 1280 px**: cargar tres fotos a una joya,
  intercambiar la principal, quitar una, recargar y comprobar que persisten.
- **Generar los dos catálogos** (con precios y sin precios) y abrirlos. Comprobar a ojo:
  portada, dos piezas por página, fotos cuadradas del mismo tamaño, números de pieza,
  contraportada, y que **no aparece ningún recuadro verde de totales**.
- Cero errores de consola, controles de al menos 44 px, campos de 16 px.
- Anotar en `PROJECT_STATE.md` el resultado con número de pruebas y de módulos.

---

## 10. Fuera de alcance a propósito

- El formato **cuadrícula** (4 piezas por página) y el de **página completa**. Santiago
  eligió ficha grande; los otros dos quedan como opción futura, no se construyen ahora.
- Incrustar una tipografía propia.
- Colecciones (`collectionId` sigue reservado y sin uso).
- Mover las fotos a almacenamiento de archivos en la nube en vez de data URL. Es la
  solución de fondo al peso si el inventario crece mucho, pero cambia la regla *"nunca una
  URL externa"* y necesita su propia decisión.
