# PROJECT_STATE — Emerald Dealer Quote

_Actualizado: 2026-07-16 por Codex después de completar D-030 (instalación, temas, pantallas estrechas, pagos y documentación). Este archivo es la foto del estado real; cualquier agente debe poder continuar leyendo solo esto y los documentos que enlaza._

## Qué aplicación es

PWA de cotizaciones de joyería para Santiago (comerciante de esmeraldas, Colombia). Cotiza piezas (oro + piedras + mano de obra), genera PDF para el cliente (sin datos internos) y PDF interno (con costos y margen), comparte por WhatsApp, lleva historial, seguimiento de producción del taller y abonos del cliente. Todo local (IndexedDB), sin backend.

- **Stack:** React 19 + TypeScript + Vite 8 + Tailwind 4 + jsPDF + vite-plugin-pwa + Vitest. Sin router ni gestor de estado externo.
- **Versión:** 0.5.0. El Ecosistema v1.0 está publicado desde `ae57b95`; la identidad vigente y sus correcciones finales siguen únicamente en ramas de trabajo.
- **Producción:** https://santismagico.github.io/emerald-dealer-quote/ — el despliegue solo se inicia por un push a `main` o por ejecución manual de `.github/workflows/deploy.yml`. Un push de la rama de trabajo o de una etiqueta no lo activa.
- **Repositorio:** https://github.com/Santismagico/emerald-dealer-quote (público — nunca subir datos reales ni secretos).

## Estado de Git y respaldos

- Base de Fable conservada: `fable/regeneracion-emerald-dealer-quote-v1` hasta `fb564ca`. Correcciones de Codex: `codex/correcciones-finales-fable`. Ninguna de esas ramas publica la aplicación por sí sola.
- Punto de restauración de esta tanda: tag `punto-seguro-estabilizacion-fondo-2026-07-16`, subido a GitHub antes de las correcciones de Codex.
- `main` contiene lo publicado; la rama de trabajo va adelante. **No hacer push a `main` sin autorización de Santiago** (dispara despliegue público).
- Cómo restaurar si algo sale mal: conservar esta rama como evidencia y volver a la base `fable/regeneracion-emerald-dealer-quote-v1`; si una corrección ya fue guardada, deshacerla con un commit de reversión. No reescribir la historia pública.

## Qué está funcionando

- Estabilización posterior a C1–C6: **432 pruebas en verde, distribuidas en 24 archivos**, build sin errores y recorrido móvil real completado. El anticipo ya cuenta como dinero pagado; los proveedores eliminados conservan su nombre en lotes anteriores; pagos, ventas y deudas quedan protegidos; la entrega exige una fecha real; y los cierres diario/mensual mantienen una caja coherente. Cambios en `2b1b220` y `deeab61`, todavía no publicados.
- **Joya pagada y pago del saldo reforzados (D-028 + D-030):** "Pagada ✓" sigue siendo automática y separada de "Entregada". El Taller distingue pago exacto, saldo, sobrepago y cotización sin total; un exceso se muestra claramente, un total $0 no ofrece una acción falsa y el pago del saldo queda protegido contra doble toque/reintentos. Las pruebas confirman una sola entrada en los cierres diario y mensual.
- **Identidad vigente (D-029 + D-030):** "el mesón del joyero" usa papel cálido, superficies claras con profundidad suave, tinta verde-gris, un único acento esmeralda y serif solo en la marca; incluye tema nocturno automático y conserva claro el documento del cliente. El ícono vigente es "La gema viva". Android recibe una variante adaptable opaca y segura; Apple una versión opaca. Arranque oscuro, contraste ámbar y anchos de 320/390 px quedaron corregidos. Candidata completa: **452 pruebas en 24 archivos**, verificación PWA, TypeScript, build y recorrido local sin desbordamiento ni errores visibles; todavía no publicada.
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
- **Etapa 8 completada (Ecosistema): Piedras por lotes rastreables (D-023).** Pestaña Piedras: cada compra crea un lote con sus ventas embebidas; la app impide vender más de lo disponible (validación del motor puro), muestra el resultado por lote, existencias por tipo y flujo del negocio. Migración v2→v3 probada contra una base v2 real; respaldo v4 de 5 almacenes atómicos que acepta v1–v4. Separado del cotizador por decisión de Santiago. Verificado en navegador: lote creado, venta registrada con cuentas correctas, sobreventa rechazada y persistencia tras recarga.
- **Etapa 9 completada (Ecosistema): Cierre del día (D-024) — PLAN v1.0 COMPLETO.** Más → Cierre del día: vista previa por día (hoy por defecto) y PDF interno con piedras compradas/vendidas, abonos, pagos del taller, cotizaciones creadas/aprobadas y el neto de caja. Solo descarga directa, jamás Web Share ni WhatsApp. Nuevo `Quote.approvedAt` sellado por `withQuoteStatus` (única lógica de cambio de estado). Verificado en navegador: secciones y totales correctos con datos del día, día vacío bien manejado y PDF generado sin errores.

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
- La identidad vigente es "el mesón del joyero" con "La gema viva"; D-027 quedó reemplazada. El endurecimiento de instalación, temas, pantallas estrechas y pagos está registrado en D-030.
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
- Un teléfono que ya tenga instalada la PWA puede conservar el ícono anterior por caché; para comprobar el nuevo conviene desinstalar y volver a instalar.
- El detector no puede leer texto incrustado dentro del logo o de imágenes de referencia; revisar imágenes antes de enviarlas al cliente.
- Ningún navegador puede garantizar una escritura asíncrona si el sistema mata la PWA de forma instantánea; la ventana se reduce con 650 ms, blur, navegación protegida y flush al ocultarse.
- Web Share exige un gesto del usuario. Guardar y generar el PDF son operaciones asíncronas que algunos navegadores pueden considerar fuera de ese gesto; si ocurre, la app descarga el archivo. Falta validación manual en iPhone real y Android real.
- Deuda anotada: migraciones IndexedDB versionadas — **no hacer todavía**, esperar al primer cambio real de estructura (ROADMAP).

