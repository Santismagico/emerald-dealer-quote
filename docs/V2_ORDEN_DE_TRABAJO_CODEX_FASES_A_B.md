# Orden de trabajo para Codex — Plan v2, Fases A y B

**Fecha:** 2026-08-03
**Autor:** Claude (arquitectura)
**Rama:** `codex/fase2-nube`
**Base:** `cc1fddd` (docs del plan v2)
**Punto de restauración:** tag `punto-seguro-pre-v2-2026-08-03` (= `f8dc78e`)
**Plan completo:** `docs/PLAN_MAESTRO_V2.md`
**Decisiones aplicables:** D-052, D-053, D-054, D-057, D-058

---

## 0. Qué se te pide, en una frase

Construir **cuatro etapas** —la pantalla de inicio (A1) y las tres de la Fase B
(gastos, sociedades en piedras, tipo de producto y moneda)— **en cuatro commits
separados**, cada uno con `npm test` y `npm run build` en verde, sin publicar
nada.

---

## 1. Antes de escribir una línea

Lee **`docs/PLAN_MAESTRO_V2.md` §6 (Principios de operación)** completo. Son 22
reglas y no se negocian. Las que más se van a poner a prueba en estas cuatro
etapas:

- **§6.2.6 Prueba obligatoria de no regresión de dinero.** En cada etapa que
  toque datos existentes debe existir una prueba que demuestre que los registros
  creados antes del cambio **dan exactamente el mismo dinero que daban antes**.
- **§6.3.8 Todo cambio de datos es aditivo.** Campos nuevos opcionales con valor
  por defecto. Nunca borrar ni renombrar un campo existente.
- **§6.3.11 No inventar datos.** Lo que no se registró muestra **"Sin
  registrar"**, nunca un valor supuesto ni deducido.
- **§6.4.14 Lección H1.** Toda validación que exista en el dispositivo **debe
  existir también en el servidor**. La defensa en la pantalla no sustituye la del
  servidor.
- **§6.1.1** No se publica nada. `main`, el enlace del piloto y
  `.github/workflows/deploy.yml` no se tocan.

**Una etapa = un commit.** No mezclar dos etapas en un commit.

---

## 2. Etapa A1 · Pantalla de inicio

**Decisión que la gobierna:** D-052, incluida su sección "Forma elegida".

### 2.1 Qué se construye

Una vista nueva `home` que pasa a ser **la vista inicial de la aplicación**, con
la forma que Santiago eligió: **portada agrupada, con la cifra del mes arriba**.

**La cifra de arriba.** El resultado del mes. **No inventes un cálculo nuevo:**
reutiliza exactamente el que ya produce el Cierre mensual (`buildMonthlyReport`),
con el mismo nombre que usa esa pantalla. Si los dos números no coinciden, el
error está en tu implementación.

**Los grupos**, en este orden, con estos destinos y **solo con los que ya
existen hoy**:

| Grupo | Filas | Destino |
|---|---|---|
| Vender | Cotizador | vista `history` |
| Producir y atender | Taller · Agenda | `workshop` · `agenda` |
| Inventario | Piedras · Material · Joyas — Cobros | `stones` y su sección de cobros |
| La plata | Cierre del día · Cierre mensual | vistas de cierre existentes |
| Tu gente | Clientes · Compradores · Proveedores · Socios | vistas existentes |
| Cuenta | Ajustes · Cuenta | vistas existentes |

**No crees filas para lo que todavía no existe.** Catálogo (Fase F), Panel
(Fase E) y Gastos (etapa B1) **no van** en este commit. Gastos entra en B1 y
Panel/Catálogo en sus fases. Una fila que lleve a una pantalla inexistente es un
defecto.

**Los globitos.** Número solo donde hay algo que atender: citas de hoy (el
contador ya existe), cobros vencidos, trabajos en proceso. El resto de las filas
van sin adorno.

### 2.2 La barra inferior

**Inicio reemplaza a "Más".** La barra queda en cinco botones (D-046):

```
Inicio · Cotizador · Taller · Agenda · Inventario
```

Agenda **conserva su globito** de citas de hoy. **Todo destino que hoy se
alcanza desde "Más" debe seguir alcanzándose desde Inicio** — verifícalo uno por
uno antes de dar la etapa por terminada.

### 2.3 Reglas de esta etapa

- **No toca datos.** Cero cambios en `schema.ts`, cero migraciones, cero cambios
  en la nube. Si esta etapa produce una migración, está mal planteada.
- **No rompas el guardado diferido.** La navegación actual pasa por
  `runAfterViewFlush` en `App.tsx`; el Taller y los abonos dependen de él para no
  perder ediciones. Cualquier navegación nueva desde Inicio debe usarlo igual.
- Un usuario que ya tenía la aplicación abierta en otra vista no debe perder lo
  que estaba escribiendo al desplegarse esta versión.

### 2.4 Verificación

