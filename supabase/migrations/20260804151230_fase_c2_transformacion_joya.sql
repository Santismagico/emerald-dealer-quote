-- Fase C2: transformar una joya de fantasia a natural como una sola operacion.
--
-- No crea tablas ni modifica RLS. La RPC protegida resuelve la organizacion,
-- bloquea lote y joya, calcula el costo en el servidor y actualiza ambos JSON
-- dentro de la misma transaccion. El mismo id queda en internalUses y en
-- stoneTransformations para que un reintento sea idempotente.

-- ---------------------------------------------------------------------------
-- 1. Forma e inventario de los usos internos embebidos en StoneLot.
-- ---------------------------------------------------------------------------

create or replace function private.assert_stone_lot_internal_uses_payload(
  p_data jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uses jsonb;
  v_batches jsonb;
  v_sales jsonb;
  v_purchase_carats numeric;
  v_purchase_quantity numeric;
  v_sent_carats numeric;
  v_sent_quantity numeric;
  v_returned_carats numeric;
  v_returned_quantity numeric;
  v_raw_sold_carats numeric;
  v_raw_sold_quantity numeric;
  v_cut_sold_carats numeric;
  v_cut_sold_quantity numeric;
  v_raw_used_carats numeric;
  v_raw_used_quantity numeric;
  v_cut_used_carats numeric;
  v_cut_used_quantity numeric;
begin
  if jsonb_typeof(p_data) is distinct from 'object'
     or jsonb_typeof(p_data->'sales') is distinct from 'array'
     or (p_data ? 'cuttingBatches'
         and jsonb_typeof(p_data->'cuttingBatches') is distinct from 'array')
     or not private.is_nonnegative_number(p_data->'carats')
     or not private.is_nonnegative_integer(p_data->'quantity') then
    raise exception 'invalid stone lot internal-use payload' using errcode = '22023';
  end if;

  if p_data ? 'internalUses' then
    if jsonb_typeof(p_data->'internalUses') is distinct from 'array' then
      raise exception 'invalid stone internal uses' using errcode = '22023';
    end if;
    v_uses := p_data->'internalUses';
  else
    v_uses := '[]'::jsonb;
  end if;
  v_batches := coalesce(p_data->'cuttingBatches', '[]'::jsonb);
  v_sales := p_data->'sales';

  if exists (
    select 1
    from jsonb_array_elements(v_uses) use_item
    where jsonb_typeof(use_item) is distinct from 'object'
       or not private.is_nonblank_string(use_item->'id')
       or not private.is_iso_date(use_item->'date')
       or not private.is_nonnegative_number(use_item->'carats')
       or not private.is_nonnegative_integer(use_item->'quantity')
       or jsonb_typeof(use_item->'origin') is distinct from 'string'
       or coalesce(use_item->>'origin', '') not in ('bruto', 'tallado')
       or not private.is_nonblank_string(use_item->'jewelId')
       or not private.is_nonnegative_integer(use_item->'costCop')
       or jsonb_typeof(use_item->'notes') is distinct from 'string'
  ) then
    raise exception 'invalid stone internal use' using errcode = '22023';
  end if;

  -- Los casts ocurren solo despues de validar los tipos.
  if exists (
    select 1
    from jsonb_array_elements(v_uses) use_item
    where (use_item->>'carats')::numeric <= 0
       or (use_item->>'quantity')::numeric <= 0
       or (use_item->>'costCop')::numeric > 9007199254740991
       or (use_item->>'carats')::numeric
          <> round((use_item->>'carats')::numeric, 3)
  ) then
    raise exception 'stone internal use requires carats and quantity' using errcode = '22023';
  end if;

  if jsonb_array_length(v_uses) > 0
     and not private.is_iso_date(p_data->'purchaseDate') then
    raise exception 'stone internal use requires a valid lot purchase date'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(v_uses) use_item
    where use_item->>'date' < p_data->>'purchaseDate'
  ) then
    raise exception 'stone internal use cannot predate lot purchase'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_uses) use_item
    group by btrim(use_item->>'id')
    having count(*) > 1
  ) then
    raise exception 'duplicate stone internal-use event' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(v_uses) use_item
    group by btrim(use_item->>'jewelId')
    having count(*) > 1
  ) then
    raise exception 'stock jewel already consumed a natural stone' using errcode = '22023';
  end if;

  v_purchase_carats := (p_data->>'carats')::numeric;
  v_purchase_quantity := (p_data->>'quantity')::numeric;

  select
    coalesce(sum((batch->>'sentCarats')::numeric), 0),
    coalesce(sum((batch->>'sentQuantity')::numeric), 0),
    coalesce(sum(case when coalesce(batch->>'returnedDate', '') <> ''
      then (batch->>'returnedCarats')::numeric else 0 end), 0),
    coalesce(sum(case when coalesce(batch->>'returnedDate', '') <> ''
      then (batch->>'returnedQuantity')::numeric else 0 end), 0)
  into v_sent_carats, v_sent_quantity, v_returned_carats, v_returned_quantity
  from jsonb_array_elements(v_batches) batch;

  select
    coalesce(sum(case when coalesce(sale->>'origin', 'bruto') = 'bruto'
      then (sale->>'carats')::numeric else 0 end), 0),
    coalesce(sum(case when coalesce(sale->>'origin', 'bruto') = 'bruto'
      then (sale->>'quantity')::numeric else 0 end), 0),
    coalesce(sum(case when sale->>'origin' = 'tallado'
      then (sale->>'carats')::numeric else 0 end), 0),
    coalesce(sum(case when sale->>'origin' = 'tallado'
      then (sale->>'quantity')::numeric else 0 end), 0)
  into v_raw_sold_carats, v_raw_sold_quantity, v_cut_sold_carats, v_cut_sold_quantity
  from jsonb_array_elements(v_sales) sale;

  select
    coalesce(sum(case when use_item->>'origin' = 'bruto'
      then (use_item->>'carats')::numeric else 0 end), 0),
    coalesce(sum(case when use_item->>'origin' = 'bruto'
      then (use_item->>'quantity')::numeric else 0 end), 0),
    coalesce(sum(case when use_item->>'origin' = 'tallado'
      then (use_item->>'carats')::numeric else 0 end), 0),
    coalesce(sum(case when use_item->>'origin' = 'tallado'
      then (use_item->>'quantity')::numeric else 0 end), 0)
  into v_raw_used_carats, v_raw_used_quantity, v_cut_used_carats, v_cut_used_quantity
  from jsonb_array_elements(v_uses) use_item;

  if round(
       v_purchase_carats
       - round(v_sent_carats, 3)
       - round(v_raw_sold_carats, 3)
       - round(v_raw_used_carats, 3),
       3
     ) < 0
     or v_purchase_quantity - v_sent_quantity - v_raw_sold_quantity - v_raw_used_quantity < 0 then
    raise exception 'stone internal uses exceed raw inventory' using errcode = '22023';
  end if;
  if round(
       round(v_returned_carats, 3)
       - round(v_cut_sold_carats, 3)
       - round(v_cut_used_carats, 3),
       3
     ) < 0
     or v_returned_quantity - v_cut_sold_quantity - v_cut_used_quantity < 0 then
    raise exception 'stone internal uses exceed cut inventory' using errcode = '22023';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Forma del historial C2 embebido en StockJewel.
