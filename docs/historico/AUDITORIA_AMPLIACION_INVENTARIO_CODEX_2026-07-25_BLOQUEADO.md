# Auditoría Codex — Ampliación de inventario

**Fecha:** 2026-07-25  
**Rama auditada:** `codex/fase2-nube`  
**Commit auditado:** `44f7aa4902fbfe7d59ed8fd365c9fcc402619d93`  
**Base de comparación:** `3edf476`  
**Último commit funcional indicado por la orden:** `3cd9e5c`  

## Veredicto

# BLOQUEADO

La rama **no queda autorizada para publicar**. Hay un defecto bloqueante en la
validación de inventario de materiales en la nube y falta una prueba real de
aislamiento entre cuentas para las cuatro tablas nuevas.

No corregí los hallazgos, no publiqué nada, no modifiqué `main` y no modifiqué
el workflow de despliegue.

## Pruebas ejecutadas por Codex

### Resultado obligatorio

- `npm test`: **APROBADO**.
  - 45 archivos de pruebas aprobados.
  - 720 pruebas aprobadas.
  - 0 fallidas.
  - Verificación de iconos y configuración PWA aprobada.
  - Duración informada por Vitest: 18,71 s.
- `npm run build`: **APROBADO**.
  - `tsc --noEmit`: sin errores.
  - Vite: compilación terminada correctamente.
  - 324 módulos transformados.
  - PWA y service worker generados.

La primera ejecución local encontró una carpeta temporal de Windows sin
permisos y una instalación incompleta de dependencias. Reinstalé exactamente
las dependencias ya declaradas, sin cambiar `package.json` ni
`package-lock.json`, usé una carpeta temporal dentro del proyecto y repetí
ambas órdenes completas. Los resultados anteriores son los de esas ejecuciones
finales válidas.

### Comprobaciones adicionales

- `npm run test:public-cloud`: **APROBADO**. La compilación pública no precarga
  Supabase y la política de seguridad del navegador fue verificada.
- Búsqueda de `wrvokfzrcmmlzekudypu` dentro de `dist`: **sin coincidencias**.
- `npm run security:secrets`: **APROBADO**. No se detectaron secretos en
  archivos versionados o preparados.
- `npm run security:secrets:test`: **APROBADO**, 9 de 9 pruebas.
- Prueba visual real en 320, 390 y 1280 px: **APROBADA**.
  - Sin desbordamiento horizontal.
  - Menú inferior con cinco botones.
  - Inventario muestra y abre Piedras, Material, Joyas y Cobros.
  - Botones táctiles de al menos 44 px.
  - A 320 px el formulario de material quedó 19 px por encima del menú inferior.

## Hallazgos

### H1 — ALTA — BLOQUEA

**La nube acepta usar más gramos de los que existen en un lote.**

- Archivo:
  `supabase/migrations/20260724210000_inventario_materiales.sql:90`.
- La función `assert_material_lot_payload` comprueba que cada salida tenga
  gramos no negativos (`:111-116`), pero no comprueba que la suma de todas las
  salidas sea menor o igual a los gramos comprados.
- La pantalla sí impide localmente una salida mayor al restante
  (`src/services/materials.ts:187-199`), pero esa defensa está en el dispositivo
  y no sustituye la validación del servidor.
- El resumen local recorta el restante a cero
  (`src/services/materials.ts:36-47`), por lo que un dato imposible recibido
  desde la nube puede quedar oculto como si el lote estuviera simplemente
  agotado.

**Cómo reproducir:** tomar un lote válido de 10 g y enviar por la función
protegida dos salidas de 7 g. Cada salida pasa la regla actual porque es
positiva; el total de 14 g también pasa porque no existe una comparación contra
los 10 g del lote.

**Impacto:** la nube puede guardar un inventario físicamente imposible. Eso
rompe la confianza en los gramos disponibles y en el reparto entre dueño y
socio. No se puede autorizar una ampliación de inventario con esta regla
faltante.

La prueba existente tampoco detecta el caso: solo confirma que aparecen los
campos de gramos, costo y parte propia
(`src/services/cloud/migrations.test.ts:223-230`).

### H2 — MEDIA — BLOQUEA LA PRUEBA DE AISLAMIENTO

**El comprobador real entre dos cuentas no incluye ninguna de las cuatro tablas
nuevas.**

- Archivo: `scripts/test-rls-isolation.mjs:7`.
- La lista probada contiene únicamente `org_settings`, `clients`, `quotes`,
  `appointments`, `stone_lots` y `suppliers`.
- Los datos de prueba de `scripts/test-rls-isolation.mjs:59-73` tampoco incluyen
  `buyers`, `stock_jewels`, `material_partners` ni `material_lots`.

**Cómo reproducir:** ejecutar `npm run security:n6` en el proyecto de pruebas
autorizado y revisar las tablas recorridas. La orden nunca intenta leer,
escribir o borrar datos cruzados en las cuatro tablas nuevas.

**Impacto:** la revisión del SQL muestra RLS, lectura limitada a la organización,
escritura directa revocada y `organization_id` resuelto por el servidor; no
encontré una vía concreta de cruce entre cuentas. Sin embargo, la prueba real
existente no demuestra esa protección para la ampliación nueva. En este equipo
no estaban disponibles las credenciales del proyecto desechable N6, y aun con
ellas el comprobador actual no cubriría las tablas nuevas.

### H3 — MEDIA — NO BLOQUEA POR SÍ SOLO, PERO DEBE ACLARARSE

**La identidad de `main` no coincide con la orden de auditoría.**

