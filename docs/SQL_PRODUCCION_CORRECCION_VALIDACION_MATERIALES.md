# Corrección del servidor — Validación de gramos de materiales

> **Para Santiago.** Este paso corrige una regla del inventario de materiales en
> el servidor de producción. No publica la aplicación y no borra ningún dato.

## Qué corrige

El servidor debe rechazar un lote cuando la suma de sus salidas supera los
gramos comprados. Por ejemplo: un lote de 10 g no puede guardar dos salidas de
7 g, porque sumarían 14 g.

La corrección también rechaza un lote que no traiga su lista de salidas.

## Cómo pegarla

1. Entra a **supabase.com** e inicia sesión.
2. Abre el proyecto de producción de Emerald Dealer.
3. En el menú izquierdo, entra a **SQL Editor**.
4. Presiona **New query**.
5. Copia **todo el bloque SQL de abajo**, desde el primer comentario hasta la
   última línea.
6. Pégalo en la consulta nueva y presiona **Run**.
7. Debe aparecer un mensaje verde de **Success**.

Si aparece un mensaje rojo, no publiques ni repitas otros pasos. Conserva una
captura completa del error.

## Antes de la prueba N6

El mismo bloque debe ejecutarse también en el proyecto desechable
**Emerald Dealer - Pruebas Fase 2** antes de correr N6:

1. Abre ese proyecto de pruebas, no el de producción.
2. Repite los pasos de **SQL Editor** con el mismo bloque.
3. Confirma **Success**.
4. Ejecuta `npm run security:n6:secure` desde `C:\Dev\emerald-dealer`.
5. La clave secreta se pega únicamente en la ventana oculta que abre el runner;
   nunca en el chat, el repositorio, una captura ni este documento.

La publicación sigue bloqueada hasta tener **Success** tanto en pruebas como en
producción y una ejecución N6 verde sobre el commit exacto.

## Texto exacto para pegar

```sql
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
```

## Cuándo se puede continuar

La publicación sigue bloqueada hasta que:

- este SQL dé **Success** en producción;
- la misma migración esté aplicada en el proyecto desechable N6;
- N6 pase entre dos cuentas;
- todas las pruebas y la compilación estén en verde.
