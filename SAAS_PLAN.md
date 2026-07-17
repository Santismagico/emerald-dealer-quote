# SAAS_PLAN — Hoja de ruta hacia el producto cobrable

> **Actualizado el 2026-07-17 por orden de Santiago** (versión original congelada del
> 2026-07-08, reescrita: la app pasó de 3 a 6 almacenes de datos y ya está publicada
> la v2 con el Ecosistema completo). Este documento es la hoja de ruta canónica para
> convertir Emerald Dealer Quote en un software por suscripción (SaaS) sostenible.
> Cada FASE requiere la orden expresa de Santiago antes de ejecutarse; este documento
> por sí solo autoriza únicamente la planificación.

## Punto de partida real (2026-07-17)

- **Publicado y aprobado:** v2 en https://santismagico.github.io/emerald-dealer-quote/
  con Cotizador · Taller · Agenda · Piedras · Más, identidad "mesón del joyero"
  (día/noche), 452 pruebas y verificación PWA en cada build. Prueba física aprobada
  por Santiago; colegas ya la usan informalmente y la aprueban.
- **Todo es local:** los datos viven en IndexedDB de cada teléfono (base v4,
  6 almacenes: settings, clients, quotes, appointments, stoneLots, suppliers;
  respaldo JSON v5 con restauración atómica). No hay cuentas, sincronización,
  cobro ni servidor.
- **Fortalezas ya construidas para el salto:** capa de datos concentrada
  (`storage.ts`/`db.ts`/`backup.ts`), tipos centralizados, respaldo versionado
  v1–v5 (contrato de importación listo), motores puros con tests, detector de
  privacidad sin bypass, CSP en producción, migraciones append-only probadas.

## Visión de fases

| Fase | Qué entrega | Estado |
|---|---|---|
| **0. Piloto formal con colegas** | Feedback estructurado de la app gratuita actual | Puede empezar YA |
| **1. Auditoría y endurecimiento pre-SaaS** | App auditada, corregida y versionada 1.0.0 | Siguiente trabajo técnico |
| **2. Nube: cuentas y sincronización** | Cada joyería con su cuenta y sus datos aislados | Requiere orden |
| **3. Cobro: suscripciones** | Clientes pagando mes a mes | Requiere orden + trámites |
| **4. Lanzamiento comercial** | Dominio propio, onboarding, soporte, monitoreo | Requiere orden |

---

## FASE 0 — Piloto formal con colegas (empezar ya · 2–4 semanas en paralelo)

La app ya está publicada y es gratuita: los colegas pueden probar HOY. Lo que
convierte ese uso informal en un piloto serio:

1. **Registro de participantes:** lista de 2–5 joyeros con nombre, teléfono y fecha
   de inicio (la lleva Santiago donde prefiera; no va al repositorio público).
2. **Guion de prueba de 10 minutos:** crear cotización → aprobar → Taller →
   registrar pago → marcar pagada/entregada → PDF cliente → compartir por WhatsApp
   → una cita en Agenda → un lote en Piedras → Cierre del día.
3. **Canal único de hallazgos** (grupo de WhatsApp): cada hallazgo se dicta a un
   agente, que lo clasifica en `docs/HOJA_DE_RUTA_CORRECCIONES.md` (método vigente).
4. **Advertencias honestas a los pilotos:** los datos viven solo en su teléfono;
   exportar el respaldo semanal cuando la app lo recuerde; borrar la app borra los
   datos si no hay respaldo.
5. **Criterio de éxito:** 2+ joyeros usándola en cotizaciones reales por 2 semanas
   sin hallazgos graves.

Costo: $0. No requiere código nuevo (salvo correcciones que surjan).

## FASE 1 — Auditoría y endurecimiento pre-SaaS (1–2 semanas de trabajo técnico)

Objetivo: que la base sobre la que se construirá el negocio esté auditada de punta
a punta y marcada como **versión 1.0.0**. Es la "hoja de ruta de auditoría" pedida:

### 1A. Auditoría de código y datos
- Dinero: revisar todo camino de COP (redondeos, sobrepagos, cierres diario/mensual)
  contra el motor puro; ampliar tests de propiedades si hay huecos.