- La orden espera `git log -1 main = 0a86e5a`.
- En esta copia, `main` está en
  `0dd7500e963181d847e2a3659472d07d2c589381`.
- `origin/main` está en
  `8b6722ad9480aa5129a062766a7736a58ef1c93d`.
- El commit esperado `0a86e5a` no existe en esta copia.

No encontré cambios de la ampliación en `.github/workflows/deploy.yml`, pero
Claude debe reconciliar la referencia exacta de la versión base antes de
preparar cualquier publicación futura.

## Checklist de la orden

### §4.1 El dinero nunca se pierde ni se duplica

- ✔ `withSaleCredit` conserva los abonos al intentar apagar el crédito; la
  validación impide guardar una combinación deshonesta.
- ✔ Los avisos de borrar lote o venta nombran los pagos y saldos que se perderían.
- ✔ Saldos, vencimientos y días de atraso se calculan desde los movimientos; no
  son contadores guardados.
- ✘ Materiales: la aplicación local conserva el reparto y no baja de cero, pero
  el servidor permite que la suma de salidas supere el lote. Ver H1.

### §4.2 Cierres honestos

- ✔ Una venta a crédito no entra a caja al venderse.
- ✔ Cada abono entra en la fecha real en que se recibió.
- ✔ La compra de una joya de stock sale de caja en la fecha de adquisición.
- ✔ Los casos sin crédito conservan el mismo neto anterior.
- ✔ Las pruebas de cierres e inventario pasaron dentro de las 720 pruebas.

### §4.3 Privacidad del cliente

- ✔ `src/services/pdfContent.test.ts` pasó sin cambios.
- ✔ La ampliación no modificó la construcción del documento del cliente ni el
  flujo de compartirlo.
- ✔ No encontré costos de joyas, márgenes, compradores, socios, reparto de
  materiales ni notas internas conectados al documento del cliente.
- ✔ Los nuevos cierres se identifican expresamente como documentos internos.

### §4.4 Migraciones sobre producción viva

- ✔ Las dos migraciones crean tablas e índices nuevos y no eliminan tablas,
  columnas ni datos al aplicarse.
- ✔ Los `delete from` encontrados están dentro de las funciones de borrado que
  se crean; no se ejecutan al aplicar la migración y quedan limitados a la
  organización resuelta por el servidor.
- ✔ Los `drop policy if exists` reemplazan políticas de lectura de las tablas
  nuevas de forma repetible; no borran datos. Por eso son seguras sobre datos
  reales, aunque el comentario “solo create/grant” no sea literalmente exacto.
- ✔ RLS activada, lectura directa limitada y escrituras directas revocadas.
- ✔ Las escrituras usan funciones protegidas.
- ✔ Ninguna función nueva recibe `p_organization_id`; la organización se obtiene
  con `current_organization_id_for_roles`.
- ✘ La validación de materiales en el servidor está incompleta. Ver H1.
- ✔ Las validaciones de dinero, costos, cantidades y parte propia restantes
  están presentes.

### §4.5 Aislamiento y cadena de nube

- ✔ Renombrar o borrar compradores y socios propaga únicamente los lotes o joyas
  dependientes que cambiaron.
- ✔ Cada tabla nueva usa su función protegida correcta.
- ✔ La revisión estática de las migraciones mantiene los datos separados por
  organización.
- ✘ Falta demostrarlo de extremo a extremo entre dos cuentas para las cuatro
  tablas nuevas. Ver H2.

### §4.6 Migraciones locales y respaldos

- ✔ IndexedDB v6 y v7 agregan almacenes sin reemplazar los anteriores.
- ✔ `BACKUP_VERSION = 7` acepta respaldos v1 a v6.
- ✔ La importación normaliza primero y guarda todo en una sola operación, con
  rollback si falla.
- ✔ Una venta antigua sin marca de crédito se lee como venta de contado y
  conserva su valor.

### §4.7 Interfaz

- ✔ Sin desbordamiento horizontal a 320, 390 y 1280 px.
- ✔ Formularios con espacio seguro frente al menú inferior.
- ✔ Menú inferior de cinco botones.
- ✔ Inventario con cuatro secciones legibles y operativas.

### §5 Reglas que no se rompen

- ✘ La referencia de `main` no coincide con la indicada en la orden. Ver H3.
- ✔ Codex no modificó `main`.
- ✔ `.github/workflows/deploy.yml` no cambió dentro del alcance auditado.
- ✔ `package.json` y `package-lock.json` no cambiaron dentro del alcance auditado.
- ✔ No se detectaron secretos en el repositorio.
- ✔ La referencia del proyecto de producción no quedó en el paquete público.
- ✔ `src/calc/engine.ts` no cambió dentro del alcance auditado.
- ✔ No encontré cambios injustificados en el precio del oro.

## Condiciones mínimas para levantar el bloqueo

1. Crear una migración correctiva nueva y aditiva —sin reescribir la migración
   ya aplicada— que rechace cualquier lote donde la suma de `uses[].grams`
   supere `grams`.
2. Agregar una prueba que demuestre que un lote de 10 g con salidas totales de
   14 g es rechazado por el servidor.
3. Ampliar la prueba N6 para `buyers`, `stock_jewels`, `material_partners` y
   `material_lots`, y ejecutarla entre dos cuentas en el proyecto de pruebas
   autorizado.
4. Aclarar qué commit exacto representa la base `main` que Claude usará.
5. Volver a ejecutar `npm test`, `npm run build` y una auditoría Codex de las
   correcciones antes de solicitar autorización de publicación.

Hasta que estas condiciones se verifiquen, Claude **no queda autorizado a
publicar** la ampliación.
