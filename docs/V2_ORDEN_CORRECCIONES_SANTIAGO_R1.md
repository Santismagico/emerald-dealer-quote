# Orden de trabajo para Codex — Correcciones de la prueba de Santiago (R1)

**Fecha:** 2026-08-04
**Autor:** Claude (arquitectura)
**Rama:** `codex/fase2-nube`
**Base:** `63e8d56` (plan v2 completo y auditado)
**Punto de restauración:** tag `punto-seguro-pre-v2-2026-08-03`
**Decisiones que la gobiernan:** **D-066 · D-067 · D-068 · D-069** (nuevas)

---

## 0. Qué se te pide, en una frase

Corregir **cuatro hallazgos que Santiago encontró usando la aplicación**, en **cuatro
commits separados**.

---

## 1. De dónde salen estas correcciones

Las seis fases del plan v2 quedaron construidas y auditadas. Después **Santiago probó
la aplicación** y encontró estas cuatro cosas.

Vale la pena decirlo porque orienta el trabajo: **dos de los cuatro hallazgos no son
errores de código**, son consecuencias de decisiones de diseño que tomé yo y que en la
práctica no funcionan. Corrígelas como lo que son —diseño equivocado, no descuido de
implementación— y no busques culpables en el código existente.

Este proyecto tiene un antecedente claro: las pruebas de usuario de Santiago han
encontrado defectos que ninguna revisión técnica vio. Trata estos cuatro con el mismo
peso que un hallazgo de auditoría.

---

## 2. C1 · El Excel con formato real

**Decisión:** D-066. **Es el hallazgo que más le importa a Santiago.**

### El problema

El archivo actual es un **CSV**: texto plano. No admite formato de ninguna clase. No es
mejorable dentro de ese formato.

### Qué se construye

Exportación a **`.xlsx` real** para los cierres, el panel y el consolidado, con:

- **Dinero formateado como dinero**, con separador de miles y símbolo; **negativos en
  rojo**. Deben seguir siendo **números** para Excel, no texto: que se puedan sumar.
- **Anchos de columna calculados** para que no haya que arrastrarlos.
- **Encabezados fijos** (`freeze panes`) al desplazarse.
- **Secciones distinguibles** y **totales resaltados**.
- Una fila que identifique el documento como **interno**.
- Fechas como fechas, no como texto.

### La estructura aprobada por Santiago (2026-08-04)

Vio una maqueta y la aprobó tal cual. Constrúyela así; si algo queda ambiguo,
**pregunta antes de inventar**.

De arriba abajo, en cada hoja:

| Fila | Contenido | Formato |
|---|---|---|
| 1 | `CIERRE DEL DÍA · <nombre de la joyería>` | Banda verde esmeralda de ancho completo, texto blanco, negrita |
| 2 | `Fecha` + la fecha | Etiqueta en gris oscuro, valor normal |
| 3 | `Documento` + `Interno · no entregar al cliente` | Gris tenue |
| 4 | — | Fila vacía de separación |
| 5 | Rótulo de sección, ej. `RESUMEN DEL DÍA` | Fondo gris muy claro, texto esmeralda, negrita, espaciado de letras |
| 6 | Encabezados de columna | Fondo gris claro, negrita, **borde inferior grueso** |
| 7+ | Los datos | Dinero a la derecha; **negativos en rojo** |
| última | `TOTAL …` | Negrita, **borde superior grueso**, fondo apenas distinto |

Y entre secciones, otra fila vacía y otro rótulo.

**Reglas del formato, no negociables:**

- **Los importes son números de verdad**, con formato de moneda de Excel. No los
  escribas como texto ya formateado: Santiago tiene que poder sumarlos.
- **Encabezados fijos** con `freeze panes`, en la fila de encabezados de la primera
  sección.
- **Anchos de columna calculados** según el contenido más largo de cada una.
- Las **fechas van como fechas**, no como texto.
- Los quilates con decimales; el dinero sin decimales (COP entero).

**Una hoja por documento**, y cuando haya detalle largo, una segunda pestaña
`Detalle`. Las pestañas llevan nombre legible en español.

### La dependencia

Se autoriza **`write-excel-file`**, y solo esa. Condiciones que forman parte de la
autorización (D-066):

1. **Versión exacta fijada**, sin `^` ni `~`.
2. **Carga diferida** con `import()` dinámico, **igual que ya se hace con
   `@supabase/supabase-js`** en `src/services/cloud/config.ts`. La aplicación no puede
   volverse más pesada de abrir ni de instalar.
3. **Sin cambios en la CSP** ni destinos de red nuevos. Compruébalo.
4. `npm run test:public-cloud` y `npm run security:secrets` deben seguir aprobando.
5. Registra en el commit el tamaño real que agrega al paquete.

**Si descubres que la librería no cumple alguna de estas condiciones, detente y
escríbelo.** No la sustituyas por otra por tu cuenta.

### Verificación

- El PDF de los cierres **se conserva**; el Excel se suma, no reemplaza.
- Sigue siendo **interno**: se descarga en el dispositivo, nunca se comparte.
- Prueba con datos que incluyan **negativos, decimales y tildes**.

---

## 3. C2 · El lote se compra en bruto o ya tallado

**Decisión:** D-067.

### El problema

Hoy `summarizeStoneLot` hace aterrizar **toda** la compra en la existencia en bruto
(`src/services/stones.ts:184-188`), y la existencia tallada **solo** puede venir de
tandas regresadas (`:189-192`). Comprar piedras ya talladas obliga a inventar una tanda
con 0% de merma. **Es un vacío del modelo de D-055, mío, no un error tuyo.**

