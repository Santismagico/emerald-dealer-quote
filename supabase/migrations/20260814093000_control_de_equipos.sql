-- Control de equipos por cuenta: la regla de «una cuenta por joyeria».
--
-- QUE PROMETEN LOS DOCUMENTOS v1-2026-08-12.
--   Terminos, numeral 3: «el operador registra datos tecnicos de la sesion —en
--   particular el numero de dispositivos distintos desde los que se usa cada
--   cuenta— y puede pedir explicacion cuando encuentre indicios de uso
--   compartido. Este registro es solo para seguridad y control de uso; no
--   rastrea la actividad comercial de la joyeria ni sus datos de clientes.»
--   Privacidad, numeral 2: «un identificador del dispositivo y la fecha del
--   ultimo acceso (...). No se registra la ubicacion, ni la navegacion dentro de
--   la aplicacion, ni la actividad comercial.»
--
-- EL ESQUEMA ES EL LIMITE DE LA PROMESA. Esta tabla guarda exactamente cuatro
-- cosas: a que joyeria y a que usuario pertenece, un identificador opaco del
-- equipo, y cuando se vio por primera y ultima vez. **No hay columna para
-- navegador, sistema operativo, direccion IP ni ubicacion**, y no debe
-- agregarse ninguna sin cambiar antes la politica de privacidad y volver a
-- pedir aceptacion. Prometer poco y guardar menos es lo que hace la promesa
-- verificable.
--
-- EL IDENTIFICADOR NO IDENTIFICA A LA PERSONA. Lo genera la propia aplicacion
-- al azar y lo guarda en el dispositivo. No se deriva del equipo ni permite
-- reconocerlo fuera de esta cuenta.
--
-- UMBRAL: 3 equipos por cuenta en 30 dias, decidido por Santiago el 2026-08-12.
-- Cubre el uso legitimo —celular, tableta y computador— y deja fuera el reparto
-- entre varias joyerias.
--
-- **SEÑALA, NO BLOQUEA.** El umbral no corta el acceso a nadie: alimenta un
-- informe para el operador. Bloquear por conteo castigaria a un cliente honesto
-- que cambio de telefono sin que nadie revisara el caso, y los propios terminos
-- obligan a pedir explicacion antes de aplicar el numeral 6.
--
-- Es repetible: volver a ejecutarlo deja el mismo estado.

-- ---------------------------------------------------------------------------
-- 1. El registro. Cuatro columnas y ni una mas.
-- ---------------------------------------------------------------------------
create table if not exists public.device_sessions (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  device_id text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (organization_id, user_id, device_id),
  constraint device_sessions_device_id_valido
    check (char_length(device_id) between 8 and 64)
);

create index if not exists device_sessions_ultimo_acceso
  on public.device_sessions (organization_id, last_seen_at desc);

alter table public.device_sessions enable row level security;

-- Ni siquiera se puede LEER con una sesion normal: es informacion del operador,
-- y ninguna joyeria necesita ver los equipos de nadie, ni los suyos.
revoke all on table public.device_sessions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. La unica forma de escribir aqui. La joyeria la decide el SERVIDOR.
-- ---------------------------------------------------------------------------
create or replace function public.touch_device(p_device_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_device_id text := btrim(coalesce(p_device_id, ''));
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if char_length(v_device_id) not between 8 and 64 then
    raise exception 'invalid device identifier' using errcode = '22023';
  end if;

  -- El navegador nunca dice a que joyeria pertenece: lo resuelve el servidor,
  -- igual que en todas las funciones protegidas.
  v_organization_id := private.current_organization_id();
  if v_organization_id is null then
    return;
  end if;

  insert into public.device_sessions (organization_id, user_id, device_id)
  values (v_organization_id, v_user_id, v_device_id)
  on conflict (organization_id, user_id, device_id)
  do update set last_seen_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. El informe del operador. Devuelve conteos, nunca identificadores.
-- ---------------------------------------------------------------------------
create or replace function public.device_usage_report(p_days integer default 30)
returns table (
  organization_id uuid,
  organization_name text,
  equipos integer,
  cuentas integer,
  ultimo_acceso timestamptz,
  supera_umbral boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.id,
    o.name,
    count(distinct d.device_id)::integer,
    count(distinct d.user_id)::integer,
    max(d.last_seen_at),
    count(distinct d.device_id) > 3
  from public.organizations o
  join public.device_sessions d on d.organization_id = o.id
  where d.last_seen_at >= now() - make_interval(days => greatest(coalesce(p_days, 30), 1))
  group by o.id, o.name
  order by count(distinct d.device_id) desc;
$$;

-- ---------------------------------------------------------------------------
-- 4. Permisos. `revoke all`, nunca la forma debil que abrio el hueco de
--    TRUNCATE el 2026-08-10.
-- ---------------------------------------------------------------------------
revoke all on function public.touch_device(text)
  from public, anon, authenticated, service_role;
revoke all on function public.device_usage_report(integer)
  from public, anon, authenticated, service_role;

-- La app registra su propio equipo. El informe es SOLO del operador: ninguna
-- joyeria puede pedirlo, porque expondria cuantos equipos usan las demas.
grant execute on function public.touch_device(text) to authenticated;
grant execute on function public.device_usage_report(integer) to service_role;