-- ---------------------------------------------------------------------------

create or replace function private.assert_stock_jewel_c2_payload(
  p_data jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_events jsonb;
  v_event_cost numeric;
begin
  if jsonb_typeof(p_data) is distinct from 'object' then
    raise exception 'invalid stock jewel C2 payload' using errcode = '22023';
  end if;
  if (p_data ? 'weightGrams' and not private.is_nonnegative_number(p_data->'weightGrams'))
     or (p_data ? 'size' and jsonb_typeof(p_data->'size') is distinct from 'string')
     or (p_data ? 'stoneCount' and not private.is_nonnegative_integer(p_data->'stoneCount'))
     or (p_data ? 'stoneKind'
         and (
           jsonb_typeof(p_data->'stoneKind') is distinct from 'string'
           or coalesce(p_data->>'stoneKind', '') not in ('', 'fantasia', 'natural')
         )) then
    raise exception 'invalid stock jewel C2 fields' using errcode = '22023';
  end if;

  if p_data ? 'stoneTransformations' then
    if jsonb_typeof(p_data->'stoneTransformations') is distinct from 'array' then
      raise exception 'invalid stock jewel transformations' using errcode = '22023';
    end if;
    v_events := p_data->'stoneTransformations';
  else
    v_events := '[]'::jsonb;
  end if;

  if jsonb_array_length(v_events) > 1 then
    raise exception 'stock jewel cannot be transformed twice' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(v_events) event_item
    where jsonb_typeof(event_item) is distinct from 'object'
       or not private.is_nonblank_string(event_item->'id')
       or not private.is_iso_date(event_item->'date')
       or not private.is_nonblank_string(event_item->'lotId')
       or not private.is_nonblank_string(event_item->'jewelId')
       or event_item->>'jewelId' <> p_data->>'id'
       or jsonb_typeof(event_item->'origin') is distinct from 'string'
       or coalesce(event_item->>'origin', '') not in ('bruto', 'tallado')
       or not private.is_nonnegative_number(event_item->'carats')
       or not private.is_nonnegative_integer(event_item->'quantity')
       or not private.is_nonnegative_integer(event_item->'costCop')
       or jsonb_typeof(event_item->'notes') is distinct from 'string'
       or event_item->>'fromStoneKind' <> 'fantasia'
       or event_item->>'toStoneKind' <> 'natural'
  ) then
    raise exception 'invalid stock jewel transformation' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(v_events) event_item
    where (event_item->>'carats')::numeric <= 0
       or (event_item->>'quantity')::numeric <= 0
       or (event_item->>'costCop')::numeric > 9007199254740991
       or (event_item->>'carats')::numeric
          <> round((event_item->>'carats')::numeric, 3)
  ) then
    raise exception 'stock jewel transformation requires carats and quantity'
      using errcode = '22023';
  end if;

  if jsonb_array_length(v_events) > 0
     and not private.is_iso_date(p_data->'acquiredDate') then
    raise exception 'stock jewel transformation requires a valid acquisition date'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(v_events) event_item
    where event_item->>'date' < p_data->>'acquiredDate'
  ) then
    raise exception 'stock jewel transformation cannot predate acquisition'
      using errcode = '22023';
  end if;

  if jsonb_array_length(v_events) > 0
     and coalesce(jsonb_typeof(p_data->'sale'), 'null') <> 'null' then
    if jsonb_typeof(p_data->'sale') is distinct from 'object'
       or not private.is_iso_date(p_data->'sale'->'date') then
      raise exception 'stock jewel transformation requires a valid sale date'
        using errcode = '22023';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(v_events) event_item
      where event_item->>'date' > p_data->'sale'->>'date'
    ) then
      raise exception 'stock jewel transformation cannot postdate sale'
        using errcode = '22023';
    end if;
  end if;

  if jsonb_array_length(v_events) > 0 then
    if coalesce(p_data->>'stoneKind', '') <> 'natural' then
      raise exception 'transformed stock jewel must remain natural' using errcode = '22023';
    end if;
    select coalesce(sum((event_item->>'costCop')::numeric), 0)
    into v_event_cost
    from jsonb_array_elements(v_events) event_item;
    if not private.is_nonnegative_integer(p_data->'costCop')
       or (p_data->>'costCop')::numeric > 9007199254740991
       or (p_data->>'costCop')::numeric < v_event_cost then
      raise exception 'stock jewel cost lost its natural-stone transfer' using errcode = '22023';
    end if;
    if not private.is_nonnegative_integer(p_data->'stoneCount')
       or (p_data->>'stoneCount')::numeric
          <> (v_events->0->>'quantity')::numeric then
      raise exception 'stock jewel stone count differs from transformation'
        using errcode = '22023';
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Los upserts normales solo pueden conservar historia C2, nunca crearla,
--    editarla ni borrarla. La unica puerta de creacion es la RPC compuesta.
-- ---------------------------------------------------------------------------

