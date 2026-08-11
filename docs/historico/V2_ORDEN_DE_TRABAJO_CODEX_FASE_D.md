# Orden de trabajo para Codex — Plan v2, Fase D (el libro del negocio)

**Fecha:** 2026-08-04
**Autor:** Claude (arquitectura)
**Rama:** `codex/fase2-nube`
**Base:** `96a5ee8` (auditoría de la Fase C, aprobada)
**Punto de restauración:** tag `punto-seguro-pre-v2-2026-08-03`
**Plan completo:** `docs/PLAN_MAESTRO_V2.md`
**Decisión que la gobierna:** **D-057**

---

## 0. Qué se te pide, en una frase

Construir `src/services/ledger.ts` —un motor puro que traduce todo lo que pasa en
el negocio a un flujo único de eventos— y hacer que los cierres actuales lean de
él **sin cambiar ni un peso de sus resultados**, en **dos commits**.

**Esta fase no tiene pantalla.** No construyas ninguna vista. Si terminas con un
componente nuevo, te saliste del alcance.

---

## 1. Por qué existe esta fase

El panel, los cierres en Excel y el consolidado (Fase E) muestran **la misma
plata**. Si cada pantalla la calculara por su cuenta a partir de lotes, joyas,
cotizaciones y gastos, tarde o temprano se contradirían. En una aplicación de
dinero eso destruye la confianza en todo lo demás.

El libro es la respuesta: **una sola verdad, cuatro presentaciones.**

`src/services/dailyReport.ts` ya hace algo parecido —recorre los módulos y arma
líneas por tipo—. **El libro es su generalización**, con las dimensiones que
faltan (lote, sociedad, tipo de producto, tasa) y sin perder nada de lo que hoy
hace.

---

## 2. La división en dos commits — **no la alteres**

Esta fase se parte en dos a propósito, para que el riesgo sea manejable:

### D1 · El libro, en paralelo y sin tocar nada

Crear `ledger.ts` **junto a** lo que ya existe. `dailyReport.ts` **no se
modifica** en este commit.

El entregable central de D1 no es el motor: es **la prueba de equivalencia**. Una
prueba que, sobre un conjunto de datos rico —lotes con crédito, tandas de talla
pagadas y sin pagar, usos internos, joyas transformadas, abonos, pagos de taller,
gastos, cotizaciones—, demuestre que:

> Los totales derivados del libro (`cashIn`, `cashOut`, `net`) son **exactamente
> iguales**, peso por peso, a los que hoy devuelven `buildDailyReport` y
> `buildMonthlyReport`.

Si esa prueba no pasa, **el libro está mal, no el reporte**.

### D2 · Los cierres pasan a leer del libro

Recién entonces `dailyReport.ts` se apoya en el libro y se elimina la
recopilación duplicada.

**Condición de aceptación:** las pruebas existentes de `dailyReport.test.ts`,
`dailyReportInventory.test.ts`, `dailyReportCutting.test.ts` y
`dailyReportTransformation.test.ts` deben seguir pasando **sin que se cambie ni un
solo valor esperado**. Si necesitas editar un número esperado para que pase, el
cambio está mal.

La prueba de equivalencia de D1 es la red de seguridad de D2. Por eso va primero.

---

## 3. La forma del evento

Un evento del libro, con las mismas dimensiones siempre:

```
LedgerEvent:
  id              estable y derivable del origen (no aleatorio)
  date            YYYY-MM-DD
  kind            del catálogo de §4
  direction       'entra' | 'sale' | 'ninguna'
  amountCop       entero SIEMPRE POSITIVO; el signo lo da direction
  usdRate         number | null   (null = sin registrar; nunca inventada)
  module          'cotizador' | 'taller' | 'piedras' | 'material' | 'joyas' | 'gastos'
  lotId           string | null
  partnerId       string | null
  partnerName     string
  myPercent       0..100
  productType     string   ('' = sin registrar)
  counterparty    string   cliente, comprador, proveedor, socio o tallador
  counterpartyId  string | null
  reference       id de la entidad de origen
  notes
```

**`direction: 'ninguna'` es la pieza clave de todo el diseño.** Permite que el
libro registre cosas que importan para el resultado pero **no son movimientos de
caja**: una venta a crédito el día que se pacta, un uso interno de piedras, una
transformación de joya. Sin ese tercer estado, el libro rompería D-045 el primer
día.

**`amountCop` siempre positivo.** No mezcles el signo con el sentido: es la fuente
clásica de errores de suma.

---

