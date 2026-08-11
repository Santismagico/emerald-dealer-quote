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

**E1 implementada el 2026-08-04 (Codex):** Inicio → La plata incorpora la pantalla
interna **Ventas y ganancias**, alimentada por el libro. Permite leer día, semana,
mes o año y separa explícitamente: vendido/costo/ganancia; caja que realmente se
movió; y cobros pendientes a la fecha. Incluye ganancia por lote y sociedades con
la parte propia y la del socio, cada una acompañada del porcentaje sobre su inversión;
con inversión cero muestra **"No aplica"**.

La vista COP/USD convierte cada operación con su tasa histórica propia. Las ventas
sin tasa dicen **"Sin registrar"**, se excluyen del total USD y quedan contadas en
un aviso visible; nunca se aplica la tasa actual a datos viejos. Verificación E1:
**950 pruebas en 64 archivos**, PWA y build de **336 módulos** en verde. Recorrido
real en navegador a **320, 390 y 1280 px**: sin desbordamiento horizontal, botones
de 44 px, input de 16 px, cambio Día/Semana/Mes/Año y COP/USD en verde, cero errores
de consola. Sin datos, nube, cliente ni publicación. **E2 no fue iniciada en este
commit.**

**E2 implementada el 2026-08-04 (Codex):** los cierres diario y mensual conservan
su PDF y suman **Descargar Excel**; el panel de ventas usa el mismo generador. Es un
CSV editable con **punto y coma**, **BOM UTF-8**, CRLF y montos crudos como números,
sin `$` ni separadores de miles. La descarga es local directa: no usa Web Share ni
WhatsApp.

Verificación E2: **953 pruebas en 65 archivos**, PWA y build de **337 módulos** en
verde; interfaz a **320, 390 y 1280 px** sin desbordamiento y con botones de 44 px.
Prueba física en Excel de escritorio en español: `cierre-mes-2026-08.csv` abrió con
las columnas separadas, tildes correctas (`Período`, `Sección`) y el monto `100000`
como número editable; una fórmula temporal `=E7+1` devolvió `100001` y luego se
deshizo. El PDF siguió visible junto al nuevo botón. Sin dependencias, datos, nube,
cliente ni publicación. **E3 no fue iniciada en este commit.**

**E3 implementada el 2026-08-04 (Codex):** Inicio → La plata incorpora el
**Consolidado de ventas**, derivado del mismo libro. Permite elegir día, semana, mes
o año y combinar filtros por sociedad y tipo de producto. Los registros anteriores
sin alguno de esos datos aparecen como **“Sin registrar”** en su lista y pueden
aislarse con el filtro correspondiente.

La comparación presenta una al lado de la otra la sociedad que dejó más ganancia
para Santiago y la de mayor rentabilidad sobre su inversión; ambas tarjetas muestran
siempre monto y porcentaje juntos, y mantienen **“No aplica”** cuando no existe una
inversión válida. Su Excel reutiliza el CSV local de E2, registra período y filtros y
exporta solo el resultado consolidado: no mezcla caja sin filtrar con las ventas.

Verificación E3: **957 pruebas en 65 archivos**, PWA y build de **338 módulos** en
verde. Recorrido real a **320, 390 y 1280 px**: sin desbordamiento horizontal,
botones de al menos 44 px, campos de 16 px, cambio Mes/Año, filtros visibles,
comparación lado a lado y descarga del consolidado presentes; cero avisos o errores
de consola. Sin dependencias, datos, migraciones, nube, cliente ni publicación.
**La Fase F no fue iniciada.**

**Corrección de registro (2026-08-04):** había **dos decisiones D-059** —la de
gastos de Codex y la del precio del oro que Claude añadió sin notar el choque—.
La segunda se renumeró a **D-062**, con nota en `DECISIONS.md`. La orden de la Fase
E incluye la instrucción de comprobar el número más alto antes de agregar
decisiones nuevas.

**Fase E AUDITADA (2026-08-04). APROBADA.** Informe en
`docs/AUDITORIA_CLAUDE_V2_FASE_E.md`. Claude ejecutó todas las verificaciones:
**957 pruebas en 65 archivos**, compilación, compilación pública sin Supabase con
CSP exacta, sin secretos, sin dependencias nuevas, **cero migraciones** y `main`
intacto.

**El riesgo central quedó resuelto y demostrado con datos reales.** Con el lote de
prueba de $1.000.000 comprado y sin ventas, el panel muestra **Caja −$1.000.000 y
Ganancia $0** a la vez: comprar inventario no es pérdida (D-063). La pantalla lo
explica al dueño —*"Ganancia y caja son medidas distintas"*, *"No se suma con la
ganancia"*, *"Cobros pendientes: no son ganancia que falte"*—.

**El Excel se verificó sobre los bytes reales del archivo**, no sobre el código:
BOM UTF-8 (`EF BB BF`), separador punto y coma, CRLF, tildes correctas, tipo
`text/csv;charset=utf-8` y **números puros** sin `$` ni puntos de miles. Abrirá
bien en Excel en español. *Nota de método: la primera medición dijo que no había
BOM; era un artefacto de `Blob.text()`, que lo elimina al decodificar. No es un
hallazgo.*

Acierto de Codex no pedido explícitamente: el costo se atribuye en la venta y
**lleva `attributedCostCop === 0` en todos los abonos posteriores**, evitando
contarlo dos veces y subestimar toda ganancia a crédito. La prueba de equivalencia
de D1 quedó intacta (47 líneas añadidas, ninguna eliminada).

**Pendiente menor:** Claude verificó el archivo pero **no abrió Microsoft Excel**
(no está disponible en el entorno). Conviene que Santiago descargue uno y lo abra
una vez.

**Fase F implementada el 2026-08-04 (Codex; última del plan v2):** el inventario de
Joyas permite crear un catálogo PDF de todas las piezas disponibles, solo naturales
o solo fantasía, y elegir en cada generación si muestra precios. Vendidas y apartadas
quedan fuera; “Sin registrar” solo entra en Todas. El archivo se descarga o se entrega
al mismo menú de compartir del PDF cliente, con descarga de respaldo. Las fotos se
reducen antes de incrustarse y un archivo final superior a 15 MB se bloquea con una
explicación en pantalla.

**Decisión nueva — D-065:** el catálogo lleva precio **solo si Santiago lo decide al
generarlo**, no por configuración fija. A un cliente de confianza le manda con
precios; a un desconocido, sin ellos. Cuando va sin precios, el precio no puede
quedar en **ninguna** parte del archivo: omitirlo de la vista pero dejarlo en el
documento sería peor, porque nadie lo revisaría.

**Regla de diseño propia de esta fase:** el catálogo se construye **por lista
blanca, nunca por lista negra**. No se arma desde la joya quitándole lo
confidencial; se arma desde una lista explícita de campos permitidos, de modo que un
campo nuevo que alguien agregue mañana a `StockJewel` **no pueda** aparecer solo.
Nada de `{...jewel}` ni de recorrer claves.

**Las dos capas, y por qué hacen falta las dos:** la lista blanca es la que protege
de verdad; el detector de `pdfContent.ts` es la segunda capa. El detector busca
*palabras* como "costo" o "margen" y **no puede** notar que se imprimió `1200000` en
vez de `1800000`. Contra eso solo protege la estructura.

**Lista exacta de campos leídos de `StockJewel` para construir cada ficha:** `name`,
`pieceType`, `material`, `photo`, `weightGrams`, `size`, `stoneCount`, `stoneKind` y,
solo cuando Santiago elige incluir precios, `priceCop`. La selección previa también
lee `status` y `sale` exclusivamente para excluir apartadas y vendidas; esos dos
campos no pasan a la copia segura ni al documento. No se leen `costCop`, `notes`,
`acquiredDate`, `collectionId`, fechas, transformaciones ni datos vinculados.

Verificación F1: la prueba del número delator `987654` y la nota inconfundible pasan
con precios y sin precios; sin precios tampoco aparece `priceCop`; filtros,
disponibilidad, lista blanca exacta, detector final, pieza sin foto, peso máximo y
compartir están cubiertos. Resultado completo: **970 pruebas en 66 archivos**, PWA y
compilación de **340 módulos** en verde. Recorrido real a **320, 390 y 1280 px**:
sin desbordamiento horizontal, controles mínimos de 44 px, filtros, descargas con y
sin precio y menú de compartir aprobados; cero avisos o errores de consola. La pieza
temporal se eliminó al terminar.