create or replace function private.assert_stone_internal_uses_preserved(
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
  v_existing_uses jsonb;
  v_incoming_uses jsonb := coalesce(p_data->'internalUses', '[]'::jsonb);
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stone_lots:' || p_id, 0)
  );
  select lot.data
  into v_existing_data
  from public.stone_lots lot
  where lot.organization_id = v_organization_id and lot.id = p_id
  for update;

  if v_existing_data is null then
    if jsonb_array_length(v_incoming_uses) > 0 then
      raise exception 'stone internal uses require the protected transformation RPC'
        using errcode = '22023';
    end if;
    return;
  end if;
  v_existing_uses := coalesce(v_existing_data->'internalUses', '[]'::jsonb);
  if v_incoming_uses is distinct from v_existing_uses then
    raise exception 'stone internal uses are immutable outside transformation RPC'
      using errcode = '22023';
  end if;

  -- Si una piedra tallada ya entro a una joya, los datos fisicos de la tanda
  -- que la produjo quedan congelados. Costo, pago y notas siguen editables.
  if exists (
       select 1
       from jsonb_array_elements(v_existing_uses) use_item
       where use_item->>'origin' = 'tallado'
     )
     and exists (
       select 1
       from jsonb_array_elements(
         coalesce(v_existing_data->'cuttingBatches', '[]'::jsonb)
       ) old_batch
       left join jsonb_array_elements(
         coalesce(p_data->'cuttingBatches', '[]'::jsonb)
       ) new_batch on new_batch->>'id' = old_batch->>'id'
       where coalesce(old_batch->>'returnedDate', '') <> ''
         and (
           new_batch is null
           or jsonb_build_object(
             'id', old_batch->'id',
             'sentDate', old_batch->'sentDate',
             'sentCarats', old_batch->'sentCarats',
             'sentQuantity', old_batch->'sentQuantity',
             'returnedDate', old_batch->'returnedDate',
             'returnedCarats', old_batch->'returnedCarats',
             'returnedQuantity', old_batch->'returnedQuantity'
           ) is distinct from jsonb_build_object(
             'id', new_batch->'id',
             'sentDate', new_batch->'sentDate',
             'sentCarats', new_batch->'sentCarats',
             'sentQuantity', new_batch->'sentQuantity',
             'returnedDate', new_batch->'returnedDate',
             'returnedCarats', new_batch->'returnedCarats',
             'returnedQuantity', new_batch->'returnedQuantity'
           )
         )
     ) then
    raise exception 'returned cutting inventory is immutable after an internal use'
      using errcode = '22023';
  end if;
end;
$$;

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
    if jsonb_array_length(v_incoming_events) > 0 then
      raise exception 'stock transformations require the protected transformation RPC'
        using errcode = '22023';
    end if;
    return;
  end if;
  v_existing_events := coalesce(v_existing_data->'stoneTransformations', '[]'::jsonb);
  if v_incoming_events is distinct from v_existing_events then
    raise exception 'stock transformations are immutable outside transformation RPC'
      using errcode = '22023';
  end if;
  if jsonb_array_length(v_existing_events) > 0
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

-- Conserva las firmas publicas existentes y agrega la defensa C2.
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

-- ---------------------------------------------------------------------------
-- 4. RPC compuesta. El costo nunca se recibe del cliente.
-- ---------------------------------------------------------------------------

