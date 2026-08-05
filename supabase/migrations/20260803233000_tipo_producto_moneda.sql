-- B3: tipo de producto y referencia historica USD/COP (D-058).
--
-- Migracion aditiva: reemplaza los cuatro validadores privados que reciben
-- los nuevos campos y endurece el guardado de ajustes para no perder datos B3
-- cuando dos dispositivos guardan versiones distintas. No cambia tablas, RLS
-- ni datos existentes.

create or replace function private.assert_settings_payload(
  p_data jsonb,
  p_updated_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.assert_updated_at(p_updated_at);
  if jsonb_typeof(p_data) <> 'object' then
    raise exception 'invalid settings payload' using errcode = '22023';
  end if;
  if p_data ? 'currency' and p_data->>'currency' <> 'COP' then
    raise exception 'invalid settings currency' using errcode = '22023';
  end if;
  if (p_data ? 'goldPricePerGram' and not private.is_nonnegative_integer(p_data->'goldPricePerGram'))
     or (p_data ? 'goldMarkupPerGram' and not private.is_nonnegative_integer(p_data->'goldMarkupPerGram'))
     or (p_data ? 'quoteCounter' and not private.is_nonnegative_integer(p_data->'quoteCounter'))
     or (p_data ? 'settingsVersion' and not private.is_nonnegative_integer(p_data->'settingsVersion'))
     or (p_data ? 'defaultValidityDays' and not private.is_nonnegative_integer(p_data->'defaultValidityDays')) then
    raise exception 'invalid settings numeric field' using errcode = '22023';
  end if;

  if p_data ? 'expenseCategories' then
    if jsonb_typeof(p_data->'expenseCategories') is distinct from 'array'
       or exists (
         select 1 from jsonb_array_elements(p_data->'expenseCategories') item
         where jsonb_typeof(item) is distinct from 'object'
            or not private.is_nonblank_string(item->'name')
            or jsonb_typeof(item->'active') is distinct from 'boolean'
       )
       or exists (
         select 1
         from jsonb_array_elements(p_data->'expenseCategories') item
         group by lower(btrim(item->>'name'))
         having count(*) > 1
       ) then
      raise exception 'invalid expense categories' using errcode = '22023';
    end if;
  end if;

  if p_data ? 'productTypes' then
    if jsonb_typeof(p_data->'productTypes') is distinct from 'array'
       or exists (
         select 1 from jsonb_array_elements(p_data->'productTypes') item
         where jsonb_typeof(item) is distinct from 'object'
            or not private.is_nonblank_string(item->'name')
            or jsonb_typeof(item->'active') is distinct from 'boolean'
       )
       or exists (
         select 1
         from jsonb_array_elements(p_data->'productTypes') item
         group by lower(btrim(item->>'name'))
         having count(*) > 1
       ) then
      raise exception 'invalid product types' using errcode = '22023';
    end if;
  end if;

  -- Campos opcionales: un settings historico puede no tener referencia USD.
  if p_data ? 'lastKnownUsdRate'
     and jsonb_typeof(p_data->'lastKnownUsdRate') not in ('number', 'null') then
    raise exception 'invalid USD rate' using errcode = '22023';
  end if;
  if jsonb_typeof(p_data->'lastKnownUsdRate') = 'number'
     and ((p_data->>'lastKnownUsdRate')::numeric < 1000
       or (p_data->>'lastKnownUsdRate')::numeric > 20000) then
    raise exception 'invalid USD rate' using errcode = '22023';
  end if;
  if p_data ? 'usdRateUpdatedAt'
     and jsonb_typeof(p_data->'usdRateUpdatedAt') is distinct from 'string' then
    raise exception 'invalid USD rate timestamp' using errcode = '22023';
  end if;
  if p_data ? 'productTypesUpdatedAt'
     and jsonb_typeof(p_data->'productTypesUpdatedAt') is distinct from 'string' then
    raise exception 'invalid product types timestamp' using errcode = '22023';
  end if;

  -- Las cadenas vacias representan datos historicos sin fecha. Si hay una
  -- fecha, debe poder compararse de forma segura en la fusion atomica.
  begin
    if p_data ? 'usdRateUpdatedAt'
       and char_length(btrim(p_data->>'usdRateUpdatedAt')) > 0 then
      perform (p_data->>'usdRateUpdatedAt')::timestamptz;
    end if;
    if p_data ? 'productTypesUpdatedAt'
       and char_length(btrim(p_data->>'productTypesUpdatedAt')) > 0 then
      perform (p_data->>'productTypesUpdatedAt')::timestamptz;
    end if;
  exception
    when invalid_datetime_format or datetime_field_overflow then
      raise exception 'invalid settings timestamp' using errcode = '22023';
  end;
end;
$$;

create or replace function private.assert_stone_lot_payload(
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
  v_partner_id_type text := coalesce(jsonb_typeof(p_data->'partnerId'), 'null');
  v_partner_name text := coalesce(btrim(p_data->>'partnerName'), '');
  v_my_percent numeric := 100;
begin
  perform private.assert_entity_payload('stone lot', p_id, p_data, p_updated_at);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stone_lots:' || p_id, 0)
  );

  select lot.data
  into v_existing_data
  from public.stone_lots lot
  where lot.organization_id = v_organization_id and lot.id = p_id
  for update;

  if not private.is_nonnegative_integer(p_data->'purchaseValueCop')
     or not private.is_nonnegative_integer(p_data->'quantity')
     or jsonb_typeof(p_data->'supplierPayments') <> 'array'
     or jsonb_typeof(p_data->'sales') <> 'array' then
    raise exception 'invalid stone lot payload' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_data->'supplierPayments') item
    where not private.is_nonnegative_integer(item->'amount')
  ) or exists (
    select 1 from jsonb_array_elements(p_data->'sales') item
    where not private.is_nonnegative_integer(item->'valueCop')
       or not private.is_nonnegative_integer(item->'quantity')
  ) then
    raise exception 'invalid stone lot COP field' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_data->'sales') sale
    where sale ? 'payments' and jsonb_typeof(sale->'payments') <> 'array'
  ) then
    raise exception 'invalid stone lot payload' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_data->'sales') sale,
         jsonb_array_elements(coalesce(sale->'payments', '[]'::jsonb)) item
    where not private.is_nonnegative_integer(item->'amount')
  ) then
    raise exception 'invalid stone lot COP field' using errcode = '22023';
  end if;

  -- productType vacio y usdRate null siguen representando historicos sin registrar.
  if exists (
    select 1
    from jsonb_array_elements(p_data->'sales') sale
    where (sale ? 'productType' and jsonb_typeof(sale->'productType') is distinct from 'string')
       or (sale ? 'usdRate' and jsonb_typeof(sale->'usdRate') not in ('number', 'null'))
       or (jsonb_typeof(sale->'usdRate') = 'number'
           and ((sale->>'usdRate')::numeric < 1000
             or (sale->>'usdRate')::numeric > 20000))
  ) then
    raise exception 'invalid stone sale currency fields' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_data->'sales') sale,
         jsonb_array_elements(coalesce(sale->'payments', '[]'::jsonb)) item
    where (item ? 'usdRate' and jsonb_typeof(item->'usdRate') not in ('number', 'null'))
       or (jsonb_typeof(item->'usdRate') = 'number'
           and ((item->>'usdRate')::numeric < 1000
             or (item->>'usdRate')::numeric > 20000))
  ) then
    raise exception 'invalid buyer payment USD rate' using errcode = '22023';
  end if;

  -- Una tasa ya guardada pertenece para siempre a esa operacion. Ausente y null
  -- son el mismo estado historico y tampoco se pueden completar despues.
  if v_existing_data is not null and exists (
    select 1
    from jsonb_array_elements(coalesce(v_existing_data->'sales', '[]'::jsonb)) old_sale
    join jsonb_array_elements(p_data->'sales') new_sale
      on new_sale->>'id' = old_sale->>'id'
    where coalesce(old_sale->'usdRate', 'null'::jsonb)
          is distinct from coalesce(new_sale->'usdRate', 'null'::jsonb)
  ) then
    raise exception 'stone sale USD rate is immutable' using errcode = '22023';
  end if;
  if v_existing_data is not null and exists (
    select 1
    from jsonb_array_elements(coalesce(v_existing_data->'sales', '[]'::jsonb)) old_sale
    join jsonb_array_elements(p_data->'sales') new_sale
      on new_sale->>'id' = old_sale->>'id'
    cross join jsonb_array_elements(coalesce(old_sale->'payments', '[]'::jsonb)) old_payment
    join jsonb_array_elements(coalesce(new_sale->'payments', '[]'::jsonb)) new_payment
      on new_payment->>'id' = old_payment->>'id'
    where coalesce(old_payment->'usdRate', 'null'::jsonb)
          is distinct from coalesce(new_payment->'usdRate', 'null'::jsonb)
  ) then
    raise exception 'buyer payment USD rate is immutable' using errcode = '22023';
  end if;

  if p_data ? 'partnerId'
     and v_partner_id_type not in ('null', 'string') then
    raise exception 'invalid stone lot partner' using errcode = '22023';
  end if;
  if v_partner_id_type = 'string'
     and not private.is_nonblank_string(p_data->'partnerId') then
    raise exception 'invalid stone lot partner' using errcode = '22023';
  end if;
  if p_data ? 'partnerName'
     and jsonb_typeof(p_data->'partnerName') is distinct from 'string' then
    raise exception 'invalid stone lot partner name' using errcode = '22023';
  end if;
  if p_data ? 'myPercent' then
    if not private.is_nonnegative_integer(p_data->'myPercent') then
      raise exception 'invalid stone lot share' using errcode = '22023';
    end if;
    v_my_percent := (p_data->>'myPercent')::numeric;
    if v_my_percent > 100 then
      raise exception 'invalid stone lot share' using errcode = '22023';
    end if;
  end if;
  if v_partner_id_type = 'string' and char_length(v_partner_name) = 0 then
    raise exception 'invalid stone lot partner name' using errcode = '22023';
  end if;
  if v_partner_id_type = 'null'
     and char_length(v_partner_name) = 0
     and v_my_percent <> 100 then
    raise exception 'invalid own stone lot share' using errcode = '22023';
  end if;
