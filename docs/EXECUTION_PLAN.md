# EXECUTION_PLAN — Ecosistema Emerald Dealer (v1.0)

_Escrito por Claude (Fable) el 2026-07-12 tras la autorización de Santiago. Reglas de
fondo en `AGENTS.md`; decisiones en `DECISIONS.md` (D-019, D-020); estado vivo en
`PROJECT_STATE.md`._

## Visión

La aplicación deja de ser solo una cotizadora y se convierte en el ecosistema del
negocio, con esta navegación inferior:

| Pestaña | Contenido |
|---|---|
| **Cotizador** | Historial + nueva cotización (todo lo actual) |
| **Taller** | Trabajos = cotizaciones aprobadas: producción y abonos |
| **Agenda** | Asesorías: citas registradas por Santiago (internas) |
| **Piedras** | Compras y ventas de piedras + inventario |
| **Más** | Clientes, Ajustes, Cierre del día, respaldos |

Cada pestaña se agrega cuando su etapa está lista; mientras tanto no aparece.

## Reparto de trabajo (decisión "mixto" de Santiago)

- **Claude (Fable/Opus):** rediseño de navegación, migraciones de IndexedDB,
  cambios al respaldo/restauración, motor del reporte del día, y auditoría de cada
  etapa terminada por Codex.
- **Codex:** vistas y formularios repetitivos siguiendo las órdenes de cada etapa.
- Quien tome una tarea debe marcar aquí su estado y actualizar `PROJECT_STATE.md`.

## Reglas para TODAS las etapas

1. Antes de tocar código: commit limpio + push de la rama de trabajo.
2. Al terminar: `npm test && npm run build` en verde, bitácora de `PROJECT_STATE.md`
   actualizada, commit + push. Nunca push a `main` (publica) sin orden de Santiago.
3. COP enteros, motor puro para toda lógica de negocio, cero dependencias nuevas
   sin registrar en `DECISIONS.md`.
4. Nada de las áreas internas (taller, agenda, piedras, cierre del día) puede
   aparecer jamás en el PDF cliente, Web Share ni WhatsApp. Los tests de
   `pdfContent.test.ts` mandan.

---

## Etapa 6 — Taller como área propia (sin cambio de datos) — ✅ COMPLETADA 2026-07-12

**Objetivo:** separar el trabajo del taller del flujo de cotización, manteniendo la
lógica de producción y abonos ya probada. Ejecutada íntegramente por Claude (Fable)
por continuidad de la sesión; decisiones en D-021.

- [x] 6.1 (Claude) Nueva navegación inferior: Cotizador · Taller · Más
      (Más agrupa Clientes y Ajustes). "Nueva" deja de ser pestaña: ya existe el
      botón dentro del historial.
- [x] 6.2 (Claude) Servicio puro `workshop.ts`: deriva la lista de trabajos desde
      las cotizaciones aprobadas — progreso de etapas, total abonado, saldo.
      Con tests (`workshop.test.ts`).
- [x] 6.3 (Claude) Vista Taller (`WorkshopView.tsx`): lista de trabajos con cliente,
      pieza, progreso (x/y etapas + barra), saldo; búsqueda y filtros
      Todos / En taller / Listos.
- [x] 6.4 (Claude) Pantalla de trabajo (`WorkshopJobView.tsx`): paneles existentes de
      producción y abonos con el mismo guardado diferido (`quoteAutosave`), resumen
      de totales y enlace a la cotización. La vista interna de la cotización ahora
      muestra resumen + botón "Abrir en el Taller" en lugar de los paneles.
- [x] 6.5 El acceso directo "🛠 Taller" del historial abre el trabajo dentro de Taller.
      Además, aprobar desde el historial también crea las etapas estándar.
- [x] 6.6 (Claude) Auditoría, tests (309 en verde), build, verificación en navegador
      (crear etapas, marcar lista, registrar abono, persistencia tras recarga), commit.

**No hacer:** cambiar el esquema de `Quote`, ni la lógica de guardado diferido
(D-014). Es una reorganización de interfaz.

---

## Etapa 7 — Agenda de asesorías (primera migración de datos) — ✅ COMPLETADA 2026-07-14

**Decisión de negocio:** agenda interna. El cliente contacta por WhatsApp;
Santiago registra la cita. Nada se publica ni se sincroniza. Ejecutada
íntegramente por Claude (Fable); decisiones en D-022.

