-- Cerrar la escritura directa que quedo abierta en seis tablas.
--
-- QUE PASO. Las migraciones que agregaron estas tablas usaron
--   revoke insert, update, delete ... from authenticated
-- en vez de
--   revoke all ... from authenticated
-- La diferencia parece cosmetica y no lo es: `revoke insert, update, delete`
-- deja intactos TRUNCATE, REFERENCES y TRIGGER, que Supabase concede por
-- defecto a `authenticated` en cada tabla nueva del esquema public.
--
-- POR QUE ES GRAVE. **TRUNCATE no respeta Row Level Security.** La politica que
-- impide que una joyeria lea los datos de otra no se aplica a un vaciado de
-- tabla. Cualquier cuenta con sesion iniciada podia, en teoria, vaciar los
-- gastos, el material, los compradores, las joyas en stock, los socios y el
-- fondo de TODAS las joyerias de un solo golpe.
--
-- COMO SE ENCONTRO. Auditando los permisos del proyecto desechable el
-- 2026-08-10, comparando cada tabla contra `stone_lots`, que si estaba bien.
-- El agujero existia desde el 2026-08-03 y ninguna prueba lo miraba.
--
-- ESTADO OBJETIVO. Con sesion iniciada solo se LEE. Toda escritura pasa por las
-- funciones protegidas, que son las unicas que deciden a que joyeria pertenece
-- cada fila. `service_role` conserva todo: los respaldos y la importacion no
-- cambian.
--
-- Es repetible: volver a ejecutarlo deja el mismo estado.

revoke all on table public.buyers from anon, authenticated;
grant select on table public.buyers to authenticated;

revoke all on table public.expenses from anon, authenticated;
grant select on table public.expenses to authenticated;

revoke all on table public.fund_contributions from anon, authenticated;
grant select on table public.fund_contributions to authenticated;

revoke all on table public.material_lots from anon, authenticated;
grant select on table public.material_lots to authenticated;

revoke all on table public.material_partners from anon, authenticated;
grant select on table public.material_partners to authenticated;

revoke all on table public.stock_jewels from anon, authenticated;
grant select on table public.stock_jewels to authenticated;

-- Comprobacion por CONTENIDO. Las siete tablas deben decir exactamente SELECT.
-- `stone_lots` va incluida a proposito: es el patron correcto de referencia.
select table_name as tabla,
       coalesce(
         string_agg(distinct privilege_type, ', ' order by privilege_type),
         'sin permisos'
       ) as permisos_con_sesion
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'authenticated'
  and table_name in (
    'buyers', 'expenses', 'fund_contributions', 'material_lots',
    'material_partners', 'stock_jewels', 'stone_lots'
  )
group by table_name
order by table_name;
