# SQL pendiente del servidor — pegar UNA sola vez

> **Para Héctor.** Este es el único paso que la aplicación no puede hacer sola.
> Hay **dos partes**, seguidas. Pegue las dos, en orden. Juntas toman unos diez
> minutos y **no borran absolutamente nada** de lo que ya está guardado.

---

## Antes de empezar

Estas dos partes le avisan al servidor de todo lo nuevo del inventario:
**compradores, joyas en stock, socios de material y lotes de material.**

Las dos solo AGREGAN. No borran ninguna tabla, ninguna columna ni ningún dato.
Sus cotizaciones, clientes, piedras y proveedores quedan exactamente igual. Si
por accidente pega algo dos veces, tampoco pasa nada.

**Hágalo ANTES de publicar la aplicación actualizada.** Al revés, la app buscaría
cosas que el servidor aún no conoce.

---

## Pasos (iguales para las dos partes)

1. Entre a **supabase.com** e inicie sesión.
2. Abra el proyecto **Emerald Dealer Produccion**.
3. En el menú de la izquierda, presione **SQL Editor**.
4. Presione **New query** (consulta nueva).
5. Copie **TODO** el texto de la **PARTE 1** de abajo y péguelo en el recuadro grande.
6. Presione el botón verde **Run** (o Ctrl + Enter). Debe aparecer **Success** en verde.
7. Presione otra vez **New query**, copie **TODO** el texto de la **PARTE 2**, y
   presione **Run**. Debe aparecer **Success** de nuevo.

Si en vez de verde sale un aviso rojo, **no toque nada más**: tome una foto de la
pantalla completa y envíela. No se dañó nada; solo no se aplicó.

---

## Cómo comprobar que quedó bien

En el menú de la izquierda, presione **Table Editor**. En la lista de tablas deben
aparecer **cuatro** nombres nuevos, todos vacíos (eso es lo correcto):

- **buyers**
- **stock_jewels**
- **material_partners**
- **material_lots**

Listo. A partir de ahí se puede publicar la aplicación actualizada.

---

## PARTE 1 — Compradores y joyas en stock

