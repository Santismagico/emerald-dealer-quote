-- Correccion Santiago C4: un lote puede eliminarse aunque haya aportado piedra
-- a una joya. Antes de borrarlo, cada joya conserva el nombre historico del
-- lote. Costo, venta y demas historia permanecen byte por byte.

alter function private.assert_stock_jewel_c2_payload(jsonb)
  rename to assert_stock_jewel_c2_payload_before_lot_name;

create or replace function private.assert_stock_jewel_c2_payload(p_data jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.assert_stock_jewel_c2_payload_before_lot_name(p_data);
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(
      coalesce(p_data->'stoneTransformations', '[]'::jsonb)
    ) event_item
    where event_item ? 'lotName'
      and (
        pg_catalog.jsonb_typeof(event_item->'lotName') is distinct from 'string'
        or btrim(coalesce(event_item->>'lotName', '')) = ''
      )
  ) then
    raise exception 'invalid historical stone lot name' using errcode = '22023';
  end if;
end;
$$;

-- La historia fisica sigue inmutable. La unica ampliacion permitida es llenar
-- una vez lotName cuando antes estaba ausente; luego tampoco puede cambiarse.
create or replace function private.assert_stock_transformations_preserved(
  p_id text,
  p_data jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
  v_existing_data jsonb;
  v_existing_events jsonb;
  v_incoming_events jsonb := coalesce(p_data->'stoneTransformations', '[]'::jsonb);
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stock_jewels:' || p_id, 0)
  );
  select jewel.data
  into v_existing_data
  from public.stock_jewels jewel
  where jewel.organization_id = v_organization_id and jewel.id = p_id
  for update;

  if v_existing_data is null then
    if pg_catalog.jsonb_array_length(v_incoming_events) > 0 then
      raise exception 'stock transformations require the protected transformation RPC'
        using errcode = '22023';
    end if;
    return;
  end if;
  v_existing_events := coalesce(v_existing_data->'stoneTransformations', '[]'::jsonb);
  if pg_catalog.jsonb_array_length(v_incoming_events)
       <> pg_catalog.jsonb_array_length(v_existing_events)
     or exists (
       select 1
       from pg_catalog.jsonb_array_elements(v_existing_events) old_event
       left join pg_catalog.jsonb_array_elements(v_incoming_events) new_event
         on new_event->>'id' = old_event->>'id'
       where new_event is null
          or (old_event - 'lotName') is distinct from (new_event - 'lotName')
          or (
            btrim(coalesce(old_event->>'lotName', '')) <> ''
            and old_event->'lotName' is distinct from new_event->'lotName'
          )
     ) then
    raise exception 'stock transformations are immutable outside transformation RPC'
      using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(v_existing_events) > 0
     and p_data->>'stoneKind' <> 'natural' then
    raise exception 'transformed stock jewel classification is immutable'
      using errcode = '22023';
  end if;
  if coalesce(v_existing_data->>'stoneKind', '') = 'natural'
     and coalesce(p_data->>'stoneKind', '') <> 'natural' then
    raise exception 'natural stock jewel classification is immutable'
      using errcode = '22023';
  end if;
  if coalesce(v_existing_data->>'stoneKind', '') = 'fantasia'
     and coalesce(p_data->>'stoneKind', '') = '' then
    raise exception 'fantasia stock jewel cannot become unclassified'
      using errcode = '22023';
  end if;
  if coalesce(v_existing_data->>'stoneKind', '') = 'fantasia'
     and coalesce(p_data->>'stoneKind', '') = 'natural' then
    raise exception 'fantasia to natural requires the protected transformation RPC'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function public.upsert_stock_jewel(
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
  v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
begin
  perform private.assert_stock_jewel_payload(p_id, p_data, p_updated_at);
  perform private.assert_stock_jewel_c2_payload(p_data);
  perform private.assert_stock_transformations_preserved(p_id, p_data);
  insert into public.stock_jewels (id, organization_id, data, updated_at)
  values (p_id, v_organization_id, p_data, p_updated_at)
  on conflict (organization_id, id) do update
  set data = excluded.data, updated_at = excluded.updated_at
  where excluded.updated_at >= public.stock_jewels.updated_at;
end;
$$;

create or replace function public.delete_stone_lot(p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
  v_existing_data jsonb;
  v_lot_name text;
  v_jewel_id text;
  v_effective_updated_at timestamptz := pg_catalog.statement_timestamp();
  v_updated_at_text text;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stone_lots:' || p_id, 0)
  );
  select lot.data
  into v_existing_data
  from public.stone_lots lot
  where lot.organization_id = v_organization_id and lot.id = p_id
  for update;
  if v_existing_data is null then return; end if;
  if v_existing_data ? 'internalUses'
     and pg_catalog.jsonb_typeof(v_existing_data->'internalUses') is distinct from 'array' then
    raise exception 'invalid stone lot internal uses before deletion' using errcode = '22023';
  end if;

  v_lot_name := coalesce(
    nullif(btrim(v_existing_data->>'name'), ''),
    'Lote de ' || coalesce(nullif(btrim(v_existing_data->>'stoneType'), ''), 'piedras')
  );
  v_updated_at_text := pg_catalog.to_char(
    v_effective_updated_at at time zone 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  );

  -- Mismo orden de bloqueo que el resto de C2: lote y luego joyas por id.
  for v_jewel_id in
    select distinct jewel.id
    from public.stock_jewels jewel
    cross join lateral pg_catalog.jsonb_array_elements(
      case
        when pg_catalog.jsonb_typeof(jewel.data->'stoneTransformations') = 'array'
          then jewel.data->'stoneTransformations'
        else '[]'::jsonb
      end
    ) event_item
    where jewel.organization_id = v_organization_id
      and event_item->>'lotId' = p_id
    order by jewel.id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        v_organization_id::text || ':stock_jewels:' || v_jewel_id,
        0
      )
    );
  end loop;

  update public.stock_jewels jewel
  set data = pg_catalog.jsonb_set(
        pg_catalog.jsonb_set(
          jewel.data,
          '{stoneTransformations}',
          (
            select pg_catalog.jsonb_agg(
              case
                when event_item->>'lotId' = p_id
                  then event_item || pg_catalog.jsonb_build_object('lotName', v_lot_name)
                else event_item
              end
              order by item_position
            )
            from pg_catalog.jsonb_array_elements(jewel.data->'stoneTransformations')
              with ordinality as events(event_item, item_position)
          ),
          true
        ),
        '{updatedAt}',
        pg_catalog.to_jsonb(v_updated_at_text),
        true
      ),
      updated_at = v_effective_updated_at
  where jewel.organization_id = v_organization_id
    and pg_catalog.jsonb_typeof(jewel.data->'stoneTransformations') = 'array'
    and exists (
      select 1
      from pg_catalog.jsonb_array_elements(jewel.data->'stoneTransformations') event_item
      where event_item->>'lotId' = p_id
    );

  delete from public.stone_lots
  where organization_id = v_organization_id and id = p_id;
