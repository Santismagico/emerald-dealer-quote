-- SQL de produccion — Plan v2 (7 migraciones)
-- Generado el 2026-08-04 desde supabase/migrations/
-- Aditivo: no borra tablas, columnas ni datos. Repetible.
-- Pegar COMPLETO en el SQL Editor de Supabase, en este orden, de una sola vez.



-- ============================================================
-- 20260803205711_gastos_negocio
-- ============================================================

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


-- ============================================================
-- 20260803220000_sociedades_lotes_piedras
-- ============================================================

-- B2: sociedades en lotes de piedras (D-053/D-060).
--
-- Migracion aditiva: StoneLot sigue viviendo como JSON dentro de stone_lots.
-- Solo se amplia la validacion protegida existente; la tabla, RLS y las RPC
-- conservan exactamente el modelo de seguridad ya aplicado.

create or replace function private.assert_stone_lot_payload(
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
  v_partner_id_type text := coalesce(jsonb_typeof(p_data->'partnerId'), 'null');
  v_partner_name text := coalesce(btrim(p_data->>'partnerName'), '');
  v_my_percent numeric := 100;
begin
  perform private.assert_entity_payload('stone lot', p_id, p_data, p_updated_at);

  -- Validaciones existentes de compra, ventas, credito y pagos. Se copian desde
  -- la ultima version vigente para no perder ninguna defensa al reemplazar el cuerpo.
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

  -- Los tres campos son opcionales para que un cliente anterior a B2 pueda
  -- seguir guardando. Cuando faltan representan un lote 100% propio.
  if p_data ? 'partnerId'
     and v_partner_id_type not in ('null', 'string') then
    raise exception 'invalid stone lot partner' using errcode = '22023';
  end if;
  if v_partner_id_type = 'string'
     and not private.is_nonblank_string(p_data->'partnerId') then
    raise exception 'invalid stone lot partner' using errcode = '22023';
  end if;
  if p_data ? 'partnerName'
     and jsonb_typeof(p_data->'partnerName') is distinct from 'string' then
    raise exception 'invalid stone lot partner name' using errcode = '22023';
  end if;

  if p_data ? 'myPercent' then
    if not private.is_nonnegative_integer(p_data->'myPercent') then
      raise exception 'invalid stone lot share' using errcode = '22023';
    end if;
    v_my_percent := (p_data->>'myPercent')::numeric;
    if v_my_percent > 100 then
      raise exception 'invalid stone lot share' using errcode = '22023';
    end if;
  end if;

  if v_partner_id_type = 'string' and char_length(v_partner_name) = 0 then
    raise exception 'invalid stone lot partner name' using errcode = '22023';
  end if;
  -- Tras borrar una ficha, partnerId queda null pero nombre y porcentaje siguen.
  -- Solo null + nombre vacio significa que no existe sociedad y exige 100% propio.
  if v_partner_id_type = 'null'
     and char_length(v_partner_name) = 0
     and v_my_percent <> 100 then
    raise exception 'invalid own stone lot share' using errcode = '22023';
  end if;
end;
$$;

revoke all on function private.assert_stone_lot_payload(text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;


-- ============================================================
-- 20260803233000_tipo_producto_moneda
-- ============================================================

-- B3: tipo de producto y referencia historica USD/COP (D-058).
--
-- Migracion aditiva: reemplaza los cuatro validadores privados que reciben
-- los nuevos campos y endurece el guardado de ajustes para no perder datos B3
-- cuando dos dispositivos guardan versiones distintas. No cambia tablas, RLS
-- ni datos existentes.

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

  if p_data ? 'productTypes' then
    if jsonb_typeof(p_data->'productTypes') is distinct from 'array'
       or exists (
         select 1 from jsonb_array_elements(p_data->'productTypes') item
         where jsonb_typeof(item) is distinct from 'object'
            or not private.is_nonblank_string(item->'name')
            or jsonb_typeof(item->'active') is distinct from 'boolean'
       )
       or exists (
         select 1
         from jsonb_array_elements(p_data->'productTypes') item
         group by lower(btrim(item->>'name'))
         having count(*) > 1
       ) then
      raise exception 'invalid product types' using errcode = '22023';
    end if;
  end if;

  -- Campos opcionales: un settings historico puede no tener referencia USD.
  if p_data ? 'lastKnownUsdRate'
     and jsonb_typeof(p_data->'lastKnownUsdRate') not in ('number', 'null') then
    raise exception 'invalid USD rate' using errcode = '22023';
  end if;
  if jsonb_typeof(p_data->'lastKnownUsdRate') = 'number'
     and ((p_data->>'lastKnownUsdRate')::numeric < 1000
       or (p_data->>'lastKnownUsdRate')::numeric > 20000) then
    raise exception 'invalid USD rate' using errcode = '22023';
  end if;
  if p_data ? 'usdRateUpdatedAt'
     and jsonb_typeof(p_data->'usdRateUpdatedAt') is distinct from 'string' then
    raise exception 'invalid USD rate timestamp' using errcode = '22023';
  end if;
  if p_data ? 'productTypesUpdatedAt'
     and jsonb_typeof(p_data->'productTypesUpdatedAt') is distinct from 'string' then
    raise exception 'invalid product types timestamp' using errcode = '22023';
  end if;

  -- Las cadenas vacias representan datos historicos sin fecha. Si hay una
  -- fecha, debe poder compararse de forma segura en la fusion atomica.
  begin
    if p_data ? 'usdRateUpdatedAt'
       and char_length(btrim(p_data->>'usdRateUpdatedAt')) > 0 then
      perform (p_data->>'usdRateUpdatedAt')::timestamptz;
    end if;
    if p_data ? 'productTypesUpdatedAt'
       and char_length(btrim(p_data->>'productTypesUpdatedAt')) > 0 then
      perform (p_data->>'productTypesUpdatedAt')::timestamptz;
    end if;
  exception
    when invalid_datetime_format or datetime_field_overflow then
      raise exception 'invalid settings timestamp' using errcode = '22023';
  end;
end;
$$;

create or replace function private.assert_stone_lot_payload(
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
  v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
  v_existing_data jsonb;
  v_partner_id_type text := coalesce(jsonb_typeof(p_data->'partnerId'), 'null');
  v_partner_name text := coalesce(btrim(p_data->>'partnerName'), '');
  v_my_percent numeric := 100;
begin
  perform private.assert_entity_payload('stone lot', p_id, p_data, p_updated_at);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stone_lots:' || p_id, 0)
  );

  select lot.data
  into v_existing_data
  from public.stone_lots lot
  where lot.organization_id = v_organization_id and lot.id = p_id
  for update;

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

  -- productType vacio y usdRate null siguen representando historicos sin registrar.
  if exists (
    select 1
    from jsonb_array_elements(p_data->'sales') sale
    where (sale ? 'productType' and jsonb_typeof(sale->'productType') is distinct from 'string')
       or (sale ? 'usdRate' and jsonb_typeof(sale->'usdRate') not in ('number', 'null'))
       or (jsonb_typeof(sale->'usdRate') = 'number'
           and ((sale->>'usdRate')::numeric < 1000
             or (sale->>'usdRate')::numeric > 20000))
  ) then
    raise exception 'invalid stone sale currency fields' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_data->'sales') sale,
         jsonb_array_elements(coalesce(sale->'payments', '[]'::jsonb)) item
    where (item ? 'usdRate' and jsonb_typeof(item->'usdRate') not in ('number', 'null'))
       or (jsonb_typeof(item->'usdRate') = 'number'
           and ((item->>'usdRate')::numeric < 1000
             or (item->>'usdRate')::numeric > 20000))
  ) then
    raise exception 'invalid buyer payment USD rate' using errcode = '22023';
  end if;

  -- Una tasa ya guardada pertenece para siempre a esa operacion. Ausente y null
  -- son el mismo estado historico y tampoco se pueden completar despues.
  if v_existing_data is not null and exists (
    select 1
    from jsonb_array_elements(coalesce(v_existing_data->'sales', '[]'::jsonb)) old_sale
    join jsonb_array_elements(p_data->'sales') new_sale
      on new_sale->>'id' = old_sale->>'id'
    where coalesce(old_sale->'usdRate', 'null'::jsonb)
          is distinct from coalesce(new_sale->'usdRate', 'null'::jsonb)
  ) then
    raise exception 'stone sale USD rate is immutable' using errcode = '22023';
  end if;
  if v_existing_data is not null and exists (
    select 1
    from jsonb_array_elements(coalesce(v_existing_data->'sales', '[]'::jsonb)) old_sale
    join jsonb_array_elements(p_data->'sales') new_sale
      on new_sale->>'id' = old_sale->>'id'
    cross join jsonb_array_elements(coalesce(old_sale->'payments', '[]'::jsonb)) old_payment
    join jsonb_array_elements(coalesce(new_sale->'payments', '[]'::jsonb)) new_payment
      on new_payment->>'id' = old_payment->>'id'
    where coalesce(old_payment->'usdRate', 'null'::jsonb)
          is distinct from coalesce(new_payment->'usdRate', 'null'::jsonb)
  ) then
    raise exception 'buyer payment USD rate is immutable' using errcode = '22023';
  end if;

  if p_data ? 'partnerId'
     and v_partner_id_type not in ('null', 'string') then
    raise exception 'invalid stone lot partner' using errcode = '22023';
  end if;
  if v_partner_id_type = 'string'
     and not private.is_nonblank_string(p_data->'partnerId') then
    raise exception 'invalid stone lot partner' using errcode = '22023';
  end if;
  if p_data ? 'partnerName'
     and jsonb_typeof(p_data->'partnerName') is distinct from 'string' then
    raise exception 'invalid stone lot partner name' using errcode = '22023';
  end if;
  if p_data ? 'myPercent' then
    if not private.is_nonnegative_integer(p_data->'myPercent') then
      raise exception 'invalid stone lot share' using errcode = '22023';
    end if;
    v_my_percent := (p_data->>'myPercent')::numeric;
    if v_my_percent > 100 then
      raise exception 'invalid stone lot share' using errcode = '22023';
    end if;
  end if;
  if v_partner_id_type = 'string' and char_length(v_partner_name) = 0 then
    raise exception 'invalid stone lot partner name' using errcode = '22023';
  end if;
  if v_partner_id_type = 'null'
     and char_length(v_partner_name) = 0
     and v_my_percent <> 100 then
    raise exception 'invalid own stone lot share' using errcode = '22023';
  end if;
end;
$$;

create or replace function private.assert_stock_jewel_payload(
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
  v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
  v_existing_data jsonb;
begin
  perform private.assert_entity_payload('stock jewel', p_id, p_data, p_updated_at);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stock_jewels:' || p_id, 0)
  );

  select jewel.data
  into v_existing_data
  from public.stock_jewels jewel
  where jewel.organization_id = v_organization_id and jewel.id = p_id
  for update;
  if not private.is_nonnegative_integer(p_data->'costCop')
     or not private.is_nonnegative_integer(p_data->'priceCop')
     or coalesce(lower(p_data->>'status'), '') not in ('disponible', 'apartada') then
    raise exception 'invalid stock jewel payload' using errcode = '22023';
  end if;
  if p_data ? 'sale' and jsonb_typeof(p_data->'sale') not in ('object', 'null') then
    raise exception 'invalid stock jewel sale' using errcode = '22023';
  end if;
  if jsonb_typeof(p_data->'sale') = 'object'
     and not private.is_nonnegative_integer(p_data->'sale'->'priceCop') then
    raise exception 'invalid stock jewel COP field' using errcode = '22023';
  end if;
  if jsonb_typeof(p_data->'sale') = 'object'
     and (
       (p_data->'sale' ? 'productType'
        and jsonb_typeof(p_data->'sale'->'productType') is distinct from 'string')
       or (p_data->'sale' ? 'usdRate'
           and jsonb_typeof(p_data->'sale'->'usdRate') not in ('number', 'null'))
       or (jsonb_typeof(p_data->'sale'->'usdRate') = 'number'
           and ((p_data->'sale'->>'usdRate')::numeric < 1000
             or (p_data->'sale'->>'usdRate')::numeric > 20000)
       )
     ) then
    raise exception 'invalid stock jewel sale currency fields' using errcode = '22023';
  end if;
  if v_existing_data is not null
     and jsonb_typeof(v_existing_data->'sale') = 'object'
     and jsonb_typeof(p_data->'sale') = 'object'
     and v_existing_data->'sale'->>'id' = p_data->'sale'->>'id'
     and coalesce(v_existing_data->'sale'->'usdRate', 'null'::jsonb)
         is distinct from coalesce(p_data->'sale'->'usdRate', 'null'::jsonb) then
    raise exception 'stock jewel sale USD rate is immutable' using errcode = '22023';
  end if;
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
  v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
  v_existing_data jsonb;
  v_partner_id_type text := jsonb_typeof(p_data->'partnerId');
  v_partner_name text;
  v_my_percent numeric;
