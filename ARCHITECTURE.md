# ARCHITECTURE — Emerald Dealer Quote

## Visión general

SPA React + TypeScript compilada con Vite, instalable como PWA. **Sin backend**: toda la persistencia es local (IndexedDB). El motor de cálculo y los generadores de contenido de PDF son funciones puras, testeables sin navegador.

```
┌─ UI (React, mobile-first) ─────────────────────────┐
│ App.tsx (navegación por estado, sin router)        │
│ HistoryView · QuoteFormView · PreviewView          │
│ ClientsView · SettingsView · ui.tsx (primitivas)   │
└──────────────┬─────────────────────────────────────┘
               │ store.tsx (Context: settings/clients/quotes)
┌──────────────┴─────────────────────────────────────┐
│ services/                                          │
│  storage.ts  → CRUD dominio                        │
│  db.ts       → wrapper IndexedDB (promesas)        │
│  backup.ts   → export/import JSON v2 (acepta v1/v2)│
│  pdfContent.ts → contenido PURO (testeable)        │
│  pdf.ts      → render jsPDF (cliente e interno)    │
│  pdfShare.ts → Web Share + descarga segura         │
│  whatsapp.ts → mensaje + enlace wa.me              │
├────────────────────────────────────────────────────┤
│ calc/engine.ts → motor de cálculo puro (tests)     │
│ utils/ → money, dates, images, id                  │
│ types/ → modelo de datos                           │
└────────────────────────────────────────────────────┘
```

## Decisiones clave (detalle en DECISIONS.md)

- **IndexedDB** en vez de localStorage: las cotizaciones llevan imágenes (data URLs) y localStorage se queda corto (~5 MB). Wrapper propio, sin dependencia adicional.
- **jsPDF** para PDF: estable, 100% offline en el navegador, sin servidor.
- **Sin router**: 5 vistas manejadas con estado en `App.tsx`. Menos dependencias, menos superficie de error.
- **Separación privacidad**: `pdfContent.ts` construye el contenido como datos puros; los tests verifican que la versión cliente no contenga palabras sensibles. PDF cliente, Web Share y WhatsApp bloquean la salida si el detector encuentra información interna; no existe una opción para saltar esta protección. `pdf.ts` solo pinta.
- **Snapshot de cliente**: cada cotización guarda una copia de los datos del cliente (`clientSnapshot`) para que editar/borrar un cliente no altere cotizaciones históricas.
- **Número de cotización** (`ED-AAAA-0001`): se asigna al guardar por primera vez, con consecutivo en Ajustes y actualización atómica para impedir duplicados entre acciones simultáneas.

## Modelo de datos (IndexedDB `emerald-dealer-quote`, v1)

- `settings` — un solo registro (`id: 'main'`) con datos de la joyería y reglas internas.
- `clients` — clientes por `id`.
- `quotes` — cotizaciones por `id`, con piedras, costos e imágenes embebidas.

## Migración futura a SaaS multiempresa

**No implementado. No fingido.** Camino documentado:

1. **Backend** (p. ej. Postgres + API): tablas `organizations`, `users`, `memberships` (rol: owner/admin/seller), `clients`, `quotes`, `subscriptions`, `plans`.
2. **Aislamiento**: toda tabla de datos lleva `organization_id NOT NULL`; toda consulta filtra por él (idealmente con Row Level Security). La autorización se valida **en el backend**, nunca solo en frontend.
3. **Migración de datos locales**: el formato actual de respaldo JSON es v2 y el importador acepta v1 y v2. Ese contrato versionado permitiría que un usuario suba su respaldo y el backend lo asocie a su organización.
4. **Autenticación**: proveedor gestionado (no construir crypto propia). Tokens fuera del repositorio.
5. **Sync offline**: IndexedDB pasa a ser caché local con cola de cambios; resolución de conflictos por `updatedAt`.
6. **Backups y analítica** del lado servidor.

Puntos del código ya preparados: tipos centralizados en `types/`; acceso y reglas locales concentrados en `services/storage.ts`, `services/db.ts` y `services/backup.ts`; respaldo JSON versionado. Una migración a backend debe reemplazar o adaptar esas capas, no solo una de ellas.