- Escalera de migraciones IndexedDB v1→v4 probada contra bases reales de cada versión.
- Guardado diferido: carreras entre autosave, navegación y cierre de app.
- Respaldos: importar v1–v5 con datos límite (grandes, corruptos, truncados).

### 1B. Auditoría de ciberseguridad de la app actual
- `npm audit` + revisión del lockfile (cadena de suministro); congelar versiones.
- CSP: re-verificar hashes y `connect-src` tras los cambios de v2.
- Entradas de usuario hacia PDF/WhatsApp: inyección de contenido, tamaños de
  imágenes (data URLs), archivos de respaldo maliciosos al importar.
- Revisión del repositorio público: cero datos reales en fixtures, capturas o docs.
- Actualizar `SECURITY_CHECKLIST.md` con el resultado.

### 1C. Preparación legal y de negocio (Colombia)
- **Ley 1581 de 2012 (Habeas Data):** al pasar a la nube, Santiago tratará datos
  personales de clientes de sus suscriptores → se necesita política de privacidad,
  aviso de tratamiento y términos de servicio ANTES de la Fase 2 beta.
- Nombre comercial definitivo del producto (hoy "Emerald Dealer Quote") y si el
  enlace público actual se mantiene o se protege.
- **Trámite bancario/pasarela** (ver Fase 3): iniciarlo desde ya porque toma
  semanas de calendario y no depende de código.

### 1D. Higiene del entorno
- **Sacar el proyecto de OneDrive** (riesgo conocido de sincronización sobre
  node_modules y archivos en caliente) — ahora sí, antes de construir la nube.
- Pendientes menores del ROADMAP que suben la calidad del piloto: plantillas de
  piezas frecuentes (requiere autorización aparte), precio internacional del oro
  como dato auxiliar visible.

**Entregable:** informe de hallazgos + correcciones aplicadas + `package.json` en
1.0.0 (la versión se muestra en Ajustes) + documentos legales borradores para
revisión de Santiago.

## FASE 2 — Nube: cuentas y sincronización (3–5 semanas de trabajo técnico)

El plan técnico original sigue siendo el correcto; se actualiza el esquema al
Ecosistema completo.

- **Stack:** Supabase (Postgres + Auth + API + Storage). Sin construir crypto
  propia. Gratis para empezar, ~USD 25/mes al crecer. El frontend no cambia de
  stack: se agrega `services/api.ts` con la misma interfaz de `storage.ts`, e
  IndexedDB pasa a ser caché offline.
- **Esquema (actualizado a 6 almacenes):**

```sql
organizations (id uuid pk, name, created_at)
memberships   (user_id uuid fk auth.users, organization_id uuid fk,
               role text check (role in ('owner','admin','seller')),
               pk (user_id, organization_id))
org_settings  (organization_id uuid pk fk, data jsonb)
clients       (id uuid pk, organization_id uuid fk not null, data jsonb, created_at, updated_at)
quotes        (id uuid pk, organization_id uuid fk not null, number text, status text,
               data jsonb, created_at, updated_at)
appointments  (id uuid pk, organization_id uuid fk not null, data jsonb, created_at, updated_at)
stone_lots    (id uuid pk, organization_id uuid fk not null, data jsonb, created_at, updated_at)
suppliers     (id uuid pk, organization_id uuid fk not null, data jsonb, created_at, updated_at)
```

- **Reglas innegociables:** RLS activado en TODAS las tablas (filtro por
  `organization_id` vía memberships); autorización solo en backend; consecutivo de
  cotización generado en el servidor (lock por organización); la service key JAMÁS
  en el código; imágenes a Supabase Storage (bucket por organización) cuando pesen.
- **Migración de datos de los pilotos:** botón "Subir mis datos locales" que toma el
  respaldo JSON v1–v5 existente y lo inserta en la cuenta. Nadie pierde lo cotizado.
- **El modo 100% local sigue existiendo** para quien no inicie sesión: protege la
  promesa offline y es el plan gratuito natural.
- **Pruebas críticas:** aislamiento entre organizaciones (la org A jamás lee datos
  de la org B), auth, importación, cola offline (si estorba, la v1 de nube es
  "online con caché de lectura" y la cola llega después).