begin
  perform private.assert_entity_payload('expense', p_id, p_data, p_updated_at);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':expenses:' || p_id, 0)
  );

  select expense.data
  into v_existing_data
  from public.expenses expense
  where expense.organization_id = v_organization_id and expense.id = p_id
  for update;

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
  if v_partner_id_type = 'null' and char_length(v_partner_name) = 0 and v_my_percent <> 100 then
    raise exception 'invalid own expense share' using errcode = '22023';
  end if;

  if p_data ? 'usdRate'
     and jsonb_typeof(p_data->'usdRate') not in ('number', 'null') then
    raise exception 'invalid expense USD rate' using errcode = '22023';
  end if;
  if jsonb_typeof(p_data->'usdRate') = 'number'
     and ((p_data->>'usdRate')::numeric < 1000
       or (p_data->>'usdRate')::numeric > 20000) then
    raise exception 'invalid expense USD rate' using errcode = '22023';
  end if;
  if v_existing_data is not null
     and coalesce(v_existing_data->'usdRate', 'null'::jsonb)
         is distinct from coalesce(p_data->'usdRate', 'null'::jsonb) then
    raise exception 'expense USD rate is immutable' using errcode = '22023';
  end if;
end;
$$;

-- Une ajustes por organizacion dentro de una sola transaccion. Los campos
-- generales siguen "ultimo guardado gana", mientras los dos bloques B3 usan
-- sus propias fechas para que una pantalla antigua no borre catalogos o tasas.
create or replace function public.upsert_settings(
  p_data jsonb,
  p_updated_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin']);
  v_existing_data jsonb;
  v_existing_updated_at timestamptz;
  v_merged_data jsonb;
  v_merged_updated_at timestamptz;
  v_row_exists boolean := false;

  v_incoming_rate_at timestamptz;
  v_existing_rate_at timestamptz;
  v_rate_value jsonb;
  v_rate_at timestamptz;

  v_incoming_catalog_at timestamptz;
  v_existing_catalog_at timestamptz;
  v_catalog_winner jsonb := '[]'::jsonb;
  v_catalog_loser jsonb := '[]'::jsonb;
  v_catalog_winner_at timestamptz;
  v_merged_product_types jsonb;

  v_existing_version numeric := 0;
  v_incoming_version numeric := 0;
begin
  perform private.assert_settings_payload(p_data, p_updated_at);

  -- El candado cubre tambien el caso excepcional donde la organizacion aun no
  -- tenga fila; FOR UPDATE serializa el caso normal ya existente.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':org_settings', 0)
  );

  select settings.data, settings.updated_at
  into v_existing_data, v_existing_updated_at
  from public.org_settings settings
  where settings.organization_id = v_organization_id
  for update;
  v_row_exists := found;

  if v_row_exists then
    v_merged_updated_at := greatest(v_existing_updated_at, p_updated_at);
    if p_updated_at >= v_existing_updated_at then
      v_merged_data := v_existing_data || p_data;
    else
      v_merged_data := p_data || v_existing_data;
    end if;
  else
    v_existing_data := '{}'::jsonb;
    v_merged_data := p_data;
    v_merged_updated_at := p_updated_at;
  end if;

  -- La version nunca retrocede, aunque el payload ganador global sea antiguo.
  if private.is_nonnegative_integer(v_existing_data->'settingsVersion') then
    v_existing_version := (v_existing_data->>'settingsVersion')::numeric;
  end if;
  if private.is_nonnegative_integer(p_data->'settingsVersion') then
    v_incoming_version := (p_data->>'settingsVersion')::numeric;
  end if;
  if v_existing_data ? 'settingsVersion' or p_data ? 'settingsVersion' then
    v_merged_data := jsonb_set(
      v_merged_data,
      '{settingsVersion}',
      pg_catalog.to_jsonb(greatest(v_existing_version, v_incoming_version)),
      true
    );
  end if;

  -- lastKnownUsdRate y usdRateUpdatedAt forman un par indivisible. null con
  -- fecha vacia es solo el default historico y nunca borra una tasa conocida.
  if p_data ? 'lastKnownUsdRate'
     and (
       jsonb_typeof(p_data->'lastKnownUsdRate') = 'number'
       or (
         jsonb_typeof(p_data->'lastKnownUsdRate') = 'null'
         and p_data ? 'usdRateUpdatedAt'
         and char_length(btrim(p_data->>'usdRateUpdatedAt')) > 0
       )
     ) then
    v_incoming_rate_at := case
      when p_data ? 'usdRateUpdatedAt'
       and char_length(btrim(p_data->>'usdRateUpdatedAt')) > 0
        then (p_data->>'usdRateUpdatedAt')::timestamptz
      when not (
        v_existing_data ? 'lastKnownUsdRate'
        and jsonb_typeof(v_existing_data->'lastKnownUsdRate') = 'number'
      ) then p_updated_at
      else null
    end;
  end if;
  if v_existing_data ? 'lastKnownUsdRate'
     and (
       jsonb_typeof(v_existing_data->'lastKnownUsdRate') = 'number'
       or (
         jsonb_typeof(v_existing_data->'lastKnownUsdRate') = 'null'
         and v_existing_data ? 'usdRateUpdatedAt'
         and char_length(btrim(v_existing_data->>'usdRateUpdatedAt')) > 0
       )
     ) then
    begin
      v_existing_rate_at := case
        when v_existing_data ? 'usdRateUpdatedAt'
         and char_length(btrim(v_existing_data->>'usdRateUpdatedAt')) > 0
          then (v_existing_data->>'usdRateUpdatedAt')::timestamptz
        else v_existing_updated_at
      end;
    exception
      when invalid_datetime_format or datetime_field_overflow then
        v_existing_rate_at := v_existing_updated_at;
    end;
  end if;

  if v_incoming_rate_at is not null
     and (v_existing_rate_at is null or v_incoming_rate_at >= v_existing_rate_at) then
    v_rate_value := p_data->'lastKnownUsdRate';
    v_rate_at := v_incoming_rate_at;
  elsif v_existing_rate_at is not null then
    v_rate_value := v_existing_data->'lastKnownUsdRate';
    v_rate_at := v_existing_rate_at;
  end if;
  if v_rate_at is not null then
    v_merged_data := jsonb_set(v_merged_data, '{lastKnownUsdRate}', v_rate_value, true);
    v_merged_data := jsonb_set(
      v_merged_data,
      '{usdRateUpdatedAt}',
      pg_catalog.to_jsonb(v_rate_at),
      true
    );
  end if;

  -- Cada catalogo aporta todos sus nombres. La fecha mas reciente decide el
  -- estado active cuando un nombre aparece en ambos, ignorando mayusculas y
  -- espacios; los nombres exclusivos del catalogo perdedor se conservan.
  if jsonb_typeof(p_data->'productTypes') = 'array' then
    v_incoming_catalog_at := case
      when p_data ? 'productTypesUpdatedAt'
       and char_length(btrim(p_data->>'productTypesUpdatedAt')) > 0
        then (p_data->>'productTypesUpdatedAt')::timestamptz
      when jsonb_typeof(v_existing_data->'productTypes') is distinct from 'array'
        then p_updated_at
      else null
    end;
  end if;
  if jsonb_typeof(v_existing_data->'productTypes') = 'array' then
    begin
      v_existing_catalog_at := case
        when v_existing_data ? 'productTypesUpdatedAt'
         and char_length(btrim(v_existing_data->>'productTypesUpdatedAt')) > 0
          then (v_existing_data->>'productTypesUpdatedAt')::timestamptz
        else v_existing_updated_at
      end;
    exception
      when invalid_datetime_format or datetime_field_overflow then
        v_existing_catalog_at := v_existing_updated_at;
    end;
  end if;

  if v_incoming_catalog_at is not null
     and (v_existing_catalog_at is null or v_incoming_catalog_at >= v_existing_catalog_at) then
    v_catalog_winner := p_data->'productTypes';
    v_catalog_loser := coalesce(v_existing_data->'productTypes', '[]'::jsonb);
    v_catalog_winner_at := v_incoming_catalog_at;
  elsif v_existing_catalog_at is not null then
    v_catalog_winner := v_existing_data->'productTypes';
    v_catalog_loser := coalesce(p_data->'productTypes', '[]'::jsonb);
    v_catalog_winner_at := v_existing_catalog_at;
  end if;

  if v_catalog_winner_at is not null then
    select coalesce(
      jsonb_agg(candidate.item order by candidate.source_priority, candidate.ordinality),
      '[]'::jsonb
    )
    into v_merged_product_types
    from (
      select winner.item, 0 as source_priority, winner.ordinality
      from jsonb_array_elements(v_catalog_winner)
        with ordinality as winner(item, ordinality)
      union all
      select loser.item, 1 as source_priority, loser.ordinality
      from jsonb_array_elements(v_catalog_loser)
        with ordinality as loser(item, ordinality)
      where not exists (
        select 1
        from jsonb_array_elements(v_catalog_winner) winner_item
        where lower(btrim(winner_item->>'name')) = lower(btrim(loser.item->>'name'))
      )
    ) candidate;

    v_merged_data := jsonb_set(
      v_merged_data,
      '{productTypes}',
      v_merged_product_types,
      true
    );
    v_merged_data := jsonb_set(
      v_merged_data,
      '{productTypesUpdatedAt}',
      pg_catalog.to_jsonb(v_catalog_winner_at),
      true
    );
  end if;

  perform private.assert_settings_payload(v_merged_data, v_merged_updated_at);

  if v_row_exists then
    update public.org_settings
    set data = v_merged_data,
        updated_at = v_merged_updated_at
    where organization_id = v_organization_id;
  else
    insert into public.org_settings (organization_id, data, updated_at)
    values (v_organization_id, v_merged_data, v_merged_updated_at);
  end if;
end;
$$;

