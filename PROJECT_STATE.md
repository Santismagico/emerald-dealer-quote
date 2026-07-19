# PROJECT_STATE — Emerald Dealer Quote

> **Ruta canónica del proyecto:** `C:\Dev\emerald-dealer`. Las sesiones nuevas de agentes se abren aquí. La copia bajo OneDrive está congelada y no debe usarse para nuevos cambios.

_Actualizado: 2026-07-18 por Codex al cerrar la regresión A1 encontrada en la segunda auditoría independiente. Este archivo es la foto del estado real; cualquier agente debe poder continuar leyendo solo esto y los documentos que enlaza._

> **SIGUIENTE TRABAJO: ninguno técnico. La candidata 1.1.0 quedó auditada y aprobada.** Las tres auditorías independientes de Fable están cerradas (`docs/AUDITORIA_FABLE_FASE2.md`, `_SEGUNDA.md`, `_TERCERA.md`): los cinco hallazgos (H1–H4 y A1) fueron corregidos y verificados con pruebas propias del auditor. Queda **O1** como observación menor (ventana estrecha entre guardar y encolar en `cloud/api.ts`), sin bloquear. **Lo que sigue no es código:** documentos legales aprobados por un profesional, SMTP propio probado, decisión sobre contraseñas filtradas y nueva N6 sobre el commit final. `main` y la aplicación pública nunca se modificaron.

## Qué aplicación es

PWA de cotizaciones de joyería para Santiago (comerciante de esmeraldas, Colombia). Cotiza piezas (oro + piedras + mano de obra), genera PDF para el cliente (sin datos internos) y PDF interno (con costos y margen), comparte por WhatsApp, lleva historial, seguimiento de producción del taller y abonos del cliente. La candidata 1.1.0 conserva IndexedDB como caché y agrega, mediante una bandera de compilación, cuentas y datos sincronizados con Supabase; la versión pública sigue en modo local.

- **Stack:** React 19 + TypeScript + Vite 8 + Tailwind 4 + jsPDF + vite-plugin-pwa + Vitest + `@supabase/supabase-js` 2.110.7. Sin router ni gestor de estado externo.
- **Versión candidata:** 1.1.0 en `codex/fase2-nube`. La versión pública 1.0.1 no cambia hasta que Santiago autorice una orden separada de publicación.
- **Producción:** https://santismagico.github.io/emerald-dealer-quote/ — `.github/workflows/deploy.yml` solo acepta ejecución manual, commit exacto aprobado por N6 y confirmación `PUBLICAR`. Un push a cualquier rama no publica.
- **Repositorio:** https://github.com/Santismagico/emerald-dealer-quote (público — nunca subir datos reales ni secretos).

## Estado de Git y respaldos

- **Fase 1 completada y publicada:** informe en `docs/AUDITORIA_FASE1.md`.
- **Fase 2 completada como candidata:** N0–N8 en `codex/fase2-nube`; informe acumulativo en `docs/AUDITORIA_FASE2.md`. N6 aprobó 9/9 controles y N7 comprobó recorrido, importación idempotente y recuperación real sin conexión.
- **Correcciones de la auditoría Fable completadas:** C-N1 sincroniza borrados sin destruir cambios locales pendientes; C-N2 guarda cotizaciones sin señal y reserva el consecutivo en el servidor al reconectar; C-N3 muestra cambios sin subir y permite recuperar rechazos apartados; C-N4 excluye Supabase de la precarga pública.
- **Regresión A1 corregida:** un pull conserva clientes, cotizaciones y demás datos que solo han existido localmente, incluso si la nube ya contiene otros registros. Solo puede aplicar un borrado remoto sobre registros que ese dispositivo ya reconcilió con la nube. "Ahora no" fue reemplazado por una explicación honesta de que los datos seguirán solo en ese aparato.
- **Verificación A1:** la prueba de 3 clientes locales contra nube vacía falló antes del arreglo y pasó después; también aprobaron nube no vacía, borrado posterior desde un segundo dispositivo y fallo remoto sin pérdida. Cierre completo: 512/512 pruebas y compilación 1.1.0.
- **Verificación de correcciones:** 510/510 pruebas; compilación con nube; compilación pública sin Supabase en `dist/sw.js`; CSP pública exacta; app pública local abierta directamente en el cotizador y sin errores visibles.
- **Verificación de cierre:** 498 pruebas en 34 archivos, PWA, compilación 1.1.0 y hash CSP final aprobados; 0 vulnerabilidades conocidas y ningún secreto detectado.
- **Siguiente decisión:** Fable o un revisor independiente audita la rama. Publicar únicamente después de cerrar los bloqueos premercado y con orden expresa de Santiago.

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

