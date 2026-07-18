# Auditoría Fase 2 — cuentas y sincronización

Informe acumulativo para la revisión final de Fable.

## N0 — Protección y bandera de nube

### Hallazgos

| Severidad | Descripción | Archivo | Corregido en commit |
|---|---|---|---|
| Media | Los proyectos nuevos de Supabase pueden no exponer tablas automáticamente a la Data API; las migraciones deberán incluir permisos explícitos además de RLS. | `supabase/migrations/` | Se implementa en N1 |

### Decisiones tomadas

- La nube solo se activa cuando existen juntas `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- El cliente oficial se carga dinámicamente y se crea una sola vez. Sin variables, la app conserva el flujo local actual y no solicita el módulo de Supabase en ejecución.
- La CSP solo agrega el origen HTTPS configurado de Supabase en builds de nube. Sin variables mantiene exactamente los dos destinos existentes del precio del oro.
- `@supabase/supabase-js` queda fijado en la versión 2.110.7. No se agregó ninguna otra dependencia.
- `.env`, `.env.*` y por tanto `.env.local` ya están excluidos del repositorio.

### Pruebas agregadas

- Bandera desactivada si falta URL o clave.
- Bandera activada solo con ambas variables.
- Build y CSP verificados sin variables y con variables ficticias.

## N1 — Esquema, aislamiento y operaciones protegidas

### Hallazgos

| Severidad | Descripción | Archivo | Corregido en commit |
|---|---|---|---|
| Alta | Una función con permisos elevados podría saltarse el aislamiento si aceptara el identificador de la joyería desde el navegador. | `supabase/migrations/0003_funciones.sql` | N1 |
| Media | Los proyectos nuevos requieren permisos explícitos para que la API de datos alcance las tablas, además de las políticas de aislamiento. | `supabase/migrations/0001_esquema.sql` | N1 |

### Matriz de acceso

| Información | Lectura | Escritura directa | Operación protegida |
|---|---|---|---|
| Joyería | Solo miembros | No | Crear primera joyería |
| Membresías | Cada persona ve la suya | No | No disponible en V1 |
| Configuración | Miembros de la joyería | Sí, aislada | Guardado con fecha más reciente |
| Clientes, cotizaciones, citas, lotes y proveedores | Miembros de la joyería | Sí, aislada | Guardar y eliminar sin aceptar otra joyería |
| Consecutivo de cotización | No | No | Incremento único y seguro |

### Decisiones tomadas

- Las nueve tablas tienen aislamiento activado, incluso las que no ofrecen acceso directo.
- Cada tabla editable tiene reglas separadas para consultar, crear, actualizar y eliminar.
- Ninguna operación protegida recibe el identificador de una joyería desde la aplicación; lo obtiene de la sesión autenticada.
- Las operaciones protegidas fijan su ruta interna, validan la sesión y niegan uso público o anónimo.
- El guardado aplica “gana el cambio más reciente” mediante `updated_at`.
- Los archivos quedaron preparados, pero no se aplicaron a ningún proyecto real en N1.

### Pruebas agregadas

- Presencia de todas las tablas y aislamiento activado en cada una.
- Cobertura por operación para las seis tablas editables.
- Bloqueo de cambios directos en membresías y consecutivos.
- Permisos explícitos sin acceso anónimo.
- Protección y permisos exactos de las operaciones elevadas.

## N2 — Trabajo sin conexión y sincronización

### Hallazgos

| Severidad | Descripción | Archivo | Corregido en commit |
|---|---|---|---|
| Alta | Si dos envíos se ejecutaran al tiempo, una respuesta lenta podría dejar información en un orden incorrecto. | `src/services/cloud/outbox.ts` | N2 |
| Alta | Un corte de internet a mitad de un envío no puede eliminar el cambio fallido ni los cambios que todavía no salieron. | `src/services/cloud/outbox.ts` | N2 |
| Media | Una lectura desde la nube no debe reemplazar una edición local más reciente que todavía está pendiente. | `src/services/cloud/sync.ts` | N2 |

### Decisiones tomadas

- La base local sube de la versión 4 a la 5 agregando únicamente `cloudOutbox` al final de la escalera; no se reordena ni elimina ningún almacén anterior.
- La cola es persistente, procesa un cambio a la vez y conserva los fallos con esperas crecientes antes de reintentar.
- La cola intenta continuar al recuperar internet y cuando la aplicación vuelve a primer plano.
- Las lecturas de nube pasan por la normalización existente y se guardan en la caché local.
- En un conflicto gana la fecha más reciente. Una eliminación local pendiente no se revive durante una lectura.
- La aplicación conserva la fuente local si falta configuración o sesión. La nube solo puede seleccionarse cuando existen ambas.
- El consecutivo en modo nube se solicita a la operación protegida del servidor; no se inventan consecutivos distintos mientras no hay conexión.
- Todas las pruebas usan sustitutos en memoria. No hubo llamadas de red ni se conectó un proyecto real.

### Pruebas agregadas

- Procesamiento estrictamente serial.
- Reintento con espera creciente.
- Corte de red a mitad del envío con conservación de pendientes.
- Conflicto resuelto a favor de la versión remota más reciente.
- Conflicto resuelto a favor de la edición local más reciente.
- Eliminación pendiente protegida frente a una lectura remota.
- Traducción exacta hacia las operaciones protegidas usando Supabase simulado.
- Selector local/nube para las tres combinaciones posibles de configuración y sesión.
- Migración local a la versión 5 sin perder los almacenes anteriores.