```sql
-- Ampliacion de inventario (D-042 a D-046): compradores y joyas en stock.
--
-- SEGURA SOBRE UNA BASE QUE YA TIENE DATOS REALES. Es puramente ADITIVA:
-- solo create ... if not exists, create or replace y grant. No hay ningun
-- drop de tablas, columnas ni datos existentes. Ejecutarla dos veces por
-- error es inofensivo.
--
-- Recordatorio de la migracion de endurecimiento (S1): los objetos nuevos
-- NACEN CERRADOS por los alter default privileges. Sin los grant explicitos
-- de mas abajo la aplicacion no podria ni leer estas tablas.

-- ---------------------------------------------------------------------------
-- 1. Tablas nuevas, con la misma forma probada de suppliers y stone_lots.
-- ---------------------------------------------------------------------------

create table if not exists public.buyers (
  id text not null check (char_length(btrim(id)) > 0),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null,
  primary key (organization_id, id)
);

create table if not exists public.stock_jewels (
  id text not null check (char_length(btrim(id)) > 0),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null,
  primary key (organization_id, id)
);

create index if not exists buyers_org_updated
  on public.buyers (organization_id, updated_at desc);
create index if not exists stock_jewels_org_updated
  on public.stock_jewels (organization_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- 2. Aislamiento por organizacion. Solo lectura directa: las escrituras van
--    exclusivamente por las funciones protegidas (frontera unica de S1).
-- ---------------------------------------------------------------------------

alter table public.buyers enable row level security;
alter table public.stock_jewels enable row level security;

-- Postgres no admite create policy if not exists; sobre una tabla recien
-- creada el drop previo es inofensivo y deja la migracion repetible.
drop policy if exists buyers_select_member on public.buyers;
create policy buyers_select_member on public.buyers
for select to authenticated
using (exists (
  select 1 from public.memberships m
  where m.organization_id = buyers.organization_id
    and m.user_id = (select auth.uid())
));

drop policy if exists stock_jewels_select_member on public.stock_jewels;
create policy stock_jewels_select_member on public.stock_jewels
for select to authenticated
using (exists (
  select 1 from public.memberships m
  where m.organization_id = stock_jewels.organization_id
    and m.user_id = (select auth.uid())
));

revoke all on table public.buyers, public.stock_jewels from anon;
revoke insert, update, delete on table public.buyers, public.stock_jewels from authenticated;
grant select on table public.buyers, public.stock_jewels to authenticated;
grant select, insert, update, delete on table public.buyers, public.stock_jewels to service_role;

-- ---------------------------------------------------------------------------
-- 3. Validacion de carga en el servidor.
-- ---------------------------------------------------------------------------

create or replace function private.assert_stock_jewel_payload(
  p_id text,
  p_data jsonb,
  p_updated_at timestamptz
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.assert_entity_payload('stock jewel', p_id, p_data, p_updated_at);
  if not private.is_nonnegative_integer(p_data->'costCop')
     or not private.is_nonnegative_integer(p_data->'priceCop')
     or coalesce(lower(p_data->>'status'), '') not in ('disponible', 'apartada') then
    raise exception 'invalid stock jewel payload' using errcode = '22023';
  end if;
  -- La venta puede no existir (pieza en vitrina): null es valido. Cualquier
  -- otra forma que no sea un objeto se rechaza.
  if p_data ? 'sale' and jsonb_typeof(p_data->'sale') not in ('object', 'null') then
    raise exception 'invalid stock jewel sale' using errcode = '22023';
  end if;
  if jsonb_typeof(p_data->'sale') = 'object'
     and not private.is_nonnegative_integer(p_data->'sale'->'priceCop') then
    raise exception 'invalid stock jewel COP field' using errcode = '22023';
  end if;
end;
$$;

-- Se AMPLIA la validacion existente de lotes para cubrir el credito al vender
-- (D-042): los abonos del comprador tambien son dinero y deben ser enteros no
-- negativos. create or replace no borra nada: reemplaza el cuerpo.
create or replace function private.assert_stone_lot_payload(
  p_id text,
  p_data jsonb,
  p_updated_at timestamptz
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.assert_entity_payload('stone lot', p_id, p_data, p_updated_at);
  if not private.is_nonnegative_integer(p_data->'purchaseValueCop')
     or not private.is_nonnegative_integer(p_data->'quantity')
     or jsonb_typeof(p_data->'supplierPayments') <> 'array'
     or jsonb_typeof(p_data->'sales') <> 'array' then
    raise exception 'invalid stone lot payload' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_data->'supplierPayments') item
    where not private.is_nonnegative_integer(item->'amount')
  ) or exists (
    select 1 from jsonb_array_elements(p_data->'sales') item
    where not private.is_nonnegative_integer(item->'valueCop')
       or not private.is_nonnegative_integer(item->'quantity')
  ) then
    raise exception 'invalid stone lot COP field' using errcode = '22023';
  end if;
  -- Abonos del comprador dentro de cada venta a credito.
  if exists (
    select 1
    from jsonb_array_elements(p_data->'sales') sale
    where sale ? 'payments' and jsonb_typeof(sale->'payments') <> 'array'
  ) then
    raise exception 'invalid stone lot payload' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_data->'sales') sale,
         jsonb_array_elements(coalesce(sale->'payments', '[]'::jsonb)) item
    where not private.is_nonnegative_integer(item->'amount')
  ) then
    raise exception 'invalid stone lot COP field' using errcode = '22023';
  end if;
end;
$$;

revoke all on function private.assert_stock_jewel_payload(text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_stone_lot_payload(text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Funciones protegidas. El organization_id lo resuelve SIEMPRE el servidor:
--    nunca se acepta el que envie el navegador.
-- ---------------------------------------------------------------------------

create or replace function public.upsert_buyer(p_id text, p_data jsonb, p_updated_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
begin
  perform private.assert_entity_payload('buyer', p_id, p_data, p_updated_at);
  insert into public.buyers (id, organization_id, data, updated_at)
  values (p_id, v_organization_id, p_data, p_updated_at)
  on conflict (organization_id, id) do update
  set data = excluded.data, updated_at = excluded.updated_at
  where excluded.updated_at >= public.buyers.updated_at;
end;
$$;

create or replace function public.upsert_stock_jewel(p_id text, p_data jsonb, p_updated_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
begin
  perform private.assert_stock_jewel_payload(p_id, p_data, p_updated_at);
  insert into public.stock_jewels (id, organization_id, data, updated_at)
  values (p_id, v_organization_id, p_data, p_updated_at)
  on conflict (organization_id, id) do update
  set data = excluded.data, updated_at = excluded.updated_at
  where excluded.updated_at >= public.stock_jewels.updated_at;
end;
$$;

create or replace function public.delete_buyer(p_id text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
begin delete from public.buyers where organization_id = v_organization_id and id = p_id; end;
$$;

create or replace function public.delete_stock_jewel(p_id text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
begin delete from public.stock_jewels where organization_id = v_organization_id and id = p_id; end;
$$;

revoke all on function public.upsert_buyer(text, jsonb, timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.upsert_stock_jewel(text, jsonb, timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.delete_buyer(text) from public, anon, authenticated, service_role;
revoke all on function public.delete_stock_jewel(text) from public, anon, authenticated, service_role;

grant execute on function public.upsert_buyer(text, jsonb, timestamptz) to authenticated;
grant execute on function public.upsert_stock_jewel(text, jsonb, timestamptz) to authenticated;
grant execute on function public.delete_buyer(text) to authenticated;
grant execute on function public.delete_stock_jewel(text) to authenticated;
```