end;
$$;

create or replace function private.assert_stock_jewel_payload(
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
begin
  perform private.assert_entity_payload('stock jewel', p_id, p_data, p_updated_at);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':stock_jewels:' || p_id, 0)
  );

  select jewel.data
  into v_existing_data
  from public.stock_jewels jewel
  where jewel.organization_id = v_organization_id and jewel.id = p_id
  for update;
  if not private.is_nonnegative_integer(p_data->'costCop')
     or not private.is_nonnegative_integer(p_data->'priceCop')
     or coalesce(lower(p_data->>'status'), '') not in ('disponible', 'apartada') then
    raise exception 'invalid stock jewel payload' using errcode = '22023';
  end if;
  if p_data ? 'sale' and jsonb_typeof(p_data->'sale') not in ('object', 'null') then
    raise exception 'invalid stock jewel sale' using errcode = '22023';
  end if;
  if jsonb_typeof(p_data->'sale') = 'object'
     and not private.is_nonnegative_integer(p_data->'sale'->'priceCop') then
    raise exception 'invalid stock jewel COP field' using errcode = '22023';
  end if;
  if jsonb_typeof(p_data->'sale') = 'object'
     and (
       (p_data->'sale' ? 'productType'
        and jsonb_typeof(p_data->'sale'->'productType') is distinct from 'string')
       or (p_data->'sale' ? 'usdRate'
           and jsonb_typeof(p_data->'sale'->'usdRate') not in ('number', 'null'))
       or (jsonb_typeof(p_data->'sale'->'usdRate') = 'number'
           and ((p_data->'sale'->>'usdRate')::numeric < 1000
             or (p_data->'sale'->>'usdRate')::numeric > 20000)
       )
     ) then
    raise exception 'invalid stock jewel sale currency fields' using errcode = '22023';
  end if;
  if v_existing_data is not null
     and jsonb_typeof(v_existing_data->'sale') = 'object'
     and jsonb_typeof(p_data->'sale') = 'object'
     and v_existing_data->'sale'->>'id' = p_data->'sale'->>'id'
     and coalesce(v_existing_data->'sale'->'usdRate', 'null'::jsonb)
         is distinct from coalesce(p_data->'sale'->'usdRate', 'null'::jsonb) then
    raise exception 'stock jewel sale USD rate is immutable' using errcode = '22023';
  end if;
