# CHANGELOG

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/). Versionado semántico.

## [Unreleased] — 2026-07-11

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
- El aviso permite cancelar y ahora exige una confirmación explícita del posible riesgo antes de continuar. El PDF interno y la vista interna no cambian.

### Pruebas

- 207 pruebas automáticas en verde. La Etapa 3 agrega 26 pruebas para reducción de escrituras, última versión, blur/flush, navegación protegida, altas y eliminaciones, cambios importantes, concurrencia, errores, reintento, numeración, privacidad, cálculo, inmutabilidad, timers y confirmación real de IndexedDB.
- Build de producción y comprobación TypeScript completados sin errores.

## [0.5.0] — 2026-07-09

Auditoría de seguridad y calidad (8 ángulos de revisión + verificación). Ver DECISIONS.md D-010.

### Seguridad

- **Normalización central de datos** (`services/schema.ts`): todo dato que entra (base local de versiones viejas, respaldos importados, futura nube) se corrige a la forma actual. Un respaldo corrupto o editado ya no puede dejar la app en pantalla blanca.
- **Imágenes**: solo se aceptan imágenes generadas por la app (data URLs); URLs externas en respaldos se descartan (evita rastreo de cuándo se abre una cotización).
- **Content-Security-Policy** en producción: solo se permite red hacia las dos APIs del precio del oro; scripts externos e inyectados quedan bloqueados (mitiga dependencias comprometidas).
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
