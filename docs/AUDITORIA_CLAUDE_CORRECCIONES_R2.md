# Auditoría de Claude — Correcciones R2: navegación y gráfica

**Fecha:** 2026-08-04
**Auditor:** Claude (independiente; no escribió este código)
**Rama:** `codex/fase2-nube`
**Commits auditados:** `200409d` (R2-1 navegación y área Dinero) · `d2e79f6` (R2-2 gráfica del inicio)
**Orden auditada:** `docs/V2_ORDEN_CORRECCIONES_SANTIAGO_R2.md`
**Decisiones:** D-070 · D-071 · D-046 · D-052 · D-057 · D-063 · D-045

---

## Veredicto

# APROBADO

La confusión de navegación quedó resuelta de raíz y la gráfica funciona. Verifiqué ambas
cosas **usando la aplicación con datos reales**, no solo leyendo el código.

Queda **una pregunta de producto para Santiago** (§6.1) que no es un defecto, pero que
él debería responder.

No publiqué nada, no modifiqué `main` y no modifiqué el workflow de despliegue.

---

## 1. Verificación mecánica

| Comprobación | Resultado |
|---|---|
| `npm test` | **APROBADO** — 985 pruebas en 68 archivos (antes 981 en 67) |
| `npm run build` | **APROBADO** |
| `npm run test:public-cloud` | **APROBADO** |
| `npm run test:csp` | **APROBADO** — *"Hash CSP final verificado"* |
| `npm run security:secrets` | **APROBADO** |
| `main` intacto | **SÍ** — `0a86e5a` |

**Sin dependencias nuevas. Cero migraciones.** `engine.ts`, `pdfContent.test.ts` y el
workflow, sin cambios — tal como exigía §4 de la orden.

---

## 2. R2-1 · Un solo vocabulario

**Verificado en la aplicación:**

- **Barra inferior:** `Inicio · Cotizador · Taller · Inventario · Dinero` — **cinco
  botones**, D-046 intacto.
- **El primer grupo de Inicio es la barra**, mismos nombres y orden: *Tu día a día →
  Cotizador · Taller · Inventario · Dinero*. Ese era el corazón de la corrección y está
  cumplido.
- **Tres grupos**, no seis: *Tu día a día · Tu gente · Otras cosas*.
- **La Agenda salió de la barra** y vive en *Otras cosas*, sin borrarse.
- **"Dinero" es un área con secciones**, copiando el patrón de Inventario:
  **Panel · Cierre del día · Cierre mensual · Consolidado · Gastos** — los cinco destinos,
  ninguno perdido.

Las pruebas lo fijan: *"usa en Inicio el mismo vocabulario y orden de la barra inferior"*
y *"mantiene los cinco destinos de Dinero en una sola área"* (`home.test.ts:64` y `:83`).

---

## 3. R2-2 · La gráfica

### Funciona, y las cuentas cuadran

Probé con datos reales: una joya vendida en $1.200.000 con costo de $500.000, y un gasto
de arriendo de **$300.000 fechado el 29 de julio**.

| Vista | Resultado | ¿Correcto? |
|---|---|---|
| Caja · 30 días (mes) | $700.000 | **Sí** — julio queda fuera del mes calendario |
| Caja · 1 año | **$400.000** y **dibuja** | **Sí** — 700.000 − 300.000, dos días distintos |

La gráfica traza área y línea (2 trazos) en cuanto hay dos días con movimiento. Con un
solo día muestra *"Aún no hay suficientes movimientos en días distintos para dibujar la
gráfica"*, que es el caso vacío que pedí.

### La promesa de D-052, conservada y dicha en voz alta

La pantalla declara: **"Es exactamente la misma cifra del Cierre mensual. El período de
30 días representa el mes calendario del cierre."** Y la prueba
`homeChart.test.ts:44` — *"iguala exactamente la Caja mensual del inicio con el Cierre
mensual"* — lo fija.

### Colores: los que validé, sin cambios

