# PROJECT_STATE — Emerald Dealer Quote

_Actualizado: 2026-07-12 por Codex durante la consolidación de la Etapa 5.5. Este archivo es la foto del estado real; cualquier agente debe poder continuar leyendo solo esto y los documentos que enlaza._

## Qué aplicación es

PWA de cotizaciones de joyería para Santiago (comerciante de esmeraldas, Colombia). Cotiza piezas (oro + piedras + mano de obra), genera PDF para el cliente (sin datos internos) y PDF interno (con costos y margen), comparte por WhatsApp, lleva historial, seguimiento de producción del taller y abonos del cliente. Todo local (IndexedDB), sin backend.

- **Stack:** React 19 + TypeScript + Vite 8 + Tailwind 4 + jsPDF + vite-plugin-pwa + Vitest. Sin router ni gestor de estado externo.
- **Versión:** 0.5.0 + cambios no publicados de las Etapas 1, 2, 3, 4A, 4B y 5 en la rama Fable. No se cambió la versión ni se publicó.
- **Producción:** https://santismagico.github.io/emerald-dealer-quote/ — el despliegue solo se inicia por un push a `main` o por ejecución manual de `.github/workflows/deploy.yml`. Un push de la rama de trabajo o de una etiqueta no lo activa.
- **Repositorio:** https://github.com/Santismagico/emerald-dealer-quote (público — nunca subir datos reales ni secretos).

## Estado de Git y respaldos

- Rama de trabajo autorizada: `fable/regeneracion-emerald-dealer-quote-v1`. Allí están las Etapas 1, 2, 3, 4A, 4B y 5; respaldar esa rama en GitHub no publica la aplicación.
- Punto de restauración: tag `punto-seguro-2026-07-09` (commit c3140c4), subido a GitHub.
- `main` contiene lo publicado; la rama de trabajo va adelante. **No hacer push a `main` sin autorización de Santiago** (dispara despliegue público).
- Cómo restaurar si algo sale mal: `git restore .` para descartar cambios sin commit; `git reset --hard punto-seguro-2026-07-09` para volver al punto seguro (solo si es imprescindible y avisando).

## Qué está funcionando

- Verificación integral de la Etapa 5.5: **294 pruebas en verde**, distribuidas en 16 archivos, y build de producción sin errores.
- Todos los módulos del MVP + producción del taller + abonos (ver `PRODUCT_SPEC.md` raíz, tabla de módulos).
- Protección de información interna antes de PDF cliente, Web Share y WhatsApp: el contenido final de cada canal se analiza y, si hay un hallazgo, la salida queda bloqueada hasta corregirlo. No existe una confirmación para saltar la protección.
- Vencimiento visual: **Etapa 2 completada y probada**. Borradores y pendientes con fecha anterior al día actual se muestran, filtran y cuentan como vencidos sin cambiar IndexedDB ni `updatedAt`.
- Guardado de producción y abonos: **Etapa 3 completada y probada**. La interfaz responde de inmediato, texto/dinero se agrupan durante 650 ms, la navegación fuerza el guardado y una cola serial garantiza que siempre prevalezca la última edición.
- Integridad de datos: **Etapa 4A completada y probada**. Todos los clientes se normalizan al leer y guardar. Restaurar un respaldo reemplaza ajustes, clientes y cotizaciones dentro de una sola operación; si cualquier parte falla, los datos anteriores permanecen completos.
- Recordatorio de respaldo: **Etapa 4B completada y probada**. Un banner local avisa cada siete días cuando hay información, permite exportar o posponer un día y nunca exporta, transmite ni pide permisos por sí mismo.
- Compartir PDF cliente: **Etapa 5 completada y probada**. En dispositivos compatibles abre el selector nativo con un solo archivo PDF cliente; si no hay soporte real, descarga ese mismo archivo para adjuntarlo manualmente. WhatsApp con texto sigue siendo una acción separada.
- Consistencia de Ajustes: la consolidación evita que el consecutivo, el recordatorio de respaldo o el precio del oro se pisen cuando coinciden dos acciones. No cambia el formato de datos ni agrega dependencias.
- Cambio rápido de estado desde el historial: tocar la etiqueta de estado de una cotización abre un menú para asignar borrador, pendiente, aprobada o rechazada sin entrar a la cotización (D-019). Verificado en navegador: el cambio persiste tras recargar y activa el acceso de producción al aprobar.
- **Etapa 6 completada (Ecosistema): Taller como área propia (D-021).** Navegación de tres pestañas (Cotizador · Taller · Más), lista de trabajos derivada de las aprobadas (lógica pura `workshop.ts` con tests), pantalla de trabajo con producción y abonos usando el mismo guardado diferido, resumen + "Abrir en el Taller" en la vista interna, y creación de etapas estándar al aprobar desde cualquier lugar. Verificado en navegador: etapas, abono y persistencia tras recarga.
- **Etapa 7 completada (Ecosistema): Agenda de asesorías (D-022).** Pestaña Agenda con citas internas (fecha, hora opcional, duración, motivo, cliente vinculado o nombre libre), estados con menú de un toque, aviso local de citas de hoy (banner + globito en la pestaña), filtros y búsqueda. Primera migración IndexedDB v1→v2 con escalera idempotente probada contra una base v1 real; respaldo v3 con 4 almacenes atómicos que acepta respaldos v1/v2. Verificado en navegador: migración en vivo sin pérdida, cita creada, estado cambiado y persistencia tras recarga.

