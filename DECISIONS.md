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

## D-021 · Taller como área propia (Etapa 6) · 2026-07-12 · Vigente

La navegación inferior pasa de cuatro pestañas (Cotizaciones, Nueva, Clientes, Ajustes) a tres: **Cotizador**, **Taller** y **Más**. "Nueva" deja de ser pestaña porque el historial ya tiene el botón; Clientes y Ajustes viven dentro de Más con un enlace de regreso.

Un **trabajo del taller** es una vista derivada de una cotización aprobada (`src/services/workshop.ts`, lógica pura con pruebas): avance de etapas, total abonado y saldo se calculan al mostrar y nunca se guardan como registros aparte. Un trabajo está "Listo" solo cuando tiene etapas y todas están listas; sin etapas siempre cuenta como "En taller".

Los paneles de producción y abonos salen de la vista interna de la cotización y viven en la pantalla del trabajo, que usa el mismo `quoteAutosave` (guardado diferido de 650 ms, serializado, flush al navegar u ocultarse y reintento). La vista interna conserva un resumen y el botón "Abrir en el Taller". Consecuencia aceptada: los abonos solo se registran en trabajos aprobados; el anticipo inicial sigue siendo un campo de la cotización.

Aprobar desde cualquier lugar crea las etapas estándar si no existen: `withQuoteStatus` (historial) replica lo que ya hacía la vista previa, para que ningún trabajo llegue al Taller sin sus etapas.

No cambió el esquema de datos, no se agregaron dependencias y los tests de privacidad siguen intactos: ninguna información del taller entra en el contenido del PDF cliente, Web Share ni WhatsApp.

## D-022 · Agenda de asesorías y primera migración de IndexedDB · 2026-07-14 · Vigente

La base local pasa de la versión 1 a la 2 mediante una **escalera de migraciones** (`DB_MIGRATIONS` en `src/services/db.ts`): la posición N crea lo que estrena la versión N+1, nunca se reordena ni se elimina una entrada, y cada paso es idempotente. `DB_VERSION` se deriva del largo de la escalera. La v2 solo agrega el almacén `appointments`; los datos existentes no se tocan. La escalera se probó contra una base v1 real (fake-indexeddb) y con la migración en vivo del navegador de desarrollo.

Una **cita** guarda: cliente vinculado opcional o nombre libre, fecha, hora HH:MM (opcional), duración en minutos, motivo, notas y estado (`programada | cumplida | cancelada | noAsistio`). `normalizeAppointment` en `schema.ts` (única fuente, D-010) corrige horas mal formadas, duraciones inválidas y estados desconocidos. Las citas son SOLO internas (D-020): ninguna ruta las lleva al PDF cliente, Web Share ni WhatsApp.

El **respaldo sube a la versión 3** e incluye las citas. Se aceptan v1, v2 y v3: los respaldos viejos restauran con la agenda vacía y nunca fallan por no traerla. La restauración atómica cubre ahora los 4 almacenes con el mismo rollback completo (extiende D-015). El recordatorio semanal de respaldo cuenta las citas como datos que lo ameritan.

El formulario de citas usa **guardado explícito** (botón Guardar), no el guardado diferido de cotizaciones: una cita se edita en ráfagas cortas y el guardado por botón es más simple y suficiente; el diferido queda reservado para producción/abonos donde se teclea mucho (D-014). El aviso de citas de hoy es un banner y un globito numérico locales que solo cuentan las programadas del día; no hay notificaciones push ni permisos del sistema.

## D-023 · Piedras por lotes rastreables · 2026-07-15 · Vigente

Decisiones de negocio de Santiago (2026-07-15), que cambiaron el diseño planeado de "movimientos simples" a **lotes rastreables**:

1. **Cada compra crea un lote** identificado (ej: "Muzo 12") y **cada venta se descuenta de un lote específico**, para saber qué se ganó con cada uno.
2. **Piedras queda separado del cotizador**: usar una piedra propia en una joya no descuenta inventario automáticamente; Santiago decide si registrarla como venta.
3. La pestaña muestra **existencias + flujo**: lo que queda por tipo de piedra y el dinero del negocio (invertido, recibido, neto).

Modelo técnico: un `StoneLot` guarda la compra (nombre opcional, tipo de piedra, descripción, fecha, proveedor, quilates, cantidad, costo COP entero, notas) y sus **ventas embebidas** (`sales[]`), igual que los abonos viven dentro de una cotización. Así una venta no puede quedar huérfana, la validación es local al lote (no se puede vender más de lo disponible; el mensaje de rechazo lo produce el motor puro `validateStoneSale`) y la escritura es atómica por lote. El resultado del lote es vendido − costo, marcado "parcial" mientras queden existencias; un lote está "agotado" cuando no quedan piedras ni quilates. La suma de quilates se redondea a 3 decimales para evitar ruido de coma flotante.

Infraestructura: migración IndexedDB v2→v3 (almacén `stoneLots`, un escalón más de la escalera D-022) y respaldo v4 que acepta v1–v4; los respaldos viejos restauran con lotes vacíos y la restauración atómica cubre 5 almacenes. El recordatorio semanal cuenta los lotes como datos que merecen respaldo. Nota: durante el desarrollo existió brevemente un almacén `stoneMovements` (modelo de movimientos) que nunca llegó a un commit ni a ningún dispositivo real; la v3 publicada crea únicamente `stoneLots`.

Los lotes y sus precios son SOLO internos: ninguna ruta los lleva al PDF cliente, Web Share ni WhatsApp. Formularios con guardado explícito (patrón D-022).

## D-024 · Cierre del día y registro de aprobación · 2026-07-15 · Vigente

El **Cierre del día** (decisión D-020: "todo el negocio") es un PDF interno construido por el motor puro `src/services/dailyReport.ts`: dado un día reúne compras y ventas de piedras (por fecha del movimiento), abonos recibidos, pagos del taller (solo etapas pagadas, por fecha de pago), cotizaciones creadas (por fecha de emisión) y aprobadas, con totales en COP enteros y el movimiento neto (entradas − salidas). El PDF reutiliza el mismo renderizador de la app con el encabezado "DOCUMENTO INTERNO — NO ENTREGAR AL CLIENTE"; **solo existe la descarga directa**: ninguna ruta lo lleva a Web Share ni WhatsApp. La vista previa vive en Más → Cierre del día, con selector de día (hoy por defecto). Un día sin movimientos lo dice expresamente.

Para fechar las aprobaciones se agregó `Quote.approvedAt` (ISO): se registra la última vez que la cotización ENTRÓ al estado aprobada. `withQuoteStatus` es ahora la ÚNICA lógica de cambio de estado (historial y vista previa la comparten): al aprobar crea las etapas estándar si faltan y sella `approvedAt`; salir de aprobada conserva el registro y reaprobar lo renueva. Las cotizaciones aprobadas ANTES de este campo tienen `approvedAt` vacío y, por honestidad, no aparecen en cierres pasados: no se inventa una fecha que no se conoce. La comparación usa el día local del dispositivo (una aprobación de las 7 p. m. en Colombia no se corre al día siguiente por UTC). Duplicar una cotización no hereda la aprobación.

## D-025 · Correcciones de fondo post-publicación (C1–C6) · 2026-07-16 · Vigente

Tanda dictada por Santiago y ejecutada según `docs/HOJA_DE_RUTA_CORRECCIONES.md` (registro al final de ese documento):

1. **C1 — Etapas estándar del taller** definidas por Santiago: Diseño, Fundición, Terminado y engaste, Material, Varios. Solo aplican a piezas aprobadas desde ahora.
2. **C2 — Entrega ≠ lista:** nuevo `Quote.deliveredAt` (YYYY-MM-DD). El trabajo se marca entregado desde el Taller con aviso si hay etapas sin terminar o saldo del cliente; se puede deshacer; filtro "Entregados"; entregado manda sobre listo en filtros y etiquetas.
3. **C3 — Proveedores:** entidad `Supplier` (Más → Proveedores, patrón de Clientes), migración IndexedDB v3→v4 (almacén `suppliers`) y respaldo v5 (acepta v1–v5). El lote guarda `supplierId` + nombre visible.
4. **C4 — Crédito con proveedores:** `StoneLot.onCredit` + `supplierPayments[]` embebidos. La deuda SIEMPRE es costo − pagos (derivada); `validateSupplierPayment` impide pagar más de lo debido; el resumen de Piedras muestra la deuda total.
5. **C5 — Cierre separado por negocio y caja honesta:** el cierre agrupa Joyería (abonos, taller, cotizaciones) y Piedras (compras, ventas, pagos a proveedores). Una compra a crédito NO cuenta como salida de caja el día de la compra (se informa aparte); los pagos al proveedor salen de caja el día en que se hacen. Estético: los campos de fecha/hora se alinean a la izquierda (iOS los centraba: la "columna corrida").
6. **C6 — Cierre del mes:** mismo motor con filtro mensual (`buildMonthlyReport`), selector de mes, actividad, deudas a la fecha (debo a proveedores / clientes me deben, fotos actuales) y comparación con hasta 6 meses anteriores en pantalla y PDF interno ("CIERRE DEL MES"). Los meses disponibles se derivan de los datos; nada se guarda precalculado.

Todo derivado, sin dependencias nuevas, respaldo compatible hacia atrás y tests de privacidad intactos. 410 pruebas en verde. NO publicado: requiere la orden de Santiago.

## D-026 · Anticipos pagados e integridad histórica después de C1–C6 · 2026-07-16 · Vigente

Decisiones confirmadas por Santiago y reglas de estabilización aplicadas antes de continuar con la estética:

1. **Un anticipo significa dinero que el cliente ya pagó.** Por tanto, el total recibido es anticipo + abonos posteriores, y la deuda del cliente baja por ambos conceptos.
2. Todo anticipo nuevo o cuyo valor se modifique exige una **fecha real** para ubicar esa entrada en el cierre diario y mensual. Los anticipos antiguos sin fecha siguen reduciendo la deuda actual, pero no se les inventa una fecha ni se colocan en un cierre histórico.
3. **Borrar un proveedor de la lista no borra su historia.** Los lotes anteriores conservan el nombre visible del proveedor, junto con sus compras, ventas, pagos y deuda. Renombrar un proveedor actualiza el nombre de los lotes todavía vinculados.
4. La app no permite que una edición borre silenciosamente pagos o ventas ya registrados. También bloquea cambios incompatibles, como convertir a contado una compra con pagos al proveedor o reducir el costo por debajo de lo ya pagado.
5. Los cierres mensuales solo comparan el mes elegido con meses realmente anteriores; nunca con meses futuros. Las deudas visibles se conservan aunque el periodo no tenga otros movimientos.

**Revisión manual antes de publicar:** en versiones anteriores el anticipo reducía el precio en la cotización, pero no formaba parte del panel de pagos del Taller. Por eso podría existir alguna cotización antigua donde Santiago haya registrado el mismo dinero también como un abono manual. La app no deduplica esos casos automáticamente, porque no puede saber con certeza si son el mismo pago o dos pagos reales.

No se agregaron dependencias ni se cambió la base local. La compatibilidad se resuelve al normalizar cotizaciones antiguas y preservar sus datos conocidos.

## D-027 · Identidad visual lujosa e ícono instalable propio · 2026-07-16 · Reemplazada por D-029

Santiago decidió reemplazar la estética plana por una identidad completa de lujo: fondo
esmeralda profundo (`#031b15`), superficies verdes con profundidad, dorado champaña,
marfil y títulos con una serif del sistema. No se cargan fuentes externas ni se agrega
ninguna dependencia, para conservar el funcionamiento sin internet.

La navegación usa íconos lineales consistentes en lugar de emojis. El dorado es un acento
de marca; rojo, ámbar y verde conservan sus significados de peligro, pendiente y éxito.
Los campos editables permanecen claros, los controles táctiles miden al menos 44 px y el
documento del cliente conserva apariencia de papel claro dentro del entorno oscuro.