revoke all on function private.assert_settings_payload(jsonb, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_stone_lot_payload(text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_stock_jewel_payload(text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_expense_payload(text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;

revoke all on function public.upsert_settings(jsonb, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.upsert_settings(jsonb, timestamptz) to authenticated;


-- ============================================================
-- 20260804144748_fase_c1_tandas_talla
-- ============================================================

-- Fase C1: tandas parciales de talla dentro de cada lote de piedras.
-- Migracion aditiva: no cambia tablas, RLS ni datos historicos. Los campos
-- ausentes conservan su significado anterior (sin tandas y ventas en bruto).

create or replace function private.assert_stone_lot_cutting_payload(
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
  v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
  v_existing_data jsonb;
  v_batches jsonb;
  v_sales jsonb;
  v_purchase_carats numeric;
  v_purchase_quantity numeric;
  v_sent_carats numeric;
  v_sent_quantity numeric;
  v_returned_carats numeric;
  v_returned_quantity numeric;
  v_raw_sold_carats numeric;
  v_raw_sold_quantity numeric;
  v_cut_sold_carats numeric;
  v_cut_sold_quantity numeric;
begin
  perform private.assert_updated_at(p_updated_at);
  if jsonb_typeof(p_data) is distinct from 'object' then
    raise exception 'invalid stone lot cutting payload' using errcode = '22023';
  end if;

  -- Serializa incluso el primer insert; FOR UPDATE cubre la fila ya creada.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stone_lots:' || p_id, 0)
  );
  select lot.data
  into v_existing_data
  from public.stone_lots lot
  where lot.organization_id = v_organization_id and lot.id = p_id
  for update;

  if p_data ? 'cuttingBatches' then
    if jsonb_typeof(p_data->'cuttingBatches') is distinct from 'array' then
      raise exception 'invalid stone cutting batches' using errcode = '22023';
    end if;
    v_batches := p_data->'cuttingBatches';
  else
    if v_existing_data is not null
       and jsonb_typeof(v_existing_data->'cuttingBatches') = 'array'
       and jsonb_array_length(v_existing_data->'cuttingBatches') > 0 then
      raise exception 'stone cutting history cannot be omitted' using errcode = '22023';
    end if;
    v_batches := '[]'::jsonb;
  end if;

  if jsonb_typeof(p_data->'sales') is distinct from 'array'
     or not private.is_nonnegative_number(p_data->'carats')
     or not private.is_nonnegative_integer(p_data->'quantity') then
    raise exception 'invalid stone lot inventory payload' using errcode = '22023';
  end if;
  v_sales := p_data->'sales';

  if exists (
    select 1
    from jsonb_array_elements(v_batches) batch
    where jsonb_typeof(batch) is distinct from 'object'
       or not private.is_nonblank_string(batch->'id')
       or not private.is_iso_date(batch->'sentDate')
       or not private.is_nonnegative_number(batch->'sentCarats')
       or not private.is_nonnegative_integer(batch->'sentQuantity')
       or jsonb_typeof(batch->'returnedDate') is distinct from 'string'
       or not private.is_nonnegative_number(batch->'returnedCarats')
       or not private.is_nonnegative_integer(batch->'returnedQuantity')
       or not private.is_nonnegative_integer(batch->'cuttingCostCop')
       or jsonb_typeof(batch->'cuttingPaidDate') is distinct from 'string'
       or jsonb_typeof(batch->'notes') is distinct from 'string'
  ) then
    raise exception 'invalid stone cutting batch' using errcode = '22023';
  end if;

  -- Los casts se hacen solo despues de comprobar los tipos: PostgreSQL no
  -- garantiza el orden de evaluacion dentro de una expresion booleana.
  if exists (
    select 1
    from jsonb_array_elements(v_batches) batch
    where (batch->>'sentCarats')::numeric <= 0
       or (batch->>'sentQuantity')::numeric <= 0
  ) then
    raise exception 'stone cutting batch requires carats and quantity' using errcode = '22023';
  end if;

  if jsonb_array_length(v_batches) > 0
     and (
       not private.is_iso_date(p_data->'purchaseDate')
       or exists (
         select 1
         from jsonb_array_elements(v_batches) batch
         where (batch->>'sentDate') < (p_data->>'purchaseDate')
       )
     ) then
    raise exception 'stone cutting cannot predate purchase' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_batches) batch
    group by btrim(batch->>'id')
    having count(*) > 1
  ) then
    raise exception 'duplicate stone cutting batch' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_batches) batch
    where (
      (batch->>'returnedDate') = ''
      and (
        (batch->>'returnedCarats')::numeric <> 0
        or (batch->>'returnedQuantity')::numeric <> 0
      )
    ) or (
      (batch->>'returnedDate') <> ''
      and (
        not private.is_iso_date(batch->'returnedDate')
        or (batch->>'returnedDate') < (batch->>'sentDate')
        or (batch->>'returnedCarats')::numeric > (batch->>'sentCarats')::numeric
      )
    ) or (
      (batch->>'cuttingPaidDate') <> ''
      and (
        not private.is_iso_date(batch->'cuttingPaidDate')
        or (batch->>'cuttingPaidDate') < (batch->>'sentDate')
        or (batch->>'cuttingCostCop')::numeric <= 0
      )
    )
  ) then
    raise exception 'invalid stone cutting dates or return' using errcode = '22023';
  end if;

  -- Ausente significa bruto solo para historia previa a C1. Un valor explicito
  -- siempre debe pertenecer al conjunto cerrado.
  if exists (
    select 1
    from jsonb_array_elements(v_sales) sale
    where (sale ? 'origin' and coalesce(sale->>'origin', '') not in ('bruto', 'tallado'))
       or not private.is_nonnegative_number(sale->'carats')
       or not private.is_nonnegative_integer(sale->'quantity')
  ) then
    raise exception 'invalid stone sale origin or inventory' using errcode = '22023';
  end if;
  if jsonb_array_length(v_batches) > 0
     and exists (select 1 from jsonb_array_elements(v_sales) sale where not (sale ? 'origin')) then
    raise exception 'stone sale origin required with cutting history' using errcode = '22023';
  end if;
  if v_existing_data is not null and exists (
    select 1
    from jsonb_array_elements(coalesce(v_existing_data->'sales', '[]'::jsonb)) old_sale
    join jsonb_array_elements(v_sales) new_sale on new_sale->>'id' = old_sale->>'id'
    where old_sale->>'origin' = 'tallado' and not (new_sale ? 'origin')
  ) then
    raise exception 'tallado sale origin cannot be omitted' using errcode = '22023';
  end if;

  v_purchase_carats := (p_data->>'carats')::numeric;
  v_purchase_quantity := (p_data->>'quantity')::numeric;
  select
    coalesce(sum((batch->>'sentCarats')::numeric), 0),
    coalesce(sum((batch->>'sentQuantity')::numeric), 0),
    coalesce(sum(
      case when (batch->>'returnedDate') <> ''
        then (batch->>'returnedCarats')::numeric else 0 end
    ), 0),
    coalesce(sum(
      case when (batch->>'returnedDate') <> ''
        then (batch->>'returnedQuantity')::numeric else 0 end
    ), 0)
  into v_sent_carats, v_sent_quantity, v_returned_carats, v_returned_quantity
  from jsonb_array_elements(v_batches) batch;

  select
    coalesce(sum(case when coalesce(sale->>'origin', 'bruto') = 'bruto'
      then (sale->>'carats')::numeric else 0 end), 0),
    coalesce(sum(case when coalesce(sale->>'origin', 'bruto') = 'bruto'
      then (sale->>'quantity')::numeric else 0 end), 0),
    coalesce(sum(case when sale->>'origin' = 'tallado'
      then (sale->>'carats')::numeric else 0 end), 0),
    coalesce(sum(case when sale->>'origin' = 'tallado'
      then (sale->>'quantity')::numeric else 0 end), 0)
  into v_raw_sold_carats, v_raw_sold_quantity, v_cut_sold_carats, v_cut_sold_quantity
  from jsonb_array_elements(v_sales) sale;

  if round(v_purchase_carats - round(v_sent_carats, 3) - round(v_raw_sold_carats, 3), 3) < 0
     or v_purchase_quantity - v_sent_quantity - v_raw_sold_quantity < 0 then
    raise exception 'raw stone inventory exceeded' using errcode = '22023';
  end if;
  if round(round(v_returned_carats, 3) - round(v_cut_sold_carats, 3), 3) < 0
     or v_returned_quantity - v_cut_sold_quantity < 0 then
    raise exception 'cut stone inventory exceeded' using errcode = '22023';
  end if;

  -- Sin vinculo venta-tanda, toda tanda ya regresada se protege de forma
  -- conservadora. Costo, fecha de pago y notas siguen editables.
  if v_existing_data is not null
     and (
       exists (
         select 1 from jsonb_array_elements(coalesce(v_existing_data->'sales', '[]'::jsonb)) sale
         where sale->>'origin' = 'tallado'
       )
       or exists (select 1 from jsonb_array_elements(v_sales) sale where sale->>'origin' = 'tallado')
     )
     and exists (
       select 1
       from jsonb_array_elements(coalesce(v_existing_data->'cuttingBatches', '[]'::jsonb)) old_batch
       left join jsonb_array_elements(v_batches) new_batch
         on new_batch->>'id' = old_batch->>'id'
       where coalesce(old_batch->>'returnedDate', '') <> ''
         and (
           new_batch is null
           or jsonb_build_object(
             'id', old_batch->'id',
             'sentDate', old_batch->'sentDate',
             'sentCarats', old_batch->'sentCarats',
             'sentQuantity', old_batch->'sentQuantity',
             'returnedDate', old_batch->'returnedDate',
             'returnedCarats', old_batch->'returnedCarats',
             'returnedQuantity', old_batch->'returnedQuantity'
           ) is distinct from jsonb_build_object(
             'id', new_batch->'id',
             'sentDate', new_batch->'sentDate',
             'sentCarats', new_batch->'sentCarats',
             'sentQuantity', new_batch->'sentQuantity',
             'returnedDate', new_batch->'returnedDate',
             'returnedCarats', new_batch->'returnedCarats',
             'returnedQuantity', new_batch->'returnedQuantity'
           )
         )
     ) then
    raise exception 'returned cutting inventory is immutable after a tallado sale'
      using errcode = '22023';
  end if;
end;
$$;

-- Conserva la firma publica y todas las validaciones B1-B3 anteriores; C1 se
-- agrega inmediatamente antes del upsert dentro de la misma transaccion.
create or replace function public.upsert_stone_lot(
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
  perform private.assert_stone_lot_payload(p_id, p_data, p_updated_at);
  perform private.assert_stone_lot_cutting_payload(p_id, p_data, p_updated_at);
  insert into public.stone_lots (id, organization_id, data, updated_at)
  values (p_id, v_organization_id, p_data, p_updated_at)
  on conflict (organization_id, id) do update
  set data = excluded.data, updated_at = excluded.updated_at
  where excluded.updated_at >= public.stone_lots.updated_at;
end;
$$;

revoke all on function private.assert_stone_lot_cutting_payload(text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.upsert_stone_lot(text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.upsert_stone_lot(text, jsonb, timestamptz) to authenticated;


-- ============================================================
-- 20260804151230_fase_c2_transformacion_joya
-- ============================================================

-- Fase C2: transformar una joya de fantasia a natural como una sola operacion.
--
-- No crea tablas ni modifica RLS. La RPC protegida resuelve la organizacion,
-- bloquea lote y joya, calcula el costo en el servidor y actualiza ambos JSON
-- dentro de la misma transaccion. El mismo id queda en internalUses y en
-- stoneTransformations para que un reintento sea idempotente.

-- ---------------------------------------------------------------------------
-- 1. Forma e inventario de los usos internos embebidos en StoneLot.
-- ---------------------------------------------------------------------------

create or replace function private.assert_stone_lot_internal_uses_payload(
  p_data jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uses jsonb;
  v_batches jsonb;
  v_sales jsonb;
  v_purchase_carats numeric;
  v_purchase_quantity numeric;
  v_sent_carats numeric;
  v_sent_quantity numeric;
  v_returned_carats numeric;
  v_returned_quantity numeric;
  v_raw_sold_carats numeric;
  v_raw_sold_quantity numeric;
  v_cut_sold_carats numeric;
  v_cut_sold_quantity numeric;
  v_raw_used_carats numeric;
  v_raw_used_quantity numeric;
  v_cut_used_carats numeric;
  v_cut_used_quantity numeric;
begin
  if jsonb_typeof(p_data) is distinct from 'object'
     or jsonb_typeof(p_data->'sales') is distinct from 'array'
     or (p_data ? 'cuttingBatches'
         and jsonb_typeof(p_data->'cuttingBatches') is distinct from 'array')
     or not private.is_nonnegative_number(p_data->'carats')
     or not private.is_nonnegative_integer(p_data->'quantity') then
    raise exception 'invalid stone lot internal-use payload' using errcode = '22023';
  end if;

  if p_data ? 'internalUses' then
    if jsonb_typeof(p_data->'internalUses') is distinct from 'array' then
      raise exception 'invalid stone internal uses' using errcode = '22023';
    end if;
    v_uses := p_data->'internalUses';
  else
    v_uses := '[]'::jsonb;
  end if;
  v_batches := coalesce(p_data->'cuttingBatches', '[]'::jsonb);
  v_sales := p_data->'sales';

  if exists (
    select 1
    from jsonb_array_elements(v_uses) use_item
    where jsonb_typeof(use_item) is distinct from 'object'
       or not private.is_nonblank_string(use_item->'id')
       or not private.is_iso_date(use_item->'date')
       or not private.is_nonnegative_number(use_item->'carats')
       or not private.is_nonnegative_integer(use_item->'quantity')
       or jsonb_typeof(use_item->'origin') is distinct from 'string'
       or coalesce(use_item->>'origin', '') not in ('bruto', 'tallado')
       or not private.is_nonblank_string(use_item->'jewelId')
       or not private.is_nonnegative_integer(use_item->'costCop')
       or jsonb_typeof(use_item->'notes') is distinct from 'string'
  ) then
    raise exception 'invalid stone internal use' using errcode = '22023';
  end if;

  -- Los casts ocurren solo despues de validar los tipos.
  if exists (
    select 1
    from jsonb_array_elements(v_uses) use_item
    where (use_item->>'carats')::numeric <= 0
       or (use_item->>'quantity')::numeric <= 0
       or (use_item->>'costCop')::numeric > 9007199254740991
       or (use_item->>'carats')::numeric
          <> round((use_item->>'carats')::numeric, 3)
  ) then
    raise exception 'stone internal use requires carats and quantity' using errcode = '22023';
  end if;

  if jsonb_array_length(v_uses) > 0
     and not private.is_iso_date(p_data->'purchaseDate') then
    raise exception 'stone internal use requires a valid lot purchase date'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(v_uses) use_item
    where use_item->>'date' < p_data->>'purchaseDate'
  ) then
    raise exception 'stone internal use cannot predate lot purchase'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_uses) use_item
    group by btrim(use_item->>'id')
    having count(*) > 1
  ) then
    raise exception 'duplicate stone internal-use event' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(v_uses) use_item
    group by btrim(use_item->>'jewelId')
    having count(*) > 1
  ) then
    raise exception 'stock jewel already consumed a natural stone' using errcode = '22023';
  end if;

  v_purchase_carats := (p_data->>'carats')::numeric;
  v_purchase_quantity := (p_data->>'quantity')::numeric;

  select
    coalesce(sum((batch->>'sentCarats')::numeric), 0),
    coalesce(sum((batch->>'sentQuantity')::numeric), 0),
    coalesce(sum(case when coalesce(batch->>'returnedDate', '') <> ''
      then (batch->>'returnedCarats')::numeric else 0 end), 0),
    coalesce(sum(case when coalesce(batch->>'returnedDate', '') <> ''
      then (batch->>'returnedQuantity')::numeric else 0 end), 0)
  into v_sent_carats, v_sent_quantity, v_returned_carats, v_returned_quantity
  from jsonb_array_elements(v_batches) batch;

  select
    coalesce(sum(case when coalesce(sale->>'origin', 'bruto') = 'bruto'
      then (sale->>'carats')::numeric else 0 end), 0),
    coalesce(sum(case when coalesce(sale->>'origin', 'bruto') = 'bruto'
      then (sale->>'quantity')::numeric else 0 end), 0),
    coalesce(sum(case when sale->>'origin' = 'tallado'
      then (sale->>'carats')::numeric else 0 end), 0),
    coalesce(sum(case when sale->>'origin' = 'tallado'
      then (sale->>'quantity')::numeric else 0 end), 0)
  into v_raw_sold_carats, v_raw_sold_quantity, v_cut_sold_carats, v_cut_sold_quantity
  from jsonb_array_elements(v_sales) sale;

  select
    coalesce(sum(case when use_item->>'origin' = 'bruto'
      then (use_item->>'carats')::numeric else 0 end), 0),
    coalesce(sum(case when use_item->>'origin' = 'bruto'
      then (use_item->>'quantity')::numeric else 0 end), 0),
    coalesce(sum(case when use_item->>'origin' = 'tallado'
      then (use_item->>'carats')::numeric else 0 end), 0),
    coalesce(sum(case when use_item->>'origin' = 'tallado'
      then (use_item->>'quantity')::numeric else 0 end), 0)
  into v_raw_used_carats, v_raw_used_quantity, v_cut_used_carats, v_cut_used_quantity
  from jsonb_array_elements(v_uses) use_item;

  if round(
       v_purchase_carats
       - round(v_sent_carats, 3)
       - round(v_raw_sold_carats, 3)
       - round(v_raw_used_carats, 3),
       3
     ) < 0
     or v_purchase_quantity - v_sent_quantity - v_raw_sold_quantity - v_raw_used_quantity < 0 then
    raise exception 'stone internal uses exceed raw inventory' using errcode = '22023';
  end if;
  if round(
       round(v_returned_carats, 3)
       - round(v_cut_sold_carats, 3)
       - round(v_cut_used_carats, 3),
       3
     ) < 0
     or v_returned_quantity - v_cut_sold_quantity - v_cut_used_quantity < 0 then
    raise exception 'stone internal uses exceed cut inventory' using errcode = '22023';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Forma del historial C2 embebido en StockJewel.
-- ---------------------------------------------------------------------------

create or replace function private.assert_stock_jewel_c2_payload(
  p_data jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_events jsonb;
  v_event_cost numeric;
begin
  if jsonb_typeof(p_data) is distinct from 'object' then
    raise exception 'invalid stock jewel C2 payload' using errcode = '22023';
  end if;
  if (p_data ? 'weightGrams' and not private.is_nonnegative_number(p_data->'weightGrams'))
     or (p_data ? 'size' and jsonb_typeof(p_data->'size') is distinct from 'string')
     or (p_data ? 'stoneCount' and not private.is_nonnegative_integer(p_data->'stoneCount'))
     or (p_data ? 'stoneKind'
         and (
           jsonb_typeof(p_data->'stoneKind') is distinct from 'string'
           or coalesce(p_data->>'stoneKind', '') not in ('', 'fantasia', 'natural')
         )) then
    raise exception 'invalid stock jewel C2 fields' using errcode = '22023';
  end if;

  if p_data ? 'stoneTransformations' then
    if jsonb_typeof(p_data->'stoneTransformations') is distinct from 'array' then
      raise exception 'invalid stock jewel transformations' using errcode = '22023';
    end if;
    v_events := p_data->'stoneTransformations';
  else
    v_events := '[]'::jsonb;
  end if;

  if jsonb_array_length(v_events) > 1 then
    raise exception 'stock jewel cannot be transformed twice' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(v_events) event_item
    where jsonb_typeof(event_item) is distinct from 'object'
       or not private.is_nonblank_string(event_item->'id')
       or not private.is_iso_date(event_item->'date')
       or not private.is_nonblank_string(event_item->'lotId')
       or not private.is_nonblank_string(event_item->'jewelId')
       or event_item->>'jewelId' <> p_data->>'id'
       or jsonb_typeof(event_item->'origin') is distinct from 'string'
       or coalesce(event_item->>'origin', '') not in ('bruto', 'tallado')
       or not private.is_nonnegative_number(event_item->'carats')
       or not private.is_nonnegative_integer(event_item->'quantity')
       or not private.is_nonnegative_integer(event_item->'costCop')
       or jsonb_typeof(event_item->'notes') is distinct from 'string'
       or event_item->>'fromStoneKind' <> 'fantasia'
       or event_item->>'toStoneKind' <> 'natural'
  ) then
    raise exception 'invalid stock jewel transformation' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(v_events) event_item
    where (event_item->>'carats')::numeric <= 0
       or (event_item->>'quantity')::numeric <= 0
       or (event_item->>'costCop')::numeric > 9007199254740991
       or (event_item->>'carats')::numeric
          <> round((event_item->>'carats')::numeric, 3)
  ) then
    raise exception 'stock jewel transformation requires carats and quantity'
      using errcode = '22023';
  end if;

  if jsonb_array_length(v_events) > 0
     and not private.is_iso_date(p_data->'acquiredDate') then
    raise exception 'stock jewel transformation requires a valid acquisition date'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(v_events) event_item
    where event_item->>'date' < p_data->>'acquiredDate'
  ) then
    raise exception 'stock jewel transformation cannot predate acquisition'
      using errcode = '22023';
  end if;

  if jsonb_array_length(v_events) > 0
     and coalesce(jsonb_typeof(p_data->'sale'), 'null') <> 'null' then
    if jsonb_typeof(p_data->'sale') is distinct from 'object'
       or not private.is_iso_date(p_data->'sale'->'date') then
      raise exception 'stock jewel transformation requires a valid sale date'
        using errcode = '22023';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(v_events) event_item
      where event_item->>'date' > p_data->'sale'->>'date'
    ) then
      raise exception 'stock jewel transformation cannot postdate sale'
        using errcode = '22023';
    end if;
  end if;

  if jsonb_array_length(v_events) > 0 then
    if coalesce(p_data->>'stoneKind', '') <> 'natural' then
      raise exception 'transformed stock jewel must remain natural' using errcode = '22023';
    end if;
    select coalesce(sum((event_item->>'costCop')::numeric), 0)
    into v_event_cost
    from jsonb_array_elements(v_events) event_item;
    if not private.is_nonnegative_integer(p_data->'costCop')
       or (p_data->>'costCop')::numeric > 9007199254740991
       or (p_data->>'costCop')::numeric < v_event_cost then
      raise exception 'stock jewel cost lost its natural-stone transfer' using errcode = '22023';
    end if;
    if not private.is_nonnegative_integer(p_data->'stoneCount')
       or (p_data->>'stoneCount')::numeric
          <> (v_events->0->>'quantity')::numeric then
      raise exception 'stock jewel stone count differs from transformation'
        using errcode = '22023';
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Los upserts normales solo pueden conservar historia C2, nunca crearla,
--    editarla ni borrarla. La unica puerta de creacion es la RPC compuesta.
-- ---------------------------------------------------------------------------

