# FASE 2 — Orden de corrección para Codex (hallazgos de la auditoría independiente)

> **Origen:** `docs/AUDITORIA_FABLE_FASE2.md` (auditoría independiente de Fable sobre
> `codex/fase2-nube`, commit `b16a0f2`, idéntico en código a `97e73cd`).
> **Autoriza:** Santiago, 2026-07-18.
> **Rama de trabajo:** la misma, `codex/fase2-nube`. No se abre rama nueva.

## Objetivo

Cerrar los cuatro defectos de comportamiento que la auditoría encontró en la candidata
1.1.0. La arquitectura de seguridad **no se toca**: quedó aprobada y cualquier cambio en
RLS o en las funciones protegidas exige una orden aparte.

## Reglas de operación (idénticas a la Fase 2)

1. **Nunca `main`.** Nunca `.github/workflows/deploy.yml`. La app de las siete joyerías
   del piloto no cambia con este trabajo.
2. Antes de tocar código: `git pull`, árbol limpio, `npm test && npm run build` en verde.
3. **Ninguna dependencia nueva.** La única autorizada sigue siendo `@supabase/supabase-js`.
4. Cada corrección entra con **pruebas que fallan antes del arreglo y pasan después**.
   Sin prueba que reproduzca el defecto, la corrección no se acepta.
5. Los tests de `src/services/pdfContent.test.ts` son ley. Datos ficticios siempre.
6. Al terminar cada corrección: pruebas + compilación + verificación real + commit.
   Al cerrar la tanda: push de la rama y actualización de `PROJECT_STATE.md`.
7. **No repetir el error de cobertura de N7:** las pruebas de esta tanda deben simular
   **dos dispositivos** y **ausencia de red**, no un solo navegador conectado.

## C-N1 · Los borrados deben viajar entre dispositivos (PRIORIDAD 1)

**Defecto.** `src/services/cloud/sync.ts:117` (`pullTable`) solo recorre las filas que
existen en la nube y nunca elimina de la caché local lo que ya desapareció del servidor.
`indexedDbSyncCache.remove` está implementado pero ningún camino de sincronización lo
invoca. Un registro borrado en el dispositivo A sigue vivo en el B y, si el B lo edita,
se vuelve a subir y **reaparece en el A**.

**Qué debe lograrse.** Tras un `pullTable`, la caché local refleja lo que hay en la nube:
lo que ya no existe en el servidor desaparece del dispositivo.

**Restricciones innegociables.**
- **Jamás borrar lo que tiene una operación pendiente en la cola de subida.** Un registro
  creado sin conexión todavía no existe en la nube; borrarlo por "no venir en el pull"
  sería destruir trabajo del joyero. Este es el riesgo principal de esta corrección.
- Aplicar la misma prudencia a los `upsert` pendientes, no solo a los `delete`.
- Si la consulta remota falla o llega vacía por error de red, **no borrar nada**: solo se
  reconcilia con una respuesta remota exitosa.

**Pruebas exigidas.**
1. Dispositivo con 3 cotizaciones en caché; la nube devuelve 2 → la tercera desaparece.
2. Dispositivo con una cotización creada sin conexión (pendiente en la cola); la nube no
   la devuelve → **sobrevive**.
3. La cola tiene un `delete` pendiente para un registro que la nube todavía devuelve → no
   revive (comportamiento actual, no debe romperse).
4. `remote.list` lanza error → la caché queda intacta.

## C-N2 · Cotizar sin señal (PRIORIDAD 2)

**Defecto.** `src/services/cloud/api.ts:227` delega `nextQuoteNumber` directamente al
servidor y `src/components/PreviewView.tsx:104` no guarda la cotización hasta tener
número. Sin conexión, la cotización nueva **solo vive en la memoria de la pantalla**: si
el sistema cierra la PWA, se pierde.

**Qué debe lograrse.** El joyero puede empezar y guardar una cotización sin internet. El
consecutivo definitivo se pide al servidor cuando vuelve la conexión.

