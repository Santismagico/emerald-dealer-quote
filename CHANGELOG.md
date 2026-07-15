# CHANGELOG

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/). Versionado semántico.

## [Unreleased] — 2026-07-14

### Ecosistema: Agenda de asesorías (Etapa 7)

- Nueva pestaña **Agenda**: registro interno de asesorías con fecha, hora opcional, duración, motivo, notas y vínculo opcional a un cliente registrado. El cliente sigue contactando por WhatsApp; nada se publica ni se sincroniza.
- Aviso local de citas de hoy: banner "Hoy tienes N citas" y globito numérico en la pestaña, solo con las programadas del día. Sin notificaciones push ni permisos del sistema.
- Filtros Próximas / Pasadas / Todas con conteos, búsqueda por nombre o motivo, y cambio de estado tocando la etiqueta (programada, cumplida, cancelada, no asistió).
- Primera migración versionada de la base local (v1→v2) con escalera idempotente: los datos existentes se conservan intactos y la escalera queda lista para las próximas etapas.
- Respaldo v3: incluye las citas y acepta respaldos v1/v2 antiguos (restauran con agenda vacía). La restauración atómica cubre los 4 almacenes con rollback completo.
- El recordatorio semanal de respaldo ahora también considera las citas como datos que merecen protección.

### Ecosistema: Taller como área propia (Etapa 6)

- Nueva navegación inferior con tres pestañas: **Cotizador**, **Taller** y **Más** (Clientes y Ajustes). Crear una cotización sigue disponible con el botón del historial.
- Nueva pestaña **Taller**: lista los trabajos (cotizaciones aprobadas) con su avance de etapas, barra de progreso y saldo pendiente; permite buscar y filtrar entre "En taller" y "Listos".
- Nueva pantalla de trabajo: producción y abonos de cada pieza fuera del flujo de cotización, con el mismo guardado diferido, serializado y con reintento de siempre, y acceso directo a la cotización original.
- La vista interna de la cotización ya no muestra los paneles de producción y abonos: presenta un resumen del trabajo (etapas listas, abonado, saldo) y el botón "Abrir en el Taller". Los abonos se registran en el Taller.
- Cambiar el estado tocando la etiqueta en el historial: menú con borrador, pendiente, aprobada y rechazada, sin entrar a la cotización. "Vencida" sigue calculándose sola por fecha.
- Aprobar una cotización desde cualquier lugar (historial o vista previa) crea las etapas estándar del taller si aún no existen.

### Consolidación Etapa 5.5

- La salida al cliente queda bloqueada cuando el contenido final detecta información interna. Ya no existe una confirmación que permita generar o compartir el PDF cliente ni abrir WhatsApp bajo riesgo.
- El detector cubre también expresiones como “precio material por gramo”, “precio del material por gramo” y “valor del oro por gramo”, que antes podían atravesar la revisión textual.
- El consecutivo, el recordatorio de respaldo y el precio del oro actualizan el registro de Ajustes sin pisarse cuando coinciden dos acciones. Dos cotizaciones simultáneas no pueden recibir el mismo número; una consulta del oro aplica siempre el recargo más reciente y un formulario atrasado no restaura un precio anterior.
- La documentación se alinea con el respaldo v2 compatible con v1/v2, Web Share, los 16 archivos de pruebas y el funcionamiento real de publicación, CSP y actualización del oro.

### Compartir PDF

- Nueva acción **Compartir PDF** en la vista previa: prepara un único archivo `application/pdf` con nombre seguro, guarda y numera primero la cotización y abre el selector nativo del dispositivo cuando Web Share API nivel 2 acepta archivos.
- El selector recibe únicamente el PDF cliente. El PDF interno y el respaldo JSON no forman parte de esta acción. La descarga tradicional y el archivo compartido usan el mismo generador y el mismo contenido cliente.
- Si el dispositivo no permite compartir archivos, el mismo PDF se descarga para adjuntarlo manualmente. La app no abre WhatsApp después del fallback y mantiene separado el botón actual de WhatsApp con texto.
- Cancelar el selector nativo no muestra una alarma ni inicia una descarga. Los errores inesperados no se presentan como éxito y conservan la descarga manual disponible.
- El detector de información sensible se ejecuta antes de guardar, numerar, generar o compartir. Un doble toque no puede abrir dos selectores ni producir dos descargas.

