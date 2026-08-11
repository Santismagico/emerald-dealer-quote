# Auditoría de Claude — Plan v2, Fase D (el libro del negocio)

**Fecha:** 2026-08-04
**Auditor:** Claude (independiente; no escribió este código)
**Rama:** `codex/fase2-nube`
**Commits auditados:** `d7c9152` (D1 el libro) · `3a3fcc4` (D2 los cierres leen del libro)
**Base de comparación:** `1bdf55d`
**Orden auditada:** `docs/V2_ORDEN_DE_TRABAJO_CODEX_FASE_D.md`
**Decisión que la gobierna:** **D-057**

---

## Veredicto

# APROBADO

El libro del negocio quedó bien construido y los cierres pasaron a leer de él sin
mover un peso. La división en dos commits se respetó y cumplió su función.

No publiqué nada, no modifiqué `main` y no modifiqué el workflow de despliegue.

---

## 1. Verificación mecánica (ejecutada por mí)

| Comprobación | Resultado |
|---|---|
| `npm test` | **APROBADO** — 943 pruebas en 63 archivos (antes 940 en 62) |
| `npm run build` | **APROBADO** |
| `npm run test:public-cloud` | **APROBADO** — sin Supabase en precarga, CSP exacta |
| `npm run security:secrets` | **APROBADO** |
| `main` intacto | **SÍ** — `0a86e5a` |
| Dos commits, en orden | **SÍ** — D1 antes que D2 |

**Archivos protegidos, ninguno tocado:** `package.json`, `package-lock.json`
(**sin dependencias nuevas**), `src/calc/engine.ts`,
`src/services/pdfContent.test.ts`, `.github/workflows/deploy.yml`.

---

## 2. El alcance se respetó exactamente

La orden decía que esta fase **no tiene pantalla** y **no cambia datos**.

Archivos nuevos: **solo dos** — `src/services/ledger.ts` (564 líneas) y
`src/services/ledger.test.ts` (372 líneas).

Verificado con `git diff --name-only`: **cero** archivos en
`supabase/migrations`, **cero** en `src/components`, **cero** cambios en
`src/types`. Ni una migración, ni una vista, ni un campo nuevo.

---

## 3. La condición de aceptación de D2

> *Las pruebas existentes de cierres deben seguir pasando sin que se cambie ni un
> solo valor esperado.*

**Cumplida literalmente.** `git diff` sobre `dailyReport.test.ts`,
`dailyReportInventory.test.ts`, `dailyReportCutting.test.ts` y
`dailyReportTransformation.test.ts` devuelve **vacío**: ninguna de esas pruebas
fue modificada. Siguen pasando contra un motor reescrito por dentro.

Ese es el resultado más fuerte de toda la fase: **940 pruebas que ya existían
ahora ejercitan el libro sin saberlo.** La cobertura real del motor es mucho mayor
que las 3 pruebas propias que trae `ledger.test.ts`.

---

## 4. La prueba de equivalencia (entregable central de D1)

Existe y **está bien diseñada** (`src/services/ledger.test.ts:297`):

- Construye el libro y compara `cashIn`, `cashOut` y `net` contra
  `buildDailyReport` y `buildMonthlyReport` sobre un conjunto rico.
- **Y además fija los valores absolutos esperados**
  (`7.900.001` / `5.150.002` / `2.749.999`).

Ese segundo `expect` es lo que la hace confiable: sin él, si el libro y el reporte
se dañaran **del mismo modo**, la prueba seguiría pasando. Con él, no. Además los
importes no son redondos —terminan en 1 y en 2—, así que el redondeo a COP entero
queda ejercitado de verdad.

Las otras dos pruebas cubren lo que pedí: actividad sin caja con sus dimensiones,
e ids estables y únicos con montos enteros no negativos.

---

## 5. El diseño honra D-045 por construcción

`direction: 'entra' | 'sale' | 'ninguna'` quedó implementado como pedí, y el
sumador es deliberadamente estrecho (`src/services/ledger.ts:542`):

