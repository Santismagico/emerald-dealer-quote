# Auditoría Codex — Ampliación de inventario

**Fecha:** 2026-07-25

**Carpeta auditada:** `C:\Dev\emerald-dealer`

**Rama auditada:** `codex/fase2-nube`

## VEREDICTO: BLOQUEADO

El código local quedó corregido y las pruebas locales están en verde, pero la
publicación **no está autorizada todavía** por dos comprobaciones externas
obligatorias:

1. Falta que Santiago confirme **Success** al aplicar la migración correctiva
   en el proyecto desechable N6 y en producción.
2. Falta ejecutar N6 de verdad entre dos cuentas. La identidad pública del
   proyecto de pruebas está configurada, pero no existe
   `SUPABASE_SECRET_KEY` en el archivo local ni en las variables disponibles.
   La clave no se inventó, copió ni imprimió.

Por estas razones no se hizo ningún push a
`Santismagico/emerald-dealer-app` y no se verificó un sitio nuevo en vivo.

## 1. Identidad del repositorio comprobada antes de trabajar

- ✔ Se trabajó únicamente en `C:\Dev\emerald-dealer`.
- ✔ Rama: `codex/fase2-nube`.
- ✔ Punto de partida de esta corrección:
  `042e6f8f5e4f4ed8e81078749b26e06e2e11c64a`.
- ✔ `main` y `origin/main` coinciden exactamente en
  `0a86e5ab8160f3a20428d5700266f1ece98b14a9`.
- ✔ El repositorio fuente es
  `https://github.com/Santismagico/emerald-dealer-quote.git`.
- ✔ La publicación no va a `main`: cuando todos los controles estén en verde,
  irá al repositorio separado `Santismagico/emerald-dealer-app`.
- ✔ No se usó ni se modificó la copia congelada de OneDrive.

## 2. Correcciones realizadas

### H1 — El servidor aceptaba usar más gramos de los existentes

**Estado local: CORREGIDO.**

- Se agregó la migración nueva y aditiva
  `supabase/migrations/20260725150651_validar_suma_usos_material.sql`.
- Reemplaza únicamente el validador privado; no toca tablas ni filas
  (`20260725150651_validar_suma_usos_material.sql:10-55`).
- Rechaza una lista de salidas ausente o que no sea una lista
  (`20260725150651_validar_suma_usos_material.sql:26-30`).
- Suma todas las salidas y rechaza cuando superan los gramos comprados
  (`20260725150651_validar_suma_usos_material.sql:43-49`).
- Un lote de 10 g con salidas de 7 g + 7 g debe devolver el error de datos
  inválidos `22023`.
- La función conserva ejecución normal, ruta segura y permisos cerrados
  (`20260725150651_validar_suma_usos_material.sql:16-18,54-55`).
- La prueba que vigila esta regla está en
  `src/services/cloud/migrations.test.ts:236-278`.
- El texto exacto para Supabase está separado en
  `docs/SQL_PRODUCCION_CORRECCION_VALIDACION_MATERIALES.md`.

**Pendiente bloqueante:** falta aplicar esa migración y confirmar **Success**
en N6 y producción.

### H2 — N6 no cubría las cuatro tablas nuevas

**Estado del comprobador: CORREGIDO.**

`scripts/test-rls-isolation.mjs` ahora cubre las diez tablas editables:

- `org_settings`
- `clients`
- `quotes`
- `appointments`
- `stone_lots`
- `suppliers`
- `buyers`
- `stock_jewels`
- `material_partners`
- `material_lots`

Evidencia en el código:

- Lista completa y funciones protegidas:
  `scripts/test-rls-isolation.mjs:12-30`.
- Datos válidos de las cuatro tablas nuevas, incluido un lote con `grams`,
  `myGrams`, `uses` y `costCop`:
  `scripts/test-rls-isolation.mjs:146-185`.
- Altas protegidas, lecturas propias y lecturas cruzadas:
  `scripts/test-rls-isolation.mjs:187-215`.
- Altas, cambios y borrados directos negados:
  `scripts/test-rls-isolation.mjs:217-268`.
- Para `update` y `delete`, N6 acepta tanto un rechazo explícito como el
  filtrado seguro de cero filas que usa RLS; en ambos casos vuelve a leer el
  registro y falla si cambió o desapareció
  (`scripts/test-rls-isolation.mjs:107-119,217-268`).