## 4. Catálogo de eventos

| kind | direction | Origen |
|---|---|---|
| `compra_lote_piedras` | sale | `StoneLot` en su fecha de compra |
| `venta_piedras_contado` | entra | `StoneSale` sin crédito |
| `venta_piedras_credito` | **ninguna** | `StoneSale` a crédito, el día de la venta |
| `abono_comprador` | entra | cada `BuyerPayment`, en su fecha real |
| `pago_proveedor` | sale | cada `SupplierPayment` |
| `pago_talla` | sale | tanda **con `cuttingPaidDate`**, en esa fecha |
| `uso_interno_piedra` | **ninguna** | `StoneInternalUse` |
| `compra_joya_stock` | sale | `StockJewel` en su `acquiredDate` |
| `venta_joya_stock` | entra | `StockJewelSale` |
| `transformacion_joya` | **ninguna** | transformación fantasía→natural |
| `abono_cliente` | entra | abonos de cotización |
| `pago_taller` | sale | pagos de etapas del taller |
| `gasto` | sale | `Expense`, en la fecha en que se pagó |
| `cotizacion_creada` | ninguna | actividad, no dinero |
| `cotizacion_aprobada` | ninguna | actividad, no dinero |
| `movimiento_material` | **ninguna** | ver §5 |

**Una tanda sin `cuttingPaidDate` no genera evento de pago.** Lo que no se ha
pagado no salió de caja (verificado en la Fase C).

---

## 5. El material no toca la caja

**D-048 sigue vigente:** el dinero del material **no entra a los cierres**, porque
es compartido.

El libro **sí puede registrar** los movimientos de material —para que la Fase E
pueda mostrarlos— pero **siempre con `direction: 'ninguna'`**, de modo que jamás
sumen a `cashIn` ni a `cashOut`. La prueba de equivalencia de D1 lo demuestra
sola: si un movimiento de material se colara como caja, los totales dejarían de
coincidir con los actuales.

---

## 6. Reglas del motor

1. **Puro.** Sin UI, sin almacenamiento, sin red, sin `Date.now()` implícito.
   Mismas entradas → mismas salidas, siempre.
2. **El libro es el único que decide `direction`.** Ninguna pantalla vuelve a
   juzgar si algo es caja o no. Esa es toda la razón de existir de esta fase.
3. **COP enteros.** Cualquier reparto o prorrateo debe cumplir que la suma de las
   partes sea **exactamente** igual al total, como en B2.
4. **Nunca inventar.** `usdRate: null` y `productType: ''` significan *sin
   registrar* y así deben propagarse a quien lea. No los rellenes con un valor
   por defecto que parezca dato.
5. **`id` derivable y estable.** Dos corridas sobre los mismos datos producen los
   mismos ids. Nada de aleatorios ni contadores de posición.
6. **Se calcula una vez y se filtra.** El libro se construye completo y luego se
   recorta por período o dimensión. No lo reconstruyas por cada día que alguien
   consulte: la Fase E va a pedirle un año entero.
7. **Sin dependencias nuevas.**

---

## 7. Lo que NO entra en esta fase

- **Ninguna pantalla.** Ni panel, ni Excel, ni consolidado: eso es la Fase E.
- Ningún cambio de datos: **cero campos nuevos, cero migraciones, cero cambios en
  la nube.** Si esta fase produce una migración, está mal planteada.
- Ningún cambio en las reglas de negocio. El libro **describe** lo que ya ocurre;
  no cambia cuándo entra o sale un peso.

---

## 8. Reglas que NO se rompen (confírmalas al entregar)

1. `main`, el enlace del piloto y `.github/workflows/deploy.yml` **sin tocar**.
2. **Nada publicado.**
3. `src/calc/engine.ts` y `src/services/pdfContent.test.ts` sin cambios.
4. Sin dependencias nuevas.
5. Los PDF de cierre siguen produciendo **exactamente** el mismo contenido.
6. Textos en español.

---

## 9. Entregable

Por cada commit: el resultado literal de `npm test` y `npm run build`, y
`PROJECT_STATE.md`, `DECISIONS.md` y la bitácora actualizados.

Al terminar, un resumen que responda expresamente:

- **¿Qué evento te costó más encajar en la forma única, y por qué?** Esa respuesta
  es la que más me sirve para auditar y para diseñar la Fase E.
- Todo lo que te haya parecido dudoso, aunque lo hayas resuelto.

**No sigas a la Fase E.** Claude audita el libro antes de que tres pantallas
empiecen a depender de él.
