# DECISIONS — Registro de decisiones

Formato: cada decisión tiene ID, fecha, estado (vigente / pendiente de confirmar / reemplazada).

## D-001 · Stack: React + TypeScript + Vite + Tailwind 4 · 2026-07-07 · Vigente

Carpeta vacía → se creó desde cero con el stack sugerido en la especificación. Sin router (5 vistas con estado simple), sin gestor de estado externo (Context + hooks bastan para este tamaño).

## D-002 · Precio del oro: automático (internacional del día + $100.000/g) · 2026-07-08 · Vigente (confirmado por Santiago)

Santiago confirmó el 2026-07-08 que el precio debe ser automático: **la app consulta el precio internacional 24K del día y siempre suma $100.000 COP por gramo**. Implementación (`src/services/goldPrice.ts`):

- Fuentes gratuitas sin clave: `api.gold-api.com/price/XAU` (oro USD/onza troy) y `open.er-api.com/v6/latest/USD` (tasa USD→COP). Conversión: `(USD_onza ÷ 31,1034768 g) × COP_USD`, redondeado a entero + recargo.
- Se actualiza **al abrir la app con internet** y con el botón "Actualizar precio ahora" en Ajustes.
- Sin conexión: se conserva el último precio guardado (la app sigue siendo usable offline) y existe un campo de precio manual de respaldo.
- El recargo es configurable (`goldMarkupPerGram`, por defecto $100.000).
- El cálculo es puro y está testeado (`goldPrice.test.ts`). Nunca aparece en PDF ni vista del cliente (tests de privacidad).

Riesgo aceptado: dependencia de dos APIs gratuitas de terceros. Si alguna falla, la app conserva el último valor guardado. La actualización manual muestra el aviso de falta de conexión; la actualización automática al abrir la app falla en silencio para no interrumpir el uso. Cambiar de proveedor solo toca `goldPrice.ts`.

_(Reemplaza la versión anterior de D-002 que dejaba el precio 100% manual.)_

## D-003 · Margen interno por defecto = 0% · 2026-07-07 · Vigente

La especificación exige margen configurable pero no define un valor. Para no inventar números financieros, el margen por defecto es 0% y se edita en Ajustes o por cotización. Fórmula: `margen = costo_base × margen%`, sumado al subtotal. Solo visible en vista/PDF interno.

## D-004 · Persistencia: IndexedDB con wrapper propio · 2026-07-07 · Vigente

localStorage (~5 MB) se queda corto con imágenes en data URL. IndexedDB no tiene ese límite práctico. En lugar de agregar una dependencia (idb, dexie), se escribió un wrapper de ~90 líneas (`services/db.ts`). Las imágenes se comprimen a máx. 1000 px JPEG 72% antes de guardar.

## D-005 · PDF con jsPDF · 2026-07-07 · Vigente

Justificación: librería madura y estable, genera el PDF 100% en el navegador (offline, requisito del MVP), API de texto/imagen suficiente para un documento comercial limpio. Alternativas descartadas: pdfmake (más pesada), react-pdf (orientada a documentos React completos, mayor complejidad), impresión del navegador (formato inconsistente entre dispositivos).

## D-006 · El número de cotización se asigna al guardar · 2026-07-07 · Vigente

Formato `ED-AAAA-NNNN` con consecutivo en settings. Se asigna en el primer guardado (no al abrir el formulario) para no gastar números con borradores abandonados. Generar PDF o compartir por WhatsApp guarda automáticamente primero.

## D-007 · Descuento y anticipo acotados · 2026-07-07 · Vigente

El motor limita el descuento al subtotal y el anticipo al total (nunca totales ni saldos negativos), y la validación avisa al usuario cuando lo intenta. Decisión conservadora para proteger la caja de la joyería.

## D-008 · WhatsApp vía enlace wa.me con texto · 2026-07-07 · Reemplazada por D-017

El enlace `wa.me` continúa enviando únicamente un mensaje con resumen y total. La entrega de un PDF por el selector nativo del dispositivo se decidió después en D-017 y permanece como una acción separada que no elige WhatsApp automáticamente.

## D-010 · Auditoría de seguridad multi-ángulo (v0.5.0) · 2026-07-09 · Vigente

Se ejecutó una revisión con 8 ángulos independientes (línea a línea, guardias eliminadas, trazado entre archivos, seguridad, reutilización, simplificación/eficiencia, arquitectura, convenciones). Resultado: 8 hallazgos principales corregidos + mejoras estructurales. Decisiones derivadas:

