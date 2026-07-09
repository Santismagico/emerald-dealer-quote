# PRODUCT_SPEC — Emerald Dealer Quote

## Problema

Una joyería necesita cotizar piezas de joyería de forma rápida, profesional y confiable: ingresar cliente, material, peso, piedras, mano de obra, costos, margen, descuentos e impuestos; generar un PDF presentable para el cliente y conservar historial. La información sensible (costos, margen, fórmula del oro) debe quedar solo en la vista interna.

## Usuarios

- **MVP:** Santiago (Emerald Dealer) y joyerías individuales. Un solo usuario por dispositivo, sin cuentas.
- **Futuro:** SaaS multiempresa (ver ROADMAP.md).

## Módulos del MVP y estado

| # | Módulo | Estado |
|---|--------|--------|
| 1 | Configuración de la joyería (nombre, logo, NIT, contacto, mensaje, validez, COP, precio oro interno, margen, impuesto, condiciones) | ✅ Implementado |
| 2 | Clientes (crear, editar, eliminar, seleccionar) | ✅ Implementado |
| 3 | Nueva cotización (cliente, fechas, número, estado, pieza, material, peso, piedras, mano de obra, costos, descuento, impuesto, anticipo, notas, imágenes) | ✅ Implementado |
| 4 | Piedras (tipo, talla, medida, quilates, cantidad, precio por piedra/quilate, tratamiento, calidad, observación interna) | ✅ Implementado |
| 5 | Motor de cálculo (puro, testeado, COP enteros) | ✅ Implementado |
| 6 | Vista previa (cliente + interna, editar, guardar, PDF, WhatsApp) | ✅ Implementado |
| 7 | PDF cliente (sin datos sensibles) | ✅ Implementado |
| 8 | PDF interno (con costos, margen, auditoría) | ✅ Implementado |
| 9 | Historial (buscar por cliente/estado, editar, duplicar, estados, fechas) | ✅ Implementado |
| 10 | Respaldo JSON (exportar/importar con advertencia) | ✅ Implementado |
| 11 | WhatsApp (mensaje profesional sin datos internos) | ✅ Implementado |
| 12 | Experiencia móvil (iPhone primero, sin overflow, inputs 16px, safe areas) | ✅ Implementado |
| 13 | PWA (manifest, iconos, service worker, offline) | ✅ Implementado |
| 14 | Arquitectura futura SaaS | 📄 Documentado, no implementado (plan ejecutable en SAAS_PLAN.md) |
| 15 | Seguimiento de producción del taller (etapas, estados, pagos: cuánto/cuándo/a quién/quién pagó; solo interno, en cotizaciones aprobadas) | ✅ Implementado (v0.3.0) |

## Reglas de cálculo

```
subtotal_material   = peso_gramos × precio_por_gramo
subtotal_piedras    = Σ (por piedra: precio×cantidad | quilates×precio×cantidad)
costo_base          = material + piedras + mano_de_obra + adicionales
margen              = costo_base × margen% (INTERNO)
subtotal            = costo_base + margen
descuento           = % del subtotal o valor fijo (limitado al subtotal)
impuesto            = (subtotal − descuento) × impuesto% (si está activo)
total               = subtotal − descuento + impuesto
saldo               = total − anticipo (anticipo limitado al total)
```

Todos los valores se redondean a **pesos enteros**. Negativos se rechazan en validación.

## Qué ve el cliente vs. qué es interno

| Visible al cliente | Solo interno |
|---|---|
| Marca, logo, contacto, número, fecha | Precio por gramo del material |
| Tipo de pieza, material (sin pureza), peso, descripción | Subtotales de costos, costo base |
| Piedras en descripción comercial | Margen y utilidad |
| Total, anticipo, saldo, descuento aplicado | Fórmula/nota del precio del oro |
| Vigencia, condiciones, observaciones visibles, imágenes | Observaciones internas y notas de piedras |

## Fuera de alcance del MVP (a propósito)

- Cuentas de usuario, backend, base de datos remota.
- Inventario de piedras o catálogo fijo.
- Promesas de certificación (solo si el usuario la escribe como costo/nota).
- Facturación electrónica DIAN.
