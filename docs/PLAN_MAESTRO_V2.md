# PLAN MAESTRO v2 — De cotizador a sistema del negocio

**Fecha:** 2026-08-03
**Autor:** Claude (arquitectura y planificación)
**Ejecuta:** Codex
**Rama de trabajo:** `codex/fase2-nube`
**Punto de restauración:** tag `punto-seguro-pre-v2-2026-08-03` (= `f8dc78e`)
**Base verificada:** 751 pruebas en 46 archivos, compilación en verde, IndexedDB v7, BACKUP_VERSION 7

---

## 1. Por qué existe este plan

La aplicación nació para **cotizar**. Con el tiempo creció: Taller, Agenda,
Inventario de piedras, Material con socios, Joyas en stock, Cobros, cierres.
Hoy cotizar ya **no es el centro** del negocio: es una herramienta más.

Santiago identificó dos consecuencias de ese crecimiento:

1. **La puerta de entrada quedó mal.** El usuario cae directo en el Cotizador,
   lo que hace creer que la app "es de cotizar". Debe ver primero **todas las
   áreas** y elegir la que necesita.
2. **Los módulos crecieron como silos.** Cada área tiene sus propios números y
   su propio resumen. No existe una forma única de responder *"¿cómo va el
   negocio?"* cortada por tiempo, por lote, por sociedad o por tipo de producto.

La frase con la que Santiago resumió su intención, y que gobierna este plan:

> **"Todo lo que se puede medir, se puede optimizar."**

Este plan convierte la aplicación en un sistema **integrado y medible**, sin
romper nada de lo que hoy funciona y está publicado.

---

## 2. Lo que pidió Santiago (lista completa)

| # | Petición | Fase |
|---|---|---|
| 1 | Pantalla de inicio con todas las opciones, en vez de caer en el Cotizador | A |
| 2 | Panel (dashboard) de ventas y ganancias: día · semana · mes · año, y ganancia por lote | E |
| 3 | Sociedades con socios en los lotes de esmeraldas, con reparto de ganancias visible por separado | B |
| 4 | Registro de gastos del negocio | B |
| 5 | Cierres del día y del mes en **Excel** (el PDF no sirve porque no se puede editar ni cuadrar) | E |
| 6 | Consolidado con filtros por **sociedad** y por **tipo de producto**, exportable a Excel, para comparar qué sociedad y qué producto dan más plata | B + E |
| 7 | Esmeraldas en bruto → talladas: registrar tandas parciales de talla y la merma (~70%) | C |
| 8 | Joyas en stock completas (peso, talla, número de piedras, fantasía/natural) + catálogo PDF automático | C + F |
| 9 | Moneda: base en pesos colombianos, con opción de ver en dólares | B |

---

## 3. La idea central de arquitectura: **el libro del negocio**

Esta es la decisión técnica más importante del plan y la que hace que la app
quede **integrada** en vez de tener cinco funciones sueltas.