### Respaldo

- **Recordatorio semanal local:** cuando existen clientes o cotizaciones, un banner discreto invita a exportar el respaldo después de siete días sin una exportación confirmada. Puede posponerse por 24 horas.
- El aviso no usa notificaciones, servidores, correo ni WhatsApp; tampoco exporta ni sube información automáticamente.
- El botón del banner y el de Ajustes usan la misma exportación JSON compatible. Solo después de iniciar la descarga se registra la fecha y se oculta el aviso.
- Los respaldos con fechas antiguas o incompletas siguen siendo compatibles. Una referencia local única evita que datos viejos sin fecha válida muestren el aviso repetidamente al abrir la aplicación.

### Integridad de datos

- Las actualizaciones parciales de Ajustes se realizan como una sola operación local: el consecutivo, el precio del oro y las fechas del recordatorio conservan siempre los cambios más recientes.
- **Restauración de respaldo atómica:** ajustes, clientes y cotizaciones se reemplazan dentro de una única transacción local. Si falla cualquier borrado o escritura, se revierte todo y permanecen completos los datos anteriores.
- El respaldo se valida y normaliza por completo antes de iniciar la escritura. La confirmación de éxito ocurre únicamente después del commit real; la recarga de la pantalla sucede después de esa confirmación.
- Los clientes se normalizan al leer y guardar: campos antiguos o corruptos reciben valores seguros, claves desconocidas se descartan y el orden alfabético se conserva.
- La exportación usa las lecturas normalizadas. Los respaldos v1 y v2 continúan siendo compatibles; si un respaldo antiguo no contiene ajustes, se restauran los valores por defecto en vez de mezclar ajustes anteriores.
- La pantalla de Ajustes conserva un solo respaldo validado, bloquea una doble confirmación mientras restaura y sincroniza el formulario para que valores anteriores no sobrescriban lo recién importado.

### Guardado interno

- **Producción y abonos sin escrituras por tecla:** la pantalla cambia inmediatamente, pero los campos de texto y dinero esperan 650 ms de inactividad antes de guardar.
- Perder el foco, contraer o cambiar una tarjeta, cambiar de pestaña, volver al historial, abrir la edición general o usar la navegación inferior fuerza el guardado pendiente antes de continuar.
- Estados, fechas, interruptores, altas y eliminaciones se guardan inmediatamente. Todos los cambios se combinan sobre la versión local más reciente para que producción y abonos no se pisen.
- Solo existe una escritura activa por cotización. Si llega otra edición mientras se guarda, se persiste después únicamente la última versión disponible.
- Si IndexedDB falla, el dato permanece en pantalla, se muestra una advertencia y aparece la opción **Reintentar**. “Guardado” se muestra únicamente cuando la transacción local terminó realmente.

### Historial

- **Cotizaciones vencidas como estado derivado:** los borradores y pendientes con fecha anterior al día actual se muestran y filtran como vencidos, sin cambiar el estado guardado ni `updatedAt`.
- Las insignias, filtros y conteos del historial usan la misma regla. La búsqueda conserva esos conteos de forma coherente.
- Las cotizaciones aprobadas, rechazadas, ya vencidas o con otros estados no cambian automáticamente. Las fechas vacías o inválidas se tratan de forma segura.
- Abrir, editar y duplicar sigue usando la cotización original. Al duplicar se conserva el flujo existente: la copia nace como borrador con fechas nuevas.

### Seguridad

