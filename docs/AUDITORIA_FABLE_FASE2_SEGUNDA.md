# Segunda auditoría independiente de la Fase 2 — Fable

_Fecha: 2026-07-18. Rama auditada: `codex/fase2-nube` (`1c4c647`). Auditor: Fable (Claude Opus 4.8)._
_Objeto: la tanda de correcciones C-N1 a C-N4 ordenada en `docs/FASE2_CORRECCIONES_ORDEN_CODEX.md`._

## Veredicto

**Tres de las cuatro correcciones quedaron bien. La primera introdujo un defecto peor
que el que arregló.** La candidata **no** puede pasar a una prueba con colegas.

## Lo que quedó comprobado

| Afirmación de Codex | Resultado |
|---|---|
| 510 pruebas aprobadas | **Confirmado** — ejecutadas aquí: 34/34 archivos, 510/510 |
| C-N4: Supabase fuera de la precarga pública | **Confirmado por prueba propia** — compilación pública reproducida por el auditor: `supabase-CHbdGJvA.js` no aparece en `dist/sw.js` y la CSP sigue siendo exactamente `connect-src 'self' https://api.gold-api.com https://open.er-api.com` |
| C-N2: cotizar sin señal | **Confirmado por lectura** — la cotización se guarda con número vacío y `prepareCloudOperation` (`cloud/api.ts:98`) pide el consecutivo al servidor en el momento de subir. El número definitivo sigue naciendo en el servidor y dos cotizaciones sin conexión no pueden colisionar. `clientDocumentNumberError` bloquea el PDF del cliente mientras no haya número real |
| C-N3: cambios visibles y cola desbloqueada | **Confirmado por lectura** — `outbox.ts` distingue `pending` y `held`, aparta una operación solo tras 5 intentos **y solo si el servidor la rechazó** (no por falta de red), el resto de la cola sigue avanzando, y la cuenta aparece en la pestaña "Más" y en la pantalla de Cuenta con opción de reintentar |
| C-N1: los borrados viajan entre dispositivos | **Confirmado el arreglo, pero ver A1** |
| `main`, publicación y arquitectura de seguridad intactas | **Confirmado** — el diff no toca `main`, `deploy.yml`, RLS ni las funciones protegidas |

## A1 · ALTA — La corrección C-N1 borra el historial del joyero que no importa sus datos

**Reproducido por el auditor**, no deducido. Prueba escrita contra el código real
(`createCloudSync`), con 3 clientes en el dispositivo, la nube respondiendo
correctamente y sin filas, y nada en la cola de subida:

```
esperado: [ 'c-1', 'c-2', 'c-3' ]
recibido: []
```

**Por qué ocurre.** `sync.ts:129` ahora elimina de la caché local todo lo que no llegó en
la respuesta remota, salvo lo que tenga una operación pendiente en la cola. La protección
es correcta pero insuficiente: **el joyero que viene del modo local no tiene nada en la
cola**, porque la cola solo existe desde que entró a la nube. Sus datos no están
"pendientes": están simplemente ahí.

**Cómo lo vive una persona real.** Un joyero del piloto —los siete tienen meses de
trabajo en su teléfono— inicia sesión por primera vez. La app le ofrece subir sus datos.
Toca **"Ahora no"** (`App.tsx:859`), que es un botón legítimo y sin advertencia. Eso
guarda una marca de "ya revisado", entra a la app, y la primera lectura dispara un
`pullTable` contra una nube vacía: **cotizaciones, clientes, citas, lotes y proveedores
desaparecen del teléfono.** No hay confirmación, no hay aviso y no hay vuelta atrás si no
tenía un respaldo exportado.

**Segunda vía, sin siquiera tocar un botón.** Si la nube de esa joyería **no** está vacía
(por ejemplo, porque ya importó desde otro teléfono), la pantalla de importación **no se
ofrece**. El aparato entra directo y borra en silencio todo lo local que nunca se subió.

**Antes de esta tanda esos datos quedaban obsoletos y confusos. Ahora se destruyen.**
Es una regresión: el arreglo es más peligroso que el defecto original.

**Parte de la culpa es de la orden de trabajo.** `FASE2_CORRECCIONES_ORDEN_CODEX.md`
nombró explícitamente el caso de la cola pendiente y no el del joyero que llega desde el
modo local. Codex cumplió la letra de lo que se le pidió.

**Dirección de corrección sugerida** (Codex decide y lo registra en `DECISIONS.md`):
un `pullTable` **no debe borrar nada en un dispositivo que todavía no ha reconciliado su
contenido local con la nube**. Opciones razonables:
- marcar por organización que este dispositivo ya resolvió su importación (subida o
  descarte explícito), y habilitar el borrado por sincronización solo después; o
- borrar únicamente registros que el dispositivo **vio alguna vez en la nube** en un pull
  anterior exitoso, nunca los que solo han existido localmente.

Además, "Ahora no" debe decir la verdad de lo que hace, y el descarte de datos locales
debe ser una decisión consciente, nunca un efecto secundario.

**Pruebas exigidas para cerrarlo.**
1. Dispositivo con datos locales previos, nube vacía, cola vacía → **nada se borra**.
2. Lo mismo con la nube no vacía → los datos locales nunca subidos **sobreviven**.
3. Tras una importación completada, un borrado hecho en otro dispositivo **sí** se aplica
   (no romper C-N1).
4. La prueba 1 debe fallar contra `1c4c647` y pasar tras el arreglo.

## Qué sigue

1. Corregir A1 con sus cuatro pruebas.
2. Tercera auditoría independiente con el mismo método.
3. Solo entonces, prueba con **uno o dos** colegas de confianza — nunca con los siete.

Los bloqueos premercado ya registrados (SMTP propio, documentos legales aprobados,
protección contra contraseñas filtradas y nueva N6 sobre el commit final) siguen vigentes
y esta auditoría no los levanta.