- Riesgo resuelto: el proyecto canónico ya vive en `C:\Dev\emerald-dealer`; la copia de OneDrive está congelada.
- Dependencia de 2 APIs gratuitas para el precio del oro (mitigado con fallback y límites de sanidad).
- Repo público: cuidado con datos personales en ejemplos, fixtures o capturas.
- Un teléfono que ya tenga instalada la PWA puede conservar el ícono anterior por caché; para comprobar el nuevo conviene desinstalar y volver a instalar.
- El detector no puede leer texto incrustado dentro del logo o de imágenes de referencia; revisar imágenes antes de enviarlas al cliente.
- Ningún navegador puede garantizar una escritura asíncrona si el sistema mata la PWA de forma instantánea; la ventana se reduce con 650 ms, blur, navegación protegida y flush al ocultarse.
- Web Share exige un gesto del usuario. Guardar y generar el PDF son operaciones asíncronas que algunos navegadores pueden considerar fuera de ese gesto; si ocurre, la app descarga el archivo. Falta validación manual en iPhone real y Android real.
- Deuda anotada: migraciones IndexedDB versionadas — **no hacer todavía**, esperar al primer cambio real de estructura (ROADMAP).

## Siguiente paso exacto

**REGRESIÓN A1 CERRADA EN RAMA SEGURA (2026-07-18):** la segunda auditoría aprobó C-N2, C-N3 y C-N4, y encontró que C-N1 podía borrar el historial local anterior a la nube. A1 conserva ahora todo dato no reconciliado y mantiene los borrados multidispositivo para registros ya vistos en la nube. El siguiente paso es la tercera auditoría independiente contra el código y el diff completo. Antes de publicar siguen pendientes SMTP propio probado, documentos legales aprobados y una nueva N6 sobre el commit final exacto. **No avanzar `main` ni ejecutar el workflow de despliegue sin una orden separada y expresa de Santiago.**

**Estado público anterior:** `main` conserva la versión del piloto. La publicación de Fase 1 fue autorizada por Santiago y está documentada en `docs/AUDITORIA_FASE1.md`; Fase 2 no ha sido publicada.

Publicación anterior del mismo día (v2 estética+pagos): `main` = `d251ad3` con toda la candidata: correcciones de fondo C1–C9, identidad "el mesón del joyero" con día/noche (D-029), ícono "La gema viva", y las correcciones finales D-030. Despliegue de GitHub Pages en verde (37 s) y sitio en vivo verificado: los meta theme-color nuevos se sirven y el `pwa-512.png` publicado es idéntico byte a byte al local. Las ramas `main` y `codex/correcciones-finales-fable` apuntan al mismo commit.