- Cada función protegida actúa solo sobre la cuenta de la sesión y no acepta
  una cuenta enviada por el navegador:
  `scripts/test-rls-isolation.mjs:298-396`.
- La sesión anónima no puede leer ni escribir directamente, ni usar las
  funciones protegidas:
  `scripts/test-rls-isolation.mjs:397-481`.
- El caso real de 10 g con 14 g usados y el caso sin lista de salidas se
  rechazan y no dejan una fila guardada:
  `scripts/test-rls-isolation.mjs:493-567`.
- La limpieza comprueba que no queden cuentas ni usuarios de prueba:
  `scripts/test-rls-isolation.mjs:568-597,694-710`.
- La evidencia anterior se invalida al comenzar, solo puede aprobar si todos
  los controles son verdaderos y queda ligada a una rama, un árbol limpio y
  el commit exacto:
  `scripts/test-rls-isolation.mjs:75-86,598-617,665-710`.

El guardián del propio comprobador también fue ampliado:
`scripts/test-rls-isolation.guard.node-tests.mjs:48-164`.

**Pendiente bloqueante:** el comprobador no se ejecutó contra el servidor
porque falta la clave secreta del proyecto N6 y aún no hay confirmación de que
la migración correctiva esté aplicada allí. La evidencia N6 antigua no cuenta.

### Hallazgo adicional H4 — Restaurar un respaldo local dentro de una cuenta nube

**Estado: CORREGIDO.**

La auditoría nueva detectó que restaurar desde Ajustes mientras había una
cuenta nube podía dejar datos solo en el dispositivo, traer de vuelta datos
anteriores del servidor o conservar operaciones pendientes viejas.

Corrección:

- En modo nube, Ajustes ya no presenta el botón ni el selector de archivo para
  reemplazar datos locales (`src/components/SettingsView.tsx:28-55`).
- El usuario es dirigido al importador de Cuenta, que agrega o actualiza y no
  promete un reemplazo total.
- En modo local, restaurar un respaldo sigue disponible.
- `App` informa explícitamente a Ajustes si hay una cuenta nube
  (`src/App.tsx:445`).
- El aviso local de reemplazo ahora nombra también compradores, joyas, socios
  y lotes de material (`src/components/SettingsView.tsx:25-26`).
- Las pruebas de reemplazo y rollback abarcan las diez colecciones
  (`src/services/backupAtomic.test.ts:73-84,287-341`).
- La prueba de importación inicial a nube incluye datos reales de las cuatro
  entidades nuevas (`src/services/cloud/importer.test.ts:41-82,139-147`).

### Correcciones preventivas adicionales

- Se agregó una prueba literal que confirma que un día y un mes sin crédito
  conservan exactamente el mismo ingreso, salida y neto de contado
  (`src/services/dailyReportInventory.test.ts:212-229`).
- La orden de publicación ya no guarda una clave pública concreta en el
  repositorio; ahora usa un marcador que debe completarse solo al compilar
  (`docs/AMPLIACION_INVENTARIO_ORDEN_PUBLICACION_CODEX.md:39`).

## 3. Pruebas ejecutadas por Codex

### Pruebas completas

Comando ejecutado: `npm test`

Resultado exacto:

- **45 archivos de prueba aprobados**
- **733 pruebas aprobadas**
- **0 fallas**
- Verificación de iconos y configuración PWA aprobada

### Compilación

Comando ejecutado: `npm run build`

Resultado exacto:

- TypeScript terminó sin errores.
- Vite transformó **324 módulos**.
- La compilación terminó correctamente.
- El PWA generó `dist/sw.js` y `dist/workbox-9c191d2f.js`.

También se hizo una compilación pública temporal, retirando `.env.local` de
forma reversible:

- **324 módulos** compilados.
- **15 elementos** en la precarga pública.
- `npm run test:public-cloud`: **aprobado**.
- Resultado: “Compilación pública sin Supabase en precarga y CSP verificada”.
- `.env.local` quedó restaurado.
- El archivo temporal quedó eliminado.
- `.env.production.local` no existe.

### Guardianes de seguridad

- `npm run security:secrets:test`: **18 de 18 aprobados**.
- `npm run security:secrets`: **ningún secreto detectado**.
- `node --check scripts/test-rls-isolation.mjs`: aprobado.
- `git diff --check`: aprobado.

