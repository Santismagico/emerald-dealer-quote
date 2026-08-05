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