create or replace function private.assert_stone_internal_uses_preserved(
  p_id text,
  p_data jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
  v_existing_data jsonb;
  v_existing_uses jsonb;
  v_incoming_uses jsonb := coalesce(p_data->'internalUses', '[]'::jsonb);
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stone_lots:' || p_id, 0)
  );
  select lot.data
  into v_existing_data
  from public.stone_lots lot
  where lot.organization_id = v_organization_id and lot.id = p_id
  for update;

  if v_existing_data is null then
    if jsonb_array_length(v_incoming_uses) > 0 then
      raise exception 'stone internal uses require the protected transformation RPC'
        using errcode = '22023';
    end if;
    return;
  end if;
  v_existing_uses := coalesce(v_existing_data->'internalUses', '[]'::jsonb);
  if v_incoming_uses is distinct from v_existing_uses then
    raise exception 'stone internal uses are immutable outside transformation RPC'
      using errcode = '22023';
  end if;

  -- Si una piedra tallada ya entro a una joya, los datos fisicos de la tanda
  -- que la produjo quedan congelados. Costo, pago y notas siguen editables.
  if exists (
       select 1
       from jsonb_array_elements(v_existing_uses) use_item
       where use_item->>'origin' = 'tallado'
     )
     and exists (
       select 1
       from jsonb_array_elements(
         coalesce(v_existing_data->'cuttingBatches', '[]'::jsonb)
       ) old_batch
       left join jsonb_array_elements(
         coalesce(p_data->'cuttingBatches', '[]'::jsonb)
       ) new_batch on new_batch->>'id' = old_batch->>'id'
       where coalesce(old_batch->>'returnedDate', '') <> ''
         and (
           new_batch is null
           or jsonb_build_object(
             'id', old_batch->'id',
             'sentDate', old_batch->'sentDate',
             'sentCarats', old_batch->'sentCarats',
             'sentQuantity', old_batch->'sentQuantity',
             'returnedDate', old_batch->'returnedDate',
             'returnedCarats', old_batch->'returnedCarats',
             'returnedQuantity', old_batch->'returnedQuantity'
           ) is distinct from jsonb_build_object(
             'id', new_batch->'id',
             'sentDate', new_batch->'sentDate',
             'sentCarats', new_batch->'sentCarats',
             'sentQuantity', new_batch->'sentQuantity',
             'returnedDate', new_batch->'returnedDate',
             'returnedCarats', new_batch->'returnedCarats',
             'returnedQuantity', new_batch->'returnedQuantity'
           )
         )
     ) then
    raise exception 'returned cutting inventory is immutable after an internal use'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function private.assert_stock_transformations_preserved(
  p_id text,
  p_data jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
  v_existing_data jsonb;
  v_existing_events jsonb;
  v_incoming_events jsonb := coalesce(p_data->'stoneTransformations', '[]'::jsonb);
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stock_jewels:' || p_id, 0)
  );
  select jewel.data
  into v_existing_data
  from public.stock_jewels jewel
  where jewel.organization_id = v_organization_id and jewel.id = p_id
  for update;

  if v_existing_data is null then
    if jsonb_array_length(v_incoming_events) > 0 then
      raise exception 'stock transformations require the protected transformation RPC'
        using errcode = '22023';
    end if;
    return;
  end if;
  v_existing_events := coalesce(v_existing_data->'stoneTransformations', '[]'::jsonb);
  if v_incoming_events is distinct from v_existing_events then
    raise exception 'stock transformations are immutable outside transformation RPC'
      using errcode = '22023';
  end if;
  if jsonb_array_length(v_existing_events) > 0
     and p_data->>'stoneKind' <> 'natural' then
    raise exception 'transformed stock jewel classification is immutable'
      using errcode = '22023';
  end if;
  if coalesce(v_existing_data->>'stoneKind', '') = 'natural'
     and coalesce(p_data->>'stoneKind', '') <> 'natural' then
    raise exception 'natural stock jewel classification is immutable'
      using errcode = '22023';
  end if;
  if coalesce(v_existing_data->>'stoneKind', '') = 'fantasia'
     and coalesce(p_data->>'stoneKind', '') = '' then
    raise exception 'fantasia stock jewel cannot become unclassified'
      using errcode = '22023';
  end if;
  if coalesce(v_existing_data->>'stoneKind', '') = 'fantasia'
     and coalesce(p_data->>'stoneKind', '') = 'natural' then
    raise exception 'fantasia to natural requires the protected transformation RPC'
      using errcode = '22023';
  end if;
end;
$$;