## Estado de la consolidación

Consolidar y auditar las Etapas 1 a 5 sin publicar la aplicación:

1. **Completada:** pruebas y corrección del detector de palabras sensibles.
2. **Completada:** marcado automático de cotizaciones vencidas (estado derivado, sin mutar datos).
3. **Completada:** guardado eficiente en producción/abonos (pausa, blur, cierre, navegación, reintento y escrituras en serie).
4A. **Completada:** normalización total de clientes y restauración atómica con rollback.
4B. **Completada:** recordatorio semanal local de exportar respaldo.
5. **Completada:** adjuntar el PDF al compartir donde el dispositivo lo soporte (Web Share API nivel 2), con descarga de respaldo.
5.5. **Completada como candidata:** bloqueo absoluto de información interna, consistencia de Ajustes, documentación alineada, 294 pruebas y build aprobados. El punto seguro es `punto-seguro-codex-etapa5-2026-07-12`. La candidata sigue pendiente de pruebas físicas y no está publicada.

Las plantillas de piezas frecuentes permanecen como trabajo futuro y requieren una autorización aparte de Santiago.

## Decisiones tomadas (resumen; detalle en DECISIONS.md)

- Precio del oro automático: internacional 24K del día + $100.000 COP/g (D-002).
- `src/services/schema.ts` es la ÚNICA fuente de defaults/migraciones/normalización (D-010).
- El detector analiza la salida real de PDF cliente y WhatsApp, no una lista manual de campos (D-012).
- El vencimiento es un estado derivado de la interfaz y nunca una escritura automática (D-013).
- Producción y abonos usan guardado diferido y serializado, con la última versión local como fuente (D-014).
- Clientes normalizados y restauración atómica de los tres almacenes locales, con rollback completo (D-015).
- El recordatorio de respaldo es local, semanal y opcional; nunca exporta ni transmite datos automáticamente (D-016).
- Web Share entrega solo el PDF cliente al selector nativo; no elige WhatsApp, usa descarga si no hay soporte y trata `AbortError` como cancelación (D-017).
- El consecutivo, el recordatorio y el precio del oro actualizan Ajustes sin pisarse entre acciones simultáneas (D-018).
- Dinero en COP enteros; motor de cálculo puro; privacidad del cliente protegida por tests.
- Plan SaaS (Supabase) escrito en `SAAS_PLAN.md` pero **congelado** hasta orden de Santiago.

## Qué NO debe modificarse

- La lógica del precio del oro (`src/services/goldPrice.ts`) salvo decisión registrada.
- El motor de cálculo (`src/calc/engine.ts`) salvo bug demostrado con test.
- Los tests de privacidad (`src/services/pdfContent.test.ts`): si un cambio los rompe, el cambio está mal.
- `.github/workflows/deploy.yml` y `main` (controlan la publicación).
- No agregar dependencias sin justificarlo en `DECISIONS.md`.

## Riesgos conocidos

