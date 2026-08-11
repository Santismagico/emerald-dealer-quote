# FASE 2 — Orden de trabajo para Codex (la nube: cuentas y sincronización)

_Escrita por Claude (Fable) el 2026-07-18 por orden expresa de Santiago (D-035).
Codex ejecuta; Fable audita al cierre. Documento autosuficiente: no requiere leer
conversaciones. Ante ambigüedad de NEGOCIO, preguntar a Santiago en lenguaje
sencillo; las ambigüedades técnicas se resuelven con la opción más segura._

## Objetivo de negocio

Cada joyería con su cuenta, sus datos en la nube (visibles desde cualquier
dispositivo) y **aislados de las demás joyerías**. Es la base del cobro de
$50.000 COP/mes (Fase 3). El muro de inicio de sesión sustituirá al acceso
libre cuando Santiago cierre el piloto (decisión D-032.4).

## Principio rector: la app publicada NO cambia hasta la orden de corte

Todo el modo nube vive detrás de una **bandera de entorno**: si
`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` no existen al compilar, la app
se comporta EXACTAMENTE como hoy (100 % local, sin pantallas nuevas, sin
dependencia activa). El build público de GitHub Pages seguirá SIN esas
variables hasta que Santiago ordene el corte. Así los siete pilotos no notan
nada mientras se construye.

**Plan de corte (cuando Santiago lo ordene, no antes):** se agregan las
variables al workflow de deploy → el sitio público muestra el muro de inicio
de sesión → cada piloto crea su cuenta EN LA MISMA URL y toca "Subir mis datos
locales": como sus datos viven en el mismo origen del navegador, el importador
los lee directamente y nadie pierde nada. Una sola visita, cero archivos.

## Reglas de operación (obligatorias)

1. **Rama nueva: `codex/fase2-nube`** creada desde `main`. NO push a `main`
   (publica). Tag inicial `punto-seguro-fase2-2026-07-18` subido.
2. Antes de empezar: `git pull`, árbol limpio, `npm test && npm run build` en
   verde (línea base actual: 468 pruebas en 26 archivos; solo puede crecer).
3. **Un commit por etapa (N0…N8)** con push. Informe acumulativo en
   `docs/AUDITORIA_FASE2.md` (mismo formato que la Fase 1: hallazgos,
   decisiones, pruebas por etapa).
4. Reglas de siempre: COP enteros; motores puros; tests de privacidad
   (`pdfContent.test.ts`) son ley; migraciones IndexedDB solo agregan;
   datos ficticios en todo el repo (público).
5. **Secretos:** la `service_role key` de Supabase JAMÁS entra al repositorio
   ni a un archivo commiteado. `.env.local` está en `.gitignore` (verificar) y
   los scripts que la usen la leen de variables de entorno. La `anon key` sí
   puede ser pública (la seguridad es RLS), pero tampoco se hardcodea: llega
   por variable de entorno.
6. **Única dependencia nueva autorizada: `@supabase/supabase-js`** (D-035).
   Justificación: cliente oficial que gestiona sesiones, renovación de tokens
   y reintentos — construir autenticación a mano está prohibido por
   SECURITY_CHECKLIST. Ninguna otra dependencia sin decisión nueva.

## Arquitectura en una mirada

```
                     ┌──────────────────────────────┐
  Vistas React ───▶  │ store.tsx (igual que hoy)    │
                     └──────────┬───────────────────┘
                                │ interfaz de datos ÚNICA (la de storage.ts)
                 ┌──────────────┴───────────────┐
                 │ ¿cloudEnabled() y hay sesión?│
                 └───────┬──────────────┬───────┘
                     no  │              │  sí
             ┌───────────▼──┐   ┌───────▼──────────────────────────┐
             │ storage.ts   │   │ cloud/api.ts                     │
             │ (hoy, intacto)│  │  lectura: nube → caché IndexedDB │
             └──────────────┘   │  escritura: optimista → outbox   │
                                │  outbox: cola serial + reintento │
                                └───────────────┬──────────────────┘
                                                ▼
                                  Supabase (Postgres + Auth + RLS)
```

