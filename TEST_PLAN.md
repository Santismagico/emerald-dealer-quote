# TEST_PLAN — Emerald Dealer Quote

## Pruebas automáticas (`npm test`)

| Archivo | Cubre |
|---|---|
| `src/calc/engine.test.ts` | Material, piedras (por piedra/quilate), margen, descuentos (%/fijo, límites), impuestos, total, anticipo/saldo, enteros COP, validación de negativos/NaN |
| `src/utils/money.test.ts` | Formato COP, parseo de dinero y decimales |
| `src/services/pdfContent.test.ts` | **Privacidad**: el contenido del PDF cliente no contiene margen/utilidad/ganancia/costo/fórmula/pureza/notas internas; contenido esperado del PDF cliente; desglose del documento interno |
| `src/services/whatsapp.test.ts` | Mensaje profesional, sin datos internos, enlace wa.me |
| `src/services/persistence.test.ts` | Guardar/recuperar/editar/eliminar cotizaciones, settings, consecutivo, respaldo export/import (con fake-indexeddb) |

Criterio: **todos los tests en verde** antes de cualquier entrega.

## Pruebas manuales (checklist por versión)

Hacer en un celular real (ideal iPhone + Safari):

- [ ] Abrir la app sin errores en consola.
- [ ] Ajustes: configurar joyería, logo y precio del oro; guardar; recargar y verificar que persiste.
- [ ] Crear cliente.
- [ ] Crear cotización completa (cliente, pieza, 2 piedras con modos de precio distintos, mano de obra, costo adicional, margen, descuento, anticipo, 2 imágenes).
- [ ] Verificar total en vivo y en vista previa.
- [ ] Guardar → aparece número ED-AAAA-NNNN y toast de confirmación.
- [ ] Cerrar la app por completo y volver a abrir → la cotización sigue en Historial.
- [ ] Editar la cotización guardada y verificar que se actualiza.
- [ ] Duplicar → nueva cotización en borrador con número nuevo.
- [ ] Cambiar estado (pendiente → aprobada).
- [ ] Buscar por nombre de cliente y filtrar por estado.
- [ ] Generar PDF cliente → revisar: logo, datos, piedras comerciales, total, vigencia, condiciones. **Confirmar que NO aparece**: margen, costos, precio por gramo, notas internas.
- [ ] Abrir vista interna → verificar desglose completo y nota del oro. Generar PDF interno.
- [ ] Compartir por WhatsApp → mensaje correcto, sin datos internos.
- [ ] Exportar respaldo JSON.
- [ ] Importar el respaldo → advertencia de reemplazo → datos restaurados.
- [ ] Instalar como PWA (iPhone: Compartir → Añadir a pantalla de inicio) y abrir sin conexión.
- [ ] Revisar que no haya scroll horizontal en ninguna pantalla ni zoom al enfocar inputs.
- [ ] Eliminar cotización → pide confirmación.
- [ ] Aprobar una cotización → aparece "Producción del taller" en la vista interna con las 6 etapas estándar.
- [ ] Marcar etapas (pendiente → en proceso → lista) y registrar un pago (monto, fecha, a quién, quién pagó) → cerrar la app y verificar que el avance persiste.
- [ ] Verificar que la producción aparece en el PDF interno pero NO en el PDF del cliente ni en el mensaje de WhatsApp.
- [ ] Compartir por WhatsApp con un cliente de celular colombiano → el chat abre directamente (prefijo 57 automático).
- [ ] En el historial, tocar "🛠 Producción: X/N" de una cotización aprobada → abre directo la vista interna del taller.
- [ ] Registrar un abono (monto, fecha, quién lo recibió, medio) → verificar total abonado y saldo real; cerrar la app y confirmar que persiste.
- [ ] Verificar que los abonos aparecen en el PDF interno pero NO en el PDF del cliente.
- [ ] Abrir el enlace desde el chat de WhatsApp en Android → debe aparecer el aviso para abrir en Chrome con botón de copiar enlace.

## Resultado de la última ejecución

Ver CHANGELOG.md y WEEKLY_PROGRESS.md (se actualizan en cada entrega).