**Antecedente de la ruta SaaS (D-031/D-035):** `SAAS_PLAN.md` y las órdenes de trabajo
condujeron a las Fases 1 y 2. Fase 1 quedó publicada y Fase 2 quedó cerrada como
candidata auditable en su rama protegida. Los cobros, suscripciones, invitaciones de
varios miembros, Realtime, notificaciones y dominio propio siguen fuera de alcance.

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
| 2026-07-17 | C10: desplazamiento del cotizador en Android (Codex) | El contenido usa desplazamiento táctil propio y la navegación del formulario permanece accesible; 467 pruebas y build en verde; publicada y verificada en vivo | ab77ad3 |
| 2026-07-17 | E5: adaptación para computador (Codex) | La app usa el ancho disponible, menú lateral y formulario en columnas sin alterar la presentación móvil; 467 pruebas y build en verde; publicada y verificada en vivo | e27654a |
| 2026-07-17 | E6: navegación del cotizador sin anclaje en Android (Codex) | Siguiente/Anterior vuelven a su posición normal dentro del formulario; el desplazamiento táctil sigue funcionando y PC permanece igual; 467 pruebas, build y revisión visual móvil/PC en vivo | 33d5d53 |
| 2026-07-17 | E7: botones de acción sin anclaje en PC y Android (Codex) | Cotización y Ajustes dejan Siguiente/Anterior y Guardar ajustes dentro del recorrido normal; desplazamiento comprobado en PC y Android; 468 pruebas, build y revisión visual en vivo | 877a8cc |
| 2026-07-18 | Fase 2 N0–N8 (Codex + Santiago) | Cuentas, RLS, operaciones protegidas, sincronización, importación, N6 9/9 y N7 real con modo sin conexión; candidata 1.1.0 cerrada en rama segura y no publicada | `codex/fase2-nube` |
| 2026-07-18 | Correcciones C-N1 a C-N4 (Codex) | Borrados entre dispositivos, cotización sin señal, cola visible y recuperable, y precarga pública sin Supabase; 510 pruebas, ambas compilaciones, CSP y recorrido público local aprobados; no publicado | `cdfe380`, `dd29797`, `0692a81`, `39b9baa` |
| 2026-07-18 | A1: proteger historial local previo a la nube (Codex) | Solo se aplican borrados remotos a registros ya reconciliados; nube vacía/no vacía, segundo dispositivo y fallo remoto cubiertos; texto de continuar sin importar aclarado; 512 pruebas y build en verde; no publicado | `codex/fase2-nube` |
| 2026-07-18 | **Auditorías independientes de la Fase 2 (Fable)** | Tres pasadas sobre la candidata: 5 hallazgos (H1–H4 y A1, este último una regresión que borraba el historial local) reportados y cerrados; pruebas, compilación pública, CSP, precaché y secretos ejecutados por el auditor; A1 verificada con 5 pruebas propias. Aprobación técnica; bloqueos legales y de operación siguen abiertos | `c789235`, `121df13`, `0111145` |
| 2026-07-18 | **Prueba real de dos dispositivos superada (Santiago + Fable)** | Santiago probó la nube en PC y celular contra el proyecto de pruebas: sincronización de ida y vuelta, borrado entre dispositivos y cotización sin señal, todo aprobado. Segundo hallazgo suyo: un cambio pendiente quedaba atascado para siempre tras reiniciar — los disparadores solo escuchaban "online"/"visibilitychange" y al arrancar no ocurre ninguno. Arreglo: intento de subida inmediato al arrancar (`startOutboxTriggers`), con prueba que falla sin él; 513 pruebas en verde. Confirmado en su celular: "Todo está al día" | `e46f662` |
| 2026-07-18 | **Corrección publicada: ventanas emergentes vs. menú inferior (Fable, orden expresa de Santiago)** | Hallazgo de Santiago en su prueba de usuario: en teléfonos, los 9 diálogos (cita, estados, lotes, confirmaciones) quedaban con sus botones incrustados tras el menú fijo y sin desplazamiento; venía de la reorganización C10/E5–E7 y estaba en producción. Regla central de overlays con colchón para el menú + diálogos max-h-full con desplazamiento interno. Verificado en dev (360×640 y 1280), 512 pruebas en la rama nube y 468 en la publicada; cherry-pick a `main` (`0a86e5a`), deploy en verde y sitio en vivo verificado con las medidas correctas. Punto de restauración: tag `punto-seguro-pre-fix-ventanas-2026-07-18` | `8818972` en nube; `0a86e5a` en main |