Sin dependencias, campos, migraciones, cambios de datos, nube ni publicación.
`src/calc/engine.ts` y `src/services/pdfContent.test.ts` siguen sin cambios. `main`,
el piloto y `.github/workflows/deploy.yml` permanecen intactos. **El plan v2 queda
completo**, pendiente de la auditoría de privacidad separada de Claude antes de que
Santiago considere publicar cualquier cosa.

**AUDITORÍA DE PRIVACIDAD DE LA FASE F (2026-08-04). APROBADA.** Informe en
`docs/AUDITORIA_CLAUDE_V2_FASE_F_PRIVACIDAD.md`. **970 pruebas en 66 archivos**,
compilación, compilación pública, sin secretos, sin dependencias, cero migraciones,
`main` intacto.

**La lista blanca no depende de disciplina: la impone el lenguaje.**
`buildCatalogPdfContent` recibe `CatalogJewel[]`, **no** `StockJewel[]`, así que el
sistema de tipos hace imposible que una joya completa llegue al documento. Un campo
que alguien agregue mañana a `StockJewel` no tiene camino por donde aparecer. Está
mejor resuelto de lo que pedía la orden: se pidió una convención y se entregó una
garantía del compilador.

**Verificación independiente del auditor, sobre PDF reales.** Claude creó en la app
una joya trampa (costo `987654`, precio `7654321`, nota `NOTA-INTERNA-31415926`),
generó los dos catálogos y **escaneó los bytes crudos**:

| | Sin precios | Con precios |
|---|---|---|
| Costo `987654` | AUSENTE | AUSENTE |
| Nota interna | AUSENTE | AUSENTE |
| Precio `7654321` | AUSENTE (correcto) | Presente (correcto) |
| Palabras costo/margen/utilidad | — | AUSENTES |

Dos notas que hacen válida la prueba: el PDF **no está comprimido**, así que un
resultado negativo es concluyente; y el **nombre de la pieza sí aparece**, lo que
demuestra que la búsqueda encuentra contenido cuando lo hay.

Aciertos no pedidos: el total del catálogo es un **conteo de piezas, no una suma de
dinero** —así ni con precios se publica el valor del inventario—; los precios vienen
**apagados por defecto**; y la prueba del número delator usa `digitsOnly`, que atrapa
el costo aunque salga formateado como `$ 987.654` (la especificación de Claude no
cubría ese caso).

**Observación sin cambio pedido:** el catálogo lleva los datos de contacto del
negocio, **incluido el NIT**. Es correcto y coherente con el PDF de cotización, pero
queda dicho: el catálogo identifica públicamente al negocio.

---

# PLAN MAESTRO v2 COMPLETO (2026-08-04)

Seis fases construidas por Codex y **auditadas de forma independiente por Claude**,
una por una. `main` y las 7 joyerías del piloto **no fueron tocadas en ningún
momento**. **Nada publicado.**

| Fase | Contenido | Auditoría |
|---|---|---|
| A | Pantalla de inicio | APROBADA |
| B | Gastos · Sociedades en piedras · Tipo de producto y moneda | APROBADA |
| C | Talla por tandas · Joyas fantasía/natural | APROBADA |
| D | El libro del negocio | APROBADA |
| E | Panel · Excel · Consolidado | APROBADA |
| F | Catálogo PDF | APROBADA (privacidad) |

De **751 pruebas en 46 archivos** al empezar a **970 en 66** al terminar, sin una
sola dependencia nueva.

**LO QUE SIGUE YA NO ES TÉCNICO.** Quedan tres asuntos, todos decisión de Santiago:

1. **La prueba N6 en vivo** —demostrar en un servidor real que una joyería no ve los
   datos de otra— sigue abierta desde la Fase B. Santiago decidió el 2026-08-04
   resolverla **al publicar**. Verificado por revisión de código, no de extremo a
   extremo.
2. **Abrir un Excel una vez** para cerrar el único punto indirecto de la Fase E.
3. **Si publicar, cuándo y cómo**, y a cuál de los dos enlaces.

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
| 2026-08-04 | Plan v2 · E1: Panel de ventas y ganancias (Codex) | Día/semana/mes/año; ganancia, caja y cobros separados; ganancia por lote; sociedades con monto y rentabilidad; COP/USD por tasa propia con históricos "Sin registrar"; 950 pruebas en 64 archivos, 336 módulos y revisión 320/390/1280 en verde; sin datos, nube ni publicación; E2 no iniciada | E1 (este commit) |
| 2026-08-04 | Plan v2 · E2: Excel editable (Codex) | Cierres diario/mensual y panel exportan CSV local con punto y coma, BOM UTF-8, tildes y números editables; PDF conservado; prueba física en Excel español confirmó columnas y fórmula sobre monto; 953 pruebas en 65 archivos, 337 módulos y revisión 320/390/1280 en verde; sin dependencias, datos, nube ni publicación; E3 no iniciada | E2 (este commit) |
| 2026-08-04 | Plan v2 · E3: Consolidado con filtros (Codex) | Día/semana/mes/año; filtros combinables por sociedad y producto, incluido “Sin registrar”; comparación lado a lado por ganancia propia y rentabilidad; Excel interno sin mezclar caja; 957 pruebas en 65 archivos, 338 módulos y revisión 320/390/1280 en verde; sin datos, nube ni publicación; Fase F no iniciada | E3 (este commit) |
| 2026-08-04 | Plan v2 · F1: Catálogo PDF para clientes (Codex) | Lista blanca de campos, piezas disponibles por clase, precios elegibles en cada generación, fotos reducidas, bloqueo de privacidad y peso, descarga y compartir; 970 pruebas en 66 archivos, 340 módulos y revisión 320/390/1280 en verde; sin datos, nube ni publicación; **plan v2 completo** | F1 (este commit) |
| 2026-08-04 | Correcciones R1 · C1: Excel con formato real (Codex) | `.xlsx` con números y fechas reales, negativos en rojo, encabezado fijo, anchos calculados y pestaña Detalle; archivo abierto en Microsoft Excel sin reparación; dependencia 4.1.1 diferida (71.185 bytes minificados, 20,00 kB gzip); 970 pruebas, 422 módulos, controles públicos y revisión 320/390/1280 en verde; PDF intacto; no publicado | C1 (este commit) |
| 2026-08-04 | Correcciones R1 · C2: compra en bruto o ya tallada (Codex) | Campo aditivo con legado en bruto; compra tallada entra directo a tallado, sin tandas ni merma; ventas, joyas, crédito, sociedad y costo conservados; protección local y migración de servidor; 975 pruebas, 422 módulos y revisión 320/390/1280 en verde; sin cambios de dinero, PDF, datos ni publicación | C2 (este commit) |
| 2026-08-04 | Correcciones R1 · C3: joya vendida visible (Codex) | Tras vender limpia búsqueda, cambia a Vendidas y enfoca la pieza; cuatro acciones con borde, fondo y 44 px; fecha, pago, receptor y tasa conservados; auditoría reportó el mismo riesgo en el filtro de cotizaciones y no lo amplió; 975 pruebas, 422 módulos y revisión 320/390/1280 en verde; no publicado | C3 (este commit) |
| 2026-08-04 | Correcciones R1 · C4: borrar lote conservando la historia (Codex) | El nombre del lote queda guardado en cada joya antes de borrarlo; costo y resultado de la joya, Cierre del día, mensual y panel permanecen idénticos; respaldo, importación y servidor contemplados; 981 pruebas, 422 módulos y recorrido real 320/390/1280 en verde; migración preparada no aplicada; no publicado | C4 (este commit) |
| 2026-08-04 | Correcciones R2 · R2-1: un solo vocabulario (Codex) | Barra e Inicio comparten Cotizador, Taller, Inventario y Dinero; Agenda pasa a Otras cosas; Dinero reúne Panel, cierres, Consolidado y Gastos; todos los destinos comprobados; 982 pruebas, 423 módulos y revisión 320/390/1280 sin desbordamiento; no publicado | R2-1 (este commit) |
| 2026-08-04 | Correcciones R2 · R2-2: gráfica financiera en Inicio (Codex) | Cifra, cambio y área para 1 día/7 días/30 días/1 año; una medida Ganancia/Caja; Caja mensual idéntica al cierre; arrastre táctil y globo contenido; primer pintado no bloqueado y prueba con 5.000 cotizaciones; 985 pruebas en 68 archivos, 425 módulos y revisión 320/390/1280 sin desbordamiento; no publicado | R2-2 (este commit) |

## Correcciones de la prueba de usuario de Santiago (2026-08-04, R1)

