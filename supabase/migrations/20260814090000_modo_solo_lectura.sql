-- Modo solo lectura por falta de pago o por incumplimiento.
--
-- QUE PROMETEN LOS TERMINOS v1-2026-08-12.
--   Numeral 3: vencido el periodo pagado hay diez (10) dias de gracia con
--   servicio completo. Pasados esos diez dias sin pago, la cuenta pasa a modo
--   solo lectura: puede entrar, consultar TODA su informacion y EXPORTARLA
--   COMPLETA, pero no registrar ni modificar datos. El acceso de solo lectura
--   NO se corta por falta de pago.
--   Numeral 6: ante un incumplimiento, tras la advertencia la cuenta pasa a
--   solo lectura quince (15) dias antes de poder terminarse.
--
-- POR QUE UN DISPARADOR EN LA TABLA Y NO UNA COMPROBACION EN CADA FUNCION.
-- Hay 31 funciones publicas de escritura. Comprobar en cada una deja el sistema
-- a merced de que ninguna se olvide, hoy y en cada funcion futura: un solo
-- descuido abre la puerta entera. El disparador vive en la TABLA, asi que
-- atrapa cualquier camino de escritura —incluido uno que nadie recuerde— y no
-- exige reescribir ninguna funcion vigente, que es donde se cuelan los errores.
--
-- QUE **NO** BLOQUEA, a proposito:
--   - Las LECTURAS. Row Level Security sigue decidiendo que ve cada joyeria.
--   - La EXPORTACION, que es solo lectura y los terminos la garantizan siempre.
--   - `service_role` y las conexiones directas: respaldos, importacion y soporte
--     tienen que seguir funcionando aunque la cuenta este en solo lectura.
--
-- ESTADO POR DEFECTO. Una joyeria sin fila en `organization_billing` puede
-- escribir. El bloqueo es una decision explicita del operador, nunca un efecto
-- secundario de olvidar crear una fila.
--
-- Es repetible: volver a ejecutarlo deja el mismo estado.

-- ---------------------------------------------------------------------------
-- 1. Estado de cada joyeria. Lo maneja el operador a mano: el cobro es manual.
-- ---------------------------------------------------------------------------
create table if not exists public.organization_billing (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  status text not null default 'activa',
  paid_through date,
  read_only_since timestamptz,
  reason text,
  updated_at timestamptz not null default now(),
  constraint organization_billing_status_valido
    check (status in ('activa', 'solo_lectura'))
);

alter table public.organization_billing enable row level security;

-- Con sesion iniciada solo se LEE el propio estado, para poder avisar en la app.
revoke all on table public.organization_billing from public, anon, authenticated;
grant select on table public.organization_billing to authenticated;

drop policy if exists organization_billing_lectura_propia on public.organization_billing;
create policy organization_billing_lectura_propia
  on public.organization_billing
  for select
  to authenticated
  using (organization_id = private.current_organization_id());

-- ---------------------------------------------------------------------------
-- 2. El candado.
-- ---------------------------------------------------------------------------
create or replace function private.enforce_read_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_status text;
  v_fila jsonb;
  v_resultado record;
begin
  -- En un DELETE la fila nueva no existe, y en un INSERT no existe la vieja.
  -- Se elige explicitamente para no depender de que `new` sea nulo o no.
  if tg_op = 'DELETE' then
    v_fila := to_jsonb(old);
    v_resultado := old;
  else
    v_fila := to_jsonb(new);
    v_resultado := new;
  end if;

  -- Sin usuario autenticado no hay nada que frenar aqui: es `service_role`, una
  -- conexion directa o una peticion anonima, y esas ya las gobiernan los
  -- permisos y Row Level Security. Los respaldos y la importacion dependen de
  -- que esta rama siga abierta.
  if auth.uid() is null then
    return v_resultado;
  end if;

  v_organization_id := (v_fila ->> 'organization_id')::uuid;
  if v_organization_id is null then
    return v_resultado;
  end if;

  select b.status into v_status
  from public.organization_billing b
  where b.organization_id = v_organization_id;

  -- Sin fila, la joyeria escribe con normalidad.
  if v_status = 'solo_lectura' then
    raise exception 'organization is read only'
      using errcode = '42501',
            hint = 'La cuenta esta en modo solo lectura. Puedes consultar y exportar, no modificar.';
  end if;

  return v_resultado;
end;
$$;

revoke all on function private.enforce_read_only()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Colgarlo de cada tabla con datos de la joyeria.
--    `memberships` queda fuera a proposito: una cuenta en solo lectura debe
--    poder seguir entrando, y su membresia no es dato de negocio.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'org_settings', 'org_counters', 'clients', 'quotes', 'appointments',
    'stone_lots', 'suppliers', 'buyers', 'stock_jewels',
    'material_partners', 'material_lots', 'expenses', 'fund_contributions'
  ]
  loop
    execute format('drop trigger if exists solo_lectura_%1$s on public.%1$I', t);
    execute format(
      'create trigger solo_lectura_%1$s
         before insert or update or delete on public.%1$I
         for each row execute function private.enforce_read_only()', t
    );
  end loop;
end;
$$;