El ícono de la aplicación es una esmeralda facetada dentro de un rombo dorado sobre fondo
esmeralda oscuro. La pieza maestra vive en `assets/branding/app-icon-source.png` y
`npm run icons` genera las versiones 180, 192, 512 y 512 adaptable para Android. Este
ícono identifica la aplicación instalada y es independiente del logo que cada joyería
carga en Ajustes para sus documentos de cliente.

La decisión no modifica cálculos, datos, PDF ni reglas de privacidad. La candidata quedó
verificada con 432 pruebas, build y revisión móvil, pero no se publica hasta recibir una
orden expresa de Santiago y completar la comprobación física del ícono reinstalando la PWA.

## D-028 · Joya pagada como estado derivado y pago del saldo en un toque · 2026-07-16 · Vigente

Santiago reportó una confusión real de uso: el dinero del cliente se pide en dos pantallas
(el **anticipo** en el formulario de la cotización y los **abonos** en el Taller), así que era
fácil registrar el mismo pago dos veces; y aunque existía "Entregada", no existía "Pagada".

Decisiones de negocio tomadas por Santiago:

1. **"Pagada" es automática, nunca una marca manual.** En cuanto lo recibido (anticipo +
   abonos) iguala o supera el total cotizado, la joya muestra "Pagada ✓". Al ser un estado
   DERIVADO del dinero (`isQuotePaidInFull` en `services/payments.ts`), la etiqueta no puede
   contradecir las cuentas ni depende de que Santiago se acuerde de marcarla. Una cotización
   con total cero no se marca pagada sola.
2. **"El cliente ya pagó todo" registra el dinero, no solo la etiqueta.** El botón crea un
   abono por el saldo exacto que falta, fechado hoy (`settlementPayment`), de modo que ese
   dinero entra al Cierre del día y a la caja. Editar fecha, medio o monto sigue disponible
   en la lista de pagos. Si no falta nada, no se crea un abono de cero.
3. **El anticipo sigue viviendo en la cotización** (cambio mínimo: no altera cómo se cotiza
   ni el descuento del anticipo en el PDF del cliente), pero el panel de pagos del Taller lo
   muestra arriba como "1er pago · Anticipo" y advierte que **ya está contado y no debe
   registrarse otra vez como abono**. Esto ataca la causa de la confusión sin tocar datos.
4. **Pagada y entregada son independientes**: una joya puede estar pagada sin entregar y
   entregada sin pagar. Los filtros del Taller siguen describiendo el estado físico
   (En taller / Listos / Entregados) y el dinero se lee en la tarjeta y en el trabajo.

`clientPendingBalance` nunca devuelve negativo (pagar de más no es saldo a favor), pero el
aviso rojo "los abonos superan el total" se conserva. No cambia la base local, ni el PDF, ni
las reglas de privacidad, ni se agregan dependencias. 445 pruebas en verde. Extiende D-026
(el anticipo es dinero pagado) y no altera D-014 (guardado diferido) ni D-024 (cierre).

## D-029 · Identidad "el mesón del joyero" e ícono "La gema viva" · 2026-07-16 · Vigente

Santiago rechazó la identidad D-027 con una crítica precisa: "en su esfuerzo por parecer
elegante, se ve de mal gusto" y demasiado genérica de IA (fondo oscuro + dorado en todo +
serif en cada título). Pidió algo sofisticado y placentero al estilo Notion, no plano.
Aprobó el concepto nuevo tras verlo en un tablero visual con ambos temas, y eligió el
ícono "La gema viva" (opción A de tres) pidiendo expresamente volumen en la piedra.

La nueva identidad:

1. **Papel cálido, no caja fuerte.** Fondo marfil `#f4f1ea` con tinta verde-gris `#22302a`;
   superficies blancas con sombras suaves de dos capas (profundidad real, no brillos).
2. **Un solo acento esmeralda** (`#0b7f57`): botones primarios, filtros activos, píldora
   de navegación y enlaces. El dorado queda reducido a **un hilo de latón** bajo la
   cabecera. Rojo/ámbar/verde conservan sus significados de negocio.
3. **Serif de sello solo en la marca** (Iowan/Palatino del sistema): el nombre de la
   joyería en la cabecera. El resto de la interfaz es sans del sistema. Sin fuentes
   descargadas: todo funciona sin internet.
4. **Tema nocturno automático** vía `prefers-color-scheme`: mismo sistema de fichas
   (`:root` + variante oscura en `src/index.css`); la capa `.atelier` traduce las
   utilidades de las vistas a fichas, así ambos temas fluyen por un solo mapeo.
   El documento del cliente conserva papel claro en ambos temas.
5. **Ícono "La gema viva":** talla esmeralda facetada con luz desde arriba a la
   izquierda, destello, chispa y sombra, sobre tile esmeralda profundo.
   `scripts/generate-app-icon-source.mjs` la dibuja en Node puro (sin dependencias) y
   `npm run icons` produce las versiones instalables; la piedra cabe en la zona segura
   de los íconos adaptables de Android.

Reemplaza a D-027. No cambia cálculos, datos, PDF ni reglas de privacidad; cero
dependencias nuevas. Fable la cerró con 445 pruebas y build en verde; las cinco áreas
se revisaron en navegador a 390 px. No publicado: requiere la orden de Santiago y la
prueba física reinstalando la PWA.

## D-030 · Endurecimiento final de instalación, temas y pagos · 2026-07-16 · Vigente

Codex corrigió los hallazgos de la auditoría posterior a D-028 y D-029 sin cambiar la
arquitectura, la base local ni los documentos del cliente:

1. **Íconos instalables reales por plataforma.** Android recibe un archivo `maskable`
   diferente, totalmente opaco y con la gema dentro de su zona segura; Apple recibe una
   versión opaca. `npm run icons` genera primero las piezas maestras, después los tamaños
   publicados y finalmente verifica dimensiones, opacidad, diferencia entre variantes,
   zona segura y manifiesto.
2. **Tema oscuro y arranque coherentes.** El botón ámbar del aviso de navegador conserva
   contraste en modo nocturno. La pantalla inicial usa el fondo del tema antes de que
   cargue React y el manifiesto usa un fondo esmeralda de marca, evitando el destello
   marfil en teléfonos oscuros.
3. **Teléfonos estrechos.** Solo `input`, `select` y `textarea` conservan el mínimo de
   16 px que evita el zoom de iPhone. Los botones recuperan sus tamaños previstos, sin
   perder áreas táctiles de al menos 44 px; navegación y pasos del formulario caben sin
   desbordamiento a 320 y 390 px.
4. **Pagos sin ambigüedad.** El estado derivado distingue pendiente, pagada exacta,
   sobrepago y cotización sin total. Un exceso se muestra de forma visible y nunca queda
   escondido bajo una etiqueta verde. Un total de $0 no ofrece una acción imposible.
   Registrar el saldo queda protegido contra doble toque y reintentos, y las pruebas
   confirman una sola entrada en los cierres diario y mensual.
5. **Documentación alineada.** D-027 queda histórica y reemplazada; estado, hoja de ruta
   y novedades describen la identidad vigente y los controles realmente comprobados.

Resultado de la candidata completa: 452 pruebas en 24 archivos, verificación específica
de assets PWA, TypeScript y build en verde, recorrido local sin desbordamiento ni errores
visibles a 320 y 390 px. No se agregaron dependencias, no cambió IndexedDB y las pruebas
de privacidad del PDF cliente, Web Share y WhatsApp permanecen en verde. La candidata no
está publicada; falta reinstalarla en un teléfono real para comprobar el ícono del sistema.

## D-031 · Hoja de ruta SaaS actualizada y descongelada para planificación · 2026-07-17 · Vigente

Con la v2 publicada y aprobada por Santiago y sus colegas, Santiago ordenó retomar el
plan SaaS congelado (2026-07-08) y convertirlo en hoja de ruta ejecutable hacia un
producto cobrable y sostenible. `SAAS_PLAN.md` quedó reescrito con: el punto de partida
real (6 almacenes, respaldo v5, 452 pruebas), cinco fases (0 piloto formal con colegas
— puede empezar ya con la app publicada; 1 auditoría integral + ciberseguridad +
preparación legal Ley 1581/2012 + salida de OneDrive; 2 nube con Supabase y RLS con el
esquema actualizado al Ecosistema; 3 suscripciones con pasarela colombiana
Wompi/MercadoPago/PayU/Bold; 4 lanzamiento comercial), pruebas críticas de aislamiento
entre organizaciones, y un calendario honesto: auditoría fin de julio, beta en la nube
fin de agosto–mediados de septiembre, primeros clientes pagando en octubre 2026 — con
la advertencia de que los trámites (pasarela, legal) marcan el calendario más que el
código, por lo que arrancan en la Fase 1.

El documento autoriza solo la PLANIFICACIÓN: cada fase requiere la orden expresa de
Santiago antes de ejecutarse. El modo 100% local y gratuito se conserva como plan base.
Las cinco decisiones de negocio pendientes (nombre, precio, pasarela, enlace público,
lista del piloto) quedan listadas en el plan y no bloquean la Fase 1.

## D-032 · Decisiones comerciales del SaaS · 2026-07-17 · Vigente

Santiago resolvió las cinco decisiones de negocio listadas en D-031: (1) el producto se
llama **Emerald Dealer** — renombrado ya en manifest, título, pantalla de emergencia y
Ajustes; (2) el Plan Nube costará **$50.000 COP/mes**; (3) la pasarela será **Wompi**
por ser la de Bancolombia, su banco (abono directo, COP, recurrencia; Mercado Pago como
respaldo); (4) el enlace público vive SOLO durante el piloto — al cerrarlo la app exige
cuenta (muro de login al final de la Fase 2) y no habrá plan gratuito público; (5) el
piloto formal lo componen **siete joyerías** cuya lista es privada de Santiago y no se
registra en este repositorio público (regla de datos reales). Con su "procede con lo
demás" quedó ordenada la **Fase 1** (auditoría y endurecimiento pre-SaaS). Primera
pasada ya ejecutada: `npm audit` con 0 vulnerabilidades, 452 pruebas y build en verde
tras el renombre.

## D-033 · Límites preventivos para imágenes y respaldos · 2026-07-17 · Vigente

Durante S3 de la auditoría Fase 1 se confirmó que las imágenes de referencia se guardan
en IndexedDB, viajan dentro del respaldo y pueden entrar al PDF. Para evitar que una
foto original excesiva agote la memoria del teléfono antes de ser comprimida, cada
archivo elegido queda limitado a **1.5 MB**, con el mensaje claro “La imagen es muy
pesada. Elige una de máximo 1.5 MB.” Se conservan el máximo existente de cuatro imágenes
y la compresión existente; no se agregan dependencias.

Los respaldos JSON se limitan a **25 MB** antes de intentar interpretarlos. Un archivo
mayor se rechaza con mensaje claro y sin abrir ninguna escritura. El límite permite con
holgura los datos normales del piloto y reduce el riesgo de bloqueo por archivos hostiles.

## D-034 · El límite de imágenes se mide en lo que se guarda, no en la foto original · 2026-07-17 · Vigente (ajusta D-033)

La prueba en el Android de Santiago demostró que el límite D-033 de 1.5 MB aplicado al
archivo ORIGINAL rechazaba prácticamente todas las fotos de un teléfono (pesan 3–8 MB),
dejando inutilizable la carga del logo y de las imágenes de referencia. Corrección:
el guardia previo al procesamiento sube a **25 MB** (protección de memoria contra
archivos absurdos, mismo techo que los respaldos) y el límite de **1.5 MB pasa al
resultado YA COMPRIMIDO** (1000 px, JPEG 0.72 — lo que realmente entra a IndexedDB,
al respaldo y al PDF), con mensaje claro si no se logra reducir. Además, el botón
"Guardar ajustes" vuelve al flujo normal en el teléfono (dejaba de moverse y se
superponía al contenido al deslizar, mismo defecto que Santiago ya había rechazado en
el cotizador) y conserva la posición flotante solo en computador, igual que las
acciones del formulario. Sin dependencias nuevas.