-- Conserva las firmas publicas existentes y agrega la defensa C2.
create or replace function public.upsert_stone_lot(
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
  perform private.assert_stone_lot_payload(p_id, p_data, p_updated_at);
  perform private.assert_stone_lot_cutting_payload(p_id, p_data, p_updated_at);
  perform private.assert_stone_lot_internal_uses_payload(p_data);
  perform private.assert_stone_internal_uses_preserved(p_id, p_data);
  insert into public.stone_lots (id, organization_id, data, updated_at)
  values (p_id, v_organization_id, p_data, p_updated_at)
  on conflict (organization_id, id) do update
  set data = excluded.data, updated_at = excluded.updated_at
  where excluded.updated_at >= public.stone_lots.updated_at;
end;
$$;

create or replace function public.upsert_stock_jewel(
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
  perform private.assert_stock_jewel_payload(p_id, p_data, p_updated_at);
  perform private.assert_stock_jewel_c2_payload(p_data);
  perform private.assert_stock_transformations_preserved(p_id, p_data);
  insert into public.stock_jewels (id, organization_id, data, updated_at)
  values (p_id, v_organization_id, p_data, p_updated_at)
  on conflict (organization_id, id) do update
  set data = excluded.data, updated_at = excluded.updated_at
  where excluded.updated_at >= public.stock_jewels.updated_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. RPC compuesta. El costo nunca se recibe del cliente.
-- ---------------------------------------------------------------------------

create or replace function public.transform_stock_jewel_to_natural(
  p_event_id text,
  p_date text,
  p_lot_id text,
  p_jewel_id text,
  p_origin text,
  p_carats numeric,
  p_quantity integer,
  p_notes text,
  p_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
  v_lot_data jsonb;
  v_jewel_data jsonb;
  v_lot_updated_at timestamptz;
  v_jewel_updated_at timestamptz;
  v_effective_updated_at timestamptz;
  v_updated_at_text text;
  v_uses jsonb;
  v_events jsonb;
  v_existing_use jsonb;
  v_existing_event jsonb;
  v_use_count bigint;
  v_event_count bigint;
  v_purchase_millicarats numeric;
  v_consumed_millicarats numeric;
  v_paid_cutting_cost numeric;
  v_total_invested numeric;
  v_attributed_cost numeric;
  v_jewel_cost numeric;
  v_registered_stone_count numeric;
  v_use jsonb;
  v_event jsonb;
  v_new_lot_data jsonb;
  v_new_jewel_data jsonb;
begin
  perform private.assert_updated_at(p_updated_at);
  if p_event_id is null or char_length(btrim(p_event_id)) not between 1 and 200
     or p_lot_id is null or char_length(btrim(p_lot_id)) not between 1 and 200
     or p_jewel_id is null or char_length(btrim(p_jewel_id)) not between 1 and 200
     or not private.is_iso_date(to_jsonb(p_date))
     or p_origin is null or p_origin not in ('bruto', 'tallado')
     or p_carats is null or p_carats <= 0
     or p_carats = 'NaN'::numeric
     or p_carats <> round(p_carats, 3)
     or p_quantity is null or p_quantity <= 0 then
    raise exception 'invalid stock jewel transformation request' using errcode = '22023';
  end if;

  -- Un mismo event id se serializa globalmente dentro de la organizacion.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_organization_id::text || ':stock_transform_events:' || p_event_id,
      0
    )
  );
  -- Orden fijo para evitar interbloqueos: lote primero, joya despues.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stone_lots:' || p_lot_id, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stock_jewels:' || p_jewel_id, 0)
  );

  select lot.data, lot.updated_at
  into v_lot_data, v_lot_updated_at
  from public.stone_lots lot
  where lot.organization_id = v_organization_id and lot.id = p_lot_id
  for update;
  if v_lot_data is null then
    raise exception 'stone lot not found for current organization' using errcode = '22023';
  end if;

  select jewel.data, jewel.updated_at
  into v_jewel_data, v_jewel_updated_at
  from public.stock_jewels jewel
  where jewel.organization_id = v_organization_id and jewel.id = p_jewel_id
  for update;
  if v_jewel_data is null then
    raise exception 'stock jewel not found for current organization' using errcode = '22023';
  end if;

  -- Confirma que el estado de partida sigue siendo valido antes de usarlo.
  perform private.assert_stone_lot_payload(p_lot_id, v_lot_data, p_updated_at);
  perform private.assert_stone_lot_cutting_payload(p_lot_id, v_lot_data, p_updated_at);
  perform private.assert_stone_lot_internal_uses_payload(v_lot_data);
  perform private.assert_stock_jewel_payload(p_jewel_id, v_jewel_data, p_updated_at);
  perform private.assert_stock_jewel_c2_payload(v_jewel_data);

  if not private.is_iso_date(v_lot_data->'purchaseDate')
     or p_date < v_lot_data->>'purchaseDate' then
    raise exception 'stock jewel transformation cannot predate lot purchase'
      using errcode = '22023';
  end if;
  if not private.is_iso_date(v_jewel_data->'acquiredDate')
     or p_date < v_jewel_data->>'acquiredDate' then
    raise exception 'stock jewel transformation cannot predate acquisition'
      using errcode = '22023';
  end if;

  v_uses := coalesce(v_lot_data->'internalUses', '[]'::jsonb);
  v_events := coalesce(v_jewel_data->'stoneTransformations', '[]'::jsonb);

  -- Busca el event id en toda la organizacion. El advisory lock anterior hace
  -- que dos solicitudes simultaneas no puedan reutilizarlo en entidades distintas.
  select count(*)
  into v_use_count
  from public.stone_lots lot
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(lot.data->'internalUses') = 'array'
      then lot.data->'internalUses' else '[]'::jsonb end
  ) use_item
  where lot.organization_id = v_organization_id
    and use_item->>'id' = p_event_id;

  select count(*)
  into v_event_count
  from public.stock_jewels jewel
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(jewel.data->'stoneTransformations') = 'array'
      then jewel.data->'stoneTransformations' else '[]'::jsonb end
  ) event_item
  where jewel.organization_id = v_organization_id
    and event_item->>'id' = p_event_id;

  select use_item
  into v_existing_use
  from jsonb_array_elements(v_uses) use_item
  where use_item->>'id' = p_event_id;

  select event_item
  into v_existing_event
  from jsonb_array_elements(v_events) event_item
  where event_item->>'id' = p_event_id;

  if v_use_count > 1 or v_event_count > 1
     or (v_use_count > 0 and v_existing_use is null)
     or (v_event_count > 0 and v_existing_event is null) then
    raise exception 'transformation event id already belongs to another record'
      using errcode = '22023';
  end if;

  -- Reintento exacto: ambas mitades ya existen y se devuelve exito sin sumar dos veces.
  if v_existing_use is not null or v_existing_event is not null then
    if v_existing_use is null or v_existing_event is null
       or v_existing_use->>'date' <> p_date
       or v_existing_use->>'jewelId' <> p_jewel_id
       or v_existing_use->>'origin' <> p_origin
       or (v_existing_use->>'carats')::numeric is distinct from p_carats
       or (v_existing_use->>'quantity')::integer is distinct from p_quantity
       or coalesce(v_existing_use->>'notes', '') <> coalesce(p_notes, '')
       or v_existing_event->>'date' <> p_date
       or v_existing_event->>'lotId' <> p_lot_id
       or v_existing_event->>'jewelId' <> p_jewel_id
       or v_existing_event->>'origin' <> p_origin
       or (v_existing_event->>'carats')::numeric is distinct from p_carats
       or (v_existing_event->>'quantity')::integer is distinct from p_quantity
       or coalesce(v_existing_event->>'notes', '') <> coalesce(p_notes, '')
       or v_existing_event->>'fromStoneKind' <> 'fantasia'
       or v_existing_event->>'toStoneKind' <> 'natural'
       or v_existing_use->'costCop' is distinct from v_existing_event->'costCop'
       or v_jewel_data->>'stoneKind' <> 'natural' then
      raise exception 'transformation event id was reused with different data'
        using errcode = '22023';
    end if;
    return jsonb_build_object('lot', v_lot_data, 'jewel', v_jewel_data);
  end if;

  if coalesce(v_jewel_data->>'stoneKind', '') <> 'fantasia' then
    raise exception 'only a fantasia stock jewel can become natural' using errcode = '22023';
  end if;
  if jsonb_typeof(v_jewel_data->'sale') = 'object' then
    raise exception 'a sold stock jewel cannot be transformed' using errcode = '22023';
  end if;

  v_registered_stone_count := coalesce((v_jewel_data->>'stoneCount')::numeric, 0);
  if v_registered_stone_count > 0 and v_registered_stone_count <> p_quantity then
    raise exception 'natural stone quantity differs from stock jewel stone count'
      using errcode = '22023';
  end if;

  -- Replica el calculo local en milesimas de quilate para que ambos lados
  -- atribuyan exactamente el mismo entero COP.
  v_purchase_millicarats := round((v_lot_data->>'carats')::numeric * 1000);
  v_consumed_millicarats := round(p_carats * 1000);
  if v_purchase_millicarats <= 0 or v_consumed_millicarats <= 0 then
    raise exception 'stone lot has no carats for cost attribution' using errcode = '22023';
  end if;
  select coalesce(sum((batch->>'cuttingCostCop')::numeric), 0)
  into v_paid_cutting_cost
  from jsonb_array_elements(coalesce(v_lot_data->'cuttingBatches', '[]'::jsonb)) batch
  where coalesce(batch->>'cuttingPaidDate', '') <> '';

  v_total_invested := (v_lot_data->>'purchaseValueCop')::numeric + v_paid_cutting_cost;
  v_attributed_cost := round(
    (v_total_invested * v_consumed_millicarats) / v_purchase_millicarats
  );
  v_jewel_cost := (v_jewel_data->>'costCop')::numeric;
  if v_attributed_cost < 0
     or trunc(v_attributed_cost) <> v_attributed_cost
     or v_attributed_cost > 9007199254740991
     or v_jewel_cost < 0
     or trunc(v_jewel_cost) <> v_jewel_cost
     or v_jewel_cost > 9007199254740991
     or v_jewel_cost + v_attributed_cost > 9007199254740991 then
    raise exception 'stock jewel transformation cost exceeds safe COP range'
      using errcode = '22023';
  end if;

  v_use := jsonb_build_object(
    'id', p_event_id,
    'date', p_date,
    'carats', p_carats,
    'quantity', p_quantity,
    'origin', p_origin,
    'jewelId', p_jewel_id,
    'costCop', v_attributed_cost,
    'notes', coalesce(p_notes, '')
  );
  v_event := jsonb_build_object(
    'id', p_event_id,
    'date', p_date,
    'lotId', p_lot_id,
    'jewelId', p_jewel_id,
    'origin', p_origin,
    'carats', p_carats,
    'quantity', p_quantity,
    'costCop', v_attributed_cost,
    'notes', coalesce(p_notes, ''),
    'fromStoneKind', 'fantasia',
    'toStoneKind', 'natural'
  );

  v_effective_updated_at := greatest(p_updated_at, v_lot_updated_at, v_jewel_updated_at);
  v_updated_at_text := to_char(
    v_effective_updated_at at time zone 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  );

  v_new_lot_data := jsonb_set(
    v_lot_data,
    '{internalUses}',
    v_uses || jsonb_build_array(v_use),
    true
  );
  v_new_lot_data := jsonb_set(
    v_new_lot_data,
    '{updatedAt}',
    to_jsonb(v_updated_at_text),
    true
  );

  v_new_jewel_data := jsonb_set(
    v_jewel_data,
    '{stoneTransformations}',
    v_events || jsonb_build_array(v_event),
    true
  );
  v_new_jewel_data := jsonb_set(v_new_jewel_data, '{stoneKind}', '"natural"'::jsonb, true);
  v_new_jewel_data := jsonb_set(v_new_jewel_data, '{stoneCount}', to_jsonb(p_quantity), true);
  v_new_jewel_data := jsonb_set(
    v_new_jewel_data,
    '{costCop}',
    to_jsonb(v_jewel_cost + v_attributed_cost),
    true
  );
  v_new_jewel_data := jsonb_set(
    v_new_jewel_data,
    '{updatedAt}',
    to_jsonb(v_updated_at_text),
    true
  );

  -- Vuelve a validar el estado FINAL antes de tocar cualquiera de las dos filas.
  perform private.assert_stone_lot_payload(p_lot_id, v_new_lot_data, v_effective_updated_at);
  perform private.assert_stone_lot_cutting_payload(
    p_lot_id,
    v_new_lot_data,
    v_effective_updated_at
  );
  perform private.assert_stone_lot_internal_uses_payload(v_new_lot_data);
  perform private.assert_stock_jewel_payload(
    p_jewel_id,
    v_new_jewel_data,
    v_effective_updated_at
  );
  perform private.assert_stock_jewel_c2_payload(v_new_jewel_data);

  update public.stone_lots
  set data = v_new_lot_data, updated_at = v_effective_updated_at
  where organization_id = v_organization_id and id = p_lot_id;

  update public.stock_jewels
  set data = v_new_jewel_data, updated_at = v_effective_updated_at
  where organization_id = v_organization_id and id = p_jewel_id;

  return jsonb_build_object('lot', v_new_lot_data, 'jewel', v_new_jewel_data);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Restauracion protegida. Solo owner/admin pueden reconstruir el costo
--    historico exacto de una transformacion importada. La RPC normal conserva
--    la autoridad sobre inventario, estados, bloqueos y la escritura inicial.
-- ---------------------------------------------------------------------------

