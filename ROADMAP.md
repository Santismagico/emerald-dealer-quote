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
- [x] Marcado automático de cotizaciones vencidas como estado derivado, sin modificar los datos guardados.
- [ ] Plantillas de condiciones y piezas frecuentes.
- [x] Recordatorio semanal local para exportar respaldo, con posposición de 24 horas y sin exportación automática.
- [ ] Precio del oro: campo auxiliar "precio internacional 24K" que calcule la referencia +$100.000 (pendiente confirmar con Santiago, ver DECISIONS.md D-002).

## v0.2.x — Adiciones solicitadas por Santiago (2026-07-08)

- [x] Corregir botón de WhatsApp (prefijo internacional 57 + apertura confiable en iOS).
- [x] Seguimiento de producción interno por cotización: etapas del taller con estado, costos y control de pagos.
- [ ] Mejorar el logo/ícono de la app (mediano plazo; la interfaz actual gusta y se conserva).
- [x] Auditoría de seguridad multi-ángulo y correcciones (v0.5.0, ver DECISIONS.md D-010).
- [x] Aviso antes de PDF cliente y WhatsApp si el contenido visible contiene información sensible.
- [x] Integridad de datos: clientes normalizados y restauración atómica de ajustes, clientes y cotizaciones con rollback completo.
- [ ] Migraciones versionadas de IndexedDB (escalera oldVersion) cuando se necesite el primer índice o cambio de estructura.
- [x] Guardado diferido y seguro en producción/abonos: pausa de 650 ms, blur, cierre, navegación, serialización y reintento.

## v0.3 — Preparación SaaS

**Plan detallado y ejecutable en [SAAS_PLAN.md](SAAS_PLAN.md)** (escrito 2026-07-08; ejecutar solo con orden de Santiago, tras validar con 2-3 joyerías).

- [ ] Backend con `organizations`, `users`, roles y aislamiento por `organization_id` (ver ARCHITECTURE.md).
- [ ] Autenticación gestionada.
- [ ] Importación del respaldo JSON local a la cuenta.
- [ ] Sincronización multi-dispositivo.

## v1.0 — SaaS multiempresa

- [ ] Planes y suscripciones.
- [ ] Backups del lado servidor.
- [ ] Analítica de cotizaciones (tasa de aprobación, ticket promedio).
- [ ] Personalización de marca por joyería (white-label completo).
