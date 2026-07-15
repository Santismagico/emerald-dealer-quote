# ROADMAP — Emerald Dealer Quote

## v0.1.0 — MVP local (completado)

- [x] Motor de cálculo puro con tests (COP enteros).
- [x] Formulario de cotización por pasos, mobile-first.
- [x] Clientes (CRUD local).
- [x] Historial con búsqueda, filtro por estado, duplicar y estados.
- [x] Vista previa cliente + vista interna confidencial.
- [x] PDF cliente (sin datos sensibles) y PDF interno.
- [x] Compartir por WhatsApp.
- [x] Persistencia IndexedDB + respaldo JSON.
- [x] PWA instalable con offline básico.

## v0.2 — Pulido (parcialmente completado; pendientes vigentes)

- [ ] Probar en un iPhone real (Safari) y ajustar detalles de safe areas.
- [x] Adjuntar el PDF cliente directamente al selector nativo (Web Share API nivel 2, donde esté soportada), con descarga segura como fallback.
- [x] Marcado automático de cotizaciones vencidas como estado derivado, sin modificar los datos guardados.
- [ ] Plantillas de condiciones y piezas frecuentes.
- [x] Recordatorio semanal local para exportar respaldo, con posposición de 24 horas y sin exportación automática.
- [ ] Precio del oro: la actualización automática con la regla internacional 24K + $100.000 ya está implementada y confirmada por Santiago; queda pendiente mostrar el precio internacional como dato auxiliar separado (ver DECISIONS.md D-002).

## v0.3.0 a v0.5.0 — Adiciones acumuladas desde 2026-07-08

- [x] Corregir botón de WhatsApp (prefijo internacional 57 + apertura confiable en iOS).
- [x] Seguimiento de producción interno por cotización: etapas del taller con estado, costos y control de pagos.
- [ ] Mejorar el logo/ícono de la app (mediano plazo; la interfaz actual gusta y se conserva).
- [x] Auditoría de seguridad multi-ángulo y correcciones (v0.5.0, ver DECISIONS.md D-010).
- [x] Bloqueo de PDF cliente, Web Share y WhatsApp si el contenido visible contiene información interna, sin opción para saltar la protección.
- [x] Integridad de datos: clientes normalizados y restauración atómica de ajustes, clientes y cotizaciones con rollback completo.
- [x] Actualizaciones atómicas de Ajustes para que consecutivo, recordatorio y precio del oro no se pisen.
- [ ] Migraciones versionadas de IndexedDB (escalera oldVersion) cuando se necesite el primer índice o cambio de estructura.
- [x] Guardado diferido y seguro en producción/abonos: pausa de 650 ms, blur, cierre, navegación, serialización y reintento.

## v1.0 — Ecosistema Emerald Dealer (autorizado por Santiago el 2026-07-12)

La aplicación pasa de "cotizadora" a ecosistema del negocio con cuatro áreas en la
navegación inferior: **Cotizador · Taller · Agenda · Piedras · Más**. Detalle ejecutable
en [docs/EXECUTION_PLAN.md](docs/EXECUTION_PLAN.md); decisiones en DECISIONS.md D-020.

- [x] Cambio rápido de estado tocando la etiqueta en el historial (D-019).
- [x] **Etapa 6 — Taller como área propia:** pestaña Taller con los trabajos (cotizaciones
  aprobadas), su progreso de producción y sus abonos, reorganizados fuera del flujo de
  cotización. Sin cambios de estructura de datos. Completada 2026-07-12 (D-021).
- [ ] **Etapa 7 — Agenda de asesorías:** registro interno de citas (Santiago las anota;
  el cliente sigue contactando por WhatsApp). Primera migración real de IndexedDB
  (v1→v2) y respaldo de cuatro almacenes.
- [ ] **Etapa 8 — Piedras:** registro de compras y ventas de piedras con inventario
  derivado por motor puro. Migración v2→v3 y respaldo de cinco almacenes.
- [ ] **Etapa 9 — Cierre del día:** PDF interno con todos los movimientos del día
  (piedras, abonos, cotizaciones creadas/aprobadas, pagos del taller).

## Fase futura — Preparación SaaS

**Plan detallado y ejecutable en [SAAS_PLAN.md](SAAS_PLAN.md)** (escrito 2026-07-08; ejecutar solo con orden de Santiago, tras validar con 2-3 joyerías).

- [ ] Backend con `organizations`, `users`, roles y aislamiento por `organization_id` (ver ARCHITECTURE.md).
- [ ] Autenticación gestionada.
- [ ] Importación del respaldo JSON local a la cuenta.
- [ ] Sincronización multi-dispositivo.

## Fase futura — SaaS multiempresa

- [ ] Planes y suscripciones.
- [ ] Backups del lado servidor.
- [ ] Analítica de cotizaciones (tasa de aprobación, ticket promedio).
- [ ] Personalización de marca por joyería (white-label completo).
