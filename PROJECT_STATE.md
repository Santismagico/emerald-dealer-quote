# PROJECT_STATE — Emerald Dealer Quote

> **Ruta canónica del proyecto:** `C:\Dev\emerald-dealer`. Las sesiones nuevas de agentes se abren aquí. La copia bajo OneDrive está congelada y no debe usarse para nuevos cambios.

_Actualizado: 2026-07-26 por Codex al cerrar la trazabilidad de cobros y la corrección visual del formulario de venta. Este archivo es la foto del estado real; cualquier agente debe poder continuar leyendo solo esto y los documentos que enlaza._

> **ESTADO MÁS RECIENTE: trazabilidad y formulario publicados solo en el enlace nuevo.** `Santismagico/emerald-dealer-app` sirve el commit `762dc7c`, compilado desde `codex/fase2-nube@0aca89e`. El piloto de 7 joyerías permanece separado y no fue modificado.

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
- **C14 — recorrido legal técnico cerrado:** Fable inició la corrección y Codex la terminó sin presentar los textos como definitivos. Se verificaron 521/521 pruebas en 35 archivos, PWA, compilación 1.1.0, hash CSP, ausencia de secretos y recorrido móvil de registro/documentos sin desbordamiento. La metadata del navegador no es evidencia jurídica final y la nube pública continúa bloqueada.
- **Verificación de correcciones:** 510/510 pruebas; compilación con nube; compilación pública sin Supabase en `dist/sw.js`; CSP pública exacta; app pública local abierta directamente en el cotizador y sin errores visibles.
- **Verificación de cierre:** 498 pruebas en 34 archivos, PWA, compilación 1.1.0 y hash CSP final aprobados; 0 vulnerabilidades conocidas y ningún secreto detectado.
- **Siguiente decisión:** Santiago completa los datos reales del negocio y entrega los tres borradores a revisión contable/profesional; después se define el registro protegido de aceptación. Publicar únicamente tras cerrar todos los bloqueos premercado y con orden expresa de Santiago.

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

**C14 CERRADA COMO RECORRIDO TÉCNICO, NO COMO APROBACIÓN LEGAL (2026-07-20):** las tres auditorías de Fable y la regresión A1 ya estaban cerradas. La tanda inconclusa de términos quedó terminada y verificada en `codex/fase2-nube`: dos casillas independientes, aviso visible, versiones por documento y primer acceso que no obliga a reemplazar una contraseña propia. El siguiente paso es completar los campos del negocio, obtener revisión profesional y decidir la evidencia protegida en servidor. Después siguen SMTP propio, decisión sobre contraseñas filtradas y N6 sobre el commit final exacto. **No avanzar `main` ni ejecutar el workflow de despliegue sin una orden separada y expresa de Santiago.**

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

## Ampliación de inventario (2026-07-21/22, en curso)

Un comerciante grande de esmeraldas, cliente real, pidió poder revisar si sus
compradores ya le pagaron en las fechas acordadas. Héctor autorizó la ampliación.
Decisiones de negocio y diseño en `docs/PLAN_PIEDRAS_Y_JOYAS_EN_STOCK.md` y en
**D-042 a D-046** de `DECISIONS.md`.

**Terminado y verificado en `codex/fase2-nube` (655 pruebas y compilación en verde):**

- **Crédito al VENDER (D-042).** `StoneSale` estrena `onCredit`, `dueDate`,
  `payments[]` y `buyerId`. `valueCop` pasa a ser el precio ACORDADO; lo recibido,
  el saldo y el atraso se derivan. Las ventas anteriores se normalizan como de
  contado, así que dan exactamente el mismo dinero que antes.
- **Compradores (D-043).** Entidad propia, lista aparte de Clientes, compartida por
  piedras y joyas. Borrarlos conserva nombre, ventas y abonos.
- **Joyas en stock (D-044).** Piezas ya fabricadas, área propia, siempre de contado.
  "Vendida" se deriva de tener venta.
- **Cierres honestos (D-045).** Una venta a crédito no entra a caja el día de la
  venta; los abonos entran el día que se reciben; una joya sale de caja el día que
  entra al inventario.
- **Inventario (D-046).** La pestaña "Piedras" pasa a "Inventario" con tres
  secciones (Piedras · Joyas · Cobros). El menú se queda en cinco botones.
- **Cadena completa:** tipos, `schema.ts`, motores puros `receivables.ts` y
  `stockJewels.ts`, escalón **v6** de IndexedDB (`buyers` + `stockJewels`),
  **BACKUP_VERSION 6** que sigue aceptando v1–v5, storage, dataSource, store,
  outbox, sync, api, importer y migración SQL aditiva.
- **Verificación en navegador:** recorrido real completo (lote, venta a crédito
  vencida, abono que baja el saldo, persistencia tras recargar, joya vendida,
  cierre cuadrado) sin desbordamiento a 320, 375 ni 1280 px.