- **Detector de información sensible completado:** antes de generar el PDF cliente se analiza el texto final completo del documento; antes de abrir WhatsApp se analiza el mensaje exacto que se compartirá. Material, marca, contacto, cliente, piedras, condiciones y mensaje comercial ya no quedan fuera por usar una lista manual de campos.
- Detección sin distinguir mayúsculas ni tildes para costos, margen, utilidad, ganancia, rentabilidad, precio por gramo, `$/g`, pureza 18K/24K, fórmula, texto confidencial/interno y `markup`, con variantes comunes y límites de palabra para evitar alertas como “valor total” o “pieza costosa”.
- Si el detector encuentra información interna, la acción se bloquea hasta que el contenido se corrija. No existe una opción para continuar bajo riesgo. El PDF interno y la vista interna no cambian.

### Pruebas

- Antes de iniciar la consolidación, la Etapa 5 cerró con 283 pruebas automáticas en verde distribuidas en 16 archivos y con el build completado sin errores.
- La consolidación de la Etapa 5.5 cerró con **294 pruebas aprobadas en 16 archivos** y con el build de producción completado sin errores.

## [0.5.0] — 2026-07-09

Auditoría de seguridad y calidad (8 ángulos de revisión + verificación). Ver DECISIONS.md D-010.

### Seguridad

- **Normalización central de datos** (`services/schema.ts`): todo dato que entra (base local de versiones viejas, respaldos importados, futura nube) se corrige a la forma actual. Un respaldo corrupto o editado ya no puede dejar la app en pantalla blanca.
- **Imágenes**: solo se aceptan imágenes generadas por la app (data URLs); URLs externas en respaldos se descartan (evita rastreo de cuándo se abre una cotización).
- **Content-Security-Policy** en producción: permite conexiones al propio origen y a las dos APIs del precio del oro; scripts externos e inyectados quedan bloqueados (mitiga dependencias comprometidas).
- **Límites de sanidad del precio del oro**: valores absurdos de las APIs (fuera de rangos razonables) se rechazan en vez de convertirse en cotizaciones con pérdida.
- Respaldo formato v2 con importación normalizada (acepta v1 y v2); settings con versionado de esquema para migraciones futuras.

### Corregido

- Compartir por WhatsApp abría la app fuera de sí misma (window.open con 'noopener' devuelve null por especificación); ahora abre una sola vez y sin perder la app.
- Dos carreras que podían revertir cambios guardados en Ajustes (actualización del oro en segundo plano vs. guardado del formulario).
- El pie multilínea del PDF podía imprimirse sobre el contenido; ahora la paginación reserva su espacio real.
- Fijos colombianos (60x) mal enrutados en WhatsApp (iban a Malasia); ceros iniciales ignorados.
- Cotizaciones aprobadas por versiones anteriores ahora pueden crear sus etapas estándar con un botón.
- El aviso de "aplicar precio del oro del día" solo aparece en borradores (no repreciar cotizaciones ya enviadas por accidente).
- La pantalla de "no se pudo cargar" ya no salta en redes lentas si la app sí está cargando.

### Rendimiento y mantenimiento

- Guardar producción/abonos ya no recarga todas las cotizaciones (con fotos) desde la base local en cada tecla.
- Helpers compartidos: `toSafeCOP`, `patchById`, `SummaryRow` (elimina código triplicado entre paneles).
- 3 botones nuevos elevados al mínimo táctil de 44px.
- 101 pruebas automáticas (26 nuevas).

## [0.4.0] — 2026-07-09

### Agregado

- **Abonos recibidos del cliente** (vista interna): registro de cada pago que entra — cuánto, cuándo, quién lo recibió, medio de pago y nota — con total abonado y saldo real pendiente. Aparece en el PDF interno; jamás en el PDF ni WhatsApp del cliente (tests de privacidad ampliados).
- **Acceso directo a producción**: en el historial, las cotizaciones aprobadas muestran un botón "🛠 Producción: X/N etapas listas" que abre directamente la vista interna del taller (antes había que descubrir la pestaña Interna).
- Protecciones para Android/navegadores internos: aviso cuando la app se abre dentro de WhatsApp/Instagram (con botón para copiar el enlace y abrirlo en Chrome), pantalla de instrucciones si la app no logra cargar (en vez de pantalla en blanco), y número de versión visible en Ajustes para diagnóstico.

