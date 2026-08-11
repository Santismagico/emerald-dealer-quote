-- Etapa 9: varios socios y fondo de inversion en la nube (D-072 a D-076).
--
-- Esta migracion NO borra tablas, columnas ni filas. Agrega la tabla del fondo,
-- cierra sus permisos, crea sus RPC protegidas y pone una validacion adicional
-- sobre las tres tablas que ahora reciben listas de socios. Los triggers se
-- reemplazan por nombre para que volver a ejecutar el bloque sea seguro.

-- ---------------------------------------------------------------------------
-- 1. Fondo persona por persona. Nunca existe un saldo unico guardado: cada fila
--    es un aporte y todos los saldos se derivan de su JSON (D-076).
-- ---------------------------------------------------------------------------

create table if not exists public.fund_contributions (
  id text not null check (char_length(btrim(id)) > 0),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null,
  primary key (organization_id, id)
);

create index if not exists fund_contributions_org_updated
  on public.fund_contributions (organization_id, updated_at desc);

alter table public.fund_contributions enable row level security;

drop policy if exists fund_contributions_select_member on public.fund_contributions;
create policy fund_contributions_select_member on public.fund_contributions
for select to authenticated
using (exists (
  select 1
  from public.memberships membership
  where membership.organization_id = fund_contributions.organization_id
    and membership.user_id = (select auth.uid())
));

-- `revoke all`, nunca `revoke insert, update, delete`: esa forma deja intactos
-- TRUNCATE, REFERENCES y TRIGGER, que Supabase concede por defecto en cada tabla
-- nueva. TRUNCATE no respeta Row Level Security y vaciaria la tabla para TODAS
-- las joyerias (hallazgo del 2026-08-10).
revoke all on table public.fund_contributions from anon, authenticated;
grant select on table public.fund_contributions to authenticated;
grant select, insert, update, delete on table public.fund_contributions to service_role;

-- ---------------------------------------------------------------------------
-- 2. Validadores privados. El navegador nunca puede llamarlos directamente.
-- ---------------------------------------------------------------------------

create or replace function private.is_safe_cop(p_value jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_number numeric;
begin
  if not private.is_nonnegative_integer(p_value) then return false; end if;
  v_number := (p_value #>> '{}')::numeric;
  return v_number <= 9007199254740991;
exception
  when invalid_text_representation or numeric_value_out_of_range then return false;
end;
$$;

create or replace function private.assert_money_partners_payload(
  p_partners jsonb,
  p_total_cop jsonb,
  p_funded_cop jsonb,
  p_entity text
)
returns void
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_partners jsonb := coalesce(p_partners, '[]'::jsonb);
  v_partners_total numeric := 0;
  v_funded numeric := 0;
  v_total numeric;
begin
  -- ETAPA9_SOCIOS_FONDO_V1: validacion por monto y sin porcentajes guardados.
  if not private.is_safe_cop(p_total_cop)
     or not private.is_safe_cop(coalesce(p_funded_cop, '0'::jsonb))
     or jsonb_typeof(v_partners) is distinct from 'array' then
    raise exception 'invalid % partnership payload', p_entity using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_partners) partner
    where jsonb_typeof(partner) is distinct from 'object'
       or not private.is_nonblank_string(partner->'id')
       or coalesce(jsonb_typeof(partner->'partnerId'), 'null') not in ('null', 'string')
       or (jsonb_typeof(partner->'partnerId') = 'string'
           and not private.is_nonblank_string(partner->'partnerId'))
       or not private.is_nonblank_string(partner->'partnerName')
       or not private.is_safe_cop(partner->'amountCop')
       or (partner->>'amountCop')::numeric <= 0
  ) then
    raise exception 'invalid % partner', p_entity using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_partners) partner
    group by partner->>'id'
    having count(*) > 1
  ) or exists (
    select 1
    from jsonb_array_elements(v_partners) partner
    group by coalesce(
      nullif(btrim(partner->>'partnerId'), ''),
      'name:' || lower(btrim(partner->>'partnerName'))
    )
    having count(*) > 1
  ) then
    raise exception 'duplicate % partner', p_entity using errcode = '22023';
  end if;

  select coalesce(sum((partner->>'amountCop')::numeric), 0::numeric)
  into v_partners_total
  from jsonb_array_elements(v_partners) partner;

  v_funded := (coalesce(p_funded_cop, '0'::jsonb) #>> '{}')::numeric;
  v_total := (p_total_cop #>> '{}')::numeric;
  if v_partners_total + v_funded > v_total then
    raise exception '% partners and fund exceed total', p_entity using errcode = '22023';
  end if;
end;
$$;

create or replace function private.assert_material_partners_payload(p_data jsonb)
returns void
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_partners jsonb := coalesce(p_data->'partners', '[]'::jsonb);
  v_partners_grams numeric := 0;
  v_total_grams numeric;
begin
  -- ETAPA9_SOCIOS_FONDO_V1: material se comparte en gramos, nunca en plata.
  if jsonb_typeof(v_partners) is distinct from 'array'
     or not private.is_nonnegative_number(p_data->'grams') then
    raise exception 'invalid material partnership payload' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_partners) partner
    where jsonb_typeof(partner) is distinct from 'object'
       or not private.is_nonblank_string(partner->'id')
       or coalesce(jsonb_typeof(partner->'partnerId'), 'null') not in ('null', 'string')
       or (jsonb_typeof(partner->'partnerId') = 'string'
           and not private.is_nonblank_string(partner->'partnerId'))
       or not private.is_nonblank_string(partner->'partnerName')
       or not private.is_nonnegative_number(partner->'grams')
       or (partner->>'grams')::numeric <= 0
       or round((partner->>'grams')::numeric, 3) <> (partner->>'grams')::numeric
  ) then
    raise exception 'invalid material partner' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_partners) partner
    group by partner->>'id'
    having count(*) > 1
  ) or exists (
    select 1
    from jsonb_array_elements(v_partners) partner
    group by coalesce(
      nullif(btrim(partner->>'partnerId'), ''),
      'name:' || lower(btrim(partner->>'partnerName'))
    )
    having count(*) > 1
  ) then
    raise exception 'duplicate material partner' using errcode = '22023';
  end if;

  select coalesce(sum((partner->>'grams')::numeric), 0::numeric)
  into v_partners_grams
  from jsonb_array_elements(v_partners) partner;

  v_total_grams := (p_data->>'grams')::numeric;
  if v_partners_grams > v_total_grams then
    raise exception 'material partners exceed total grams' using errcode = '22023';
  end if;