### Prueba N6 real

- **NO EJECUTADA.**
- Motivo: falta la credencial secreta del proyecto desechable y falta confirmar
  la migración correctiva allí.
- Consecuencia: este único resultado pendiente impide afirmar que el
  aislamiento real entre dos cuentas está en verde.

## 4. Checklist crítico de la orden

### 4.1 El dinero nunca se pierde ni se duplica

- ✔ Apagar el indicador de crédito no borra abonos:
  `src/services/stones.ts:485-493`; pruebas en
  `src/services/stonesCreditGuards.test.ts:58-95,122-130`.
- ✔ Los avisos de borrar lote o venta nombran ventas, pagos, deudas y el dinero
  que desaparecería:
  `src/components/StonesView.tsx:59-88`; pruebas en
  `src/components/StonesView.test.ts:5-95`.
- ✔ Saldos, vencimientos y días de atraso se calculan desde ventas y abonos, no
  son contadores guardados:
  `src/services/receivables.ts:91-210`.
- ✔ El reparto de materiales no supera el lote, el restante no baja de cero y
  la proporción se mantiene:
  `src/services/materials.ts:36-57,171-199`.
- ✔ La protección equivalente ya existe en el servidor con la migración
  correctiva. Falta aplicarla.

### 4.2 Cierres honestos

- ✔ Una venta a crédito no entra como caja el día de la venta.
- ✔ Cada abono entra el día real en que se recibe.
- ✔ Una joya sale de caja el día en que entra al inventario.
- ✔ Día y mes usan la misma función pura:
  `src/services/dailyReport.ts:390-431`.
- ✔ Pruebas de crédito, abonos y joyas:
  `src/services/dailyReportInventory.test.ts:71-185,232-279`.
- ✔ No regresión sin crédito comprobada expresamente:
  `src/services/dailyReportInventory.test.ts:212-229`.

### 4.3 Privacidad del cliente

- ✔ `src/services/pdfContent.test.ts` pasó dentro de las 733 pruebas y no fue
  modificado.
- ✔ El documento del cliente se construye separado del documento interno:
  `src/services/pdfContent.ts:132-187,191-250`.
- ✔ Las pruebas usan textos internos señuelo y comprueban que no lleguen al
  cliente:
  `src/services/pdfContent.test.ts:189-294`.
- ✔ No se encontró una ruta desde compradores, costos de joyas, socios,
  materiales, reparto, márgenes o notas internas hacia un documento cliente.

### 4.4 Migraciones SQL sobre datos reales

- ✔ `20260721210000_inventario_compradores_y_joyas.sql` crea tablas e índices
  nuevos, activa RLS y define funciones:
  líneas `16-68,74-212`.
- ✔ `20260724210000_inventario_materiales.sql` crea tablas e índices nuevos,
  activa RLS y define funciones:
  líneas `15-63,71-181`.
- ✔ Ninguna de las dos elimina tablas, columnas ni filas al aplicarse.
- ✔ Las frases `delete from` que contienen están dentro de las funciones
  protegidas de borrar una sola entidad de la cuenta de la sesión; no son
  borrados ejecutados por la migración.
- ✔ Los `drop policy if exists` reemplazan políticas por su versión protegida;
  no tocan los datos.
- ✔ RLS queda activa, la lectura se limita a miembros y la escritura directa
  queda cerrada.
- ✔ Ninguna función nueva recibe `p_organization_id`; la cuenta se obtiene en
  el servidor.
- ✔ Hay validación de joyas, lotes de piedra, dinero, costos y materiales.
- ✔ La migración correctiva es únicamente `create or replace function` más
  cierre de permisos; es segura sobre datos existentes.
- ⚠ La migración original de materiales no debe volver a ejecutarse sola
  después de la correctiva, porque reinstalaría temporalmente el validador
  anterior. Si se repite el conjunto, debe respetarse el orden y dejar siempre
  `20260725150651` de última.
- ⚠ “Puramente aditivas” no es una descripción literal de los archivos
  originales porque reemplazan políticas y permisos. Sí son aditivas y
  seguras respecto de tablas, columnas y datos reales.
- ✘ Falta confirmar la aplicación de `20260725150651` en N6 y producción.

### 4.5 Aislamiento y cadena de nube