end;
$$;

-- Los respaldos de una joya cuyo lote ya fue eliminado llegan completos y no
-- necesitan reconstruir inventario. Esta puerta sigue limitada a owner/admin.
alter function public.seed_stock_jewel_transformation_import(
  text, jsonb, jsonb, timestamptz
) rename to seed_stock_jewel_transformation_import_before_deleted_lot_history;

create or replace function public.seed_stock_jewel_transformation_import(
  p_id text,
  p_baseline_data jsonb,
  p_final_data jsonb,
  p_updated_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin']);
  v_events jsonb := coalesce(p_baseline_data->'stoneTransformations', '[]'::jsonb);
  v_existing_data jsonb;
begin
  if pg_catalog.jsonb_typeof(v_events) is distinct from 'array'
     or pg_catalog.jsonb_array_length(v_events) = 0 then
    perform public.seed_stock_jewel_transformation_import_before_deleted_lot_history(
      p_id,
      p_baseline_data,
      p_final_data,
      p_updated_at
    );
    return;
  end if;

  perform private.assert_entity_payload('stock jewel', p_id, p_baseline_data, p_updated_at);
  perform private.assert_entity_payload('stock jewel', p_id, p_final_data, p_updated_at);
  perform private.assert_stock_jewel_payload(p_id, p_baseline_data, p_updated_at);
  perform private.assert_stock_jewel_c2_payload(p_baseline_data);
  if p_baseline_data is distinct from p_final_data then
    raise exception 'deleted-lot jewel import baseline must already be final'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(v_events) event_item
    where btrim(coalesce(event_item->>'lotName', '')) = ''
       or exists (
         select 1
         from public.stone_lots lot
         where lot.organization_id = v_organization_id
           and lot.id = event_item->>'lotId'
       )
  ) then
    raise exception 'deleted-lot jewel import requires a name and an absent lot'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stock_jewels:' || p_id, 0)
  );
  select jewel.data
  into v_existing_data
  from public.stock_jewels jewel
  where jewel.organization_id = v_organization_id and jewel.id = p_id
  for update;

  if v_existing_data is null then
    insert into public.stock_jewels (id, organization_id, data, updated_at)
    values (p_id, v_organization_id, p_baseline_data, p_updated_at);
    return;
  end if;
  if (v_existing_data - 'updatedAt')
       is distinct from (p_baseline_data - 'updatedAt') then
    raise exception 'deleted-lot jewel import collides with another record or edit'
      using errcode = '22023';
  end if;
end;
$$;

revoke all on function private.assert_stock_jewel_c2_payload_before_lot_name(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_stock_jewel_c2_payload(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_stock_transformations_preserved(text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.upsert_stock_jewel(text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.delete_stone_lot(text)
  from public, anon, authenticated, service_role;
revoke all on function public.seed_stock_jewel_transformation_import_before_deleted_lot_history(
  text, jsonb, jsonb, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.seed_stock_jewel_transformation_import(
  text, jsonb, jsonb, timestamptz
) from public, anon, authenticated, service_role;

grant execute on function public.upsert_stock_jewel(text, jsonb, timestamptz)
  to authenticated;
grant execute on function public.delete_stone_lot(text) to authenticated;
grant execute on function public.seed_stock_jewel_transformation_import(
  text, jsonb, jsonb, timestamptz
) to authenticated;