- `npm test` y `npm run build` en verde.
- Recorrido real: la app abre en Inicio; desde Inicio se llega a **cada uno** de
  los destinos de la tabla y se vuelve; la barra inferior funciona; el globito de
  Agenda aparece cuando hay citas hoy.
- Sin desbordamiento horizontal en **320, 390 y 1280 px**; botones ≥ 44 px.
- La cifra del mes en Inicio es **idéntica** a la del Cierre mensual del mismo
  mes.

---

## 3. Etapa B1 · Registro de gastos del negocio

### 3.1 Por qué existe

Sin gastos, cualquier "ganancia" que muestre el panel de la Fase E sería mentira.
Esta etapa es un cimiento del libro del negocio (D-057).

### 3.2 Qué se construye

Entidad nueva `Expense`, **completamente aditiva**:

```
id · date (YYYY-MM-DD) · concept · category · amountCop (entero) ·
method · paidBy · partnerId (null) · notes · createdAt · updatedAt
```

- **`category`:** lista base ampliable, con el mismo criterio de D-058
  (arriendo, servicios, transporte, herramientas, publicidad, nómina, impuestos,
  otro). Una categoría ya usada no se borra: se deja de ofrecer y el historial
  conserva su nombre.
- **`method` y `paidBy`:** obligatorios en gastos nuevos, igual que en las ventas
  desde D-051.
- **`partnerId`:** opcional. Un gasto puede pertenecer a una sociedad; si es
  null, es tuyo.

### 3.3 La cadena completa

Como en las ampliaciones anteriores: tipos → `schema.ts` → motor puro
`expenses.ts` con pruebas → escalón IndexedDB **v8** → **BACKUP_VERSION 8** que
acepta v1–v7 → storage → dataSource → store → outbox → sync → api → importer →
**migración SQL aditiva** con RLS, escritura directa revocada, función protegida
y `organization_id` resuelto por el servidor.

### 3.4 Reglas de esta etapa

- **Un gasto sale de caja el día en que se pagó** (coherente con D-045). No se
  reparte entre días ni se anticipa.
- **Los cierres cambian, pero solo si hay gastos.** Prueba obligatoria: con cero
  gastos, el Cierre del día y el Cierre mensual devuelven **exactamente** los
  mismos totales que antes de esta etapa.
- El gasto es **interno**. Nunca aparece en un documento del cliente.

### 3.5 Verificación

- `npm test` y `npm run build` en verde.
- Recorrido real: crear un gasto, verlo en el cierre del día correspondiente,
  recargar y que persista, editarlo sin perder `method`/`paidBy`, borrarlo con
  confirmación.
- La prueba de "cero gastos = mismos totales" debe existir y pasar.
- Migración local v7→v8 probada **contra una base v7 real**, como se hizo en las
  ampliaciones anteriores.

---

## 4. Etapa B2 · Sociedades en los lotes de esmeraldas

**Decisión que la gobierna:** D-053.

### 4.1 Qué se construye

`StoneLot` gana la propiedad compartida:

```
partnerId (null) · partnerName · myPercent (0..100, entero)
```

- **Reutiliza la entidad de socios que ya existe** (`MaterialPartner`, D-049),
  generalizada a material **y** piedras. **No crees una entidad paralela** y **no
  migres destructivamente la existente**. En la interfaz se llama "Socios".
- Un lote sin socio es 100% propio y **debe dar exactamente el mismo dinero que
  hoy**.
- Borrar un socio **conserva su nombre y el reparto histórico**, igual que ya
  ocurre en material.

### 4.2 El reparto — lee esto con cuidado

- El reparto se calcula sobre el **resultado real** (recibido − costo), **nunca**
  sobre el precio de lista. Un lote que todavía no ha vendido nada no reparte
  ganancia.
- **El dinero no se pierde ni se crea al repartir.** Con COP enteros, un 60/40
  sobre un resultado impar deja un peso suelto. La suma de las partes **debe ser
  exactamente igual al total**: asigna el residuo de forma determinista (siempre
  al mismo lado, documentado) y **escribe una prueba con un número impar** que lo
  demuestre. Este es el defecto más probable de esta etapa.
- Una pérdida también se reparte. No conviertas un resultado negativo en cero.

### 4.3 Reglas de esta etapa

- `myPercent` fuera de 0..100 se rechaza — **en el dispositivo y en el servidor**
  (§6.4.14). No repitas el hallazgo H1 de la auditoría anterior.
- La migración SQL es **aditiva y nueva**; no se reescribe ninguna ya aplicada en
  producción.
- Cambio de datos aditivo: los lotes existentes se normalizan a `partnerId: null`
  y `myPercent: 100`.

### 4.4 Verificación

- `npm test` y `npm run build` en verde.
- **Prueba de no regresión de dinero:** un lote anterior a esta etapa, con ventas
  y abonos, da el mismo resultado que antes.
