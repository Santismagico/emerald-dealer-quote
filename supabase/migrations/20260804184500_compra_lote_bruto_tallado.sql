-- Correccion Santiago C2: cada lote declara si se compro en bruto o ya tallado.
-- Migracion aditiva: el campo ausente conserva exactamente el significado
-- historico de bruto. No cambia tablas, RLS ni datos guardados.

alter function private.assert_stone_lot_cutting_payload(text, jsonb, timestamptz)
  rename to assert_stone_lot_cutting_payload_before_purchase_origin;

alter function private.assert_stone_lot_internal_uses_payload(jsonb)
  rename to assert_stone_lot_internal_uses_payload_before_purchase_origin;

create or replace function private.has_nonempty_jsonb_array(p_value jsonb)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when pg_catalog.jsonb_typeof(p_value) = 'array'
      then pg_catalog.jsonb_array_length(p_value) > 0
    else false
  end;
$$;

create or replace function private.stone_lot_inventory_payload_for_purchase_origin(
  p_data jsonb
)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_data jsonb := p_data;
  v_origin text := coalesce(p_data->>'purchaseOrigin', 'bruto');
begin
  if v_origin <> 'tallado' then
    return v_data;
  end if;

  -- Las validaciones C1/C2 anteriores entienden lo tallado como el regreso de
  -- una tanda. Esta tanda virtual existe solo durante la validacion: nunca se
  -- guarda ni aparece en el historial del usuario.
  if private.is_nonnegative_number(p_data->'carats')
     and private.is_nonnegative_integer(p_data->'quantity') then
    if (p_data->>'carats')::numeric > 0 and (p_data->>'quantity')::numeric > 0 then
      v_data := pg_catalog.jsonb_set(
        p_data,
        '{cuttingBatches}',
        pg_catalog.jsonb_build_array(
          pg_catalog.jsonb_build_object(
            'id', '__purchase_tallado__',
            'sentDate', p_data->>'purchaseDate',
            'sentCarats', p_data->'carats',
            'sentQuantity', p_data->'quantity',
            'returnedDate', p_data->>'purchaseDate',
            'returnedCarats', p_data->'carats',
            'returnedQuantity', p_data->'quantity',
            'cuttingCostCop', 0,
            'cuttingPaidDate', '',
            'notes', ''
          )
        ),
        true
      );
    end if;
  end if;
  return v_data;
end;
$$;

create or replace function private.assert_stone_lot_cutting_payload(
  p_id text,
  p_data jsonb,
  p_updated_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
  v_existing_data jsonb;
  v_origin text;
  v_existing_origin text;
  v_inventory_data jsonb;
begin
  if pg_catalog.jsonb_typeof(p_data) is distinct from 'object' then
    raise exception 'invalid stone lot purchase origin payload' using errcode = '22023';
  end if;
  if p_data ? 'purchaseOrigin'
     and (
       pg_catalog.jsonb_typeof(p_data->'purchaseOrigin') is distinct from 'string'
       or coalesce(p_data->>'purchaseOrigin', '') not in ('bruto', 'tallado')
     ) then
    raise exception 'invalid stone lot purchase origin' using errcode = '22023';
  end if;
  v_origin := coalesce(p_data->>'purchaseOrigin', 'bruto');

  if v_origin = 'tallado'
     and p_data ? 'cuttingBatches'
     and (
       pg_catalog.jsonb_typeof(p_data->'cuttingBatches') is distinct from 'array'
       or private.has_nonempty_jsonb_array(p_data->'cuttingBatches')
     ) then
    raise exception 'purchased cut stone lot cannot have cutting batches'
      using errcode = '22023';
  end if;

  v_inventory_data := private.stone_lot_inventory_payload_for_purchase_origin(p_data);
  perform private.assert_stone_lot_cutting_payload_before_purchase_origin(
    p_id,
    v_inventory_data,
    p_updated_at
  );

  -- La validacion anterior deja bloqueada la fila hasta finalizar la escritura.
  select lot.data
  into v_existing_data
  from public.stone_lots lot
  where lot.organization_id = v_organization_id and lot.id = p_id;

  if v_existing_data is not null then
    v_existing_origin := coalesce(v_existing_data->>'purchaseOrigin', 'bruto');
    if v_existing_origin <> v_origin
       and (
         private.has_nonempty_jsonb_array(v_existing_data->'sales')
         or private.has_nonempty_jsonb_array(v_existing_data->'cuttingBatches')
         or private.has_nonempty_jsonb_array(v_existing_data->'internalUses')
         or private.has_nonempty_jsonb_array(p_data->'sales')
         or private.has_nonempty_jsonb_array(p_data->'cuttingBatches')
         or private.has_nonempty_jsonb_array(p_data->'internalUses')
       ) then
      raise exception 'stone lot purchase origin is immutable after inventory movements'
        using errcode = '22023';
    end if;
  end if;
end;
$$;

create or replace function private.assert_stone_lot_internal_uses_payload(
  p_data jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_inventory_data jsonb;
  v_origin text;
begin
  if pg_catalog.jsonb_typeof(p_data) is distinct from 'object' then
    raise exception 'invalid stone lot purchase origin payload' using errcode = '22023';
  end if;
  if p_data ? 'purchaseOrigin'
     and (
       pg_catalog.jsonb_typeof(p_data->'purchaseOrigin') is distinct from 'string'
       or coalesce(p_data->>'purchaseOrigin', '') not in ('bruto', 'tallado')
     ) then
    raise exception 'invalid stone lot purchase origin' using errcode = '22023';
  end if;
  v_origin := coalesce(p_data->>'purchaseOrigin', 'bruto');
  if v_origin = 'tallado'
     and p_data ? 'cuttingBatches'
     and (
       pg_catalog.jsonb_typeof(p_data->'cuttingBatches') is distinct from 'array'
       or private.has_nonempty_jsonb_array(p_data->'cuttingBatches')
     ) then
    raise exception 'purchased cut stone lot cannot have cutting batches'
      using errcode = '22023';
  end if;
  v_inventory_data := private.stone_lot_inventory_payload_for_purchase_origin(p_data);
  perform private.assert_stone_lot_internal_uses_payload_before_purchase_origin(
    v_inventory_data
  );
end;
$$;

-- Recompila el punto de escritura para que siempre use las dos envolturas C2.
create or replace function public.upsert_stone_lot(
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
  perform private.assert_stone_lot_payload(p_id, p_data, p_updated_at);
  perform private.assert_stone_lot_cutting_payload(p_id, p_data, p_updated_at);
  perform private.assert_stone_lot_internal_uses_payload(p_data);
  perform private.assert_stone_internal_uses_preserved(p_id, p_data);
  insert into public.stone_lots (id, organization_id, data, updated_at)
  values (p_id, v_organization_id, p_data, p_updated_at)
  on conflict (organization_id, id) do update
  set data = excluded.data, updated_at = excluded.updated_at
  where excluded.updated_at >= public.stone_lots.updated_at;
end;
$$;

revoke all on function private.has_nonempty_jsonb_array(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.stone_lot_inventory_payload_for_purchase_origin(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_stone_lot_cutting_payload_before_purchase_origin(
  text, jsonb, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function private.assert_stone_lot_internal_uses_payload_before_purchase_origin(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_stone_lot_cutting_payload(text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_stone_lot_internal_uses_payload(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.upsert_stone_lot(text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.upsert_stone_lot(text, jsonb, timestamptz) to authenticated;
