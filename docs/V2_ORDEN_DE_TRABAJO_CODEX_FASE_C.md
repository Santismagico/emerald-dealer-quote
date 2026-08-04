# Orden de trabajo para Codex — Plan v2, Fase C (RIESGO ALTO)

**Fecha:** 2026-08-04
**Autor:** Claude (arquitectura)
**Rama:** `codex/fase2-nube`
**Base:** `a99e1f9` (auditoría de las Fases A y B, aprobadas)
**Punto de restauración:** tag `punto-seguro-pre-v2-2026-08-03`
**Plan completo:** `docs/PLAN_MAESTRO_V2.md`
**Decisiones aplicables:** D-055 (talla por tandas), D-056 (fantasía→natural), D-045, D-057

---

## 0. Qué se te pide, en una frase

Construir **dos etapas** —C1 (esmeraldas en bruto que se tallan por tandas) y C2
(joyas completas con fantasía/natural que descuentan del inventario de piedras)—
en **dos commits separados**, sin publicar nada.

---

## 1. Por qué esta fase es distinta

Las Fases A y B agregaron datos nuevos junto a los existentes. **La Fase C cambia
cómo se comporta el inventario físico que ya está en producción.** Un error aquí
no se ve como una pantalla fea: se ve como piedras que no existen o dinero mal
atribuido.

Lee **`docs/PLAN_MAESTRO_V2.md` §6** completo antes de empezar. Además de las 22
reglas, esta fase tiene una condición propia:

> **Un lote sin tandas de talla y sin usos internos debe comportarse exactamente
> como hoy, hasta el último peso y el último quilate.** Esa es la prueba que
> decide si la etapa está bien hecha.

**Si algo de esta orden te parece ambiguo, detente y escríbelo.** En esta fase
prefiero una pregunta a una suposición.

---

## 2. Etapa C1 · Esmeraldas en bruto → talladas, por tandas

**Decisión que la gobierna:** D-055.

### 2.1 El problema real del negocio

Al tallar una esmeralda en bruto se pierde alrededor del **70% del peso**, a veces
más y a veces menos. Y la talla **no se hace sobre el lote completo**: de un lote
de diez piedras se pueden tallar dos este mes y dos el siguiente.

### 2.2 El modelo

`StoneLot` gana `cuttingBatches: CuttingBatch[]`, con la misma forma embebida que
ya usan `sales` y `supplierPayments`.

```
CuttingBatch:
  id
  sentDate            fecha de envío a talla (YYYY-MM-DD)
  sentCarats          quilates en bruto que salieron
  sentQuantity        piedras que salieron
  returnedDate        '' mientras no regrese
  returnedCarats      0 mientras no regrese
  returnedQuantity    0 mientras no regrese
  cuttingCostCop      lo que costó tallar, COP entero (puede ser 0)
  cuttingPaidDate     fecha en que se pagó la talla ('' si no se ha pagado)
  notes
```

`StoneSale` gana **`origin: 'bruto' | 'tallado'`**: de cuál de las dos existencias
salió la venta.

### 2.3 Las tres existencias derivadas

**Nunca guardes estos números: se derivan siempre.**

| Existencia | Cómo se calcula |
|---|---|
| **En bruto disponible** | `carats` − enviado a talla − vendido con `origin: 'bruto'` |
| **En talla** | lo enviado en tandas que aún **no** han regresado |
| **Tallado disponible** | lo regresado − vendido con `origin: 'tallado'` |

Lo mismo para el número de piedras.

**La compatibilidad se cae sola.** Una venta anterior a esta etapa normaliza a
`origin: 'bruto'`. Como un lote antiguo no tiene tandas, "en bruto disponible"
queda igual a `carats − vendido`, que es **exactamente** el `remainingCarats` de
hoy (`src/services/stones.ts:84-85`). No inventes una migración de datos: la
normalización basta.

### 2.4 La merma se deriva, nunca se digita

Por tanda regresada: `(sentCarats − returnedCarats) / sentCarats`. Y un promedio
del lote sobre las tandas ya regresadas. Si no hay tandas regresadas, no se
muestra una merma inventada: se muestra que todavía no hay dato.