**PENDIENTE, y es lo único que bloquea:**

1. **Héctor debe aplicar la migración SQL al servidor de producción** siguiendo
   `docs/SQL_PRODUCCION_INVENTARIO.md`. Es aditiva, no borra nada y es repetible.
2. **Después** se publica al enlace nuevo (`Santismagico/emerald-dealer-app`).
   Al revés no: la app pediría tablas que aún no existen.
3. Prueba de dos dispositivos con las entidades nuevas, como se hizo en la Fase 2.

`main` y las 7 joyerías del piloto **no fueron tocadas**.

## Segunda ampliación de inventario: materiales y joyas (2026-07-24/25, en curso)

Héctor pidió (2026-07-24) un inventario de materiales (oro) con dueños, y espacio
propio para joyas pensando en colecciones. Plan en
`docs/PLAN_MATERIALES_Y_JOYAS.md`; decisiones **D-048 a D-050**.

**Terminado y verificado en `codex/fase2-nube` (720 pruebas y compilación en verde):**

- **Inventario de materiales (D-048).** `MaterialLot`: cada compra de oro/plata es un
  lote rastreable con salidas embebidas; existencias derivadas. **Propiedad
  compartida:** por lote se guarda con quién es (`partnerId`/`partnerName`) y cuántos
  gramos son suyos (`myGrams`); el reparto se mantiene sobre el restante. Lista aparte
  que se ajusta a mano: no toca el cotizador. En v1 el dinero del material NO entra a
  los cierres (por ser compartido) y no maneja crédito.
- **Socios de material (D-049).** Entidad propia, aparte de proveedores y compradores.
  Borrarlos conserva nombre y reparto en los lotes.
- **Joyas con espacio propio (D-050).** "Inventario" pasa a cuatro secciones
  (Piedras · Material · Joyas · Cobros). `StockJewel` estrena `collectionId` (null),
  reservado para colecciones futuras; colecciones sin construir todavía.
- **Cadena completa:** tipos, schema, motor `materials.ts`, escalón **v7** de
  IndexedDB (`materialPartners` + `materialLots`), **BACKUP_VERSION 7** que acepta
  v1–v6, storage, dataSource, store, outbox, sync, api, importer y migración SQL
  aditiva.
- **Verificación en navegador:** lote 60/40 creado, salida de 50 g que mantiene el
  reparto (30 tuyos/20 del socio), persistencia tras recargar, sobreventa rechazada,
  alta de socio, sin errores de consola, sin desbordamiento a 320 ni 1280 px.

**PENDIENTE (lo único que bloquea):**

1. **Héctor aplica el SQL a producción** siguiendo `docs/SQL_PRODUCCION_PENDIENTE.md`.
   Son DOS partes (compradores/joyas + socios/materiales), aditivas, no borran nada.
   Este documento reemplaza al anterior `SQL_PRODUCCION_INVENTARIO.md` (que solo traía
   la primera parte y seguía sin aplicarse).
2. **Después** se publica al enlace nuevo (`Santismagico/emerald-dealer-app`).
3. Prueba de dos dispositivos con las entidades nuevas.

`main` y las 7 joyerías del piloto **no fueron tocadas**.

## Trazabilidad de ventas y abonos (2026-07-26, publicada solo en emerald-dealer-app)

Santiago pidió poder revisar después, sin depender de la memoria, cómo se recibió
cada pago, quién lo recibió y qué nota se dejó en la venta.

- Toda venta nueva de piedras de contado, venta de joya disponible y abono nuevo
  exige **forma de pago** y **quién recibió**; las notas vuelven a mostrarse.
- Los registros antiguos se conservan. Cuando carecen de esos datos muestran
  **Sin registrar**, sin inventar información.
- La ficha de la venta, Cobros y los cierres internos muestran el historial. Los
  documentos para el cliente siguen sin recibir notas ni información interna.
- Editar un registro válido no permite borrar accidentalmente la forma de pago o
  el responsable ya guardados.
- En celular, Registrar venta ocupa la pantalla con encabezado y acciones siempre
  visibles; en computador se mantiene centrado. El centro del formulario es la
  única zona que se desplaza.
- Contado/A crédito se presenta como una elección explícita. Si ya existen abonos,
  Contado aparece bloqueado y el historial se conserva.
- Los interruptores de toda la aplicación muestran **Sí/No**, tienen mayor
  contraste, estado accesible y un foco visible.
- Verificación: **751 pruebas en 46 archivos**, compilación de **324 módulos** y
  recorrido local sin errores en 320×568, 390×844 y 1280×720. También se comprobó
  Escape, devolución del foco, fondo inmóvil, abono visible y Contado bloqueado.
