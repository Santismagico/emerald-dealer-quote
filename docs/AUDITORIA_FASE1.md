# Auditoría Fase 1 — endurecimiento pre-SaaS

Este informe es acumulativo. Registra lo revisado, lo corregido y las pruebas que permiten repetir la verificación antes de la auditoría final de Fable.

## S1 — Auditoría de dinero

### Hallazgos

| Severidad | Descripción | Archivo | Corregido en commit |
|---|---|---|---|
| Alta | Un valor monetario no finito dentro de una venta o pago de un lote podía contaminar con `NaN` el resultado, la deuda y los totales de piedras. | `src/services/stones.ts` | S1 (este commit) |
| Baja | Faltaba una prueba explícita que reuniera los diez ejemplos decimales y demostrara la coherencia entre partes y total. | `src/calc/engine.test.ts` | S1 (este commit) |
| Baja | Faltaba una prueba explícita de deudas vivas en un mes sin movimientos. | `src/services/dailyReport.test.ts` | S1 (este commit) |

### Decisiones tomadas

- No se cambió el motor de cotizaciones: no apareció un error real en sus resultados.
- Los importes de piedras usan el mismo normalizador de COP ya existente: redondeo al peso, valores negativos o no finitos convertidos a cero.
- Un resultado negativo de un lote sigue siendo válido: representa que lo vendido todavía no recupera el costo. La deuda a proveedor y el saldo del cliente nunca se vuelven negativos.
- El sobrepago continúa visible por separado en `clientBalanceSummary` y en la vista derivada del taller; el saldo pendiente permanece en cero.
- La regla de redondeo comprobada es por componente: material, piedras, mano de obra, extras, margen, descuento e impuesto se redondean al peso antes de formar el total. Las partes mostradas cuadran exactamente con el total en los diez ejemplos auditados.

### Pruebas agregadas

- Normalización explícita de `500000.4`, `NaN`, `-1`, `Infinity` y `1e12` en COP.
- Márgenes de 0% y 300%.
- Descuento de 100% con impuesto sobre cero.
- Diez cotizaciones con peso de oro y quilates decimales, verificando enteros y suma exacta de componentes.
- Costos, ventas y pagos hostiles en lotes de piedras.
- Mes sin movimientos con deuda vigente de cliente y proveedor.

## S2 — Auditoría de datos

### Hallazgos

| Severidad | Descripción | Archivo | Corregido en commit |
|---|---|---|---|
| Media | Un respaldo con un abono cuyo monto era texto se aceptaba y convertía silenciosamente a cero. La orden de Fase 1 exige rechazarlo con un mensaje claro y sin iniciar escrituras. | `src/services/backup.ts` | S2 (este commit) |
| Baja | La migración real desde v1 comprobaba agenda, pero no dejaba explícita en el mismo caso la creación vacía de lotes y proveedores ni la segunda apertura. | `src/services/agendaPersistence.test.ts` | S2 (este commit) |
| Baja | Faltaba la prueba literal de 20 cambios rápidos seguida de `flush()`. | `src/services/quoteAutosave.test.ts` | S2 (este commit) |

### Decisiones tomadas

- Las migraciones siguen siendo únicamente aditivas. `DB_VERSION` continúa derivada de la cantidad de escalones y la base actual sigue en v4.
- Un abono con monto no numérico o no finito se considera respaldo corrupto. Se rechaza antes de abrir la transacción, por lo que los datos actuales permanecen intactos.
- La normalización sigue creando objetos nuevos campo por campo; las claves `__proto__`, `constructor` y cualquier clave desconocida no se copian.
- Una imagen data URL de aproximadamente 5 MB sí se importa correctamente en el entorno real de IndexedDB usado por las pruebas. No se fija todavía un límite por imagen aquí; esa decisión corresponde a S3.

### Pruebas agregadas

- Migración real v1 → v4 con datos originales intactos, almacenes nuevos vacíos y segunda lectura idempotente.
- Rechazo de abono con `amount: "hola"` y cero transacciones de escritura.
- Importación real de una imagen data URL de aproximadamente 5 MB.
- Ráfaga de 20 actualizaciones con una única escritura final y regla last-write-wins.
- Cotización antigua sin campos modernos y prueba contra contaminación de prototipo.

### Cobertura existente confirmada

- Saltos reales v2 → v4 y v3 → v4 con datos poblados.
- Respaldos v1 a v5, listas ausentes convertidas en vacías y restauración atómica.
- JSON truncado, versión no soportada, colecciones inválidas, identificadores vacíos o duplicados y rollback total.
- `flush()` durante escritura, error con borrador conservado y reintento exitoso.