end;
$$;

create or replace function private.assert_expense_payload(
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
  v_partner_id_type text := jsonb_typeof(p_data->'partnerId');
  v_partner_name text;
  v_my_percent numeric;
begin
  perform private.assert_entity_payload('expense', p_id, p_data, p_updated_at);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':expenses:' || p_id, 0)
  );

  select expense.data
  into v_existing_data
  from public.expenses expense
  where expense.organization_id = v_organization_id and expense.id = p_id
  for update;

  if not private.is_iso_date(p_data->'date')
     or not private.is_nonblank_string(p_data->'concept')
     or not private.is_nonblank_string(p_data->'category')
     or not private.is_nonblank_string(p_data->'method')
     or not private.is_nonblank_string(p_data->'paidBy')
     or jsonb_typeof(p_data->'partnerName') is distinct from 'string'
     or jsonb_typeof(p_data->'notes') is distinct from 'string'
     or jsonb_typeof(p_data->'createdAt') is distinct from 'string'
     or jsonb_typeof(p_data->'updatedAt') is distinct from 'string' then
    raise exception 'invalid expense payload' using errcode = '22023';
  end if;
  if not private.is_nonnegative_integer(p_data->'amountCop')
     or (p_data->>'amountCop')::numeric <= 0 then
    raise exception 'invalid expense amount' using errcode = '22023';
  end if;
  if not private.is_nonnegative_integer(p_data->'myPercent') then
    raise exception 'invalid expense share' using errcode = '22023';
  end if;
  v_my_percent := (p_data->>'myPercent')::numeric;
  if v_my_percent > 100 then
    raise exception 'invalid expense share' using errcode = '22023';
  end if;
  if v_partner_id_type is distinct from 'null'
     and not private.is_nonblank_string(p_data->'partnerId') then
    raise exception 'invalid expense partner' using errcode = '22023';
  end if;
  v_partner_name := btrim(p_data->>'partnerName');
  if v_partner_id_type = 'string' and char_length(v_partner_name) = 0 then
    raise exception 'invalid expense partner name' using errcode = '22023';
  end if;
  if v_partner_id_type = 'null' and char_length(v_partner_name) = 0 and v_my_percent <> 100 then
    raise exception 'invalid own expense share' using errcode = '22023';
  end if;

  if p_data ? 'usdRate'
     and jsonb_typeof(p_data->'usdRate') not in ('number', 'null') then
    raise exception 'invalid expense USD rate' using errcode = '22023';
  end if;
  if jsonb_typeof(p_data->'usdRate') = 'number'
     and ((p_data->>'usdRate')::numeric < 1000
       or (p_data->>'usdRate')::numeric > 20000) then
    raise exception 'invalid expense USD rate' using errcode = '22023';
  end if;
  if v_existing_data is not null
     and coalesce(v_existing_data->'usdRate', 'null'::jsonb)
         is distinct from coalesce(p_data->'usdRate', 'null'::jsonb) then
    raise exception 'expense USD rate is immutable' using errcode = '22023';
  end if;