create or replace function public.restore_stock_jewel_transformation(
  p_event_id text,
  p_date text,
  p_lot_id text,
  p_jewel_id text,
  p_origin text,
  p_carats numeric,
  p_quantity integer,
  p_notes text,
  p_updated_at timestamptz,
  p_cost_cop numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin']);
  v_existed_before boolean;
  v_lot_data jsonb;
  v_jewel_data jsonb;
  v_lot_updated_at timestamptz;
  v_jewel_updated_at timestamptz;
  v_existing_use jsonb;
  v_existing_event jsonb;
  v_uses jsonb;
  v_events jsonb;
  v_calculated_cost numeric;
  v_cost_delta numeric;
  v_new_jewel_cost numeric;
  v_new_lot_data jsonb;
  v_new_jewel_data jsonb;
begin
  if p_event_id is null or char_length(btrim(p_event_id)) not between 1 and 200
     or p_cost_cop is null or p_cost_cop < 0
     or p_cost_cop = 'NaN'::numeric
     or p_cost_cop > 9007199254740991
     or trunc(p_cost_cop) <> p_cost_cop then
    raise exception 'invalid stock jewel transformation restoration'
      using errcode = '22023';
  end if;

  -- La comprobacion "ya existia" debe quedar bajo el mismo lock del event id.
  -- Sin esto, dos restauraciones simultaneas podrian leer ambas "nuevo" y la
  -- segunda alcanzaria a reemplazar un costo historico ya confirmado.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_organization_id::text || ':stock_transform_events:' || p_event_id,
      0
    )
  );

  -- Conserva el mismo orden de la RPC normal: evento, lote y joya. Al tomar
  -- tambien las filas antes de transformar, ningun otro equipo puede editar
  -- la base sembrada entre la comprobacion del corte y la escritura atomica.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stone_lots:' || p_lot_id, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stock_jewels:' || p_jewel_id, 0)
  );

  select lot.data, lot.updated_at
  into v_lot_data, v_lot_updated_at
  from public.stone_lots lot
  where lot.organization_id = v_organization_id and lot.id = p_lot_id
  for update;

  select jewel.data, jewel.updated_at
  into v_jewel_data, v_jewel_updated_at
  from public.stock_jewels jewel
  where jewel.organization_id = v_organization_id and jewel.id = p_jewel_id
  for update;

  if v_lot_data is null or v_jewel_data is null then
    raise exception 'stock jewel transformation import seed is missing'
      using errcode = '22023';
  end if;

  select
    exists (
      select 1
      from public.stone_lots lot
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(lot.data->'internalUses') = 'array'
          then lot.data->'internalUses' else '[]'::jsonb end
      ) use_item
      where lot.organization_id = v_organization_id
        and lot.id = p_lot_id
        and use_item->>'id' = p_event_id
    )
    or exists (
      select 1
      from public.stock_jewels jewel
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(jewel.data->'stoneTransformations') = 'array'
          then jewel.data->'stoneTransformations' else '[]'::jsonb end
      ) event_item
      where jewel.organization_id = v_organization_id
        and jewel.id = p_jewel_id
        and event_item->>'id' = p_event_id
    )
  into v_existed_before;

  if not v_existed_before
     and (
       v_lot_updated_at is distinct from p_updated_at
       or v_jewel_updated_at is distinct from p_updated_at
     ) then
    raise exception 'stock jewel transformation import cutoff no longer matches'
      using errcode = '22023';
  end if;

  -- Reutiliza toda la defensa normal. Sus advisory locks y FOR UPDATE quedan
  -- retenidos hasta que termine esta misma transaccion.
  perform public.transform_stock_jewel_to_natural(
    p_event_id,
    p_date,
    p_lot_id,
    p_jewel_id,
    p_origin,
    p_carats,
    p_quantity,
    p_notes,
    p_updated_at
  );

  select lot.data, lot.updated_at
  into v_lot_data, v_lot_updated_at
  from public.stone_lots lot
  where lot.organization_id = v_organization_id and lot.id = p_lot_id
  for update;

  select jewel.data, jewel.updated_at
  into v_jewel_data, v_jewel_updated_at
  from public.stock_jewels jewel
  where jewel.organization_id = v_organization_id and jewel.id = p_jewel_id
  for update;

  if v_lot_data is null or v_jewel_data is null then
    raise exception 'restored stock jewel transformation records are missing'
      using errcode = '22023';
  end if;

  select use_item
  into v_existing_use
  from jsonb_array_elements(v_lot_data->'internalUses') use_item
  where use_item->>'id' = p_event_id;

  select event_item
  into v_existing_event
  from jsonb_array_elements(v_jewel_data->'stoneTransformations') event_item
  where event_item->>'id' = p_event_id;

  if v_existing_use is null or v_existing_event is null
     or v_existing_use->'costCop' is distinct from v_existing_event->'costCop' then
    raise exception 'restored stock jewel transformation is incomplete'
      using errcode = '22023';
  end if;

  -- Un reintento nunca corrige ni reemplaza historia: solo confirma que el
  -- costo solicitado ya es exactamente el que quedo guardado.
  if v_existed_before then
    if (v_existing_use->>'costCop')::numeric
       is distinct from p_cost_cop::numeric then
      raise exception 'restored transformation cost differs from stored history'
        using errcode = '22023';
    end if;
    return jsonb_build_object('lot', v_lot_data, 'jewel', v_jewel_data);
  end if;

  v_calculated_cost := (v_existing_use->>'costCop')::numeric;
  v_cost_delta := p_cost_cop::numeric - v_calculated_cost;
  v_new_jewel_cost := (v_jewel_data->>'costCop')::numeric + v_cost_delta;
  if v_new_jewel_cost < 0
     or trunc(v_new_jewel_cost) <> v_new_jewel_cost
     or v_new_jewel_cost > 9007199254740991 then
    raise exception 'restored stock jewel cost is invalid' using errcode = '22023';
  end if;

  select jsonb_agg(
    case when use_item->>'id' = p_event_id
      then jsonb_set(use_item, '{costCop}', to_jsonb(p_cost_cop), false)
      else use_item end
    order by item_position
  )
  into v_uses
  from jsonb_array_elements(v_lot_data->'internalUses')
    with ordinality as use_items(use_item, item_position);

  select jsonb_agg(
    case when event_item->>'id' = p_event_id
      then jsonb_set(event_item, '{costCop}', to_jsonb(p_cost_cop), false)
      else event_item end
    order by item_position
  )
  into v_events
  from jsonb_array_elements(v_jewel_data->'stoneTransformations')
    with ordinality as event_items(event_item, item_position);

  v_new_lot_data := jsonb_set(v_lot_data, '{internalUses}', v_uses, false);
  v_new_jewel_data := jsonb_set(
    v_jewel_data,
    '{stoneTransformations}',
    v_events,
    false
  );
  v_new_jewel_data := jsonb_set(
    v_new_jewel_data,
    '{costCop}',
    to_jsonb(v_new_jewel_cost),
    false
  );

  -- El costo historico tambien debe dejar ambos JSON completamente validos.
  perform private.assert_stone_lot_payload(
    p_lot_id,
    v_new_lot_data,
    v_lot_updated_at
  );
  perform private.assert_stone_lot_cutting_payload(
    p_lot_id,
    v_new_lot_data,
    v_lot_updated_at
  );
  perform private.assert_stone_lot_internal_uses_payload(v_new_lot_data);
  perform private.assert_stock_jewel_payload(
    p_jewel_id,
    v_new_jewel_data,
    v_jewel_updated_at
  );
  perform private.assert_stock_jewel_c2_payload(v_new_jewel_data);

  update public.stone_lots
  set data = v_new_lot_data
  where organization_id = v_organization_id and id = p_lot_id;
  if not found then
    raise exception 'restored stone lot disappeared' using errcode = '22023';
  end if;

  update public.stock_jewels
  set data = v_new_jewel_data
  where organization_id = v_organization_id and id = p_jewel_id;
  if not found then
    raise exception 'restored stock jewel disappeared' using errcode = '22023';
  end if;

  return jsonb_build_object('lot', v_new_lot_data, 'jewel', v_new_jewel_data);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Importacion reanudable. Los seeds solo crean la base sin historia; los
--    finalizers cierran el registro cuando la reconstruccion ya coincide.
-- ---------------------------------------------------------------------------

create or replace function public.authorize_cloud_import()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Preflight explicito; cada RPC de escritura vuelve a exigir los mismos roles.
  perform private.current_organization_id_for_roles(array['owner', 'admin']);
end;
$$;

create or replace function public.seed_stone_lot_transformation_import(
  p_id text,
  p_baseline_data jsonb,
  p_final_data jsonb,
  p_updated_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin']);
  v_existing_data jsonb;
  v_existing_updated_at timestamptz;
  v_baseline_match boolean;
  v_same_final_fields boolean;
  v_uses_are_prefix boolean;
  v_final_match boolean;
begin
  perform private.assert_entity_payload(
    'stone lot',
    p_id,
    p_baseline_data,
    p_updated_at
  );
  perform private.assert_entity_payload(
    'stone lot',
    p_id,
    p_final_data,
    p_updated_at
  );
  if jsonb_typeof(p_baseline_data->'internalUses') is distinct from 'array' then
    raise exception 'stone lot import seed requires empty internal uses'
      using errcode = '22023';
  end if;
  if jsonb_array_length(p_baseline_data->'internalUses') <> 0 then
    raise exception 'stone lot import seed requires empty internal uses'
      using errcode = '22023';
  end if;
  if jsonb_typeof(p_final_data->'internalUses') is distinct from 'array' then
    raise exception 'stone lot import seed requires complete final internal uses'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stone_lots:' || p_id, 0)
  );
  select lot.data, lot.updated_at
  into v_existing_data, v_existing_updated_at
  from public.stone_lots lot
  where lot.organization_id = v_organization_id and lot.id = p_id
  for update;

  -- Ambos extremos de la importacion se validan antes de aceptar una fila
  -- existente como propia de esta reanudacion.
  perform private.assert_stone_lot_payload(
    p_id,
    p_baseline_data,
    p_updated_at
  );
  perform private.assert_stone_lot_cutting_payload(
    p_id,
    p_baseline_data,
    p_updated_at
  );
  perform private.assert_stone_lot_internal_uses_payload(p_baseline_data);
  perform private.assert_stone_lot_payload(p_id, p_final_data, p_updated_at);
  perform private.assert_stone_lot_cutting_payload(
    p_id,
    p_final_data,
    p_updated_at
  );
  perform private.assert_stone_lot_internal_uses_payload(p_final_data);

  if v_existing_data is null then
    insert into public.stone_lots (id, organization_id, data, updated_at)
    values (p_id, v_organization_id, p_baseline_data, p_updated_at)
    on conflict (organization_id, id) do nothing;
    return;
  end if;

  perform private.assert_stone_lot_payload(
    p_id,
    v_existing_data,
    v_existing_updated_at
  );
  perform private.assert_stone_lot_cutting_payload(
    p_id,
    v_existing_data,
    v_existing_updated_at
  );
  perform private.assert_stone_lot_internal_uses_payload(v_existing_data);

  v_baseline_match :=
    v_existing_data is not distinct from p_baseline_data
    and v_existing_updated_at is not distinct from p_updated_at;
  v_same_final_fields :=
    (v_existing_data - 'updatedAt' - 'internalUses')
    is not distinct from
    (p_final_data - 'updatedAt' - 'internalUses');
  if jsonb_typeof(v_existing_data->'internalUses') = 'array' then
    v_uses_are_prefix :=
      jsonb_array_length(v_existing_data->'internalUses')
        <= jsonb_array_length(p_final_data->'internalUses')
      and not exists (
        select 1
        from jsonb_array_elements(v_existing_data->'internalUses')
          with ordinality as current_uses(use_item, item_position)
        left join jsonb_array_elements(p_final_data->'internalUses')
          with ordinality as final_uses(use_item, item_position)
          on final_uses.item_position = current_uses.item_position
        where final_uses.use_item is null
           or current_uses.use_item is distinct from final_uses.use_item
      );
  else
    v_uses_are_prefix := false;
  end if;
  v_final_match :=
    (v_existing_data - 'updatedAt')
      is not distinct from
      (p_final_data - 'updatedAt')
    and v_existing_updated_at >= p_updated_at;

  if not v_baseline_match
     and not (
       v_same_final_fields
       and v_uses_are_prefix
       and v_existing_updated_at is not distinct from p_updated_at
     )
     and not v_final_match then
    raise exception 'stone lot import seed collides with another record or edit'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function public.seed_stock_jewel_transformation_import(
  p_id text,
  p_baseline_data jsonb,
  p_final_data jsonb,
  p_updated_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin']);
  v_existing_data jsonb;
  v_existing_updated_at timestamptz;
  v_baseline_match boolean;
  v_intermediate_match boolean;
  v_final_match boolean;
begin
  perform private.assert_entity_payload(
    'stock jewel',
    p_id,
    p_baseline_data,
    p_updated_at
  );
  perform private.assert_entity_payload(
    'stock jewel',
    p_id,
    p_final_data,
    p_updated_at
  );
  if jsonb_typeof(p_baseline_data->'stoneTransformations') is distinct from 'array' then
    raise exception 'stock jewel import seed requires empty transformations'
      using errcode = '22023';
  end if;
  if jsonb_array_length(p_baseline_data->'stoneTransformations') <> 0 then
    raise exception 'stock jewel import seed requires empty transformations'
      using errcode = '22023';
  end if;
  if jsonb_typeof(p_final_data->'stoneTransformations') is distinct from 'array' then
    raise exception 'stock jewel import seed requires complete final transformations'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stock_jewels:' || p_id, 0)
  );
  select jewel.data, jewel.updated_at
  into v_existing_data, v_existing_updated_at
  from public.stock_jewels jewel
  where jewel.organization_id = v_organization_id and jewel.id = p_id
  for update;

  perform private.assert_stock_jewel_payload(
    p_id,
    p_baseline_data,
    p_updated_at
  );
  perform private.assert_stock_jewel_c2_payload(p_baseline_data);
  perform private.assert_stock_jewel_payload(p_id, p_final_data, p_updated_at);
  perform private.assert_stock_jewel_c2_payload(p_final_data);

  if v_existing_data is null then
    insert into public.stock_jewels (id, organization_id, data, updated_at)
    values (p_id, v_organization_id, p_baseline_data, p_updated_at)
    on conflict (organization_id, id) do nothing;
    return;
  end if;

  perform private.assert_stock_jewel_payload(
    p_id,
    v_existing_data,
    v_existing_updated_at
  );
  perform private.assert_stock_jewel_c2_payload(v_existing_data);

  v_baseline_match := v_existing_data is not distinct from p_baseline_data;
  v_intermediate_match :=
    (v_existing_data - 'updatedAt' - 'sale')
      is not distinct from
      (p_final_data - 'updatedAt' - 'sale')
    and coalesce(v_existing_data->'sale', 'null'::jsonb)
      is not distinct from 'null'::jsonb
    and v_existing_updated_at is not distinct from p_updated_at;
  v_final_match :=
    (v_existing_data - 'updatedAt')
    is not distinct from
    (p_final_data - 'updatedAt')
    and v_existing_updated_at >= p_updated_at;

  v_baseline_match :=
    v_baseline_match
    and v_existing_updated_at is not distinct from p_updated_at;

  if not v_baseline_match and not v_intermediate_match and not v_final_match then
    raise exception 'stock jewel import seed collides with another record or edit'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function public.finalize_stone_lot_transformation_import(
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
  v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin']);
  v_existing_data jsonb;
  v_existing_updated_at timestamptz;
  v_effective_updated_at timestamptz;
  v_updated_at_text text;
  v_final_data jsonb;
begin
  perform private.assert_entity_payload('stone lot', p_id, p_data, p_updated_at);
  if jsonb_typeof(p_data->'internalUses') is distinct from 'array' then
    raise exception 'stone lot import finalization requires complete internal uses'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stone_lots:' || p_id, 0)
  );
  select lot.data, lot.updated_at
  into v_existing_data, v_existing_updated_at
  from public.stone_lots lot
  where lot.organization_id = v_organization_id and lot.id = p_id
  for update;
  if v_existing_data is null then
    raise exception 'stone lot import seed not found' using errcode = '22023';
  end if;

  perform private.assert_stone_lot_payload(p_id, p_data, p_updated_at);
  perform private.assert_stone_lot_cutting_payload(p_id, p_data, p_updated_at);
  perform private.assert_stone_lot_internal_uses_payload(p_data);

  if p_data->'internalUses' is distinct from v_existing_data->'internalUses' then
    raise exception 'stone lot import history does not match restored history'
      using errcode = '22023';
  end if;
  if (v_existing_data - 'updatedAt') is distinct from (p_data - 'updatedAt') then
    raise exception 'stone lot import finalization would overwrite an edit'
      using errcode = '22023';
  end if;

  -- Un final exacto con timestamp posterior ya fue cerrado. No se vuelve a
  -- tocar; el estado pendiente solo puede vivir exactamente en el cutoff.
  if v_existing_updated_at > p_updated_at then return; end if;
  if v_existing_updated_at is distinct from p_updated_at then
    raise exception 'stone lot import cutoff no longer matches current row'
      using errcode = '22023';
  end if;

  v_effective_updated_at := greatest(
    v_existing_updated_at,
    p_updated_at,
    pg_catalog.statement_timestamp()
  );
  v_updated_at_text := to_char(
    v_effective_updated_at at time zone 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  );
  v_final_data := jsonb_set(
    p_data,
    '{updatedAt}',
    to_jsonb(v_updated_at_text),
    true
  );

  perform private.assert_stone_lot_payload(
    p_id,
    v_final_data,
    v_effective_updated_at
  );
  perform private.assert_stone_lot_cutting_payload(
    p_id,
    v_final_data,
    v_effective_updated_at
  );
  perform private.assert_stone_lot_internal_uses_payload(v_final_data);

  update public.stone_lots
  set data = v_final_data, updated_at = v_effective_updated_at
  where organization_id = v_organization_id and id = p_id;