create or replace function public.transform_stock_jewel_to_natural(
  p_event_id text,
  p_date text,
  p_lot_id text,
  p_jewel_id text,
  p_origin text,
  p_carats numeric,
  p_quantity integer,
  p_notes text,
  p_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
  v_lot_data jsonb;
  v_jewel_data jsonb;
  v_lot_updated_at timestamptz;
  v_jewel_updated_at timestamptz;
  v_effective_updated_at timestamptz;
  v_updated_at_text text;
  v_uses jsonb;
  v_events jsonb;
  v_existing_use jsonb;
  v_existing_event jsonb;
  v_use_count bigint;
  v_event_count bigint;
  v_purchase_millicarats numeric;
  v_consumed_millicarats numeric;
  v_paid_cutting_cost numeric;
  v_total_invested numeric;
  v_attributed_cost numeric;
  v_jewel_cost numeric;
  v_registered_stone_count numeric;
  v_use jsonb;
  v_event jsonb;
  v_new_lot_data jsonb;
  v_new_jewel_data jsonb;
begin
  perform private.assert_updated_at(p_updated_at);
  if p_event_id is null or char_length(btrim(p_event_id)) not between 1 and 200
     or p_lot_id is null or char_length(btrim(p_lot_id)) not between 1 and 200
     or p_jewel_id is null or char_length(btrim(p_jewel_id)) not between 1 and 200
     or not private.is_iso_date(to_jsonb(p_date))
     or p_origin is null or p_origin not in ('bruto', 'tallado')
     or p_carats is null or p_carats <= 0
     or p_carats = 'NaN'::numeric
     or p_carats <> round(p_carats, 3)
     or p_quantity is null or p_quantity <= 0 then
    raise exception 'invalid stock jewel transformation request' using errcode = '22023';
  end if;

  -- Un mismo event id se serializa globalmente dentro de la organizacion.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_organization_id::text || ':stock_transform_events:' || p_event_id,
      0
    )
  );
  -- Orden fijo para evitar interbloqueos: lote primero, joya despues.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stone_lots:' || p_lot_id, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stock_jewels:' || p_jewel_id, 0)
  );

  select lot.data, lot.updated_at
  into v_lot_data, v_lot_updated_at
  from public.stone_lots lot
  where lot.organization_id = v_organization_id and lot.id = p_lot_id
  for update;
  if v_lot_data is null then
    raise exception 'stone lot not found for current organization' using errcode = '22023';
  end if;

  select jewel.data, jewel.updated_at
  into v_jewel_data, v_jewel_updated_at
  from public.stock_jewels jewel
  where jewel.organization_id = v_organization_id and jewel.id = p_jewel_id
  for update;
  if v_jewel_data is null then
    raise exception 'stock jewel not found for current organization' using errcode = '22023';
  end if;

  -- Confirma que el estado de partida sigue siendo valido antes de usarlo.
  perform private.assert_stone_lot_payload(p_lot_id, v_lot_data, p_updated_at);
  perform private.assert_stone_lot_cutting_payload(p_lot_id, v_lot_data, p_updated_at);
  perform private.assert_stone_lot_internal_uses_payload(v_lot_data);
  perform private.assert_stock_jewel_payload(p_jewel_id, v_jewel_data, p_updated_at);
  perform private.assert_stock_jewel_c2_payload(v_jewel_data);

  if not private.is_iso_date(v_lot_data->'purchaseDate')
     or p_date < v_lot_data->>'purchaseDate' then
    raise exception 'stock jewel transformation cannot predate lot purchase'
      using errcode = '22023';
  end if;
  if not private.is_iso_date(v_jewel_data->'acquiredDate')
     or p_date < v_jewel_data->>'acquiredDate' then
    raise exception 'stock jewel transformation cannot predate acquisition'
      using errcode = '22023';
  end if;

  v_uses := coalesce(v_lot_data->'internalUses', '[]'::jsonb);
  v_events := coalesce(v_jewel_data->'stoneTransformations', '[]'::jsonb);

  -- Busca el event id en toda la organizacion. El advisory lock anterior hace
  -- que dos solicitudes simultaneas no puedan reutilizarlo en entidades distintas.
  select count(*)
  into v_use_count
  from public.stone_lots lot
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(lot.data->'internalUses') = 'array'
      then lot.data->'internalUses' else '[]'::jsonb end
  ) use_item
  where lot.organization_id = v_organization_id
    and use_item->>'id' = p_event_id;

  select count(*)
  into v_event_count
  from public.stock_jewels jewel
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(jewel.data->'stoneTransformations') = 'array'
      then jewel.data->'stoneTransformations' else '[]'::jsonb end
  ) event_item
  where jewel.organization_id = v_organization_id
    and event_item->>'id' = p_event_id;

  select use_item
  into v_existing_use
  from jsonb_array_elements(v_uses) use_item
  where use_item->>'id' = p_event_id;

  select event_item
  into v_existing_event
  from jsonb_array_elements(v_events) event_item
  where event_item->>'id' = p_event_id;

  if v_use_count > 1 or v_event_count > 1
     or (v_use_count > 0 and v_existing_use is null)
     or (v_event_count > 0 and v_existing_event is null) then
    raise exception 'transformation event id already belongs to another record'
      using errcode = '22023';
  end if;

  -- Reintento exacto: ambas mitades ya existen y se devuelve exito sin sumar dos veces.
  if v_existing_use is not null or v_existing_event is not null then
    if v_existing_use is null or v_existing_event is null
       or v_existing_use->>'date' <> p_date
       or v_existing_use->>'jewelId' <> p_jewel_id
       or v_existing_use->>'origin' <> p_origin
       or (v_existing_use->>'carats')::numeric is distinct from p_carats
       or (v_existing_use->>'quantity')::integer is distinct from p_quantity
       or coalesce(v_existing_use->>'notes', '') <> coalesce(p_notes, '')
       or v_existing_event->>'date' <> p_date
       or v_existing_event->>'lotId' <> p_lot_id
       or v_existing_event->>'jewelId' <> p_jewel_id
       or v_existing_event->>'origin' <> p_origin
       or (v_existing_event->>'carats')::numeric is distinct from p_carats
       or (v_existing_event->>'quantity')::integer is distinct from p_quantity
       or coalesce(v_existing_event->>'notes', '') <> coalesce(p_notes, '')
       or v_existing_event->>'fromStoneKind' <> 'fantasia'
       or v_existing_event->>'toStoneKind' <> 'natural'
       or v_existing_use->'costCop' is distinct from v_existing_event->'costCop'
       or v_jewel_data->>'stoneKind' <> 'natural' then
      raise exception 'transformation event id was reused with different data'
        using errcode = '22023';
    end if;
    return jsonb_build_object('lot', v_lot_data, 'jewel', v_jewel_data);
  end if;

  if coalesce(v_jewel_data->>'stoneKind', '') <> 'fantasia' then
    raise exception 'only a fantasia stock jewel can become natural' using errcode = '22023';
  end if;
  if jsonb_typeof(v_jewel_data->'sale') = 'object' then
    raise exception 'a sold stock jewel cannot be transformed' using errcode = '22023';
  end if;

  v_registered_stone_count := coalesce((v_jewel_data->>'stoneCount')::numeric, 0);
  if v_registered_stone_count > 0 and v_registered_stone_count <> p_quantity then
    raise exception 'natural stone quantity differs from stock jewel stone count'
      using errcode = '22023';
  end if;

  -- Replica el calculo local en milesimas de quilate para que ambos lados
  -- atribuyan exactamente el mismo entero COP.
  v_purchase_millicarats := round((v_lot_data->>'carats')::numeric * 1000);
  v_consumed_millicarats := round(p_carats * 1000);
  if v_purchase_millicarats <= 0 or v_consumed_millicarats <= 0 then
    raise exception 'stone lot has no carats for cost attribution' using errcode = '22023';
  end if;
  select coalesce(sum((batch->>'cuttingCostCop')::numeric), 0)
  into v_paid_cutting_cost
  from jsonb_array_elements(coalesce(v_lot_data->'cuttingBatches', '[]'::jsonb)) batch
  where coalesce(batch->>'cuttingPaidDate', '') <> '';

  v_total_invested := (v_lot_data->>'purchaseValueCop')::numeric + v_paid_cutting_cost;
  v_attributed_cost := round(
    (v_total_invested * v_consumed_millicarats) / v_purchase_millicarats
  );
  v_jewel_cost := (v_jewel_data->>'costCop')::numeric;
  if v_attributed_cost < 0
     or trunc(v_attributed_cost) <> v_attributed_cost
     or v_attributed_cost > 9007199254740991
     or v_jewel_cost < 0
     or trunc(v_jewel_cost) <> v_jewel_cost
     or v_jewel_cost > 9007199254740991
     or v_jewel_cost + v_attributed_cost > 9007199254740991 then
    raise exception 'stock jewel transformation cost exceeds safe COP range'
      using errcode = '22023';
  end if;

  v_use := jsonb_build_object(
    'id', p_event_id,
    'date', p_date,
    'carats', p_carats,
    'quantity', p_quantity,
    'origin', p_origin,
    'jewelId', p_jewel_id,
    'costCop', v_attributed_cost,
    'notes', coalesce(p_notes, '')
  );
  v_event := jsonb_build_object(
    'id', p_event_id,
    'date', p_date,
    'lotId', p_lot_id,
    'jewelId', p_jewel_id,
    'origin', p_origin,
    'carats', p_carats,
    'quantity', p_quantity,
    'costCop', v_attributed_cost,
    'notes', coalesce(p_notes, ''),
    'fromStoneKind', 'fantasia',
    'toStoneKind', 'natural'
  );

  v_effective_updated_at := greatest(p_updated_at, v_lot_updated_at, v_jewel_updated_at);
  v_updated_at_text := to_char(
    v_effective_updated_at at time zone 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  );

  v_new_lot_data := jsonb_set(
    v_lot_data,
    '{internalUses}',
    v_uses || jsonb_build_array(v_use),
    true
  );
  v_new_lot_data := jsonb_set(
    v_new_lot_data,
    '{updatedAt}',
    to_jsonb(v_updated_at_text),
    true
  );

  v_new_jewel_data := jsonb_set(
    v_jewel_data,
    '{stoneTransformations}',
    v_events || jsonb_build_array(v_event),
    true
  );
  v_new_jewel_data := jsonb_set(v_new_jewel_data, '{stoneKind}', '"natural"'::jsonb, true);
  v_new_jewel_data := jsonb_set(v_new_jewel_data, '{stoneCount}', to_jsonb(p_quantity), true);
  v_new_jewel_data := jsonb_set(
    v_new_jewel_data,
    '{costCop}',
    to_jsonb(v_jewel_cost + v_attributed_cost),
    true
  );
  v_new_jewel_data := jsonb_set(
    v_new_jewel_data,
    '{updatedAt}',
    to_jsonb(v_updated_at_text),
    true
  );

  -- Vuelve a validar el estado FINAL antes de tocar cualquiera de las dos filas.
  perform private.assert_stone_lot_payload(p_lot_id, v_new_lot_data, v_effective_updated_at);
  perform private.assert_stone_lot_cutting_payload(
    p_lot_id,
    v_new_lot_data,
    v_effective_updated_at
  );
  perform private.assert_stone_lot_internal_uses_payload(v_new_lot_data);
  perform private.assert_stock_jewel_payload(
    p_jewel_id,
    v_new_jewel_data,
    v_effective_updated_at
  );
  perform private.assert_stock_jewel_c2_payload(v_new_jewel_data);

  update public.stone_lots
  set data = v_new_lot_data, updated_at = v_effective_updated_at
  where organization_id = v_organization_id and id = p_lot_id;

  update public.stock_jewels
  set data = v_new_jewel_data, updated_at = v_effective_updated_at
  where organization_id = v_organization_id and id = p_jewel_id;

  return jsonb_build_object('lot', v_new_lot_data, 'jewel', v_new_jewel_data);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Restauracion protegida. Solo owner/admin pueden reconstruir el costo