## Siguiente paso exacto

**PUBLICADO (2026-07-17, por orden expresa de Santiago):** `main` = `d251ad3` con toda la candidata: correcciones de fondo C1–C9, identidad "el mesón del joyero" con día/noche (D-029), ícono "La gema viva", y las correcciones finales D-030. Despliegue de GitHub Pages en verde (37 s) y sitio en vivo verificado: los meta theme-color nuevos se sirven y el `pwa-512.png` publicado es idéntico byte a byte al local. Las ramas `main` y `codex/correcciones-finales-fable` apuntan al mismo commit.

Pendientes después de publicar (no técnicos):

1. **Reinstalar la PWA en el teléfono de Santiago** para ver el ícono nuevo (los teléfonos que ya la tenían pueden conservar el anterior por caché hasta reinstalar) y confirmar arranque, modo oscuro y navegación (`PHYSICAL_TEST_REPORT.md`).
2. **Revisar con Santiago cotizaciones antiguas** que puedan tener el mismo dinero como anticipo Y como abono manual; la app no deduplica sola (D-026). Con D-030 cualquier sobrepago ya es visible en el Taller, lo que facilita encontrarlas.
3. Decidir si el enlace sigue público o requiere protección privada.
4. Si algo falla en vivo: llevar `main` de vuelta a `ae57b95` restaura la versión anterior automáticamente.

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
| 2026-07-14 | Etapa 7: Agenda de asesorías (Fable) | Migración IndexedDB v1→v2, respaldo v3 de 4 almacenes, pestaña Agenda con aviso de hoy; 337 tests y build en verde; migración y flujo verificados en navegador | cc33c5a |
| 2026-07-15 | Etapa 8: Piedras por lotes (Fable) | Lotes rastreables con ventas embebidas y validación de existencias, migración v2→v3, respaldo v4 de 5 almacenes; 372 tests y build en verde; flujo verificado en navegador | 784071e |
| 2026-07-15 | Etapa 9: Cierre del día (Fable) | Motor puro dailyReport.ts, PDF interno solo descarga, approvedAt en withQuoteStatus, vista en Más; 384 tests y build en verde; reporte y PDF verificados en navegador; **plan v1.0 completo** | ae57b95 |
| 2026-07-16 | Publicación v1.0 (Codex) + auditoría (Fable) | Codex llevó main a ae57b95 (deploy en verde); Fable verificó el sitio en vivo: 5 pestañas, Piedras y Cierre del día funcionando, base v3, consola limpia | ae57b95 en main |
| 2026-07-16 | Hoja de ruta de correcciones (Fable) | docs/HOJA_DE_RUTA_CORRECCIONES.md: método completo para aplicar las correcciones de Santiago (protección, mapa del código, verificación, publicación, trabajo simultáneo) | 02ada13 |
| 2026-07-16 | Correcciones de fondo C1–C6 (Fable) | Etapas del taller, estado Entregada, Proveedores (db v4, respaldo v5), crédito con proveedores, cierre por negocio con caja honesta, cierre mensual con deudas y comparación; 410 tests y build en verde; verificadas en navegador (D-025) | 05d301d |
| 2026-07-16 | Estabilización de correcciones de fondo (Codex) | Anticipo tratado como pago real, historial de proveedores conservado, lotes/pagos protegidos, fecha real de entrega y cierres corregidos; 432 pruebas, build y recorrido móvil en verde; no publicado (D-026) | 2b1b220 + deeab61 |
| 2026-07-16 | Renovación estética de lujo (Codex) | Identidad esmeralda oscuro/dorado/marfil, componentes y pantallas renovados, íconos lineales, nuevo ícono instalable y controles táctiles; 432 pruebas, build y revisión móvil en verde; no publicado (D-027). Auditoría posterior: el interior del Taller quedó sin renovar (E3) | 55771e0 |
| 2026-07-16 | C8: joya pagada y pago del saldo (Fable) | Estado "Pagada" derivado del dinero, botón que registra el saldo como pago de hoy, anticipo marcado como 1er pago ya contado; 445 pruebas y build en verde; flujo, persistencia y cierre verificados en navegador; no publicado (D-028) | 5d67440 |
| 2026-07-16 | Nueva identidad "el mesón del joyero" (Fable) | Papel cálido, acento esmeralda, tema claro/oscuro e ícono "La gema viva"; reemplaza la estética D-027; no publicado (D-029) | 4f3df5f + fb564ca |
| 2026-07-16 | Endurecimiento final (Codex) | Ícono adaptable/Apple, arranque y contraste nocturno, pantallas estrechas, sobrepagos/total cero/idempotencia y documentación; 452 pruebas, verificación PWA, build y revisión 320/390 px en verde; no publicado (D-030) | `codex/correcciones-finales-fable` |
| 2026-07-17 | **Publicación de la candidata completa (Fable, orden expresa de Santiago)** | `main` avanzado por fast-forward a la candidata (C1–C9, D-028/D-029/D-030); 452 pruebas y build en verde sobre el commit publicado; deploy de Pages en verde y sitio en vivo verificado (theme-color nuevos servidos, ícono publicado idéntico byte a byte al local) | d251ad3 en main |