- IndexedDB pasa a ser **caché y cola** del modo nube, y sigue siendo la base
  completa del modo local. `schema.ts` sigue siendo la única normalización.
- Sin tiempo real (Realtime) en v1: se sincroniza al abrir, al volver a la
  app (visibilitychange) y tras cada escritura. Suficiente para el negocio.

## Esquema SQL (archivos en `supabase/migrations/`)

### 0001_esquema.sql

```sql
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  role text not null check (role in ('owner','admin','seller')),
  created_at timestamptz not null default now(),
  primary key (user_id, organization_id)
);

create table org_settings (
  organization_id uuid primary key references organizations(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table org_counters (
  organization_id uuid primary key references organizations(id) on delete cascade,
  quote_seq integer not null default 0
);

-- Las 5 colecciones siguen el mismo patrón: id del cliente (uuid generado por
-- la app con newId()? NO: los ids actuales de la app son strings propios) —
-- por compatibilidad con los datos locales existentes, id es TEXT.
create table clients (
  id text not null,
  organization_id uuid not null references organizations(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null,
  primary key (organization_id, id)
);
create table quotes (
  id text not null,
  organization_id uuid not null references organizations(id) on delete cascade,
  number text,
  status text,
  data jsonb not null,
  updated_at timestamptz not null,
  primary key (organization_id, id)
);
create table appointments (
  id text not null,
  organization_id uuid not null references organizations(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null,
  primary key (organization_id, id)
);
create table stone_lots (
  id text not null,
  organization_id uuid not null references organizations(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null,
  primary key (organization_id, id)
);
create table suppliers (
  id text not null,
  organization_id uuid not null references organizations(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null,
  primary key (organization_id, id)
);

create index quotes_org_updated on quotes (organization_id, updated_at desc);
create index quotes_org_status on quotes (organization_id, status);
```

Notas de diseño: clave primaria compuesta `(organization_id, id)` porque los
ids locales (`newId()`) no son UUID y podrían repetirse entre organizaciones.
`updated_at` viene del dato (`updatedAt` del objeto) — es la marca LWW.

### 0002_rls.sql

RLS **activado en TODAS las tablas** (`alter table ... enable row level security`).
Política patrón para las 6 tablas de datos (select/insert/update/delete):

```sql
create policy org_isolation on quotes
  for all
  using (organization_id in (select organization_id from memberships where user_id = auth.uid()))
  with check (organization_id in (select organization_id from memberships where user_id = auth.uid()));
```

- `memberships`: cada usuario SOLO ve sus propias filas
  (`using (user_id = auth.uid())`); inserción/edición únicamente vía funciones
  (ninguna política de insert/update/delete directa para usuarios).
- `organizations`: select solo si hay membresía; creación solo vía función.
- `org_counters`: sin acceso directo de usuarios (solo funciones).
- Verificar con la guía de Supabase que ninguna tabla queda sin RLS.

### 0003_funciones.sql

```sql
-- Crea la organización y la membresía owner en una sola transacción.
create function create_organization(org_name text) returns uuid
language plpgsql security definer set search_path = public as $$ ... $$;

-- Consecutivo sin duplicados entre dispositivos: bloquea la fila y avanza.
create function next_quote_number() returns text
-- usa la organización del usuario (via memberships), hace
-- update org_counters set quote_seq = quote_seq + 1 ... returning,
-- y devuelve el formato 'ED-AAAA-XXXX' con el año actual.

-- Upsert LWW por entidad (una por tabla, mismas 6):
create function upsert_quote(p_id text, p_data jsonb, p_updated_at timestamptz)
-- inserta o actualiza SOLO si p_updated_at >= updated_at existente;
-- toma organization_id de la membresía del usuario; extrae number/status
-- de p_data para las columnas planas.

-- Borrado por entidad (mismas 6): delete_quote(p_id text) etc.
```

