-- Exigir identificador en ventas de piedra, abonos de venta y venta de joya.
--
-- QUE PASO. La regla que congela la tasa de cambio (20260803233000) compara el
-- registro guardado con el que llega emparejandolos POR ID:
--     on new_payment->>'id' = old_payment->>'id'
-- En SQL `NULL = NULL` no es verdadero: es NULL. Un abono sin `id` no encuentra
-- pareja, el EXISTS no devuelve filas, la regla no se dispara y la tasa se deja
-- reescribir en silencio. La venta de una joya en stock tiene el mismo patron:
--     and v_existing_data->'sale'->>'id' = p_data->'sale'->>'id'
--
-- COMO SE ENCONTRO. Ejecutando N6 real por primera vez el 2026-08-12. La prueba
-- enviaba abonos sin `id` y el servidor acepto reescribir la tasa cuando debia
-- negarse. N6 llevaba desde el 2026-08-04 sin poder correr, asi que nadie lo
-- habia visto.
--
-- QUE TAN GRAVE ERA. **No es aislamiento ni privacidad**: nada de esto alcanza
-- datos de otra joyeria. Es integridad contable — reescribir a que dolar se
-- vendio o se abono algo en el pasado. La app siempre envia `id`
-- (`normalizeBuyerPayment` rellena uno si falta), asi que en uso normal la regla
-- si protegia; pero el servidor no puede depender de que el cliente se porte
-- bien.
--
-- ESTADO OBJETIVO. Toda venta de piedra, todo abono de venta y toda venta de
-- joya llegan con un `id` no vacio, y esos `id` no se repiten dentro de su
-- ambito. Asi el emparejamiento siempre encuentra pareja y la regla de la tasa
-- siempre se aplica.
--
-- COMPATIBILIDAD. Solo afecta ESCRITURAS; las filas ya guardadas se siguen
-- leyendo igual. Todos los caminos de escritura de la app normalizan antes de
-- enviar (`listStoneLots`, `normalizeStoneLot`, `normalizeStockJewel`), y la
-- normalizacion rellena el `id` que falte. No hay dato del usuario que quede
-- imposible de guardar.
--
-- LIMITE CONOCIDO, NO CERRADO AQUI. La regla protege el abono que conserva su
-- `id`. Borrar un abono y crear otro con `id` distinto sigue permitido: es una
-- operacion legitima del usuario y distinguirla de un fraude exige una decision
-- de negocio, no una tecnica.
--
-- Es repetible: volver a ejecutarlo deja el mismo estado.

-- ---------------------------------------------------------------------------
-- 1. Identificadores en el lote de piedras: ventas y sus abonos.
-- ---------------------------------------------------------------------------
create or replace function private.assert_stone_sale_identifiers(p_data jsonb)
returns void
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  -- Si `sales` no es un arreglo, assert_stone_lot_payload ya lo rechaza con su
  -- propio mensaje. Aqui no se compite por dar el error.
  if jsonb_typeof(p_data->'sales') is distinct from 'array' then
    return;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_data->'sales') sale
    where not private.is_nonblank_string(sale->'id')
  ) then
    raise exception 'stone sale requires an id' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_data->'sales') sale
    group by btrim(sale->>'id')
    having count(*) > 1
  ) then
    raise exception 'duplicate stone sale id' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_data->'sales') sale
    where sale ? 'payments' and jsonb_typeof(sale->'payments') is distinct from 'array'
  ) then
    raise exception 'invalid stone sale payments' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_data->'sales') sale
    cross join jsonb_array_elements(coalesce(sale->'payments', '[]'::jsonb)) payment
    where not private.is_nonblank_string(payment->'id')
  ) then
    raise exception 'buyer payment requires an id' using errcode = '22023';
  end if;

  -- La unicidad importa DENTRO de cada venta: ahi es donde empareja la regla de
  -- la tasa. Dos ventas distintas pueden repetir un id sin confundir nada.
  if exists (
    select 1
    from jsonb_array_elements(p_data->'sales') sale
    cross join jsonb_array_elements(coalesce(sale->'payments', '[]'::jsonb)) payment
    group by btrim(sale->>'id'), btrim(payment->>'id')
    having count(*) > 1
  ) then
    raise exception 'duplicate buyer payment id' using errcode = '22023';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Identificador en la venta de la joya en stock.
-- ---------------------------------------------------------------------------
create or replace function private.assert_stock_jewel_sale_identifier(p_data jsonb)
returns void
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  -- Una joya sin vender no trae `sale`, y eso es valido.
  if jsonb_typeof(p_data->'sale') is distinct from 'object' then
    return;
  end if;

  if not private.is_nonblank_string(p_data->'sale'->'id') then
    raise exception 'stock jewel sale requires an id' using errcode = '22023';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Enganchar las comprobaciones en las funciones protegidas. El resto del
--    cuerpo es identico al vigente: solo se agrega la primera linea.
-- ---------------------------------------------------------------------------
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
  perform private.assert_stone_sale_identifiers(p_data);
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
  perform private.assert_stock_jewel_sale_identifier(p_data);
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
-- 4. Permisos. `revoke all`, nunca la forma debil `revoke insert, update,
--    delete`: esa fue la causa del agujero de TRUNCATE del 2026-08-10.
-- ---------------------------------------------------------------------------
revoke all on function private.assert_stone_sale_identifiers(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_stock_jewel_sale_identifier(jsonb)
  from public, anon, authenticated, service_role;

revoke all on function public.upsert_stone_lot(text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.upsert_stock_jewel(text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;

grant execute on function public.upsert_stone_lot(text, jsonb, timestamptz) to authenticated;
grant execute on function public.upsert_stock_jewel(text, jsonb, timestamptz) to authenticated;