### Qué se construye

`StoneLot` gana **`purchaseOrigin: 'bruto' | 'tallado'`**, elegido al registrar la
compra.

- `'bruto'` → se comporta **exactamente como hoy**.
- `'tallado'` → los quilates y piedras comprados entran a la **existencia tallada**; el
  lote **no admite tandas de talla** y **no muestra merma**, porque no la tuvo.

### Reglas

- **Los lotes existentes normalizan a `'bruto'`.** Prueba obligatoria de que conservan
  idénticas existencias, dinero y resultado.
- La validación de "no admite tandas si se compró tallado" va **en el dispositivo y en
  el servidor** (lección H1).
- Un lote comprado tallado sigue admitiendo ventas, usos internos hacia joyas, crédito y
  reparto con socios, como cualquier otro.
- El costo por quilate para atribuir a ventas y usos internos se calcula igual.

---

## 4. C3 · La joya vendida no puede perderse de vista

**Decisión:** D-068.

### El problema

Santiago dijo *"cuando registro que vendí una joya, no puedo editar eso"*. **La función
existe**: `Editar venta` y `Deshacer venta` están en la ficha
(`src/components/StockJewelsView.tsx:786-806`).

Lo que pasa es otra cosa, y lo reproduje: al vender, la pieza **sale del filtro "En
vitrina"**, que es el que viene puesto, y la lista queda mostrando **"Sin piezas"**. La
joya se desvanece. Desde el lado del dueño, eso es idéntico a que la función no exista.

### Qué se construye

1. **Registrar una venta no puede dejar al dueño mirando una lista vacía.** Tras
   guardar, la pieza recién vendida debe quedar **visible y alcanzable** —cambiando el
   filtro, mostrando un aviso que lleve a ella, o como mejor encaje—. Elige una vía y
   **explica cuál y por qué** al entregar.
2. **Las acciones deben verse como acciones.** `Editar venta`, `Deshacer venta`,
   `Editar pieza` y `Eliminar` se presentan hoy **sin borde y con fondo transparente**:
   parecen texto. Deben leerse como algo que se puede tocar, con el mismo lenguaje
   visual que el resto de la aplicación y **≥ 44 px**.
3. Revisa si el mismo patrón ocurre en **otras listas con filtros** (piedras, cobros,
   cotizaciones). Si lo encuentras, **repórtalo; no lo arregles en este commit.**

### Lo que no cambia

Editar una venta **no puede borrar** la forma de pago ni el receptor ya guardados
(D-051), ni alterar la fecha contable sin que el dueño lo vea.

---

## 5. C4 · Un lote se puede borrar aunque sus piedras estén en una joya vendida

**Decisión:** D-069.

### El problema

`src/components/StonesView.tsx:854` bloquea: *"Este lote no se puede eliminar porque ya
respalda piedras usadas en joyas."* Santiago se quedó sin salida ante un lote creado por
error.

### Por qué el bloqueo sobra

Al transformar una joya, **su costo se guarda en la propia joya**:
`costCop: toSafeCOP(jewel.costCop) + attributedCostCop`
(`src/services/stoneJewelTransformation.ts:245`). Borrar el lote **no cambia ni un peso**
del costo de la joya, de su resultado ni de ningún cierre. Lo único que se pierde es la
trazabilidad hacia ese lote.

### Qué se construye

- El lote **se puede eliminar** aunque tenga usos internos en joyas vendidas.
- El aviso de confirmación **dice con claridad qué se pierde**: la trazabilidad hacia
  ese lote, no el dinero.
- La joya **conserva el nombre histórico del lote** y su costo, con el mismo patrón que
  ya se usa al borrar un proveedor, un comprador o un socio (D-043, D-049).
- **Prueba obligatoria:** borrar el lote no altera el costo de la joya, ni su resultado,
  ni el Cierre del día, ni el mensual, ni el panel.

### Lo que sí sigue protegido

No se pueden alterar los **datos físicos** de una tanda ya regresada cuyo producto se
vendió (Fase C). Proteger un dato es distinto de impedir borrar un registro completo con
aviso: no confundas las dos cosas al implementar.

---

## 6. Reglas que NO se rompen (confírmalas al entregar)

1. `main`, el enlace del piloto y `.github/workflows/deploy.yml` **sin tocar**.
   **Nada publicado.**
2. `src/calc/engine.ts` y `src/services/pdfContent.test.ts` sin cambios.
3. **La única dependencia autorizada es `write-excel-file`**, con las cinco condiciones
   de §2. Ninguna otra.
4. Toda validación local existe también en el servidor.
5. Ningún dinero de ningún registro anterior puede cambiar. Prueba de no regresión en
   C2 y C4.
6. Textos en español; 320/390/1280 px sin desbordamiento; botones ≥ 44 px.

---

## 7. Entregable

Por cada commit: el resultado literal de `npm test` y `npm run build`, qué verificaste
en navegador y en qué anchos, y `PROJECT_STATE.md`, `DECISIONS.md` y la bitácora
actualizados.

**Además:**

- En **C1**, di **cómo comprobaste el archivo** y cuánto pesa la dependencia en el
  paquete.
- En **C3**, di **qué vía elegiste** para que la pieza vendida no se pierda, y si
  encontraste el mismo patrón en otras listas.

**Numeración de decisiones:** la más alta hoy es **D-069**. Compruébalo antes de agregar
una nueva.

Claude auditará estas cuatro correcciones antes de que se hable de publicar.