## D-034 · El límite de imágenes se mide en lo que se guarda, no en la foto original · 2026-07-17 · Vigente (ajusta D-033)

La prueba en el Android de Santiago demostró que el límite D-033 de 1.5 MB aplicado al
archivo ORIGINAL rechazaba prácticamente todas las fotos de un teléfono (pesan 3–8 MB),
dejando inutilizable la carga del logo y de las imágenes de referencia. Corrección:
el guardia previo al procesamiento sube a **25 MB** (protección de memoria contra
archivos absurdos, mismo techo que los respaldos) y el límite de **1.5 MB pasa al
resultado YA COMPRIMIDO** (1000 px, JPEG 0.72 — lo que realmente entra a IndexedDB,
al respaldo y al PDF), con mensaje claro si no se logra reducir. Además, el botón
"Guardar ajustes" vuelve al flujo normal en el teléfono (dejaba de moverse y se
superponía al contenido al deslizar, mismo defecto que Santiago ya había rechazado en
el cotizador) y conserva la posición flotante solo en computador, igual que las
acciones del formulario. Sin dependencias nuevas.

## D-035 · Arranque de la Fase 2 (nube) y primera dependencia nueva · 2026-07-18 · Vigente

Santiago ordenó arrancar la Fase 2 del plan SaaS (D-031/D-032). Fable escribió la orden
de trabajo arquitectónica completa en `docs/historico/FASE2_ORDEN_DE_TRABAJO_CODEX.md`; Codex
ejecuta en la rama `codex/fase2-nube` y Fable audita al cierre. Decisiones de
arquitectura fijadas en esa orden:

1. **Bandera de entorno:** sin `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` al compilar,
   la app es EXACTAMENTE la actual (el build público del piloto no cambia). El corte al
   muro de login es una orden aparte de Santiago; los pilotos convertirán sus datos en
   la misma URL con el importador de origen local.
2. **Primera dependencia nueva del proyecto: `@supabase/supabase-js`**, autorizada por
   ser el cliente oficial que gestiona sesiones y renovación de tokens (prohibido
   construir auth propia). Se carga con import dinámico solo cuando la nube está activa.
3. **Esquema multi-organización** con claves compuestas (organization_id, id-texto
   local), RLS en todas las tablas, funciones security-definer para organización,
   consecutivo con bloqueo y upserts LWW por `updatedAt`.
4. **Sincronización v1:** online-first con caché IndexedDB y outbox serial persistente
   (nuevo almacén al final de la escalera, D-022); LWW en ambos sentidos; sin Realtime.
5. **Pruebas innegociables antes de la beta:** aislamiento total entre organizaciones
   (4 operaciones × 6 tablas + RPCs + anon + membresía ajena) y consecutivo sin
   duplicados bajo concurrencia, contra el proyecto real, con script reproducible.

La cuenta de Supabase la crea Santiago guiado (etapa N5); la service key jamás entra al
repositorio. El plan de corte del enlace público queda documentado pero NO se ejecuta
sin su orden.

## D-036 · Frontera de escritura y salida al mercado auditable · 2026-07-18 · Vigente

Santiago aprobó las dos medidas de endurecimiento previas a continuar con la nube:

1. **Escrituras únicamente por operaciones protegidas.** Las lecturas continúan aisladas
   por RLS, pero el navegador pierde los permisos directos para crear, editar o eliminar.
   La base comprueba membresía, rol, identificadores, fechas, estados y valores COP
   críticos antes de guardar. Los objetos futuros nacen sin permisos implícitos.
2. **Candidatas por etapas y publicación humana.** Dependencias, credenciales, migraciones,
   pruebas, compilación y aislamiento N6 generan evidencia por commit. GitHub Pages deja
   de publicar por un simple cambio en `main`: exige ejecución manual, el commit exacto
   aprobado por N6 y la confirmación `PUBLICAR`.

Este cambio no publica, no modifica `main` ni activa el muro de cuenta en el sitio actual.
Antes de invitaciones debe aprobarse la matriz de permisos owner/admin/seller. Antes de
datos reales siguen pendientes N6 en el proyecto de pruebas, revisión legal, recuperación
y auditoría independiente.

## D-037 · Proyecto aislado para pruebas reales de nube · 2026-07-18 · Vigente

Santiago confirmó el costo de **US$0 al mes** y autorizó crear **Emerald Dealer -
Pruebas Fase 2** en São Paulo dentro de su organización de Supabase. El proyecto anterior
de Canadá queda intacto y no se considera entorno de pruebas aprobado.

Las cuatro migraciones se aplicaron únicamente al nuevo proyecto. La URL y la clave
publicable quedan en `.env.local`, ignorado por Git. La clave secreta no se extrae ni se
guarda: N6 la solicita de forma oculta, la mantiene solo durante la ejecución y la elimina
de la sesión al terminar. El proyecto sigue siendo desechable y no puede recibir datos
reales de clientes. Esta decisión no publica la aplicación ni modifica `main`.

## D-038 · N6 solo se aprueba con doble comprobación de aislamiento y permisos · 2026-07-18 · Vigente

La primera ejecución N6 aprobó sus nueve controles en 21.800 ms y limpió todas las
cuentas, sesiones, joyerías y registros ficticios. La revisión posterior detectó seis
permisos directos heredados en `organizations` y `memberships`. RLS había bloqueado los
intentos, pero conservar esos permisos contradecía D-036 y el principio de mínimo
privilegio, por lo que la evidencia inicial se invalidó voluntariamente.

Se agregó una migración nueva, sin reescribir el historial, que retira todos los
permisos de tabla de sesiones autenticadas y reabre solo las ocho lecturas necesarias.
La comprobación real posterior dio 9/9 tablas con RLS, cero permisos no-lectura, cero
permisos anónimos, cero acceso a `org_counters` y las 14 operaciones protegidas
disponibles. La repetición corregida aprobó 9/9 controles en 20.498 ms sobre el commit
`fffa1bdbf0600c7077f473d39a90546a4926166f`; después se confirmó nuevamente la limpieza
total y la permanencia de los permisos mínimos. N6 queda aprobado para continuar a N7.

## D-039 · Cotizaciones sin señal se guardan sin numerar · 2026-07-18 · Vigente

Una cotización nueva o duplicada se guarda de inmediato en el dispositivo y en la cola
aunque no haya conexión. Mientras espera se muestra como **sin número**: nunca se inventa
un consecutivo provisional que pueda confundirse con el definitivo. Al volver la red, la
cola solicita el consecutivo a `next_quote_number()` y guarda esa operación ya numerada
antes de intentar subirla; así un reintento no consume otro número ni duplica la subida.

El PDF del cliente y la opción de compartirlo quedan bloqueados hasta recibir el número
real, con una explicación clara. El PDF interno puede conservar la marca "Sin número".
El consecutivo definitivo continúa generándose exclusivamente en el servidor.

## D-040 · Los borrados remotos solo afectan registros ya reconciliados · 2026-07-18 · Vigente

Para corregir la regresión A1 se elige la protección **por registro visto en la nube**,
no una marca general de importación por dispositivo. Cada registro conserva localmente
la señal durable `cloudUpdatedAt` cuando fue recibido de la nube o entró al proceso de
subida. Mientras una subida siga pendiente, la cola continúa protegiéndolo.

Un registro anterior al modo nube que nunca se subió no tiene esa señal y jamás se
elimina porque falte en un `pull`. Esto protege tanto una cuenta nueva con nube vacía
como un teléfono que entra a una joyería cuya nube ya contiene datos de otro aparato.
Una vez que el dispositivo confirmó el registro como parte de la nube, su ausencia en
una respuesta remota exitosa sí representa un borrado entre dispositivos y se aplica.

La opción de continuar sin importar deja de llamarse "Ahora no": explica que los datos
seguirán solamente en ese dispositivo y que no aparecerán en otros hasta subirlos desde
Cuenta. Ante cualquier estado ambiguo, la regla sigue siendo conservar el dato.

## D-041 · Contraseña temporal y aceptación legal son pasos independientes · 2026-07-20 · Vigente en candidata

El cierre del trabajo incompleto de Fable separa dos necesidades que no deben confundirse:
una cuenta creada manualmente puede tener que reemplazar una contraseña temporal, mientras
una cuenta existente puede necesitar únicamente revisar una nueva versión legal. La app
solo muestra y exige el paso que realmente falta. Las cuentas antiguas creadas desde la
aplicación conservan la contraseña que ya eligieron y cambiar una clave temporal no
sobrescribe la fecha de aceptación anterior.

La aceptación contractual de los términos y la autorización de tratamiento de datos usan
dos casillas separadas, nunca premarcadas. La segunda muestra tanto el aviso de tratamiento
como la política de privacidad. Para continuar deben existir fecha y versión coincidentes
de términos, política y aviso; un cambio de versión vuelve a pedir únicamente la aceptación
del documento correspondiente, sin reemplazar la fecha vigente de los demás.

La versión actual se identifica como `draft-2026-07-20` porque los tres documentos aún
contienen campos pendientes y no tienen revisión profesional. Esta trazabilidad en metadata
sirve para probar el recorrido técnico, pero no se presenta como evidencia jurídica final:
antes de mercado se debe decidir con el revisor legal si hace falta un registro inmutable
con hora del servidor. No se habilita la nube pública ni se modifica `main` con esta decisión.

## D-042 · Crédito al VENDER piedras: una fecha acordada y abonos derivados · 2026-07-21 · Vigente

Un comerciante grande de esmeraldas, cliente real, pidió poder revisar si sus compradores
ya le pagaron en las fechas acordadas. Hoy `StoneSale` solo guarda `valueCop` y no existe
ningún rastro de fecha, abonos ni saldo: era el hueco principal del inventario.

Héctor decidió el modelo más simple que resuelve el problema: **una sola fecha límite de
pago por venta, más abonos libres del comprador**, en lugar de un plan de cuotas con fecha
y monto cada una. Un plan de cuotas obligaría a llenar varias pantallas por cada venta sin
responder mejor la pregunta real, que es "¿ya me pagó y hace cuánto se venció?".

`StoneSale` estrena `onCredit`, `dueDate`, `payments[]` y `buyerId`. `valueCop` pasa a
significar el **precio total acordado** de la venta. Lo recibido, el saldo, el vencimiento
y los días de atraso se **derivan** siempre, nunca se guardan (regla de D-023, igual que
la deuda con proveedores de D-025/C4). Una cuota inicial es simplemente un abono con la
fecha de la venta: no existe un campo aparte para ella.

Las ventas anteriores a esta decisión se normalizan como de contado, sin fecha y sin
abonos, de modo que su dinero, su resultado por lote y los cierres ya emitidos dan
exactamente el mismo número que antes. Hay una prueba de no regresión que lo exige.

## D-043 · Compradores como lista propia, separada de Clientes · 2026-07-21 · Vigente

Quien compra piedras o joyas de vitrina suele ser otro joyero o comerciante, no el
consumidor final que encarga una pieza a la medida. Mezclarlos en la lista de Clientes
llenaría el selector del cotizador de gente que nunca va a encargar una joya.

Se crea la entidad `Buyer` con la misma forma que `Supplier`, ya probada en producción.
Es **una sola lista compartida** por las ventas de piedras y las de joyas en stock: una
tercera lista solo para joyas sería peor, y así la ficha de un comerciante muestra todo lo
que le compró. Sin comprador registrado, el nombre libre sigue funcionando exactamente
como hoy.

