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
