# Auditoría de Claude — Plan v2, Fase E (ver y medir)

**Fecha:** 2026-08-04
**Auditor:** Claude (independiente; no escribió este código)
**Rama:** `codex/fase2-nube`
**Commits auditados:** `8b61630` (E0) · `a34d65f` (E1) · `056da94` (E2) · `c32eb52` (E3)
**Base de comparación:** `5b2986c`
**Orden auditada:** `docs/V2_ORDEN_DE_TRABAJO_CODEX_FASE_E.md`
**Decisiones aplicables:** D-063 · D-064 · D-053 · D-054 · D-057 · D-058 · D-045

---

## Veredicto

# APROBADO

Las tres pantallas que Santiago más quería quedan construidas y correctas.
Verifiqué el riesgo central de la fase —que ganancia y caja no se confundan— y el
detalle que decidía si el Excel servía de algo.

No publiqué nada, no modifiqué `main` y no modifiqué el workflow de despliegue.

---

## 1. Verificación mecánica (ejecutada por mí)

| Comprobación | Resultado |
|---|---|
| `npm test` | **APROBADO** — 957 pruebas en 65 archivos (antes 943 en 63) |
| `npm run build` | **APROBADO** |
| `npm run test:public-cloud` | **APROBADO** — sin Supabase en precarga, CSP exacta |
| `npm run security:secrets` | **APROBADO** |
| `main` intacto | **SÍ** — `0a86e5a` |
| Cuatro commits, en orden | **SÍ** — E0 → E1 → E2 → E3 |

**Archivos protegidos, ninguno tocado.** **Sin dependencias nuevas.** **Cero
migraciones**, como exigía §6.4: `attributedCostCop` vive en el evento del libro,
que es derivado, no almacenado.

Archivos nuevos: dos motores puros con sus pruebas (`salesAnalytics.ts`,
`excelExport.ts`) y dos vistas. La separación motor/pantalla se respetó.

---

## 2. E0 · Los dos invariantes del costo atribuido

Ambos probados, y con el caso difícil:

- *"no supera lo invertido y entrega el residuo COP al agotar un lote impar"* —
  reparte un lote de $1.000 en `[334, 334, 333]`, que **suma exactamente**
  `purchaseValueCop`, y comprueba que las dos primeras ventas no lo superan.
  Mismo criterio de residuo de B2.
- *"atribuye el costo a la venta sin duplicarlo en los cobros posteriores"* —
  verifica que **todos** los abonos posteriores llevan `attributedCostCop === 0`.

Ese segundo caso **no lo pedí explícitamente y es el más valioso de la etapa**: sin
él, el costo se habría contado otra vez en cada abono y toda ganancia a crédito
quedaría subestimada. Codex lo encontró solo.

**La prueba de equivalencia de D1 quedó intacta:** el diff sobre `ledger.test.ts`
es de **47 líneas añadidas y ninguna eliminada**. Ningún valor esperado fue
tocado, así que `cashIn`, `cashOut` y `net` siguen siendo los mismos.

---

## 3. El riesgo central: ganancia ≠ caja (D-063)

**Resuelto, y explicado al dueño en la propia pantalla.** Textos verificados en
vivo:

- *"Ganancia y caja son medidas distintas. Aquí siempre se muestran por separado."*
- Ganancia del período: *"Se reconoce el día de la venta, aunque el cliente pague
  después."*
- Caja del período: *"Solo dinero que realmente entró o salió. **No se suma con la
  ganancia**."*
- Cobros pendientes: *"Foto actual. **No son ganancia que falte**."*

Y quedó **demostrado con datos reales**. Con el lote de prueba de $1.000.000
comprado y sin ventas, el panel muestra:

| | |
|---|---|
| Caja del período | **−$1.000.000** |
| Ganancia del período | **$0** |

Es exactamente el comportamiento correcto: comprar inventario **no es una
pérdida**, es dinero que cambió de forma. Las dos cifras son ciertas y no se
contradicen.