- Prueba del residuo con reparto impar.
- Recorrido real: crear un lote 60/40, vender, ver tu parte y la del socio por
  separado, recargar y que persista, borrar el socio y comprobar que el nombre y
  el reparto se conservan.

---

## 5. Etapa B3 · Tipo de producto y moneda

**Decisiones que la gobiernan:** D-054 (moneda) y D-058 (tipo de producto).

### 5.1 Tipo de producto

Campo `productType` en las operaciones de venta (piedras y joyas), con **lista
base ampliable**:

> esmeralda en bruto · esmeralda tallada · joya con piedra natural · joya con
> piedra de fantasía · material (oro/plata) · trabajo por encargo

- Santiago puede agregar los suyos; se guardan por organización.
- Un tipo ya usado en una venta **no se borra**: se deja de ofrecer para ventas
  nuevas y el historial conserva su nombre.
- Las ventas anteriores muestran **"Sin registrar"**. **No les asignes un tipo
  adivinado a partir del módulo de origen** — eso es inventar datos (§6.3.11).

### 5.2 Moneda — la tasa se guarda por operación

Campo `usdRate` en cada operación de dinero que el libro del negocio va a leer:
`StoneSale`, sus abonos, `StockJewelSale` y `Expense`.

**No necesitas ninguna API nueva, ninguna dependencia y ningún cambio de CSP.**
La aplicación **ya consulta la tasa USD→COP** en
`src/services/goldPrice.ts` (`https://open.er-api.com/v6/latest/USD`), ya está en
la lista blanca de la CSP, ya tiene límites de sanidad
(`MIN_COP_PER_USD` 1000 / `MAX_COP_PER_USD` 20000) y ya funciona sin internet con
el último valor guardado. **Reutiliza ese servicio.** Si agregas una fuente nueva,
la etapa está mal resuelta.

Comportamiento:

- Al registrar una operación, la tasa viene **prellenada** con el valor vigente y
  **es editable a mano** (una compra pudo pactarse a otra tasa).
- Sin internet, se prellena con el último valor conocido, indicando que lo es.
- La tasa guardada **no se vuelve a tocar nunca**. Si el dólar cambia mañana, esa
  operación conserva la suya (D-054).

### 5.3 La regla que no se rompe

**El almacenamiento sigue siendo COP entero, siempre** (§6.2.5). El dólar es
**solo una forma de ver**. Cambiar la vista a dólares **no puede modificar ni un
solo dato guardado**. Escribe una prueba que lo demuestre: cambiar la moneda de
visualización y verificar que el almacenamiento queda byte a byte igual.

Las operaciones sin `usdRate` (las anteriores a esta etapa) muestran **"Sin
registrar"** en la vista de dólares. **No se les calcula una tasa retroactiva.**

### 5.4 Verificación

- `npm test` y `npm run build` en verde.
- **Prueba de no regresión de dinero** sobre ventas anteriores.
- Prueba de que cambiar la vista a USD no altera el almacenamiento.
- Recorrido real: registrar una venta con tipo de producto y tasa prellenada,
  editar la tasa a mano, cambiar la vista a dólares y volver, recargar y
  comprobar que todo persiste. Probar también sin conexión.

---

## 6. Reglas que NO se rompen (confírmalas al entregar)

1. `main`, el enlace del piloto y `.github/workflows/deploy.yml` **sin tocar**.
2. **Nada publicado.**
3. `src/calc/engine.ts` sin cambios.
4. `src/services/pdfContent.test.ts` sin cambios y **pasando**.
5. La lógica del precio del oro sin cambios (solo se **reutiliza** su tasa).
6. `package.json` y `package-lock.json` **sin dependencias nuevas**. Si crees que
   una es imprescindible, **detente y escríbelo** en vez de agregarla.
7. Ningún secreto en el repositorio; la referencia del proyecto de producción no
   queda en el paquete público.
8. Escalones de IndexedDB de a uno; `BACKUP_VERSION` acepta todas las versiones
   anteriores.
9. Toda validación local existe también en el servidor.
10. Textos en español; 320/390/1280 px sin desbordamiento; botones ≥ 44 px.

---

## 7. Entregable

Por **cada** etapa:

1. Un commit propio, con mensaje que diga qué cambió y por qué.
2. Resultado literal de `npm test` (archivos y número de pruebas) y de
   `npm run build`.
3. Qué verificaste en navegador y en qué anchos.
4. Actualizar `PROJECT_STATE.md`, `DECISIONS.md` si aparece una decisión nueva, y
   la bitácora de etapas.

Al terminar las cuatro:

5. Un resumen con el estado de cada etapa y **cualquier cosa que te haya
   parecido dudosa**, aunque la hayas resuelto. Prefiero una duda escrita a una
   suposición silenciosa.

**No sigas a la Fase C.** Es la de riesgo alto (bruto → tallado y joyas
fantasía/natural) y lleva su propia orden después de que Claude audite estas
cuatro etapas.
