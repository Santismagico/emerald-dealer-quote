# Auditoría de Claude — Plan v2, Fases A y B

**Fecha:** 2026-08-04
**Auditor:** Claude (independiente; no escribió este código)
**Rama:** `codex/fase2-nube`
**Commits auditados:** `c666baf` (A1) · `5e3019b` (B1) · `7f8d2d6` (B2) · `f70708a` (B3)
**Base de comparación:** `ffb95b7` (la orden de trabajo)
**Orden auditada:** `docs/V2_ORDEN_DE_TRABAJO_CODEX_FASES_A_B.md`

---

## Veredicto

# APROBADO

Las cuatro etapas cumplen la orden. Corrí yo mismo todas las verificaciones; no
acepté ningún resultado por escrito.

Quedan **tres observaciones** que no bloquean, y **un riesgo residual heredado**
que Santiago debe conocer antes de publicar (§4).

No publiqué nada, no modifiqué `main` y no modifiqué el workflow de despliegue.

---

## 1. Verificación mecánica (ejecutada por mí)

| Comprobación | Resultado |
|---|---|
| `npm test` | **APROBADO** — 846 pruebas en 56 archivos (antes 751 en 46) |
| `npm run build` | **APROBADO** — `tsc --noEmit` y Vite sin errores |
| `npm run test:public-cloud` | **APROBADO** — ver nota de procedimiento abajo |
| `npm run security:secrets` | **APROBADO** — ningún secreto detectado |
| `main` intacto | **SÍ** — sigue en `0a86e5a` |
| Un commit por etapa | **SÍ** — cuatro commits separados |

**Nota de procedimiento (error mío, no de Codex).** La primera corrida de
`test:public-cloud` falló porque compilé con `.env.local` presente, es decir la
versión **de nube**, y ese verificador es para la versión **pública**. Repetí la
prueba apartando `.env.local` temporalmente y restaurándolo con una trampa de
salida: **aprobada**, sin Supabase en la precarga y con la CSP exacta
(`connect-src 'self' https://api.gold-api.com https://open.er-api.com`). El
archivo del dueño quedó restaurado.

Esa misma prueba confirma algo que anticipé en la orden: **la moneda no necesitó
ningún cambio de CSP ni fuente de red nueva**.

---

## 2. Archivos protegidos

Ninguno fue tocado. Verificado con `git diff --stat` contra la base:

- `package.json` y `package-lock.json` → **sin dependencias nuevas**
- `src/calc/engine.ts` → sin cambios
- `src/services/pdfContent.test.ts` → sin cambios y **pasando**
- `.github/workflows/deploy.yml` → sin cambios

---

## 3. Los puntos donde advertí que se suele fallar

### 3.1 El peso suelto al repartir entre socios (B2) — **CORRECTO**

`src/services/stones.ts:126-127`:

```
partnerResult = Math.trunc((realResult * (100 - myPercent)) / 100)
myResult      = realResult - partnerResult
```

Al derivar la parte propia como **el resto**, la suma es exactamente igual al
total por construcción: no se pierde ni se crea un peso. Funciona igual con
pérdidas, porque `Math.trunc` redondea hacia cero y la resta absorbe el residuo.
El residuo cae **siempre del lado propio**, en ganancia y en pérdida:
determinista, como pedí.

Las dos pruebas exigidas existen y afirman el invariante
(`src/services/stones.test.ts:211` y `:219`): reparto impar positivo (101 → 61 +
40) y **pérdida impar** (−101 → −61 + −40).

### 3.2 La lección H1: validar también en el servidor (B2) — **CORRECTO**

`supabase/migrations/20260803220000_sociedades_lotes_piedras.sql:73-81` valida
`myPercent` con `private.is_nonnegative_integer` (cubre entero y ≥ 0) y luego
rechaza `> 100`. El rango 0..100 queda cerrado **en el servidor**, no solo en la
pantalla. Además exige 100% propio cuando no hay sociedad.

Revisé primero solo el límite superior y me pareció incompleto; al leer la
función de validación completa quedó claro que el límite inferior sí está
cubierto.

### 3.3 Migraciones aditivas sobre producción viva — **CORRECTO**

Ninguna de las tres migraciones contiene `drop table`, `drop column`, `truncate`
ni `alter column ... drop`. El único `delete from` está **dentro** de
`public.delete_expense`, limitado a `organization_id` resuelto por el servidor
con `private.current_organization_id_for_roles` — nunca recibido del cliente.

### 3.4 Las tres pruebas obligatorias — **EXISTEN Y PASAN**

- No regresión de dinero: `b3MoneyRegression.test.ts:9` — *"conserva exactamente
  ventas, abonos, resultados y gastos anteriores"*.
- Cero gastos: `dailyReport.test.ts:195` — *"con cero gastos devuelve exactamente
  el reporte y el dinero anteriores"*.
- La vista en dólares no toca lo guardado: `currencyPersistence.test.ts:29` —
  *"deja el almacenamiento byte a byte igual al pasar COP → USD → COP"*.

---

## 4. Verificación real en navegador

Compilación local servida en `localhost:4174`, medida a 320, 375 y 1280 px.

