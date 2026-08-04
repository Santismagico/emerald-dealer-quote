# Auditoría de Claude — Plan v2, Fase C (riesgo alto)

**Fecha:** 2026-08-04
**Auditor:** Claude (independiente; no escribió este código)
**Rama:** `codex/fase2-nube`
**Commits auditados:** `14ffeea` (C1 talla por tandas) · `2617c19` (C2 transformación de joyas)
**Base de comparación:** `804e6d9`
**Orden auditada:** `docs/V2_ORDEN_DE_TRABAJO_CODEX_FASE_C.md`

---

## Veredicto

# APROBADO

La fase de riesgo alto quedó bien resuelta. Corrí yo mismo todas las
verificaciones y **probé el recorrido completo de talla en la aplicación real**,
no solo en pruebas automáticas.

No publiqué nada, no modifiqué `main` y no modifiqué el workflow de despliegue.

---

## 1. Verificación mecánica (ejecutada por mí)

| Comprobación | Resultado |
|---|---|
| `npm test` | **APROBADO** — 940 pruebas en 62 archivos (antes 846 en 56) |
| `npm run build` | **APROBADO** |
| `npm run test:public-cloud` | **APROBADO** — sin Supabase en precarga, CSP exacta |
| `npm run security:secrets` | **APROBADO** |
| `main` intacto | **SÍ** — `0a86e5a` |
| Un commit por etapa | **SÍ** |

**Archivos protegidos, ninguno tocado:** `package.json`, `package-lock.json`
(**sin dependencias nuevas**), `src/calc/engine.ts`,
`src/services/pdfContent.test.ts`, `.github/workflows/deploy.yml`.

**Migraciones:** ninguna contiene `drop table`, `drop column`, `truncate` ni
`alter column ... drop`. Son aditivas, como exige §5.5.

---

## 2. La condición central de la fase

> *Un lote sin tandas de talla y sin usos internos debe comportarse exactamente
> como hoy, hasta el último peso y el último quilate.*

**Cumplida.** La prueba existe con ese propósito explícito:
`src/services/stonesCutting.test.ts:79` — *"un lote anterior conserva exactamente
existencias, dinero y resultado"*.

El diseño la hace casi inevitable: una venta anterior normaliza a
`origin: 'bruto'`, y como un lote antiguo no tiene tandas, "bruto disponible"
queda igual a `carats − vendido`, que es el `remainingCarats` de siempre. **No se
necesitó migrar datos**, tal como preveía la orden.

---

## 3. La regla que más fácil se rompe

> *La transformación fantasía→natural NO es un movimiento de caja.*

**Cumplida, y probada desde los cuatro ángulos** que pedí
(`src/services/dailyReportTransformation.test.ts`):

- conserva exactamente el cierre del día de compra del lote;
- conserva exactamente el cierre del día en que entró la joya;
- **no crea entradas ni salidas de caja el día de la transformación**;
- traslada el costo sin cambiar el resultado total esperado del negocio.

El modelo respalda la regla: `StoneInternalUse` está declarado en los tipos como
*"No es una venta ni un movimiento de caja: es un traslado interno de costo"*, y
vive en `internalUses[]`, **separado de `sales[]`**. No se modeló como una venta
de precio cero, que era el error obvio a evitar.

---

## 4. La lección H1: validar también en el servidor

**Cumplida con holgura.** Las funciones protegidas rechazan:

- `raw stone inventory exceeded` — comprado − enviado a talla − vendido en bruto
  no puede ser negativo.
- `cut stone inventory exceeded` — regresado − vendido tallado no puede ser
  negativo.
- `stone internal uses exceed raw inventory` y `... exceed cut inventory` — las
  piedras que se van a joyas también se descuentan **en el servidor**.
- `stock jewel already consumed a natural stone`,
  `stock jewel cannot be transformed twice`, y la transformación no puede ser
  anterior a la adquisición de la pieza.
- `invalid stone cutting dates or return`, incluido que el pago de la talla no
  sea anterior al envío.