**El problema si no lo hacemos:** el dashboard (#2), los cierres en Excel (#5) y
el consolidado (#6) son tres pantallas distintas que muestran la misma plata.
Si cada una calcula por su cuenta a partir de las entidades crudas (lotes,
joyas, cotizaciones, abonos, gastos), **tarde o temprano se van a contradecir**.
En una aplicación de dinero eso es inaceptable: destruye la confianza en todo lo
demás.

**La solución:** un único motor puro, `src/services/ledger.ts`, que traduce todo
lo que pasa en el negocio a un **flujo normalizado de eventos**. Cada evento
lleva siempre las mismas dimensiones:

```
fecha · monto (COP entero) · tasa USD del día · tipo de evento ·
módulo de origen · lote · sociedad · tipo de producto · contraparte
```

Y entonces:

- **Dashboard** = leer el flujo y agrupar por período.
- **Cierre del día / del mes** = leer el flujo y filtrar por fecha.
- **Consolidado** = leer el flujo y agrupar por sociedad o tipo de producto.
- **Excel** = serializar el flujo.

Una sola verdad, cuatro presentaciones. Los números **no pueden** discrepar
entre pantallas porque salen del mismo sitio.

Ya existe un precedente en el proyecto: `dailyReport.ts`. El libro del negocio
es su generalización, con las dimensiones nuevas y sin perder lo que hoy hace.

**Por eso el orden de las fases importa:** primero se crean los datos que faltan
(Fase B) y los cambios de inventario (Fase C); después se construye el libro
(Fase D); y solo al final las pantallas que lo leen (Fase E). Construir el
dashboard antes obligaría a rehacerlo.

---

## 4. Decisiones de negocio ya tomadas por Santiago

No volver a preguntarlas. Quedan registradas como D-052 a D-057 en `DECISIONS.md`.

1. **El Cotizador deja de ser la puerta de entrada.** La app abre en una
   pantalla de inicio con todas las áreas. Cotizar es una opción más entre
   iguales.
2. **Sociedad = el negocio compartido con un socio** ("el lote que tengo con
   Juan"). Debe poderse comparar unas con otras: cuál da plata, cuál quita.
3. **Moneda:** el peso colombiano es la base. El dólar es una **vista**
   opcional.
4. **Talla de esmeraldas:** solo se registra **cuántas piedras y cuántos
   quilates** se mandan a tallar. No se identifica piedra por piedra.
5. **Cambio de piedra de fantasía por natural:** la piedra natural **sí se
   descuenta del inventario de Piedras**. Los dos módulos deben cuadrar solos.
6. **Catálogo:** se entrega en **PDF**, generado automáticamente desde el
   inventario real.

---

## 5. Decisiones abiertas (bloquean su etapa, no el plan completo)

| # | Pregunta | Bloquea | Recomendación de Claude |
|---|---|---|---|
| A-1 | ¿La tasa del dólar se guarda en cada operación (historia fiel) o hay una sola tasa en Ajustes? | B3 | **Guardar la tasa de cada operación.** Si el dólar sube mañana, una venta de hace tres meses no debe cambiar de valor. Es el único camino honesto para un negocio que transa en dólares. |
| A-2 | ¿"Tipo de producto" es una lista fija o Santiago crea los suyos? | B3 | **Lista base + poder agregar los propios.** La lista base garantiza que el filtro sirva desde el primer día; los tipos propios evitan que se quede corto. |
| A-3 | ¿Cómo se ve la pantalla de inicio? | A1 | Presentarle 2 opciones visuales y que él elija. Es como mejor decide. |

Las etapas que no dependen de estas preguntas **pueden empezar ya**.

---

## 6. Principios de operación (obligatorios para Codex)

Estos principios no se negocian. Un cambio que rompa cualquiera de ellos está
mal, aunque las pruebas pasen.

### 6.1 Protección

1. **Nada se publica sin orden expresa y separada de Santiago.** `main` no se
   toca. El enlace del piloto (`emerald-dealer-quote`) no se toca. El workflow
   `.github/workflows/deploy.yml` no se toca.
2. Punto de restauración de esta tanda: `punto-seguro-pre-v2-2026-08-03`.
3. **Una etapa = un commit.** Nunca mezclar dos etapas en un commit.
4. **El orden de las fases no se altera.** Hay dependencias reales: B y C
   alimentan a D; D alimenta a E; C2 alimenta a F.

### 6.2 El dinero

5. **COP enteros en almacenamiento, siempre** (`Math.round`, `formatCOP`). El
   dólar es **solo presentación**; jamás se guarda un monto en USD como si fuera
   el valor oficial del registro.
6. **Prueba obligatoria de no regresión de dinero.** En cada etapa que toque
   datos existentes, debe existir una prueba que demuestre que los registros
   creados antes del cambio **dan exactamente el mismo dinero que daban antes**.
   Este proyecto ya tiene el precedente: las ventas anteriores al crédito se
   normalizan como de contado y cuadran igual.
7. **Los cierres siguen siendo honestos** (D-045): el crédito no entra a caja el
   día de la venta; los abonos entran el día que se reciben.

### 6.3 Los datos

8. **Todo cambio de datos es aditivo.** Campos nuevos opcionales con valor por
   defecto; almacenes nuevos. **Nunca** borrar ni renombrar un campo existente.
9. `src/services/schema.ts` sigue siendo la **única** fuente de defaults,
   migraciones y normalización (D-010).
10. Cada escalón de IndexedDB sube **de a uno** (v7 → v8 → v9…) y
    `BACKUP_VERSION` acepta **todas** las versiones anteriores.
11. **No inventar datos.** Los registros antiguos que no tengan los campos
    nuevos muestran **"Sin registrar"**, nunca un valor supuesto. Es el
    precedente ya establecido en la trazabilidad (D-051).

### 6.4 La nube

12. Cada tabla nueva: **RLS activada**, escritura directa revocada, escritura
    **solo por función protegida**, y `organization_id` **resuelto por el
    servidor** — nunca recibido del cliente.
13. Migraciones SQL **aditivas y repetibles**. No se reescribe una migración ya
    aplicada en producción: se agrega una correctiva nueva.
14. **Lección del hallazgo H1 de la auditoría anterior:** *toda validación que
    exista en el dispositivo debe existir también en el servidor.* La defensa en
    la pantalla no sustituye la del servidor. Si el motor puro impide algo, la
    función protegida debe impedirlo también.

### 6.5 La privacidad

15. `src/services/pdfContent.test.ts` **no se toca** y no puede fallar.
16. **El catálogo es una salida al cliente.** Debe pasar por el detector de
    información interna igual que el PDF de cotización. Nunca muestra costo,
    margen, socios, ni notas internas.

### 6.6 La forma

17. **Sin dependencias nuevas** sin decisión escrita en `DECISIONS.md`.
18. Toda regla de negocio nueva va en `src/services/*.ts` como **funciones
    puras con pruebas**, nunca dentro de un componente.
19. Móvil primero: sin desbordamiento horizontal en **320, 390 y 1280 px**,
    botones táctiles ≥ 44 px, inputs ≥ 16 px. Textos en español.

### 6.7 El cierre de cada etapa

20. `npm test` y `npm run build` **en verde**. Si una etapa no pasa, no se
    avanza a la siguiente.
21. Verificación real en navegador del recorrido que la etapa habilita.
22. Actualizar `PROJECT_STATE.md`, `DECISIONS.md` y la bitácora de etapas.

---

## 7. Las fases

### FASE A — La puerta de entrada

Visible de inmediato, riesgo bajo, no toca datos. Se puede hacer hoy.

#### A1 · Pantalla de inicio (menú principal)

- **Objetivo:** que la app abra en una pantalla que muestre **todas las áreas**
  del negocio, y que el usuario elija. El Cotizador pasa a ser una opción más.
- **Datos:** ninguno. Es navegación pura.
- **Pantalla:** nueva vista de inicio con acceso a Cotizador · Taller · Agenda ·
  Inventario · Cierres · Clientes · Compradores · Proveedores · Socios ·
  Ajustes · Cuenta. La barra inferior de 5 botones se conserva como atajo una
  vez el usuario entra a un área.
- **Reglas:** no se elimina ninguna ruta existente; todo lo que hoy se alcanza
  debe seguir alcanzándose. Sin cambios en `App.tsx` que rompan el
  `runAfterViewFlush` (el guardado diferido depende de él).
- **Riesgo:** bajo. **Bloqueado por:** A-3 (diseño visual, lo elige Santiago).

---

### FASE B — Los datos que faltan

Cimientos. Cada etapa es aditiva y verificable por separado.

#### B1 · Registro de gastos del negocio

- **Objetivo:** anotar lo que se gasta para mover el negocio, más allá del costo
  de cada lote. Sin esto, la "ganancia" que muestre el dashboard sería mentira.
- **Datos:** entidad nueva `Expense` (fecha, concepto, categoría, monto COP,
  forma de pago, quién pagó, sociedad opcional, notas). Escalón IndexedDB
  **v8**, `BACKUP_VERSION 8`, tabla nueva en la nube con función protegida.
- **Pantalla:** área propia dentro de Cierres o Más, con lista y filtros por
  fecha.
- **Reglas:** un gasto **sale de caja el día en que se pagó**, coherente con
  D-045. Un gasto asignado a una sociedad debe poder repartirse.
- **Riesgo:** bajo. Entidad nueva, no toca nada existente.

#### B2 · Sociedades y socios en los lotes de esmeraldas

- **Objetivo:** que un lote de esmeraldas pueda ser propio o compartido, y que
  se vea **tu ganancia y la de cada socio por separado**.
- **Datos:** **reutilizar la entidad de socios que ya existe** (`MaterialPartner`,
  D-049) generalizándola a "Socios" para material **y** piedras. `StoneLot` gana
  `partnerId`, `partnerName` y la participación acordada. **No** se crea una
  entidad paralela y **no** se migra destructivamente la existente.
- **Pantalla:** en el lote, quién es el socio y qué parte le toca. En Socios, el
  resumen de cada sociedad.
- **Reglas:** el reparto se calcula sobre el **resultado real** (recibido −
  costo), no sobre el precio de lista. Borrar un socio conserva su nombre y el
  reparto histórico, como ya ocurre hoy. Las ventas anteriores sin socio siguen
  siendo 100% propias y dan el mismo dinero.
- **Riesgo:** medio. Toca `StoneLot`, que ya tiene crédito y abonos en
  producción. Exige la prueba de no regresión de dinero (§6.2.6).

#### B3 · Tipo de producto en las ventas + moneda COP/USD

- **Objetivo:** las dos dimensiones que faltan para poder filtrar y comparar.
- **Datos:** campo `productType` en las ventas (piedras, joyas) con lista base y
  tipos propios; `usdRate` guardado en cada operación de dinero; ajuste de
  moneda de visualización.
- **Pantalla:** selector de tipo de producto al registrar una venta; interruptor
  COP/USD donde se muestre dinero.
- **Reglas:** el almacenamiento sigue siendo COP entero. Cambiar la vista a
  dólares **no** modifica ni un solo dato guardado. Las ventas antiguas sin tipo
  muestran "Sin registrar".
- **Riesgo:** medio. **Bloqueado por:** A-1 y A-2.

---

### FASE C — El inventario real

La parte más delicada del plan: cambia cómo se comporta el inventario físico.

#### C1 · Esmeraldas en bruto → talladas, por tandas

- **Objetivo:** resolver los dos problemas reales del negocio: al tallar se
  pierde ~70% del peso, y la talla se hace **por tandas**, no de una vez.
- **Datos:** `StoneLot` gana `cuttingBatches[]`. Cada tanda: fecha, piedras y
  quilates **enviados** en bruto; al regresar, piedras y quilates **resultantes**
  y el costo de la talla. La merma se **deriva**, nunca se digita.
- **Modelo clave:** el lote pasa a tener **dos existencias**: lo que sigue en
  bruto y lo que ya está tallado y disponible. Una venta declara de cuál sale.
  El costo del lote más el costo de talla se atribuyen a lo que salió.
- **Reglas:** no se puede enviar a tallar más de lo que queda en bruto — **y esa
  validación debe existir también en el servidor** (§6.4.14). Un lote sin tandas
  se comporta exactamente como hoy.
- **Riesgo:** **alto.** Es el cambio de modelo más profundo. Debe ir con
  verificación extra y, sugerido, una auditoría independiente antes de seguir.

#### C2 · Joyas en stock completas y fantasía/natural

- **Objetivo:** que la ficha de una joya sirva de verdad para vender, y que se
  sepa qué hay en fantasía y qué en natural.
- **Datos:** `StockJewel` gana `weightGrams`, `size` (campo flexible: la talla
  de un anillo no es el largo de una cadena), `stoneCount` y `stoneKind`
  (`fantasia` | `natural`). Evento nuevo de **transformación** fantasía →
  natural.
- **La transformación** hace tres cosas a la vez: cambia la clasificación de la
  joya, **descuenta la piedra del inventario de Piedras** (decisión de Santiago)
  y **suma el costo de esa piedra al costo de la joya**. Queda registrada con
  fecha, para que el libro del negocio la vea.
- **Reglas:** no se puede transformar consumiendo una piedra que no existe. La
  joya conserva su historia: se ve que empezó en fantasía. Las joyas existentes
  se leen sin `stoneKind` y muestran "Sin registrar" hasta que se clasifiquen.
- **Riesgo:** medio-alto. Es el primer punto donde dos módulos se modifican
  mutuamente. Exige pruebas de que el inventario de piedras y el de joyas
  cuadran después de la transformación.

---

### FASE D — El libro del negocio

#### D1 · Motor `ledger.ts` (sin pantalla)

- **Objetivo:** la fuente única de verdad descrita en la §3.
- **Contenido:** funciones puras que recorren cotizaciones, abonos, pagos del
  taller, lotes de piedras, tandas de talla, joyas, transformaciones, material y
  gastos, y devuelven el flujo normalizado de eventos con todas sus dimensiones.
- **Reglas:** **motor puro**, sin UI, sin almacenamiento, con pruebas
  exhaustivas. `dailyReport.ts` y el cierre mensual pasan a leer del libro y
  **deben seguir dando exactamente los mismos totales que hoy** — esa es la
  prueba que valida toda la etapa.
- **Riesgo:** medio. No cambia datos ni pantallas; el riesgo es aritmético y se
  controla con pruebas.

---

### FASE E — Ver y medir

Las tres pantallas que Santiago pidió. Todas leen del libro.

#### E1 · Dashboard de ventas y ganancias

Períodos día · semana · mes · año. Ganancia por lote de esmeraldas. Ganancia por
sociedad, separando la parte propia de la de cada socio. Vista en COP o USD.

#### E2 · Exportación a Excel

Los cierres del día y del mes, y el consolidado, se descargan en un archivo que
**abre en Excel con doble clic y se puede editar**.

- **Sin dependencias nuevas en la primera versión:** archivo de valores
  separados compatible con Excel.
- **Detalle que decide si funciona o no:** el Excel en español usa **punto y
  coma** como separador, no coma. El archivo debe generarse con `;`, con BOM
  UTF-8 para que las tildes y la "ñ" no se dañen. Sin esto el archivo se abre
  como una sola columna ilegible y la función es inútil.
- El PDF actual **se conserva**; el Excel se suma, no reemplaza.

#### E3 · Consolidado con filtros y comparación

Filtros por **sociedad** y por **tipo de producto**, sobre cualquier período.
Comparación entre sociedades: cuál deja plata, cuál no, cuál es la mejor. Es la
etapa que materializa *"todo lo que se puede medir, se puede optimizar"*.

---

### FASE F — El catálogo

#### F1 · Catálogo PDF automático

- **Objetivo:** que el catálogo se arme **solo** desde el inventario real, sin
  mantenerlo aparte a mano. Al registrar una venta, el próximo catálogo ya sale
  actualizado.
- **Contenido:** solo joyas realmente disponibles (no vendidas, no apartadas),
  con foto, tipo de pieza, peso, talla, número de piedras y precio.
- **Se puede generar filtrado:** solo naturales, solo fantasía, o todo.
- **Reglas:** **nunca** costo, margen, socios ni notas internas. Pasa por el
  detector de información interna como cualquier salida al cliente (§6.5.16).
  Se descarga y se comparte con el mismo mecanismo que ya existe para el PDF del
  cliente.
- **Riesgo:** bajo-medio. El riesgo real es de privacidad, no técnico, y está
  cubierto por el detector.

---

## 8. Resumen de ejecución

| Fase | Etapas | Riesgo | Depende de |
|---|---|---|---|
| A | A1 Pantalla de inicio | Bajo | A-3 (diseño) |
| B | B1 Gastos · B2 Sociedades en piedras · B3 Tipo de producto + moneda | Bajo–Medio | A-1, A-2 (solo B3) |
| C | C1 Bruto → tallado · C2 Joyas completas + fantasía/natural | **Alto** | B |
| D | D1 Libro del negocio | Medio | B, C |
| E | E1 Dashboard · E2 Excel · E3 Consolidado | Medio | D |
| F | F1 Catálogo PDF | Bajo–Medio | C2 |

**Se puede empezar hoy con A1** (en cuanto Santiago elija el diseño) **y con B1**
(no está bloqueada por nada).

---

## 9. Qué NO está en este plan

Para que no se cuele alcance por el camino:

- Colecciones de joyas (el campo `collectionId` existe pero sigue reservado).
- Catálogo como página web en vivo. La primera versión es PDF, por decisión de
  Santiago.
- Cobros, suscripciones, invitaciones de varios miembros, Realtime,
  notificaciones y dominio propio: siguen fuera de alcance (D-031/D-035).
- Identificar esmeralda por esmeralda dentro de un lote: descartado
  explícitamente por Santiago.
- Publicar. La publicación es una orden separada y expresa, siempre.