end;
$$;

-- Une ajustes por organizacion dentro de una sola transaccion. Los campos
-- generales siguen "ultimo guardado gana", mientras los dos bloques B3 usan
-- sus propias fechas para que una pantalla antigua no borre catalogos o tasas.
create or replace function public.upsert_settings(
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
  v_merged_data jsonb;
  v_merged_updated_at timestamptz;
  v_row_exists boolean := false;

  v_incoming_rate_at timestamptz;
  v_existing_rate_at timestamptz;
  v_rate_value jsonb;
  v_rate_at timestamptz;

  v_incoming_catalog_at timestamptz;
  v_existing_catalog_at timestamptz;
  v_catalog_winner jsonb := '[]'::jsonb;
  v_catalog_loser jsonb := '[]'::jsonb;
  v_catalog_winner_at timestamptz;
  v_merged_product_types jsonb;

  v_existing_version numeric := 0;
  v_incoming_version numeric := 0;
begin
  perform private.assert_settings_payload(p_data, p_updated_at);

  -- El candado cubre tambien el caso excepcional donde la organizacion aun no
  -- tenga fila; FOR UPDATE serializa el caso normal ya existente.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_organization_id::text || ':org_settings', 0)
  );

  select settings.data, settings.updated_at
  into v_existing_data, v_existing_updated_at
  from public.org_settings settings
  where settings.organization_id = v_organization_id
  for update;
  v_row_exists := found;

  if v_row_exists then
    v_merged_updated_at := greatest(v_existing_updated_at, p_updated_at);
    if p_updated_at >= v_existing_updated_at then
      v_merged_data := v_existing_data || p_data;
    else
      v_merged_data := p_data || v_existing_data;
    end if;
  else
    v_existing_data := '{}'::jsonb;
    v_merged_data := p_data;
    v_merged_updated_at := p_updated_at;
  end if;

  -- La version nunca retrocede, aunque el payload ganador global sea antiguo.
  if private.is_nonnegative_integer(v_existing_data->'settingsVersion') then
    v_existing_version := (v_existing_data->>'settingsVersion')::numeric;
  end if;
  if private.is_nonnegative_integer(p_data->'settingsVersion') then
    v_incoming_version := (p_data->>'settingsVersion')::numeric;
  end if;
  if v_existing_data ? 'settingsVersion' or p_data ? 'settingsVersion' then
    v_merged_data := jsonb_set(
      v_merged_data,
      '{settingsVersion}',
      pg_catalog.to_jsonb(greatest(v_existing_version, v_incoming_version)),
      true
    );
  end if;

  -- lastKnownUsdRate y usdRateUpdatedAt forman un par indivisible. null con
  -- fecha vacia es solo el default historico y nunca borra una tasa conocida.
  if p_data ? 'lastKnownUsdRate'
     and (
       jsonb_typeof(p_data->'lastKnownUsdRate') = 'number'
       or (
         jsonb_typeof(p_data->'lastKnownUsdRate') = 'null'
         and p_data ? 'usdRateUpdatedAt'
         and char_length(btrim(p_data->>'usdRateUpdatedAt')) > 0
       )
     ) then
    v_incoming_rate_at := case
      when p_data ? 'usdRateUpdatedAt'
       and char_length(btrim(p_data->>'usdRateUpdatedAt')) > 0
        then (p_data->>'usdRateUpdatedAt')::timestamptz
      when not (
        v_existing_data ? 'lastKnownUsdRate'
        and jsonb_typeof(v_existing_data->'lastKnownUsdRate') = 'number'
      ) then p_updated_at
      else null
    end;
  end if;
  if v_existing_data ? 'lastKnownUsdRate'
     and (
       jsonb_typeof(v_existing_data->'lastKnownUsdRate') = 'number'
       or (
         jsonb_typeof(v_existing_data->'lastKnownUsdRate') = 'null'
         and v_existing_data ? 'usdRateUpdatedAt'
         and char_length(btrim(v_existing_data->>'usdRateUpdatedAt')) > 0
       )
     ) then
    begin
      v_existing_rate_at := case
        when v_existing_data ? 'usdRateUpdatedAt'
         and char_length(btrim(v_existing_data->>'usdRateUpdatedAt')) > 0
          then (v_existing_data->>'usdRateUpdatedAt')::timestamptz
        else v_existing_updated_at
      end;
    exception
      when invalid_datetime_format or datetime_field_overflow then
        v_existing_rate_at := v_existing_updated_at;
    end;
  end if;

  if v_incoming_rate_at is not null
     and (v_existing_rate_at is null or v_incoming_rate_at >= v_existing_rate_at) then
    v_rate_value := p_data->'lastKnownUsdRate';
    v_rate_at := v_incoming_rate_at;
  elsif v_existing_rate_at is not null then
    v_rate_value := v_existing_data->'lastKnownUsdRate';
    v_rate_at := v_existing_rate_at;
  end if;
  if v_rate_at is not null then
    v_merged_data := jsonb_set(v_merged_data, '{lastKnownUsdRate}', v_rate_value, true);
    v_merged_data := jsonb_set(
      v_merged_data,
      '{usdRateUpdatedAt}',
      pg_catalog.to_jsonb(v_rate_at),
      true
    );
  end if;

  -- Cada catalogo aporta todos sus nombres. La fecha mas reciente decide el
  -- estado active cuando un nombre aparece en ambos, ignorando mayusculas y
  -- espacios; los nombres exclusivos del catalogo perdedor se conservan.
  if jsonb_typeof(p_data->'productTypes') = 'array' then
    v_incoming_catalog_at := case
      when p_data ? 'productTypesUpdatedAt'
       and char_length(btrim(p_data->>'productTypesUpdatedAt')) > 0
        then (p_data->>'productTypesUpdatedAt')::timestamptz
      when jsonb_typeof(v_existing_data->'productTypes') is distinct from 'array'
        then p_updated_at
      else null
    end;
  end if;
  if jsonb_typeof(v_existing_data->'productTypes') = 'array' then
    begin
      v_existing_catalog_at := case
        when v_existing_data ? 'productTypesUpdatedAt'
         and char_length(btrim(v_existing_data->>'productTypesUpdatedAt')) > 0
          then (v_existing_data->>'productTypesUpdatedAt')::timestamptz
        else v_existing_updated_at
      end;
    exception
      when invalid_datetime_format or datetime_field_overflow then
        v_existing_catalog_at := v_existing_updated_at;
    end;
  end if;

  if v_incoming_catalog_at is not null
     and (v_existing_catalog_at is null or v_incoming_catalog_at >= v_existing_catalog_at) then
    v_catalog_winner := p_data->'productTypes';
    v_catalog_loser := coalesce(v_existing_data->'productTypes', '[]'::jsonb);
    v_catalog_winner_at := v_incoming_catalog_at;
  elsif v_existing_catalog_at is not null then
    v_catalog_winner := v_existing_data->'productTypes';
    v_catalog_loser := coalesce(p_data->'productTypes', '[]'::jsonb);
    v_catalog_winner_at := v_existing_catalog_at;
  end if;

  if v_catalog_winner_at is not null then
    select coalesce(
      jsonb_agg(candidate.item order by candidate.source_priority, candidate.ordinality),
      '[]'::jsonb
    )
    into v_merged_product_types
    from (
      select winner.item, 0 as source_priority, winner.ordinality
      from jsonb_array_elements(v_catalog_winner)
        with ordinality as winner(item, ordinality)
      union all
      select loser.item, 1 as source_priority, loser.ordinality
      from jsonb_array_elements(v_catalog_loser)
        with ordinality as loser(item, ordinality)
      where not exists (
        select 1
        from jsonb_array_elements(v_catalog_winner) winner_item
        where lower(btrim(winner_item->>'name')) = lower(btrim(loser.item->>'name'))
      )
    ) candidate;

    v_merged_data := jsonb_set(
      v_merged_data,
      '{productTypes}',
      v_merged_product_types,
      true
    );
    v_merged_data := jsonb_set(
      v_merged_data,
      '{productTypesUpdatedAt}',
      pg_catalog.to_jsonb(v_catalog_winner_at),
      true
    );
  end if;

  perform private.assert_settings_payload(v_merged_data, v_merged_updated_at);

  if v_row_exists then
    update public.org_settings
    set data = v_merged_data,
        updated_at = v_merged_updated_at
    where organization_id = v_organization_id;
  else
    insert into public.org_settings (organization_id, data, updated_at)
    values (v_organization_id, v_merged_data, v_merged_updated_at);
  end if;
end;
$$;

revoke all on function private.assert_settings_payload(jsonb, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_stone_lot_payload(text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_stock_jewel_payload(text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_expense_payload(text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;

revoke all on function public.upsert_settings(jsonb, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.upsert_settings(jsonb, timestamptz) to authenticated;
