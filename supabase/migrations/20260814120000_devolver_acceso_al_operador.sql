-- Devolver a `service_role` el acceso a las tablas de operacion.
--
-- QUE PASO. Las migraciones del cupo, el borrado, el modo solo lectura y el
-- control de equipos escribieron:
--   revoke all on table ... from public, anon, authenticated;
-- El patron probado del proyecto (20260811040000) revoca solo de
-- `anon, authenticated`. Agregar `public` parece mas estricto y en PostgreSQL
-- significa **todos los roles**: se llevo por delante el acceso de
-- `service_role`, que es la cuenta con la que el operador y los respaldos
-- trabajan.
--
-- COMO SE ENCONTRO. N6 fallo al intentar marcar una joyeria en solo lectura:
--   «permission denied for table organization_billing».
-- Lo destapo el control nuevo que comprueba que el candado **bloquea**, no solo
-- que no estorba. Sin ese control, el fallo habria aparecido el dia que
-- Santiago intentara suspender a un cliente que no pago.
--
-- IMPACTO REAL antes de esta correccion:
--   - `organization_billing`: el operador NO podia suspender ni reactivar por
--     API. Es el fallo que rompio N6.
--   - `platform_limits`, `deletion_records`, `device_sessions`: sus funciones
--     son `security definer` y seguian funcionando, pero el operador no podia
--     consultarlas ni ajustarlas por API.
--
-- QUE SE HACE. Se conserva el `revoke` estricto —nada se concede de forma
-- implicita— y se devuelve a `service_role` exactamente lo que el operador
-- necesita en cada tabla, ni un permiso mas. Ninguna cuenta con sesion iniciada
-- gana nada con este bloque.
--
-- Es repetible: volver a ejecutarlo deja el mismo estado.

-- El operador suspende y reactiva cuentas: necesita escribir.
grant select, insert, update, delete on table public.organization_billing to service_role;

-- El operador sube o baja el cupo de la beta.
grant select, insert, update on table public.platform_limits to service_role;

-- Las constancias de borrado se entregan a solicitud: basta leerlas.
grant select on table public.deletion_records to service_role;

-- El informe de equipos ya es `security definer`, pero el operador debe poder
-- revisar y depurar el registro a mano.
grant select, delete on table public.device_sessions to service_role;
