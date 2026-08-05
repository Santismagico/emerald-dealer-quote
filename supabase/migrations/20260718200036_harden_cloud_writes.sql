-- S1: una sola frontera de escritura, permisos minimos y validacion en servidor.
-- Las lecturas siguen usando Data API + RLS. Las mutaciones solo usan RPC protegidas.

-- Los objetos futuros nacen cerrados y requieren GRANT explicito en su migracion.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;

-- El navegador autenticado solo necesita lectura directa para sincronizar.
revoke insert, update, delete on table public.org_settings, public.clients,
  public.quotes, public.appointments, public.stone_lots, public.suppliers from authenticated;
grant select on table public.org_settings, public.clients, public.quotes,
  public.appointments, public.stone_lots, public.suppliers to authenticated;

revoke all on table public.organizations, public.memberships, public.org_settings,
  public.org_counters, public.clients, public.quotes, public.appointments,
  public.stone_lots, public.suppliers from anon;

-- La clave de servicio nunca va al navegador. Se reserva para administracion y pruebas N6.
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on table public.organizations, public.memberships,
  public.org_settings, public.org_counters, public.clients, public.quotes,
  public.appointments, public.stone_lots, public.suppliers to service_role;

-- Aunque alguien restaure por error un GRANT del navegador, RLS sigue negando escrituras directas.
drop policy if exists org_settings_insert_member on public.org_settings;
drop policy if exists org_settings_update_member on public.org_settings;
drop policy if exists org_settings_delete_member on public.org_settings;
drop policy if exists clients_insert_member on public.clients;
drop policy if exists clients_update_member on public.clients;
drop policy if exists clients_delete_member on public.clients;
drop policy if exists quotes_insert_member on public.quotes;
drop policy if exists quotes_update_member on public.quotes;
drop policy if exists quotes_delete_member on public.quotes;
drop policy if exists appointments_insert_member on public.appointments;
drop policy if exists appointments_update_member on public.appointments;
drop policy if exists appointments_delete_member on public.appointments;
drop policy if exists stone_lots_insert_member on public.stone_lots;
drop policy if exists stone_lots_update_member on public.stone_lots;
drop policy if exists stone_lots_delete_member on public.stone_lots;
drop policy if exists suppliers_insert_member on public.suppliers;
drop policy if exists suppliers_update_member on public.suppliers;
drop policy if exists suppliers_delete_member on public.suppliers;