- **`services/schema.ts` es la única fuente de defaults, migraciones y normalización.** Toda lectura de datos (local, respaldo, futura nube) pasa por `normalizeQuote`/`normalizeSettings`. Ninguna vista debe defenderse por su cuenta de datos con forma vieja.
- **Settings versionados** (`settingsVersion`): las migraciones se encadenan por versión, no por comparación de strings.
- **Respaldo v2**: `parseBackup` acepta v1 y v2 y normaliza todo; nunca se persiste un dato sin normalizar.
- **CSP en producción** (plugin en vite.config.ts): conexiones permitidas al propio origen y a las 2 APIs del oro; scripts inline permitidos por hash.
- **Límites del precio del oro**: USD/onza aceptado entre 500 y 20.000; COP/USD entre 1.000 y 20.000. Fuera de rango → error humano y se conserva el último precio.

## D-011 · Normalización de teléfonos para WhatsApp · 2026-07-09 · Vigente

Números de 10 dígitos que empiezan por 3 (celular) o 60 (fijo) reciben el prefijo 57. Limitación aceptada y documentada: un número extranjero guardado sin indicativo (ej. un celular de EE. UU. de 10 dígitos que empiece por 3) es indistinguible de uno colombiano; el negocio opera en Colombia y el remedio es guardar los números extranjeros con su indicativo (+1…).

## D-009 · Nodo instalado con winget · 2026-07-07 · Vigente

El equipo no tenía Node.js. Se instaló OpenJS.NodeJS.LTS 24.18.0 vía winget para poder construir el proyecto.

## D-012 · Detector sobre la salida real de cada canal · 2026-07-11 · Vigente

La protección contra exposición accidental no mantiene una lista manual de campos. Analiza el texto final que está a punto de salir:

- PDF cliente: `contentToPlainText(buildClientPdfContent(...))` mediante `findSensitiveWordsInClientText`.
- WhatsApp: resultado exacto de `buildWhatsAppMessage(...)` mediante `findSensitiveWordsInText`.

Así quedan cubiertos automáticamente material, marca, contacto, datos visibles del cliente, descripción, piedras, condiciones y mensaje comercial, además de futuros textos que se agreguen al PDF. Cada canal se revisa por separado para no alertar en WhatsApp por condiciones o pies que ese mensaje no envía.

Las comparaciones ignoran mayúsculas y tildes y usan palabras/frases completas. Se detectan los términos de AGENTS.md y equivalentes financieros o de pureza claramente confidenciales; no se marcan palabras generales como “valor”, “total”, “precio”, “oro” o “gramo” de forma aislada.

Si hay un hallazgo, la salida se bloquea: no se genera ni comparte el PDF cliente y no se abre WhatsApp. El usuario debe corregir o retirar la información interna antes de intentarlo de nuevo; no existe confirmación que permita saltar esta protección. Esta defensa no modifica el PDF interno ni la vista interna.

Riesgo residual aceptado: el detector es textual y no puede leer palabras incrustadas dentro del logo o de imágenes de referencia. Agregar OCR ampliaría dependencias y alcance, por lo que no corresponde a esta etapa.

## D-013 · Vencimiento como estado derivado en la interfaz · 2026-07-11 · Vigente

Una cotización se muestra como `vencida` únicamente cuando su fecha de vencimiento es anterior al día actual y el estado guardado es `borrador` o `pendiente`. La regla vive en la función pura `getEffectiveQuoteStatus(quote, today)` y recibe una fecha fija para que su resultado sea determinista y comprobable.

El estado efectivo se usa en las insignias, los filtros y los conteos del historial. No se guarda automáticamente en IndexedDB, no modifica `updatedAt` y no reemplaza el objeto original que se abre, edita o duplica. Las cotizaciones aprobadas, rechazadas, ya vencidas o con cualquier otro estado se conservan tal como están. Una fecha vacía, imposible o con formato inválido tampoco provoca un vencimiento automático.

El PDF cliente, el PDF interno y el motor de cálculo no dependen de este estado visual y no se modificaron en esta etapa.

## D-014 · Guardado diferido y serializado para producción y abonos · 2026-07-11 · Vigente

Los cambios internos de producción y abonos usan una única sesión de guardado por cotización (`quoteAutosave.ts`). La interfaz se actualiza inmediatamente y siempre combina el siguiente cambio sobre la versión local más reciente, no sobre una copia anterior de React.