Todas las funciones `security definer` DEBEN validar la membresía del
`auth.uid()` internamente (no confiar solo en RLS al ser definer) y fijar
`search_path`. Documentar cada función en el informe.

## Etapas de ejecución

### N0 — Protección y bandera

- Rama, tag, baseline verde. `npm install @supabase/supabase-js` (queda en
  package.json + lockfile).
- `src/services/cloud/config.ts`: lee `import.meta.env.VITE_SUPABASE_URL/ANON_KEY`;
  `cloudEnabled()` = ambas presentes. `getSupabase()` crea el cliente una vez.
- `vite.config.ts` (cspPlugin): si las variables existen al compilar, agregar el
  origen de Supabase a `connect-src`. Sin variables, la CSP queda como hoy
  (verificar con `npm run test:csp` en ambos modos).
- Verificar `.gitignore` cubre `.env` y `.env.*` (ya debería).
- **Prueba clave de la etapa:** build SIN variables → `dist` idéntico en
  comportamiento al actual (la app ni siquiera carga supabase-js: usar import
  dinámico `await import('@supabase/supabase-js')` solo cuando cloudEnabled()).

### N1 — Migraciones SQL

- Escribir los tres archivos de `supabase/migrations/` completos (arriba está
  el esqueleto; Codex los termina). Aún no se aplican a ningún servidor.
- Informe: tabla de políticas RLS (tabla × operación × regla) y de funciones.

### N2 — Capa de datos nube (todo con fakes, sin red)

- `src/services/cloud/api.ts`: implementa LA MISMA interfaz que `storage.ts`
  (los mismos nombres: loadSettings/saveSettings/listQuotes/upsertQuote/
  deleteQuote/…, más las colecciones nuevas). Lectura: pull por tabla →
  normalizar con `schema.ts` → escribir caché IndexedDB → devolver. Escritura:
  guardar en caché + encolar en outbox + disparar flush.
- `src/services/cloud/outbox.ts`: cola persistente en IndexedDB (nuevo almacén
  `cloudOutbox` — un escalón NUEVO al final de DB_MIGRATIONS, regla D-022),
  procesamiento SERIAL (patrón de quoteAutosave), reintento con espera
  creciente, flush en visibilitychange y al recuperar conexión (`online`).
  Una operación = { tabla, tipo upsert/delete, id, data, updatedAt }.
- `src/services/cloud/sync.ts`: `pullAll()` al iniciar sesión y al volver a la
  app; LWW: si el registro local en caché tiene updatedAt más nuevo que el
  remoto (edición offline pendiente), NO lo pisa (la outbox lo subirá).
- `src/store.tsx`: selector de fuente de datos (local vs nube) según
  `cloudEnabled()` + sesión. El resto del store NO cambia.
- **Tests (nuevos archivos):** outbox serial y reintento; LWW en ambos
  sentidos; caída de red a mitad de flush (la operación queda en cola);
  selector de fuente. Todo contra un fake de supabase-js (objeto en memoria);
  CERO llamadas de red en `npm test`.

### N3 — Pantallas de cuenta (español, misma estética)

- Muro de acceso cuando `cloudEnabled()` y no hay sesión: pantalla con la
  marca, "Iniciar sesión" / "Crear cuenta" / "Olvidé mi contraseña"
  (Supabase Auth por correo+contraseña; textos de error en español claro).
- Primer ingreso sin organización: pantalla "Crea tu joyería" (nombre) →
  `create_organization` → org_settings iniciales desde `defaultSettings()`.
- En Más → sección "Cuenta": correo, nombre de la joyería, "Cerrar sesión".
- Al registrarse: casilla "Acepto los términos y la política de privacidad"
  con enlaces a vistas internas simples que muestran los textos de
  `docs/legal/` (los textos DEFINITIVOS los aprueba el contador antes de la
  beta; el código usa los borradores mientras tanto).
