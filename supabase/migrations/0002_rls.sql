-- Fase 2 N1: aislamiento estricto por organizacion.

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.org_settings enable row level security;
alter table public.org_counters enable row level security;
alter table public.clients enable row level security;
alter table public.quotes enable row level security;
alter table public.appointments enable row level security;
alter table public.stone_lots enable row level security;
alter table public.suppliers enable row level security;

create policy organizations_select_member
on public.organizations
for select
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.organization_id = organizations.id
      and m.user_id = (select auth.uid())
  )
);

create policy memberships_select_self
on public.memberships
for select
to authenticated
using (user_id = (select auth.uid()));

-- org_counters no tiene politicas: solo las funciones protegidas pueden usarlo.

create policy org_settings_select_member on public.org_settings
for select to authenticated
using (exists (
  select 1 from public.memberships m
  where m.organization_id = org_settings.organization_id
    and m.user_id = (select auth.uid())
));

create policy org_settings_insert_member on public.org_settings
for insert to authenticated
with check (exists (
  select 1 from public.memberships m
  where m.organization_id = org_settings.organization_id
    and m.user_id = (select auth.uid())
));

create policy org_settings_update_member on public.org_settings
for update to authenticated
using (exists (
  select 1 from public.memberships m
  where m.organization_id = org_settings.organization_id
    and m.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.memberships m
  where m.organization_id = org_settings.organization_id
    and m.user_id = (select auth.uid())
));

create policy org_settings_delete_member on public.org_settings
for delete to authenticated
using (exists (
  select 1 from public.memberships m
  where m.organization_id = org_settings.organization_id
    and m.user_id = (select auth.uid())
));

create policy clients_select_member on public.clients
for select to authenticated
using (exists (
  select 1 from public.memberships m
  where m.organization_id = clients.organization_id
    and m.user_id = (select auth.uid())
));

create policy clients_insert_member on public.clients
for insert to authenticated
with check (exists (
  select 1 from public.memberships m
  where m.organization_id = clients.organization_id
    and m.user_id = (select auth.uid())
));

create policy clients_update_member on public.clients
for update to authenticated
using (exists (
  select 1 from public.memberships m
  where m.organization_id = clients.organization_id
    and m.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.memberships m
  where m.organization_id = clients.organization_id
    and m.user_id = (select auth.uid())
));

create policy clients_delete_member on public.clients
for delete to authenticated
using (exists (
  select 1 from public.memberships m
  where m.organization_id = clients.organization_id
    and m.user_id = (select auth.uid())
));

create policy quotes_select_member on public.quotes
for select to authenticated
using (exists (
  select 1 from public.memberships m
  where m.organization_id = quotes.organization_id
    and m.user_id = (select auth.uid())
));

create policy quotes_insert_member on public.quotes
for insert to authenticated
with check (exists (
  select 1 from public.memberships m
  where m.organization_id = quotes.organization_id
    and m.user_id = (select auth.uid())
));

create policy quotes_update_member on public.quotes
for update to authenticated
using (exists (
  select 1 from public.memberships m
  where m.organization_id = quotes.organization_id
    and m.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.memberships m
  where m.organization_id = quotes.organization_id
    and m.user_id = (select auth.uid())
));

create policy quotes_delete_member on public.quotes
for delete to authenticated
using (exists (
  select 1 from public.memberships m
  where m.organization_id = quotes.organization_id
    and m.user_id = (select auth.uid())
));

create policy appointments_select_member on public.appointments
for select to authenticated
using (exists (
  select 1 from public.memberships m
  where m.organization_id = appointments.organization_id
    and m.user_id = (select auth.uid())
));

create policy appointments_insert_member on public.appointments
for insert to authenticated
with check (exists (
  select 1 from public.memberships m
  where m.organization_id = appointments.organization_id
    and m.user_id = (select auth.uid())
));

create policy appointments_update_member on public.appointments
for update to authenticated
using (exists (
  select 1 from public.memberships m
  where m.organization_id = appointments.organization_id
    and m.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.memberships m
  where m.organization_id = appointments.organization_id
    and m.user_id = (select auth.uid())
));

create policy appointments_delete_member on public.appointments
for delete to authenticated
using (exists (
  select 1 from public.memberships m
  where m.organization_id = appointments.organization_id
    and m.user_id = (select auth.uid())
));

create policy stone_lots_select_member on public.stone_lots
for select to authenticated
using (exists (
  select 1 from public.memberships m
  where m.organization_id = stone_lots.organization_id
    and m.user_id = (select auth.uid())
));

create policy stone_lots_insert_member on public.stone_lots
for insert to authenticated
with check (exists (
  select 1 from public.memberships m
  where m.organization_id = stone_lots.organization_id
    and m.user_id = (select auth.uid())
));

create policy stone_lots_update_member on public.stone_lots
for update to authenticated
using (exists (
  select 1 from public.memberships m
  where m.organization_id = stone_lots.organization_id
    and m.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.memberships m
  where m.organization_id = stone_lots.organization_id
    and m.user_id = (select auth.uid())
));

create policy stone_lots_delete_member on public.stone_lots
for delete to authenticated
using (exists (
  select 1 from public.memberships m
  where m.organization_id = stone_lots.organization_id
    and m.user_id = (select auth.uid())
));

create policy suppliers_select_member on public.suppliers
for select to authenticated
using (exists (
  select 1 from public.memberships m
  where m.organization_id = suppliers.organization_id
    and m.user_id = (select auth.uid())
));

create policy suppliers_insert_member on public.suppliers
for insert to authenticated
with check (exists (
  select 1 from public.memberships m
  where m.organization_id = suppliers.organization_id
    and m.user_id = (select auth.uid())
));

create policy suppliers_update_member on public.suppliers
for update to authenticated
using (exists (
  select 1 from public.memberships m
  where m.organization_id = suppliers.organization_id
    and m.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.memberships m
  where m.organization_id = suppliers.organization_id
    and m.user_id = (select auth.uid())
));

create policy suppliers_delete_member on public.suppliers
for delete to authenticated
using (exists (
  select 1 from public.memberships m
  where m.organization_id = suppliers.organization_id
    and m.user_id = (select auth.uid())
));