Santiago probó la aplicación tras completarse el plan v2 y encontró **cuatro cosas**.
Orden en `docs/V2_ORDEN_CORRECCIONES_SANTIAGO_R1.md`, cuatro commits.
Decisiones **D-066 a D-069**.

**Dos de los cuatro no son errores de código, son decisiones de diseño de Claude que en
la práctica no funcionan.** Mismo antecedente de siempre: sus pruebas encuentran lo que
las revisiones técnicas no ven.

- **C1 · Excel sin formato (D-066).** Rechazó el archivo: quería una hoja presentable.
  El CSV es texto plano y **no admite formato**; no es mejorable dentro de ese formato.
  Se pasa a `.xlsx` real. **Se acepta la primera dependencia del proyecto**,
  `write-excel-file`, elegida entre tres candidatas por ser la más liviana (1,8 MB frente
  a 21,8 MB de `exceljs`), con una sola dependencia interna, MIT y pensada para el
  navegador. Condiciones: versión exacta, **carga diferida** con el patrón que ya usa
  Supabase, sin cambios de CSP. Se descartó escribir el generador a mano porque **ningún
  agente puede abrir Excel** para comprobar el archivo.
- **C2 · Todo lote se asumía comprado en bruto (D-067).** Vacío del modelo de D-055:
  comprar piedras ya talladas obligaba a inventar una tanda con 0% de merma. Se agrega
  `purchaseOrigin: 'bruto' | 'tallado'`. Los lotes existentes normalizan a `'bruto'` y no
  cambian en nada.
- **C3 · La joya vendida se pierde de vista (D-068).** `Editar venta` **sí existe**; el
  problema es que al vender la pieza sale del filtro "En vitrina" —el puesto por
  defecto— y la lista queda en "Sin piezas". Reproducido por Claude. Además las acciones
  de la ficha se ven **sin borde ni fondo**: parecen texto, no botones.
- **C4 · No se podía borrar un lote (D-069).** El bloqueo sobraba: la joya **guarda su
  propio costo** al transformarse (`stoneJewelTransformation.ts:245`), así que borrar el
  lote no cambia ni un peso. Se permite borrar conservando el nombre histórico del lote
  en la joya, igual que con proveedores, compradores y socios.

**C1 ejecutada (2026-08-04).** Cierres, panel y consolidado descargan `.xlsx` real con
el diseño aprobado: título esmeralda, documento interno, secciones, totales, números
editables, pérdidas en rojo, fechas reales, anchos calculados y encabezado fijo. La
dependencia `write-excel-file` quedó fijada en 4.1.1 y separada de la carga inicial:
71.185 bytes minificados, 20,00 kB gzip. El archivo descargado abrió en Microsoft Excel
sin reparación y confirmó fecha y dinero numéricos, fila 6 congelada y anchos aplicados.
`npm test`: **970 pruebas en 66 archivos**; compilación: **422 módulos**; versión pública,
secretos y CSP aprobados. Recorrido 320/390/1280 sin desbordamiento, botón de 48 px y sin
errores. PDF, `main`, piloto y workflow intactos; nada publicado. **C2 no iniciada en
este commit.**

**C2 ejecutada (2026-08-04).** Cada compra permite elegir **En bruto** o **Ya tallado**.
Los lotes tallados entran directamente a la existencia tallada y no muestran tandas ni
merma. Los lotes anteriores reciben “bruto” al leerlos y mantienen exactamente
existencias, inversión, deuda, resultado y reparto. Ventas talladas, usos hacia joyas,
crédito y sociedades siguen disponibles.

La misma regla se valida en el dispositivo y en la migración aditiva del servidor; la
migración está preparada pero **no fue aplicada**. `npm test`: **975 pruebas en 67
archivos**; compilación: **422 módulos**. En navegador se creó un lote tallado real y se
confirmó en 320, 390 y 1280 px que solo muestra existencia tallada, sin tandas ni merma,
sin desbordamiento, con acciones de 48 px o más y sin errores de consola. `main`, piloto,
workflow, PDF, datos existentes y dinero permanecen intactos; nada publicado. **C3 no
iniciada en este commit.**

**C3 ejecutada (2026-08-04).** Después de registrar una venta, Joyas limpia cualquier
búsqueda, cambia automáticamente a **Vendidas** y enfoca la pieza que acaba de salir de
la vitrina. Se comprobó con la última pieza disponible: la lista no queda vacía y Editar
venta permanece al alcance. Editar venta, Deshacer venta, Editar pieza y Eliminar ahora
son botones visibles con borde, fondo y 44 px de altura.

La edición conserva fecha, medio de pago, receptor y tasa. `npm test`: **975 pruebas en
67 archivos**; compilación: **422 módulos**. Recorrido real completo en 320, 390 y 1280
px, sin desbordamiento ni errores de consola. La auditoría pedida encontró el mismo
riesgo en el Historial de cotizaciones al cambiar de estado bajo un filtro específico;
se reporta y queda fuera de C3. Piedras mantiene abierto su detalle y Cobros no tiene
filtros, por lo que no repiten el defecto. `main`, piloto y workflow intactos; nada
publicado. **C4 no iniciada en este commit.**

**C4 ejecutada (2026-08-04).** Un lote puede borrarse aunque haya aportado piedras a una
joya vendida. Antes de eliminarlo, su nombre queda guardado en la historia de la joya;
el aviso explica que se pierde la ficha del lote, no el costo ni el resultado de la
joya. La misma regla quedó cubierta en el dispositivo, el servidor, los respaldos y la
importación.

La prueba obligatoria dejó idénticos el costo y el resultado de la joya, el Cierre del
día, el mensual y el panel antes y después del borrado. `npm test`: **981 pruebas en 67
archivos**; compilación: **422 módulos**. El recorrido real creó, transformó y vendió una
joya, borró su lote y confirmó que la historia seguía mostrando el nombre original y los
mismos valores en 320, 390 y 1280 px, sin desbordamiento y con acciones de 44 px. La
migración del servidor está preparada pero **no fue aplicada**. `main`, piloto, workflow,
PDF y motor de cálculo intactos; nada publicado. **R1 completa para auditoría.**

`main`, el piloto y el workflow **sin tocar**. Nada publicado.

## Pendientes abiertos con Santiago (2026-08-04, sin construir)

Dos cosas que Santiago pidió después de las correcciones R1. **Ninguna está
implementada ni ordenada todavía.**

**1. Limpiar la navegación (pendiente de su visto bueno).** Reportó que la app confunde.
Diagnóstico: al agregar la pantalla de inicio (A1) quedaron **dos vocabularios para las
mismas cosas** — Inicio habla de acciones (Vender, Producir y atender, La plata) y la
barra habla de lugares (Cotizador, Taller, Agenda). Solo "Inventario" coincide. Es un
error de diseño de Claude, no de implementación.

Propuesta presentada: **el primer grupo de Inicio pasa a ser exactamente la barra**,
mismos nombres y orden — Cotizador · Taller · Inventario · **Dinero** (antes "La plata")—
más Inicio. La **Agenda sale de la barra** porque Santiago confirmó que no la usa; los
seis grupos de Inicio pasan a tres. Nada desaparece. Pendiente de que Santiago apruebe
los nombres.

Dato que lo sustenta: preguntado qué usa a diario, respondió **las cuatro** —cotizar,
taller, inventario y la plata—; la agenda no.

**2. Agenda con reserva de citas por parte del cliente (decisión de Santiago).** Se le
advirtió que es un proyecto aparte y de tamaño grande, y **aun así lo eligió** sobre
quitarla o borrarla. Queda aceptado como proyecto propio, a planear **después** de que
las correcciones R1 estén auditadas.

Realidades que su planeación deberá resolver, y que ya se le explicaron:

- Exige una **superficie pública** que los clientes puedan abrir. Hoy la aplicación es
  solo del joyero.
- **Riesgo de seguridad nuevo y el mayor del proyecto:** sería la primera vez que algo
  escribe en la base de datos **sin un usuario con sesión iniciada**. Toca el aislamiento
  entre joyerías, que además sigue sin demostrarse en vivo (N6).
- Los **avisos automáticos** por correo chocan con el bloqueo de SMTP propio, pendiente
  desde hace meses.
- Un formulario público atrae **abuso** y necesita defensa.
- Recoger datos de clientes en público toca los **documentos legales**, todavía en
  borrador.