end;
$$;

create or replace function private.assert_fund_contribution_payload(
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
  v_date date;
  v_due_date date;
  v_amount numeric;
begin
  -- ETAPA9_SOCIOS_FONDO_V1: cada aporte es una deuda independiente por persona.
  perform private.assert_entity_payload('fund contribution', p_id, p_data, p_updated_at);

  if coalesce(jsonb_typeof(p_data->'personId'), 'null') not in ('null', 'string')
     or (jsonb_typeof(p_data->'personId') = 'string'
         and not private.is_nonblank_string(p_data->'personId'))
     or not private.is_nonblank_string(p_data->'personName')
     or not private.is_iso_date(p_data->'date')
     or not private.is_safe_cop(p_data->'amountCop')
     or (p_data->>'amountCop')::numeric <= 0
     or coalesce(p_data->>'returnKind', '') not in ('mensual', 'fijo')
     or jsonb_typeof(p_data->'dueDate') is distinct from 'string'
     or jsonb_typeof(p_data->'payments') is distinct from 'array'
     or jsonb_typeof(p_data->'notes') is distinct from 'string'
     or jsonb_typeof(p_data->'createdAt') is distinct from 'string'
     or jsonb_typeof(p_data->'updatedAt') is distinct from 'string' then
    raise exception 'invalid fund contribution payload' using errcode = '22023';
  end if;

  v_amount := (p_data->>'amountCop')::numeric;
  if p_data->>'returnKind' = 'mensual' then
    if jsonb_typeof(p_data->'monthlyRatePercent') is distinct from 'number'
       or (p_data->>'monthlyRatePercent')::numeric < 0
       or (p_data->>'monthlyRatePercent')::numeric > 100
       or jsonb_typeof(p_data->'agreedTotalCop') is distinct from 'null' then
      raise exception 'invalid monthly fund return' using errcode = '22023';
    end if;
  elsif jsonb_typeof(p_data->'monthlyRatePercent') is distinct from 'null'
        or not private.is_safe_cop(p_data->'agreedTotalCop')
        or (p_data->>'agreedTotalCop')::numeric < v_amount then
    raise exception 'invalid fixed fund return' using errcode = '22023';
  end if;

  v_date := (p_data->>'date')::date;
  if char_length(p_data->>'dueDate') > 0 then
    if not private.is_iso_date(p_data->'dueDate') then
      raise exception 'invalid fund due date' using errcode = '22023';
    end if;
    v_due_date := (p_data->>'dueDate')::date;
    if v_due_date < v_date then
      raise exception 'fund due date predates contribution' using errcode = '22023';
    end if;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_data->'payments') payment
    where jsonb_typeof(payment) is distinct from 'object'
       or not private.is_nonblank_string(payment->'id')
       or not private.is_iso_date(payment->'date')
       or (payment->>'date')::date < v_date
       or not private.is_safe_cop(payment->'amountCop')
       or (payment->>'amountCop')::numeric <= 0
       or coalesce(payment->>'kind', '') not in ('capital', 'rendimiento')
       or jsonb_typeof(payment->'notes') is distinct from 'string'
  ) then
    raise exception 'invalid fund payment' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_data->'payments') payment
    group by payment->>'id'
    having count(*) > 1
  ) then
    raise exception 'duplicate fund payment' using errcode = '22023';
  end if;
