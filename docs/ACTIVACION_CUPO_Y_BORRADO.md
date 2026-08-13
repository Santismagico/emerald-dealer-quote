# Activación: cupo de la beta y borrado de cuenta

_Escrito el 2026-08-12, para la salida al mercado con 20 cupos._

## Qué activa

1. **Cupo de 20 cuentas.** El registro número 21 queda rechazado con un mensaje que invita a
   escribir por WhatsApp. Antes no había ningún tope.
2. **Borrado de la propia joyería**, con todos sus datos y con constancia. Es el derecho de
   supresión de la Ley 1581, y hasta hoy solo se podía hacer a mano en el panel del proveedor,
   sin dejar registro.

## Orden

1. **Pruebas** (`ovfaehoeidxcjrlapioo`). Comprobar que devuelve 4.
2. **N6 real.** Importa correr la prueba aquí: la migración **redefine `create_organization`**,
   que es justo la función con la que N6 crea sus dos joyerías. Si algo se rompió, N6 no
   arranca.
3. **Producción** (`wrvokfzrcmmlzekudypu`), con autorización de Santiago en ese momento.

## Comprobación después de aplicar

```sql
select count(*) as cupo_y_borrado_verificados
from (
  select 1 from pg_catalog.pg_tables
  where schemaname = 'public' and tablename = 'platform_limits'
  union all
  select 1 from pg_catalog.pg_tables
  where schemaname = 'public' and tablename = 'deletion_records'
  union all
  select 1 from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_organization'
    and p.prosrc like '%beta capacity reached%'
  union all
  select 1 from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'delete_my_organization'
) comprobaciones;
```

**Debe devolver `4`.**

## Para vigilar el cupo durante la beta

```sql
select
  (select max_organizations from public.platform_limits) as cupo,
  (select count(*) from public.organizations) as joyerias_creadas;
```

## Para cambiar el cupo (sin migración nueva)

```sql
update public.platform_limits set max_organizations = 30, updated_at = now();
```

Un `null` en `max_organizations` significa **sin tope**.

## Para ver las constancias de borrado

```sql
select organization_name, deleted_at, scope
from public.deletion_records
order by deleted_at desc;
```

Guarda el nombre comercial de la joyería, la fecha y **cuántos** registros de cada tipo se
borraron. **No guarda datos de clientes**: esa era justamente la idea.

## Lo que este bloque NO hace, y hay que hacer a mano

**No borra la cuenta de acceso** (el correo y la contraseña). Eso vive en el esquema de
autenticación del proveedor y tocarlo desde una migración sería arriesgado.

Procedimiento manual del operador, dentro de los **5 días hábiles** que prometen los términos:

1. Supabase → proyecto de Producción → **Authentication** → **Users**.
2. Buscar el correo de la persona.
3. Menú de la fila → **Delete user**.
4. Responder por escrito a quien lo pidió, confirmando que se completó.

La constancia del paso automático ya quedó en `deletion_records`; basta anotar en la respuesta
la fecha de este paso manual.
