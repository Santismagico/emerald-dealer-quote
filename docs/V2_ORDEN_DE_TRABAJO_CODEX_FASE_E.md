# Orden de trabajo para Codex — Plan v2, Fase E (ver y medir)

**Fecha:** 2026-08-04
**Autor:** Claude (arquitectura)
**Rama:** `codex/fase2-nube`
**Base:** `9d196f4` (auditoría de la Fase D, aprobada)
**Punto de restauración:** tag `punto-seguro-pre-v2-2026-08-03`
**Plan completo:** `docs/PLAN_MAESTRO_V2.md`
**Decisiones aplicables:** **D-063** y **D-064** (nuevas) · D-053 · D-054 · D-057 · D-058 · D-045

---

## 0. Qué se te pide, en una frase

Construir las tres pantallas que Santiago más quería —**E1** el panel de ventas y
ganancias, **E2** la exportación a Excel y **E3** el consolidado con filtros— en
**tres commits separados**, todas leyendo del libro del negocio.

---

## 1. Lo que cambia respecto de las fases anteriores

El riesgo aritmético quedó atrás: el libro (`ledger.ts`) ya está auditado y los
cierres leen de él. **Esta fase es sobre todo presentación.**

Pero trae un riesgo nuevo, y es el mayor de toda la fase:

> **D-063: la ganancia y la caja dejan de ser el mismo número.**

- La **caja** es lo que se movió de verdad. La gobierna D-045 y no cambia.
- La **ganancia** es lo vendido menos lo que costó lo vendido, contado **en la
  fecha de la venta**, aunque cobren después.

Una compra de inventario **no es una pérdida**: es dinero que cambió de forma.
Por eso un mes con una compra grande puede tener **caja muy negativa y ganancia
positiva**, y las dos cifras ser correctas.

**Nunca las presentes como si fueran lo mismo, y nunca las sumes entre sí.** Si el
dueño puede confundirlas leyendo la pantalla, la etapa está mal hecha aunque los
números sean exactos.

---

## 2. Etapa E0 · Preparar el libro para medir ganancia

**Va primero, en su propio commit, y no tiene pantalla.**

El libro hoy sabe de caja, no de ganancia. Para que las tres pantallas puedan
medir sin volver a calcular por su cuenta —que es justo lo que D-057 prohíbe—,
cada evento de ingreso debe llevar consigo **el costo de lo que se vendió**:

```
LedgerEvent gana:
  attributedCostCop   entero ≥ 0   costo de lo vendido en ESE evento
```

Entonces **ganancia = `amountCop` − `attributedCostCop`**, sumable por cualquier
dimensión: período, lote, sociedad, tipo de producto.

### Cómo se atribuye el costo

- **Piedras:** costo por quilate del lote —lo invertido (compra + tallas pagadas,
  D-055) entre los quilates comprados— multiplicado por los quilates de esa venta.
  Es **la misma regla que ya usa C2** para los usos internos: reutilízala, no
  escribas una segunda.
- **Joyas de stock:** el costo de la pieza, que ya es por unidad.
- **Cotizaciones y taller:** el costo del trabajo, si el módulo ya lo conoce; si
  no, `0` y **documentado**, nunca un estimado inventado.

### Los dos invariantes que debes probar

1. **La suma de los costos atribuidos de un lote nunca supera lo invertido en él.**
2. **Cuando un lote se vende completo, la suma de los costos atribuidos es
   exactamente igual a lo invertido** — ni un peso de más ni de menos. Es el mismo
   problema de residuo de B2: resuélvelo igual y con una prueba de número impar.

### Lo que no puede pasar

Agregar `attributedCostCop` **no puede cambiar `cashIn`, `cashOut` ni `net`**. La
prueba de equivalencia de D1 ya existe para atrapar eso: **debe seguir pasando sin
tocar sus valores esperados.**

---

## 3. Etapa E1 · Panel de ventas y ganancias

- **Períodos:** día · semana · mes · año.
- **Ganancia por lote de esmeraldas.** Es el ejemplo textual de Santiago: *"compro
  un lote de 10 esmeraldas por $1.000 y quiero ver cuánta plata estoy haciendo"*.