### 2.5 Las validaciones — **local y también en el servidor** (§6.4.14)

1. No se puede enviar a tallar más de lo que hay **en bruto disponible**, ni en
   quilates ni en piedras.
2. **`returnedCarats` ≤ `sentCarats`.** Tallar nunca agrega peso.
3. **`returnedQuantity` es libre y puede ser MAYOR que `sentQuantity`.** Una
   piedra puede partirse en dos al tallarla. No lo bloquees: es el negocio real.
4. Una tanda **pendiente** retiene sus piedras: no están disponibles ni como
   bruto ni como talladas.
5. `validateStoneSale` pasa a validar **contra la existencia del `origin` que
   declara la venta**, no contra el total del lote.
6. Borrar o editar una tanda que ya regresó y cuyo producto **ya se vendió** debe
   quedar bloqueado, con un aviso que diga qué se perdería. Es el mismo criterio
   de D-047: el dinero ya cobrado no se borra por un cambio de interruptor.

### 2.6 El dinero

- **El costo de la talla sale de caja el día en que se pagó** (`cuttingPaidDate`),
  no el día en que se envió. Coherente con D-045. Si aún no se ha pagado, no sale
  de caja.
- **Lo invertido en el lote** pasa a ser `purchaseValueCop` + la suma de las
  tandas ya pagadas. El resultado del lote es lo recibido menos lo invertido.
- **El reparto con el socio (D-053) se calcula sobre ese resultado nuevo.** El
  costo de talla es parte del negocio compartido. Verifica que la suma de las
  partes siga siendo exactamente igual al total.

### 2.7 Verificación de C1

- `npm test` y `npm run build` en verde.
- **Prueba de comportamiento idéntico:** un lote sin tandas da exactamente los
  mismos quilates, piedras, resultado y reparto que antes de esta etapa.
- Pruebas de: envío parcial; regreso con merma; segunda tanda del mismo lote;
  piedra que se parte (`returnedQuantity > sentQuantity`); intento de enviar más
  de lo disponible (rechazado en dispositivo **y** en servidor); venta de tallado
  mayor que lo tallado disponible (rechazada).
- Recorrido real en navegador con el lote de ejemplo: crear tanda, verla
  pendiente, registrarla de regreso, ver la merma calculada, vender tallado,
  recargar y comprobar persistencia.

---

## 3. Etapa C2 · Joyas completas y fantasía → natural

**Decisión que la gobierna:** D-056.

### 3.1 Campos nuevos de `StockJewel`

```
weightGrams    peso de la pieza
size           talla o medida, TEXTO LIBRE
stoneCount     número de piedras que lleva
stoneKind      'fantasia' | 'natural' | ''   ('' = Sin registrar)
```

**`size` es texto libre a propósito.** La talla de un anillo, el largo de una
cadena y el diámetro de una argolla no son la misma magnitud. No inventes una
unidad única ni un desplegable cerrado.

Las joyas existentes se leen con `stoneKind: ''` y muestran **"Sin registrar"**
(§6.3.11). **No adivines la clase a partir del costo, del material ni del
nombre.**

### 3.2 La transformación: el punto delicado de toda la fase

Cambiar una piedra de fantasía por una natural hace **tres cosas a la vez**:

1. La joya pasa a `stoneKind: 'natural'`, **conservando su historia**: debe verse
   que empezó en fantasía.
2. **Descuenta la piedra natural del inventario de Piedras** (decisión expresa de
   Santiago).
3. **Suma el costo de esa piedra al costo de la joya.**

**La piedra de fantasía que sale NO se rastrea** (decisión de Santiago,
2026-08-04). No se crea existencia, entidad ni registro para ella, y **su costo se
queda en la joya**: fue parte de lo que costó la pieza cuando se compró y no se
descuenta de nada. No agregues un campo, una pantalla ni una pregunta al usuario
por esa piedra: es exactamente el trabajo que Santiago pidió evitar.

### 3.3 Cómo se descuenta del inventario de piedras

`StoneLot` gana **`internalUses: StoneInternalUse[]`** — una salida que **no es
una venta**:

```
StoneInternalUse:
  id
  date
  carats
  quantity
  origin        'bruto' | 'tallado'
  jewelId       la joya que la consumió
  costCop       costo atribuido, COP entero
  notes
```

