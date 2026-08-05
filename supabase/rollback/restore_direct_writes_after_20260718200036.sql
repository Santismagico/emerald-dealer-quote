-- ROLLBACK DE EMERGENCIA, NO ES UNA MIGRACION AUTOMATICA.
-- Solo restaurar temporalmente si las RPC protegidas impiden operar en el proyecto de PRUEBAS.
-- Este archivo vuelve a abrir una frontera menos segura y exige autorizacion, evidencia y correccion inmediata.

grant insert, update, delete on table public.org_settings, public.clients,
  public.quotes, public.appointments, public.stone_lots, public.suppliers to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['org_settings', 'clients', 'quotes', 'appointments', 'stone_lots', 'suppliers']
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_member', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update_member', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_delete_member', table_name);

    execute format(
      'create policy %I on public.%I for insert to authenticated with check (exists (select 1 from public.memberships m where m.organization_id = %I.organization_id and m.user_id = (select auth.uid())))',
      table_name || '_insert_member', table_name, table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (exists (select 1 from public.memberships m where m.organization_id = %I.organization_id and m.user_id = (select auth.uid()))) with check (exists (select 1 from public.memberships m where m.organization_id = %I.organization_id and m.user_id = (select auth.uid())))',
      table_name || '_update_member', table_name, table_name, table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (exists (select 1 from public.memberships m where m.organization_id = %I.organization_id and m.user_id = (select auth.uid())))',
      table_name || '_delete_member', table_name, table_name
    );
  end loop;
end;
$$;
