# Mensaje para abrir la sesión de Codex — catálogo y tres fotos

_Escrito por Claude el 2026-08-14. Santiago copia desde la línea marcada hasta el final y
lo pega como primer mensaje en Codex._

---

Proyecto: **Emerald Dealer**, aplicación de gestión para el negocio de joyería y esmeraldas
de Santiago (comerciante en Colombia).

**Carpeta: `~/Dev/emerald-dealer`. Rama de trabajo: `codex/fase2-nube`.**

## Quién es el dueño — esto manda sobre todo lo demás

Santiago es **principiante absoluto**: no programa, no usa terminales, no interpreta
errores. **Nunca le pidas que ejecute comandos ni que lea código.** Pregúntale **solo
decisiones de negocio**, y solo si aparece una que la orden no haya cerrado.

## Punto de partida, verificado hoy

- Último commit de la rama: **`5fb8b51`**.
- **1155 pruebas en 76 archivos, todas en verde.** Compilación en verde.
- Estas cifras están comprobadas, no son de memoria. Si al empezar no coinciden, detente y
  avisa antes de tocar nada.

## Lee esto antes de escribir una línea

1. `CLAUDE.md` y `AGENTS.md` — las reglas inquebrantables.
2. **`docs/ORDEN_CATALOGO_Y_FOTOS.md` — completa.** Es tu orden de trabajo y trae la
   maqueta en milímetros exactos.
3. `DECISIONS.md`, decisiones **D-078, D-079 y D-080** (las tres últimas del archivo).
4. El **final** de `PROJECT_STATE.md`.

## La tarea

Implementa la orden completa, en **dos commits, en este orden**:

- **Commit 1 — tres fotos por joya.** `photo` conserva su significado y se suma
  `extraPhotos: string[]` con tope de dos. Galería en el formulario de Joyas siguiendo el
  patrón que ya existe en `QuoteFormView.tsx`.
- **Commit 2 — el catálogo con documento propio.** Archivo nuevo
  `src/services/catalogPdf.ts`: portada, ficha grande de dos piezas por página y
  contraportada, con las medidas y colores exactos de la orden.

## Lo que NO se toca, bajo ninguna circunstancia

- `src/services/pdfContent.ts` y **`src/services/pdfContent.test.ts`**. Si un cambio tuyo
  rompe esas pruebas, el cambio está mal.
- `renderPdf` y todo el camino del **PDF de cotización** (cliente e interno) y del **Cierre
  del día**. El catálogo se va por archivo propio.
- `src/calc/engine.ts`.
- `main`, el piloto y `.github/workflows/deploy.yml`.
- **Cero dependencias nuevas.** jsPDF ya trae lo que hace falta.
- **Cero migraciones SQL.** Ya está verificado: las joyas viajan como `data jsonb` y los
  validadores del servidor comprueban campos concretos, no una lista cerrada de claves. No
  inventes una migración.

## La regla que está por encima de todo

El catálogo es **lo único de toda la aplicación que sale hacia un cliente**. La cadena de
privacidad de D-065 no se puede debilitar: el constructor del documento recibe
`CatalogJewel[]` y **nunca** `StockJewel[]`, la lista blanca se copia campo por campo, y el
detector de palabras sensibles sigue corriendo sobre el texto final sin forma de continuar
ante un hallazgo. Las 11 pruebas de `catalog.test.ts` se **adaptan a la forma nueva, no se
debilitan**. La sección 6.3 de la orden lo explica entero.

Si necesitas un dato que `CatalogJewel` no tiene, **no lo traigas de la joya**: detente y
pregunta.

## Antes de dar algo por terminado

```bash
npm test && npm run build
```

Y además, sin excepciones:

- Recorrido real en el navegador a **320, 390 y 1280 px**: cargar tres fotos a una joya,
  intercambiar la principal, quitar una, recargar y comprobar que persisten.
- **Generar los dos catálogos** (con precios y sin precios) y abrirlos. Comprobar a ojo:
  portada, dos piezas por página, fotos cuadradas del mismo tamaño, números de pieza,
  contraportada, **sin NIT**, y que no queda ningún recuadro verde de totales.
- Cero errores de consola. Controles de al menos 44 px, campos de 16 px.
- Anotar el resultado en `PROJECT_STATE.md` con número de pruebas y de módulos.
- Commit y push de `codex/fase2-nube`. **Nunca push a `main`**: publica.
- **No publiques nada.** Santiago da esa orden aparte, en su momento.