Borrar un comprador **no borra ni altera sus ventas**: dentro de una sola transacción se
elimina el comprador y se deja `buyerId` en nulo conservando el nombre escrito, igual que
se resolvió con los proveedores en C3. Renombrar un comprador actualiza su nombre en las
ventas que lo apuntan. Ambas operaciones deben encolar hacia la nube también los lotes y
joyas que cambiaron.

## D-044 · Joyas en stock como área propia, siempre de contado · 2026-07-21 · Vigente

Una joya de vitrina ya está fabricada: no se cotiza, no pasa por etapas de taller y no
tiene anticipo. Héctor decidió que viva en un área propia, sin mezclarse con el cotizador
ni con el Taller, por la misma razón por la que Piedras se separó en D-023: no arriesgar
lo que ya usan las siete joyerías del piloto.

De cada pieza se guarda **solo lo básico**: nombre, tipo, material, una foto, fecha de
ingreso al inventario, costo, precio de venta y estado. Quedan expresamente **fuera** las
piedras montadas, el peso en gramos, el código de vitrina y la ubicación; se conserva un
campo de notas simple porque toda entidad de la app lo tiene.

Las joyas **se venden siempre de contado**, por decisión expresa de Héctor: la pieza se
entrega pagada. El crédito al vender queda solo para piedras.

El estado "vendida" **no se guarda**: se deriva de que la pieza tenga venta. Solo
"disponible" y "apartada" son estados escritos. El resultado de la pieza es el precio
recibido menos su costo, y también se deriva.

La foto reutiliza los límites ya probados de D-033/D-034 (una imagen por pieza, medida
sobre lo que se guarda y no sobre el archivo original). Ninguna joya en stock genera
documento de cliente: costo, resultado y notas no salen nunca de la app.

## D-045 · El inventario cuenta en los cierres con la plata real · 2026-07-21 · Vigente

Las ventas y cobros nuevos entran al Cierre del día y al del mes conservando la regla
honesta de C5/D-025: **el dinero cuenta el día en que se mueve de verdad**.

Una venta de piedras a crédito **no suma a la caja el día de la venta**; se informa aparte
para que el comerciante la vea, y los abonos del comprador suman el día en que se reciben.
Una venta de contado sigue sumando completa el día de la venta, como hasta ahora. Una joya
que entra al inventario resta de la caja el día de su fecha de ingreso, igual que la
compra de contado de un lote de piedras, y su venta suma el día en que se vende.

Los cierres estrenan además la foto del momento "te deben por piedras", junto a las que ya
existen de deuda con proveedores y saldos de clientes. Los documentos siguen siendo
internos y de descarga directa, jamás Web Share ni WhatsApp.

## D-046 · El inventario crece en profundidad, no en botones de menú · 2026-07-21 · Vigente

Héctor pidió que piedras e inventario tengan más protagonismo y estrenó además joyas en
stock. Un sexto botón en el menú inferior dejaría los nombres ilegibles en teléfonos de
320 px, un ancho que la app cuida explícitamente desde D-030.

Se elige entonces convertir la pestaña "Piedras" en **"Inventario"**, con tres secciones
adentro: **Piedras · Joyas · Cobros**. El menú se queda en cinco botones. "Cobros" —la
lista de quién debe, cuánto y hace cuántos días, con semáforo de color y orden por el más
atrasado— queda a un solo toque, porque es exactamente lo que pidió el comerciante que
originó esta ampliación.

Esta ampliación **no agrega ninguna dependencia nueva**.

## D-047 · El dinero ya cobrado no se borra por un cambio de interruptor · 2026-07-22 · Vigente

Auditoría propia de la ampliación de inventario, hecha sobre el código escrito el
mismo día. Dos hallazgos reales, ambos corregidos con pruebas que fallan antes y pasan
después.

**H1 (grave).** Al editar una venta a crédito, apagar el interruptor "se la vendí a
crédito" vaciaba los abonos del formulario **antes** de validar. La validación rechaza
ese cambio precisamente porque quedan abonos, así que al vaciarlos nadie protestaba y
el guardado borraba pagos reales del comprador, en silencio y sin manera de deshacerlo.

La regla que queda: **una función que cambia la forma de pago nunca borra el dinero ya
recibido.** El motor puro `withSaleCredit` conserva siempre los abonos, la validación
puede entonces rechazar el cambio, y el formulario explica en pantalla por qué no deja
guardar. Lo mismo aplica a cualquier interruptor futuro que cambie contado por crédito.

**H2.** Los avisos de borrado callaban la plata que le deben a la joyería. Borrar un
lote con ventas a crédito hacía desaparecer ese cobro de la pantalla de Cobros sin
mencionarlo, y borrar una venta se llevaba sus abonos igual de callada.

La regla que queda: **todo aviso de borrado nombra el dinero que se pierde**, tanto el
que se debe como el que le deben. `stoneLotDeletionWarning` y `stoneSaleDeletionWarning`
son funciones puras con pruebas propias, no textos escritos dentro de un diálogo.

Se agregó además cobertura de la cadena de nube que faltaba: renombrar o borrar un
comprador sube también los lotes y las joyas que cambiaron de nombre, no sube lo que no
cambió, y cada tabla nueva usa su función protegida sin enviar jamás el identificador de
la organización desde el navegador.

## D-048 · Inventario de materiales por lotes con propiedad compartida · 2026-07-24 · Vigente

Héctor pidió llevar un inventario del material (oro) que tiene, clasificándolo y
sabiendo de quién es: tiene oro compartido con su socio de Emerald Dealer y otro con
un joyero amigo. Necesita ver, de cada material, con quién es y qué parte le toca.

Se crea `MaterialLot`: cada compra de material es un lote rastreable (tipo, pureza,
gramos, costo, fecha) con sus salidas embebidas (`MaterialUse`). Las existencias y lo
que queda se DERIVAN del lote menos sus salidas, jamás un contador guardado a mano
(regla de D-023), igual que las piedras.

**Propiedad compartida (decisión de Héctor):** por cada lote se guarda con quién se
comparte (`partnerId`/`partnerName`) y cuántos de los gramos son suyos (`myGrams`); el
resto es del socio. Sin socio, el lote es 100% suyo y la interfaz no muestra reparto.
El porcentaje y la parte del socio se derivan; el reparto se mantiene sobre el
restante a medida que se usan gramos.

**Alcance de la v1, decidido para que sea simple y seguro:** el material es una lista
APARTE que Héctor ajusta a mano; no se descuenta solo al aprobar una cotización, no
toca el cotizador que usan las 7 joyerías (decisión de Héctor). El dinero del material
NO entra al Cierre del día ni del mes en v1 —porque al ser compartido, cuánto salió de
su propio bolsillo es ambiguo, y el foco de Héctor fue gramos y dueños—; el costo se
guarda como referencia. El material tampoco maneja crédito ni pagos en v1. Todo esto
es ampliable más adelante sin romper nada.

## D-049 · Socios de material como entidad propia · 2026-07-24 · Vigente

Los dueños del material (el socio de Emerald Dealer, el joyero amigo) son un rol
distinto de los clientes, los proveedores y los compradores: son CO-DUEÑOS del oro, no
alguien a quien se le compra ni a quien se le vende. Van en una lista propia,
`MaterialPartner`, con la misma forma probada de `Supplier` y `Buyer`.

Vincularlos permite ver "cuánto oro comparto con Fulano en total" y su historial.
Borrar la ficha de un socio NO borra sus lotes: se conserva el nombre escrito y solo se
suelta el vínculo (`partnerId` a null), igual que se resolvió con proveedores (C3) y
compradores (D-043). Renombrar un socio actualiza su nombre en los lotes que lo
apuntan; esos lotes también deben subir a la nube.

## D-050 · Joyas en stock con espacio propio y base para colecciones · 2026-07-24 · Vigente

Héctor quiere que las joyas en stock tengan un espacio propio, pensando en armar
colecciones de joyería a mediano plazo. La pestaña "Inventario" pasa a tener cuatro
secciones —Piedras · Materiales · Joyas · Cobros—; ahí las joyas tienen su lugar. El
menú inferior se queda en cinco botones porque un sexto se corta en teléfonos de
320 px (D-030/D-046).

Las colecciones se diseñan pero se construyen después. Para no tener que migrar datos
más adelante, `StockJewel` estrena desde ya un campo `collectionId` (null por defecto),
reservado; no hay entidad ni pantalla de colecciones todavía. Las joyas y respaldos
anteriores normalizan `collectionId` a null.

## D-051 · Todo dinero recibido del inventario queda trazable · 2026-07-26 · Vigente en candidata

Santiago encontró que las notas de una venta sí quedaban guardadas, pero no siempre
podían volver a consultarse, y que el inventario no separaba dos datos indispensables:
**cómo pagaron** y **quién recibió el dinero**.

Desde esta decisión, toda venta nueva de piedras de contado, toda venta nueva de una
joya en stock y cada abono nuevo de un comprador registran `method` y `receivedBy`,
además de la nota interna que ya existía. En una venta de piedras a crédito esos datos
pertenecen a cada abono, porque el comprador puede pagar en días y medios distintos;
la cabecera de la venta no inventa un pago que todavía no ocurrió.

Los registros antiguos se conservan sin cambios ni datos inventados. Cuando no tengan
forma de pago o receptor, la app los presenta como **“Sin registrar”** y permite
revisarlos. No se intenta extraer esos datos de notas escritas anteriormente.

La ficha de la venta, el historial de abonos y el Cierre del día o del mes vuelven a
mostrar forma de pago, receptor y nota. Todo sigue siendo **exclusivamente interno**:
ninguna nota, costo, resultado ni dato de cobro del inventario llega a documentos del
cliente, Web Share o WhatsApp.

Esta ampliación no cambia ningún total, saldo ni fecha contable: D-045 sigue contando
el dinero únicamente el día en que se movió. Tampoco requiere migraciones nuevas: los
lotes y joyas ya se guardan completos y los campos nuevos son compatibles con los datos
anteriores. No se agrega ninguna dependencia.

## D-052 · El Cotizador deja de ser la puerta de entrada · 2026-08-03 · Vigente

La aplicación nació para cotizar, pero creció hasta contener Taller, Agenda, Inventario
de piedras, Material con socios, Joyas en stock, Cobros y cierres. Santiago observó que
abrir directamente en el Cotizador da una impresión equivocada del producto: parece una
cotizadora con anexos, cuando en realidad es el sistema del negocio.

Desde esta decisión la aplicación abre en una **pantalla de inicio** que muestra todas
las áreas, y el usuario elige la que necesita en ese momento. Cotizar pasa a ser una
opción más entre iguales. La barra inferior se conserva como atajo una vez dentro de un
área: ninguna ruta existente desaparece.

**Forma elegida (2026-08-03).** Santiago vio dos maquetas —un tablero de fichas con los
números del día y una portada agrupada por áreas— y eligió **la mezcla**: la portada
agrupada, con la cifra del mes arriba.

- **Agrupación por los pasos del negocio**, no por módulos técnicos: Vender · Producir y
  atender · Inventario · La plata · Tu gente · Cuenta. Esa agrupación enseña de qué se
  trata la aplicación en cinco segundos y aguanta crecer sin desordenarse.
- **Una sola cifra arriba**: el resultado del mes. **No es un cálculo nuevo**: reutiliza
  exactamente el del Cierre mensual que ya existe, con el mismo nombre. Cuando llegue el
  libro del negocio (D-057) pasará a leerse de él, y el número no debe cambiar.
- **Números solo donde hay algo que atender** (citas de hoy, cobros vencidos, trabajos en
  proceso). El resto de las filas van sin adorno.

**Inicio reemplaza a "Más" en la barra inferior.** La pestaña "Más" existía porque no
había una pantalla de inicio: era el cajón de todo lo que no cabía. Con la portada, ese
cajón queda cubierto y mejor ordenado. La barra queda en **Inicio · Cotizador · Taller ·
Agenda · Inventario**: siguen siendo cinco botones (D-046), Agenda conserva su globito de
citas de hoy, y **todo destino que hoy se alcanza desde "Más" debe seguir alcanzándose
desde Inicio**.