---

## 4. E2 · El detalle que decidía si el Excel servía

Lo verifiqué **sobre los bytes reales del archivo**, no sobre el código.

| Comprobación | Resultado |
|---|---|
| BOM UTF-8 | **SÍ** — primeros bytes `EF BB BF` |
| Separador | **punto y coma**, no coma |
| Fin de línea | CRLF |
| Tildes y "ñ" | correctas — *"Período"*, *"Entró"*, *"Salió"* |
| Tipo de archivo | `text/csv;charset=utf-8` |
| Números | **numéricos puros** — `1000000`, `-1000000`; sin `$` ni puntos de miles |
| Marca interna | `Documento interno;No entregar al cliente` |

Ese archivo abre correctamente en Excel en español, con los números como números y
no como texto.

**Nota de método:** mi primera medición dijo que **no** tenía BOM. Era un artefacto
de `Blob.text()`, que elimina el BOM al decodificar. Lo comprobé de nuevo leyendo
los bytes crudos y el BOM sí está. **Lo dejo escrito para que nadie lo herede como
hallazgo.**

---

## 5. E1 y E3 · Lo demás de la orden

- **Períodos** día · semana · mes · año, con fecha de referencia. ✔
- **Vista COP/USD** con el criterio honesto de D-054: el motor lleva
  `usdKnownCount` y `usdMissingCount`, y la pantalla avisa cuántos movimientos no
  tienen tasa propia en vez de inventar una. ✔
- **D-064 completo:** `SalesAnalyticsPartnership` expone monto propio y del socio,
  lo invertido por cada uno, y `myReturnPercent` / `partnerReturnPercent`
  **anulables** —para decir "no aplica" cuando lo invertido es cero, en vez de
  infinito o 0%—. La comparación entrega `mostMoney` y `mostProfitable`.
  La pantalla lo explica: *"El monto y el porcentaje aparecen juntos para no
  decidir con una sola cifra."* ✔
- **Filtros** por sociedad y tipo de producto, y el consolidado dice expresamente
  que encuentra *"incluso datos sin registrar"*, que era lo que pedí para los
  registros antiguos. ✔
- **Todo marcado como interno:** ambas pantallas llevan el distintivo
  **DOCUMENTO INTERNO** y la nota *"No se envía ni aparece en documentos del
  cliente"*. ✔
- Las dos pantallas nuevas quedaron integradas en la portada de Inicio, bajo
  **LA PLATA**. ✔

**Medidas:** sin desbordamiento horizontal a **320, 375 ni 1280 px**; ningún botón
por debajo de 44 px; **consola sin errores**.

---

## 6. Observaciones (no bloquean)

### O1 — El Excel no se probó abriendo Excel de verdad

Verifiqué los bytes, el separador, el encoding y el formato de los números, que es
todo lo que determina si el archivo abre bien. Pero **no abrí Microsoft Excel**: no
está disponible en este entorno. La comprobación es sólida pero indirecta.

**Recomendación:** que Santiago descargue un Excel y lo abra una vez. Es un minuto y
cierra el único punto que queda por confirmar de esta etapa.

### O2 — Sigue pendiente la prueba N6 real

Sin cambios. Esta fase no toca la nube ni agrega tablas, así que no suma riesgo.
Santiago decidió resolverlo al publicar.

---

## 7. Estado y siguiente paso

Fase E **aprobada** y **sin publicar**. `main` y las 7 joyerías del piloto no
fueron tocadas.

Con esto el plan v2 lleva **cinco de seis fases** terminadas y auditadas. Queda la
**Fase F — el catálogo en PDF**, que es **la única salida al cliente de todo el
plan** y por eso exige una auditoría de privacidad aparte: es la primera vez desde
que empezó esta tanda que algo construido aquí va a salir de los dispositivos de
Santiago.