- **Por sociedad (D-064):** su parte y la de cada socio, **con las dos medidas** —
  cuánto dejó en pesos **y** el porcentaje sobre lo invertido en esa sociedad.
  El porcentaje **nunca va solo**, siempre acompañado del monto. Si lo invertido
  es cero, se indica que **no aplica**; no muestres infinito ni 0%.
- **Vista COP/USD**, con el mismo criterio honesto que ya usa Gastos: solo se
  convierten las operaciones que tienen tasa propia, y lo que no la tenga dice
  **"Sin registrar"** (D-054).
- **Caja y ganancia se muestran separadas y rotuladas**, nunca mezcladas (§1).
- Los cobros pendientes se muestran aparte, no como ganancia que falta.

---

## 4. Etapa E2 · Exportación a Excel

Los cierres del día y del mes, y el consolidado, se descargan en un archivo que
**se abre en Excel con doble clic y se puede editar**. Ese era el problema con el
PDF: Santiago necesita cuadrar y corregir.

- **Sin dependencias nuevas.** Archivo de valores separados compatible con Excel.
- **El detalle que decide si funciona o no:** el Excel en español usa **punto y
  coma** como separador, no coma. Genera con `;` y con **BOM UTF-8** para que las
  tildes y la "ñ" no se dañen. Sin esto el archivo se abre como una sola columna
  ilegible y la función es inútil. **Pruébalo, no lo supongas.**
- Los números deben quedar como **números**, no como texto: nada de separadores de
  miles ni símbolo de peso dentro de la celda.
- **El PDF se conserva.** El Excel se suma, no reemplaza.
- Es un **documento interno**: se descarga en el dispositivo, nunca se comparte por
  Web Share ni WhatsApp, igual que los cierres de hoy.

---

## 5. Etapa E3 · Consolidado con filtros

- Filtros por **sociedad** y por **tipo de producto** (D-058), sobre cualquier
  período.
- **Comparación entre sociedades** según D-064: cuál dejó más plata y cuál fue más
  rentable, una al lado de la otra.
- Exportable a Excel con el mismo mecanismo de E2.
- Un registro sin tipo de producto o sin sociedad aparece como **"Sin registrar"**
  y **se puede filtrar por eso**: son los datos viejos, y el dueño necesita
  encontrarlos para completarlos.

---

## 6. Reglas que NO se rompen (confírmalas al entregar)

1. `main`, el enlace del piloto y `.github/workflows/deploy.yml` **sin tocar**.
   **Nada publicado.**
2. `src/calc/engine.ts` y `src/services/pdfContent.test.ts` sin cambios.
3. **Sin dependencias nuevas.** Si crees que una es imprescindible para el Excel,
   **detente y escríbelo** en vez de agregarla.
4. **Ningún cambio de datos:** cero migraciones y cero campos nuevos en las
   entidades. `attributedCostCop` vive en el evento del libro, que es derivado, no
   almacenado.
5. Los cierres actuales siguen dando **exactamente** los mismos totales, y sus
   PDF el mismo contenido.
6. Todo esto es **interno**: ni el panel, ni el Excel, ni el consolidado pueden
   llegar a un documento del cliente.
7. Textos en español; 320/390/1280 px sin desbordamiento; botones ≥ 44 px.

---

## 7. Entregable

Por cada commit: el resultado literal de `npm test` y `npm run build`, qué
verificaste en navegador y en qué anchos, y `PROJECT_STATE.md`, `DECISIONS.md` y
la bitácora actualizados.

**Para E2, además:** dí expresamente **cómo comprobaste que el archivo abre bien en
Excel en español**, con separador y tildes correctos. Es el punto que más
fácilmente se da por bueno sin probarlo.

Al terminar las tres, un resumen con todo lo que te haya parecido dudoso.

**Numeración de decisiones:** antes de agregar una nueva a `DECISIONS.md`, busca el
número más alto que ya exista en el archivo. Hubo un choque de numeración el
2026-08-04 (dos D-059) y no debe repetirse.

**No sigas a la Fase F.** Claude audita esta fase antes del catálogo, que es la
única salida al cliente de todo el plan v2 y exige revisión de privacidad aparte.
