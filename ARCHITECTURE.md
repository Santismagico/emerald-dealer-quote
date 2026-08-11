# ARCHITECTURE — Emerald Dealer Quote

## Visión general

Emerald Dealer es una aplicación React + TypeScript compilada con Vite e instalable como
PWA. Funciona primero con la base local del dispositivo y, cuando la edición con cuenta está
habilitada, usa Supabase para sincronizar los datos entre equipos.

La misma aplicación conserva dos modos reales:

- **Local:** IndexedDB es la fuente de datos. No exige cuenta ni servidor.
- **Con cuenta:** IndexedDB sigue siendo la caché local y una cola protegida lleva los
  cambios a Supabase. Si se pierde internet, el trabajo queda pendiente y continúa después.

```text
Pantallas React
      │
      ▼
store.tsx + dataSource.ts
      │
      ├── modo local ──► storage.ts ──► IndexedDB
      │
      └── modo cuenta ─► cloud/api.ts
                           ├── caché IndexedDB
                           ├── cola de cambios
                           ├── sincronización por updatedAt
                           └── Supabase: lectura aislada + operaciones protegidas
```

## Capas principales

- `src/calc/engine.ts`: motor de cotización puro, sin pantalla, base de datos ni red.
- `src/services/`: reglas del negocio, cálculos, persistencia, respaldos, PDF, Excel y nube.
- `src/services/storage.ts`: operaciones locales del negocio.
- `src/services/cloud/`: autenticación, cola, sincronización, importación y operaciones de
  servidor.
- `src/types/`: contrato actual de todos los datos.
- `src/components/`: pantallas y piezas visuales, siempre en español y mobile-first.

## Persistencia local y respaldos

La base `emerald-dealer-quote` usa IndexedDB, versión 9. Conserva ajustes, clientes,
cotizaciones, agenda, piedras, proveedores, compradores, joyas, socios, materiales, gastos,
aportes del Fondo y la cola de nube.

El respaldo vigente es JSON v9 y acepta respaldos anteriores v1–v9. Una importación reemplaza
datos solo después de confirmación y ocurre de forma completa: si algo falla, no deja media
restauración aplicada.

## Nube y aislamiento

Cada joyería es una organización. Todo registro del servidor pertenece a una
`organization_id`, pero el navegador nunca decide ni envía esa organización al guardar o
borrar. Las operaciones protegidas la resuelven desde la sesión iniciada.

Reglas permanentes:

1. Las tablas editables tienen aislamiento por organización.
2. Un usuario autenticado puede leer únicamente los datos de su organización.
3. La escritura directa está cerrada; guardar y borrar pasan por funciones protegidas.
4. Las funciones públicas conceden acceso explícito solo al rol necesario.
5. Las funciones con privilegios fijan un entorno de ejecución seguro.
6. Una cuenta anónima no puede leer ni escribir datos del negocio.

Las 12 áreas editables que cubre la prueba N6 son: ajustes, clientes, cotizaciones, agenda,
piedras, proveedores, compradores, joyas, socios, materiales, gastos y aportes del Fondo.

## Sincronización y trabajo sin conexión

- Cada cambio local se guarda primero en IndexedDB y entra a una cola.
- La cola conserva el orden, reintenta fallos de conexión y aparta un cambio que el servidor
  rechace de forma definitiva.
- Al leer se comparan las fechas de actualización: gana el cambio más reciente.
- Ante duda, se conserva el dato local. Un registro local solo se elimina al confirmar que
  este dispositivo ya lo había visto en la nube y que no existe un cambio pendiente.
- Piedras y joyas se reconcilian juntas cuando una transformación conecta ambas historias.
- Los aportes del Fondo que existían antes de la Etapa 9 se encolan una sola vez cuando la
  versión nueva inicia su sincronización.

## Socios y Fondo

- Una sociedad se declara con dinero puesto; en materiales se declara con gramos. Los
  porcentajes se derivan y no son la fuente de verdad.
- El dinero del Fondo es deuda, no participación. No diluye el reparto de los socios.
- El Fondo es una lista de aportes por persona; no existe un saldo total guardado.
- Renombrar una persona actualiza su nombre en piedras, materiales, gastos y Fondo.
- Borrar su ficha conserva nombres, montos, gramos, pagos e historia; solo suelta el vínculo.
- La base rechaza socios repetidos, repartos que superen el total, dinero no entero y pagos
  inválidos o repetidos.

## Privacidad de documentos

El documento para clientes nunca incluye margen, utilidad, costo interno, precio por gramo,
pureza, fórmula del oro ni notas internas. El contenido se construye y verifica antes de
generar o compartir el PDF. Compartir un PDF de cliente es independiente de WhatsApp y
nunca usa respaldos internos como alternativa.

## Estado de la Etapa 9

La implementación y la migración están preparadas en `codex/fase2-nube`. La migración no se
considera aplicada ni la etapa se considera validada en vivo hasta que:

1. se ejecute el SQL completo en el proyecto desechable de pruebas;
2. la comprobación final devuelva 6 funciones con el contenido esperado;
3. N6 pase entre dos cuentas sobre el commit exacto;
4. Santiago autorice por separado la aplicación en Producción.

Nada de lo anterior autoriza publicar la aplicación ni modificar `main`.
