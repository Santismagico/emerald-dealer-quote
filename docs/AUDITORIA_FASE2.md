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

## N3 — Cuenta, sesión y primera joyería

### Hallazgos

| Severidad | Descripción | Archivo | Corregido en commit |
|---|---|---|---|
| Alta | La aplicación no debe activar la fuente de nube solo por tener variables: también exige una sesión confirmada. | `src/store.tsx` | N3 |
| Media | Los errores originales del proveedor no son adecuados para una persona sin conocimientos técnicos. | `src/services/cloud/auth.ts` | N3 |
| Media | Los documentos legales siguen siendo borradores y contienen campos pendientes; no deben presentarse como definitivos. | `docs/legal/` | Pendiente de aprobación profesional antes de beta |

### Decisiones tomadas

- Cuando la nube está configurada y no existe sesión, la aplicación muestra un muro de acceso; el modo público actual sin variables conserva el recorrido local.
- El registro exige correo, contraseña repetida y aceptación expresa de términos y privacidad.
- La fecha de aceptación y la versión de los borradores se guardan como información de la cuenta.
- Los términos y la política se muestran en vistas internas simples usando directamente los borradores existentes.
- La recuperación de contraseña muestra un mensaje neutral que no confirma si un correo está registrado.
- El primer ingreso sin membresía muestra “Crea tu joyería”; la creación se hace mediante la operación protegida y luego guarda `defaultSettings()` con el nombre elegido.
- La sección Más incluye “Cuenta” únicamente en modo nube con sesión; allí se muestran correo, nombre de joyería y cierre de sesión.
- Al volver desde un enlace de recuperación se solicita una contraseña nueva de mínimo ocho caracteres.
- La confirmación obligatoria de correo se comprobará visualmente en el panel durante N5.

### Pruebas agregadas

- Traducción de errores comunes a español claro.
- Bloqueo de registro sin aceptación legal.
- Normalización del correo y registro de fecha de aceptación.
- Creación de joyería seguida por ajustes iniciales, en el orden correcto.
- Recuperación de contraseña con dirección segura y mensaje neutral.
- Suite completa: 491 pruebas aprobadas y compilación correcta.

## N4 — Importación controlada de datos locales

### Hallazgos

| Severidad | Descripción | Archivo | Corregido en commit |
|---|---|---|---|
| Alta | Una importación grande no debe enviarse como una sola operación ni perder lo pendiente si se corta internet. | `src/services/cloud/importer.ts` | N4 |
| Media | Repetir una importación debe actualizar los mismos identificadores y nunca crear copias. | `src/services/cloud/importer.ts` | N4 |
| Media | Un archivo inválido no debe dejar habilitada por error una fuente elegida anteriormente. | `src/components/CloudImportView.tsx` | N4 |

### Decisiones tomadas

- Tras crear la joyería, se ofrece la importación inicial únicamente cuando la nube está vacía y este dispositivo sí contiene información.
- La opción queda disponible siempre desde Más → Cuenta → “Importar datos de este dispositivo”.
- Antes de subir, la pantalla recomienda y permite descargar un respaldo local.
- La fuente local se obtiene leyendo la base existente; la fuente de archivo reutiliza la validación de respaldos v1 a v5.
- La carga se divide en grupos de 20 registros, muestra cantidad y porcentaje, y confirma cada grupo antes de avanzar.
- Se conservan todos los identificadores. Repetir el proceso actualiza los mismos registros mediante LWW y no duplica.
- Si se corta internet, la importación no declara éxito: informa que lo pendiente quedó protegido en la cola.
- “Ahora no” solo omite la invitación inicial para esa joyería en ese dispositivo; la importación manual continúa disponible.

### Pruebas agregadas

- Respaldo ficticio con 200 cotizaciones e imágenes.
- Avance por lotes hasta 100 %.
- Segunda importación del mismo respaldo sin duplicados.
- Detección de datos locales y nube vacía.
- Corte de conexión con conservación de pendientes.
- Suite completa: 495 pruebas aprobadas y compilación correcta.

## S1 — Frontera única de escritura y validación en servidor

### Hallazgos

| Severidad | Descripción | Archivo | Estado |
|---|---|---|---|
| Alta | El navegador conservaba permisos de escritura directa y podía evitar las validaciones de las operaciones protegidas. | `supabase/migrations/0001_esquema.sql`, `0002_rls.sql` | Corregido por migración nueva |
| Alta | Los datos JSON aceptaban identificadores distintos, fechas absurdas, estados inventados o dinero negativo/fraccionado. | `supabase/migrations/0003_funciones.sql` | Corregido por migración nueva |
| Media | Los objetos futuros podían heredar permisos amplios si una migración olvidaba cerrarlos. | Privilegios por defecto de PostgreSQL | Corregido |