`--home-chart-series: #0b7f57` en claro y `#2fa87a` en oscuro (`index.css:42` y `:78`),
exactamente los dos que pasaron el validador de daltonismo. **Una sola medida a la vez**,
con interruptor: nunca dos series superpuestas.

### El globo, mejor resuelto que mi propuesta

Yo pedí recortarlo contra los bordes. Codex fue más lejos: lo dibuja **dentro del SVG**
(`<g transform=…>`) y además lo recorta en **ambos ejes**
(`HomeBusinessChart.tsx:114-120`). Así es **estructuralmente imposible** que se salga del
lienzo, no solo improbable.

### Velocidad

Expusieron la medición como atributo inspeccionable (`data-ledger-build-ms`). Medido en
vivo: **0,1 – 0,5 ms**. Es una base pequeña, así que el dato no prueba el caso con años de
historia, pero **la instrumentación queda puesta** para medirlo cuando la haya.

### Interfaz

Sin desbordamiento horizontal; **ningún botón por debajo de 44 px**.

---

## 4. Sobre los errores de consola

Aparecen violaciones de CSP por script en línea. **No son de la aplicación.**
`npm run test:csp` responde *"Hash CSP final verificado"*: el hash del script propio
coincide con su política. El script bloqueado lo inyecta el entorno de pruebas del
navegador. **No hay hallazgo aquí.**

---

## 5. Observación de método — tres falsas alarmas mías

Durante esta auditoría creí encontrar tres defectos. **Los tres eran errores míos**, y los
dejo escritos para que nadie los herede:

1. *"Falta el commit del Excel"* — lo busqué solo desde la orden R2; estaba antes en la
   historia.
2. *"El gasto no se guarda"* — al listar los campos incluí los desplegables y al llenarlos
   no, así que metí el monto en la casilla de la tasa del dólar.
3. *"La gráfica no dibuja"* — leí el DOM en el mismo instante del clic, antes de que la
   pantalla se redibujara.

La aplicación se comportó bien en los tres casos.

---

## 6. Observaciones

### O1 — Pregunta de producto: "Ganancia" no descuenta los gastos del negocio

Con el arriendo de $300.000 registrado, **la Caja bajó a $400.000 pero la Ganancia siguió
en $700.000**.

Es **coherente con lo que yo mismo especifiqué**: D-063 define ganancia como *lo vendido
menos lo que costó lo vendido*. El arriendo no es costo de la mercancía, así que no entra.
El código hace exactamente lo pedido.

**Pero conviene que Santiago lo sepa y decida.** Él pidió el registro de gastos con el
argumento de que *"sin gastos, cualquier ganancia sería mentira"*. Puede que al ver
"Ganancia" espere *lo que de verdad me quedó*, ya descontado el arriendo, la nómina y los
servicios.

Hay dos lecturas legítimas y son decisiones suyas, no mías:

- **Como está hoy:** Ganancia = margen de las ventas. Los gastos se ven en Caja y en
  Gastos. Sirve para saber si vende bien.
- **La alternativa:** agregar una tercera cifra —*Resultado del negocio*— que sí reste los
  gastos. Sirve para saber si el negocio gana.

**No pido cambio.** Lo planteo para que él elija.

### O2 — La gráfica abre en "Caja", no en "Ganancia"

Elección razonable: conserva la continuidad con el número que el inicio mostraba antes y
mantiene visible la promesa de D-052 desde el primer segundo. Lo anoto por si Santiago
prefiere abrir en Ganancia.

### O3 — Sigue pendiente la prueba N6

Sin cambios. Santiago decidió resolverla al publicar.

---

## 7. Estado

R2 **aprobada** y **sin publicar**. `main` y las 7 joyerías del piloto no fueron tocadas.

Con esto quedan cerradas **todas las tandas de corrección** que salieron de la prueba de
usuario de Santiago. Lo que sigue no es técnico: decidir si publicar, cuándo y cómo, y
resolver antes el aislamiento entre joyerías. La agenda con reserva de clientes sigue
aceptada como proyecto aparte, aún sin planear.