end;
$$;

create or replace function public.finalize_stock_jewel_transformation_import(
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
  v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin']);
  v_existing_data jsonb;
  v_existing_updated_at timestamptz;
  v_effective_updated_at timestamptz;
  v_updated_at_text text;
  v_existing_sale jsonb;
  v_final_data jsonb;
begin
  perform private.assert_entity_payload('stock jewel', p_id, p_data, p_updated_at);
  if jsonb_typeof(p_data->'stoneTransformations') is distinct from 'array'
     or not (p_data ? 'sale')
     or jsonb_typeof(p_data->'sale') not in ('object', 'null') then
    raise exception 'stock jewel import finalization requires complete payload'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stock_jewels:' || p_id, 0)
  );
  select jewel.data, jewel.updated_at
  into v_existing_data, v_existing_updated_at
  from public.stock_jewels jewel
  where jewel.organization_id = v_organization_id and jewel.id = p_id
  for update;
  if v_existing_data is null then
    raise exception 'stock jewel import seed not found' using errcode = '22023';
  end if;

  perform private.assert_stock_jewel_payload(p_id, p_data, p_updated_at);
  perform private.assert_stock_jewel_c2_payload(p_data);

  if p_data->'stoneTransformations'
     is distinct from v_existing_data->'stoneTransformations' then
    raise exception 'stock jewel import history does not match restored history'
      using errcode = '22023';
  end if;
  if p_data->'costCop' is distinct from v_existing_data->'costCop' then
    raise exception 'stock jewel import cost does not match restored cost'
      using errcode = '22023';
  end if;
  if (v_existing_data - 'updatedAt' - 'sale')
     is distinct from (p_data - 'updatedAt' - 'sale') then
    raise exception 'stock jewel import finalization would overwrite an edit'
      using errcode = '22023';
  end if;

  v_existing_sale := coalesce(v_existing_data->'sale', 'null'::jsonb);
  if v_existing_sale is distinct from 'null'::jsonb
     and v_existing_sale is distinct from p_data->'sale' then
    raise exception 'stock jewel import sale differs from existing sale'
      using errcode = '22023';
  end if;

  if v_existing_sale is not distinct from p_data->'sale'
     and v_existing_updated_at > p_updated_at then
    return;
  end if;
  if v_existing_updated_at is distinct from p_updated_at then
    raise exception 'stock jewel import cutoff no longer matches current row'
      using errcode = '22023';
  end if;

  v_effective_updated_at := greatest(
    v_existing_updated_at,
    p_updated_at,
    pg_catalog.statement_timestamp()
  );
  v_updated_at_text := to_char(
    v_effective_updated_at at time zone 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  );
  v_final_data := jsonb_set(
    p_data,
    '{updatedAt}',
    to_jsonb(v_updated_at_text),
    true
  );

  perform private.assert_stock_jewel_payload(
    p_id,
    v_final_data,
    v_effective_updated_at
  );
  perform private.assert_stock_jewel_c2_payload(v_final_data);

  update public.stock_jewels
  set data = v_final_data, updated_at = v_effective_updated_at
  where organization_id = v_organization_id and id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Deshacer queda bloqueado: borrar cualquiera de los dos registros dejaria
--    costo o inventario huerfanos. Una reversa futura debera ser otra RPC atomica.
-- ---------------------------------------------------------------------------

create or replace function public.delete_stone_lot(p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
  v_existing_data jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stone_lots:' || p_id, 0)
  );
  select lot.data
  into v_existing_data
  from public.stone_lots lot
  where lot.organization_id = v_organization_id and lot.id = p_id
  for update;
  if v_existing_data is null then return; end if;
  if v_existing_data ? 'internalUses' then
    if jsonb_typeof(v_existing_data->'internalUses') is distinct from 'array'
       or jsonb_array_length(v_existing_data->'internalUses') > 0 then
      raise exception 'stone lot with internal uses cannot be deleted'
        using errcode = '22023';
    end if;
  end if;
  delete from public.stone_lots
  where organization_id = v_organization_id and id = p_id;
end;
$$;

create or replace function public.delete_stock_jewel(p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
  v_existing_data jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stock_jewels:' || p_id, 0)
  );
  select jewel.data
  into v_existing_data
  from public.stock_jewels jewel
  where jewel.organization_id = v_organization_id and jewel.id = p_id
  for update;
  if v_existing_data is null then return; end if;
  if v_existing_data ? 'stoneTransformations' then
    if jsonb_typeof(v_existing_data->'stoneTransformations') is distinct from 'array'
       or jsonb_array_length(v_existing_data->'stoneTransformations') > 0 then
      raise exception 'transformed stock jewel cannot be deleted'
        using errcode = '22023';
    end if;
  end if;
  delete from public.stock_jewels
  where organization_id = v_organization_id and id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Permisos minimos. Las funciones privadas nunca son API.
-- ---------------------------------------------------------------------------