**Camino sugerido** (Codex puede proponer otro y justificarlo en `DECISIONS.md`):
la cotización se guarda de inmediato en la caché local y en la cola, con el número
vacío o con una marca provisional visible como "sin numerar"; al recuperar conexión se
solicita el consecutivo y se completa. **El consecutivo definitivo se sigue generando
siempre en el servidor** — esa regla no cambia.

**Restricciones.**
- Nunca inventar un número que parezca definitivo. Si el joyero ve "ED-2026-0007", ese
  número debe venir del servidor.
- El PDF del cliente **no debe emitirse con un número provisional**. Si no hay número
  real, la app lo explica en español claro y ofrece guardar y continuar después.
- Dos cotizaciones creadas sin conexión no pueden terminar con el mismo número.

**Pruebas exigidas.**
1. Sin red: se crea y guarda una cotización; al recargar la app sigue ahí.
2. Vuelve la red: recibe un número real del servidor y sube una sola vez.
3. Dos cotizaciones creadas sin red reciben dos números distintos al reconectar.
4. Intento de generar PDF cliente sin número real: bloqueado con mensaje comprensible.

## C-N3 · Que se vea si hay cambios sin subir (PRIORIDAD 3)

**Defecto.** `src/services/cloud/outbox.ts:111` corta el envío en el primer error para
conservar el orden y descarta todos los errores (`catch(() => {})`). Una operación que el
servidor rechace siempre bloquea la cola completa de forma indefinida y en silencio.
`pendingCount()` y `flush()` existen pero **ninguna pantalla los usa**.

**Qué debe lograrse.**
1. Un indicador discreto y permanente donde el joyero vea que hay cambios sin subir
   (por ejemplo, en Cuenta y un aviso sutil cuando la cifra crece).
2. Cuando una operación acumula muchos intentos fallidos, un aviso claro en español que
   no culpe al usuario ni muestre jerga técnica, con la opción de reintentar.
3. La cola **no debe quedar bloqueada para siempre por un solo cambio rechazado**: pasado
   un umbral razonable de intentos, esa operación se aparta para que las demás avancen, y
   lo apartado queda visible y recuperable — **jamás se descarta en silencio**.

**Restricciones.**
- Ningún dato del cliente final aparece en mensajes de error.
- El indicador no puede convertirse en una alarma constante: sin conexión es una
  situación normal, no un fallo.

**Pruebas exigidas.**
1. Con 5 operaciones en cola, la cifra visible es 5; tras subir, es 0.
2. Una operación siempre rechazada no impide que las otras cuatro suban.
3. Lo apartado sigue listado y se puede reintentar.

## C-N4 · Quitar el peso muerto de la app pública (PRIORIDAD 4)

**Defecto.** La librería de Supabase (204 kB, 52 kB comprimidos) se compila y **queda
precargada en el service worker incluso en la compilación pública**, donde nunca puede
ejecutarse.

**Qué debe lograrse.** Cuando la nube no está configurada, ese trozo no entra al precaché
(idealmente, ni se genera).

**Prueba exigida.** Compilación sin `VITE_SUPABASE_URL`: el archivo de la librería no
aparece en la lista de precarga de `dist/sw.js`, y la CSP sigue siendo exactamente
`connect-src 'self' https://api.gold-api.com https://open.er-api.com`.

## Fuera de alcance

- Cualquier cambio en RLS, funciones protegidas o permisos de la base de datos.
- Publicar. Avanzar `main`. Tocar el flujo de despliegue.
- Correo propio (SMTP), textos legales, protección contra contraseñas filtradas: son
  bloqueos premercado de Santiago, no de Codex.
- Invitar a varios miembros a una misma joyería, cobros, Realtime, dominio propio.

## Cierre de la tanda

Codex entrega: las cuatro correcciones con sus pruebas, `npm test && npm run build` en
verde, `DECISIONS.md` con lo que haya decidido en C-N2, `PROJECT_STATE.md` actualizado y
la rama subida. **Después, Fable vuelve a auditar con el mismo método de hoy**: verificar
contra el código, correr las pruebas por su cuenta y revisar el diff completo.

Solo después de esa segunda auditoría se puede pensar en una prueba con uno o dos colegas
de confianza usando cuentas reales — nunca con los siete del piloto de una vez.