end;
$$;

-- Un solo punto adicional protege escrituras normales, importaciones y futuras
-- RPC que escriban estas tablas, sin duplicar la logica en cada funcion publica.
create or replace function private.assert_socios_fondo_row_payload()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- ETAPA9_SOCIOS_FONDO_V1: frontera comun para socios y fondo.
  if tg_table_name = 'stone_lots' then
    perform private.assert_money_partners_payload(
      new.data->'partners',
      new.data->'purchaseValueCop',
      coalesce(new.data->'fundedFromFundCop', '0'::jsonb),
      'stone lot'
    );
  elsif tg_table_name = 'material_lots' then
    perform private.assert_material_partners_payload(new.data);
  elsif tg_table_name = 'expenses' then
    perform private.assert_money_partners_payload(
      new.data->'partners',
      new.data->'amountCop',
      '0'::jsonb,
      'expense'
    );
  elsif tg_table_name = 'fund_contributions' then
    perform private.assert_fund_contribution_payload(new.id, new.data, new.updated_at);
  else
    raise exception 'unexpected socios/fondo table' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function private.is_safe_cop(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_money_partners_payload(jsonb, jsonb, jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_material_partners_payload(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_fund_contribution_payload(text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_socios_fondo_row_payload()
  from public, anon, authenticated, service_role;

drop trigger if exists validate_socios_fondo_stone_lots on public.stone_lots;
create trigger validate_socios_fondo_stone_lots
before insert or update on public.stone_lots
for each row execute function private.assert_socios_fondo_row_payload();

drop trigger if exists validate_socios_fondo_material_lots on public.material_lots;
create trigger validate_socios_fondo_material_lots
before insert or update on public.material_lots
for each row execute function private.assert_socios_fondo_row_payload();

drop trigger if exists validate_socios_fondo_expenses on public.expenses;
create trigger validate_socios_fondo_expenses
before insert or update on public.expenses
for each row execute function private.assert_socios_fondo_row_payload();

drop trigger if exists validate_socios_fondo_fund_contributions on public.fund_contributions;
create trigger validate_socios_fondo_fund_contributions
before insert or update on public.fund_contributions
for each row execute function private.assert_socios_fondo_row_payload();

-- ---------------------------------------------------------------------------
-- 3. Escrituras protegidas. La organizacion siempre sale de la sesion y nunca
--    se acepta un organization_id enviado por el navegador.
-- ---------------------------------------------------------------------------

create or replace function public.upsert_fund_contribution(
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
  v_organization_id uuid := private.current_organization_id_for_roles(
    array['owner', 'admin', 'seller']
  );
begin
  -- ETAPA9_SOCIOS_FONDO_V1: upsert aislado del fondo.
  perform private.assert_fund_contribution_payload(p_id, p_data, p_updated_at);
  insert into public.fund_contributions (id, organization_id, data, updated_at)
  values (p_id, v_organization_id, p_data, p_updated_at)
  on conflict (organization_id, id) do update
  set data = excluded.data,
      updated_at = excluded.updated_at
  where excluded.updated_at >= public.fund_contributions.updated_at;
end;
$$;

create or replace function public.delete_fund_contribution(p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid := private.current_organization_id_for_roles(
    array['owner', 'admin', 'seller']
  );
begin
  -- ETAPA9_SOCIOS_FONDO_V1: delete aislado del fondo.
  delete from public.fund_contributions
  where organization_id = v_organization_id and id = p_id;
end;
$$;

revoke all on function public.upsert_fund_contribution(text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.delete_fund_contribution(text)
  from public, anon, authenticated, service_role;
grant execute on function public.upsert_fund_contribution(text, jsonb, timestamptz)
  to authenticated;
grant execute on function public.delete_fund_contribution(text)
  to authenticated;

-- Comprobacion por CONTENIDO. Debe devolver 6; el nombre por si solo no prueba
-- que Supabase haya recibido el cuerpo nuevo completo.
select count(*) as etapa9_funciones_verificadas
from pg_proc procedure
join pg_namespace namespace on namespace.oid = procedure.pronamespace
where namespace.nspname in ('private', 'public')
  and procedure.prosrc like '%ETAPA9_SOCIOS_FONDO_V1%'
  and procedure.proname in (
    'assert_money_partners_payload',
    'assert_material_partners_payload',
    'assert_fund_contribution_payload',
    'assert_socios_fondo_row_payload',
    'upsert_fund_contribution',
    'delete_fund_contribution'
  );
