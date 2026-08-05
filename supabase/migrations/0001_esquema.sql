-- Fase 2 N1: esquema multiempresa de Emerald Dealer.
-- Los ids de las entidades siguen siendo TEXT para conservar los datos locales existentes.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'seller')),
  created_at timestamptz not null default now(),
  primary key (user_id, organization_id)
);

create index memberships_organization on public.memberships (organization_id);

create table public.org_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.org_counters (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  quote_seq integer not null default 0 check (quote_seq >= 0)
);

create table public.clients (
  id text not null check (char_length(btrim(id)) > 0),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null,
  primary key (organization_id, id)
);

create table public.quotes (
  id text not null check (char_length(btrim(id)) > 0),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  number text,
  status text,
  data jsonb not null,
  updated_at timestamptz not null,
  primary key (organization_id, id)
);

create table public.appointments (
  id text not null check (char_length(btrim(id)) > 0),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null,
  primary key (organization_id, id)
);

create table public.stone_lots (
  id text not null check (char_length(btrim(id)) > 0),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null,
  primary key (organization_id, id)
);

create table public.suppliers (
  id text not null check (char_length(btrim(id)) > 0),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null,
  primary key (organization_id, id)
);

create index clients_org_updated on public.clients (organization_id, updated_at desc);
create index quotes_org_updated on public.quotes (organization_id, updated_at desc);
create index quotes_org_status on public.quotes (organization_id, status);
create index appointments_org_updated on public.appointments (organization_id, updated_at desc);
create index stone_lots_org_updated on public.stone_lots (organization_id, updated_at desc);
create index suppliers_org_updated on public.suppliers (organization_id, updated_at desc);

-- Desde mayo de 2026 los proyectos nuevos pueden no exponer tablas automáticamente.
-- Los GRANT permiten llegar a la Data API; RLS (0002) decide qué filas puede usar cada sesión.
revoke all on table public.organizations, public.memberships, public.org_settings,
  public.org_counters, public.clients, public.quotes, public.appointments,
  public.stone_lots, public.suppliers from anon;

grant select on table public.organizations, public.memberships to authenticated;
grant select, insert, update, delete on table public.org_settings, public.clients,
  public.quotes, public.appointments, public.stone_lots, public.suppliers to authenticated;

-- El contador solo se usa mediante next_quote_number().
revoke all on table public.org_counters from authenticated;