- Usa los componentes de `ui.tsx` existentes; nada de estilos nuevos.

### N4 — Importador "Subir mis datos locales"

- Visible tras crear la organización cuando la nube está vacía y hay datos
  locales (o siempre en Más → Cuenta → "Importar datos de este dispositivo").
- Fuente A: la base IndexedDB local actual (lectura directa). Fuente B: un
  archivo de respaldo v1–v5 (reusa `parseBackup`). Ambas pasan por schema.ts.
- Subida por lotes con progreso visible; **idempotente**: los ids se conservan
  y el upsert LWW hace que repetir la importación no duplique nada.
- Prueba con un respaldo grande ficticio (200 cotizaciones con imágenes).

### N5 — Conexión real ⚠️ REQUIERE A SANTIAGO

- Guiar a Santiago (pasos visuales, botón por botón) para crear el proyecto
  gratuito en supabase.com con su correo, región `South America (São Paulo)`.
- Aplicar las migraciones en el SQL Editor del panel (copiar/pegar cada
  archivo en orden). Guardar URL y anon key en `.env.local` (NO commitear).
- Confirmar en el panel: RLS activo en todas las tablas, confirmación de
  correo activada, y que la service key NUNCA salió del panel.
- Humo real: crear cuenta de prueba (correo ficticio de Santiago), crear
  organización, crear una cotización en un navegador y verla aparecer en otro
  (perfil distinto) tras recargar. Editar offline (modo avión del navegador) y
  confirmar que la outbox la sube al volver la red.

### N6 — Pruebas de aislamiento y seguridad (contra el proyecto real)

- `scripts/test-rls-isolation.mjs` (Node puro, lee URL/keys del entorno):
  crea dos usuarios de prueba + dos organizaciones y verifica TODO esto:
  1. A no puede select/insert/update/delete datos de B en NINGUNA de las 6
     tablas (probar las 4 operaciones por tabla).
  2. Un cliente sin sesión (solo anon key) no lee ni escribe nada.
  3. Las funciones RPC de B rechazan al usuario A.
  4. `next_quote_number` con 10 llamadas concurrentes → 10 números distintos.
  5. Un usuario no puede crearse una membresía en la organización ajena.
- El script limpia sus datos de prueba al terminar y NUNCA se ejecuta contra
  datos reales de Santiago. Resultados completos al informe.
- Si CUALQUIER punto falla: detenerse, corregir política y repetir todo.

### N7 — Ensayo del corte (sin publicar)

- Build CON variables en local (`npm run build` + preview): muro visible,
  registro, importación de datos locales del mismo origen, recorrido completo
  de las 5 áreas contra la nube, modo avión (lectura de caché + outbox).
- Documentar en el informe el guion del corte público (workflow + variables
  como GitHub Actions secrets/vars) SIN ejecutarlo: eso es una orden aparte
  de Santiago.

### N8 — Cierre de fase

- Informe completo, `SECURITY_CHECKLIST.md` con sección nube, versión
  **1.1.0**, CHANGELOG, PROJECT_STATE. Todo en la rama `codex/fase2-nube`.
- Aviso a Santiago: la beta queda lista para su revisión y la auditoría de
  Fable. **Nada se publica sin su orden.**

## Qué NO incluye la Fase 2

Cobros y suscripciones (Fase 3: Wompi), roles multi-usuario por joyería
(existe `role` en memberships, pero la UI de invitar miembros es futura),
Realtime, notificaciones push, dominio propio, imágenes en Storage (siguen
como data URLs dentro de jsonb; migrarlas a buckets es mejora futura si el
peso lo exige).

## Estimación honesta

3–5 tandas de trabajo enfocado de Codex + la sesión guiada con Santiago (N5).
El riesgo mayor es la sincronización offline; si estorba, la v1 degrada a
"online con caché de solo lectura" y la outbox completa llega en 1.1.1.