### Decisiones tomadas

- Las lecturas directas continúan aisladas por joyería; crear, editar y eliminar solo se permite mediante operaciones protegidas.
- Las operaciones obtienen la joyería desde la sesión y comprueban la membresía y el rol.
- Ajustes quedan reservados para owner/admin. Los registros operativos permiten owner/admin/seller hasta que exista una matriz de permisos aprobada antes de las invitaciones.
- La base valida identificadores, fechas, estados permitidos y los valores COP críticos como enteros no negativos.
- Existe un retroceso de emergencia separado de las migraciones automáticas. Reabriría temporalmente una frontera menos segura y requiere autorización y corrección inmediata.

### Evidencia

- Prueba previa controlada: 2 pruebas nuevas fallaron antes del cambio, demostrando la ausencia del control.
- Prueba posterior: 497 de 497 aprobadas.
- La estructura y los permisos ya se validaron en el proyecto real de pruebas; el aislamiento completo con dos cuentas sigue pendiente de N6.

## S2 — Controles de candidata y publicación manual

### Decisiones tomadas

- Un cambio en `main` deja de publicar automáticamente.
- La publicación exige una ejecución manual, el commit exacto aprobado por N6 y la palabra `PUBLICAR`.
- Cada candidata revisa dependencias, credenciales, migraciones, pruebas y compilación.
- La evidencia no contiene claves y queda asociada al commit durante 90 días.
- N6 tiene un guardia que se niega a trabajar si la dirección, el nombre y la confirmación no corresponden al proyecto desechable de pruebas.

### Pruebas agregadas

- Detección de archivos privados, llaves, tokens y URLs con contraseña sin imprimir el valor detectado.
- Aceptación de variables y ejemplos que no contienen una credencial real.
- Cinco rechazos del guardia N6 ante proyecto incorrecto, nombre no seguro, marca de producción o confirmación incompleta.
- Comprobación automática de que el flujo público no tiene activación por `push` y exige todos los controles.

### Pendiente antes de beta

- Ejecutar N6 y adjuntar la evidencia al commit exacto.
- Completar el ensayo de uso, modo sin conexión y recuperación de N7.
- Nombrar un revisor independiente antes de aceptar datos reales.

## N5 — Proyecto real de pruebas y conexión segura

### Resultado

- Se creó **Emerald Dealer - Pruebas Fase 2** dentro de la organización Emerald Dealer, región São Paulo, con costo confirmado de US$0 al mes.
- El proyecto anterior **ED Project** de Canadá no se modificó.
- Las cuatro migraciones se aplicaron en orden y quedaron registradas en el historial del proyecto.
- La comprobación real confirmó nueve tablas con RLS activo, seis permisos de lectura autenticada, cero permisos de escritura directa y cero políticas de escritura directa.
- Las catorce operaciones públicas elevadas tienen ruta interna vacía, niegan ejecución anónima y administrativa, y solo permiten la llamada autenticada prevista.
- El registro está habilitado y exige confirmación de correo.
- La URL y la clave publicable viven únicamente en `.env.local`, ignorado por Git. La clave secreta no se extrajo, no se guardó y no se mostró.

### Avisos del proveedor

- `org_counters` aparece con RLS y sin políticas. Es intencional: no admite acceso directo y solo lo usa el consecutivo protegido.
- Supabase advierte que las catorce operaciones elevadas son ejecutables por personas autenticadas. Es la frontera intencional de escritura; cada operación valida sesión, membresía, rol y datos, y no permite elegir otra joyería.
- Los índices aparecen todavía sin uso porque el proyecto está vacío. Se revisarán nuevamente después de N6/N7 con datos ficticios.

### Comprobaciones locales

- CSP aprobada con nube y sin nube; el verificador se corrigió para leer la misma configuración que la compilación.
- Revisión completa: 497 pruebas, compilación correcta, cero vulnerabilidades y ningún secreto detectado.
- Se agregó un asistente de Windows que pide la clave secreta de forma oculta, la mantiene solo durante N6 y la elimina de la sesión al terminar.

### Pendiente para cerrar N5/N6

- Santiago debe copiar una sola vez la clave secreta del proyecto de **pruebas** dentro del aviso oculto. No debe pegarla en el chat ni guardarla en archivos.
- N6 creará y eliminará automáticamente dos cuentas y dos joyerías ficticias. Si falla un solo aislamiento, la fase se detiene.
