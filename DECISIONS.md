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