- Publicación: fuente `0aca89e`, sitio `762dc7c`, GitHub Pages en estado **built**,
  archivo vivo `/emerald-dealer-app/assets/index-CIj_IEc_.js` y consola limpia.

No se agregaron dependencias, migraciones ni cambios contables. No se tocó
`main`, `.github/workflows/deploy.yml`, el proyecto de Pruebas ni el repositorio
de publicación.

## PLAN MAESTRO v2 — de cotizador a sistema del negocio (2026-08-03, EN CURSO)

Santiago dictó una tanda grande de reorganización, adiciones y mejoras. El plan
completo está en **`docs/PLAN_MAESTRO_V2.md`**; las decisiones de negocio en
**D-052 a D-057**. Punto de restauración: tag `punto-seguro-pre-v2-2026-08-03`
(= `f8dc78e`).

**Diagnóstico:** la app nació para cotizar y creció hasta ser el sistema del
negocio. Quedaron dos consecuencias: la puerta de entrada engaña (abre en el
Cotizador) y los módulos crecieron como silos, sin una forma única de responder
"¿cómo va el negocio?".

**Idea central (D-057):** un **libro del negocio** (`src/services/ledger.ts`),
motor puro que traduce todo a un flujo normalizado de eventos con las mismas
dimensiones. Dashboard, cierres, consolidado y Excel son cuatro presentaciones
de esa única verdad. Por eso el orden de fases **no es negociable**.

**Fases:**

| Fase | Etapas | Riesgo | Depende de |
|---|---|---|---|
| A | A1 Pantalla de inicio | Bajo | diseño que elija Santiago |
| B | B1 Gastos · B2 Sociedades en piedras · B3 Tipo de producto + moneda | Bajo–Medio | Desbloqueada; A-1 y A-2 cerradas |
| C | C1 Bruto → tallado por tandas · C2 Joyas completas + fantasía/natural | **Alto** | B |
| D | D1 Libro del negocio · D2 Cierres leen del libro | Medio | B, C |
| E | E1 Dashboard · E2 Excel · E3 Consolidado | Medio | D |
| F | F1 Catálogo PDF automático | Bajo–Medio | C2 |

**Decisiones cerradas el 2026-08-03 por Santiago:** (A-1) la tasa del dólar se
guarda **en cada operación**, no hay tasa única en Ajustes → D-054; (A-2) el tipo
de producto es una **lista base ampliable** con tipos propios → D-058. Con eso
**la Fase B completa queda desbloqueada**.

**Decisión A-3 cerrada el 2026-08-03:** Santiago vio dos maquetas y eligió **la
mezcla** — portada agrupada por los pasos del negocio, con la cifra del mes
arriba. **Inicio reemplaza a "Más"** en la barra inferior, que queda en Inicio ·
Cotizador · Taller · Agenda · Inventario (siguen siendo cinco, D-046). Registrado
en D-052.

**No quedan decisiones abiertas.** A1, B1, B2, B3, C1, C2, D1 y D2 ya fueron
implementadas. La Fase D queda detenida para auditoría independiente antes de
cualquier trabajo de la Fase E.

**Orden de trabajo entregada a Codex:**
`docs/V2_ORDEN_DE_TRABAJO_CODEX_FASES_A_B.md` cubre A1, B1, B2 y B3 en cuatro
commits separados. Incluye un hallazgo que ahorra trabajo en B3: la aplicación
**ya consulta la tasa USD→COP** en `src/services/goldPrice.ts`
(`open.er-api.com`), ya está en la lista blanca de la CSP, ya tiene límites de
sanidad y ya funciona sin conexión — la moneda **no necesita API, dependencia ni
cambio de CSP nuevos**.

**Fases A y B TERMINADAS y AUDITADAS (2026-08-04).** Codex entregó las cuatro
etapas en cuatro commits (`c666baf`, `5e3019b`, `7f8d2d6`, `f70708a`). Claude las
auditó de forma independiente ejecutando todas las verificaciones:
**846 pruebas en 56 archivos**, compilación, compilación pública sin Supabase con
CSP exacta, sin secretos, sin dependencias nuevas, `main` intacto en `0a86e5a`, y
recorrido real en navegador a 320/375/1280 px. **Veredicto: APROBADO.** Informe en
`docs/AUDITORIA_CLAUDE_V2_FASES_A_B.md`. La observación O1 quedó cerrada con
**D-062** (la tasa del dólar se reutiliza de la fuente del oro en vez de
duplicarla). *Se registró primero como D-059 por error de Claude —Codex ya usaba
ese número para los gastos— y se renumeró al detectarse el choque.*

