# Auditoría independiente de la Fase 2 (nube) — Fable

_Fecha: 2026-07-18. Rama auditada: `codex/fase2-nube` (`b16a0f2`). Auditor: Fable (Claude Opus 4.8)._

Esta auditoría es la revisión independiente exigida en `PROJECT_STATE.md` antes de
considerar publicable la candidata 1.1.0. **No verifica lo que Codex afirma: verifica
el código.** Todo lo marcado como "comprobado" se ejecutó o se leyó directamente en
esta sesión.

## Método

1. Árbol limpio confirmado y diff completo de `main...codex/fase2-nube` leído
   (48 archivos, +4.894 / −121).
2. `npm test` y `npm run build` ejecutados por el auditor, no reportados por terceros.
3. Compilación **pública** reproducida a propósito sin variables de nube para
   comprobar que la app de las siete joyerías del piloto no cambia.
4. Búsqueda directa de secretos en todo el árbol versionado.
5. Lectura línea por línea de: RLS y funciones SQL, `cloud/api.ts`, `cloud/sync.ts`,
   `cloud/outbox.ts`, `cloud/auth.ts`, `cloud/importer.ts`, `store.tsx`, `App.tsx`,
   `db.ts`, `vite.config.ts` y el flujo de publicación.

## Lo que quedó comprobado

| Afirmación de Codex | Resultado |
|---|---|
| 498 pruebas en 34 archivos | **Confirmado** — ejecutadas aquí: 34/34 archivos, 498/498 pruebas, más verificación PWA |
| Compilación 1.1.0 sin errores | **Confirmado** — `npm run build` en verde |
| La app publicada no cambia | **Confirmado** — sin variables de nube, la CSP compilada es idéntica a la vigente (`connect-src 'self' https://api.gold-api.com https://open.er-api.com`) y `App.tsx` entra al camino local exactamente como hoy |
| Ninguna clave en el repositorio | **Confirmado** — cero coincidencias de claves de servicio; `.env` y `.env.*` ignorados y ningún archivo de entorno versionado |
| Aislamiento por organización | **Confirmado por diseño** — RLS activo en las nueve tablas; el navegador autenticado solo conserva `select`; toda escritura pasa por funciones `security definer` que resuelven la organización en el servidor y **nunca aceptan `organization_id` del navegador**; `anon` sin permisos; `org_counters` sin políticas |
| Consecutivo generado en el servidor | **Confirmado** — `next_quote_number()` incrementa un contador por organización dentro de la función protegida |
| Privacidad del cliente intacta | **Confirmado** — `src/services/pdfContent.test.ts` y toda la capa de PDF no fueron tocados |
| Publicación endurecida | **Confirmado** — `deploy.yml` ya no publica por push: exige ejecución manual, el commit exacto aprobado por N6 y escribir `PUBLICAR` |

La prueba de aislamiento en vivo (N6) **no fue reejecutada** por el auditor: requiere la
clave de servicio del proyecto real, que no debe pasar por un agente. Sigue vigente el
bloqueo ya documentado de repetir N6 sobre el commit final exacto que se pretenda publicar.

## Hallazgos

### H1 · MEDIA-ALTA — Los borrados no viajan entre dispositivos y pueden revivir

`src/services/cloud/sync.ts:117` recorre solo las filas que **sí** existen en la nube y
nunca elimina de la caché local lo que ya desapareció del servidor. `indexedDbSyncCache.remove`
está implementado pero ningún camino de sincronización lo llama (`outbox.ts:109` usa otro
`remove`, el de la cola).

Consecuencia real: la joyería borra una cotización en el computador; el teléfono la sigue
mostrando para siempre. Peor: si desde el teléfono se toca esa cotización, se vuelve a
subir y **reaparece en el computador**. Esto golpea justamente la promesa que se va a
cobrar ($50.000/mes por sincronización multidispositivo).

**Corrección sugerida:** en `pullTable`, borrar de la caché los registros locales que no
llegaron en la respuesta remota, respetando las operaciones locales pendientes (no borrar
lo que aún está en la cola de subida).

### H2 · MEDIA — Sin internet no se puede crear una cotización nueva

`cloud/api.ts:227` delega `nextQuoteNumber` directamente al servidor. `PreviewView.tsx:104`
no guarda la cotización hasta tener número. Sin señal, la llamada falla, el guardado queda
en estado de error y la cotización nueva **solo vive en la memoria de la pantalla**: si el
teléfono cierra la PWA, se pierde.

El modo local sí funciona sin conexión; el modo nube, no, para piezas nuevas. Es
contradictorio con "seguir trabajando sin internet" y afecta al joyero que cotiza en la
calle o en una feria.

**Corrección sugerida:** permitir guardar la cotización sin número (borrador local en la
cola) y pedir el consecutivo al servidor en cuanto vuelva la conexión, o reservar números
por adelantado.

### H3 · MEDIA — La sincronización puede detenerse en silencio

`cloud/outbox.ts:111` corta el envío en el primer error para conservar el orden, y todos
los errores se descartan (`catch(() => {})`). Un cambio que el servidor rechace siempre —
por ejemplo un dato que no pase la validación — **bloquea la cola completa de forma
indefinida y sin aviso**. `pendingCount()` y `flush()` existen pero **ninguna pantalla los
usa**: no hay ningún lugar donde el joyero vea "tienes 12 cambios sin subir".

**Corrección sugerida:** mostrar el número de cambios pendientes y la fecha del último
envío exitoso; avisar cuando una operación lleva muchos intentos fallidos.

### H4 · BAJA — Peso muerto en la app publicada

La librería de Supabase (204 kB, 52 kB comprimidos) se compila y **queda precargada en el
service worker incluso en la versión pública**, donde nunca puede ejecutarse. Cada
teléfono del piloto la descargaría en la próxima actualización sin usarla jamás.

**Corrección sugerida:** excluir el trozo de nube del precaché cuando la nube no está
configurada.

### H5 · NOTA — El registro legal apunta a borradores

`cloud/auth.ts:148` sella en cada cuenta `legal_draft_date: '2026-07-17'`. Es honesto y
trazable, pero confirma que hoy un usuario aceptaría **documentos en borrador**. No se
puede abrir el registro a terceros hasta que el contador o un abogado apruebe los textos
(bloqueo ya conocido).

## Veredicto

**La candidata es sólida en lo que más importa y no está lista para publicarse.**

- La arquitectura de seguridad es correcta y conservadora: el navegador no puede escribir
  directamente en ninguna tabla, la organización se resuelve siempre en el servidor y la
  app publicada hoy no se ve afectada de ninguna manera.
- H1 debe corregirse antes de cualquier beta con cuentas reales: es pérdida de confianza
  en el dato, no un detalle estético.
- H2 y H3 deben corregirse antes de cobrar.
- H4 y H5 pueden ir después, pero H5 bloquea abrir el registro a terceros.

Los bloqueos premercado ya registrados (SMTP propio, documentos legales aprobados, nueva
N6 sobre el commit final) siguen vigentes y esta auditoría no los levanta.
