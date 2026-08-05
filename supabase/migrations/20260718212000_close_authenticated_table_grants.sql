-- S1.1: elimina permisos de tabla heredados y reabre solo las lecturas necesarias.
-- Las escrituras autenticadas deben pasar exclusivamente por las RPC protegidas.

revoke all privileges on table public.organizations, public.memberships,
  public.org_settings, public.org_counters, public.clients, public.quotes,
  public.appointments, public.stone_lots, public.suppliers from authenticated;

grant select on table public.organizations, public.memberships, public.org_settings,
  public.clients, public.quotes, public.appointments, public.stone_lots,
  public.suppliers to authenticated;