**Riesgo residual declarado:** la prueba N6 real entre dos cuentas no se pudo
ejecutar (exige credenciales que un agente no debe manejar). El aislamiento de las
tablas y campos nuevos está verificado **por revisión de código**, no de extremo a
extremo. **Santiago decidió el 2026-08-04 resolverlo en el momento de publicar**,
no ahora: no bloquea la construcción y se decide con todo terminado. Sigue abierto
y debe volver a plantearse antes de cualquier publicación.

**Fase C entregada a Codex:** `docs/V2_ORDEN_DE_TRABAJO_CODEX_FASE_C.md`, dos
etapas en dos commits. Es la de **riesgo alto**: cambia el comportamiento del
inventario físico que ya está en producción. Condición central de la orden: *un
lote sin tandas de talla y sin usos internos debe comportarse exactamente como
hoy, hasta el último peso y el último quilate*. Modelo elegido: `cuttingBatches[]`
y `internalUses[]` embebidos en `StoneLot` (mismo patrón que `MaterialLot.uses[]`),
más `origin: 'bruto' | 'tallado'` en cada venta. Regla que más fácil se rompe y
queda marcada: **la transformación fantasía→natural NO es un movimiento de caja**,
es un traslado de costo.

**Fase C TERMINADA y AUDITADA (2026-08-04).** Codex entregó C1 (`14ffeea`) y C2
(`2617c19`). Claude la auditó de forma independiente: **940 pruebas en 62
archivos**, compilación, compilación pública sin Supabase con CSP exacta, sin
secretos, sin dependencias nuevas, migraciones aditivas y `main` intacto.
**Veredicto: APROBADO.** Informe en `docs/AUDITORIA_CLAUDE_V2_FASE_C.md`.

Se comprobaron las dos condiciones decisivas: un lote sin tandas conserva
exactamente existencias, dinero y resultado; y la transformación fantasía→natural
**no mueve caja** (probado desde cuatro ángulos). El servidor rechaza exceder tanto
la existencia en bruto como la tallada, y también los usos internos hacia joyas.