El panel de ventas y ganancias (Fase E) es una pantalla distinta y responde otra pregunta
—"¿qué necesita mi atención?"—. No se adelanta a Inicio para que las dos no compitan por
el mismo trabajo.

## D-053 · Sociedad es el negocio compartido, y debe poder compararse · 2026-08-03 · Vigente

Santiago compra lotes de esmeraldas solo o **con socios**. Cuando el lote es compartido
necesita ver su ganancia y la de cada socio **por separado**, y sobre todo poder
comparar unas sociedades con otras: cuál deja dinero, cuál lo quita, cuál conviene
repetir.

La sociedad se construye **reutilizando la entidad de socios que ya existe** para
material (D-049), generalizada a piedras. No se crea una entidad paralela ni se migra
destructivamente la existente. El reparto se calcula siempre sobre el **resultado real**
(recibido − costo), nunca sobre el precio de lista. Borrar un socio conserva su nombre y
el reparto histórico, como ya ocurre en material.

Los lotes anteriores sin socio siguen siendo 100% propios y dan exactamente el mismo
dinero que antes.

## D-054 · El peso colombiano es la base; el dólar es una vista · 2026-08-03 · Vigente

El negocio de esmeraldas transa con frecuencia en dólares, pero la contabilidad de
Santiago es en pesos colombianos. Desde esta decisión el dinero se **almacena siempre en
COP enteros** —regla que ya protege el motor y todas las pruebas existentes— y el dólar
es exclusivamente una **forma de ver** la misma información.

Cambiar la vista a dólares no modifica ni un solo dato guardado.

**Resuelto el 2026-08-03:** la tasa se guarda **en cada operación**, con el valor del día
en que ocurrió. Santiago eligió la historia fiel: si el dólar sube mañana, una venta de
hace tres meses no cambia de valor sola. La alternativa —una sola tasa en Ajustes—
habría recalculado todo el pasado cada vez que se editara la tasa, y eso vuelve inútil
cualquier comparación entre períodos.

Consecuencia para la implementación: toda operación de dinero nueva guarda su `usdRate`
junto al monto en COP. Las operaciones anteriores no tienen tasa y muestran
**"Sin registrar"** en la vista de dólares, conforme a D-051; no se les inventa una tasa
retroactiva.

## D-058 · Tipo de producto: lista base que Santiago puede ampliar · 2026-08-03 · Vigente

Para filtrar y comparar el consolidado hace falta clasificar cada venta por tipo de
producto. Santiago eligió una **lista base lista para usar, ampliable con tipos propios**.

La lista base cubre lo que el negocio maneja hoy —esmeralda en bruto, esmeralda tallada,
joya con piedra natural, joya con piedra de fantasía, material (oro/plata) y trabajo por
encargo— para que el filtro sirva desde el primer día sin configurar nada. Santiago puede
agregar los suyos cuando aparezca un producto que no encaje, de modo que la clasificación
nunca se quede corta ni lo obligue a usar "otro".

Los tipos propios se guardan por organización. Un tipo que ya se usó en una venta no se
borra: se puede dejar de ofrecer para ventas nuevas, pero el historial conserva su
nombre, igual que ocurre con proveedores, compradores y socios.

Las ventas anteriores a esta decisión no tienen tipo y muestran **"Sin registrar"**
(D-051). No se les asigna un tipo adivinado a partir del módulo de origen.

## D-062 · La tasa del dólar se reutiliza de la fuente del oro, no se duplica · 2026-08-04 · Vigente

> **Nota de numeración (2026-08-04).** Esta decisión se registró primero como D-059
> por error de Claude: Codex ya había usado ese número para los gastos en la Fase B.
> Se renumeró a D-062 al detectarse el choque. Si algún mensaje de commit anterior la
> menciona como D-059, se refiere a esta.

`AGENTS.md` protege `src/services/goldPrice.ts` y exige decisión escrita para tocarlo.
La etapa B3 lo modificó, y esta decisión cierra ese registro tras la auditoría.

La aplicación ya consultaba la tasa USD→COP en ese archivo para calcular el precio del
oro: misma fuente (`open.er-api.com`), ya autorizada en la CSP, con límites de sanidad
(1000–20000 COP por dólar) y con funcionamiento sin conexión. Guardar la tasa por
operación (D-054) necesitaba exactamente eso.

**Se eligió reutilizar en vez de duplicar.** Se exportaron las dos constantes ya
existentes sin cambiar sus valores, y se agregaron `isValidUsdRate` —con los mismos
límites— y `fetchUsdRateCOP` —con la misma URL—. La matemática del precio del oro no
cambió y ninguna prueba fue eliminada ni debilitada.

El único efecto observable es que una tasa fuera de rango se rechaza un paso antes, con
un mensaje ligeramente distinto; sigue negándose a actualizar el precio, que es lo que la
regla protege.

La alternativa —una segunda función de consulta con sus propios límites— habría creado
dos definiciones de "tasa razonable" que podrían separarse con el tiempo. Una sola
defensa, compartida, es más segura que dos copias.

Verificado en la auditoría de las Fases A y B
(`docs/historico/AUDITORIA_CLAUDE_V2_FASES_A_B.md`, observación O1).

## D-055 · La talla se registra por tandas, en piedras y quilates · 2026-08-03 · Vigente

Al tallar una esmeralda en bruto se pierde alrededor del **70% del peso**, a veces más y
a veces menos. Además la talla **no se hace sobre el lote completo**: de un lote de diez
piedras se pueden tallar dos este mes y dos el siguiente.

Desde esta decisión un lote de piedras admite **tandas de talla**. De cada tanda se
registra únicamente **cuántas piedras y cuántos quilates** se envían, y al regresar el
resultado real; la merma se **deriva**, nunca se digita. Santiago descartó explícitamente
identificar piedra por piedra dentro del lote: es más control del que necesita y demasiado
trabajo de digitación.

El lote pasa a tener dos existencias —lo que sigue en bruto y lo ya tallado y
disponible—, y cada venta declara de cuál sale. Un lote sin tandas se comporta
exactamente como hoy.

Implementación C1 (2026-08-04): además se muestra por separado lo que está **en
talla**. La merma promedio del lote se pondera por los quilates enviados, para
que una tanda pequeña no pese lo mismo que una grande. El costo de talla queda
pendiente hasta registrar su fecha de pago; solo entonces aumenta la inversión
del lote y sale en el cierre de caja.

Cuando ya existe una venta tallada, quedan congelados los datos físicos de toda
tanda que ya regresó —fechas, piedras y quilates enviados/devueltos— y tampoco
puede borrarse. El costo, su fecha de pago y las notas sí pueden completarse
después: bloquearlos impediría pagar una talla que se vendió antes de saldar al
tallador. Esta excepción no cambia existencias y queda protegida por pruebas en
el dispositivo y por la migración de la nube.

## D-056 · Cambiar fantasía por natural descuenta del inventario de piedras · 2026-08-03 · Vigente

Es práctica común del negocio comprar una joya terminada con **piedra de fantasía** y
reemplazarla después por una **piedra natural**. Saber cuánto stock hay de cada clase es
indispensable para saber qué se le puede ofrecer a un cliente.

Desde esta decisión cada joya en stock se clasifica como fantasía o natural, y el cambio
de una a otra es un **evento registrado con fecha** que hace tres cosas a la vez: cambia
la clasificación de la joya, **descuenta la piedra natural del inventario de Piedras** y
suma el costo de esa piedra al costo de la joya. Los dos módulos deben cuadrar solos: no
se puede transformar consumiendo una piedra que no existe.

Las joyas existentes se leen sin clasificación y muestran **“Sin registrar”** hasta que
se clasifiquen, conforme a D-051. La joya conserva su historia: se ve que empezó en
fantasía.

Implementación C2 (2026-08-04): cada joya guarda peso, talla o medida libre,
número de piedras y clase, sin inferir datos anteriores. La transformación crea
un solo evento enlazado en la joya y el lote: descuenta bruto o tallado, conserva
la cantidad de piedras registrada y traslada un costo COP entero. La piedra de
fantasía retirada no se rastrea y su costo original permanece en la joya.

El traslado **no mueve caja**. El costo atribuido sale del resultado contable del
lote y entra al costo de la joya; el resultado combinado no cambia. En local las
dos mitades se guardan en una transacción. En nube se exige conexión, se resuelven
primero cambios pendientes y el servidor confirma la pareja antes de escribirla
en el dispositivo. Las descargas de Piedras y Joyas también se validan y guardan
juntas para no mostrar media transformación.

Si un cambio de Piedras o Joyas queda retenido por conflicto, la cuenta ofrece
usar la versión confirmada en la nube. Esa decisión descarta únicamente la cola
de esos dos módulos: espera el envío que ya hubiera empezado, trae y valida la
pareja completa, y confirma a la vez los dos inventarios y la retirada de esa
cola. Si falla la red, la validación o el guardado, conserva íntegros los datos y
los cambios locales; los demás módulos nunca se incluyen en el descarte.

Deshacer y borrar quedan bloqueados: quitar una sola mitad dejaría inventario o
costo huérfano. Una reversa futura tendría que ser otra operación doble y
protegida. Los respaldos reconstruyen el costo histórico exacto mediante puertas
de importación reservadas a owner/admin; un corte común impide que repetir un
respaldo antiguo reactive una venta o pise una edición posterior.

## D-057 · Una sola verdad para los números del negocio · 2026-08-03 · Vigente

Santiago pidió un dashboard de ventas y ganancias, cierres en Excel y un consolidado con
filtros. Las tres pantallas muestran **la misma plata**. Si cada una la calculara por su
cuenta a partir de las entidades crudas, tarde o temprano se contradirían, y en una
aplicación de dinero eso destruye la confianza en todo lo demás.

Desde esta decisión existe un **libro del negocio** (`src/services/ledger.ts`): un motor
puro que traduce todo lo que ocurre —ventas, abonos, pagos del taller, lotes, tandas de
talla, transformaciones de joyas, material y gastos— a un flujo normalizado de eventos
con las mismas dimensiones: fecha, monto en COP, tasa del dólar, tipo de evento, módulo,
lote, sociedad, tipo de producto y contraparte.

El dashboard agrupa ese flujo por período; los cierres lo filtran por fecha; el
consolidado lo agrupa por sociedad o tipo de producto; el Excel lo serializa. Una sola
verdad, cuatro presentaciones.

La prueba que valida el libro es que `dailyReport.ts` y el cierre mensual, al pasar a
leer de él, **sigan dando exactamente los mismos totales que hoy**.

Implementación D1 (2026-08-04): el libro se construyó en paralelo, sin tocar los
cierres. La prueba de equivalencia reúne en un mismo período contado, crédito,
abonos, proveedor, talla pagada y pendiente, usos internos, transformación de joya,
taller, gastos, cotizaciones y material, y obtuvo igualdad exacta en `cashIn`,
`cashOut` y `net`. Al aplicar el catálogo a la caja honesta de D-045, una compra de
piedras de contado usa `sale`, una compra a crédito usa `ninguna`, y cada pago real
al proveedor usa `sale`. Los usos de material, que guardan gramos pero no un costo
monetario propio, conservan `amountCop: 0` antes que inventar un valor; toda actividad
de material usa `direction: 'ninguna'` y nunca altera los cierres.

Implementación D2 (2026-08-04): los cierres diario y mensual dejaron de sumar
dinero desde sus renglones. Construyen el libro completo, lo filtran por día o mes
y obtienen de él cada categoría, `cashIn`, `cashOut` y `net`; el historial mensual
reutiliza una sola construcción para todos los meses. Los renglones descriptivos y
las fotos actuales de deudas se conservan para el PDF interno, sin volver a decidir
el sentido de caja. La equivalencia de D1 y las pruebas existentes de cierres
pasaron sin cambiar ningún valor esperado. La Fase D termina aquí, sin pantalla ni
avance a la Fase E.

