# TEST_PLAN — Emerald Dealer Quote

## Pruebas automáticas (`npm test`)

| Archivo | Cubre |
|---|---|
| `src/calc/engine.test.ts` | Material, piedras (por piedra/quilate), margen, descuentos (%/fijo, límites), impuestos, total, anticipo/saldo, enteros COP, validación de negativos/NaN |
| `src/components/SettingsView.test.ts` | Flujo visible y seguro de restauración desde Ajustes |
| `src/services/backupAtomic.test.ts` | Restauración completa o rollback sin datos a medias |
| `src/services/backupReminder.test.ts` | Aviso semanal, posposición y control de una sola exportación |
| `src/services/db.test.ts` | Confirmación real de operaciones locales y manejo de fallos |
| `src/services/goldPrice.test.ts` | Conversión internacional a COP, recargo y límites de seguridad |
| `src/services/payments.test.ts` | Abonos del cliente, totales y saldo pendiente |
| `src/services/pdfContent.test.ts` | **Privacidad**: el contenido del PDF cliente no contiene margen/utilidad/ganancia/costo/fórmula/pureza/notas internas; contenido esperado del PDF cliente; desglose del documento interno |
| `src/services/pdfShare.test.ts` | Archivo PDF cliente, Web Share, descarga alternativa, cancelación, errores, doble toque y orden seguro del flujo |
| `src/services/whatsapp.test.ts` | Mensaje profesional, sin datos internos, enlace wa.me |
| `src/services/persistence.test.ts` | Guardar/recuperar/editar/eliminar cotizaciones, clientes, Ajustes, consecutivo y respaldo (con base local simulada) |
| `src/services/production.test.ts` | Etapas del taller y resumen de producción |
| `src/services/quoteAutosave.test.ts` | Guardado diferido, orden de escrituras, navegación, errores y reintento |
| `src/services/quoteStatus.test.ts` | Vencimiento derivado, filtros y conteos del historial |
| `src/services/schema.test.ts` | Normalización de clientes, cotizaciones y Ajustes de versiones anteriores |
| `src/utils/money.test.ts` | Formato COP, parseo de dinero y decimales |

Criterio: **todos los tests en verde** antes de cualquier entrega.

## Pruebas manuales (checklist por versión)

Hacer en dos celulares reales: iPhone con Safari y Android con Chrome.

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
- [ ] Escribir temporalmente `Precio material por gramo: $550.000` en un campo visible al cliente e intentar **Generar PDF**, **Compartir PDF** y **WhatsApp**. Las tres acciones deben bloquearse: no debe crearse ni descargarse un archivo, abrirse el selector ni abrirse WhatsApp. Corregir el texto y confirmar que las acciones vuelven a estar disponibles.
- [ ] En iPhone y Android, tocar **Compartir PDF** una sola vez → debe abrirse el selector nativo con un único PDF cliente, nombre seguro y sin PDF interno ni respaldo JSON.
- [ ] Cancelar el selector nativo → no debe aparecer una alarma ni iniciarse una descarga.
- [ ] En un navegador que no permita compartir archivos, tocar **Compartir PDF** → debe descargarse una sola copia del mismo PDF cliente, indicar que se adjunte manualmente y no abrir WhatsApp.
- [ ] Tocar dos veces rápidamente **Compartir PDF** → debe abrirse un solo selector o producirse una sola descarga.
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

Etapa 5.5, 2026-07-12: **294 pruebas aprobadas en 16 archivos** y build de producción completado sin errores. Ver también `CHANGELOG.md`.

## Prueba física segura de la candidata

La candidata no se publica para probarla. En una sesión aparte, Codex prepara en el computador una copia local privada y una dirección segura accesible únicamente desde los teléfonos conectados a la misma red de Santiago. No se usa `main`, GitHub Pages ni datos reales.

1. Confirmar primero que la página pública conserva su versión anterior y que no hay una publicación en curso.
2. Iniciar la candidata local y abrirla en Safari de un iPhone y Chrome de un Android con datos ficticios.
3. Ejecutar en ambos teléfonos el bloqueo de privacidad, compartir PDF, cancelación, doble toque, descarga alternativa, WhatsApp separado, instalación PWA, uso sin conexión y persistencia descritos arriba.
4. Revisar visualmente cada PDF cliente y comprobar que el selector contiene un solo archivo PDF, nunca el PDF interno ni un respaldo JSON.
5. Al terminar, borrar los datos ficticios desde la interfaz, cerrar la copia local y retirar cualquier permiso o certificado temporal usado para la conexión privada.
6. Volver a comprobar que la página pública y `main` no cambiaron. Solo después Santiago decide, en una autorización separada, si la candidata puede publicarse.
