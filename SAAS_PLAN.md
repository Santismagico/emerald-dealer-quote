# SAAS_PLAN — Etapa 2: cuentas y nube (plan ejecutable)

> Documento de trazado escrito el 2026-07-08 para que esta etapa pueda ejecutarse
> en cualquier sesión futura sin perder contexto. Prerrequisito de negocio:
> validación con 2-3 joyerías reales usando la versión local (en curso, semana
> del 6 de julio de 2026). **No ejecutar sin la orden de Santiago.**

## Objetivo

Pasar de "libreta personal" (datos solo en el dispositivo) a "edificio de oficinas":
cada joyería con su cuenta, sus datos en la nube, aislados de las demás, visibles
desde cualquier dispositivo. Sin cobros todavía (eso es Etapa 3).

## Stack elegido y por qué

- **Supabase** (Postgres + Auth + API): autenticación gestionada (no construir
  crypto propia — regla de SECURITY_CHECKLIST), Row Level Security nativa para el
  aislamiento por organización, plan gratis suficiente para empezar, ~USD 25/mes al crecer.
- El frontend actual **no cambia de stack**: solo se reemplaza la capa
  `src/services/storage.ts` (y db.ts pasa a ser caché offline). Todo lo demás
  (motor de cálculo, PDF, WhatsApp, UI) queda intacto.

## Esquema de base de datos (Postgres)

```sql
organizations (id uuid pk, name, created_at)
memberships   (user_id uuid fk auth.users, organization_id uuid fk, role text
               check (role in ('owner','admin','seller')), pk (user_id, organization_id))
org_settings  (organization_id uuid pk fk, data jsonb)   -- espejo del tipo Settings
clients       (id uuid pk, organization_id uuid fk not null, data jsonb,
               created_at, updated_at)
quotes        (id uuid pk, organization_id uuid fk not null, number text,
               status text, data jsonb, created_at, updated_at)
```

Notas:
- `data jsonb` reutiliza los tipos TypeScript actuales (`src/types/index.ts`) como
  contrato — mínima fricción de migración. Columnas planas (`number`, `status`)
  solo para búsquedas/índices.
- Índices: `quotes(organization_id, updated_at desc)`, `quotes(organization_id, status)`,
  `clients(organization_id)`.
- Imágenes: al crecer, mover de data URLs embebidos a Supabase Storage
  (bucket por organización). Primera versión puede seguir embebida en jsonb.

## Reglas de seguridad (INNEGOCIABLES)

- **RLS activado en TODAS las tablas**. Política tipo:
  `organization_id in (select organization_id from memberships where user_id = auth.uid())`.
- La autorización vive en el backend (RLS), nunca solo en el frontend.
- El consecutivo de cotización se genera en el servidor (función SQL con lock por
  organización) para evitar números duplicados entre dispositivos.
- Sin secretos en el repo: la anon key de Supabase es pública por diseño (la
  seguridad es RLS), pero la service key JAMÁS va al código.

## Cambios en el frontend

1. `src/services/api.ts` nuevo: misma interfaz que `storage.ts`
   (loadSettings, listQuotes, saveQuote, …) pero contra Supabase.
2. `src/services/storage.ts` se conserva como **caché offline**: la app lee de la
   nube cuando hay internet, escribe en ambos, y encola cambios offline
   (cola simple en IndexedDB, resolución de conflictos por `updatedAt` — gana el
   más reciente; suficiente para un negocio de pocas escrituras).
3. Pantallas nuevas: registro/inicio de sesión, crear organización ("nombre de tu
   joyería"), invitar miembro (Etapa 2.5, opcional).
4. **Importador de arranque**: botón "Subir mis datos locales" que toma el respaldo
   JSON v1 (formato ya existente en `backup.ts`) y lo inserta en la cuenta.
   Así nadie pierde lo que ya cotizó.
5. El modo sin cuenta (100% local) **sigue existiendo**: quien no inicie sesión
   usa la app como hoy. Eso protege la promesa offline del MVP.

## Orden de ejecución (checklist)

- [ ] 1. Crear proyecto Supabase (requiere cuenta de Santiago; los datos de acceso NO van al repo).
- [ ] 2. Migración SQL: tablas + RLS + función de consecutivo (guardar en `supabase/migrations/`).
- [ ] 3. `api.ts` + pruebas contra base de prueba.
- [ ] 4. Pantallas de auth y organización.
- [ ] 5. Importador del respaldo local.
- [ ] 6. Sincronización offline (cola + updatedAt).
- [ ] 7. Tests: aislamiento entre organizaciones (crítico — probar que la org A no lee datos de la org B), auth, importación.
- [ ] 8. Actualizar SECURITY_CHECKLIST, ARCHITECTURE, README.
- [ ] 9. Beta con las joyerías validadoras antes de abrir registro.

Estimación honesta: 3-5 sesiones de trabajo enfocado. El riesgo mayor es la
sincronización offline; si estorba, la v1 de nube puede ser "online-only con
lectura de caché" y la cola llega después.

## Lo que NO incluye la Etapa 2

Pagos y planes (Etapa 3: Wompi o Mercado Pago), roles avanzados, dominio propio,
analítica, white-label (Etapa 4). Ver ROADMAP.md.