Corolario de operación: el orden de construcción no es negociable. Primero los datos que
faltan (gastos, sociedades, tipo de producto), después los cambios de inventario, luego
el libro, y solo al final las pantallas que lo leen. Construir el dashboard antes
obligaría a rehacerlo.

## D-059 · Los gastos conservan su categoría y su reparto histórico · 2026-08-03 · Vigente

Santiago eligió administrar las categorías dentro de **Gastos**, con una lista base lista
para usar y la posibilidad de agregar categorías propias. Una categoría puede dejar de
ofrecerse para registros nuevos, pero no se borra: los gastos anteriores conservan el
nombre con el que fueron registrados. Reactivar una categoría vuelve a ofrecer ese mismo
nombre, sin crear duplicados.

Un gasto puede ser 100% propio o compartirse con un socio existente. Cuando es
compartido guarda una foto del nombre del socio y el porcentaje de Santiago; la parte
del socio es el resto. Si se elimina la ficha del socio, el gasto conserva el nombre y
el reparto originales. Un gasto sin socio es siempre 100% propio.

El gasto completo sale de caja en la fecha en que se pagó. El reparto es informativo
para saber qué parte corresponde a Santiago y cuál al socio; no reduce la salida real de
caja. Todo se calcula en COP enteros: la parte de Santiago se redondea y el residuo queda
de forma determinista en la parte del socio, de modo que las dos partes siempre suman
exactamente el gasto.

## D-060 · Las sociedades de piedras se reparten sobre dinero realmente recibido · 2026-08-03 · Vigente

Los socios de Material pasan a ser la lista general de **Socios** del negocio. La misma
ficha puede vincularse a material, gastos y lotes de piedras. Renombrarla actualiza el
nombre en los registros vinculados; eliminarla suelta el vínculo, pero conserva en cada
registro la foto del nombre y el reparto histórico.

Cada lote de piedras guarda el socio, su nombre histórico y el porcentaje de Santiago.
Un lote anterior, o uno sin socio, se lee como 100% propio. Los porcentajes válidos son
enteros entre 0 y 100; un valor inválido se rechaza antes de guardar y nunca se corrige
silenciosamente.

El resultado histórico del lote sigue significando **precio acordado menos costo** y no
cambia. Para una sociedad se muestra además un resultado separado basado únicamente en
dinero real: **recibido de compradores menos costo del lote**. La parte del socio es
`Math.trunc(resultado real × (100 − porcentaje de Santiago) / 100)`; la parte de
Santiago es el residuo exacto. Así las dos partes siempre suman el resultado real,
también cuando es negativo o no divide exactamente.

La ampliación no crea otra lista de socios ni cambia versiones: IndexedDB y respaldo
permanecen en v8, y Ajustes en v4. La nube conserva la tabla y las operaciones protegidas
de lotes de piedras; una migración aditiva amplía únicamente su validación para aceptar
los campos nuevos y seguir admitiendo clientes anteriores a B2.

## D-061 · La vista USD convierte cada operación con su propia tasa · 2026-08-03 · Vigente

B3 reutiliza exclusivamente la fuente USD→COP que ya usa el precio del oro y sus mismos
límites de seguridad. Ajustes sube a v5 para conservar la última tasa válida, su fecha y
la lista administrable de tipos de producto. IndexedDB y el respaldo permanecen en v8;
no se agrega una API, una dependencia ni un permiso de red nuevos.

Cada venta de piedras, abono de comprador, venta de joya en stock y gasto nuevo guarda
su propia tasa. La tasa puede corregirse manualmente antes del primer guardado; después
queda fija para siempre. Esto también protege el estado histórico vacío: una operación
anterior con tasa `null` sigue mostrando **"Sin registrar"** y no puede completarse de
forma retroactiva. Una consulta que termina tarde no reemplaza una tasa que Santiago ya
escribió.

El interruptor COP/USD vive únicamente en la memoria de la pantalla. Los montos guardados
siguen siendo COP enteros y cambiar la vista no escribe datos. La conversión se hace por
operación; los totales, saldos y resultados que mezclan operaciones con tasas distintas
permanecen en COP para no presentar una suma engañosa en dólares.

Los tipos base y propios se guardan por organización. Desactivar un tipo solo impide
ofrecerlo en ventas nuevas: su nombre permanece visible en el historial. Las ventas
anteriores conservan `productType: ''` y muestran **"Sin registrar"**, sin deducirlo del
módulo donde fueron creadas.

Cada cambio real del catálogo guarda además su propia fecha. La operación protegida de
la nube combina los ajustes dentro de una transacción: conserva las claves B3 que un
cliente anterior no conoce, resuelve catálogo y tasa por sus fechas independientes,
une los nombres de catálogos concurrentes y nunca retrocede la versión de Ajustes. Así,
actualizar el oro o la tasa desde otro dispositivo no puede borrar un tipo personalizado.

## D-063 · La ganancia cuenta el día de la venta, no el día del pago · 2026-08-04 · Vigente

Santiago decidió que si vende un lote a crédito en agosto y le pagan en octubre, **la
ganancia es de agosto**. El panel debe responder *"¿qué tan bien vendí este mes?"*, y
un mes en que vendió muchísimo a crédito no puede aparecer vacío.

**Consecuencia central, y el mayor riesgo de la Fase E:** desde esta decisión
**ganancia y caja dejan de ser el mismo número**, y jamás deben presentarse como si lo
fueran.

- La **caja** es lo que se movió de verdad: es lo que muestran el Cierre del día y el
  del mes, y D-045 la sigue gobernando sin cambios.
- La **ganancia** es lo vendido menos lo que costó lo vendido, contado en la fecha de
  la venta.

Una compra de inventario **no es una pérdida**: es dinero que cambió de forma. Solo se
vuelve costo cuando eso que se compró se vende. Por eso un mes con una compra grande
puede tener caja muy negativa y ganancia positiva, y ambas cifras ser correctas.

Lo que aún no ha cobrado **no desaparece**: se muestra aparte como cobros pendientes,
que es lo que ya hace la sección de Cobros.

Implementación E0 (2026-08-04): el evento derivado del libro incorpora
`attributedCostCop` sin cambiar ninguna entidad guardada. La cotización aprobada
reconoce su costo base; la venta de una joya reconoce el costo total de la pieza; y la
venta de piedras reutiliza la regla por quilate de C2. El residuo de redondeo queda en
la última venta que agota el lote, de modo que nunca se atribuye más de lo invertido y
un lote vendido completo cierra exactamente. Abonos y demás eventos no vuelven a
atribuir ese costo, por lo que cobrar después no duplica la ganancia.

Implementación E1 (2026-08-04): el panel interno **Ventas y ganancias** permite
leer día, semana, mes o año. Presenta vendido, costo atribuido y ganancia en un
bloque; caja real en otro; y cobros pendientes en un tercero, con explicaciones
visibles para impedir que se mezclen. La vista USD suma únicamente operaciones con
tasa propia y avisa cuántas quedaron como **"Sin registrar"**; COP sigue siendo el
valor oficial.

## D-064 · Las sociedades se comparan por cuánto dejaron y por qué tan rentables fueron · 2026-08-04 · Vigente

Para decidir qué sociedad le conviene repetir, Santiago quiere **las dos medidas a la
vez**: la ganancia en pesos y el porcentaje sobre lo invertido.

Con una sola se decide mal. Una sociedad grande puede dejar más dinero y ser menos
rentable que una pequeña; el porcentaje solo, en cambio, hace ver enorme un negocio
diminuto que devolvió bien. Las dos juntas permiten distinguirlos.

El porcentaje se calcula sobre **lo invertido en esa sociedad** —compra más tallas
pagadas, conforme a D-055—, y siempre acompañado del monto, nunca solo. Cuando lo
invertido es cero, no se muestra un porcentaje inventado ni infinito: se indica que no
aplica.

Esta decisión materializa D-053 y la frase con la que Santiago resumió todo el plan:
*"todo lo que se puede medir, se puede optimizar"*.

Implementación E1 (2026-08-04): cada sociedad muestra la parte propia y la del socio
con su monto y su porcentaje sobre la inversión correspondiente. El reparto conserva
el residuo COP del lado propio, como en B2. Cuando la inversión es cero, la pantalla
indica **"No aplica"** en lugar de inventar un porcentaje.

Implementación E2 (2026-08-04): los cierres diario y mensual, y el panel de ventas,
añaden un CSV editable compatible con Excel en español. El archivo usa punto y coma,
BOM UTF-8 y saltos CRLF; los montos se escriben como números sin símbolo ni separador
de miles. El PDF se conserva. La descarga es local directa y no existe ruta hacia Web
Share ni WhatsApp. E3 reutiliza este mismo mecanismo para el consolidado filtrado.

Implementación E3 (2026-08-04): el **Consolidado de ventas** filtra cualquier período
por sociedad y tipo de producto, incluyendo una opción real **“Sin registrar”** para
encontrar datos anteriores incompletos. La comparación usa la parte de Santiago: una
tarjeta señala la mayor ganancia en COP y otra la mayor rentabilidad sobre su inversión;
las dos muestran monto y porcentaje juntos. El Excel conserva los filtros y el detalle
del resultado, y omite la caja porque no puede atribuirse honestamente a esos filtros.
Todo se deriva al consultar: no se agregó ningún campo guardado ni una decisión nueva.

## D-065 · El catálogo lleva precio solo si Santiago lo decide al generarlo · 2026-08-04 · Vigente

El catálogo se arma solo desde el inventario real y se entrega en PDF. Santiago decidió
que **el precio es opcional y se elige en cada generación**, no una configuración fija.

La razón es comercial: a un cliente de confianza le manda el catálogo con precios para
que decida solo; a un desconocido prefiere mandarlo sin precios y cotizar aparte según
el caso. Fijar la decisión de una vez lo encerraría en uno de los dos usos.

Cuando el catálogo se genera sin precios, **el precio no debe aparecer en ninguna parte
del archivo**, ni siquiera en un pie, un resumen o un total. Omitirlo de la vista pero
dejarlo en el documento sería peor que mostrarlo, porque nadie lo revisaría.

El costo, el margen, los socios, el reparto y las notas internas **nunca** aparecen, con
precios o sin ellos. Eso no es una opción configurable: es la regla de privacidad que
protege `src/services/pdfContent.test.ts` desde el primer día del proyecto.

Implementación F1 (2026-08-04): cada generación vuelve a preguntar si incluye precio.
Antes del PDF, las piezas disponibles se reducen campo por campo a `name`, `pieceType`,
`material`, `photo`, `weightGrams`, `size`, `stoneCount`, `stoneKind` y, únicamente si
la opción está activa, `priceCop`. `status` y `sale` solo se consultan para excluir
apartadas y vendidas y no llegan al documento. El contenido final pasa por el detector
sin posibilidad de continuar ante un hallazgo. No se agregó otra decisión: esta es la
ejecución literal de D-065.

## D-066 · El Excel se entrega con formato real, y por eso se acepta la primera dependencia · 2026-08-04 · Vigente

Santiago probó la exportación y **rechazó el resultado**: quería una hoja presentable y
recibió un archivo sin formato.

La causa no es corregible dentro del formato elegido. El archivo actual es un **CSV**,
que es texto plano: no admite negritas, colores, anchos de columna, formato de moneda ni
encabezados fijos. Mejorarlo "un poco" no es posible; o se cambia de formato o se queda
como está.

