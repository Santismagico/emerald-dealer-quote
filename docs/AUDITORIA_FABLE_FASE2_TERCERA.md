# Tercera auditoría independiente de la Fase 2 — Fable

_Fecha: 2026-07-18. Rama auditada: `codex/fase2-nube` (`be226f0`). Auditor: Fable (Claude Opus 4.8)._
_Objeto: la corrección A1 ordenada en `docs/FASE2_CORRECCION_A1_ORDEN_CODEX.md`._

## Veredicto

**A1 quedó corregida y verificada de forma independiente.** No quedan defectos que
destruyan o pierdan datos. Desde el punto de vista técnico, la candidata está lista para
una prueba controlada con uno o dos colegas de confianza. **La decisión de hacer esa
prueba no es técnica: ver "Lo que esto no levanta".**

## Lo que quedó comprobado

| Afirmación de Codex | Resultado |
|---|---|
| 512 pruebas aprobadas | **Confirmado** — ejecutadas aquí: 34/34 archivos, 512/512 |
| Los datos exclusivamente locales ya no se borran | **Confirmado por pruebas propias del auditor** (ver abajo) |
| Los borrados entre dispositivos siguen funcionando tras reconciliar | **Confirmado por prueba propia** |
| La prueba original falla antes y pasa después | **Confirmado** — la misma prueba que devolvió `[]` contra `1c4c647` ahora conserva los tres registros |
| "Ahora no" explica lo que hace | **Confirmado** — el botón pasó a "Seguir sin subir estos datos", sobre un aviso que explica que los datos seguirán solo en ese dispositivo y no aparecerán en otros hasta subirlos desde Cuenta |
| C-N2, C-N3, C-N4, seguridad, `main` y despliegue intactos | **Confirmado** — el diff toca 5 archivos: `sync.ts`, su prueba, `CloudImportView.tsx`, `DECISIONS.md` y `PROJECT_STATE.md`. Nada más |
| Ningún secreto | **Confirmado** — verificación ejecutada por el auditor |
| Compilación pública correcta | **Confirmado por compilación propia** — Supabase fuera del precaché y CSP exactamente `connect-src 'self' https://api.gold-api.com https://open.er-api.com` |

### Pruebas propias del auditor

Cinco pruebas escritas por el auditor contra `createCloudSync`, ejecutadas sobre
`be226f0`. **Las cinco pasan.**

1. Datos locales previos + nube vacía + cola vacía → **no se borra nada**.
   (Contra `1c4c647` esta prueba devolvía `[]`.)
2. Nube **no** vacía → lo local nunca subido **sobrevive** junto a lo que sí está en la nube.
3. Tras reconciliar, un borrado hecho en otro dispositivo **sí** se aplica (C-N1 intacta).
4. La consulta remota falla → la caché queda **intacta**.
5. Un registro ya reconciliado con un cambio pendiente en la cola **no se borra**.

### La solución elegida

Codex tomó la opción (b) de la orden, registrada en **D-040**: solo se reconcilian
borrados de registros que este dispositivo ya vio o subió a la nube, marcados con la
señal durable `cloudUpdatedAt`. Un registro anterior al modo nube no tiene esa señal y
nunca se elimina por faltar en un `pull`.

Es la opción correcta: no depende de que una marca de "ya importé" se haya guardado bien,
y protege igual al teléfono que entra a una joyería cuya nube ya tiene datos de otro
aparato — el segundo camino del defecto, el que no requería tocar ningún botón.

## O1 · BAJA — Ventana estrecha entre guardar y encolar

`cloud/api.ts` (`cacheAndQueue`) escribe primero en la caché y después en la cola. La
escritura en caché ya marca el registro como parte de la nube. Si el sistema operativo
matara la app **exactamente entre esas dos escrituras**, quedaría un registro marcado
como reconciliado, sin operación pendiente y sin haber llegado nunca al servidor: un
`pull` posterior lo borraría.

Son dos escrituras consecutivas a IndexedDB, así que la ventana es de fracciones de
milisegundo y exige que el sistema mate el proceso justo ahí. **No es un bloqueo.** Se
anota porque el costo de cerrarla es bajo: encolar antes de escribir en caché (si el
corte ocurre en medio, el dato viaja igual a la nube), o marcar la señal únicamente en
los `pull` en lugar de en las escrituras locales.

Queda a criterio de Santiago si se corrige ahora o se anota como deuda.

## Lo que esto NO levanta

La aprobación es **técnica**. Antes de que un colega cree una cuenta real siguen abiertos
los bloqueos ya registrados, y uno de ellos es una decisión de negocio, no de código:

1. **Documentos legales aún en borrador.** En el momento en que un colega registra a sus
   propios clientes en la nube, hay datos personales de terceros en un servidor bajo unos
   términos que ningún profesional ha revisado (Ley 1581 de 2012). Esto no lo resuelve
   ninguna corrección de código.
2. **SMTP propio** sin probar (los correos de acceso y recuperación).
3. **Protección contra contraseñas filtradas** — requiere plan Pro de Supabase, o aceptar
   el riesgo por escrito.
4. **Nueva N6** sobre el commit exacto que se pretenda publicar.

Recomendación del auditor: si Santiago quiere avanzar antes de tener los documentos
aprobados, que la prueba se haga con **datos ficticios** o con clientes propios, no con la
cartera real de un colega. Eso permite validar la nube sin trasladar datos personales de
terceros a un servidor bajo términos en borrador.

## Estado de la candidata

Los cinco defectos hallados en las tres auditorías (H1 a H4 y A1) están corregidos y
verificados de forma independiente. Queda O1 como observación menor. **`main` y la
aplicación pública nunca fueron modificadas en todo este proceso.**