create or replace function private.current_organization_id_for_roles(p_allowed_roles text[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_role text;
  v_membership_count bigint;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select count(*), max(m.organization_id::text)::uuid, max(m.role)
  into v_membership_count, v_organization_id, v_role
  from public.memberships m
  where m.user_id = v_user_id;

  if v_membership_count <> 1 or not (v_role = any(p_allowed_roles)) then
    raise exception 'operation not allowed for current membership' using errcode = '42501';
  end if;

  return v_organization_id;
end;
$$;

create or replace function private.is_nonnegative_integer(p_value jsonb)
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
  return v_number >= 0 and trunc(v_number) = v_number;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    return false;
end;
$$;

create or replace function private.assert_updated_at(p_updated_at timestamptz)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_updated_at is null
     or p_updated_at < timestamptz '2020-01-01 00:00:00+00'
     or p_updated_at > now() + interval '1 day' then
    raise exception 'invalid updated timestamp' using errcode = '22023';
  end if;
end;
$$;

create or replace function private.assert_entity_payload(
  p_entity text,
  p_id text,
  p_data jsonb,
  p_updated_at timestamptz
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.assert_updated_at(p_updated_at);
  if p_id is null or char_length(btrim(p_id)) not between 1 and 200
     or jsonb_typeof(p_data) <> 'object'
     or jsonb_typeof(p_data->'id') <> 'string'
     or p_data->>'id' <> p_id then
    raise exception 'invalid % payload', p_entity using errcode = '22023';
  end if;
end;
$$;

create or replace function private.assert_settings_payload(
  p_data jsonb,
  p_updated_at timestamptz
)
returns void
language plpgsql
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
end;
$$;

create or replace function private.assert_quote_payload(
  p_id text,
  p_data jsonb,
  p_updated_at timestamptz
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.assert_entity_payload('quote', p_id, p_data, p_updated_at);
  if jsonb_typeof(p_data->'number') <> 'string'
     or char_length(btrim(p_data->>'number')) not between 1 and 80
     or coalesce(lower(p_data->>'status'), '') not in ('borrador', 'pendiente', 'aprobada', 'rechazada', 'vencida')
     or not private.is_nonnegative_integer(p_data->'materialPricePerGram')
     or not private.is_nonnegative_integer(p_data->'laborCost')
     or not private.is_nonnegative_integer(p_data->'deposit')
     or jsonb_typeof(p_data->'stones') <> 'array'
     or jsonb_typeof(p_data->'extraCosts') <> 'array'
     or jsonb_typeof(p_data->'production') <> 'array'
     or jsonb_typeof(p_data->'payments') <> 'array' then
    raise exception 'invalid quote payload' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_data->'stones') item
    where not private.is_nonnegative_integer(item->'unitPrice')
  ) or exists (
    select 1 from jsonb_array_elements(p_data->'extraCosts') item
    where not private.is_nonnegative_integer(item->'amount')
  ) or exists (
    select 1 from jsonb_array_elements(p_data->'production') item
    where not private.is_nonnegative_integer(item->'cost')
  ) or exists (
    select 1 from jsonb_array_elements(p_data->'payments') item
    where not private.is_nonnegative_integer(item->'amount')
  ) then
    raise exception 'invalid quote COP field' using errcode = '22023';
  end if;
end;
$$;

create or replace function private.assert_appointment_payload(
  p_id text,
  p_data jsonb,
  p_updated_at timestamptz
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.assert_entity_payload('appointment', p_id, p_data, p_updated_at);
  if coalesce(lower(p_data->>'status'), '') not in ('programada', 'cumplida', 'cancelada', 'noasistio')
     or not private.is_nonnegative_integer(p_data->'durationMinutes')
     or (p_data->>'durationMinutes')::numeric <= 0 then
    raise exception 'invalid appointment payload' using errcode = '22023';
  end if;
end;
$$;

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
end;
$$;

revoke all on function private.current_organization_id_for_roles(text[]) from public, anon, authenticated, service_role;
revoke all on function private.is_nonnegative_integer(jsonb) from public, anon, authenticated, service_role;
revoke all on function private.assert_updated_at(timestamptz) from public, anon, authenticated, service_role;
revoke all on function private.assert_entity_payload(text, text, jsonb, timestamptz) from public, anon, authenticated, service_role;
revoke all on function private.assert_settings_payload(jsonb, timestamptz) from public, anon, authenticated, service_role;
revoke all on function private.assert_quote_payload(text, jsonb, timestamptz) from public, anon, authenticated, service_role;
revoke all on function private.assert_appointment_payload(text, jsonb, timestamptz) from public, anon, authenticated, service_role;
revoke all on function private.assert_stone_lot_payload(text, jsonb, timestamptz) from public, anon, authenticated, service_role;

create or replace function public.next_quote_number()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
  v_sequence integer;
begin
  update public.org_counters
  set quote_seq = quote_seq + 1
  where organization_id = v_organization_id
  returning quote_seq into v_sequence;
  if v_sequence is null then
    raise exception 'organization counter not found' using errcode = 'P0002';
  end if;
  return 'ED-' || to_char(now(), 'YYYY') || '-' || lpad(v_sequence::text, 4, '0');
end;
$$;

create or replace function public.upsert_settings(p_data jsonb, p_updated_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin']);
begin
  perform private.assert_settings_payload(p_data, p_updated_at);
  insert into public.org_settings (organization_id, data, updated_at)
  values (v_organization_id, p_data, p_updated_at)
  on conflict (organization_id) do update
  set data = excluded.data, updated_at = excluded.updated_at
  where excluded.updated_at >= public.org_settings.updated_at;
end;
$$;

create or replace function public.upsert_client(p_id text, p_data jsonb, p_updated_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
begin
  perform private.assert_entity_payload('client', p_id, p_data, p_updated_at);
  insert into public.clients (id, organization_id, data, updated_at)
  values (p_id, v_organization_id, p_data, p_updated_at)
  on conflict (organization_id, id) do update
  set data = excluded.data, updated_at = excluded.updated_at
  where excluded.updated_at >= public.clients.updated_at;
end;
$$;

create or replace function public.upsert_quote(p_id text, p_data jsonb, p_updated_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
begin
  perform private.assert_quote_payload(p_id, p_data, p_updated_at);
  insert into public.quotes (id, organization_id, number, status, data, updated_at)
  values (p_id, v_organization_id, p_data->>'number', lower(p_data->>'status'), p_data, p_updated_at)
  on conflict (organization_id, id) do update
  set number = excluded.number, status = excluded.status,
      data = excluded.data, updated_at = excluded.updated_at
  where excluded.updated_at >= public.quotes.updated_at;
end;
$$;

create or replace function public.upsert_appointment(p_id text, p_data jsonb, p_updated_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
begin
  perform private.assert_appointment_payload(p_id, p_data, p_updated_at);
  insert into public.appointments (id, organization_id, data, updated_at)
  values (p_id, v_organization_id, p_data, p_updated_at)
  on conflict (organization_id, id) do update
  set data = excluded.data, updated_at = excluded.updated_at
  where excluded.updated_at >= public.appointments.updated_at;
end;
$$;

create or replace function public.upsert_stone_lot(p_id text, p_data jsonb, p_updated_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
begin
  perform private.assert_stone_lot_payload(p_id, p_data, p_updated_at);
  insert into public.stone_lots (id, organization_id, data, updated_at)
  values (p_id, v_organization_id, p_data, p_updated_at)
  on conflict (organization_id, id) do update
  set data = excluded.data, updated_at = excluded.updated_at
  where excluded.updated_at >= public.stone_lots.updated_at;
end;
$$;

create or replace function public.upsert_supplier(p_id text, p_data jsonb, p_updated_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
begin
  perform private.assert_entity_payload('supplier', p_id, p_data, p_updated_at);
  insert into public.suppliers (id, organization_id, data, updated_at)
  values (p_id, v_organization_id, p_data, p_updated_at)
  on conflict (organization_id, id) do update
  set data = excluded.data, updated_at = excluded.updated_at
  where excluded.updated_at >= public.suppliers.updated_at;
end;
$$;

create or replace function public.delete_settings()
returns void language plpgsql security definer set search_path = ''
as $$
declare v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin']);
begin delete from public.org_settings where organization_id = v_organization_id; end;
$$;

create or replace function public.delete_client(p_id text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
begin delete from public.clients where organization_id = v_organization_id and id = p_id; end;
$$;

create or replace function public.delete_quote(p_id text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
begin delete from public.quotes where organization_id = v_organization_id and id = p_id; end;
$$;

create or replace function public.delete_appointment(p_id text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
begin delete from public.appointments where organization_id = v_organization_id and id = p_id; end;
$$;

create or replace function public.delete_stone_lot(p_id text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
begin delete from public.stone_lots where organization_id = v_organization_id and id = p_id; end;
$$;

create or replace function public.delete_supplier(p_id text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
begin delete from public.suppliers where organization_id = v_organization_id and id = p_id; end;
$$;

-- Cierra cualquier permiso heredado y vuelve a abrir solo la API autenticada documentada.
revoke all on function public.create_organization(text) from public, anon, authenticated, service_role;
revoke all on function public.next_quote_number() from public, anon, authenticated, service_role;
revoke all on function public.upsert_settings(jsonb, timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.upsert_client(text, jsonb, timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.upsert_quote(text, jsonb, timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.upsert_appointment(text, jsonb, timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.upsert_stone_lot(text, jsonb, timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.upsert_supplier(text, jsonb, timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.delete_settings() from public, anon, authenticated, service_role;
revoke all on function public.delete_client(text) from public, anon, authenticated, service_role;
revoke all on function public.delete_quote(text) from public, anon, authenticated, service_role;
revoke all on function public.delete_appointment(text) from public, anon, authenticated, service_role;
revoke all on function public.delete_stone_lot(text) from public, anon, authenticated, service_role;
revoke all on function public.delete_supplier(text) from public, anon, authenticated, service_role;

grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.next_quote_number() to authenticated;
grant execute on function public.upsert_settings(jsonb, timestamptz) to authenticated;
grant execute on function public.upsert_client(text, jsonb, timestamptz) to authenticated;
grant execute on function public.upsert_quote(text, jsonb, timestamptz) to authenticated;
grant execute on function public.upsert_appointment(text, jsonb, timestamptz) to authenticated;
grant execute on function public.upsert_stone_lot(text, jsonb, timestamptz) to authenticated;
grant execute on function public.upsert_supplier(text, jsonb, timestamptz) to authenticated;
grant execute on function public.delete_settings() to authenticated;
grant execute on function public.delete_client(text) to authenticated;
grant execute on function public.delete_quote(text) to authenticated;
grant execute on function public.delete_appointment(text) to authenticated;
grant execute on function public.delete_stone_lot(text) to authenticated;
grant execute on function public.delete_supplier(text) to authenticated;