Desde esta decisión los cierres, el panel y el consolidado se exportan como un
**archivo Excel real (.xlsx)** con: dinero formateado como dinero, negativos en rojo,
anchos de columna calculados, encabezados fijos al desplazarse, secciones distinguibles
y totales resaltados. **Sigue siendo editable**, que era el motivo original de pedir
Excel en vez de PDF.

**Se acepta la primera dependencia de todo el proyecto**, conforme a la exigencia de
`AGENTS.md` de justificarla por escrito. Se evaluaron tres candidatas y se eligió
`write-excel-file` por ser la más liviana con diferencia (1,8 MB desempaquetada frente a
21,8 MB de `exceljs`), tener **una sola dependencia interna**, licencia MIT, mantenimiento
al día y estar pensada para el navegador. Se descartó `xlsx-js-style` por arrastrar diez
dependencias y derivar de una base con antecedentes de vulnerabilidades.

Condiciones de la aceptación, que forman parte de la decisión:

- **Carga diferida**, con el mismo patrón que ya usa Supabase: la herramienta solo se
  descarga cuando el dueño exporta, así la aplicación no se vuelve más pesada de abrir
  ni de instalar.
- **Versión exacta fijada**, sin rango.
- Sin cambios en la política de seguridad del navegador ni destinos de red nuevos.

Se consideró escribir el generador a mano para no depender de nadie. Se descartó por una
razón concreta: **ningún agente puede abrir Excel para comprobar el archivo**, y un
`.xlsx` mal formado se manifiesta como un aviso de archivo dañado. Con una librería
probada, la corrección del contenedor deja de ser responsabilidad nuestra.

Implementación C1 (2026-08-04): se fijó `write-excel-file` en **4.1.1**, sin rango, y
se carga únicamente al pulsar Descargar Excel. Instalada ocupa **1.812.264 bytes**; en
la compilación queda separada en dos archivos diferidos que suman **71.185 bytes**
minificados (**20,00 kB gzip**), por lo que no aumenta la descarga inicial ni la
precarga pública. No se cambió la CSP ni ningún destino de red. El archivo real se abrió
en Microsoft Excel sin reparación: fecha y dinero conservaron tipo numérico, la fila 6
quedó congelada y los anchos calculados se aplicaron. El PDF sigue separado e intacto.

## D-067 · Un lote se compra en bruto o ya tallado, y se elige al registrarlo · 2026-08-04 · Vigente

Santiago encontró que la aplicación **da por hecho que todo lote se compra en bruto**.
Comprar piedras ya talladas obligaba a inventar una tanda de talla con 0% de merma para
que las existencias cuadraran. Es un vacío del modelo de D-055, no un error de
implementación.

Desde esta decisión, al registrar la compra se elige si el lote entró **en bruto** o **ya
tallado**. Un lote comprado tallado entra directo a la existencia de talladas, no admite
tandas de talla y no muestra merma, porque no la tuvo.

Los lotes anteriores se normalizan como comprados **en bruto**, así que conservan
exactamente las mismas existencias, el mismo dinero y el mismo resultado que hoy.

Implementación C2 (2026-08-04): el formulario pregunta **En bruto / Ya tallado**. La
segunda opción lleva la compra directamente a existencias talladas, oculta tandas y
merma, y mantiene ventas, usos en joyas, crédito y reparto. La protección existe al
guardar en el dispositivo y también en la migración preparada para el servidor. El
campo es aditivo: si falta, significa bruto. No se cambió ningún dato existente ni se
aplicó la migración a producción.

## D-068 · Ningún registro queda fuera de alcance por un filtro · 2026-08-04 · Vigente

Santiago reportó que **no podía editar la venta de una joya**. La revisión mostró que la
función existía: el problema es que, al vender, la pieza sale del filtro "En vitrina"
—que es el que está puesto por defecto— y **desaparece de la vista**. Desde el lado del
dueño, una función que no se puede alcanzar es una función que no existe.

Desde esta decisión, **registrar algo nunca hace que ese algo se pierda de vista**. Tras
una venta, la aplicación deja visible la pieza recién vendida y ofrece llegar a ella, en
vez de devolver una lista vacía.

Además, las acciones sobre un registro —editar, deshacer, eliminar— **deben verse como
acciones**. Las de la ficha de joya se presentaban como texto sin borde ni fondo, lo que
para el dueño no se lee como algo que se pueda tocar.

Implementación C3 (2026-08-04): al guardar una venta, la búsqueda se limpia, el filtro
cambia a **Vendidas** y la pieza recién vendida recibe el foco. Así queda visible incluso
si era la última de la vitrina. Editar venta, Deshacer venta, Editar pieza y Eliminar
ahora tienen borde, fondo, jerarquía visual y altura táctil mínima. La fecha, el medio de
pago, el receptor y la tasa guardados siguen apareciendo al editar y conservan las
protecciones existentes.

La revisión pedida encontró el mismo riesgo en el Historial de cotizaciones: cambiar el
estado mientras hay un filtro específico puede sacar la cotización de la lista. Se
registró el hallazgo pero no se corrigió aquí, para no ampliar C3. Piedras conserva su
detalle abierto tras guardar y Cobros no usa filtros, por lo que no repiten este caso.

## D-069 · Un lote se puede borrar; su historia se conserva en la joya · 2026-08-04 · Vigente

Santiago no pudo eliminar un lote porque una de sus piedras estaba en una joya ya
vendida. El bloqueo pretendía proteger la historia, pero dejaba al dueño sin salida ante
un lote creado por error.

La protección resulta innecesaria: cuando una piedra pasa a una joya, **la joya guarda su
propio costo** (`jewel.costCop` se incrementa al transformar). Borrar el lote no cambia
ni un peso del costo, del resultado ni de ningún cierre.

Desde esta decisión, un lote **se puede eliminar** aunque respalde piedras usadas en
joyas. Al hacerlo:

- El aviso dice con claridad qué se pierde: la trazabilidad hacia ese lote.
- La joya **conserva el nombre histórico del lote** y su costo, exactamente como ya
  ocurre al borrar un proveedor, un comprador o un socio (D-043, D-049).
- **Ningún dinero cambia** en ninguna pantalla ni en ningún cierre.

Sigue vigente la protección que sí tiene sentido: no se pueden alterar los datos físicos
de una tanda ya regresada cuyo producto se vendió (Fase C). Proteger un dato es distinto
de impedir borrar un registro completo con aviso.

Implementación C4 (2026-08-04): antes de borrar el lote, la aplicación copia su nombre
en la historia de cada joya que usó una de sus piedras. La operación local y la operación
del servidor hacen ese resguardo y el borrado como una sola acción. Los respaldos y su
importación también aceptan esa historia independiente cuando el lote ya no existe.

El aviso confirma que se pierde la ficha del lote, no el dinero de la joya. Las pruebas
de no regresión verifican que permanecen idénticos el costo y el resultado de la joya,
el Cierre del día, el mensual y el panel. La migración del servidor queda preparada pero
no fue aplicada a ningún entorno.

## D-070 · Un solo vocabulario: la barra es el primer grupo de Inicio · 2026-08-04 · Vigente

Santiago reportó que la aplicación confunde. El diagnóstico no era la barra en sí: al
agregar la pantalla de inicio (D-052) quedaron **dos vocabularios para las mismas cosas**.
Inicio hablaba de acciones —Vender, Producir y atender, La plata— y la barra inferior de
lugares —Cotizador, Taller, Agenda—. Solo "Inventario" coincidía. Es un error de diseño de
Claude: la barra venía de antes de que existiera Inicio y nunca se revisó.

Desde esta decisión hay **un solo nombre por cada lugar**, y **el primer grupo de Inicio
es exactamente la barra inferior**: mismos nombres, mismo orden. Así la barra deja de
leerse como un segundo mapa y se lee como lo que es, un atajo a lo de todos los días.

La barra queda en **Inicio · Cotizador · Taller · Inventario · Dinero** — cinco botones,
D-046 respetado. "La plata" pasa a llamarse **Dinero** arriba y abajo; Santiago aprobó el
nombre.

**La Agenda sale de la barra** y pasa a "Otras cosas" dentro de Inicio. Preguntado qué usa
a diario, Santiago respondió cotizar, taller, inventario y la plata; la agenda no. No se
borra nada: sigue con sus citas y sigue alcanzable.

Los seis grupos de Inicio pasan a tres —lo de todos los días, tu gente y el resto—.
**Ninguna ruta desaparece:** todo lo que hoy se alcanza se sigue alcanzando.

**Aplicada en R2-1:** Inicio quedó en tres grupos y la barra replica literalmente el
primero. Dinero reúne Panel, Cierre del día, Cierre mensual, Consolidado y Gastos con el
mismo patrón de secciones de Inventario. Agenda conserva su aviso dentro de Inicio;
Ajustes conserva el paso a Cuenta cuando existe una cuenta en la nube. No cambió ningún
dato, cálculo ni ruta interna de cotizaciones o taller.

## D-071 · El inicio muestra una gráfica, con una sola medida a la vez · 2026-08-04 · Vigente

Santiago pidió que el inicio no muestre un número suelto sino una **gráfica** que pueda
recorrer por períodos, como la de una aplicación de inversiones: **1 día · 7 días ·
30 días · 1 año**.

Desde esta decisión el inicio muestra la cifra grande, cuánto cambió en el período y una
gráfica de área con esos cuatro rangos, que responde al tacto mostrando el valor de cada
punto.

**Dibuja una sola medida a la vez, con un interruptor entre Ganancia y Caja.** Nunca las
dos superpuestas, por dos razones:

1. **Medida, no opinada:** los dos colores de la identidad —el verde esmeralda y el
   latón— se validaron con un simulador de daltonismo y quedan a ΔE 4.5 en protanopía y
   15.0 en visión normal, por debajo del mínimo legible. Dos líneas con esos colores serían
   indistinguibles para mucha gente.
2. **Ganancia y caja son cifras distintas** (D-063). Superponerlas invita justo a la
   confusión que el plan v2 evitó en todas sus fases.

Colores validados para la serie única: **`#0b7f57`** en claro y **`#2fa87a`** en oscuro,
ambos aprobados en banda de luminosidad, croma y contraste contra su superficie.

**Se conserva la promesa de D-052:** con **Caja** seleccionada y el mes como período, la
cifra debe ser **exactamente** la del Cierre mensual, y así debe decirlo la pantalla.

La gráfica **lee del libro del negocio** (D-057) y no calcula por su cuenta. Se dibuja con
SVG propio: **sin librería de gráficas ni dependencia nueva**.

**Aplicada en R2-2:** Inicio construye el libro después del primer pintado y reutiliza
ese mismo libro al cambiar período o medida. Caja conserva los movimientos realmente
cobrados y Ganancia reconoce cada venta en su fecha, sin confundir ambas cifras. El
período “30 días” representa el mes calendario para mantener exactamente el mismo valor
del Cierre mensual. La gráfica admite arrastre táctil, mantiene el globo dentro de sus
bordes y muestra estados claros cuando no hay datos o solo hay un día. La serie usa
`#0b7f57` en claro y `#2fa87a` en oscuro, sin animación ni dependencia nueva.

---

## D-072 · El negocio tiene dos figuras distintas: fondo de inversión y socio de igualdad · 2026-08-05 · Vigente

Al pedir Santiago varios socios por lote apareció, al preguntarle qué significaba "plata
pendiente", una figura que **no estaba en ningún documento del proyecto**: amigos y conocidos
que le entregan dinero esperando un rendimiento a plazo. Sus palabras: *"al fondo de
inversión le devuelvo su plata más sus rendimientos pase lo que pase, pero si estoy yendo en
condiciones de igualdad con otro socio […] asumimos ganancias o pérdidas."*

Desde esta decisión la aplicación distingue **dos relaciones que no se pueden mezclar**:

- **Fondo de inversión** — le prestan al negocio. Cobran capital más el rendimiento pactado
  aunque el lote pierda. Contablemente es un **pasivo**.