- ✔ Renombrar o borrar comprador propaga únicamente los lotes y joyas que
  cambiaron:
  `src/services/cloud/inventoryCloud.test.ts:129-203`.
- ✔ Renombrar o borrar socio propaga únicamente los lotes de material que
  cambiaron:
  `src/services/cloud/materialsCloud.test.ts:85-139`.
- ✔ Las cuatro tablas nuevas usan sus funciones protegidas correctas:
  `src/services/cloud/api.ts:68-71`.
- ✔ El comprobador N6 actualizado cubre lecturas, escrituras, funciones y
  sesión anónima para las diez tablas.
- ✘ Falta la ejecución real N6 entre dos cuentas; este punto sigue bloqueado.

### 4.6 Migraciones locales y respaldos

- ✔ IndexedDB agrega escalones y conserva datos:
  `src/services/db.ts:22-71`.
- ✔ Una base v5 real migra sin pérdida:
  `src/services/inventoryPersistence.test.ts:96-220`.
- ✔ Una base v6 real migra sin pérdida:
  `src/services/materialsPersistence.test.ts:59-148`.
- ✔ `BACKUP_VERSION = 7` y acepta versiones anteriores:
  `src/services/backup.ts:52,118-305`.
- ✔ El reemplazo local usa una sola operación para las diez colecciones y las
  pruebas fuerzan fallos en cada una para demostrar rollback:
  `src/services/backupAtomic.test.ts:73-84,287-341`.
- ✔ Una venta antigua sin marcas de crédito sigue leyéndose como contado con
  el mismo valor:
  `src/services/inventoryPersistence.test.ts:203-214`.
- ✔ En cuenta nube se eliminó la falsa restauración local; solo queda el flujo
  de importación nube explícito.

### 4.7 Interfaz

Comprobación visual real hecha sobre la compilación canónica:

- ✔ 320 × 800: sin desbordamiento horizontal.
- ✔ 390 × 844: sin desbordamiento horizontal.
- ✔ 1280 × 900: sin desbordamiento horizontal.
- ✔ Los cinco botones inferiores quedaron visibles en móvil.
- ✔ Inventario mostró Piedras, Material, Joyas y Cobros.
- ✔ Se abrieron Material, Joyas y Cobros a 320 px sin desbordamiento.
- ✔ Los overlays conservaron espacio por encima del menú móvil.
- ✔ A 1280 px la navegación quedó lateral y el contenido usó el resto del
  ancho.
- ✔ Consola del navegador sin errores ni advertencias.

Referencias:
`src/App.tsx:387,471-515`,
`src/components/InventoryView.tsx:20-71`,
`src/index.css:469-588`.

## 5. Reglas inquebrantables

- ✔ `main` intacto:
  `main = origin/main = 0a86e5ab8160f3a20428d5700266f1ece98b14a9`.
- ✔ `.github/workflows/deploy.yml` no cambió desde `3edf476`.
- ✔ `package.json` y `package-lock.json` no cambiaron desde `3edf476`; no hay
  dependencias nuevas.
- ✔ No hay secretos ni clave `service_role` en archivos versionados o
  preparados.
- ✔ `src/calc/engine.ts` no cambió desde `3edf476`.
- ✔ `src/services/goldPrice.ts` no cambió desde `3edf476`.
- ✔ La configuración del recargo del oro sigue intacta.
- ✔ No se tocó `main`.
- ✔ No se tocó el workflow de despliegue.
- ✔ No se publicó nada.

## 6. Hallazgos y severidad

| Hallazgo | Severidad | Estado | ¿Bloquea? |
|---|---:|---|---:|
| El servidor permitía 10 g con 14 g de salidas | Alta | Corregido localmente; falta aplicar SQL | Sí |
| N6 omitía cuatro tablas nuevas | Alta | Comprobador corregido; falta ejecución real | Sí |
| Restaurar desde Ajustes en nube no era una sustitución segura | Alta | Corregido y probado | No, ya corregido |
| La migración original no debe repetirse sola después de la correctiva | Media | Documentado; la correctiva debe ir de última | No si se respeta el orden |
| “Puramente aditivas” no describe literalmente reemplazos de políticas/permisos | Baja | Aclarado; no hubo pérdida de datos | No |

## 7. Qué necesita hacer Santiago para desbloquear la publicación

1. Seguir exactamente
   `docs/SQL_PRODUCCION_CORRECCION_VALIDACION_MATERIALES.md`.