---

## PARTE 2 — Socios y lotes de material

```sql
-- Inventario de materiales (D-048/D-049): socios y lotes de material.
--
-- SEGURA SOBRE UNA BASE QUE YA TIENE DATOS REALES. Es puramente ADITIVA:
-- solo create ... if not exists, create or replace y grant. No hay ningun
-- drop de tablas, columnas ni datos existentes. Ejecutarla dos veces por
-- error es inofensivo.
--
-- Los objetos nuevos NACEN CERRADOS por los alter default privileges (S1).
-- Sin los grant explicitos de mas abajo el navegador no podria ni leer.

-- ---------------------------------------------------------------------------
-- 1. Tablas nuevas, con la misma forma probada de suppliers y stone_lots.
-- ---------------------------------------------------------------------------

create table if not exists public.material_partners (
  id text not null check (char_length(btrim(id)) > 0),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null,
  primary key (organization_id, id)
);

create table if not exists public.material_lots (
  id text not null check (char_length(btrim(id)) > 0),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null,
  primary key (organization_id, id)
);

create index if not exists material_partners_org_updated
  on public.material_partners (organization_id, updated_at desc);
create index if not exists material_lots_org_updated
  on public.material_lots (organization_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- 2. Aislamiento por organizacion. Solo lectura directa: las escrituras van
--    exclusivamente por las funciones protegidas (frontera unica de S1).
-- ---------------------------------------------------------------------------

alter table public.material_partners enable row level security;
alter table public.material_lots enable row level security;

drop policy if exists material_partners_select_member on public.material_partners;
create policy material_partners_select_member on public.material_partners
for select to authenticated
using (exists (
  select 1 from public.memberships m
  where m.organization_id = material_partners.organization_id
    and m.user_id = (select auth.uid())
));

drop policy if exists material_lots_select_member on public.material_lots;
create policy material_lots_select_member on public.material_lots
for select to authenticated
using (exists (
  select 1 from public.memberships m
  where m.organization_id = material_lots.organization_id
    and m.user_id = (select auth.uid())
));

revoke all on table public.material_partners, public.material_lots from anon;
revoke insert, update, delete on table public.material_partners, public.material_lots from authenticated;
grant select on table public.material_partners, public.material_lots to authenticated;
grant select, insert, update, delete on table public.material_partners, public.material_lots to service_role;

-- ---------------------------------------------------------------------------
-- 3. Validacion de carga en el servidor.
-- ---------------------------------------------------------------------------

create or replace function private.is_nonnegative_number(p_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare v_number numeric;
begin
  if p_value is null or jsonb_typeof(p_value) <> 'number' then
    return false;
  end if;
  v_number := (p_value #>> '{}')::numeric;
  return v_number >= 0;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    return false;
end;
$$;

create or replace function private.assert_material_lot_payload(
  p_id text,
  p_data jsonb,
  p_updated_at timestamptz
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.assert_entity_payload('material lot', p_id, p_data, p_updated_at);
  if not private.is_nonnegative_number(p_data->'grams')
     or not private.is_nonnegative_integer(p_data->'costCop')
     or not private.is_nonnegative_number(p_data->'myGrams')
     or jsonb_typeof(p_data->'uses') <> 'array' then
    raise exception 'invalid material lot payload' using errcode = '22023';
  end if;
  -- Mi parte nunca puede superar los gramos del lote.
  if (p_data->>'myGrams')::numeric > (p_data->>'grams')::numeric then
    raise exception 'invalid material lot share' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_data->'uses') item
    where not private.is_nonnegative_number(item->'grams')
  ) then
    raise exception 'invalid material lot use' using errcode = '22023';
  end if;
end;
$$;

revoke all on function private.is_nonnegative_number(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_material_lot_payload(text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Funciones protegidas. El organization_id lo resuelve SIEMPRE el servidor:
--    nunca se acepta el que envie el navegador.
-- ---------------------------------------------------------------------------

create or replace function public.upsert_material_partner(p_id text, p_data jsonb, p_updated_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
begin
  perform private.assert_entity_payload('material partner', p_id, p_data, p_updated_at);
  insert into public.material_partners (id, organization_id, data, updated_at)
  values (p_id, v_organization_id, p_data, p_updated_at)
  on conflict (organization_id, id) do update
  set data = excluded.data, updated_at = excluded.updated_at
  where excluded.updated_at >= public.material_partners.updated_at;
end;
$$;

create or replace function public.upsert_material_lot(p_id text, p_data jsonb, p_updated_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
begin
  perform private.assert_material_lot_payload(p_id, p_data, p_updated_at);
  insert into public.material_lots (id, organization_id, data, updated_at)
  values (p_id, v_organization_id, p_data, p_updated_at)
  on conflict (organization_id, id) do update
  set data = excluded.data, updated_at = excluded.updated_at
  where excluded.updated_at >= public.material_lots.updated_at;
end;
$$;

create or replace function public.delete_material_partner(p_id text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
begin delete from public.material_partners where organization_id = v_organization_id and id = p_id; end;
$$;

create or replace function public.delete_material_lot(p_id text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
begin delete from public.material_lots where organization_id = v_organization_id and id = p_id; end;
$$;

revoke all on function public.upsert_material_partner(text, jsonb, timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.upsert_material_lot(text, jsonb, timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.delete_material_partner(text) from public, anon, authenticated, service_role;
revoke all on function public.delete_material_lot(text) from public, anon, authenticated, service_role;

grant execute on function public.upsert_material_partner(text, jsonb, timestamptz) to authenticated;
grant execute on function public.upsert_material_lot(text, jsonb, timestamptz) to authenticated;
grant execute on function public.delete_material_partner(text) to authenticated;
grant execute on function public.delete_material_lot(text) to authenticated;
```