- **Socio de igualdad** — entra al lote. Gana o pierde en proporción a lo que puso.
  Contablemente es **patrimonio**.

**Consecuencia que gobierna todo el modelo: la plata del fondo NO diluye el reparto entre
socios de igualdad.** Financia la compra; su costo es el rendimiento pactado, no una parte
de la ganancia.

Se rechazó tratarlo todo como una sola figura con porcentajes: habría hecho que un préstamo
con rendimiento fijo apareciera perdiendo dinero cuando un lote sale mal, que es exactamente
lo contrario de lo pactado.

## D-073 · La participación se declara en plata puesta, no en porcentaje · 2026-08-05 · Vigente

Con varios socios en un lote hay dos formas de decir cuánto le toca a cada uno: el porcentaje
o la plata que puso. **Se elige la plata puesta** y el porcentaje se DERIVA para mostrarlo.

Razones, en orden:

1. **Es como ocurre el trato.** Nadie dice "entro con el 30%": dice "pongo tres millones".
2. **No hay que cuadrar a 100.** El usuario no puede equivocarse sumando.
3. **No hay centavos sueltos.** Tres partes iguales en porcentaje dejan residuo; en plata,
   no. Encaja con la regla de COP enteros de AGENTS.md.

Coherente con D-049, donde el material ya se guarda en **gramos** y el porcentaje se deriva:
la aplicación ya prefiere la cantidad exacta al porcentaje.

Los lotes que existen hoy guardan `myPercent`. **Santiago depuró los datos de la aplicación
el 2026-08-05** —*"no te preocupes por mover información que ya esté"*—, así que no hace
falta una conversión exacta al peso ni la prueba de que ninguna cifra se mueve. Se mantiene
solo la robustez básica: un registro viejo con `myPercent` y sin `partners` se lee como un
único socio con esa proporción, sin romperse.

## D-074 · El fondo es un bolsillo común, y por eso resulta simple · 2026-08-05 · Vigente

Santiago eligió que la plata del fondo **no quede amarrada a un lote**: entra a un bolsillo
común del que se compra.

En un fondo donde el rendimiento dependiera del resultado esto sería lo caro del proyecto:
obligaría a repartir utilidades entre quienes entran y salen en fechas distintas —unidades,
valor de la unidad, cortes—. **Aquí no hace falta**, porque se paga pase lo que pase (D-072).

Cada aporte se lleva como un préstamo independiente: capital, fecha, trato pactado y pagos.
El "bolsillo" es solo **cuánta plata hay disponible para comprar**: un saldo de caja, no un
problema de reparto. El rendimiento se pacta **distinto con cada persona** —porcentaje
mensual o cifra fija a plazo—, porque así ocurre en la realidad.

Un mismo lote **puede mezclar** plata del fondo, de socios de igualdad y propia.

**Resuelto el mismo día:** cuando un lote lleva plata del fondo y además un socio de
igualdad, el rendimiento del fondo es **costo personal de Santiago**, no del lote. Detalle y
consecuencias en D-075.

## D-075 · El financiamiento del fondo lo paga Santiago, no el lote · 2026-08-05 · Vigente

Cuando un lote se compra mezclando plata del fondo con la de un socio de igualdad, había dos
lecturas posibles del rendimiento que se le debe al fondo: tratarlo como un **costo del
lote** —igual que el corte, descontado antes de repartir— o como un **costo personal** de
Santiago. Él eligió lo segundo.

**El socio de igualdad reparte sobre la ganancia sin descontar el financiamiento.** Recibe su
proporción como si el lote se hubiera comprado sin préstamo. El rendimiento del fondo se
descuenta después, y **solo de la parte de Santiago**.

Consecuencia que hay que proteger con pruebas: **la parte de Santiago puede quedar por debajo
de su proporción, e incluso en negativo, mientras el socio sigue en positivo.** Eso es
correcto y la aplicación debe poder mostrarlo así. Él tomó el riesgo de conseguir el dinero;
el socio no. Ninguna revisión futura debe "corregirlo".

Coherente con D-072: la plata del fondo nunca entra al reparto de patrimonio. La proporción
del socio se calcula sobre lo propio más los socios, excluyendo siempre la plata prestada.

## D-076 · El fondo no es un saldo: es un grupo de personas con nombre · 2026-08-05 · Vigente

Santiago lo pidió expresamente: *"no lo tratemos como un único fondo, sino podamos
diferenciar qué personas integran ese fondo […] las personas que integren ese fondo van a
cambiar, y necesito poder editarlas y trackearlas, hacer un seguimiento muy riguroso."*

**En ninguna parte de la aplicación existe "el saldo del fondo" como cifra guardada.** Lo que
existe es una lista de aportes, cada uno con su persona. El total disponible se DERIVA de
sumarlos, nunca es un contador propio — misma regla que las existencias de material (D-023).

De ahí tres obligaciones:

1. **Quién entra y quién sale queda registrado con su fecha.** Un aporte devuelto por
   completo no se borra: queda cerrado y su historia sigue visible.
2. **Todo aporte es editable y todo cambio deja rastro.** La composición del grupo cambia con
   el tiempo y él necesita reconstruir cómo estaba en cualquier momento.
3. **La pantalla del fondo se lee por persona.** El total va al pie, no al encabezado.

## D-077 · Socios y Fondo se sincronizan como historia completa y aislada · 2026-08-10 · Vigente

La Etapa 9 lleva a la nube las decisiones D-072–D-076 sin cambiar su significado. Cada
aporte del Fondo viaja como un registro independiente y cada lote o gasto conserva dentro
de su historia la lista completa de socios. No se crea un saldo compartido ni una tabla de
porcentajes.

El navegador **nunca elige la joyería** al guardar o borrar. La función protegida obtiene la
organización desde la sesión. La lectura se limita por organización y la escritura directa
permanece cerrada.

Los aportes que ya existían localmente antes de la Etapa 9 se conservan y se preparan para
subir una sola vez. Si la nube tiene una versión más reciente del mismo aporte, gana esa
versión; ante una ausencia o duda, el dato local no se elimina.

Renombrar una persona actualiza todos sus vínculos —Piedras, Material, Gastos y Fondo—. Si
se borra su ficha, la historia no se borra: permanecen el nombre, los montos, los gramos, los
pagos y los rendimientos, y solo se suelta el identificador de la ficha.

La base valida las reglas en el límite común de las tablas, además de las pantallas: COP
entero y seguro, socios no repetidos, suma dentro del total, gramos con máximo tres
decimales y pagos del Fondo completos y no repetidos.

**Estado de aplicación:** preparada y verificada localmente en `codex/fase2-nube`. No se
considera aplicada al servidor hasta ejecutar la migración completa, comprobar su contenido
y aprobar N6 entre dos cuentas. Producción requiere autorización separada de Santiago.

## D-078 · Una joya se muestra con hasta tres fotos, y la primera manda · 2026-08-14 · Vigente

Un usuario de prueba señaló que la sección de Joyas solo acepta una foto. Tiene razón:
una pieza no se vende con una imagen. Santiago decidió **tres fotos por joya**: la pieza
completa, el detalle y la puesta.

Tres y no cuatro —el número que ya usan las cotizaciones— porque cada foto viaja dentro de
la joya como texto incrustado: se guarda en el teléfono, se sincroniza con la nube y se
incrusta en el catálogo que se manda por WhatsApp. La cuarta foto agregaría peso a los tres
sitios sin agregar nada que un cliente necesite ver.

**La primera foto es la principal** y es la única que la aplicación garantiza que existe.
Es la que se ve en la lista de joyas y la que sale grande en el catálogo; las otras dos
acompañan. Quitar la principal asciende a la siguiente: una joya nunca queda con fotos
secundarias y sin principal.

**Implementación (2026-08-14):** el campo `photo` conserva su significado exacto y se suma
`extraPhotos: string[]`, con tope de dos. No es la forma más elegante —`photos: string[]`
lo sería—, y esa fue la razón para descartarla: mientras algún dispositivo siga con la
versión anterior de la aplicación, ese dispositivo no entendería `photos` y devolvería la
joya **sin foto alguna** al guardarla. Con esta forma, el peor caso de esa ventana es
perder las dos secundarias, y las joyas que ya existen no requieren migración de ningún
tipo. Las fotos secundarias se comprimen a 700 px en vez de 1000: se imprimen a 29 mm y no
necesitan más. No hubo migración SQL: las joyas viajan como `jsonb` y los validadores del
servidor comprueban campos concretos, no una lista cerrada de claves.

## D-079 · El catálogo tiene documento propio, y deja de compartir plantilla con las cotizaciones · 2026-08-14 · Vigente

El mismo usuario dijo que el catálogo se ve genérico. No era una impresión: `createCatalogPdfFile`
dibujaba con `renderPdf`, el motor de las cotizaciones. De ahí venía todo lo que se veía
mal —la foto de 46 mm, los seis renglones de etiqueta y valor por pieza, y un recuadro
verde de totales que en una cotización es la cuenta a pagar y en un catálogo parece una
cuenta de cobro—.

Santiago eligió, sobre maqueta, el formato **ficha grande: dos piezas por página**, con
portada y contraportada. Los formatos de página completa y cuadrícula quedaron como opción
futura, sin construir.

**Las decisiones de diseño que hacen la diferencia**, todas medidas y no opinables: la foto
principal pasa de 46 a 76 mm y se **recorta cuadrada**, para que ninguna página quede
despareja; los datos técnicos pasan de seis renglones a una línea (`Oro 18K · 4,2 g ·
Talla 7`); el nombre de la pieza y el precio usan letra con serifa; los márgenes pasan de
16 a 20 mm; el verde y el dorado quedan solo en filetes; y desaparece el recuadro de
totales.

**Regla nueva de honestidad: lo que no se sabe, no se escribe.** Hasta hoy una joya sin
peso registrado le imprimía **"Sin registrar"** al cliente. En un catálogo eso es un dato
faltante puesto en la vitrina. Los datos ausentes se omiten; un precio en cero no se
imprime aunque el catálogo lleve precios.

**El catálogo no lleva NIT.** La auditoría de la Fase F había dejado anotado, sin pedir
cambio, que el catálogo identificaba públicamente al negocio con su número tributario.
Santiago cerró el punto el 2026-08-14: un catálogo es una pieza comercial, no un documento
tributario, y ese número no tiene por qué circular por WhatsApp entre desconocidos. Quedan
dirección y ciudad, teléfonos y correo. **El PDF de cotización sí conserva su NIT**: ahí
identifica una operación concreta con un cliente conocido, y esa diferencia entre los dos
documentos es deliberada.

Lo que **no** cambia, porque es lo que protege a Santiago: la lista blanca de D-065 sigue
siendo la única forma de armar el documento, el constructor sigue recibiendo
`CatalogJewel[]` y nunca `StockJewel[]` —la garantía la impone el compilador, no la
disciplina—, y el detector de palabras sensibles sigue corriendo sobre el texto final sin
posibilidad de continuar ante un hallazgo. El PDF de cotización y el Cierre del día
conservan `renderPdf` intacto.

## D-080 · Cada pieza del catálogo lleva un número que solo vive en ese archivo · 2026-08-14 · Vigente

El catálogo se manda por WhatsApp y el cliente responde por ahí mismo. Sin un número, esa
respuesta es *"me interesa el anillo verde, el de la tercera foto"*. Con número es
*"me interesa la 07"*.

El número es la posición dentro del catálogo generado —`01`, `02`, `03`…—, **se calcula al
armar el archivo y no se guarda en ninguna parte**. Por eso dos catálogos distintos pueden
numerar la misma joya de forma distinta, y está bien: es un número de referencia de esa
conversación, no un código de inventario.

**Nunca se usa el identificador interno de la joya.** Es un dato del sistema y no tiene por
qué salir hacia un cliente; hay una prueba que falla si aparece en el documento.
