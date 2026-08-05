-- Corrige la validacion de lotes de material ya creada en
-- 20260724210000_inventario_materiales.sql.
--
-- Es segura sobre produccion viva: no modifica tablas ni filas. Solo reemplaza
-- el validador privado para exigir que:
--   1. uses exista y sea un arreglo;
--   2. cada salida tenga gramos no negativos;
--   3. la suma de las salidas no supere los gramos comprados.

create or replace function private.assert_material_lot_payload(
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
  v_used_grams numeric;
begin
  perform private.assert_entity_payload('material lot', p_id, p_data, p_updated_at);

  if not private.is_nonnegative_number(p_data->'grams')
     or not private.is_nonnegative_integer(p_data->'costCop')
     or not private.is_nonnegative_number(p_data->'myGrams')
     or jsonb_typeof(p_data->'uses') is distinct from 'array' then
    raise exception 'invalid material lot payload' using errcode = '22023';
  end if;

  if (p_data->>'myGrams')::numeric > (p_data->>'grams')::numeric then
    raise exception 'invalid material lot share' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_data->'uses') item
    where not private.is_nonnegative_number(item->'grams')
  ) then
    raise exception 'invalid material lot use' using errcode = '22023';
  end if;

  select coalesce(sum((item->>'grams')::numeric), 0::numeric)
  into v_used_grams
  from jsonb_array_elements(p_data->'uses') item;

  if v_used_grams > (p_data->>'grams')::numeric then
    raise exception 'material lot uses exceed available grams' using errcode = '22023';
  end if;
end;
$$;

revoke all on function private.assert_material_lot_payload(text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;
