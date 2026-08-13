# Activación: exigir identificador en ventas y abonos

_Escrito el 2026-08-12, después de que N6 real destapara el hueco._

## Qué corrige

La regla que **congela la tasa de cambio** de una venta o un abono compara el registro
guardado con el que llega **emparejándolos por su identificador**. En SQL, `NULL = NULL` no
es verdadero: es `NULL`. Un abono sin identificador **no encuentra pareja**, la comprobación
no devuelve filas, la regla no se dispara y la tasa se deja reescribir en silencio.

La venta de una joya en stock tenía el mismo patrón.

**No es aislamiento ni privacidad.** Nada de esto alcanza datos de otra joyería. Es
integridad contable: reescribir a qué dólar se vendió o se abonó algo en el pasado.

## Por qué es seguro aplicarlo

- **Solo valida escrituras.** No toca ni una fila guardada: no hay `update`, ni `delete`, ni
  `truncate`. Lo ya guardado se sigue leyendo igual.
- **La app siempre envía identificador.** `normalizeBuyerPayment`, `normalizeStoneSale` y
  `normalizeStockJewelSale` rellenan uno si falta, y **todos** los caminos de escritura
  normalizan antes de enviar. No hay dato del usuario que quede imposible de guardar.
- **Es repetible.** Volver a ejecutarlo deja el mismo estado.

## Orden de aplicación

1. **Pruebas** (`ovfaehoeidxcjrlapioo`) primero. Comprobar que devuelve 4.
2. **N6 real** sobre el commit exacto: debe aprobar **22 controles**, incluido
   `saleAndPaymentIdsRequired`.
3. **Producción** (`wrvokfzrcmmlzekudypu`) solo después, y con autorización aparte de
   Santiago en ese momento.

## Bloque a pegar

El contenido íntegro de `supabase/migrations/20260813050000_exigir_id_en_ventas_y_abonos.sql`,
en el SQL Editor del proyecto correspondiente.

## Comprobación después de aplicar

```sql
select count(*) as identificadores_verificados
from (
  select 1 from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private' and p.proname = 'assert_stone_sale_identifiers'
  union all
  select 1 from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private' and p.proname = 'assert_stock_jewel_sale_identifier'
  union all
  select 1 from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'upsert_stone_lot'
    and p.prosrc like '%assert_stone_sale_identifiers%'
  union all
  select 1 from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'upsert_stock_jewel'
    and p.prosrc like '%assert_stock_jewel_sale_identifier%'
) comprobaciones;
```

**Debe devolver `4`.** Menos de 4 significa que algo no quedó aplicado; no seguir hasta
resolverlo.

## Límite conocido, no cerrado aquí

La regla protege el abono que **conserva** su identificador. Borrar un abono y crear otro con
identificador distinto sigue permitido: es una operación legítima del usuario, y distinguirla
de un fraude exige una decisión de negocio, no una técnica. Queda anotado, sin resolver.