- [x] 7.1 (Claude) Migración IndexedDB v1→v2 con escalera `DB_MIGRATIONS` en
      `db.ts` (idempotente, exportada para pruebas). Deuda de ROADMAP pagada.
      Probada con una base v1 real en tests y con la migración en vivo del
      navegador de desarrollo: cero datos perdidos.
- [x] 7.2 (Claude) Tipo `Appointment` + `normalizeAppointment` en `schema.ts`:
      hora HH:MM validada, duración estándar de 60 min, estado desconocido
      vuelve a `programada`.
- [x] 7.3 (Claude) Respaldo v3 con citas; se aceptan v1/v2/v3 y los viejos
      restauran con agenda vacía. Restauración atómica de 4 almacenes con
      rollback completo. El recordatorio semanal ahora también cuenta las citas
      como datos que merecen respaldo.
- [x] 7.4 (Claude) Vista Agenda (`AgendaView.tsx`): aviso de citas de hoy,
      filtros Próximas/Pasadas/Todas con conteos, búsqueda por nombre o motivo,
      formulario de crear/editar con guardado explícito, vínculo opcional a un
      cliente registrado, y cambio de estado tocando la etiqueta (mismo patrón
      del historial). Lógica pura en `agenda.ts` con tests.
- [x] 7.5 Aviso visual local: banner "Hoy tienes N citas" + globito numérico en
      la pestaña Agenda; solo cuenta las programadas de hoy y desaparece al
      cumplirlas. Sin notificaciones ni permisos del sistema.
- [x] 7.6 (Claude) Auditoría, 337 tests y build en verde, migración y flujo
      completo verificados en navegador, commit.

---

## Etapa 8 — Piedras: lotes rastreables — ✅ COMPLETADA 2026-07-15

**Decisión de negocio (Santiago, 2026-07-15, ver D-023):** el diseño cambió del
registro de movimientos simples al modelo de **lotes rastreables**: cada compra
crea un lote identificado y cada venta se descuenta de un lote específico, para
saber qué se ganó con cada uno. Además: Piedras queda **separado** del cotizador
de joyas, y la pestaña muestra **existencias + flujo de dinero**. Ejecutada
íntegramente por Claude (Fable).

- [x] 8.1 (Claude) Migración v2→v3: almacén `stoneLots`. Lote: nombre opcional,
      tipo de piedra, descripción, fecha de compra, proveedor, quilates,
      cantidad, costo en COP entero, notas y sus VENTAS embebidas (fecha,
      comprador, quilates, cantidad, valor) — como los abonos dentro de una
      cotización: una venta no puede quedar huérfana ni superar el lote.
- [x] 8.2 (Claude) Motor puro `stones.ts` con tests: resumen por lote (vendido,
      restante, agotado, resultado), existencias por tipo de piedra, flujo
      (invertido/recibido/neto) y validación de ventas contra lo disponible.
      Nada se guarda como contador a mano.
- [x] 8.3 (Claude) Respaldo v4 con lotes; acepta v1–v4 (los viejos restauran con
      lotes vacíos). Restauración atómica de 5 almacenes con rollback.
- [x] 8.4 (Claude) Vista Piedras (`StonesView.tsx`): nueva compra (lote), detalle
      del lote con sus ventas, registrar/editar/eliminar venta con validación de
      existencias, editar compra, existencias por tipo, flujo del negocio,
      búsqueda y filtros Con existencias / Agotados / Todos.
- [x] 8.5 Privacidad: lotes y precios de piedras son internos. Ninguna ruta los
      lleva a canales de cliente (tests de privacidad intactos).
- [x] 8.6 (Claude) Auditoría, 372 tests y build en verde, flujo completo
      verificado en navegador (lote, venta, sobreventa rechazada, persistencia),
      commit.

---

## Etapa 9 — Cierre del día (PDF interno) — ✅ COMPLETADA 2026-07-15

**Decisión de negocio:** el reporte incluye todo el negocio del día. Ejecutada
íntegramente por Claude (Fable); decisiones en D-024.