--    historico exacto de una transformacion importada. La RPC normal conserva
--    la autoridad sobre inventario, estados, bloqueos y la escritura inicial.
-- ---------------------------------------------------------------------------

create or replace function public.restore_stock_jewel_transformation(
  p_event_id text,
  p_date text,
  p_lot_id text,
  p_jewel_id text,
  p_origin text,
  p_carats numeric,
  p_quantity integer,
  p_notes text,
  p_updated_at timestamptz,
  p_cost_cop numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin']);
  v_existed_before boolean;
  v_lot_data jsonb;
  v_jewel_data jsonb;
  v_lot_updated_at timestamptz;
  v_jewel_updated_at timestamptz;
  v_existing_use jsonb;
  v_existing_event jsonb;
  v_uses jsonb;
  v_events jsonb;
  v_calculated_cost numeric;
  v_cost_delta numeric;
  v_new_jewel_cost numeric;
  v_new_lot_data jsonb;
  v_new_jewel_data jsonb;
begin
  if p_event_id is null or char_length(btrim(p_event_id)) not between 1 and 200
     or p_cost_cop is null or p_cost_cop < 0
     or p_cost_cop = 'NaN'::numeric
     or p_cost_cop > 9007199254740991
     or trunc(p_cost_cop) <> p_cost_cop then
    raise exception 'invalid stock jewel transformation restoration'
      using errcode = '22023';
  end if;

  -- La comprobacion "ya existia" debe quedar bajo el mismo lock del event id.
  -- Sin esto, dos restauraciones simultaneas podrian leer ambas "nuevo" y la
  -- segunda alcanzaria a reemplazar un costo historico ya confirmado.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_organization_id::text || ':stock_transform_events:' || p_event_id,
      0
    )
  );

  -- Conserva el mismo orden de la RPC normal: evento, lote y joya. Al tomar
  -- tambien las filas antes de transformar, ningun otro equipo puede editar
  -- la base sembrada entre la comprobacion del corte y la escritura atomica.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stone_lots:' || p_lot_id, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stock_jewels:' || p_jewel_id, 0)
  );

  select lot.data, lot.updated_at
  into v_lot_data, v_lot_updated_at
  from public.stone_lots lot
  where lot.organization_id = v_organization_id and lot.id = p_lot_id
  for update;

  select jewel.data, jewel.updated_at
  into v_jewel_data, v_jewel_updated_at
  from public.stock_jewels jewel
  where jewel.organization_id = v_organization_id and jewel.id = p_jewel_id
  for update;

  if v_lot_data is null or v_jewel_data is null then
    raise exception 'stock jewel transformation import seed is missing'
      using errcode = '22023';
  end if;

  select
    exists (
      select 1
      from public.stone_lots lot
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(lot.data->'internalUses') = 'array'
          then lot.data->'internalUses' else '[]'::jsonb end
      ) use_item
      where lot.organization_id = v_organization_id
        and lot.id = p_lot_id
        and use_item->>'id' = p_event_id
    )
    or exists (
      select 1
      from public.stock_jewels jewel
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(jewel.data->'stoneTransformations') = 'array'
          then jewel.data->'stoneTransformations' else '[]'::jsonb end
      ) event_item
      where jewel.organization_id = v_organization_id
        and jewel.id = p_jewel_id
        and event_item->>'id' = p_event_id
    )
  into v_existed_before;

  if not v_existed_before
     and (
       v_lot_updated_at is distinct from p_updated_at
       or v_jewel_updated_at is distinct from p_updated_at
     ) then
    raise exception 'stock jewel transformation import cutoff no longer matches'
      using errcode = '22023';
  end if;

  -- Reutiliza toda la defensa normal. Sus advisory locks y FOR UPDATE quedan
  -- retenidos hasta que termine esta misma transaccion.
  perform public.transform_stock_jewel_to_natural(
    p_event_id,
    p_date,
    p_lot_id,
    p_jewel_id,
    p_origin,
    p_carats,
    p_quantity,
    p_notes,
    p_updated_at
  );

  select lot.data, lot.updated_at
  into v_lot_data, v_lot_updated_at
  from public.stone_lots lot
  where lot.organization_id = v_organization_id and lot.id = p_lot_id
  for update;

  select jewel.data, jewel.updated_at
  into v_jewel_data, v_jewel_updated_at
  from public.stock_jewels jewel
  where jewel.organization_id = v_organization_id and jewel.id = p_jewel_id
  for update;

  if v_lot_data is null or v_jewel_data is null then
    raise exception 'restored stock jewel transformation records are missing'
      using errcode = '22023';
  end if;

  select use_item
  into v_existing_use
  from jsonb_array_elements(v_lot_data->'internalUses') use_item
  where use_item->>'id' = p_event_id;

  select event_item
  into v_existing_event
  from jsonb_array_elements(v_jewel_data->'stoneTransformations') event_item
  where event_item->>'id' = p_event_id;

  if v_existing_use is null or v_existing_event is null
     or v_existing_use->'costCop' is distinct from v_existing_event->'costCop' then
    raise exception 'restored stock jewel transformation is incomplete'
      using errcode = '22023';
  end if;

  -- Un reintento nunca corrige ni reemplaza historia: solo confirma que el
  -- costo solicitado ya es exactamente el que quedo guardado.
  if v_existed_before then
    if (v_existing_use->>'costCop')::numeric
       is distinct from p_cost_cop::numeric then
      raise exception 'restored transformation cost differs from stored history'
        using errcode = '22023';
    end if;
    return jsonb_build_object('lot', v_lot_data, 'jewel', v_jewel_data);
  end if;

  v_calculated_cost := (v_existing_use->>'costCop')::numeric;
  v_cost_delta := p_cost_cop::numeric - v_calculated_cost;
  v_new_jewel_cost := (v_jewel_data->>'costCop')::numeric + v_cost_delta;
  if v_new_jewel_cost < 0
     or trunc(v_new_jewel_cost) <> v_new_jewel_cost
     or v_new_jewel_cost > 9007199254740991 then
    raise exception 'restored stock jewel cost is invalid' using errcode = '22023';
  end if;

  select jsonb_agg(
    case when use_item->>'id' = p_event_id
      then jsonb_set(use_item, '{costCop}', to_jsonb(p_cost_cop), false)
      else use_item end
    order by item_position
  )
  into v_uses
  from jsonb_array_elements(v_lot_data->'internalUses')
    with ordinality as use_items(use_item, item_position);

  select jsonb_agg(
    case when event_item->>'id' = p_event_id
      then jsonb_set(event_item, '{costCop}', to_jsonb(p_cost_cop), false)
      else event_item end
    order by item_position
  )
  into v_events
  from jsonb_array_elements(v_jewel_data->'stoneTransformations')
    with ordinality as event_items(event_item, item_position);

  v_new_lot_data := jsonb_set(v_lot_data, '{internalUses}', v_uses, false);
  v_new_jewel_data := jsonb_set(
    v_jewel_data,
    '{stoneTransformations}',
    v_events,
    false
  );
  v_new_jewel_data := jsonb_set(
    v_new_jewel_data,
    '{costCop}',
    to_jsonb(v_new_jewel_cost),
    false
  );

  -- El costo historico tambien debe dejar ambos JSON completamente validos.
  perform private.assert_stone_lot_payload(
    p_lot_id,
    v_new_lot_data,
    v_lot_updated_at
  );
  perform private.assert_stone_lot_cutting_payload(
    p_lot_id,
    v_new_lot_data,
    v_lot_updated_at
  );
  perform private.assert_stone_lot_internal_uses_payload(v_new_lot_data);
  perform private.assert_stock_jewel_payload(
    p_jewel_id,
    v_new_jewel_data,
    v_jewel_updated_at
  );
  perform private.assert_stock_jewel_c2_payload(v_new_jewel_data);

  update public.stone_lots
  set data = v_new_lot_data
  where organization_id = v_organization_id and id = p_lot_id;
  if not found then
    raise exception 'restored stone lot disappeared' using errcode = '22023';
  end if;

  update public.stock_jewels
  set data = v_new_jewel_data
  where organization_id = v_organization_id and id = p_jewel_id;
  if not found then
    raise exception 'restored stock jewel disappeared' using errcode = '22023';
  end if;

  return jsonb_build_object('lot', v_new_lot_data, 'jewel', v_new_jewel_data);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Importacion reanudable. Los seeds solo crean la base sin historia; los