- **Cierre de fase:** beta cerrada con los colegas del piloto usando cuentas reales.

Prerrequisitos de Santiago: crear la cuenta de Supabase (guiado paso a paso),
aprobar la política de privacidad, decidir el nombre definitivo.

## FASE 3 — Cobro: suscripciones (2–3 semanas técnicas + trámites en paralelo)

- **Pasarela de pago (decisión de negocio):** opciones reales para cobros
  recurrentes en Colombia: **Wompi** (Bancolombia), **Mercado Pago**, **PayU**,
  **Bold**. Todas exigen registro del comercio (RUT y datos bancarios) — trámite
  de semanas que debe iniciarse en la Fase 1.
- **Modelo recomendado para empezar simple:**
  - **Plan Local (gratis):** la app como hoy, datos en el dispositivo.
  - **Plan Nube (pago mensual en COP):** cuenta, sincronización multi-dispositivo,
    respaldo automático en la nube. Un solo plan; precio lo decide Santiago con
    referencia del mercado colombiano (del orden de decenas de miles de COP/mes).
- **Técnica:** tabla `subscriptions` + estado en la organización; verificación de
  pago vía webhook de la pasarela (función serverless); periodo de gracia; el
  no-pago degrada a solo-lectura de la nube (nunca borra datos).
- **Facturación electrónica DIAN:** verificar umbrales y obligaciones con el
  contador de Santiago (fuera del alcance del código, pero bloquea cobrar en regla).

## FASE 4 — Lanzamiento comercial (1–2 semanas + continuo)

- Dominio propio y página simple de presentación con precios.
- Onboarding guiado del primer uso; canal de soporte (WhatsApp Business).
- Monitoreo y respaldos del lado servidor (Supabase los incluye; verificar retención).
- Meta comercial inicial: los pilotos convertidos en primeros suscriptores + meta
  de 10 joyerías pagando para cubrir costos fijos y validar el precio.

---

## Calendario estimado (honesto, desde 2026-07-17)

| Hito | Fecha estimada | Depende de |
|---|---|---|
| Piloto formal con colegas arranca | **Esta misma semana** | Solo organizar el grupo y el guion |
| Auditoría Fase 1 terminada, v1.0.0 | **Fin de julio 2026** | Trabajo técnico de agentes |
| Beta en la nube con cuentas (colegas) | **Fin de agosto – mediados de septiembre 2026** | Fase 2 + cuenta Supabase + política de privacidad |
| Primeros clientes PAGANDO | **Octubre 2026** | Pasarela aprobada + precio decidido + beta estable |

Los tiempos técnicos son cortos; lo que marca el calendario son los trámites
(pasarela, legal) y las decisiones de negocio. Por eso los trámites arrancan en la
Fase 1, en paralelo con el código.

## Decisiones de negocio TOMADAS por Santiago (2026-07-17 · D-032)

1. **Nombre comercial:** **Emerald Dealer** (ya aplicado en manifest, título y Ajustes).
2. **Precio del Plan Nube:** **$50.000 COP/mes** (descuento anual: por definir en Fase 3).
3. **Pasarela:** **Wompi** — es la pasarela de Bancolombia (su banco): abono directo a
   su cuenta, cobros en COP, pagos recurrentes, Nequi/PSE/tarjetas. Alternativa de
   respaldo si el registro se traba: Mercado Pago.
4. **Enlace público:** se mantiene SOLO mientras dure el piloto. Al cerrarlo, nadie
   debe poder usar la app sin cuenta: la Fase 2 termina con un **muro de inicio de
   sesión** y el plan "Local gratis público" queda descartado (el modo local
   sobrevive únicamente como respaldo técnico offline de usuarios con cuenta).
5. **Piloto:** siete joyerías confirmadas (la lista es privada de Santiago y no se
   escribe en este repositorio público).

## Reglas que esta hoja de ruta NO cambia

Privacidad del cliente final (tests de `pdfContent.test.ts` siguen siendo ley),
COP enteros, motores puros, migraciones append-only, cero dependencias sin
registrar en DECISIONS.md, y publicar a `main` solo con orden expresa.
