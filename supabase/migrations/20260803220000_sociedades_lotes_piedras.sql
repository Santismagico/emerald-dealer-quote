-- B2: sociedades en lotes de piedras (D-053/D-060).
--
-- Migracion aditiva: StoneLot sigue viviendo como JSON dentro de stone_lots.
-- Solo se amplia la validacion protegida existente; la tabla, RLS y las RPC
-- conservan exactamente el modelo de seguridad ya aplicado.

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
  v_partner_id_type text := coalesce(jsonb_typeof(p_data->'partnerId'), 'null');
  v_partner_name text := coalesce(btrim(p_data->>'partnerName'), '');
  v_my_percent numeric := 100;
begin
  perform private.assert_entity_payload('stone lot', p_id, p_data, p_updated_at);

  -- Validaciones existentes de compra, ventas, credito y pagos. Se copian desde
  -- la ultima version vigente para no perder ninguna defensa al reemplazar el cuerpo.
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

  -- Los tres campos son opcionales para que un cliente anterior a B2 pueda
  -- seguir guardando. Cuando faltan representan un lote 100% propio.
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
  -- Tras borrar una ficha, partnerId queda null pero nombre y porcentaje siguen.
  -- Solo null + nombre vacio significa que no existe sociedad y exige 100% propio.
  if v_partner_id_type = 'null'
     and char_length(v_partner_name) = 0
     and v_my_percent <> 100 then
    raise exception 'invalid own stone lot share' using errcode = '22023';
  end if;
end;
$$;

revoke all on function private.assert_stone_lot_payload(text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;