```
if (entry.direction === 'entra') cashIn  += entry.amountCop;
if (entry.direction === 'sale')  cashOut += entry.amountCop;
```

Un evento `'ninguna'` **no puede** sumar a la caja: no hay rama que lo permita. Por
eso una venta a crédito el día que se pacta, un uso interno de piedras, una
transformación de joya y **todo movimiento de material** quedan fuera de la caja
por estructura, no por disciplina de quien lea.

**D-048 sigue vigente:** los lotes de material generan eventos con
`direction: 'ninguna'` (`ledger.ts:451-470`), de modo que el material se puede
mostrar en la Fase E sin tocar los cierres.

**Ids derivables** como exigía §6.5: `material-lot:{id}:purchase`. Nada aleatorio.

**Motor puro:** busqué `Date.now`, `new Date()`, `localStorage`, `indexedDB`,
`fetch`, `Math.random` e importaciones de componentes dentro de `ledger.ts`. **No
hay ninguna.**

---

## 6. Verificación en la aplicación real

Aunque la fase no tiene pantalla, los cierres sí la tienen y fueron reescritos por
dentro, así que los abrí con los datos que quedaron de la auditoría anterior
(lote de $1.000.000 con una talla de $150.000 **sin pagar**):

- **Cierre del día** y **Cierre del mes** renderizan correctamente, con sus
  secciones de Joyería, Piedras y renglones de detalle.
- **"Salió en tallas: $ 0"**, pese a existir una talla de $150.000 registrada.
  Correcto: no se ha pagado, así que no salió de caja.
- **Consola sin errores.**

Es una confirmación de extremo a extremo: la regla de caja de la Fase C sobrevive
intacta al pasar por el libro.

---

## 7. Observaciones (no bloquean)

### O1 — La duplicación no se eliminó del todo, y está bien así

La orden decía "se elimina la recopilación duplicada". `dailyReport.ts` **creció**
de 882 a 915 líneas.

Lo revisé: **el dinero sí quedó con una sola fuente.** `cashIn`, `cashOut` y `net`
salen de `ledgerCashTotals`, y cada total por categoría de
`sumLedgerEvents(eventos, kind, direction)`. Lo que permanece es la construcción de
los **renglones narrativos** (piedras compradas, ventas, abonos…), que el PDF
necesita con campos propios —quilates, piezas, nombres— que el evento normalizado
no lleva.

El comentario que dejó Codex describe bien el criterio: *"el cierre conserva sus
renglones narrativos, pero ningún renglón vuelve a decidir si mueve caja"*. Eso es
exactamente el objetivo de D-057. **No pido cambio.**

La única suma que no pasa por el libro es `jewelsResult`, que es un **margen**
(recibido − costo), no un movimiento de caja. Correcto que quede fuera.

### O2 — `ledger.test.ts` trae solo 3 pruebas propias

Para un motor de 564 líneas suena poco. En la práctica no lo es, por lo explicado
en §3: tras D2, las 940 pruebas anteriores lo ejercitan. Lo dejo anotado porque si
alguna vez se revierte D2, el libro quedaría con muy poca cobertura propia.

### O3 — Sigue pendiente la prueba N6 real

Sin cambios respecto de las fases anteriores. Esta fase no toca la nube, así que no
agrega riesgo. Santiago decidió resolverlo al publicar.

---

## 8. Estado y siguiente paso

Fase D **aprobada** y **sin publicar**. `main` y las 7 joyerías del piloto no
fueron tocadas.

Queda desbloqueada la **Fase E**, la que Santiago más quería: el panel de ventas y
ganancias, la exportación a Excel y el consolidado con filtros por sociedad y tipo
de producto. Las tres leen del libro, así que sus números no pueden discrepar entre
sí.

Con el libro ya probado, la Fase E es sobre todo trabajo de presentación: el
riesgo aritmético quedó atrás.