**Forma recomendada para una v1 que esquiva el bloqueo de SMTP:** enlace privado por
joyería, el cliente elige entre horarios que el joyero definió y deja nombre, WhatsApp y
motivo; la cita entra a la Agenda como **pendiente de confirmar**; el joyero confirma en
la aplicación y contacta él mismo por WhatsApp. Sin correo automático, sin depender de
nada externo.

### R2 entregada a Codex (2026-08-04): navegación y gráfica

Santiago aprobó los nombres. Orden en `docs/V2_ORDEN_CORRECCIONES_SANTIAGO_R2.md`, dos
commits. Decisiones **D-070** y **D-071**. **Va después de R1**, que toca las mismas
pantallas.

- **R2-1 (D-070).** La barra queda **Inicio · Cotizador · Taller · Inventario · Dinero**
  y es **exactamente el primer grupo de Inicio**. "La plata" pasa a **Dinero** arriba y
  abajo; la Agenda sale de la barra; los seis grupos pasan a tres. **Dinero** se vuelve un
  área con secciones, copiando el patrón que ya usa Inventario. Ninguna ruta desaparece.
- **R2-2 (D-071).** El número suelto pasa a **gráfica de área** con 1 día / 7 días /
  30 días / 1 año e interruptor **Ganancia / Caja**, alimentada por el libro (D-057).

**R2-1 implementada y verificada (Codex, 2026-08-04).** La barra quedó en **Inicio ·
Cotizador · Taller · Inventario · Dinero** y el primer grupo de Inicio repite esos cuatro
destinos en el mismo orden. Inicio ahora solo tiene **Tu día a día · Tu gente · Otras
cosas**. Agenda conserva su aviso dentro de Otras cosas y no ocupa la barra.

Lista completa de destinos y desde dónde se alcanzan tras el cambio:

- **Inicio:** botón Inicio de la barra; desde allí se abren todos los grupos.
- **Cotizador:** barra o Inicio → Tu día a día; conserva historial, nueva cotización,
  edición y vista previa.
- **Taller:** barra o Inicio → Tu día a día; conserva lista y detalle de cada trabajo.
- **Inventario:** barra o Inicio → Tu día a día; dentro están Piedras, Material, Joyas y
  Cobros.
- **Dinero:** barra o Inicio → Tu día a día; dentro están Panel, Cierre del día, Cierre
  mensual, Consolidado y Gastos.
- **Clientes, Compradores, Proveedores y Socios:** Inicio → Tu gente.
- **Agenda:** Inicio → Otras cosas; conserva su aviso de citas del día.
- **Ajustes y cuenta:** Inicio → Otras cosas; Ajustes conserva el acceso a Cuenta cuando
  hay nube, y Cuenta conserva Importar datos y el regreso a Ajustes.

Recorrido real: los 10 accesos de Inicio, las 4 secciones de Inventario y las 5 de
Dinero abrieron su destino. En **320, 390 y 1280 px** no hubo desbordamiento; la barra
midió 64 px de alto y las secciones 44 px. `runAfterViewFlush` quedó intacto. Cierre:
**982 pruebas en 67 archivos**, PWA verificada y compilación de **423 módulos**. Sin
migraciones, campos, dependencias ni cambios en dinero; `main`, piloto y workflow
intactos. Nada publicado.

**Una sola medida a la vez, y no es preferencia:** los dos colores de la identidad se
validaron con un simulador de daltonismo y quedan a **ΔE 4.5 en protanopía y 15.0 en
visión normal**, por debajo del mínimo legible. Colores validados para la serie única:
`#0b7f57` en claro y `#2fa87a` en oscuro (el `#34b583` de la app queda fuera de banda).

**Promesa de D-052 conservada:** con Caja y el mes seleccionados, la cifra debe ser
exactamente la del Cierre mensual, con prueba obligatoria.

**Riesgo marcado:** el inicio es la primera pantalla; construir un libro de un año antes
de pintar la volvería lenta justo en el peor sitio. Se exige no bloquear el primer
pintado y **reportar cuánto tarda**.

Claude probó la maqueta y encontró que el globo de información **se desborda a 320 px**
sin recorte; queda exigido en la orden.

**R2-2 implementada y verificada (Codex, 2026-08-04).** Inicio muestra cifra grande,
cambio y gráfica de área con **1 día · 7 días · 30 días · 1 año**, alternando una sola
medida entre **Ganancia** y **Caja**. La prueba obligatoria confirma que Caja con “30
días” coincide exactamente con el Cierre mensual. Ganancia reconoce la venta en su
fecha y Caja el dinero cuando realmente entra.

La gráfica se recorre con toque o arrastre; el globo permaneció dentro de ambos bordes
en 320 px. No hubo desbordamiento en **320, 390 ni 1280 px** y todos los controles
midieron 44 px. Sin datos y con un solo día aparecen mensajes claros, y la gráfica no
usa animaciones.

Prueba abundante: **5.000 cotizaciones ficticias**. El primer contenido apareció con una
mediana de **752 ms** y un máximo de **1,076 s** en tres recargas; construir el libro
después del primer pintado tomó entre **10,2 y 13,6 ms**. Cierre: **985 pruebas en 68
archivos**, PWA verificada y compilación de **425 módulos**. Sin dependencias,
migraciones, campos ni publicación; `main`, piloto y workflow intactos.

### R1 AUDITADA (2026-08-04). APROBADA.

Informe en `docs/AUDITORIA_CLAUDE_CORRECCIONES_R1.md`. **981 pruebas en 67 archivos**,
compilación, compilación pública, sin secretos, `main` intacto.

**El Excel se verificó abriendo el archivo real por dentro:** se generó un cierre desde
la aplicación, se descomprimió el `.xlsx` y se leyó su XML. Encabezados fijos
(`<pane ySplit="6" state="frozen"/>`), anchos de columna calculados (33/34/24/11/24),
**9 celdas numéricas sin `t="s"` —son números y se pueden sumar—**, fechas como fechas
(`dd/mm/yyyy`) y formato de moneda `"$" #,##0;[Red]-"$" #,##0` con negativos en rojo.
La dependencia cumple las cinco condiciones de D-066: única, versión exacta `4.1.1`,
carga diferida, sin cambios de CSP, y en un trozo aparte de 49 kB comprimidos.

**C3 se verificó usando la aplicación:** se creó y vendió una joya. Donde antes aparecía
"Sin piezas", ahora la pieza permanece visible con toda su venta, y sus cuatro acciones
tienen borde, fondo y 44 px de alto.

**Corrección de Claude a sí mismo (O1):** le dijo a Santiago que la librería del Excel
"no ocupa más en tu teléfono". **Es falso**: el trozo sí está en la precarga del service
worker, unos 49 kB comprimidos al instalar. **No se pide cambio**: precargarlo es lo
correcto, porque si no, exportar sin internet fallaría y la aplicación es de uso sin
conexión por diseño. Lo que estuvo mal fue la frase, no el código.

**Observación abierta (O2):** el verde del Excel es `#0F5B46`, más oscuro que el acento
`#0b7f57`, sin una línea que lo explique. La elección es correcta —mejor contraste con
texto blanco— pero el proyecto exige registrar las desviaciones de identidad.

**Sigue pendiente (O3):** Claude no puede abrir Microsoft Excel. Basta con que Santiago
abra uno y sume una columna para cerrar ese punto.

**SIGUIENTE: R2**, ya escrita y con los nombres aprobados por Santiago.

### R2 AUDITADA (2026-08-04). APROBADA.

Informe en `docs/AUDITORIA_CLAUDE_CORRECCIONES_R2.md`. **985 pruebas en 68 archivos**,
compilación, compilación pública, **`test:csp` aprobado**, sin secretos, sin dependencias,
cero migraciones, `main` intacto.

**Verificado usando la aplicación:** barra `Inicio · Cotizador · Taller · Inventario ·
Dinero` (cinco, D-046 intacto) y el primer grupo de Inicio la refleja exactamente —el
corazón de la corrección—. Tres grupos en vez de seis; la Agenda salió de la barra sin
borrarse; **Dinero** agrupa los cinco destinos con el patrón de Inventario.

**La gráfica funciona y las cuentas cuadran:** con una joya vendida (1.200.000, costo
500.000) y un gasto de 300.000 fechado el 29 de julio, Caja·1 año muestra **400.000 y
dibuja**; Caja·mes muestra 700.000 porque julio queda fuera del mes calendario. Con un
solo día muestra el mensaje de datos insuficientes. La pantalla declara *"Es exactamente
la misma cifra del Cierre mensual"*. Colores validados usados tal cual. El globo se dibuja
**dentro del SVG** y con recorte en ambos ejes: imposible que se salga. Tiempo de
construcción del libro expuesto e inspeccionable: 0,1–0,5 ms.