2. Pegar el SQL primero en **Emerald Dealer - Pruebas Fase 2** y confirmar
   **Success**.
3. Pegar el mismo SQL en producción y confirmar **Success**.
4. Ejecutar N6 con `npm run security:n6:secure` desde
   `C:\Dev\emerald-dealer`, introduciendo la clave secreta únicamente en el
   campo oculto del comprobador.
5. Confirmar que N6 termina completamente en verde y genera evidencia para el
   commit exacto.

La clave secreta no debe enviarse por chat, guardarse en el repositorio ni
aparecer en una captura.

Solo después de esos pasos se puede cambiar este veredicto a
**APROBADO PARA PUBLICAR** y seguir
`docs/AMPLIACION_INVENTARIO_ORDEN_PUBLICACION_CODEX.md`.

Hasta entonces: **NO PUBLICAR**.

---

## 8. Publicación final autorizada por Santiago — 2026-07-25

### Estado final: PUBLICADO

Santiago, como dueño, anuló expresamente el bloqueo anterior únicamente respecto
de la prueba en vivo N6 y aceptó ese riesgo. La omisión de N6 fue una decisión
directa del dueño; no se interpretó como una aprobación técnica de esa prueba.

Santiago también confirmó que las tres migraciones ya estaban aplicadas en
Producción con resultado **Success**. No se reaplicaron migraciones y no se tocó
el proyecto de Pruebas.

Constancia de publicación:

- Árbol fuente compilado: rama `codex/fase2-nube`, commit
  `e4b40929e20bb33a411edd4d557b9fb2331255b4`.
- Destino exclusivo: `Santismagico/emerald-dealer-app`, rama `main`.
- Commit publicado:
  `b280c07de07875701963b99ba62ea57906410d7b`.
- Commit anterior del sitio:
  `3a4f95a5c8c1d1c94741cd1d82fce559a71b78d2`.
- Resultado de la verificación de base:
  `/emerald-dealer-app/assets/index-D4Tnzyvh.js`.
- GitHub Pages terminó con estado **built** para el commit publicado.
- El sitio en vivo respondió correctamente y cargó sin errores ni advertencias
  en la consola del navegador.
- La versión servida en vivo contiene `Inventario` con las secciones
  **Piedras · Material · Joyas · Cobros**.
- No se inició sesión con cuentas reales de clientes.
- `.env.production.local` fue eliminado inmediatamente después de compilar y se
  confirmó que no existe.
- No se tocó `main` ni `.github/workflows/deploy.yml` del repositorio fuente.

### Corrección de la clave pública de Producción — 2026-07-25

Después de la publicación inicial, Santiago reportó que la creación de cuenta
era rechazada. La comprobación confirmó que el primer build había combinado la
dirección de Producción con una clave publicable perteneciente al proyecto de
Pruebas. La solicitud llegaba a Producción, pero era rechazada con estado 401.

Se recompiló exactamente el mismo árbol fuente, sin cambios de código, usando
la clave publicable confirmada del proyecto de Producción.

Constancia de la corrección:

- Árbol fuente: rama `codex/fase2-nube`, commit
  `e4b40929e20bb33a411edd4d557b9fb2331255b4`.
- Destino exclusivo: `Santismagico/emerald-dealer-app`, rama `main`.
- Commit corregido publicado:
  `6f9690ec7faddb30cbf0078eeec55383963fbbf0`.
- Commit reemplazado:
  `b280c07de07875701963b99ba62ea57906410d7b`.
- Resultado de la verificación de base:
  `/emerald-dealer-app/assets/index-DiqLeqsP.js`.
- `npm test`: **733 pruebas aprobadas**.
- `npm run build`: **324 módulos compilados**.
- GitHub Pages completó correctamente la publicación del commit corregido.
- El sitio en vivo sirve `assets/index-DiqLeqsP.js`, carga la pantalla de acceso
  y abre la pantalla de creación de cuenta.
- La clave publicada fue aceptada por el servicio de Producción con estado 200,
  sin crear una cuenta ni usar cuentas reales de clientes.
- El paquete servido en vivo contiene **Piedras · Material · Joyas · Cobros**,
  además de **Compradores** y **Socios de material**.
- `.env.production.local` no se creó; la clave se usó únicamente durante el
  proceso de compilación y se confirmó que el archivo sigue ausente.