--    finalizers cierran el registro cuando la reconstruccion ya coincide.
-- ---------------------------------------------------------------------------

create or replace function public.authorize_cloud_import()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Preflight explicito; cada RPC de escritura vuelve a exigir los mismos roles.
  perform private.current_organization_id_for_roles(array['owner', 'admin']);
end;
$$;

create or replace function public.seed_stone_lot_transformation_import(
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
  v_existing_data jsonb;
  v_existing_updated_at timestamptz;
  v_baseline_match boolean;
  v_same_final_fields boolean;
  v_uses_are_prefix boolean;
  v_final_match boolean;
begin
  perform private.assert_entity_payload(
    'stone lot',
    p_id,
    p_baseline_data,
    p_updated_at
  );
  perform private.assert_entity_payload(
    'stone lot',
    p_id,
    p_final_data,
    p_updated_at
  );
  if jsonb_typeof(p_baseline_data->'internalUses') is distinct from 'array' then
    raise exception 'stone lot import seed requires empty internal uses'
      using errcode = '22023';
  end if;
  if jsonb_array_length(p_baseline_data->'internalUses') <> 0 then
    raise exception 'stone lot import seed requires empty internal uses'
      using errcode = '22023';
  end if;
  if jsonb_typeof(p_final_data->'internalUses') is distinct from 'array' then
    raise exception 'stone lot import seed requires complete final internal uses'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stone_lots:' || p_id, 0)
  );
  select lot.data, lot.updated_at
  into v_existing_data, v_existing_updated_at
  from public.stone_lots lot
  where lot.organization_id = v_organization_id and lot.id = p_id
  for update;

  -- Ambos extremos de la importacion se validan antes de aceptar una fila
  -- existente como propia de esta reanudacion.
  perform private.assert_stone_lot_payload(
    p_id,
    p_baseline_data,
    p_updated_at
  );
  perform private.assert_stone_lot_cutting_payload(
    p_id,
    p_baseline_data,
    p_updated_at
  );
  perform private.assert_stone_lot_internal_uses_payload(p_baseline_data);
  perform private.assert_stone_lot_payload(p_id, p_final_data, p_updated_at);
  perform private.assert_stone_lot_cutting_payload(
    p_id,
    p_final_data,
    p_updated_at
  );
  perform private.assert_stone_lot_internal_uses_payload(p_final_data);

  if v_existing_data is null then
    insert into public.stone_lots (id, organization_id, data, updated_at)
    values (p_id, v_organization_id, p_baseline_data, p_updated_at)
    on conflict (organization_id, id) do nothing;
    return;
  end if;

  perform private.assert_stone_lot_payload(
    p_id,
    v_existing_data,
    v_existing_updated_at
  );
  perform private.assert_stone_lot_cutting_payload(
    p_id,
    v_existing_data,
    v_existing_updated_at
  );
  perform private.assert_stone_lot_internal_uses_payload(v_existing_data);

  v_baseline_match :=
    v_existing_data is not distinct from p_baseline_data
    and v_existing_updated_at is not distinct from p_updated_at;
  v_same_final_fields :=
    (v_existing_data - 'updatedAt' - 'internalUses')
    is not distinct from
    (p_final_data - 'updatedAt' - 'internalUses');
  if jsonb_typeof(v_existing_data->'internalUses') = 'array' then
    v_uses_are_prefix :=
      jsonb_array_length(v_existing_data->'internalUses')
        <= jsonb_array_length(p_final_data->'internalUses')
      and not exists (
        select 1
        from jsonb_array_elements(v_existing_data->'internalUses')
          with ordinality as current_uses(use_item, item_position)
        left join jsonb_array_elements(p_final_data->'internalUses')
          with ordinality as final_uses(use_item, item_position)
          on final_uses.item_position = current_uses.item_position
        where final_uses.use_item is null
           or current_uses.use_item is distinct from final_uses.use_item
      );
  else
    v_uses_are_prefix := false;
  end if;
  v_final_match :=
    (v_existing_data - 'updatedAt')
      is not distinct from
      (p_final_data - 'updatedAt')
    and v_existing_updated_at >= p_updated_at;

  if not v_baseline_match
     and not (
       v_same_final_fields
       and v_uses_are_prefix
       and v_existing_updated_at is not distinct from p_updated_at
     )
     and not v_final_match then
    raise exception 'stone lot import seed collides with another record or edit'
      using errcode = '22023';
  end if;