**Los errores de CSP en consola NO son de la aplicación:** `test:csp` verifica el hash
propio; el script bloqueado lo inyecta el entorno de pruebas.

**Nota de método:** Claude tuvo **tres falsas alarmas**, todas suyas —buscar el commit del
Excel en el rango equivocado, meter el monto en la casilla de la tasa, y leer el DOM antes
de que la pantalla se redibujara—. La aplicación se comportó bien en los tres casos.

**PREGUNTA ABIERTA PARA SANTIAGO (O1):** *"Ganancia" no descuenta los gastos del negocio.*
Es coherente con D-063 —ganancia = lo vendido menos lo que costó lo vendido— y el código
hace lo especificado. Pero Santiago pidió los gastos diciendo que *"sin gastos, cualquier
ganancia sería mentira"*, así que puede esperar que "Ganancia" ya venga con el arriendo
descontado. Dos lecturas legítimas: dejarla como margen de ventas, o agregar una tercera
cifra **Resultado del negocio** que sí reste los gastos. **Decisión suya.**

**Quedan cerradas todas las tandas de corrección de la prueba de usuario.**

---

## 2026-08-05 — Publicación, paso 1: el servidor de Pruebas quedó completo

**Hallazgo grave: `Emerald Dealer Pruebas` estaba a medias y el editor había dicho
*Success*.** De los 198.240 caracteres del SQL unido solo habían entrado **46.360 (23%)**,
justo en la frontera tras la quinta migración. Existían las 9 tablas base; faltaban
`buyers`, `stock_jewels`, `material_partners`, `material_lots` y `expenses`. El corte se
detectó porque la prueba de aislamiento falló con `42P01: relation "public.buyers" does not
exist`, no porque el editor avisara.

**Lección operativa:** *Success* en el editor SQL de Supabase **no prueba que entró todo**.
Cualquier pegado grande debe terminar en una consulta que verifique lo que acaba de crear.

**Cómo se resolvió.** Las 10 migraciones faltantes se repartieron en 6 bloques de 21–33 mil
caracteres (`PARA-SANTIAGO/PARTE-1.sql` … `PARTE-6.sql`), respetando el orden y sin partir
ningún bloque `$$`. Cada bloque termina en su propia comprobación. Todas dieron verde.

Dos cosas que hay que saber para repetir esto en Producción:

- **La comprobación por nombre no sirve.** Casi todas las migraciones *reemplazan*
  funciones que ya existen, así que "existe" da verde aunque el bloque no haya corrido. Las
  comprobaciones se rehicieron sobre `pg_proc.prosrc like '%marca%'`, con una frase propia
  de la versión nueva de cada función.
- **`PARTE-6` no es repetible por sí sola:** contiene cuatro `alter function … rename to`.
  Se les puso un candado (`if not exists`) para poder reintentar sin romper nada.
- **Identificador truncado, no es un defecto.**
  `seed_stock_jewel_transformation_import_before_deleted_lot_history` mide **65 caracteres**
  y PostgreSQL corta a 63: en la base queda `…_before_deleted_lot_histo`. Postgres trunca
  igual dentro del cuerpo de la función, así que la llamada resuelve bien. Viene del archivo
  de migración original y **Producción hará exactamente lo mismo**.

**Prueba de aislamiento: 40 controles, 0 problemas.** Se hizo **en SQL, no con N6**, porque
Santiago pidió no usar los archivos de doble clic. Cubre: lectura cruzada bloqueada en las
14 tablas en ambos sentidos, lectura propia correcta (incluidas las tablas nuevas),
escritura directa rechazada (propia y ajena), membresía ajena rechazada, la RPC escribiendo
solo en la joyería del que llama, y el anónimo sin leer ni escribir. Limpieza verificada.
**No cubre** lo que sí cubre N6: la capa HTTP real con sesiones iniciadas, numeración
concurrente, cargas malformadas e inmutabilidad de tasas USD — y **no genera**
`security-evidence/n6-evidence.json`, que es lo que `npm run security:evidence` exige.

**RIESGO ABIERTO — leer antes de tocar Producción.** El plan de publicación da por hecho
que a `Emerald Dealer Produccion` solo le faltan **7** migraciones, y
`PARA-SANTIAGO/sql-para-produccion.sql` contiene solo esas 7. Pruebas demostró que el estado
real de un proyecto puede no coincidir con los papeles. **Antes de pegar nada en Producción
hay que correr allí la misma consulta de diagnóstico de solo lectura** (las 14 tablas +
`pg_proc`). Si Producción también está más atrás de lo documentado, ese archivo se queda
corto y publicar rompería la app del dueño.

**Git:** se commiteó `.gitignore` ignorando `PARA-SANTIAGO/` (`a03bcdf`). Sin eso, N6 se
niega a correr: exige árbol limpio y los archivos generados lo ensuciaban.

### El riesgo se cerró: Producción sí estaba como decían los papeles

La consulta de diagnóstico en `Emerald Dealer Produccion` confirmó el supuesto del plan:
tenía aplicadas las migraciones **0001 a 20260725** y le faltaban exactamente **7**, con
`expenses` como única tabla ausente. `sql-para-produccion.sql` era el archivo correcto.

**Las 7 se aplicaron en 6 bloques, cada uno verificado antes de seguir al siguiente.** El
primero fue solo `gastos`; los cinco restantes son idénticos a los bloques 2–6 usados en
Pruebas, ya probados. Todas las comprobaciones dieron verde. **Producción tiene ahora las
15 migraciones completas.**

Dos correcciones que se aplicaron sobre los bloques de Pruebas antes de usarlos en
Producción:

- El candado del renombrado de `seed_stock_jewel_transformation_import` usa el nombre
  **truncado a 63** (`…_before_deleted_lot_histo`). Con el nombre largo de 65 el `if not
  exists` nunca coincide y el reintento habría fallado.
- La comprobación de ese objeto también busca el nombre truncado, para no repetir la falsa
  alarma que apareció en Pruebas.

**Estado tras el paso 2:** el servidor va por delante de la aplicación publicada, que es el
orden correcto. La app que el dueño tiene instalada **sigue funcionando igual**: no consulta
las tablas nuevas, así que estas no le estorban.

**Verificación local a 2026-08-05:** `npm test` → **985 pruebas en 68 archivos, todas en
verde**, más los iconos PWA. `npm run build` → compila sin errores. El aviso de *chunks >
500 kB* es previo y no es un fallo.

**Siguiente paso — requiere orden expresa de Santiago:** publicar el enlace de la nube
(`emerald-dealer-app`) y verificarlo en vivo. El enlace de los 7 amigos sigue sin tocarse y
va días después, como dice el plan.

### Corrección del dueño (2026-08-05): «Héctor» no es una segunda persona

