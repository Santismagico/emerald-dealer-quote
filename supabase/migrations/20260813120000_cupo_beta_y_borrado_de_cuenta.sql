-- Cupo de la beta y borrado de la propia joyeria con constancia.
--
-- POR QUE. La beta se abre con un maximo de 20 cuentas, y hasta hoy cualquiera
-- con el enlace podia registrarse sin tope. Ademas, el titular tiene derecho a
-- pedir la supresion de sus datos (Ley 1581 de 2012) y no existia forma de
-- ejecutarla: habia que hacerlo a mano en el panel del proveedor, sin constancia.
--
-- QUE HACE.
--   1. `platform_limits`: una sola fila con el cupo. Cambiar el cupo es un UPDATE,
--      no una migracion nueva.
--   2. `create_organization` rechaza el registro numero 21 con un error propio.
--   3. `delete_my_organization` borra la joyeria del que la pide, y con ella
--      TODOS sus datos por cascada, dejando constancia de fecha y alcance.
--   4. `deletion_records`: la constancia. Guarda a que joyeria pertenecia, cuando
--      y CUANTOS registros de cada tipo se borraron. **No guarda ningun dato
--      personal de clientes** — solo el nombre comercial de la joyeria y conteos.
--
-- SEGURIDAD DEL BORRADO. Tres cerraduras:
--   - solo el `owner` de la joyeria puede pedirlo;
--   - hay que enviar el **nombre exacto** de la joyeria como confirmacion;
--   - las 15 tablas cuelgan de `organizations` con `on delete cascade`, asi que
--     no queda nada huerfano. Se verifico tabla por tabla antes de escribir esto.
--
-- LO QUE ESTO **NO** BORRA. La cuenta de acceso (el correo y la contrasena) vive
-- en el esquema de autenticacion del proveedor y no se toca desde aqui: tocarlo
-- seria arriesgado. El operador la elimina desde el panel dentro de los 5 dias
-- habiles que prometen los terminos. Esa parte es manual y esta documentada.
--
-- Es repetible: volver a ejecutarlo deja el mismo estado.

-- ---------------------------------------------------------------------------
-- 1. El cupo de la beta.
-- ---------------------------------------------------------------------------
create table if not exists public.platform_limits (
  id boolean primary key default true,
  max_organizations integer,
  updated_at timestamptz not null default now(),
  constraint platform_limits_single_row check (id)
);

insert into public.platform_limits (id, max_organizations)
values (true, 20)
on conflict (id) do nothing;

alter table public.platform_limits enable row level security;

-- Nadie con sesion iniciada la lee ni la escribe. Las funciones protegidas son
-- `security definer` y la consultan sin pasar por RLS.
revoke all on table public.platform_limits from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. La constancia de borrado.
-- ---------------------------------------------------------------------------
create table if not exists public.deletion_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  organization_name text not null,
  requested_by uuid,
  deleted_at timestamptz not null default now(),
  scope jsonb not null
);

alter table public.deletion_records enable row level security;

revoke all on table public.deletion_records from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Registro con tope. El resto del cuerpo es identico al vigente: solo se
--    agrega la comprobacion del cupo.
-- ---------------------------------------------------------------------------
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
  v_max integer;
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

  -- Cupo de la beta. Un `max_organizations` nulo significa sin tope.
  select l.max_organizations into v_max from public.platform_limits l where l.id;
  if v_max is not null and (select count(*) from public.organizations) >= v_max then
    raise exception 'beta capacity reached' using errcode = '53400';
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

-- ---------------------------------------------------------------------------
-- 4. Borrado de la propia joyeria, con constancia.
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_organization(p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_name text;
  v_scope jsonb;
  v_deleted_at timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select m.organization_id into v_organization_id
  from public.memberships m
  where m.user_id = v_user_id and m.role = 'owner';

  if v_organization_id is null then
    raise exception 'only the owner can delete the jewelry' using errcode = '42501';
  end if;

  select o.name into v_name
  from public.organizations o
  where o.id = v_organization_id;

  -- Confirmacion explicita: hay que escribir el nombre exacto de la joyeria.
  -- Un clic distraido no puede borrar el historial de un negocio.
  if btrim(coalesce(p_confirmation, '')) is distinct from btrim(coalesce(v_name, '')) then
    raise exception 'deletion confirmation does not match' using errcode = '22023';
  end if;

  -- El alcance se cuenta ANTES de borrar; despues ya no hay nada que contar.
  select jsonb_build_object(
    'clients', (select count(*) from public.clients where organization_id = v_organization_id),
    'quotes', (select count(*) from public.quotes where organization_id = v_organization_id),
    'appointments', (select count(*) from public.appointments where organization_id = v_organization_id),
    'stoneLots', (select count(*) from public.stone_lots where organization_id = v_organization_id),
    'suppliers', (select count(*) from public.suppliers where organization_id = v_organization_id),
    'buyers', (select count(*) from public.buyers where organization_id = v_organization_id),
    'stockJewels', (select count(*) from public.stock_jewels where organization_id = v_organization_id),
    'materialPartners', (select count(*) from public.material_partners where organization_id = v_organization_id),
    'materialLots', (select count(*) from public.material_lots where organization_id = v_organization_id),
    'expenses', (select count(*) from public.expenses where organization_id = v_organization_id),
    'fundContributions', (select count(*) from public.fund_contributions where organization_id = v_organization_id)
  ) into v_scope;

  insert into public.deletion_records (
    organization_id, organization_name, requested_by, deleted_at, scope
  )
  values (v_organization_id, coalesce(v_name, ''), v_user_id, v_deleted_at, v_scope);

  -- Las 15 tablas cuelgan de aqui con `on delete cascade`.
  delete from public.organizations where id = v_organization_id;

  return jsonb_build_object(
    'organizationId', v_organization_id,
    'organizationName', coalesce(v_name, ''),
    'deletedAt', v_deleted_at,
    'scope', v_scope
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Permisos. `revoke all`, nunca la forma debil `revoke insert, update,
--    delete`: esa fue la causa del agujero de TRUNCATE del 2026-08-10.
-- ---------------------------------------------------------------------------
revoke all on function public.create_organization(text)
  from public, anon, authenticated, service_role;
revoke all on function public.delete_my_organization(text)
  from public, anon, authenticated, service_role;

grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.delete_my_organization(text) to authenticated;