**Pantalla de inicio (A1):**

- Encabezado: *"Resultado de agosto de 2026 · Movimiento neto · $ 0"*, con la
  leyenda **"Es la misma cifra del Cierre mensual."** — no inventa una métrica
  nueva, y se lo dice al usuario.
- Los seis grupos exactos de la orden, con sus destinos correctos.
- **"Cuenta" se oculta en la versión local**, porque exige nube. Correcto.
- Barra inferior: **Inicio · Cotizador · Taller · Agenda · Inventario** — cinco
  botones, D-046 respetado, Agenda conserva su globito.
- Las 15 filas son `<button>` reales, enfocables con teclado; ninguna por debajo
  de 44 px de alto.
- **Sin desbordamiento horizontal** a 320, 375 ni 1280 px. **Consola limpia.**
- Disciplina notable: "Gastos" **no** aparece en el commit de A1 (cuando aún no
  existía) sino en el de B1. No se dejó ninguna fila hacia una pantalla
  inexistente.

**Pantalla de gastos (B1):** dice *"Cada gasto sale de caja en la fecha en que se
pagó. Esta información es interna."*; categorías base ampliables con *"Si dejas
de ofrecer una, su historial se conserva"*; e interruptor COP/USD con una nota
honesta: *"Solo cambia cada gasto con su propia tasa. El total filtrado sigue en
COP."* Eso es exactamente lo correcto: no finge una conversión total cuando cada
gasto tiene tasa distinta.

**Aviso sobre un falso positivo mío.** Los clics sintéticos sobre la barra
inferior no navegaban y llegué a sospechar un defecto. Al disparar el clic desde
el propio botón, la navegación funcionó de inmediato. **No es un defecto de la
aplicación**: el panel del navegador no estaba componiendo imagen en esta sesión
(la captura de pantalla también fallaba por lo mismo). Lo dejo escrito para que
nadie lo herede como hallazgo.

---

## 5. Observaciones (no bloquean)

### O1 — `goldPrice.ts` fue modificado y la orden decía no tocarlo

`AGENTS.md` protege la lógica del precio del oro y mi orden §6.5 decía "sin
cambios (solo se reutiliza su tasa)". Codex sí modificó el archivo.

**Lo revisé línea por línea y el cambio es legítimo:** exportó las dos constantes
ya existentes sin alterar sus valores, agregó `isValidUsdRate` con **los mismos
límites** (1000–20000) y `fetchUsdRateCOP` con **la misma URL**. La matemática
del oro está intacta y **ninguna prueba fue borrada ni debilitada** — el único
cambio en `goldPrice.test.ts` es la línea de importaciones.

Hay un cambio de comportamiento mínimo: una tasa fuera de rango ahora se rechaza
un paso antes, con un mensaje ligeramente distinto. Sigue negándose a actualizar
el precio, que es lo que protege la regla.

**Recomendación:** dejarlo, pero **registrarlo en `DECISIONS.md`**, porque
`AGENTS.md` exige decisión escrita para tocar ese archivo. Es una deuda de
documentación, no de código.

### O2 — `BACKUP_VERSION` quedó en 8 tras B3

B1 lo subió a 8 por el almacén nuevo de gastos. B3 agregó campos opcionales
(`productType`, `usdRate`) que normalizan a valor por defecto, así que no exigen
otro escalón. **Es defendible**, pero conviene que quede dicho: un respaldo v8
puede venir con o sin esos campos y ambos casos deben importar bien.

### O3 — Codex amplió la prueba N6 por su cuenta

Extendió `scripts/test-rls-isolation.mjs` para cubrir las tablas nuevas. Es
trabajo bienvenido: **cierra el hallazgo H2** de la auditoría anterior de
inventario. No estaba pedido en esta orden, pero suma y no rompe nada.

---

## 6. Riesgo residual heredado — para Santiago

**No pude ejecutar la prueba N6 real entre dos cuentas.** Requiere las
credenciales de un proyecto de pruebas, que un agente no debe manejar. Por lo
tanto:

- El aislamiento entre joyerías de las tablas nuevas (`expenses`, y los campos
  nuevos de lotes y ventas) está verificado **por revisión de código**: RLS
  activada, escritura directa revocada, escritura solo por función protegida y
  `organization_id` resuelto por el servidor. No encontré ninguna vía de cruce.
- **No está demostrado de extremo a extremo en un servidor real.**

Es exactamente el mismo riesgo que Santiago ya aceptó conscientemente para la
ampliación de inventario anterior. Lo repito aquí porque una aceptación previa no
se extiende sola a un lote de cambios nuevo: **es una decisión suya, no mía.**

---

## 7. Estado y siguiente paso

Las cuatro etapas quedan **aprobadas técnicamente** y **sin publicar**. `main` y
las 7 joyerías del piloto no fueron tocadas.

Antes de la Fase C conviene cerrar O1 (registrar la decisión sobre `goldPrice.ts`).

**La Fase C es la de riesgo alto** —esmeraldas en bruto → talladas por tandas, y
joyas fantasía/natural que descuentan del inventario de piedras— y lleva su
propia orden de trabajo, que se escribe ahora que estas cuatro etapas están
limpias.