Santiago avisó que **no conoce a ningún Héctor** y que **él es el único usuario del enlace
de la nube**. Tiene razón, y la explicación está en el propio repositorio: **«Héctor» es su
primer nombre de pila.** Su nombre completo figura en `docs/legal/` como operador del
servicio; él usa «Santiago», otro de sus nombres. Los documentos antiguos —código,
`DECISIONS.md`, planes de fase— lo nombran «Héctor» al registrar decisiones ("decisión de
Héctor D-044", "Héctor autorizó la ampliación"). Documentos posteriores leyeron eso como si
fuera **otra persona** y lo convirtieron en un segundo usuario.

**No lo hay. Una sola persona, un solo usuario en la nube.** Se corrigieron
`PROJECT_STATE.md`, `docs/PLAN_DE_PUBLICACION_V2.md` y `docs/PROMPT_NUEVA_SESION.md`. Los
usos históricos en el código y en los registros de decisiones **se dejan intactos**: son el
registro de lo que se decidió y cuándo. No añadir aquí su nombre completo ni su correo; ya
están donde corresponde, en los documentos legales.

**Consecuencias prácticas:** publicar es menos riesgoso de lo planeado —no hay una segunda
persona a la que avisar ni cuya información proteger—. Santiago además indicó que **no
conserva datos del uso anterior y no necesita arrastrar historia**, así que el respaldo
previo deja de ser un bloqueo.

---

## 2026-08-05 — PUBLICADO en los dos enlaces

Santiago dio la orden expresa: *"publica en todos lados y que pase lo que tenga que pasar"*.
Se publicó en el orden seguro —primero el suyo, verificado en vivo, después el de los
amigos— para no propagar un fallo.

| Enlace | Commit publicado | Punto de retorno |
|---|---|---|
| `emerald-dealer-app` (nube, solo Santiago) | `f9ba18a` en `Santismagico/emerald-dealer-app` | `762dc7c` |
| `emerald-dealer-quote` (los 7 amigos) | `d3e5af4` en `main` | `0a86e5a` |

**Cómo se movió `main`.** No fue un `--force`. `main` tenía un commit propio (`0a86e5a`,
ventanas emergentes libres de la navegación inferior) que **no** era ancestro de la rama. Se
verificó antes de tocar nada: la rama ya contiene ese arreglo como `8818972`, con la regla
CSS idéntica (`padding-bottom` de 5.5rem en móvil, 1rem en ≥1024px), y **ningún archivo de
`main` falta en la rama**. Se creó un commit de fusión con `git commit-tree` cuyo árbol es
**idéntico** al de la rama aprobada y cuyos padres son `main` y la rama: conserva la historia
y publica exactamente el árbol probado.

**El despliegue falló a la primera, y el candado hizo su trabajo.** `npm audit
--audit-level=high` encontró 3 vulnerabilidades altas: `brace-expansion`, `fast-uri` y
`postcss` —herramientas de compilación, no viajan al navegador— más `dompurify`, la única
que sí viaja (vía jspdf). Se corrigió con `npm audit fix` **sin `--force`**: solo
actualizaciones compatibles, `package.json` intacto, ninguna dependencia nueva (D-066
respetado), auditoría en cero. Las dos confirmaciones del workflow —commit exacto y
`PUBLICAR`— sí habían pasado. Segundo intento: verde. El enlace de la nube se **volvió a
compilar y publicar** con las dependencias ya parcheadas, para que los dos corran lo mismo.

**Verificación en vivo de los dos:**

- **Nube:** carga la pantalla de acceso, alcanza el servidor real
  (`/auth/v1/settings` → 200) y el bundle lleva la URL y la llave publicable de
  **Producción**, verificadas contra el bundle ya publicado, no contra la memoria. Sin
  secretos en el paquete (el `sb_secret_` que aparece es código de la librería que comprueba
  prefijos).
- **Amigos:** pantalla de Inicio con gráfica, las cinco áreas de la barra y las tres
  secciones del inicio. **Cero rastro de Supabase en el bundle** —ni URL ni llave—: sigue
  siendo 100% local, como debe ser. Sin desbordamiento horizontal a 375 px.
- Los errores de CSP en consola **no son de la aplicación**: el hash bloqueado es distinto
  del suyo y lo inyecta el entorno del navegador. La app renderiza completa.

**Lo que NO se pudo verificar y le toca a Santiago:** entrar con su cuenta y comprobar por
dentro Inicio, las cuatro secciones de Inventario, las cinco de Dinero y que un cierre se
descargue en Excel. Un agente **no debe** iniciar sesión con sus credenciales.

**Pendiente social:** avisar a los 7 amigos. Al abrir la app la verán distinta. Sus datos
locales saltan de v4 a v8 y los cuatro escalones solo crean almacenes nuevos vacíos, pero
**no tienen respaldo en la nube**: conviene pedirles que exporten el suyo.

---

## 2026-08-05 — Fase nueva ordenada: Socios y Fondo

La prueba de uso de Santiago el mismo día de la publicación destapó una figura que **no
estaba en ningún documento del proyecto**: un fondo de amigos que le entregan dinero
esperando un rendimiento a plazo, y a quienes **paga pase lo que pase**.

Eso obligó a separar dos relaciones que la aplicación trataba como una sola:

- **Fondo de inversión** — deuda. Cobra capital más rendimiento aunque el lote pierda.
- **Socio de igualdad** — patrimonio. Gana o pierde en proporción a lo que puso.

**Decisiones D-072 a D-076.** Las que más gobiernan el código:

- La plata del fondo **no diluye** el reparto entre socios de igualdad (D-072).
- La participación se declara **en plata puesta**, no en porcentaje; el porcentaje se deriva
  (D-073), igual que el material ya hace con los gramos (D-049).
- El rendimiento del fondo es **costo personal de Santiago** (D-075): el socio reparte sin
  descontar el financiamiento, y la parte de Santiago **puede quedar en negativo mientras el
  socio sigue en positivo**. Es correcto y hay una prueba obligatoria que lo protege.
- El fondo **no es un saldo guardado**: es una lista de personas con historia editable y
  rastreable; el total se deriva (D-076).

**Santiago depuró los datos de la aplicación**, así que desapareció el riesgo más grave del
plan: ya no hay que convertir lotes con historia real al peso. La fase bajó de 10 etapas a 9.

**Plan completo:** `docs/PLAN_SOCIOS_Y_FONDO.md`.
**Orden de trabajo:** `docs/EXECUTION_PLAN.md`, fase *Socios y Fondo*. **S1 detallada y lista
para ejecutar**; las ocho restantes enunciadas, se detallan al abrir cada una.

**Estado: nada implementado.** S1 es tipos y motor puro, sin tocar pantallas.

### Etapa S1 completada — 2026-08-05

Santiago se quedó sin tokens de Codex hasta el 11 de agosto, así que **Claude implementa
directamente** hasta esa fecha. Consecuencia asumida y dicha en voz alta: se pierde al
auditor independiente. Se compensa con pruebas escritas junto al diseño y una **pasada de
auditoría propia** al cerrar cada etapa.

**Qué entró.** Dos motores puros nuevos y ningún cambio de pantalla:

- `src/services/partnership.ts` — reparto de **N socios** por la plata que puso cada uno.
  Base = compra − lo que financió el fondo. Cada socio recibe su parte **truncada** y el peso
  residual queda siempre del lado de Santiago, de modo que la suma cuadre exacta en ganancia
  y en pérdida. Incluye `partnersFromLegacy` para leer un lote del modelo anterior.
- `src/services/fund.ts` — devengo por aporte. `mensual` cuenta **meses cumplidos** ("a los
  45 días va un mes, no dos"), con el borde del 31 de enero al 28 de febrero resuelto como
  mes cumplido. `fijo` reconoce el rendimiento pactado **completo desde el primer día**:
  es una obligación ya adquirida y mostrarla a plazos subestimaría la deuda.
  `financingCostForOwner` expone el costo que asume Santiago solo (D-075).
- `src/services/stones.ts` — `summarizeStoneLotSplit` usa el motor nuevo;
  `summarizeStonePartnership` conserva su forma anterior para las pantallas que aún no
  muestran socio por socio, y ya calcula por dentro con N partes.
- Tipos: `LotPartner`, `FundContribution`, `FundPayment`, `FundReturnKind`. En `StoneLot` se
  añaden `partners?` y `fundedFromFundCop?`; **los campos viejos quedan `@deprecated` pero
  presentes**, así nada se rompe mientras las pantallas migran etapa por etapa.

**Verificación.** 1034 pruebas en 71 archivos (49 nuevas) y `npm run build` en verde. Las 48
pruebas de piedras que ya existían pasan sin tocarse: el camino anterior se comporta igual.

**Auditoría propia, aparte de las pruebas.** 2000 repartos al azar con hasta 6 socios: la
suma de las partes es **siempre** exacta al peso (peor desvío 0) y todas las partes son
enteras. 1000 casos comprobando que el residuo del redondeo **nunca favorece a Santiago**
frente a sus socios. Los fines de mes de los 12 meses. El devengo mensual siempre entero y
monótono. Cero fallos.

**Nota para S9:** los campos nuevos viajan a la nube sin validar hasta que se aplique la
migración SQL. Hoy no hay dato con ellos, porque las pantallas todavía no los escriben.

**Siguiente:** S2, base local y respaldo v9.

### Etapa S2 completada — 2026-08-05

Los aportes al fondo ya se guardan de verdad y viajan en el respaldo.

- **Base local v8 → v9:** almacén `fundContributions`. El escalón **solo crea**; ni borra ni
  reescribe nada de lo anterior.
- **`schema.ts`:** `normalizeFundContribution`, `normalizeFundPayment`, `normalizeLotPartner(s)`
  y los campos nuevos del lote. Los dos campos del trato del fondo **se excluyen entre sí**:
  un aporte pactado a cifra fija no conserva una tasa mensual colgando, para que el motor y
  la pantalla nunca lean cosas distintas. `fundedFromFundCop` se limita al costo del lote,
  así jamás queda una base de reparto negativa.
- **`storage.ts`:** `listFundContributions`, `saveFundContribution`, `deleteFundContribution`.
  Borrar existe solo para deshacer un registro equivocado: un aporte devuelto **queda
  saldado, no se borra** (D-076).
- **Respaldo v9:** acepta v1–v9. Los aportes entran en la exportación y en la **restauración
  atómica**, así que un fallo a mitad de camino revierte todo junto. Un respaldo v8 se
  importa sin fallar y estrena la lista vacía.

**Verificación.** 1047 pruebas en 72 archivos (13 nuevas) y build en verde. Se actualizaron
las pruebas que afirmaban la versión anterior del formato y la lista de almacenes: cambios
legítimos del esquema, no ajustes para tapar fallos.

**Auditoría propia.** El escalón v9 ejecutado contra una base simulada con los doce almacenes
previos: **una sola acción, crear el nuevo**, y ninguna de borrado. Un lote guardado antes
conserva **todos** sus campos al normalizarse y estrena los nuevos vacíos. 500 casos al azar
donde la plata del fondo nunca supera el costo del lote. Normalizar un aporte dos veces da
exactamente lo mismo, incluso partiendo de basura. Cero fallos.

**Siguiente:** S3, la pantalla de lotes de piedras. Es la primera etapa que Santiago verá.

### Etapa S3 completada — 2026-08-05

**La primera etapa visible.** En la compra de un lote, el selector de socio único se
reemplazó por el bloque **«Quién puso la plata»**:

- Añadir y quitar socios, cada uno con su persona y cuánto puso. **El porcentaje se calcula
  solo** y se muestra bajo cada monto.
- Campo aparte para el **préstamo del fondo**, con la advertencia de que no da participación
  y que su costo lo asume Santiago.
- **«Lo tuyo»** derivado al pie, con su porcentaje.
- Si entre socios y fondo se pasan del costo, sale un aviso rojo y **el guardado se bloquea**
  (`validatePartnersAndFunding`, motor puro).
- La tarjeta del lote y su detalle ahora **nombran a todos los socios** con su porcentaje y
  su parte del resultado, en vez de a uno solo.

**Verificado en el navegador**, no solo con pruebas. Lote de 10.000.000 con 4.000.000 del
fondo, Ana 3.000.000 y Luis 1.000.000: la pantalla mostró **Ana 50,0 % · Luis 16,7 % · lo
tuyo 33,3 %**, que es exactamente el reparto sobre la base de 6.000.000 —el préstamo
excluido—. Al subir el fondo a 8.000.000 apareció el aviso y «Lo tuyo» cayó a cero. Guardado
y releído desde IndexedDB con los dos socios y el préstamo intactos. Sin errores de consola.
En teléfono (375 px) el bloque cabe, no hay desbordamiento horizontal y el diálogo se
desplaza por dentro respetando la barra inferior.

**Trampa encontrada, y vale anotarla:** `preview_start` levanta el servidor en el directorio
de la sesión. Si la sesión abrió en la copia congelada de OneDrive, **se sirve la app vieja**
—se nota porque la barra inferior es la anterior—. Hay que usar la configuración
`emerald-nube-dev` del `launch.json`, que apunta a `C:/Dev/emerald-dealer` en el puerto 5174.

La base local se migró **de v7 a v9 en un navegador real**, estrenando `fundContributions`
sin tocar lo demás.

**Verificación.** 1052 pruebas en 72 archivos (5 nuevas) y build en verde.

**Siguiente:** S4, material y gastos con el mismo patrón.

### Etapa S4 — TERMINADA (2026-08-10)

Las dos pantallas que faltaban quedaron hechas, probadas y verificadas en navegador.
**1080 pruebas en 73 archivos y build en verde.**

**Decisión confirmada por Santiago (2026-08-10):** el material se comparte en **GRAMOS**,
no en plata. Se conserva el principio de D-073 —declarar la cantidad exacta y **derivar**
el porcentaje—, cambiando solo la unidad. Los gastos sí van en plata. Los gastos llevan
`partners` pero **no** financiación del fondo: el fondo financia compras, no gastos de
operación, y un gasto no genera rendimiento que repartir.

**Material (`MaterialsView.tsx`).** El bloque de socio único —el interruptor «lo comparto
con un socio», el botón de mitad y mitad y el campo de gramos propios— se reemplazó por la
lista de socios en gramos, con el patrón de `StonesView.tsx`. Lo propio se DERIVA.
`summarizeMaterialLot` pasa a leer `partners` y solo cae al modelo viejo cuando el lote aún
no tiene lista, así que los lotes anteriores dan exactamente el mismo número.

**Gastos (`ExpensesView.tsx`).** Mismo bloque en plata, con `validatePartnersAndFunding` y
sin el campo del fondo. `expenseSplit` pasa a leer `partners` con la misma caída al modelo
viejo. Al guardar, el porcentaje viejo queda al día; si se quitan todos los socios, el
gasto vuelve a ser 100% propio y los campos del socio único quedan limpios.

**Fallo encontrado en la verificación real y corregido:** `validateExpense` rechazaba un
gasto compartido con socios escritos a mano («Un gasto sin socio debe ser 100% propio»).
Sin ficha, `partnerId` queda en null y el chequeo viejo —pensado para UN socio— lo leía
como «sin socio». Ahora, cuando hay lista, manda la lista. Con prueba propia.

`validatePartnersAndFunding` acepta `subject` para que el aviso hable de «gasto» y no de
«lote». Sin ese dato dice exactamente lo de antes, así que las piedras no cambian.

**Verificación en navegador (375 px, modo local sin nube).** Material: lote de 100 g con
Ana 30 g y Beto 20 g → «Lo tuyo 50 g · 50.0%», porcentajes por socio correctos, aviso rojo
al pasarse de los gramos del lote, guardado, persistencia tras recargar, y la ficha del
lote muestra «Tuyo (50%) 50 g» y «De Ana y Beto 50 g». Gastos: $1.000.000 con Ana $300.000
y Beto $200.000 → «Lo tuyo $500.000 · 50.0%», aviso «Los socios suman más de lo que costó
el gasto», guardado y persistencia, con el historial mostrando «Ana y Beto: tu parte
$500.000, socios $500.000».

**Informe por socio, verificado en pantalla con fichas reales (2026-08-10).** Se crearon
las fichas «Ana Restrepo» y «Beto Cárdenas», se eligieron desde el desplegable en un gasto
de $2.000.000 (Ana $800.000, Beto $400.000 → «Lo tuyo $800.000 · 40,0%») y en un lote de
200 g (Ana 80 g, Beto 40 g → «Lo tuyo 80 g · 40,0%»). La pantalla de Socios da **una
tarjeta por persona con sus propias cifras**, y sobrevive a recargar:

- Ana Restrepo — «Material: comparten 200 g · tuyos 80 g · del socio 80 g» y «Gastos
  compartidos: $2.000.000 · tu parte $800.000 · socio $800.000».
- Beto Cárdenas — «Material: comparten 200 g · tuyos 80 g · del socio 40 g» y «Gastos
  compartidos: $2.000.000 · tu parte $800.000 · socio $400.000».

**Observación de redacción para decidir con Santiago (no es un fallo):** cuando un mismo
lote o gasto se comparte con dos socios, «comparten 200 g», «tuyos 80 g» y «tu parte
$800.000» se repiten idénticos en las dos tarjetas, porque describen el mismo lote y el
mismo gasto. Quien lea las dos seguidas podría sumarlas y creer que son 160 g o $1.600.000.
Los números son correctos; lo que puede confundir es que el encabezado no dice que ambas
tarjetas hablan del mismo registro.

**Herramienta nueva para verificar:** configuración `emerald-local-dev` en
`.claude/launch.json` (puerto 5175) que abre la app en modo local, sin nube ni inicio de
sesión, usando `--mode sinnube` y el archivo `.env.sinnube.local` (ignorado por git).

### Etapa S5 — TERMINADA (2026-08-10). El fondo, persona por persona

Lo que Santiago pidió el 2026-08-06: *"ese fondo de amigos no lo tratemos como un único
fondo, sino podamos diferenciar qué personas integran ese fondo […] necesito poder
editarlas y trackearlas"*. El motor (`fund.ts`) ya existía desde S1 con sus pruebas; lo que
faltaba —y era todo— es que se pudiera ver y escribir. **Ninguna pantalla lo usaba.**

**Pantalla nueva `FundView.tsx`**, en Inicio → Tu gente → **Fondo**. Va con la gente, no
con Dinero: se lee persona por persona (D-076) y Dinero conserva sus cinco secciones
pactadas en D-070. Prueba propia en `home.test.ts` que fija ese acceso.

Por cada persona: lo que puso, el rendimiento hasta hoy, lo devuelto, el rendimiento ya
pagado y **lo que se le debe hoy**, más el vencimiento más próximo y un aviso rojo si ya
pasó. Debajo, cada aporte suyo con su estado (Abierto · Vencido · Saldado), su historial de
pagos y los botones Pagar · Editar · Borrar. **El total del fondo va al PIE**, nunca al
encabezado. Ningún saldo se guarda: todo se DERIVA (D-023).

Se admiten los dos tratos: **porcentaje mensual** sobre el capital por mes cumplido, y
**total fijo pactado** con fecha de devolución. Borrar avisa que solo sirve para deshacer un
registro hecho por error: un aporte devuelto se salda registrando el pago, y conserva su
historia (D-076).

**Conexión de datos.** `dataSource`, la fuente de la nube y `store.tsx` ya llevan
`listFundContributions` / `saveFundContribution` / `deleteFundContribution`. La base local y
el respaldo ya lo soportaban desde S2.

**Límite consciente y anotado:** con cuenta de nube, el fondo se guarda **solo en el
dispositivo**. La tabla, el RPC y las reglas de aislamiento entran en la etapa 9; encolarlo
sin tabla haría fallar el envío una y otra vez. Cuando llegue S9, el primer envío sube lo
que ya esté guardado. Está escrito así en `cloud/api.ts`.

**Verificación en navegador (modo local, 320 y 375 px, sin desbordamiento).**
Ana Restrepo: $5.000.000 el 10 de mayo al 2% mensual → «3 meses cumplidos», rendimiento
$300.000, debe $5.300.000. Se registró un pago de $300.000 de rendimiento → rendimiento
pagado $300.000 y la deuda baja a $5.000.000, con el pago en su historial.
Beto Cárdenas: $2.000.000 el 1 de junio, total fijo pactado $2.400.000 con plazo el 1 de
agosto → marca **Vencido** y «Vencido desde el 1 de agosto de 2026».
Pie: 2 personas · 2 aportes · capital $7.000.000 · rendimiento $700.000 · **debes en total
$7.400.000**. Todo sobrevive a recargar.

**Cierre:** 1081 pruebas en 73 archivos y build en verde.

**Siguiente:** etapa 6 (informe por socio completo, §6 del plan) y etapa 7 (separación por
socio en Cierre del día y Consolidado). Después Excel (8) y nube (9).

### Etapa S6 — TERMINADA (2026-08-10). Informe por socio

Cierra lo que Santiago pidió el 2026-08-06: *"que le pueda ver cuánto tiene cada socio […]
sus ganancias […] el costo de su inventario y el movimiento de plata pendiente"*.

**Fallo de fondo encontrado y corregido.** `stonesByPartner` seguía agrupando por el
**socio único viejo** (`lot.partnerId`), aunque S3 ya permitía varios socios por lote.
Con dos socios, todo se le atribuía a uno solo; con socios escritos a mano, todos caían en
una fila «Sin nombre». Ahora recorre la lista de socios de cada lote y devuelve **una fila
por persona**, con la conversión al vuelo del modelo viejo.

**La fila ya no trae cifras que se puedan sumar dos veces.** Se quitaron `realResult` (del
lote entero) y `myResult` (la parte de Santiago): repetidas en la tarjeta de cada socio,
invitaban a sumarlas. Todo lo que queda es de esa persona.

**Lo que muestra ahora la pantalla Socios**, por persona y en dos bloques según su papel
—la distinción que gobierna el plan—:

- **Como socio de igualdad:** en cuántos lotes está · lo que ha puesto · **ganancia ya
  realizada** · lo puesto en lotes con existencias · **lo que le falta cobrar a
  compradores**. Más material en gramos y gastos en plata, que ya venían de S4.
- **Como inversionista del fondo:** lo que te prestó · rendimiento hasta hoy · lo devuelto ·
  rendimiento pagado · **lo que le debes hoy** · próximo vencimiento, en rojo si se pasó.

**Segundo fallo, encontrado en la verificación real y corregido.** La ganancia realizada
mostraba **−$300.000** en un lote vendido entero pero **a crédito y sin cobrar**. El
resultado se calcula sobre la plata recibida (D-045), así que sin cobro el número es
negativo — y eso no es una pérdida: es plata que no ha entrado. Llamarlo «ganancia
realizada» mentía en la dirección más peligrosa. Ahora una ganancia solo cuenta como
realizada cuando el lote se vendió entero **y** se cobró entero; lo demás vive en «le falta
cobrar». Con prueba propia.

**Lo que NO se hizo, a propósito: «valor del inventario vivo».** El plan lo pedía, pero el
proyecto **no tiene** ninguna valoración de mercado de las piedras sin vender, y estimarla
sería inventar una cifra en un informe de dinero. Queda como decisión de negocio para
Santiago: si quiere verlo, debe decir cómo se valora lo no vendido (por ejemplo, un precio
por quilate que él fije). Sí está el **costo**, que es dato real.

**Verificación en navegador (modo local, 320 px, sin desbordamiento).** Lote de $1.000.000
con Ana $300.000 y Beto $200.000 (lo de Santiago, $500.000, se deriva). Venta del lote
completo por $2.000.000 a crédito → ganancia realizada **$0** y «le falta cobrar» $600.000 y
$400.000. Registrado el abono completo → ganancia realizada **$300.000** y **$200.000**, y
lo pendiente baja a $0. Los bloques del fondo muestran a Ana con $5.000.000 prestados y a
Beto vencido desde el 1 de agosto.

**Cierre:** 1084 pruebas en 73 archivos y build en verde.

**Siguiente:** etapa 7 (separación por socio en Cierre del día y Consolidado), luego Excel
(8) y nube (9).

### Etapa S7 — TERMINADA (2026-08-10). Dinero separado por socio

Cierra la otra mitad del pedido del 2026-08-06: *"también en la parte de money, panel,
cierre del día, consolidado […] necesito ver qué tiene cada socio"*.

**Tercer fallo del mismo origen, encontrado y corregido.** El **libro del negocio**
(`ledger.ts`, D-057) guardaba en cada evento el trío `partnerId` / `partnerName` /
`myPercent` del modelo de socio único. De ahí bebían el Panel, el Consolidado y el Excel,
así que **todos repartían como si el lote tuviera un solo socio**. Ahora cada evento de un
lote de piedras lleva `partners`, `equityBaseCop` y `myContributionCop`; los campos viejos
quedan `@deprecated` pero presentes.

**Consolidado y Panel.** «Sociedades encontradas» pasa a **«Cada quien en los lotes
compartidos»**: una fila por persona, **Santiago incluido** (`isOwner`), con lo que puso, lo
que ganó y su rentabilidad. La fila perdió el par «tu parte / parte del socio», que repetía
la cifra de Santiago en cada tarjeta e invitaba a sumarla varias veces. Las tarjetas de
comparación —Más dinero, Más rentable— miran **solo a los socios**: incluir a Santiago no
dice nada, porque él está en todos los lotes y ganaría siempre.

**Cierre del día y su PDF.** El renglón del gasto decía «Socio X: 60% propio», que con
varios socios nombraba a uno solo. Ahora dice **quién puso cuánto, persona por persona**:
«Compartido: tuyo $800.000 · Ana Restrepo $800.000 · Beto Cárdenas $400.000». `DailyExpense`
estrena `partners`; los campos viejos quedan `@deprecated`.

**Excel.** La hoja del consolidado cambia «Comparación de sociedades» por «Comparación por
persona», con la ganancia y la rentabilidad de esa persona.

**Verificación en navegador (modo local, 320 px, sin desbordamiento).** Lote de $1.000.000
con Ana $300.000, Beto $200.000 y Santiago $500.000, vendido en $2.000.000 y cobrado. El
Consolidado da tres filas: **Tú $500.000 puestos → $500.000 ganados (100%)**, Ana $300.000 →
$300.000 (100%), Beto $200.000 → $200.000 (100%). El Cierre del día muestra el gasto de
$2.000.000 repartido nombre por nombre.

**Cierre:** 1086 pruebas en 73 archivos y build en verde.

**Siguiente:** etapa 8 (Excel por socio) y etapa 9 (nube: migración SQL, RPC, RLS y
sincronización de socios y fondo). Con S9 pendiente, socios y fondo siguen viviendo solo en
el dispositivo.
