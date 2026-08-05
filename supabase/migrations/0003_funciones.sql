-- Fase 2 N1: operaciones protegidas. Ninguna acepta organization_id del navegador.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.current_organization_id()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_membership_count bigint;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select count(*), max(m.organization_id::text)::uuid
  into v_membership_count, v_organization_id
  from public.memberships m
  where m.user_id = v_user_id;

  if v_membership_count <> 1 then
    raise exception 'exactly one organization membership is required' using errcode = '42501';
  end if;

  return v_organization_id;
end;
$$;

revoke all on function private.current_organization_id() from public, anon, authenticated;

create or replace function public.create_organization(org_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := btrim(org_name);
  v_organization_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if v_name is null or char_length(v_name) not between 1 and 120 then
    raise exception 'invalid organization name' using errcode = '22023';
  end if;
  if exists (select 1 from public.memberships m where m.user_id = v_user_id) then
    raise exception 'user already belongs to an organization' using errcode = '23505';
  end if;

  insert into public.organizations (name)
  values (v_name)
  returning id into v_organization_id;

  insert into public.memberships (user_id, organization_id, role)
  values (v_user_id, v_organization_id, 'owner');

  insert into public.org_counters (organization_id, quote_seq)
  values (v_organization_id, 0);

  insert into public.org_settings (organization_id, data, updated_at)
  values (v_organization_id, '{}'::jsonb, now());

  return v_organization_id;
end;
$$;

create or replace function public.next_quote_number()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid := private.current_organization_id();
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
declare
  v_organization_id uuid := private.current_organization_id();
begin
  if p_updated_at is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'invalid settings payload' using errcode = '22023';
  end if;

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
declare v_organization_id uuid := private.current_organization_id();
begin
  if p_updated_at is null or char_length(btrim(p_id)) = 0 or jsonb_typeof(p_data) <> 'object' then
    raise exception 'invalid client payload' using errcode = '22023';
  end if;
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
declare v_organization_id uuid := private.current_organization_id();
begin
  if p_updated_at is null or char_length(btrim(p_id)) = 0 or jsonb_typeof(p_data) <> 'object' then
    raise exception 'invalid quote payload' using errcode = '22023';
  end if;
  insert into public.quotes (id, organization_id, number, status, data, updated_at)
  values (p_id, v_organization_id, p_data->>'number', p_data->>'status', p_data, p_updated_at)
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
declare v_organization_id uuid := private.current_organization_id();
begin
  if p_updated_at is null or char_length(btrim(p_id)) = 0 or jsonb_typeof(p_data) <> 'object' then
    raise exception 'invalid appointment payload' using errcode = '22023';
  end if;
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
declare v_organization_id uuid := private.current_organization_id();
begin
  if p_updated_at is null or char_length(btrim(p_id)) = 0 or jsonb_typeof(p_data) <> 'object' then
    raise exception 'invalid stone lot payload' using errcode = '22023';
  end if;
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
declare v_organization_id uuid := private.current_organization_id();
begin
  if p_updated_at is null or char_length(btrim(p_id)) = 0 or jsonb_typeof(p_data) <> 'object' then
    raise exception 'invalid supplier payload' using errcode = '22023';
  end if;
  insert into public.suppliers (id, organization_id, data, updated_at)
  values (p_id, v_organization_id, p_data, p_updated_at)
  on conflict (organization_id, id) do update
  set data = excluded.data, updated_at = excluded.updated_at
  where excluded.updated_at >= public.suppliers.updated_at;
end;
$$;

create or replace function public.delete_settings()
returns void language sql security definer set search_path = ''
as $$ delete from public.org_settings where organization_id = private.current_organization_id(); $$;

create or replace function public.delete_client(p_id text)
returns void language sql security definer set search_path = ''
as $$ delete from public.clients where organization_id = private.current_organization_id() and id = p_id; $$;

create or replace function public.delete_quote(p_id text)
returns void language sql security definer set search_path = ''
as $$ delete from public.quotes where organization_id = private.current_organization_id() and id = p_id; $$;

create or replace function public.delete_appointment(p_id text)
returns void language sql security definer set search_path = ''
as $$ delete from public.appointments where organization_id = private.current_organization_id() and id = p_id; $$;

create or replace function public.delete_stone_lot(p_id text)
returns void language sql security definer set search_path = ''
as $$ delete from public.stone_lots where organization_id = private.current_organization_id() and id = p_id; $$;

create or replace function public.delete_supplier(p_id text)
returns void language sql security definer set search_path = ''
as $$ delete from public.suppliers where organization_id = private.current_organization_id() and id = p_id; $$;

revoke all on function public.create_organization(text) from public, anon;
revoke all on function public.next_quote_number() from public, anon;
revoke all on function public.upsert_settings(jsonb, timestamptz) from public, anon;
revoke all on function public.upsert_client(text, jsonb, timestamptz) from public, anon;
revoke all on function public.upsert_quote(text, jsonb, timestamptz) from public, anon;
revoke all on function public.upsert_appointment(text, jsonb, timestamptz) from public, anon;
revoke all on function public.upsert_stone_lot(text, jsonb, timestamptz) from public, anon;
revoke all on function public.upsert_supplier(text, jsonb, timestamptz) from public, anon;
revoke all on function public.delete_settings() from public, anon;
revoke all on function public.delete_client(text) from public, anon;
revoke all on function public.delete_quote(text) from public, anon;
revoke all on function public.delete_appointment(text) from public, anon;
revoke all on function public.delete_stone_lot(text) from public, anon;
revoke all on function public.delete_supplier(text) from public, anon;

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