- Texto y dinero esperan 650 ms sin actividad para reducir escrituras completas en IndexedDB.
- Blur, contracción de tarjeta, cambio de pestaña y navegación fuerzan el guardado pendiente.
- Estados, fechas, interruptores, altas y eliminaciones fuerzan guardado inmediato.
- Nunca hay dos escrituras activas al mismo tiempo. Si llegan cambios durante una escritura, al terminar se guarda únicamente la versión más reciente.
- Un error conserva el borrador local, bloquea la salida que requería guardado y permite reintentar desde un aviso visible.
- La promesa de la capa IndexedDB se resuelve en `transaction.oncomplete`; por eso “Guardado” significa que la transacción terminó, no solo que aceptó la solicitud.
- `visibilitychange` intenta hacer flush como respaldo al ocultar la PWA, pero la integridad no depende de eventos de cierre del navegador.

No se agregó ninguna dependencia ni se cambió la estructura de IndexedDB. El motor de cálculo, el precio del oro, los PDF, WhatsApp, el detector sensible y el estado vencido permanecen fuera de esta decisión.

## D-015 · Normalización de clientes y restauración atómica · 2026-07-11 · Vigente

`normalizeClient` en `services/schema.ts` es la única regla para sanear clientes. `listClients` normaliza todos los registros antes de ordenarlos y `saveClient` normaliza antes de persistir. La exportación usa estas mismas lecturas normalizadas, por lo que datos antiguos o claves desconocidas no vuelven a salir en un respaldo.

La restauración valida y normaliza por completo el archivo antes de tocar IndexedDB, incluidos identificadores vacíos o duplicados que podrían sobrescribir registros. Después abre una única transacción `readwrite` sobre `settings`, `clients` y `quotes`, limpia y escribe los tres almacenes dentro de ella, y solo confirma en `transaction.oncomplete`. Cualquier fallo provoca `transaction.onabort`; la promesa rechaza después de que IndexedDB terminó el rollback y la interfaz informa que los datos anteriores se conservaron.

Un respaldo aceptado sin ajustes (`settings: null`, compatible con formatos antiguos) reemplaza el registro anterior y hace que la aplicación vuelva a sus ajustes por defecto. Esto evita mezclar clientes y cotizaciones restaurados con reglas internas ajenas al archivo.

La interfaz guarda una sola copia ya validada del respaldo, evita confirmaciones simultáneas, ejecuta `reloadAll` únicamente después del commit y sincroniza el formulario local de Ajustes antes de mostrar éxito. No se agregó ninguna dependencia, no cambió `DB_VERSION` y no se modificó la estructura de IndexedDB.

## D-016 · Recordatorio semanal de respaldo local · 2026-07-11 · Vigente

El recordatorio es un banner dentro de la aplicación: aparece únicamente si existen clientes o cotizaciones y han pasado siete días desde la primera información útil o desde la última exportación confirmada. Puede posponerse por 24 horas; cerrar el banner equivale exactamente a esa misma posposición.

La regla vive en `getBackupReminderState(...)`, una función pura que recibe la fecha actual de forma explícita y compara instantes absolutos. Por eso se puede probar sin depender del reloj real ni adelantar el aviso por cambios de zona horaria. Si datos antiguos no tienen una fecha válida, se guarda una única referencia local (`backupReminderFirstDataAt`) para iniciar el intervalo sin modificar clientes ni cotizaciones ni repetir el aviso en cada apertura.

Los controles nuevos viven en `Settings`: `lastBackupExportedAt`, `backupReminderSnoozedUntil` y `backupReminderFirstDataAt`. Se añadió la versión 3 de configuración, sin cambiar la estructura de IndexedDB; ajustes y respaldos v1/v2 reciben defaults seguros al normalizarse.

La exportación manual de Ajustes y la del banner usan el mismo JSON existente. Solo después de que el navegador inició la descarga se registra la fecha, se limpia la posposición y se oculta el aviso. Un controlador único bloquea toques repetidos. No se usa notificación, permiso, correo, WhatsApp, servidor, nube ni exportación automática.

## D-017 · Web Share entrega el PDF cliente al selector nativo · 2026-07-12 · Vigente

La acción **Compartir PDF** crea un único `File` con MIME `application/pdf` y nombre seguro basado en el número de cotización. Tanto la descarga normal como Web Share usan `createClientPdfFile`, que parte exclusivamente de `buildClientPdfContent`; no existe una segunda versión del documento. Esta acción no acepta el PDF interno ni respaldos JSON.

Antes de guardar, numerar o generar el archivo se ejecuta el mismo detector del contenido final del PDF cliente. Si hay un término sensible, la salida se bloquea y el usuario debe corregirlo; no existe una opción para continuar bajo riesgo. Solo cuando el contenido es seguro se guarda la última versión local y se garantiza el número de cotización antes de crear el archivo.