end;
$$;

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
  v_existing_data jsonb;
  v_existing_updated_at timestamptz;
  v_baseline_match boolean;
  v_intermediate_match boolean;
  v_final_match boolean;
begin
  perform private.assert_entity_payload(
    'stock jewel',
    p_id,
    p_baseline_data,
    p_updated_at
  );
  perform private.assert_entity_payload(
    'stock jewel',
    p_id,
    p_final_data,
    p_updated_at
  );
  if jsonb_typeof(p_baseline_data->'stoneTransformations') is distinct from 'array' then
    raise exception 'stock jewel import seed requires empty transformations'
      using errcode = '22023';
  end if;
  if jsonb_array_length(p_baseline_data->'stoneTransformations') <> 0 then
    raise exception 'stock jewel import seed requires empty transformations'
      using errcode = '22023';
  end if;
  if jsonb_typeof(p_final_data->'stoneTransformations') is distinct from 'array' then
    raise exception 'stock jewel import seed requires complete final transformations'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stock_jewels:' || p_id, 0)
  );
  select jewel.data, jewel.updated_at
  into v_existing_data, v_existing_updated_at
  from public.stock_jewels jewel
  where jewel.organization_id = v_organization_id and jewel.id = p_id
  for update;

  perform private.assert_stock_jewel_payload(
    p_id,
    p_baseline_data,
    p_updated_at
  );
  perform private.assert_stock_jewel_c2_payload(p_baseline_data);
  perform private.assert_stock_jewel_payload(p_id, p_final_data, p_updated_at);
  perform private.assert_stock_jewel_c2_payload(p_final_data);

  if v_existing_data is null then
    insert into public.stock_jewels (id, organization_id, data, updated_at)
    values (p_id, v_organization_id, p_baseline_data, p_updated_at)
    on conflict (organization_id, id) do nothing;
    return;
  end if;

  perform private.assert_stock_jewel_payload(
    p_id,
    v_existing_data,
    v_existing_updated_at
  );
  perform private.assert_stock_jewel_c2_payload(v_existing_data);

  v_baseline_match := v_existing_data is not distinct from p_baseline_data;
  v_intermediate_match :=
    (v_existing_data - 'updatedAt' - 'sale')
      is not distinct from
      (p_final_data - 'updatedAt' - 'sale')
    and coalesce(v_existing_data->'sale', 'null'::jsonb)
      is not distinct from 'null'::jsonb
    and v_existing_updated_at is not distinct from p_updated_at;
  v_final_match :=
    (v_existing_data - 'updatedAt')
    is not distinct from
    (p_final_data - 'updatedAt')
    and v_existing_updated_at >= p_updated_at;

  v_baseline_match :=
    v_baseline_match
    and v_existing_updated_at is not distinct from p_updated_at;

  if not v_baseline_match and not v_intermediate_match and not v_final_match then
    raise exception 'stock jewel import seed collides with another record or edit'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function public.finalize_stone_lot_transformation_import(
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
  v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin']);
  v_existing_data jsonb;
  v_existing_updated_at timestamptz;
  v_effective_updated_at timestamptz;
  v_updated_at_text text;
  v_final_data jsonb;
begin
  perform private.assert_entity_payload('stone lot', p_id, p_data, p_updated_at);
  if jsonb_typeof(p_data->'internalUses') is distinct from 'array' then
    raise exception 'stone lot import finalization requires complete internal uses'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stone_lots:' || p_id, 0)
  );
  select lot.data, lot.updated_at
  into v_existing_data, v_existing_updated_at
  from public.stone_lots lot
  where lot.organization_id = v_organization_id and lot.id = p_id
  for update;
  if v_existing_data is null then
    raise exception 'stone lot import seed not found' using errcode = '22023';
  end if;

  perform private.assert_stone_lot_payload(p_id, p_data, p_updated_at);
  perform private.assert_stone_lot_cutting_payload(p_id, p_data, p_updated_at);
  perform private.assert_stone_lot_internal_uses_payload(p_data);

  if p_data->'internalUses' is distinct from v_existing_data->'internalUses' then
    raise exception 'stone lot import history does not match restored history'
      using errcode = '22023';
  end if;
  if (v_existing_data - 'updatedAt') is distinct from (p_data - 'updatedAt') then
    raise exception 'stone lot import finalization would overwrite an edit'
      using errcode = '22023';
  end if;

  -- Un final exacto con timestamp posterior ya fue cerrado. No se vuelve a
  -- tocar; el estado pendiente solo puede vivir exactamente en el cutoff.
  if v_existing_updated_at > p_updated_at then return; end if;
  if v_existing_updated_at is distinct from p_updated_at then
    raise exception 'stone lot import cutoff no longer matches current row'
      using errcode = '22023';
  end if;

  v_effective_updated_at := greatest(
    v_existing_updated_at,
    p_updated_at,
    pg_catalog.statement_timestamp()
  );
  v_updated_at_text := to_char(
    v_effective_updated_at at time zone 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  );
  v_final_data := jsonb_set(
    p_data,
    '{updatedAt}',
    to_jsonb(v_updated_at_text),
    true
  );

  perform private.assert_stone_lot_payload(
    p_id,
    v_final_data,
    v_effective_updated_at
  );
  perform private.assert_stone_lot_cutting_payload(
    p_id,
    v_final_data,
    v_effective_updated_at
  );
  perform private.assert_stone_lot_internal_uses_payload(v_final_data);

  update public.stone_lots
  set data = v_final_data, updated_at = v_effective_updated_at
  where organization_id = v_organization_id and id = p_id;
end;
$$;