## S3 — Ciberseguridad de la aplicación

### Hallazgos

| Severidad | Descripción | Archivo | Corregido en commit |
|---|---|---|---|
| Media | Las imágenes se comprimían, pero no había límite previo al procesamiento; una foto original enorme podía agotar la memoria del teléfono. | `src/utils/images.ts`, `src/components/QuoteFormView.tsx` | S3 (este commit) |
| Media | El archivo de respaldo no tenía un límite de tamaño antes de `JSON.parse`. | `src/services/backup.ts` | S3 (este commit) |
| Alta | El hash CSP se calculaba antes de la representación final del HTML. La verificación del archivo construido demostró que podía no coincidir con el script que el navegador ejecuta y bloquear la pantalla de emergencia. | `vite.config.ts` | S3 (este commit) |
| Baja | La lista de seguridad decía respaldo v2 aunque el formato vigente ya era v5. | `SECURITY_CHECKLIST.md` | S3 (este commit) |

### Decisiones tomadas

- D-033 fija 1.5 MB por imagen original, mantiene cuatro imágenes por cotización y no agrega librerías.
- D-033 fija 25 MB como máximo del respaldo antes de interpretarlo. El rechazo ocurre antes de cualquier escritura.
- La política CSP se genera durante cada build. Tras demostrar el fallo previo, el hash ahora se calcula desde los bytes finales de `dist/index.html`; no está fijado manualmente. `connect-src` contiene únicamente el origen propio y las dos APIs HTTPS del oro. `script-src` no usa `unsafe-inline` ni `unsafe-eval`. `scripts/verify-csp-hash.mjs` impide cerrar la auditoría si vuelve a desalinearse.
- El precio del oro no cambió: ambas fuentes usan HTTPS, existe timeout de 12 segundos, límites de sanidad y la interfaz conserva el último precio guardado ante fallos.

### Pruebas agregadas

- Límite exacto y exceso de un byte para imágenes de referencia.
- Respaldo mayor a 25 MB rechazado antes de leer JSON.
- PDF real con más de 10.000 caracteres, saltos masivos, controles, emoji y texto árabe.
- WhatsApp con `&`, `#`, comillas y saltos, teléfono reducido a dígitos y texto codificado.
- Verificación reproducible del hash CSP contra el HTML final construido.

### Dependencias de producción

| Dependencia | Justificación |
|---|---|
| `react` | Construye la interfaz móvil y sus estados. |
| `react-dom` | Presenta la interfaz React dentro del navegador. |
| `jspdf` | Genera localmente los PDF de cliente e internos sin enviar datos a un servidor. |

`package-lock.json` está versionado. `npm audit --audit-level=low` del 2026-07-17 informó 0 vulnerabilidades.

## S4 — Barrido del repositorio público

### Hallazgos

| Severidad | Descripción | Archivo | Corregido en commit |
|---|---|---|---|
| Media | Los fixtures usaban un nombre común, teléfonos plausibles y nombres geográficos que no quedaban identificados inequívocamente como datos ficticios. No se encontró evidencia de que pertenecieran al piloto, pero se reemplazaron preventivamente. | `src/test/fixtures.ts` y pruebas relacionadas | S4 (este commit) |
| Media | `.gitignore` cubría ZIP y variables locales, pero no respaldos JSON de datos ni carpetas de capturas locales. | `.gitignore` | S4 (este commit) |

### Decisiones tomadas

- Todo dato de prueba de persona, comprador, proveedor, taller, lote, ciudad, teléfono y correo quedó marcado como “Ejemplo” o usa valores reservados como `3000000000` y `example.com`.
- Las menciones a Santiago en documentación histórica, decisiones y reglas del propietario se conservan: identifican legítimamente al dueño del proyecto y no son datos de un cliente ni de una joyería piloto.
- No se encontró la lista privada de las siete joyerías, ni correos, teléfonos, NIT, cédulas o direcciones atribuibles a ellas.
- No se reescribió el historial de Git. No apareció un dato real que requiera elevar una decisión histórica a Santiago.
- `.gitignore` mantiene `*.zip`, `.env`, `.env.*` y ahora agrega respaldos de datos y capturas locales.

### Pruebas y verificaciones

- Barrido por contenido de `src/test/fixtures.ts`, todos los tests, `docs/`, Markdown y código fuente.
- Barrido de nombres de archivo.
- Suite completa después de reemplazar fixtures para demostrar que no cambió el comportamiento.