**Además hizo más de lo pedido, y bien:** el servidor impide **omitir** el
historial de tandas (`stone cutting history cannot be omitted`) y protege de forma
conservadora una tanda ya regresada cuando su producto se vendió —bloqueando
cambios en los datos físicos pero **dejando editar costo, fecha de pago y
notas**—. Ese matiz respeta D-047 sin volver el registro inmanejable.

---

## 5. Recorrido real en la aplicación

Compilación local servida en `localhost:4174`. **Ejecuté el flujo completo de
talla con datos reales**, no solo lo leí:

1. Lote creado: **100 ct · 10 piedras · $1.000.000**.
   Existencias iniciales: Bruto 100/10 · En talla 0 · Tallado 0.
2. Tanda enviada: **20 ct · 2 piedras**, con costo de talla $150.000 sin pagar.
   → Bruto **80 ct · 8 pz**, En talla **20 ct · 2 pz**.
   → **"Tallas pendientes de pago: $150.000"** aparece aparte y la
   **"Inversión registrada" NO subió**: sigue en $1.000.000. Correcto según
   D-045: lo que no se ha pagado no salió de caja.
3. Regreso registrado: **6 ct** de los 20, y **3 piezas de las 2 enviadas**.
   → **"Merma promedio de talla: 70%"**, calculada sola.
   → Tallado **6 ct · 3 pz**; la piedra partida fue aceptada sin bloqueo, tal
   como exige el negocio real.
   → Totales del lote coherentes: **86 ct y 11 piezas** (8 en bruto + 3 talladas).

La ficha del lote muestra costo del lote, tallas pagadas, tallas pendientes,
inversión registrada, merma y resultado parcial. **El costo de talla se ve, no
solo se guarda**, que era el refuerzo que Santiago pidió expresamente.

Antes de la primera tanda, la merma decía **"Sin dato"** en vez de un número
inventado.

**Formulario de joya (C2):** tiene los cuatro campos nuevos —peso total, número
de piedras, **talla o medida como texto libre** ("talla del anillo…") y **clase de
piedra con "Sin registrar" por defecto**—. El costo conserva su aviso de
*"Interno. Nunca aparece en un documento del cliente"*.

**La piedra de fantasía que sale no se rastrea.** Busqué entidad, campo o
existencia para ella: no existe ninguna. La decisión de Santiago se respetó al pie
de la letra.

**Medidas:** sin desbordamiento horizontal a **320, 375 ni 1280 px**. **Consola
sin errores.**

---

## 6. Observaciones (no bloquean)

### O1 — No ejecuté la transformación de una joya en el navegador

Verifiqué el flujo de talla de extremo a extremo con datos reales, pero **no el de
transformación**: exigía crear una joya con foto y encadenar varios pasos más. Esa
parte está respaldada por **~700 líneas de pruebas nuevas**
(`stoneJewelTransformation.test.ts`, `...Persistence.test.ts`,
`dailyReportTransformation.test.ts`, `backupTransformation.test.ts`), que sí
ejecuté y pasan.

**Lo digo explícitamente para que no se lea como más verificación de la que hubo.**
Recomiendo que Santiago haga esa prueba de usuario cuando tenga una joya real:
sus pruebas han encontrado dos defectos que ninguna revisión técnica vio.

### O2 — La migración de C2 es grande

1.653 líneas en un solo archivo. No encontré nada incorrecto en ella, pero es la
pieza más difícil de revisar de todo el proyecto. Conviene tenerlo presente si más
adelante hay que corregir algo allí.

### O3 — Sigue pendiente la prueba N6 real

El aislamiento entre joyerías de lo nuevo está verificado **por revisión de
código**, no de extremo a extremo. Santiago decidió el 2026-08-04 resolverlo **en
el momento de publicar**. Sigue abierto.

---

## 7. Estado y siguiente paso

Fase C **aprobada técnicamente** y **sin publicar**. `main` y las 7 joyerías del
piloto no fueron tocadas.

Queda desbloqueada la **Fase D — el libro del negocio** (`ledger.ts`), que es
justamente la que va a leer todo lo que esta fase definió: tandas de talla, costos
de talla pagados, usos internos y transformaciones. La prueba que validará esa
fase sigue siendo la misma: que los cierres actuales den **exactamente** los
mismos totales al pasar a leer del libro.
