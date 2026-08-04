-- Gastos del negocio (Plan v2 B1 / D-059).
--
-- Migracion aditiva y repetible sobre una base con datos reales. La tabla
-- publica nace con RLS, lectura minima para usuarios autenticados y ninguna
-- escritura directa: todo cambio pasa por funciones protegidas que resuelven
-- la organizacion en el servidor.

create table if not exists public.expenses (
  id text not null check (char_length(btrim(id)) > 0),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null,
  primary key (organization_id, id)
);

create index if not exists expenses_org_updated
  on public.expenses (organization_id, updated_at desc);

alter table public.expenses enable row level security;

drop policy if exists expenses_select_member on public.expenses;
create policy expenses_select_member on public.expenses
for select to authenticated
using (exists (
  select 1 from public.memberships m
  where m.organization_id = expenses.organization_id
    and m.user_id = (select auth.uid())
));

revoke all on table public.expenses from anon;
revoke insert, update, delete on table public.expenses from authenticated;
grant select on table public.expenses to authenticated;
grant select, insert, update, delete on table public.expenses to service_role;

create or replace function private.is_nonblank_string(p_value jsonb)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(p_value) = 'string'
      and char_length(btrim(p_value #>> '{}')) > 0,
    false
  );
$$;

create or replace function private.is_iso_date(p_value jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_text text;
  v_date date;
begin
  if jsonb_typeof(p_value) is distinct from 'string' then return false; end if;
  v_text := p_value #>> '{}';
  if v_text !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
  v_date := v_text::date;
  return to_char(v_date, 'YYYY-MM-DD') = v_text;
exception
  when invalid_datetime_format or datetime_field_overflow then return false;
end;
$$;

create or replace function private.assert_expense_payload(
  p_id text,
  p_data jsonb,
  p_updated_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_partner_id_type text := jsonb_typeof(p_data->'partnerId');
  v_partner_name text;
  v_my_percent numeric;
begin
  perform private.assert_entity_payload('expense', p_id, p_data, p_updated_at);

  if not private.is_iso_date(p_data->'date')
     or not private.is_nonblank_string(p_data->'concept')
     or not private.is_nonblank_string(p_data->'category')
     or not private.is_nonblank_string(p_data->'method')
     or not private.is_nonblank_string(p_data->'paidBy')
     or jsonb_typeof(p_data->'partnerName') is distinct from 'string'
     or jsonb_typeof(p_data->'notes') is distinct from 'string'
     or jsonb_typeof(p_data->'createdAt') is distinct from 'string'
     or jsonb_typeof(p_data->'updatedAt') is distinct from 'string' then
    raise exception 'invalid expense payload' using errcode = '22023';
  end if;

  if not private.is_nonnegative_integer(p_data->'amountCop')
     or (p_data->>'amountCop')::numeric <= 0 then
    raise exception 'invalid expense amount' using errcode = '22023';
  end if;
  if not private.is_nonnegative_integer(p_data->'myPercent') then
    raise exception 'invalid expense share' using errcode = '22023';
  end if;
  v_my_percent := (p_data->>'myPercent')::numeric;
  if v_my_percent > 100 then
    raise exception 'invalid expense share' using errcode = '22023';
  end if;

  if v_partner_id_type is distinct from 'null'
     and not private.is_nonblank_string(p_data->'partnerId') then
    raise exception 'invalid expense partner' using errcode = '22023';
  end if;
  v_partner_name := btrim(p_data->>'partnerName');
  if v_partner_id_type = 'string' and char_length(v_partner_name) = 0 then
    raise exception 'invalid expense partner name' using errcode = '22023';
  end if;
  -- Sin sociedad ni nombre historico, el gasto es 100% propio.
  if v_partner_id_type = 'null' and char_length(v_partner_name) = 0 and v_my_percent <> 100 then
    raise exception 'invalid own expense share' using errcode = '22023';
  end if;
end;
$$;

-- Las categorias administradas viven dentro de org_settings. Se conserva la
-- validacion anterior y se agrega la forma segura de la lista si esta presente.
create or replace function private.assert_settings_payload(
  p_data jsonb,
  p_updated_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.assert_updated_at(p_updated_at);
  if jsonb_typeof(p_data) <> 'object' then
    raise exception 'invalid settings payload' using errcode = '22023';
  end if;
  if p_data ? 'currency' and p_data->>'currency' <> 'COP' then
    raise exception 'invalid settings currency' using errcode = '22023';
  end if;
  if (p_data ? 'goldPricePerGram' and not private.is_nonnegative_integer(p_data->'goldPricePerGram'))
     or (p_data ? 'goldMarkupPerGram' and not private.is_nonnegative_integer(p_data->'goldMarkupPerGram'))
     or (p_data ? 'quoteCounter' and not private.is_nonnegative_integer(p_data->'quoteCounter'))
     or (p_data ? 'settingsVersion' and not private.is_nonnegative_integer(p_data->'settingsVersion'))
     or (p_data ? 'defaultValidityDays' and not private.is_nonnegative_integer(p_data->'defaultValidityDays')) then
    raise exception 'invalid settings numeric field' using errcode = '22023';
  end if;
  if p_data ? 'expenseCategories' then
    if jsonb_typeof(p_data->'expenseCategories') is distinct from 'array'
       or exists (
         select 1 from jsonb_array_elements(p_data->'expenseCategories') item
         where jsonb_typeof(item) is distinct from 'object'
            or not private.is_nonblank_string(item->'name')
            or jsonb_typeof(item->'active') is distinct from 'boolean'
       )
       or exists (
         select 1
         from jsonb_array_elements(p_data->'expenseCategories') item
         group by lower(btrim(item->>'name'))
         having count(*) > 1
       ) then
      raise exception 'invalid expense categories' using errcode = '22023';
    end if;
  end if;
end;
$$;

revoke all on function private.is_nonblank_string(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.is_iso_date(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_expense_payload(text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_settings_payload(jsonb, timestamptz)
  from public, anon, authenticated, service_role;

create or replace function public.upsert_expense(
  p_id text,
  p_data jsonb,
  p_updated_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
begin
  perform private.assert_expense_payload(p_id, p_data, p_updated_at);
  insert into public.expenses (id, organization_id, data, updated_at)
  values (p_id, v_organization_id, p_data, p_updated_at)
  on conflict (organization_id, id) do update
  set data = excluded.data, updated_at = excluded.updated_at
  where excluded.updated_at >= public.expenses.updated_at;
end;
$$;

create or replace function public.delete_expense(p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
begin
  delete from public.expenses
  where organization_id = v_organization_id and id = p_id;
end;
$$;

revoke all on function public.upsert_expense(text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.delete_expense(text)
  from public, anon, authenticated, service_role;

grant execute on function public.upsert_expense(text, jsonb, timestamptz) to authenticated;
grant execute on function public.delete_expense(text) to authenticated;