Recorrido real ejecutado en la app: lote de 100 ct/10 pz → tanda de 20 ct/2 pz →
regreso de 6 ct/**3 pz** (piedra partida aceptada) → **merma 70% calculada sola**;
la talla sin pagar aparece aparte y **no** sube la inversión. Sin errores de
consola; sin desbordamiento a 320/375/1280 px.

**Pendiente de prueba de usuario:** Claude no ejecutó la transformación de una
joya en el navegador (sí sus ~700 líneas de pruebas). Conviene que Santiago la
pruebe con una joya real cuando la tenga.

**Fase D entregada a Codex:** `docs/V2_ORDEN_DE_TRABAJO_CODEX_FASE_D.md`. Es el
libro del negocio (`src/services/ledger.ts`, D-057) y **no tiene pantalla**.

Dividida en **dos commits a propósito**, para que el riesgo sea manejable:
**D1** construye el libro *en paralelo* sin tocar `dailyReport.ts`, y su
entregable central es una **prueba de equivalencia** que demuestre que los totales
del libro son exactamente iguales a los de `buildDailyReport` y
`buildMonthlyReport`. **D2** recién entonces hace que los cierres lean del libro,
con la condición de que las pruebas existentes pasen **sin cambiar un solo valor
esperado**. La prueba de D1 es la red de seguridad de D2.

Pieza clave del diseño: `direction: 'entra' | 'sale' | 'ninguna'`. El tercer
estado permite registrar lo que importa para el resultado pero **no es caja** —una
venta a crédito el día que se pacta, un uso interno de piedras, una transformación
de joya, y todos los movimientos de material (D-048 sigue vigente: el material no
toca los cierres)—. `amountCop` va siempre positivo; el sentido lo da `direction`.

Fase D **no cambia datos**: cero campos nuevos, cero migraciones, cero cambios en
la nube.

**D1 implementada el 2026-08-04 (Codex):** `src/services/ledger.ts` construye
un flujo puro con ids derivados y estables, COP enteros, tasa histórica honesta,
módulo, lote, sociedad, tipo de producto y contraparte. Registra ventas y compras
a crédito sin mover caja, abonos en su fecha real, pagos de proveedor, talla y
taller, compras y ventas de joyas, usos internos, transformaciones, cotizaciones,
material y gastos. Una compra de piedras a crédito usa `direction: 'ninguna'` y
solo sus pagos reales al proveedor usan `sale`, para conservar D-045.

La prueba de equivalencia de D1 usa conjuntamente lotes de contado y crédito,
abonos de comprador y cliente, pagos de proveedor, talla pagada y pendiente,
transformación de joya, taller, gastos, cotizaciones y material compartido. El
libro produjo exactamente los mismos `cashIn`, `cashOut` y `net` que los cierres
diario y mensual; en el día rico fueron **$7.900.001**, **$5.150.002** y
**$2.749.999**. `dailyReport.ts` permaneció intacto.

Verificación D1: **943 pruebas en 63 archivos**, comprobación PWA y compilación de
**333 módulos**, todo en verde. No hubo recorrido nuevo de navegador porque D1 no
tiene pantalla ni habilita un recorrido de usuario. Sin dependencias, datos,
migraciones, nube ni publicación; `main`, el piloto y el workflow siguen intactos.

**D2 implementada el 2026-08-04 (Codex):** los cierres diario y mensual ya
construyen el libro completo y filtran sus eventos por período. Todos los totales
de caja y cada categoría de dinero se derivan de `direction` y `kind` del libro;
el cierre conserva sus renglones descriptivos y las fotos actuales de deudas, pero
ya no vuelve a decidir si una operación entra o sale. El historial mensual calcula
el libro una sola vez y reutiliza ese mismo flujo para cada mes.

La red específica de D2 pasó **54 pruebas en 5 archivos**: la equivalencia de D1
y todas las pruebas existentes de cierres diario, inventario, talla y
transformación. No se cambió ningún valor esperado. Verificación completa D2:
**943 pruebas en 63 archivos**, comprobación PWA y compilación de **334 módulos**,
todo en verde. Los PDF internos conservan los mismos renglones y totales. Sin
pantalla nueva, dependencias, datos, migraciones, nube ni publicación; `main`, el
piloto, el workflow, el motor de cálculo y el detector de privacidad siguen
intactos.

**Fase D TERMINADA y AUDITADA (2026-08-04). APROBADA.** Informe en
`docs/AUDITORIA_CLAUDE_V2_FASE_D.md`. Claude ejecutó todas las verificaciones:
**943 pruebas en 63 archivos**, compilación, compilación pública sin Supabase con
CSP exacta, sin secretos, sin dependencias nuevas y `main` intacto en `0a86e5a`.

Alcance respetado con exactitud: **solo dos archivos nuevos** (`ledger.ts` y
`ledger.test.ts`), **cero** migraciones, **cero** componentes, **cero** cambios de
tipos.

Condición de aceptación de D2 cumplida al pie de la letra: `git diff` sobre las
cuatro pruebas de cierres devuelve **vacío**, ninguna fue modificada. Resultado
más fuerte de la fase: **las 940 pruebas anteriores ahora ejercitan el libro sin
saberlo**.

La prueba de equivalencia compara contra los cierres **y además fija valores
absolutos** (7.900.001 / 5.150.002 / 2.749.999), lo que impide el fallo silencioso
de que libro y reporte se dañen del mismo modo. Los importes no son redondos, así
que el redondeo a COP entero queda ejercitado.

D-045 queda honrado **por construcción**: `ledgerCashTotals` solo suma `'entra'` y
`'sale'`, de modo que un evento `'ninguna'` no puede tocar la caja aunque alguien
lo intente. El material genera eventos `'ninguna'` (D-048 intacto). El motor es
puro: sin reloj, sin almacenamiento, sin red, sin aleatorios.

Verificado en la app: ambos cierres renderizan y muestran **"Salió en tallas: $0"**
pese a existir una talla registrada sin pagar — la regla de caja de la Fase C
sobrevive intacta al pasar por el libro.

Observación anotada, sin cambio pedido: `dailyReport.ts` creció de 882 a 915
líneas porque conserva los renglones narrativos que el PDF necesita; **el dinero
sí quedó con una sola fuente**.

**Fase E entregada a Codex:** `docs/V2_ORDEN_DE_TRABAJO_CODEX_FASE_E.md`. Cuatro
commits: **E0** prepara el libro para medir ganancia (sin pantalla), **E1** el
panel, **E2** el Excel, **E3** el consolidado.

**Decisiones nuevas de Santiago (2026-08-04):**

- **D-063 — la ganancia cuenta el día de la venta, no el día del pago.** Vende en
  agosto a crédito y le pagan en octubre: la ganancia es de agosto. Consecuencia
  central y **mayor riesgo de la fase**: ganancia y caja **dejan de ser el mismo
  número** y nunca deben presentarse como si lo fueran ni sumarse entre sí. Una
  compra de inventario no es pérdida: es dinero que cambió de forma. Un mes puede
  tener caja muy negativa y ganancia positiva, y ambas ser correctas.
- **D-064 — las sociedades se comparan por cuánto dejaron Y por qué tan rentables
  fueron.** El porcentaje nunca va solo; si lo invertido es cero, se indica que no
  aplica.

**E0 es la pieza técnica:** cada evento de ingreso del libro gana
`attributedCostCop`, de modo que ganancia = `amountCop` − `attributedCostCop`,
sumable por período, lote, sociedad o tipo de producto. Reutiliza la regla de costo
por quilate que ya usa C2. Dos invariantes obligatorios: el costo atribuido de un
lote nunca supera lo invertido, y al venderse completo coincide exactamente.
Agregarlo **no puede** mover `cashIn`/`cashOut`/`net`: la prueba de equivalencia de
D1 lo vigila.

**E0 implementada el 2026-08-04 (Codex):** el libro derivado ya incorpora
`attributedCostCop` en todos sus eventos. Las ventas de piedras reutilizan la regla
por quilate de C2 y entregan el residuo COP a la última venta que agota el lote; las
joyas atribuyen el costo completo de la pieza; y las cotizaciones aprobadas atribuyen
su costo base conocido. Los abonos conservan costo atribuido cero para no reconocer
dos veces la misma ganancia.

Los invariantes obligatorios quedaron probados con una inversión impar de $1.001:
costos $334 + $334 + $333, nunca por encima de lo invertido y exactamente $1.001 al
agotarse. La equivalencia D1 siguió dando `cashIn`, `cashOut` y `net` peso por peso sin
cambiar esperados. Verificación E0: **945 pruebas en 63 archivos**, PWA y compilación
en verde. No hubo pantalla nueva que recorrer; cero cambios de datos, migraciones,
nube o publicación. **E1 no fue iniciada en este commit.**

**Corrección de registro (2026-08-04):** había **dos decisiones D-059** —la de
gastos de Codex y la del precio del oro que Claude añadió sin notar el choque—.
La segunda se renumeró a **D-062**, con nota en `DECISIONS.md`. La orden de la Fase
E incluye la instrucción de comprobar el número más alto antes de agregar
decisiones nuevas.

Codex **no debe seguir a la Fase F**: el catálogo es la única salida al cliente de
todo el plan v2 y exige revisión de privacidad aparte.

**A1 terminada el 2026-08-03 (Codex):** la aplicación abre en Inicio, con la
portada agrupada elegida en D-052 y el mismo **Movimiento neto** del Cierre
mensual. Inicio conserva todos los destinos de Más, abre directamente las cuatro
secciones de Inventario y ambos cierres, y muestra número solo para citas de hoy,
cobros vencidos y trabajos en proceso. La barra queda Inicio · Cotizador · Taller
· Agenda · Inventario y toda navegación nueva conserva el guardado diferido.

Verificación A1: **754 pruebas en 47 archivos**, compilación de **326 módulos**,
recorrido de todos los destinos y revisión real en 320, 390 y 1280 px, sin
desbordamiento, con botones mínimos de 48 px y sin errores de consola. A1 no
modificó datos, nube, migraciones, el motor de cálculo ni el PDF del cliente.

**B1 implementada el 2026-08-03 (Codex):** Gastos es un área propia de **La plata**
con alta, edición, eliminación confirmada, filtros por fecha, categoría y búsqueda.
Las categorías traen una lista base, aceptan categorías propias y pueden dejar de
ofrecerse sin perder el historial. Cada gasto registra fecha, concepto, categoría,
monto COP, forma de pago, quién pagó, notas y sociedad opcional. El reparto guarda
el nombre histórico del socio y siempre conserva cada peso; el gasto completo sale
de caja el día pagado y ya aparece en los cierres internos.

La cadena de datos quedó completa y aditiva: IndexedDB **v8**, respaldo **v8** que
sigue aceptando v1–v7, recordatorio de respaldo, almacenamiento local, sincronización,
importación y migración SQL nueva con acceso por organización y operaciones protegidas.
Las categorías se guardan sin que una edición simultánea de Ajustes pueda pisarlas.
La eliminación de un socio conserva en los gastos su nombre y reparto históricos.

Verificación automática B1: **786 pruebas en 50 archivos**, comprobación PWA,
**14 controles del guard N6** y compilación de **328 módulos**, todo en verde. No se
agregaron dependencias, no se cambió el motor de cálculo ni el PDF del cliente.

**B2 implementada el 2026-08-03 (Codex):** cada lote de piedras puede ser propio o
compartido con la lista general de **Socios**, indicando el porcentaje de Santiago.
Los lotes anteriores siguen siendo 100% propios. El resultado histórico por precio
acordado permanece intacto y el reparto nuevo usa únicamente dinero real recibido
menos costo; el residuo exacto queda del lado de Santiago, incluso con pérdidas.

Socios ahora resume material, gastos y piedras. Renombrar una ficha actualiza los tres
grupos; borrarla conserva en cada registro el nombre y reparto históricos. La cadena
local, respaldo v8 y nube quedó ampliada sin subir las versiones de IndexedDB,
respaldo ni Ajustes. La migración SQL solo reemplaza el validador protegido de lotes y
mantiene todas sus comprobaciones previas de costo, ventas, crédito y pagos.

Verificación automática B2: **807 pruebas en 50 archivos**, comprobación PWA,
**14 controles del guard N6** y compilación de **328 módulos**, todo en verde. No se
agregaron dependencias, no se cambió el motor de cálculo ni el PDF del cliente. El
recorrido real 60/40, persistencia, eliminación del socio y conservación del reparto
pasó en 320, 390 y 1280 px sin desbordamiento.

**B3 implementada el 2026-08-03 (Codex):** las ventas de piedras y joyas en stock
guardan un tipo de producto administrable; sus ventas anteriores siguen mostrando
"Sin registrar" sin inferencias. Ventas, abonos de compradores y gastos guardan su
propia tasa USD/COP, prellenada con la misma fuente que ya usa el precio del oro y
editable solo antes del primer guardado. Sin conexión se usa la última tasa conocida
con su fecha; una consulta tardía nunca pisa una tasa escrita a mano.

La vista COP/USD vive solo en la pantalla. Convierte cada operación con su propia tasa,
pero los totales y saldos que mezclan tasas permanecen en COP; las operaciones antiguas
sin tasa muestran "Sin registrar". Ajustes sube a v5; IndexedDB y respaldo permanecen
en v8. Respaldo, almacenamiento, sincronización de subida y bajada, y migración SQL
rechazan rangos inválidos y cualquier cambio posterior de una tasa, incluido completar
un `null` histórico. La nube sigue separada por organización y no se agregó otra fuente,
dependencia ni permiso de red.

Verificación automática B3: **846 pruebas en 56 archivos**, comprobación PWA,
**18 controles del guard local** y compilación de **332 módulos**, todo en verde. La
revisión independiente detectó y cerró cuatro puntos antes del commit: una venta nueva
de joya ya no se confunde con la anterior al bajar datos; existe la prueba monetaria
pre-B3 que faltaba; una versión anterior o un segundo dispositivo ya no puede borrar
tipos ni tasas B3; y los nombres personalizados largos no desbordan la pantalla móvil.

Duda registrada para una revisión futura, sin ampliar esta etapa: la capa general de
descarga de nube ya trataba cualquier rechazo como modo sin conexión. Si algún día el
servidor recibe un dato externo dañado, la pantalla puede conservar la copia local sin
explicar la diferencia. B3 sí rechaza y protege el dato; antes de publicar una futura
ampliación de nube conviene distinguir ese caso de una desconexión real.

Recorrido visual B3 completado en 320, 390 y 1280 px: sin desbordamiento,
botones de al menos 44 px, tipos largos conservados, tasa manual fija después de
guardar, conversión individual a USD y regreso a COP tras recargar. Sin errores
visibles ni errores de consola.

**C1 implementada el 2026-08-04 (Codex):** cada lote admite tandas parciales de
talla, con envío, regreso real, merma derivada, costo pendiente o pagado y notas.
Las existencias separan bruto, en talla y tallado; cada venta elige su origen y
los datos físicos que ya respaldan ventas talladas quedan protegidos. Lotes y
ventas anteriores conservan exactamente su comportamiento histórico.

El costo de talla solo aumenta la inversión y sale de caja cuando tiene fecha de
pago. Resultado y reparto incluyen ese costo sin perder un peso. La cadena local,
respaldo v8 y sincronización validan antes de normalizar; la migración SQL aditiva
preparada conserva el aislamiento por organización y rechaza sobreenvíos,
sobreventas y cambios físicos incompatibles. No fue aplicada a producción.

Verificación C1: **858 pruebas en 58 archivos**, comprobación PWA, compilación de
**332 módulos** y recorrido real en 320, 390 y 1280 px. Sin desbordamiento,
controles táctiles mínimos de 44 px, inputs móviles de 16 px ni errores de consola.

**C2 implementada el 2026-08-04 (Codex):** las joyas en stock registran peso,
talla o medida libre, número de piedras y clase fantasía/natural, mientras las
anteriores siguen en “Sin registrar”. Cambiar fantasía por natural crea una sola
historia enlazada: descuenta la existencia correcta del lote, suma el costo
atribuido a la joya y conserva ambas mitades o ninguna. La piedra de fantasía que
sale no se rastrea.

La transformación no crea caja en ninguna fecha y el resultado combinado del
negocio permanece igual. En nube se confirma primero en el servidor; una edición
pendiente del lote o la joya bloquea el cambio hasta subir, y la pareja se baja y
guarda en una sola operación local. Un conflicto retenido puede resolverse usando
la pareja confirmada en la nube: espera cualquier envío ya iniciado y reemplaza
Piedras, Joyas y su cola seleccionada como una sola acción, sin tocar otros módulos;
ante cualquier fallo conserva todo lo local. Respaldos anteriores siguen importando; los
actuales exigen enlaces exactos y restauran costos históricos sin reactivar ventas
ni sobrescribir cambios posteriores. Importar queda reservado a owner/admin.

Verificación C2: **940 pruebas en 62 archivos**, comprobación PWA y compilación de
**333 módulos**, todo en verde. La migración SQL es nueva y aditiva, pero solo se
verificó de forma estática: no se aplicó ni se ejecutó contra PostgreSQL real. El
recorrido real comprobó fantasía → natural, descuento del lote, costo e historia;
la revisión final 320/390/1280 queda registrada en la bitácora de este commit.

Dudas resueltas y límites declarados: deshacer permanece bloqueado porque una
reversa debe devolver inventario y costo a la vez; en cuentas de nube transformar
requiere conexión para no confirmar una realidad falsa; restaurar costo histórico
usa una puerta separada y restringida. `main`, el enlace del piloto y el workflow
de despliegue no fueron tocados. **La Fase D no fue iniciada.**

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
| 2026-07-26 | C15 + E8/E9: trazabilidad y formulario de venta (Codex) | Forma de pago, receptor y notas revisables en ventas, abonos y cierres; protección contra borrado accidental; ventana móvil desplazable con acciones fijas; Contado/A crédito e interruptores aclarados. 751 pruebas, 324 módulos, revisión 320/390/1280 y sitio en vivo en verde; publicada solo en emerald-dealer-app | fuente `1772263` + `0aca89e`; sitio `762dc7c` |
| 2026-08-03 | Plan v2 · A1: Pantalla de inicio (Codex) | Portada agrupada con Movimiento neto mensual, todos los destinos existentes, accesos directos a Inventario/cierres y tres avisos; 754 pruebas, 326 módulos y revisión 320/390/1280 en verde; no publicado | A1 (este commit) |
| 2026-08-03 | Plan v2 · B1: Gastos del negocio (Codex) | Registro y filtros, categorías administrables con historial, reparto opcional con socio, cierres, respaldo v8 y nube protegida; 786 pruebas, guard N6, 328 módulos y revisión 320/390/1280 en verde; no publicado | B1 (este commit) |
| 2026-08-03 | Plan v2 · B2: Sociedades en piedras (Codex) | Reparto sobre resultado real recibido, comparación por socio, historial al renombrar/borrar, respaldo v8 y validación de nube aditiva; 807 pruebas, guard N6, 328 módulos y revisión 320/390/1280 en verde; no publicado | B2 (este commit) |
| 2026-08-03 | Plan v2 · B3: Tipo de producto + moneda (Codex) | Tipos administrables sin inferencias, tasa fija por operación, vista COP/USD sin escrituras, fallback offline, respaldo v8 y nube protegida en ambas direcciones y entre versiones; 846 pruebas en 56 archivos, 18 controles locales, 332 módulos y revisión visual 320/390/1280 en verde; no publicado | B3 (este commit) |
| 2026-08-04 | Plan v2 · C1: Talla por tandas (Codex) | Bruto, en talla y tallado derivados; merma, costos y pagos por tanda; historial físico protegido; compatibilidad anterior, respaldo v8 y migración de nube aditiva; 858 pruebas en 58 archivos, 332 módulos y revisión 320/390/1280 en verde; no publicado | C1 (este commit) |
| 2026-08-04 | Plan v2 · C2: Fantasía → natural (Codex) | Ficha completa de joyas; transformación enlazada y atómica; descuento de piedras, traslado de costo sin caja, respaldo histórico y nube server-first con recepción conjunta; 940 pruebas en 62 archivos, 333 módulos y revisión 320/390/1280 en verde; migración preparada no aplicada; no publicado; Fase D no iniciada | C2 (este commit) |
| 2026-08-04 | Plan v2 · D1: Libro del negocio en paralelo (Codex) | Flujo puro y normalizado de 16 tipos de evento; ids estables, dimensiones completas y caja decidida en un solo lugar; prueba rica de equivalencia diaria/mensual peso por peso; 943 pruebas en 63 archivos, 333 módulos en verde; `dailyReport.ts` intacto; sin pantalla, datos, nube ni publicación | D1 (este commit) |
| 2026-08-04 | Plan v2 · D2: Cierres leen del libro (Codex) | Cierre diario, mensual e historial derivados del mismo flujo; toda categoría, entrada, salida y neto lee `kind`/`direction`; 54 pruebas específicas sin cambiar esperados y 943 pruebas completas en 63 archivos, 334 módulos en verde; PDF intacto; sin pantalla, datos, nube ni publicación; Fase E no iniciada | D2 (este commit) |
| 2026-08-04 | Plan v2 · E0: Costo atribuido en el libro (Codex) | Cada evento derivado incorpora costo atribuido; ventas de piedras reutilizan la regla C2 con residuo exacto, joyas y cotizaciones usan su costo conocido, y cobros no duplican ganancia; 945 pruebas en 63 archivos, PWA y build en verde; caja idéntica; sin pantalla, datos, nube ni publicación; E1 no iniciada | E0 (este commit) |