- No se reaplicaron migraciones ni se modificó el proyecto de Pruebas.
- No se tocó `main` ni `.github/workflows/deploy.yml` del repositorio fuente.

### Actualización de nombres de clientes — 2026-07-25

Santiago autorizó registrar y publicar un ajuste exclusivamente de textos para
distinguir las dos listas de clientes en la pestaña **Más**. No se modificaron
datos, flujos ni reglas de negocio.

Constancia de esta actualización:

- Árbol fuente compilado: rama `codex/fase2-nube`, commit
  `e6ecae61bac492247866a4fedcdd8194baff28e6`.
- Cambio publicado:
  - **Clientes por encargo** — “Cotizaciones, agenda y piezas a medida”.
  - **Clientes de inventario** — “Piedras, joyas disponibles, saldos y cobros”.
- Destino exclusivo: `Santismagico/emerald-dealer-app`, rama `main`.
- Commit publicado:
  `653bd8ebe2f8563657be6657dabe897351ea4d42`.
- Commit anterior del sitio:
  `6f9690ec7faddb30cbf0078eeec55383963fbbf0`.
- Resultado de la verificación de base:
  `/emerald-dealer-app/assets/index-D9YATZ-D.js`.
- `npm test`: **733 pruebas aprobadas**.
- `npm run build`: **324 módulos compilados**.
- El sitio en vivo respondió con estado 200, mostró **Emerald Dealer** y no
  registró errores ni advertencias en la consola del navegador.
- El archivo servido en vivo contiene los dos nombres nuevos, las secciones
  **Piedras · Material · Joyas · Cobros** y **Socios de material**.
- `.env.production.local` no se creó; la clave publicable de Producción se usó
  únicamente durante la compilación y no quedó guardada.
- No se reaplicaron migraciones ni se modificó el proyecto de Pruebas.
- No se tocó `main` ni `.github/workflows/deploy.yml` del repositorio fuente y
  la rama fuente no se empujó a `origin`.

### Trazabilidad de cobros y formulario de venta — 2026-07-26

Santiago autorizó publicar la corrección que vuelve revisables la forma de pago,
la persona que recibió el dinero y las notas de ventas y abonos. También autorizó
la mejora del formulario de venta y de los controles Contado/A crédito.

Constancia de esta actualización:

- Árbol fuente compilado: rama `codex/fase2-nube`, commit
  `0aca89ef2ecb9d64bf5e71fce293b85d0c1d8128`.
- Bloque funcional incluido:
  `1772263c4ecc7943fff02f3ea467c8b9630c6dac`.
- Destino exclusivo: `Santismagico/emerald-dealer-app`, rama `main`.
- Commit publicado:
  `762dc7c1e9359da7f942c4f6e5dc8bf676e14655`.
- Commit anterior del sitio:
  `653bd8ebe2f8563657be6657dabe897351ea4d42`.
- Archivo principal verificado antes y después de publicar:
  `/emerald-dealer-app/assets/index-CIj_IEc_.js`.
- `npm test`: **751 pruebas aprobadas en 46 archivos**.
- `npm run build`: **324 módulos compilados**.
- Los 18 archivos del paquete temporal coincidieron byte a byte con `dist`;
  `.nojekyll` se conservó.
- GitHub Pages terminó con estado **built** para el commit publicado.
- El sitio en vivo respondió con estado 200, mostró **Emerald Dealer**, cargó la
  pantalla de acceso, sirvió el archivo principal nuevo y no registró errores ni
  advertencias en la consola del navegador.
- El paquete servido contiene **Piedras · Material · Joyas · Cobros**, además de
  **Forma de venta**, el bloqueo de Contado cuando hay abonos y los nuevos datos
  de quién recibió el dinero.
- El manifiesto publicado conserva `start_url` y `scope` en
  `/emerald-dealer-app/`.
- No se inició sesión ni se usaron cuentas reales de clientes.
- N6 continuó expresamente omitida según la decisión previa de Santiago como
  dueño y su aceptación del riesgo.
- `.env.production.local` no se creó; la clave publicable de Producción se usó
  únicamente durante la compilación y no quedó escrita en el repositorio.
- No se reaplicaron migraciones ni se modificó el proyecto de Pruebas.
- No se tocó `main` ni `.github/workflows/deploy.yml` del repositorio fuente y
  la rama fuente no se empujó a `origin`.