- [x] 9.1 (Claude) Motor puro `dailyReport.ts` con tests: dado un día, reúne
      compras/ventas de piedras, abonos recibidos, cotizaciones creadas y
      aprobadas, y pagos del taller, con totales en COP enteros y el movimiento
      neto. Para fechar aprobaciones se agregó `Quote.approvedAt`, sellado por
      `withQuoteStatus` (única lógica de cambio de estado, compartida por
      historial y vista previa).
- [x] 9.2 (Claude) PDF interno "Cierre del día" con encabezado
      DOCUMENTO INTERNO, reutilizando el renderizador existente; solo descarga
      directa: sin Web Share y sin WhatsApp. Un día vacío lo dice expresamente.
- [x] 9.3 (Claude) Más → "Cierre del día" (`DailyCloseView.tsx`): selector de
      día (hoy por defecto) y vista previa completa de dinero y movimientos
      antes de generar el PDF.
- [x] 9.4 (Claude) Auditoría, 384 tests y build en verde, verificación en
      navegador, commit.

---

## Plan v1.0 completado

Las Etapas 6, 7, 8 y 9 están terminadas: el ecosistema completo
(Cotizador · Taller · Agenda · Piedras · Más con Cierre del día) existe como
candidata NO publicada en la rama de trabajo. Antes de publicar a `main` sigue
pendiente la prueba física en Android (PHYSICAL_TEST_REPORT.md) y la orden
expresa de Santiago.

---

## Fuera de alcance de v1.0 (requieren nueva autorización)

- Plantillas de piezas frecuentes (pendiente de ROADMAP v0.2).
- Reserva de citas en línea por los clientes (necesitaría el plan SaaS congelado).
- Publicación a `main`: sigue pendiente la prueba física en Android
  (ver `PHYSICAL_TEST_REPORT.md`) y la orden expresa de Santiago.

---

## FASE 1 pre-SaaS — Auditoría y endurecimiento (ordenada el 2026-07-17, D-031/D-032)

**La orden de trabajo DETALLADA para Codex está en
`docs/FASE1_ORDEN_DE_TRABAJO_CODEX.md`** (archivos exactos, casos límite,
pruebas requeridas y reglas de operación). Esta lista es solo el tablero de
avance. Método general: docs/HOJA_DE_RUTA_CORRECCIONES.md. Cada etapa termina
con npm test && npm run build en verde, commit + push de la rama
`codex/correcciones-finales-fable` (NUNCA main sin orden) y su sección en
docs/AUDITORIA_FASE1.md.

- [x] S0. Renombre a "Emerald Dealer" + npm audit inicial (0 vulnerabilidades) — c528d74+
- [ ] S1. Auditoría de dinero: revisar redondeos COP, sobrepagos y cierres diario/mensual
      contra el motor puro; ampliar tests de casos límite donde falten.
- [ ] S2. Auditoría de datos: escalera de migraciones v1→v4 contra bases reales de cada
      versión; importación de respaldos v1–v5 con datos límite (grandes/corruptos/truncados);
      carreras del guardado diferido (navegación, cierre, visibilidad).
- [ ] S3. Ciberseguridad: revisión de CSP (hashes y connect-src tras v2), entradas de
      usuario hacia PDF/WhatsApp, tamaños de imágenes data-URL, manejo de archivos de
      respaldo maliciosos; actualizar SECURITY_CHECKLIST.md con hallazgos y estado.
- [ ] S4. Repositorio público: barrido de datos reales en fixtures, capturas y docs
      (la lista del piloto y datos de joyerías reales JAMÁS entran al repo).
- [ ] S5. Borradores legales (Ley 1581/2012): política de privacidad, aviso de
      tratamiento de datos y términos de servicio de Emerald Dealer, en lenguaje claro,
      para revisión de Santiago y su contador. Guardarlos en docs/legal/.
- [ ] S6. Salida de OneDrive: clonar el repo a una ruta fuera de OneDrive
      (p. ej. C:\Dev\emerald-dealer), verificar tests/build allí, actualizar CLAUDE.md
      y PROJECT_STATE con la nueva ruta canónica. Hacerlo al INICIO de una sesión.
- [ ] S7. Cierre de fase: informe de hallazgos, versión 1.0.0 en package.json
      (visible en Ajustes) y publicación con orden de Santiago.

En paralelo (Santiago, sin código): registro del comercio en Wompi con RUT y cuenta
Bancolombia; consulta al contador sobre facturación electrónica DIAN para suscripciones.
