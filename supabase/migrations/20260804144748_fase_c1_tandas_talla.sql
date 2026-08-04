-- Fase C1: tandas parciales de talla dentro de cada lote de piedras.
-- Migracion aditiva: no cambia tablas, RLS ni datos historicos. Los campos
-- ausentes conservan su significado anterior (sin tandas y ventas en bruto).

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
begin
  perform private.assert_updated_at(p_updated_at);
  if jsonb_typeof(p_data) is distinct from 'object' then
    raise exception 'invalid stone lot cutting payload' using errcode = '22023';
  end if;

  -- Serializa incluso el primer insert; FOR UPDATE cubre la fila ya creada.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stone_lots:' || p_id, 0)
  );
  select lot.data
  into v_existing_data
  from public.stone_lots lot
  where lot.organization_id = v_organization_id and lot.id = p_id
  for update;

  if p_data ? 'cuttingBatches' then
    if jsonb_typeof(p_data->'cuttingBatches') is distinct from 'array' then
      raise exception 'invalid stone cutting batches' using errcode = '22023';
    end if;
    v_batches := p_data->'cuttingBatches';
  else
    if v_existing_data is not null
       and jsonb_typeof(v_existing_data->'cuttingBatches') = 'array'
       and jsonb_array_length(v_existing_data->'cuttingBatches') > 0 then
      raise exception 'stone cutting history cannot be omitted' using errcode = '22023';
    end if;
    v_batches := '[]'::jsonb;
  end if;

  if jsonb_typeof(p_data->'sales') is distinct from 'array'
     or not private.is_nonnegative_number(p_data->'carats')
     or not private.is_nonnegative_integer(p_data->'quantity') then
    raise exception 'invalid stone lot inventory payload' using errcode = '22023';
  end if;
  v_sales := p_data->'sales';

  if exists (
    select 1
    from jsonb_array_elements(v_batches) batch
    where jsonb_typeof(batch) is distinct from 'object'
       or not private.is_nonblank_string(batch->'id')
       or not private.is_iso_date(batch->'sentDate')
       or not private.is_nonnegative_number(batch->'sentCarats')
       or not private.is_nonnegative_integer(batch->'sentQuantity')
       or jsonb_typeof(batch->'returnedDate') is distinct from 'string'
       or not private.is_nonnegative_number(batch->'returnedCarats')
       or not private.is_nonnegative_integer(batch->'returnedQuantity')
       or not private.is_nonnegative_integer(batch->'cuttingCostCop')
       or jsonb_typeof(batch->'cuttingPaidDate') is distinct from 'string'
       or jsonb_typeof(batch->'notes') is distinct from 'string'
  ) then
    raise exception 'invalid stone cutting batch' using errcode = '22023';
  end if;

  -- Los casts se hacen solo despues de comprobar los tipos: PostgreSQL no
  -- garantiza el orden de evaluacion dentro de una expresion booleana.
  if exists (
    select 1
    from jsonb_array_elements(v_batches) batch
    where (batch->>'sentCarats')::numeric <= 0
       or (batch->>'sentQuantity')::numeric <= 0
  ) then
    raise exception 'stone cutting batch requires carats and quantity' using errcode = '22023';
  end if;

  if jsonb_array_length(v_batches) > 0
     and (
       not private.is_iso_date(p_data->'purchaseDate')
       or exists (
         select 1
         from jsonb_array_elements(v_batches) batch
         where (batch->>'sentDate') < (p_data->>'purchaseDate')
       )
     ) then
    raise exception 'stone cutting cannot predate purchase' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_batches) batch
    group by btrim(batch->>'id')
    having count(*) > 1
  ) then
    raise exception 'duplicate stone cutting batch' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_batches) batch
    where (
      (batch->>'returnedDate') = ''
      and (
        (batch->>'returnedCarats')::numeric <> 0
        or (batch->>'returnedQuantity')::numeric <> 0
      )
    ) or (
      (batch->>'returnedDate') <> ''
      and (
        not private.is_iso_date(batch->'returnedDate')
        or (batch->>'returnedDate') < (batch->>'sentDate')
        or (batch->>'returnedCarats')::numeric > (batch->>'sentCarats')::numeric
      )
    ) or (
      (batch->>'cuttingPaidDate') <> ''
      and (
        not private.is_iso_date(batch->'cuttingPaidDate')
        or (batch->>'cuttingPaidDate') < (batch->>'sentDate')
        or (batch->>'cuttingCostCop')::numeric <= 0
      )
    )
  ) then
    raise exception 'invalid stone cutting dates or return' using errcode = '22023';
  end if;

  -- Ausente significa bruto solo para historia previa a C1. Un valor explicito
  -- siempre debe pertenecer al conjunto cerrado.
  if exists (
    select 1
    from jsonb_array_elements(v_sales) sale
    where (sale ? 'origin' and coalesce(sale->>'origin', '') not in ('bruto', 'tallado'))
       or not private.is_nonnegative_number(sale->'carats')
       or not private.is_nonnegative_integer(sale->'quantity')
  ) then
    raise exception 'invalid stone sale origin or inventory' using errcode = '22023';
  end if;
  if jsonb_array_length(v_batches) > 0
     and exists (select 1 from jsonb_array_elements(v_sales) sale where not (sale ? 'origin')) then
    raise exception 'stone sale origin required with cutting history' using errcode = '22023';
  end if;
  if v_existing_data is not null and exists (
    select 1
    from jsonb_array_elements(coalesce(v_existing_data->'sales', '[]'::jsonb)) old_sale
    join jsonb_array_elements(v_sales) new_sale on new_sale->>'id' = old_sale->>'id'
    where old_sale->>'origin' = 'tallado' and not (new_sale ? 'origin')
  ) then
    raise exception 'tallado sale origin cannot be omitted' using errcode = '22023';
  end if;

  v_purchase_carats := (p_data->>'carats')::numeric;
  v_purchase_quantity := (p_data->>'quantity')::numeric;
  select
    coalesce(sum((batch->>'sentCarats')::numeric), 0),
    coalesce(sum((batch->>'sentQuantity')::numeric), 0),
    coalesce(sum(
      case when (batch->>'returnedDate') <> ''
        then (batch->>'returnedCarats')::numeric else 0 end
    ), 0),
    coalesce(sum(
      case when (batch->>'returnedDate') <> ''
        then (batch->>'returnedQuantity')::numeric else 0 end
    ), 0)
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

  if round(v_purchase_carats - round(v_sent_carats, 3) - round(v_raw_sold_carats, 3), 3) < 0
     or v_purchase_quantity - v_sent_quantity - v_raw_sold_quantity < 0 then
    raise exception 'raw stone inventory exceeded' using errcode = '22023';
  end if;
  if round(round(v_returned_carats, 3) - round(v_cut_sold_carats, 3), 3) < 0
     or v_returned_quantity - v_cut_sold_quantity < 0 then
    raise exception 'cut stone inventory exceeded' using errcode = '22023';
  end if;

  -- Sin vinculo venta-tanda, toda tanda ya regresada se protege de forma
  -- conservadora. Costo, fecha de pago y notas siguen editables.
  if v_existing_data is not null
     and (
       exists (
         select 1 from jsonb_array_elements(coalesce(v_existing_data->'sales', '[]'::jsonb)) sale
         where sale->>'origin' = 'tallado'
       )
       or exists (select 1 from jsonb_array_elements(v_sales) sale where sale->>'origin' = 'tallado')
     )
     and exists (
       select 1
       from jsonb_array_elements(coalesce(v_existing_data->'cuttingBatches', '[]'::jsonb)) old_batch
       left join jsonb_array_elements(v_batches) new_batch
         on new_batch->>'id' = old_batch->>'id'
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
    raise exception 'returned cutting inventory is immutable after a tallado sale'
      using errcode = '22023';
  end if;
end;
$$;

-- Conserva la firma publica y todas las validaciones B1-B3 anteriores; C1 se
-- agrega inmediatamente antes del upsert dentro de la misma transaccion.
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
  insert into public.stone_lots (id, organization_id, data, updated_at)
  values (p_id, v_organization_id, p_data, p_updated_at)
  on conflict (organization_id, id) do update
  set data = excluded.data, updated_at = excluded.updated_at
  where excluded.updated_at >= public.stone_lots.updated_at;
end;
$$;

revoke all on function private.assert_stone_lot_cutting_payload(text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.upsert_stone_lot(text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.upsert_stone_lot(text, jsonb, timestamptz) to authenticated;
