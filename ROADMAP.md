# ROADMAP — Emerald Dealer Quote

## v0.1.0 — MVP local (esta versión)

- [x] Motor de cálculo puro con tests (COP enteros).
- [x] Formulario de cotización por pasos, mobile-first.
- [x] Clientes (CRUD local).
- [x] Historial con búsqueda, filtro por estado, duplicar y estados.
- [x] Vista previa cliente + vista interna confidencial.
- [x] PDF cliente (sin datos sensibles) y PDF interno.
- [x] Compartir por WhatsApp.
- [x] Persistencia IndexedDB + respaldo JSON.
- [x] PWA instalable con offline básico.

## v0.2 — Pulido (siguiente)

- [ ] Probar en un iPhone real (Safari) y ajustar detalles de safe areas.
- [ ] Adjuntar el PDF directamente al compartir (Web Share API nivel 2, donde esté soportada).
- [ ] Marcado automático de cotizaciones vencidas (hoy se muestra aviso visual).
- [ ] Plantillas de condiciones y piezas frecuentes.
- [ ] Recordatorio periódico de exportar respaldo.
- [ ] Precio del oro: campo auxiliar "precio internacional 24K" que calcule la referencia +$100.000 (pendiente confirmar con Santiago, ver DECISIONS.md D-002).

## v0.3 — Preparación SaaS

- [ ] Backend con `organizations`, `users`, roles y aislamiento por `organization_id` (ver ARCHITECTURE.md).
- [ ] Autenticación gestionada.
- [ ] Importación del respaldo JSON local a la cuenta.
- [ ] Sincronización multi-dispositivo.

## v1.0 — SaaS multiempresa

- [ ] Planes y suscripciones.
- [ ] Backups del lado servidor.
- [ ] Analítica de cotizaciones (tasa de aprobación, ticket promedio).
- [ ] Personalización de marca por joyería (white-label completo).
