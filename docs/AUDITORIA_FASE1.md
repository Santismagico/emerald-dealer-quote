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