revoke all on function private.assert_stone_lot_internal_uses_payload(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_stock_jewel_c2_payload(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_stone_internal_uses_preserved(text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_stock_transformations_preserved(text, jsonb)
  from public, anon, authenticated, service_role;

revoke all on function public.upsert_stone_lot(text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.upsert_stock_jewel(text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.delete_stone_lot(text)
  from public, anon, authenticated, service_role;
revoke all on function public.delete_stock_jewel(text)
  from public, anon, authenticated, service_role;
revoke all on function public.transform_stock_jewel_to_natural(
  text, text, text, text, text, numeric, integer, text, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.restore_stock_jewel_transformation(
  text, text, text, text, text, numeric, integer, text, timestamptz, numeric
) from public, anon, authenticated, service_role;
revoke all on function public.authorize_cloud_import()
  from public, anon, authenticated, service_role;
revoke all on function public.seed_stone_lot_transformation_import(
  text, jsonb, jsonb, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.seed_stock_jewel_transformation_import(
  text, jsonb, jsonb, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.finalize_stone_lot_transformation_import(
  text, jsonb, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.finalize_stock_jewel_transformation_import(
  text, jsonb, timestamptz
) from public, anon, authenticated, service_role;

grant execute on function public.upsert_stone_lot(text, jsonb, timestamptz)
  to authenticated;
grant execute on function public.upsert_stock_jewel(text, jsonb, timestamptz)
  to authenticated;
grant execute on function public.delete_stone_lot(text)
  to authenticated;
grant execute on function public.delete_stock_jewel(text)
  to authenticated;
grant execute on function public.transform_stock_jewel_to_natural(
  text, text, text, text, text, numeric, integer, text, timestamptz
) to authenticated;
grant execute on function public.restore_stock_jewel_transformation(
  text, text, text, text, text, numeric, integer, text, timestamptz, numeric
) to authenticated;
grant execute on function public.authorize_cloud_import()
  to authenticated;
grant execute on function public.seed_stone_lot_transformation_import(
  text, jsonb, jsonb, timestamptz
) to authenticated;
grant execute on function public.seed_stock_jewel_transformation_import(
  text, jsonb, jsonb, timestamptz
) to authenticated;
grant execute on function public.finalize_stone_lot_transformation_import(
  text, jsonb, timestamptz
) to authenticated;
grant execute on function public.finalize_stock_jewel_transformation_import(
  text, jsonb, timestamptz
) to authenticated;


-- ============================================================
-- 20260804184500_compra_lote_bruto_tallado
-- ============================================================

-- Correccion Santiago C2: cada lote declara si se compro en bruto o ya tallado.
-- Migracion aditiva: el campo ausente conserva exactamente el significado
-- historico de bruto. No cambia tablas, RLS ni datos guardados.

alter function private.assert_stone_lot_cutting_payload(text, jsonb, timestamptz)
  rename to assert_stone_lot_cutting_payload_before_purchase_origin;

alter function private.assert_stone_lot_internal_uses_payload(jsonb)
  rename to assert_stone_lot_internal_uses_payload_before_purchase_origin;

create or replace function private.has_nonempty_jsonb_array(p_value jsonb)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when pg_catalog.jsonb_typeof(p_value) = 'array'
      then pg_catalog.jsonb_array_length(p_value) > 0
    else false
  end;
$$;

create or replace function private.stone_lot_inventory_payload_for_purchase_origin(
  p_data jsonb
)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_data jsonb := p_data;
  v_origin text := coalesce(p_data->>'purchaseOrigin', 'bruto');
begin
  if v_origin <> 'tallado' then
    return v_data;
  end if;

  -- Las validaciones C1/C2 anteriores entienden lo tallado como el regreso de
  -- una tanda. Esta tanda virtual existe solo durante la validacion: nunca se
  -- guarda ni aparece en el historial del usuario.
  if private.is_nonnegative_number(p_data->'carats')
     and private.is_nonnegative_integer(p_data->'quantity') then
    if (p_data->>'carats')::numeric > 0 and (p_data->>'quantity')::numeric > 0 then
      v_data := pg_catalog.jsonb_set(
        p_data,
        '{cuttingBatches}',
        pg_catalog.jsonb_build_array(
          pg_catalog.jsonb_build_object(
            'id', '__purchase_tallado__',
            'sentDate', p_data->>'purchaseDate',
            'sentCarats', p_data->'carats',
            'sentQuantity', p_data->'quantity',
            'returnedDate', p_data->>'purchaseDate',
            'returnedCarats', p_data->'carats',
            'returnedQuantity', p_data->'quantity',
            'cuttingCostCop', 0,
            'cuttingPaidDate', '',
            'notes', ''
          )
        ),
        true
      );
    end if;
  end if;
  return v_data;
end;
$$;

create or replace function private.assert_stone_lot_cutting_payload(
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
  v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
  v_existing_data jsonb;
  v_origin text;
  v_existing_origin text;
  v_inventory_data jsonb;
begin
  if pg_catalog.jsonb_typeof(p_data) is distinct from 'object' then
    raise exception 'invalid stone lot purchase origin payload' using errcode = '22023';
  end if;
  if p_data ? 'purchaseOrigin'
     and (
       pg_catalog.jsonb_typeof(p_data->'purchaseOrigin') is distinct from 'string'
       or coalesce(p_data->>'purchaseOrigin', '') not in ('bruto', 'tallado')
     ) then
    raise exception 'invalid stone lot purchase origin' using errcode = '22023';
  end if;
  v_origin := coalesce(p_data->>'purchaseOrigin', 'bruto');

  if v_origin = 'tallado'
     and p_data ? 'cuttingBatches'
     and (
       pg_catalog.jsonb_typeof(p_data->'cuttingBatches') is distinct from 'array'
       or private.has_nonempty_jsonb_array(p_data->'cuttingBatches')
     ) then
    raise exception 'purchased cut stone lot cannot have cutting batches'
      using errcode = '22023';
  end if;

  v_inventory_data := private.stone_lot_inventory_payload_for_purchase_origin(p_data);
  perform private.assert_stone_lot_cutting_payload_before_purchase_origin(
    p_id,
    v_inventory_data,
    p_updated_at
  );

  -- La validacion anterior deja bloqueada la fila hasta finalizar la escritura.
  select lot.data
  into v_existing_data
  from public.stone_lots lot
  where lot.organization_id = v_organization_id and lot.id = p_id;

  if v_existing_data is not null then
    v_existing_origin := coalesce(v_existing_data->>'purchaseOrigin', 'bruto');
    if v_existing_origin <> v_origin
       and (
         private.has_nonempty_jsonb_array(v_existing_data->'sales')
         or private.has_nonempty_jsonb_array(v_existing_data->'cuttingBatches')
         or private.has_nonempty_jsonb_array(v_existing_data->'internalUses')
         or private.has_nonempty_jsonb_array(p_data->'sales')
         or private.has_nonempty_jsonb_array(p_data->'cuttingBatches')
         or private.has_nonempty_jsonb_array(p_data->'internalUses')
       ) then
      raise exception 'stone lot purchase origin is immutable after inventory movements'
        using errcode = '22023';
    end if;
  end if;
end;
$$;

create or replace function private.assert_stone_lot_internal_uses_payload(
  p_data jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_inventory_data jsonb;
  v_origin text;
begin
  if pg_catalog.jsonb_typeof(p_data) is distinct from 'object' then
    raise exception 'invalid stone lot purchase origin payload' using errcode = '22023';
  end if;
  if p_data ? 'purchaseOrigin'
     and (
       pg_catalog.jsonb_typeof(p_data->'purchaseOrigin') is distinct from 'string'
       or coalesce(p_data->>'purchaseOrigin', '') not in ('bruto', 'tallado')
     ) then
    raise exception 'invalid stone lot purchase origin' using errcode = '22023';
  end if;
  v_origin := coalesce(p_data->>'purchaseOrigin', 'bruto');
  if v_origin = 'tallado'
     and p_data ? 'cuttingBatches'
     and (
       pg_catalog.jsonb_typeof(p_data->'cuttingBatches') is distinct from 'array'
       or private.has_nonempty_jsonb_array(p_data->'cuttingBatches')
     ) then
    raise exception 'purchased cut stone lot cannot have cutting batches'
      using errcode = '22023';
  end if;
  v_inventory_data := private.stone_lot_inventory_payload_for_purchase_origin(p_data);
  perform private.assert_stone_lot_internal_uses_payload_before_purchase_origin(
    v_inventory_data
  );
end;
$$;

-- Recompila el punto de escritura para que siempre use las dos envolturas C2.
create or replace function public.upsert_stone_lot(
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
  perform private.assert_stone_lot_payload(p_id, p_data, p_updated_at);
  perform private.assert_stone_lot_cutting_payload(p_id, p_data, p_updated_at);
  perform private.assert_stone_lot_internal_uses_payload(p_data);
  perform private.assert_stone_internal_uses_preserved(p_id, p_data);
  insert into public.stone_lots (id, organization_id, data, updated_at)
  values (p_id, v_organization_id, p_data, p_updated_at)
  on conflict (organization_id, id) do update
  set data = excluded.data, updated_at = excluded.updated_at
  where excluded.updated_at >= public.stone_lots.updated_at;
end;
$$;

revoke all on function private.has_nonempty_jsonb_array(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.stone_lot_inventory_payload_for_purchase_origin(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_stone_lot_cutting_payload_before_purchase_origin(
  text, jsonb, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function private.assert_stone_lot_internal_uses_payload_before_purchase_origin(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_stone_lot_cutting_payload(text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_stone_lot_internal_uses_payload(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.upsert_stone_lot(text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.upsert_stone_lot(text, jsonb, timestamptz) to authenticated;


-- ============================================================
-- 20260804193000_eliminar_lote_con_historia_joya
-- ============================================================

-- Correccion Santiago C4: un lote puede eliminarse aunque haya aportado piedra
-- a una joya. Antes de borrarlo, cada joya conserva el nombre historico del
-- lote. Costo, venta y demas historia permanecen byte por byte.

alter function private.assert_stock_jewel_c2_payload(jsonb)
  rename to assert_stock_jewel_c2_payload_before_lot_name;

create or replace function private.assert_stock_jewel_c2_payload(p_data jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.assert_stock_jewel_c2_payload_before_lot_name(p_data);
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(
      coalesce(p_data->'stoneTransformations', '[]'::jsonb)
    ) event_item
    where event_item ? 'lotName'
      and (
        pg_catalog.jsonb_typeof(event_item->'lotName') is distinct from 'string'
        or btrim(coalesce(event_item->>'lotName', '')) = ''
      )
  ) then
    raise exception 'invalid historical stone lot name' using errcode = '22023';
  end if;
end;
$$;

-- La historia fisica sigue inmutable. La unica ampliacion permitida es llenar
-- una vez lotName cuando antes estaba ausente; luego tampoco puede cambiarse.
create or replace function private.assert_stock_transformations_preserved(
  p_id text,
  p_data jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
  v_existing_data jsonb;
  v_existing_events jsonb;
  v_incoming_events jsonb := coalesce(p_data->'stoneTransformations', '[]'::jsonb);
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stock_jewels:' || p_id, 0)
  );
  select jewel.data
  into v_existing_data
  from public.stock_jewels jewel
  where jewel.organization_id = v_organization_id and jewel.id = p_id
  for update;

  if v_existing_data is null then
    if pg_catalog.jsonb_array_length(v_incoming_events) > 0 then
      raise exception 'stock transformations require the protected transformation RPC'
        using errcode = '22023';
    end if;
    return;
  end if;
  v_existing_events := coalesce(v_existing_data->'stoneTransformations', '[]'::jsonb);
  if pg_catalog.jsonb_array_length(v_incoming_events)
       <> pg_catalog.jsonb_array_length(v_existing_events)
     or exists (
       select 1
       from pg_catalog.jsonb_array_elements(v_existing_events) old_event
       left join pg_catalog.jsonb_array_elements(v_incoming_events) new_event
         on new_event->>'id' = old_event->>'id'
       where new_event is null
          or (old_event - 'lotName') is distinct from (new_event - 'lotName')
          or (
            btrim(coalesce(old_event->>'lotName', '')) <> ''
            and old_event->'lotName' is distinct from new_event->'lotName'
          )
     ) then
    raise exception 'stock transformations are immutable outside transformation RPC'
      using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(v_existing_events) > 0
     and p_data->>'stoneKind' <> 'natural' then
    raise exception 'transformed stock jewel classification is immutable'
      using errcode = '22023';
  end if;
  if coalesce(v_existing_data->>'stoneKind', '') = 'natural'
     and coalesce(p_data->>'stoneKind', '') <> 'natural' then
    raise exception 'natural stock jewel classification is immutable'
      using errcode = '22023';
  end if;
  if coalesce(v_existing_data->>'stoneKind', '') = 'fantasia'
     and coalesce(p_data->>'stoneKind', '') = '' then
    raise exception 'fantasia stock jewel cannot become unclassified'
      using errcode = '22023';
  end if;
  if coalesce(v_existing_data->>'stoneKind', '') = 'fantasia'
     and coalesce(p_data->>'stoneKind', '') = 'natural' then
    raise exception 'fantasia to natural requires the protected transformation RPC'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function public.upsert_stock_jewel(
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
  perform private.assert_stock_jewel_payload(p_id, p_data, p_updated_at);
  perform private.assert_stock_jewel_c2_payload(p_data);
  perform private.assert_stock_transformations_preserved(p_id, p_data);
  insert into public.stock_jewels (id, organization_id, data, updated_at)
  values (p_id, v_organization_id, p_data, p_updated_at)
  on conflict (organization_id, id) do update
  set data = excluded.data, updated_at = excluded.updated_at
  where excluded.updated_at >= public.stock_jewels.updated_at;
end;
$$;

create or replace function public.delete_stone_lot(p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
  v_existing_data jsonb;
  v_lot_name text;
  v_jewel_id text;
  v_effective_updated_at timestamptz := pg_catalog.statement_timestamp();
  v_updated_at_text text;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stone_lots:' || p_id, 0)
  );
  select lot.data
  into v_existing_data
  from public.stone_lots lot
  where lot.organization_id = v_organization_id and lot.id = p_id
  for update;
  if v_existing_data is null then return; end if;
  if v_existing_data ? 'internalUses'
     and pg_catalog.jsonb_typeof(v_existing_data->'internalUses') is distinct from 'array' then
    raise exception 'invalid stone lot internal uses before deletion' using errcode = '22023';
  end if;

  v_lot_name := coalesce(
    nullif(btrim(v_existing_data->>'name'), ''),
    'Lote de ' || coalesce(nullif(btrim(v_existing_data->>'stoneType'), ''), 'piedras')
  );
  v_updated_at_text := pg_catalog.to_char(
    v_effective_updated_at at time zone 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  );

  -- Mismo orden de bloqueo que el resto de C2: lote y luego joyas por id.
  for v_jewel_id in
    select distinct jewel.id
    from public.stock_jewels jewel
    cross join lateral pg_catalog.jsonb_array_elements(
      case
        when pg_catalog.jsonb_typeof(jewel.data->'stoneTransformations') = 'array'
          then jewel.data->'stoneTransformations'
        else '[]'::jsonb
      end
    ) event_item
    where jewel.organization_id = v_organization_id
      and event_item->>'lotId' = p_id
    order by jewel.id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        v_organization_id::text || ':stock_jewels:' || v_jewel_id,
        0
      )
    );
  end loop;

  update public.stock_jewels jewel
  set data = pg_catalog.jsonb_set(
        pg_catalog.jsonb_set(
          jewel.data,
          '{stoneTransformations}',
          (
            select pg_catalog.jsonb_agg(
              case
                when event_item->>'lotId' = p_id
                  then event_item || pg_catalog.jsonb_build_object('lotName', v_lot_name)
                else event_item
              end
              order by item_position
            )
            from pg_catalog.jsonb_array_elements(jewel.data->'stoneTransformations')
              with ordinality as events(event_item, item_position)
          ),
          true
        ),
        '{updatedAt}',
        pg_catalog.to_jsonb(v_updated_at_text),
        true
      ),
      updated_at = v_effective_updated_at
  where jewel.organization_id = v_organization_id
    and pg_catalog.jsonb_typeof(jewel.data->'stoneTransformations') = 'array'
    and exists (
      select 1
      from pg_catalog.jsonb_array_elements(jewel.data->'stoneTransformations') event_item
      where event_item->>'lotId' = p_id
    );

  delete from public.stone_lots
  where organization_id = v_organization_id and id = p_id;
end;
$$;

-- Los respaldos de una joya cuyo lote ya fue eliminado llegan completos y no
-- necesitan reconstruir inventario. Esta puerta sigue limitada a owner/admin.
alter function public.seed_stock_jewel_transformation_import(
  text, jsonb, jsonb, timestamptz
) rename to seed_stock_jewel_transformation_import_before_deleted_lot_history;

create or replace function public.seed_stock_jewel_transformation_import(
  p_id text,
  p_baseline_data jsonb,
  p_final_data jsonb,
  p_updated_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin']);
  v_events jsonb := coalesce(p_baseline_data->'stoneTransformations', '[]'::jsonb);
  v_existing_data jsonb;
begin
  if pg_catalog.jsonb_typeof(v_events) is distinct from 'array'
     or pg_catalog.jsonb_array_length(v_events) = 0 then
    perform public.seed_stock_jewel_transformation_import_before_deleted_lot_history(
      p_id,
      p_baseline_data,
      p_final_data,
      p_updated_at
    );
    return;
  end if;

  perform private.assert_entity_payload('stock jewel', p_id, p_baseline_data, p_updated_at);
  perform private.assert_entity_payload('stock jewel', p_id, p_final_data, p_updated_at);
  perform private.assert_stock_jewel_payload(p_id, p_baseline_data, p_updated_at);
  perform private.assert_stock_jewel_c2_payload(p_baseline_data);
  if p_baseline_data is distinct from p_final_data then
    raise exception 'deleted-lot jewel import baseline must already be final'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(v_events) event_item
    where btrim(coalesce(event_item->>'lotName', '')) = ''
       or exists (
         select 1
         from public.stone_lots lot
         where lot.organization_id = v_organization_id
           and lot.id = event_item->>'lotId'
       )
  ) then
    raise exception 'deleted-lot jewel import requires a name and an absent lot'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stock_jewels:' || p_id, 0)
  );
  select jewel.data
  into v_existing_data
  from public.stock_jewels jewel
  where jewel.organization_id = v_organization_id and jewel.id = p_id
  for update;

  if v_existing_data is null then
    insert into public.stock_jewels (id, organization_id, data, updated_at)
    values (p_id, v_organization_id, p_baseline_data, p_updated_at);
    return;
  end if;
  if (v_existing_data - 'updatedAt')
       is distinct from (p_baseline_data - 'updatedAt') then
    raise exception 'deleted-lot jewel import collides with another record or edit'
      using errcode = '22023';
  end if;
end;
$$;

revoke all on function private.assert_stock_jewel_c2_payload_before_lot_name(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_stock_jewel_c2_payload(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_stock_transformations_preserved(text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.upsert_stock_jewel(text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.delete_stone_lot(text)
  from public, anon, authenticated, service_role;
revoke all on function public.seed_stock_jewel_transformation_import_before_deleted_lot_history(
  text, jsonb, jsonb, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.seed_stock_jewel_transformation_import(
  text, jsonb, jsonb, timestamptz
) from public, anon, authenticated, service_role;

grant execute on function public.upsert_stock_jewel(text, jsonb, timestamptz)
  to authenticated;
grant execute on function public.delete_stone_lot(text) to authenticated;
grant execute on function public.seed_stock_jewel_transformation_import(
  text, jsonb, jsonb, timestamptz
) to authenticated;
