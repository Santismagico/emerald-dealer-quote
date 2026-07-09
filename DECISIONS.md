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

Riesgo aceptado: dependencia de dos APIs gratuitas de terceros. Si alguna falla, la app avisa y usa el último valor guardado; cambiar de proveedor solo toca `goldPrice.ts`.

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

## D-008 · WhatsApp vía enlace wa.me con texto · 2026-07-07 · Vigente

El PDF no puede adjuntarse automáticamente por URL de WhatsApp; el flujo es: descargar PDF + mensaje con resumen y total. Adjuntar vía Web Share API queda en ROADMAP v0.2.

## D-009 · Nodo instalado con winget · 2026-07-07 · Vigente

El equipo no tenía Node.js. Se instaló OpenJS.NodeJS.LTS 24.18.0 vía winget para poder construir el proyecto.