create or replace function public.finalize_stock_jewel_transformation_import(
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
  v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin']);
  v_existing_data jsonb;
  v_existing_updated_at timestamptz;
  v_effective_updated_at timestamptz;
  v_updated_at_text text;
  v_existing_sale jsonb;
  v_final_data jsonb;
begin
  perform private.assert_entity_payload('stock jewel', p_id, p_data, p_updated_at);
  if jsonb_typeof(p_data->'stoneTransformations') is distinct from 'array'
     or not (p_data ? 'sale')
     or jsonb_typeof(p_data->'sale') not in ('object', 'null') then
    raise exception 'stock jewel import finalization requires complete payload'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stock_jewels:' || p_id, 0)
  );
  select jewel.data, jewel.updated_at
  into v_existing_data, v_existing_updated_at
  from public.stock_jewels jewel
  where jewel.organization_id = v_organization_id and jewel.id = p_id
  for update;
  if v_existing_data is null then
    raise exception 'stock jewel import seed not found' using errcode = '22023';
  end if;

  perform private.assert_stock_jewel_payload(p_id, p_data, p_updated_at);
  perform private.assert_stock_jewel_c2_payload(p_data);

  if p_data->'stoneTransformations'
     is distinct from v_existing_data->'stoneTransformations' then
    raise exception 'stock jewel import history does not match restored history'
      using errcode = '22023';
  end if;
  if p_data->'costCop' is distinct from v_existing_data->'costCop' then
    raise exception 'stock jewel import cost does not match restored cost'
      using errcode = '22023';
  end if;
  if (v_existing_data - 'updatedAt' - 'sale')
     is distinct from (p_data - 'updatedAt' - 'sale') then
    raise exception 'stock jewel import finalization would overwrite an edit'
      using errcode = '22023';
  end if;

  v_existing_sale := coalesce(v_existing_data->'sale', 'null'::jsonb);
  if v_existing_sale is distinct from 'null'::jsonb
     and v_existing_sale is distinct from p_data->'sale' then
    raise exception 'stock jewel import sale differs from existing sale'
      using errcode = '22023';
  end if;

  if v_existing_sale is not distinct from p_data->'sale'
     and v_existing_updated_at > p_updated_at then
    return;
  end if;
  if v_existing_updated_at is distinct from p_updated_at then
    raise exception 'stock jewel import cutoff no longer matches current row'
      using errcode = '22023';
  end if;

  v_effective_updated_at := greatest(
    v_existing_updated_at,
    p_updated_at,
    pg_catalog.statement_timestamp()
  );
  v_updated_at_text := to_char(
    v_effective_updated_at at time zone 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  );
  v_final_data := jsonb_set(
    p_data,
    '{updatedAt}',
    to_jsonb(v_updated_at_text),
    true
  );

  perform private.assert_stock_jewel_payload(
    p_id,
    v_final_data,
    v_effective_updated_at
  );
  perform private.assert_stock_jewel_c2_payload(v_final_data);

  update public.stock_jewels
  set data = v_final_data, updated_at = v_effective_updated_at
  where organization_id = v_organization_id and id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Deshacer queda bloqueado: borrar cualquiera de los dos registros dejaria
--    costo o inventario huerfanos. Una reversa futura debera ser otra RPC atomica.
-- ---------------------------------------------------------------------------

create or replace function public.delete_stone_lot(p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
  v_existing_data jsonb;
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
  if v_existing_data ? 'internalUses' then
    if jsonb_typeof(v_existing_data->'internalUses') is distinct from 'array'
       or jsonb_array_length(v_existing_data->'internalUses') > 0 then
      raise exception 'stone lot with internal uses cannot be deleted'
        using errcode = '22023';
    end if;
  end if;
  delete from public.stone_lots
  where organization_id = v_organization_id and id = p_id;
end;
$$;

create or replace function public.delete_stock_jewel(p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid := private.current_organization_id_for_roles(array['owner', 'admin', 'seller']);
  v_existing_data jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stock_jewels:' || p_id, 0)
  );
  select jewel.data
  into v_existing_data
  from public.stock_jewels jewel
  where jewel.organization_id = v_organization_id and jewel.id = p_id
  for update;
  if v_existing_data is null then return; end if;
  if v_existing_data ? 'stoneTransformations' then
    if jsonb_typeof(v_existing_data->'stoneTransformations') is distinct from 'array'
       or jsonb_array_length(v_existing_data->'stoneTransformations') > 0 then
      raise exception 'transformed stock jewel cannot be deleted'
        using errcode = '22023';
    end if;
  end if;
  delete from public.stock_jewels
  where organization_id = v_organization_id and id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Permisos minimos. Las funciones privadas nunca son API.
-- ---------------------------------------------------------------------------

revoke all on function private.assert_stone_lot_internal_uses_payload(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_stock_jewel_c2_payload(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_stone_internal_uses_preserved(text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_stock_transformations_preserved(text, jsonb)
  from public, anon, authenticated, service_role;

revoke all on function public.upsert_stone_lot(text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.upsert_stock_jewel(text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.delete_stone_lot(text)
  from public, anon, authenticated, service_role;
revoke all on function public.delete_stock_jewel(text)
  from public, anon, authenticated, service_role;
revoke all on function public.transform_stock_jewel_to_natural(
  text, text, text, text, text, numeric, integer, text, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.restore_stock_jewel_transformation(
  text, text, text, text, text, numeric, integer, text, timestamptz, numeric
) from public, anon, authenticated, service_role;
revoke all on function public.authorize_cloud_import()
  from public, anon, authenticated, service_role;
revoke all on function public.seed_stone_lot_transformation_import(
  text, jsonb, jsonb, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.seed_stock_jewel_transformation_import(
  text, jsonb, jsonb, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.finalize_stone_lot_transformation_import(
  text, jsonb, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.finalize_stock_jewel_transformation_import(
  text, jsonb, timestamptz
) from public, anon, authenticated, service_role;

grant execute on function public.upsert_stone_lot(text, jsonb, timestamptz)
  to authenticated;
grant execute on function public.upsert_stock_jewel(text, jsonb, timestamptz)
  to authenticated;
grant execute on function public.delete_stone_lot(text)
  to authenticated;
grant execute on function public.delete_stock_jewel(text)
  to authenticated;
grant execute on function public.transform_stock_jewel_to_natural(
  text, text, text, text, text, numeric, integer, text, timestamptz
) to authenticated;
grant execute on function public.restore_stock_jewel_transformation(
  text, text, text, text, text, numeric, integer, text, timestamptz, numeric
) to authenticated;
grant execute on function public.authorize_cloud_import()
  to authenticated;
grant execute on function public.seed_stone_lot_transformation_import(
  text, jsonb, jsonb, timestamptz
) to authenticated;
grant execute on function public.seed_stock_jewel_transformation_import(
  text, jsonb, jsonb, timestamptz
) to authenticated;
grant execute on function public.finalize_stone_lot_transformation_import(
  text, jsonb, timestamptz
) to authenticated;
grant execute on function public.finalize_stock_jewel_transformation_import(
  text, jsonb, timestamptz
) to authenticated;