Web Share API abre el selector nativo del sistema operativo y **no puede elegir WhatsApp automáticamente ni confirmar que una aplicación recibió el archivo**. Por eso el resultado visible dice que el PDF se entregó al menú de compartir. El botón existente de WhatsApp continúa enviando solamente su texto mediante `wa.me` y permanece separado.

Solo se usa Web Share si existen `navigator.share` y `navigator.canShare({ files })` y este último acepta el PDF. Si falta soporte o aparece un error de compatibilidad, se descarga el mismo archivo y se explica que debe adjuntarse manualmente; no se abre WhatsApp. `AbortError` significa cancelación normal y nunca dispara la descarga. Un error inesperado tampoco se presenta como éxito y deja disponible la descarga manual.

Riesgo residual aceptado: Web Share requiere activación directa del usuario. Guardar y generar el PDF son operaciones asíncronas anteriores al selector y algunos navegadores pueden perder esa activación. No se usan atajos inseguros; un `NotAllowedError` se trata como incompatibilidad y activa la descarga confiable. La compatibilidad final debe comprobarse manualmente en un iPhone y un Android reales.

## D-018 · Actualizaciones atómicas de ajustes internos · 2026-07-12 · Vigente

El consecutivo de cotizaciones, las fechas del recordatorio de respaldo y la actualización del precio del oro comparten el registro local de Ajustes. Cada cambio parcial debe leerse, combinarse y guardarse dentro de una sola operación de IndexedDB para que dos acciones simultáneas no se pisen.

La interfaz puede seguir guardando los campos editables de Ajustes, pero debe preservar el consecutivo y los controles internos más recientes. Dos solicitudes simultáneas de número deben producir números distintos y avanzar el contador dos veces. No se cambia la estructura de IndexedDB ni se agrega ninguna dependencia.

La consulta del precio del oro puede terminar después de que cambie el recargo. Al guardarla, el total se recompone con el recargo más reciente dentro de esa misma operación. Además, la interfaz indica expresamente si el precio fue editado a mano; no se deduce comparándolo con un estado que pudo cambiar mientras el formulario estaba abierto.

## D-019 · Cambio rápido de estado desde el historial · 2026-07-12 · Vigente

La etiqueta de estado de cada cotización en el historial es tocable y abre un menú con los estados asignables: borrador, pendiente, aprobada y rechazada. Elegir uno guarda la cotización con `updatedAt` nuevo mediante el mismo `upsertQuote` que usan las demás ediciones; no existe una vía de guardado paralela.

"Vencida" no aparece como opción manual porque es un estado derivado de la fecha de validez (D-013): asignarla a mano sería redundante y quitarla a mano sería imposible mientras la fecha siga en el pasado. Cuando la cotización mostrada está vencida, el menú lo explica y sugiere cambiar la fecha o elegir otro estado. La lógica pura vive en `src/services/quoteStatus.ts` (`SELECTABLE_QUOTE_STATUSES`, `withQuoteStatus`) con pruebas propias.

## D-020 · Ecosistema Emerald Dealer v1.0 · 2026-07-12 · Vigente

Santiago autorizó convertir la cotizadora en el ecosistema del negocio con cuatro áreas: Cotizador, Taller, Agenda y Piedras, más una pestaña "Más" (Clientes, Ajustes, Cierre del día). El plan ejecutable por etapas está en `docs/EXECUTION_PLAN.md` (Etapas 6 a 9).

Decisiones de negocio tomadas por Santiago ese día:

1. **Asesorías con agenda interna.** El cliente sigue contactando por WhatsApp y Santiago registra la cita en la app. No hay reservas en línea ni servicios externos de citas; todo permanece local y privado. La reserva en línea propia queda descartada mientras el plan SaaS siga congelado.
2. **Cierre del día con todo el negocio.** El PDF interno diario incluye compras y ventas de piedras, abonos recibidos, cotizaciones creadas y aprobadas, y pagos del taller. Es un documento interno: solo descarga directa, nunca Web Share ni WhatsApp.
3. **Ejecución mixta.** Claude construye las partes delicadas (navegación, migraciones de IndexedDB, respaldo/restauración, motor del reporte, auditorías); Codex construye las vistas repetitivas siguiendo las órdenes del plan.

El Taller (Etapa 6) es solo reorganización de interfaz: reutiliza la lógica de producción y abonos ya probada (D-014) sin cambiar el esquema de datos. Las Etapas 7 y 8 introducen las primeras migraciones reales de IndexedDB (v1→v2 y v2→v3) con escalera `oldVersion`, pagando la deuda anotada en ROADMAP, y amplían el respaldo atómico de 3 a 4 y 5 almacenes (extiende D-015).
