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
