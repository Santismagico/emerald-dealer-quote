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

## Etapa 8 — Piedras: inventario y movimientos

- [ ] 8.1 (Claude) Migración v2→v3: almacén `stoneMovements`. Movimiento:
      id, tipo (`compra | venta`), fecha, piedra (tipo, quilates, cantidad,
      descripción), contraparte (texto libre), valor en COP entero, notas.
- [ ] 8.2 (Claude) Motor puro de inventario con tests: existencias y valores
      derivados de los movimientos (nunca un contador editado a mano).
- [ ] 8.3 (Claude) Respaldo y restauración atómica de 5 almacenes.
- [ ] 8.4 (Codex) Vista Piedras: registrar compra/venta, inventario actual,
      historial de movimientos con búsqueda por fecha y tipo.
- [ ] 8.5 Privacidad: los movimientos y precios de piedras son internos. Ninguna
      ruta los lleva a canales de cliente.
- [ ] 8.6 (Claude) Auditoría, tests, build, commit.

---

## Etapa 9 — Cierre del día (PDF interno)

**Decisión de negocio:** el reporte incluye todo el negocio del día.

- [ ] 9.1 (Claude) Motor puro `dailyReport.ts` con tests: dado un día, reúne
      compras/ventas de piedras, abonos recibidos, cotizaciones creadas y
      aprobadas, y pagos del taller, con totales en COP enteros.
- [ ] 9.2 (Claude) PDF interno "Cierre del día" con encabezado
      DOCUMENTO INTERNO; solo descarga directa: sin Web Share y sin WhatsApp.
- [ ] 9.3 (Codex) Botón "Cierre del día" en la pestaña Más, con vista previa de
      los totales antes de generar el PDF.
- [ ] 9.4 (Claude) Auditoría, tests, build, commit.

---

## Fuera de alcance de v1.0 (requieren nueva autorización)

- Plantillas de piezas frecuentes (pendiente de ROADMAP v0.2).
- Reserva de citas en línea por los clientes (necesitaría el plan SaaS congelado).
- Publicación a `main`: sigue pendiente la prueba física en Android
  (ver `PHYSICAL_TEST_REPORT.md`) y la orden expresa de Santiago.
