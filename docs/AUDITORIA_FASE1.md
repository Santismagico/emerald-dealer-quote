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
