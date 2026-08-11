# FASE 2 — Orden de corrección A1 para Codex (regresión de C-N1)

> **Origen:** `docs/AUDITORIA_FABLE_FASE2_SEGUNDA.md` (segunda auditoría independiente
> de Fable sobre `codex/fase2-nube`, commit `1c4c647`).
> **Autoriza:** Santiago, 2026-07-18.
> **Rama de trabajo:** la misma, `codex/fase2-nube`. No se abre rama nueva.
> **Alcance:** un solo defecto. No se toca nada más.

## Qué está mal

La corrección C-N1 hizo que `pullTable` (`src/services/cloud/sync.ts:129`) elimine de la
caché local todo lo que no llegó en la respuesta remota, protegiendo únicamente lo que
tiene una operación pendiente en la cola de subida.

**Esa protección es insuficiente.** El joyero que viene del modo local no tiene nada en la
cola: la cola solo existe desde que entró a la nube. Sus datos no están "pendientes",
están simplemente ahí. La primera sincronización los borra.

Reproducido por el auditor con 3 clientes en el dispositivo, la nube respondiendo
correctamente y sin filas, y la cola vacía → los 3 desaparecieron.

**Dos caminos reales para llegar al desastre:**

1. El joyero inicia sesión, la app le ofrece subir sus datos y él toca **"Ahora no"**
   (`src/App.tsx:859`). Es un botón legítimo, sin advertencia. Se guarda la marca de
   revisado, entra a la app y la primera lectura borra su historial completo.
2. Si la nube de esa joyería **no** está vacía (ya importó desde otro aparato), la
   pantalla de importación **ni se ofrece**: entra directo y borra en silencio todo lo
   local que nunca se subió.

Los siete joyeros del piloto tienen meses de trabajo en su teléfono. Este es exactamente
su escenario.

## Qué debe lograrse

**Un `pullTable` no puede borrar nada en un dispositivo que todavía no ha reconciliado su
contenido local con la nube.** La sincronización de borrados (C-N1) debe seguir
funcionando una vez que esa reconciliación ocurrió.

Caminos razonables — **Codex elige uno, lo justifica y lo registra en `DECISIONS.md`**:

- **(a)** Marcar por organización que este dispositivo ya resolvió su importación —subida
  completada o descarte explícito y consciente— y habilitar el borrado por sincronización
  solo después. La marca debe vivir donde sobreviva a un cierre de la app.
- **(b)** Borrar únicamente registros que el dispositivo **vio alguna vez en la nube** en
  un pull anterior exitoso; nunca los que solo han existido localmente.

La opción (b) es más robusta porque no depende de que una marca se haya guardado bien, y
protege también al usuario que llegó por el camino 2. Si Codex elige (a), debe explicar
cómo cubre ese camino.

## Además: "Ahora no" debe decir la verdad

Hoy ese botón parece decir "lo hago después" y en realidad significa "sigue adelante sin
mis datos". Debe quedar claro, en español sencillo, qué pasa con lo que hay en el
teléfono. **Descartar datos locales tiene que ser una decisión consciente del joyero,
nunca un efecto secundario de tocar el botón suave.**

Si tras la corrección los datos locales ya no se destruyen, el texto igual debe explicar
qué verá el joyero (sus datos locales siguen en el teléfono pero no en la nube), para que
"Ahora no" no genere una expectativa falsa.

## Restricciones innegociables

1. **No romper C-N1.** Un borrado hecho en otro dispositivo debe seguir aplicándose una
   vez que el dispositivo ya está reconciliado.
2. No tocar RLS, funciones protegidas, permisos de base de datos, `main`, la publicación
   ni `deploy.yml`.
3. Ninguna dependencia nueva.
4. Ante la duda, **conservar el dato**. Este defecto destruye trabajo real: cualquier
   ambigüedad se resuelve a favor de no borrar.

## Pruebas exigidas

1. Dispositivo con datos locales previos, nube vacía, cola vacía → **no se borra nada**.
   Esta prueba debe **fallar contra `1c4c647`** y pasar tras el arreglo.
2. Lo mismo con la nube **no** vacía → los datos locales que nunca se subieron
   **sobreviven**.
3. Tras una importación completada, un borrado hecho en otro dispositivo **sí** se aplica.
4. `remote.list` falla → la caché queda intacta (no romper lo ya cubierto).

La prueba 1, tal como la escribió el auditor, es el punto de partida:

```ts
// El teléfono trae 3 clientes de la etapa local. Nada en la cola de subida.
const sync = createCloudSync({
  remote: { list: async () => [] },          // cuenta nueva: responde bien y sin filas
  cache: { list: async () => [...cache.values()], put, remove },
  listPending: async () => []                 // la cola nunca existió
});
await sync.pullTable('clients');
expect([...cache.keys()]).toEqual(['c-1', 'c-2', 'c-3']);
```

## Fuera de alcance

Todo lo demás. C-N2, C-N3 y C-N4 quedaron aprobadas en la segunda auditoría y no se
tocan. SMTP, textos legales, contraseñas filtradas y la nueva N6 son bloqueos de
Santiago, no de esta orden.

## Cierre

Pruebas + compilación + verificación real + `DECISIONS.md` + `PROJECT_STATE.md` + commit
+ push de la rama. Después, **tercera auditoría independiente de Fable** con el mismo
método. Solo entonces se puede pensar en una prueba con uno o dos colegas de confianza.