**Sigue el patrón que ya existe en `MaterialLot.uses[]`.** No modeles esto como
una venta con precio cero: contaminaría los ingresos y los cierres.

Las existencias derivadas de C1 pasan a restar también los `internalUses`, y
`validateStoneSale` debe tenerlos en cuenta.

### 3.4 El dinero — **la regla que más fácil se rompe**

> **La transformación NO es un movimiento de caja.**

El dinero de esa piedra **ya salió** el día en que se compró el lote. Atribuir su
costo a la joya es un **traslado de costo**, no un gasto nuevo.

- El costo atribuido se calcula con el costo por quilate del lote —lo invertido
  entre los quilates comprados— multiplicado por los quilates consumidos, en COP
  entero.
- Ese costo **sale del resultado del lote y entra al costo de la joya**. La suma
  total del negocio no cambia.
- **Prueba obligatoria:** hacer una transformación **no altera el neto de caja de
  ningún día**, ni el del día de la transformación ni el del día de la compra del
  lote.

Si tu implementación hace que el cierre del día cambie al transformar una joya,
está mal.

### 3.5 Validaciones — local y en el servidor

1. No se puede consumir una piedra que no existe: el uso interno se valida contra
   la existencia real del `origin` declarado.
2. No se puede transformar una joya **ya vendida**.
3. Una joya que ya es `'natural'` no se vuelve a transformar a natural.
4. Deshacer una transformación debe devolver la piedra al lote y el costo a su
   sitio, o quedar bloqueada si eso ya no es posible. Elige una y **escribe por
   qué**; no dejes una tercera vía silenciosa.

### 3.6 Verificación de C2

- `npm test` y `npm run build` en verde.
- **Prueba de no regresión:** una joya anterior a esta etapa da exactamente el
  mismo costo, precio y resultado que antes.
- **Prueba de caja:** transformar no cambia el neto de ningún día.
- **Prueba de cuadre entre módulos:** después de transformar, los quilates que
  faltan en el lote son exactamente los que aparecen en la joya.
- Intento de consumir más de lo disponible: rechazado en dispositivo **y** en
  servidor.
- Recorrido real: joya de fantasía → transformar consumiendo de un lote → ver el
  descuento en Piedras, el costo nuevo en la joya y la historia conservada.

---

## 4. Lo que NO entra en esta fase

- **El catálogo** (Fase F). C2 prepara los campos que el catálogo usará, pero no
  se construye ninguna salida al cliente aquí.
- **Colecciones de joyas.** `collectionId` sigue reservado y sin usar.
- **El libro del negocio** (Fase D). No adelantes `ledger.ts`.
- Cualquier pantalla de panel, Excel o consolidado.

---

## 5. Reglas que NO se rompen (confírmalas al entregar)

1. `main`, el enlace del piloto y `.github/workflows/deploy.yml` **sin tocar**.
2. **Nada publicado.**
3. `src/calc/engine.ts` y `src/services/pdfContent.test.ts` sin cambios.
4. **Sin dependencias nuevas.** Si crees que una es imprescindible, detente y
   escríbelo.
5. Migraciones SQL **aditivas y nuevas**; no se reescribe ninguna ya aplicada.
6. Toda validación local existe **también** en el servidor.
7. `BACKUP_VERSION` sube solo si aparece un almacén nuevo. Estos campos son
   embebidos: probablemente no haga falta. Lo que **sí** es obligatorio es que un
   respaldo anterior siga importando bien, con prueba.
8. Textos en español; 320/390/1280 px sin desbordamiento; botones ≥ 44 px.

---

## 6. Entregable

Por **cada** etapa: un commit propio; el resultado literal de `npm test` y
`npm run build`; qué verificaste en navegador y en qué anchos; y
`PROJECT_STATE.md`, `DECISIONS.md` y la bitácora actualizados.

Al terminar las dos, un resumen con **todo lo que te haya parecido dudoso**,
aunque lo hayas resuelto.

**No sigas a la Fase D.** Claude audita esta fase antes de que se construya el
libro del negocio, porque el libro va a leer justamente lo que aquí se define.
