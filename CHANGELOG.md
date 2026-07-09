# CHANGELOG

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/). Versionado semántico.

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