### Corregido

- Ediciones rápidas consecutivas en producción/abonos ya no se pisan entre sí (la pantalla se actualiza antes de esperar la base de datos).

## [0.3.0] — 2026-07-08

### Agregado

- **Seguimiento de producción del taller** (solo vista interna, definido con Santiago): al aprobar una cotización se crean las etapas estándar (Diseño → Impresión cera/3D → Fundición → Armado y engaste → Pulido → Entrega), cada una con estado (pendiente / en proceso / lista con fecha automática) y control de pago (cuánto, cuándo, a quién se le pagó y quién pagó). Etapas editables por pieza. Resumen de gasto real (total, pagado, por pagar) y utilidad estimada (cotizado − gastos registrados). Aparece en el PDF interno y en el historial (avance X/N); jamás en el PDF ni WhatsApp del cliente (tests de privacidad ampliados).

### Corregido

- Botón de WhatsApp: los celulares colombianos de 10 dígitos reciben el prefijo internacional 57 (sin él, wa.me no abría el chat) y la apertura usa navegación directa cuando el navegador bloquea la ventana emergente (Safari/iOS).

## [0.2.1] — 2026-07-08

### Agregado

- Nuevo mensaje comercial por defecto (PDF y vista del cliente): resalta el carácter emblemático de lujo de la joya y la dedicación artesanal de su fabricación. Editable en Ajustes. Migración suave: solo se aplica si el usuario no había personalizado el mensaje anterior.
- El pie del PDF ahora ajusta mensajes largos en varias líneas sin deformarse.

## [0.2.0] — 2026-07-08

### Agregado

- **Precio del oro automático**: al abrir la app con internet consulta el precio internacional 24K del día (gold-api.com) y la tasa USD→COP (open.er-api.com), y fija el precio interno como internacional + recargo por gramo (por defecto $100.000, configurable). Botón "Actualizar precio ahora" en Ajustes con fecha de última actualización. Sin conexión se conserva el último precio y hay campo manual de respaldo. Cálculo puro con tests (75 en total).
- En el formulario de cotización, aviso con un toque para aplicar el precio del oro del día si difiere del de la cotización.
- Despliegue automático a GitHub Pages: https://santismagico.github.io/emerald-dealer-quote/

## [0.1.0] — 2026-07-07

Primera versión funcional (MVP local, sin backend).

### Agregado

- Motor de cálculo puro en COP enteros: material, piedras (por piedra/por quilate), mano de obra, costos adicionales, margen interno, descuento (%/fijo), impuesto opcional, anticipo y saldo. Con validaciones y tests.
- Formulario de cotización en 4 pasos (Cliente, Pieza, Piedras, Costos) con total en vivo, imágenes comprimidas y validación con mensajes humanos.
- Gestión de clientes (crear, editar, eliminar con confirmación).
- Historial: búsqueda por cliente/número, filtro por estado, editar, duplicar, cambiar estado, aviso de vencidas.
- Vista previa doble: cliente (presentable) e interna (confidencial con desglose y margen).
- PDF del cliente con jsPDF (logo, contacto, piedras comerciales, total, vigencia, condiciones) **sin información sensible** — garantizado por tests.
- PDF interno rotulado "NO ENTREGAR AL CLIENTE" con estructura de costos y auditoría.
- Compartir por WhatsApp (mensaje profesional sin datos internos).
- Persistencia local en IndexedDB; respaldo exportable/importable en JSON con validación y advertencia de reemplazo.
- PWA instalable: manifest "Emerald Dealer Quote", iconos generados por script propio, service worker con precache (offline básico).
- Configuración de joyería: marca (default Emerald Dealer), logo, contacto, condiciones, validez, precio interno del oro, margen e impuesto por defecto.
- Documentación completa: README, AGENTS, PRODUCT_SPEC, ARCHITECTURE, ROADMAP, TEST_PLAN, SECURITY_CHECKLIST, DECISIONS, WEEKLY_PROGRESS.