- Proyecto dentro de OneDrive (sincronización puede interferir con `node_modules`; conviene moverlo algún día, no urgente).
- Dependencia de 2 APIs gratuitas para el precio del oro (mitigado con fallback y límites de sanidad).
- Repo público: cuidado con datos personales en ejemplos, fixtures o capturas.
- El detector no puede leer texto incrustado dentro del logo o de imágenes de referencia; revisar imágenes antes de enviarlas al cliente.
- Ningún navegador puede garantizar una escritura asíncrona si el sistema mata la PWA de forma instantánea; la ventana se reduce con 650 ms, blur, navegación protegida y flush al ocultarse.
- Web Share exige un gesto del usuario. Guardar y generar el PDF son operaciones asíncronas que algunos navegadores pueden considerar fuera de ese gesto; si ocurre, la app descarga el archivo. Falta validación manual en iPhone real y Android real.
- Deuda anotada: migraciones IndexedDB versionadas — **no hacer todavía**, esperar al primer cambio real de estructura (ROADMAP).

## Siguiente paso exacto

El 2026-07-12 Santiago autorizó el **Ecosistema Emerald Dealer v1.0** (Cotizador · Taller · Agenda · Piedras · Más). El plan por etapas está en `docs/EXECUTION_PLAN.md` y las decisiones de negocio en DECISIONS.md D-020. Las **Etapas 6 (Taller, D-021) y 7 (Agenda, D-022) están completadas y verificadas**. El siguiente paso es la **Etapa 8 (Piedras: inventario y movimientos)**, que empieza por la migración IndexedDB v2→v3 (tarea 8.1, a cargo de Claude) — la escalera de migraciones ya existe, solo se agrega un escalón.

Sigue pendiente (no bloquea las etapas): la prueba física en Android registrada en `PHYSICAL_TEST_REPORT.md` antes de autorizar cualquier publicación. Las plantillas de piezas frecuentes siguen requiriendo autorización aparte.

## Pruebas que debe ejecutar todo agente antes de dar algo por terminado

```bash
npm test && npm run build
```

## Bitácora de etapas (Codex la actualiza)

| Fecha | Etapa | Resultado | Commit |
|---|---|---|---|
| 2026-07-09 | Preparación y protección (Claude) | Tag `punto-seguro-2026-07-09`, docs de traspaso creados | c3140c4 |
| 2026-07-11 | Etapa 1: detector de información sensible | Salida real por canal, aviso explícito, 162 tests y build en verde | 5f79b57 |
| 2026-07-11 | Etapa 2: vencimiento como estado derivado | Historial, filtros y conteos coherentes, sin escrituras automáticas; 181 tests y build en verde | 62a2a25 |
| 2026-07-11 | Etapa 3: guardado seguro de producción y abonos | 650 ms, flush en eventos, cola serial, error/reintento; 207 tests y build en verde | 9d53d6e |
| 2026-07-11 | Etapa 4A: integridad de datos | Clientes normalizados; respaldo atómico con rollback; 234 tests y build en verde | cbc87bc |
| 2026-07-11 | Etapa 4B: recordatorio de respaldo | Aviso semanal local, posposición de 24 horas y exportación confirmada; 255 tests y build en verde | c525e01 |
| 2026-07-12 | Etapa 5: compartir PDF cliente | Selector nativo cuando es compatible, descarga segura como respaldo, privacidad y doble toque protegidos; 283 tests y build en verde | 508555f |
| 2026-07-12 | Etapa 5.5: consolidación Codex | Privacidad sin bypass, Ajustes simultáneos protegidos, documentación alineada; 294 tests y build en verde; candidata no publicada | `punto-seguro-codex-etapa5-2026-07-12` |
| 2026-07-12 | Cambio rápido de estado (Fable) | Etiqueta de estado tocable en el historial con menú de estados asignables; 298 tests y build en verde; verificado en navegador | 2bfda23 |
| 2026-07-12 | Plan Ecosistema v1.0 (Fable) | Etapas 6–9 escritas en docs/EXECUTION_PLAN.md; decisiones de negocio en D-020 | 489134d |
| 2026-07-12 | Etapa 6: Taller como área propia (Fable) | Navegación Cotizador·Taller·Más, trabajos derivados con lógica pura, pantalla de trabajo con guardado diferido; 309 tests y build en verde; verificado en navegador | cded994 |
| 2026-07-14 | Etapa 7: Agenda de asesorías (Fable) | Migración IndexedDB v1→v2, respaldo v3 de 4 almacenes, pestaña Agenda con aviso de hoy; 337 tests y build en verde; migración y flujo verificados en navegador | pendiente de commit |
