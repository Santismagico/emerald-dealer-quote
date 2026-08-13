# Prompt para abrir una sesión nueva de trabajo

_Actualizado: **2026-08-12**, al decidir la salida al mercado en beta de 20 cupos.
Copiar desde la línea marcada hasta el final y pegarlo como primer mensaje._

> **Para el agente que actualice este archivo:** es lo primero que lee una sesión nueva. Si
> queda desactualizado, la sesión arranca creyendo cosas falsas y gasta su contexto en
> trabajo equivocado — ya pasó dos veces. **Regenéralo al cerrar cualquier sesión que cambie
> el estado**, y verifica las cifras contra el repositorio, no contra tu memoria.

---

Proyecto: **Emerald Dealer**, aplicación de gestión para el negocio de joyería y esmeraldas
de Santiago (comerciante en Colombia).

**Carpeta canónica en la Mac: `~/Dev/emerald-dealer`.** En el ASUS era
`C:\Dev\emerald-dealer`; cualquier documento que diga esa ruta se refiere a lo mismo. La
copia de OneDrive **fue borrada** el 2026-08-10 porque los agentes trabajaban sobre ella por
error. No la recrees.

**La Mac ya está instalada y verificada** (2026-08-11): 1120 pruebas y build en verde, 0
vulnerabilidades, la app abre en el navegador. `docs/TRASPASO_A_MAC.md` queda solo como
historia; no hay que volver a instalar nada.

## Quién es el dueño — esto manda sobre todo lo demás

Santiago es **principiante absoluto**: no programa, no usa terminales, no interpreta
errores. **Nunca le pidas que ejecute comandos ni que lea código.** Pregúntale **solo
decisiones de negocio**.

Tres cosas aprendidas trabajando con él, que ahorran fricción:

1. **Cuando haya que pegar SQL, dáselo directo en el chat**, en un bloque, completo. No lo
   mandes a abrir archivos y copiar: ahí es donde se corta el texto y se pierde media hora.
2. **Si sugiere una herramienta para ahorrar tiempo o tokens, es una recomendación
   secundaria, no la tarea.** Empieza siempre por el trabajo pendiente.
3. **Sus pruebas de usuario encuentran cosas que ninguna revisión técnica vio.** Cuando
   reporte algo, reprodúcelo antes de opinar.

El camino barato para "¿en qué vamos?" es `git log -1` más el **final** de
`PROJECT_STATE.md`. No releas los documentos grandes.

## Lee primero, en este orden

1. `CLAUDE.md` y `AGENTS.md` — tu rol y las reglas inquebrantables.
2. `PROJECT_STATE.md` — **empieza por el final del archivo.**
3. `docs/README.md` — qué está vigente y qué es historia cerrada.
4. `DECISIONS.md`, de **D-070 a D-077**.

## Estado a 2026-08-12 — verificado

**La aplicación de Santiago está PUBLICADA con socios y fondo funcionando.**

| Enlace | Qué sirve | Quién lo usa |
|---|---|---|
| `emerald-dealer-app` | sitio `a5b9ca1`, compilado de `codex/fase2-nube@4a12ff7` | **Solo Santiago**, con nube. Verificado en vivo |
| `emerald-dealer-quote` | `main` = `d3e5af4` | El piloto: 7 con acceso, **solo 1 usándola**. 100% local, sin servidor. **No se tocó** |

- Rama de trabajo `codex/fase2-nube`. **1133 pruebas en 75 archivos**, build en verde.
- **N6 real APROBADA el 2026-08-12**: **22 controles**, commit `ad0c5ba`, en Pruebas. Es la
  primera vez que se corre contra un servidor real. Detalle completo al final de
  `PROJECT_STATE.md`.
- Puntos de retorno: enlace de la nube → `f9ba18a`; `main` → `0a86e5a`.
- Publicar el enlace de la nube: `docs/PUBLICAR_ENLACE_NUBE.md`. Es **manual**, no hay
  automatismo, y tiene dos trampas documentadas que ya casi causan un accidente.

## La fase de socios y fondo quedó TERMINADA

Las 9 etapas. Varios socios en piedras, material (en **gramos**) y gastos; informe por
persona; fondo de inversión persona por persona; dinero separado por socio en cierres y
consolidado; Excel con hojas de Socios y Fondo; y la nube aplicada en los **dos** servidores,
verificada por contenido (`etapa9_funciones_verificadas = 6`).

## Hallazgo de seguridad del 2026-08-10 — leer antes de tocar permisos

Seis tablas concedían **TRUNCATE** a cualquier cuenta con sesión. **TRUNCATE no respeta Row
Level Security**: cualquiera podía vaciar los datos de todas las joyerías. Causa:
`revoke insert, update, delete` en vez de `revoke all`.

Cerrado en Pruebas y en Producción. Y lo importante: **el mismo error estaba en cuatro
sitios del código** —el informe de piedras, el de gastos, el libro del negocio y el propio
control de seguridad de la publicación, que *exigía* el patrón débil—. Los cuatro
corregidos, con `directWriteLockdown.test.ts` vigilando que no vuelva.

**Lección:** cuando una prueba lleva meses en verde sobre algo delicado, comprueba que falle
si quitas el arreglo. Si no falla, es un adorno.

**Corolario, aprendido al correr N6 el 2026-08-12:** una prueba que **nunca se ejecuta** es
peor que un adorno, porque envejece en silencio. N6 llevaba desde el 2026-08-04 rota —el
servidor volvió obligatorios los quilates y el guion no acompañó— y nadie podía saberlo. Si
una prueba exige manos humanas para correr, o se le quita esa fricción o se le pone una
guarda local que valide lo mismo sin servidor. Aquí se hicieron las dos cosas.

## Lo que sigue

**Santiago decidió el 2026-08-12 sacar el producto al mercado**, asumiendo los riesgos de
producto. El plan completo está en `docs/PLAN_SALIDA_AL_MERCADO.md`; lo esencial:

| | |
|---|---|
| Cupo | **20 cuentas** |
| Prueba | **1 mes gratis** por cuenta |
| Precio | **$80.000 COP**/mes después |
| Cobro | **Manual**, por transferencia. Nada de tarjeta ni débito |
| Mora | **10 días** de gracia, luego **solo lectura** (nunca se pierde consultar ni exportar) |
| Al cancelar | Datos **30 días**, luego eliminación definitiva |

**Corrección importante al estado anterior:** de las "7 joyerías del piloto", **solo 1 usa la
app de verdad**. No repitas la cifra de 7 como si fueran usuarios activos. La migración es un
trámite de una persona, y Santiago aceptó el riesgo de pérdida de datos avisando que exporten
su respaldo antes (Ajustes → Exportar respaldo, que ya funciona).

**Ya construido para esto:** cupo de 20 y borrado de la propia joyería con constancia
(`20260813120000`, aplicado en **Pruebas**, N6 en verde después). Los tres documentos legales
pasaron a `draft-2026-08-12` con precio, mora, conservación y procedimientos redactados.

**Bloquea recibir al primer usuario** (detalle y pasos exactos en el plan):

1. **Supabase Pro.** Sin él el servidor se apaga tras una semana y **no hay copias de
   seguridad** — y los términos ya prometen respaldo diario, así que sin Pro ese texto sería
   falso. Se cobra por organización: cubre los dos proyectos.
2. **Aplicar en Producción** el bloque del cupo y el borrado.
3. **Correo transaccional decente.** El básico de Supabase con 20 personas no técnicas es un
   problema semanal.
4. **Aceptar el acuerdo de datos de Supabase.** Cierra 4 de los 6 huecos legales.
5. **Publicar la app.** La publicada es del 2026-08-10: le falta el arreglo del `id` y la
   versión nueva de los documentos.

**Bloquea el primer COBRO, no el lanzamiento** —el mes gratis compra 30 días—: contador
(régimen tributario e IVA), **modo solo lectura** (prometido en los términos, aún sin
construir), estado de cada cuenta, y abogado (revisión y si aplica registro ante la SIC).

**No hace falta construir:** cobro automático con Wompi (con 20 personas, transferencia y
WhatsApp bastan) ni flujo de invitación (ya existe "Crear cuenta"; el tope lo pone el cupo).

## Reglas que no se rompen

- **No publiques nada sin orden expresa y separada de Santiago en ese momento.**
- **Nunca pidas ni manejes la clave secreta de Supabase.** La configuración pública del
  enlace se saca del bundle ya publicado.
- **No borres ningún proyecto de Supabase.**
- `main`, `.github/workflows/deploy.yml`, `src/calc/engine.ts` y
  `src/services/pdfContent.test.ts` no se tocan.
- Dinero en COP enteros; motores puros; nada de saldos guardados —se DERIVAN (D-023)—;
  migraciones que solo agregan; datos ficticios en todo el repositorio (es público).
- Antes de dar algo por terminado: `npm test`, `npm run build` y **verificación real en el
  navegador** (`preview_start` con `emerald-local-dev`, revisando 320 y 375 px).
- Al terminar: commit, push de la rama y **regenera este archivo** si cambió el estado.

## Pendientes abiertos con Santiago

- **Prueba de usuario sin hacer (2026-08-12):** el arreglo del `id` cambió
  `upsert_stone_lot` y `upsert_stock_jewel` **en Producción**, que son las funciones con las
  que la app de Santiago guarda de verdad. El análisis dice que es compatible y la consulta
  de control dio 4, pero **él todavía no ha guardado una venta con abono desde la app**.
  Confirmarlo con él antes de darlo por cerrado del todo.

- **Pregunta sin responder:** en el panel, "Ganancia" no descuenta los gastos. Él pidió los
  gastos diciendo que "sin gastos, cualquier ganancia sería mentira". Debe decidir si se
  agrega una tercera cifra, *Resultado del negocio*.
- **Valor del inventario vivo:** el informe por socio muestra el **costo**, que es dato
  real. El valor de mercado no se muestra porque nadie ha definido cómo se valora una piedra
  no vendida. **No inventar esa cifra.**
- En el **Xiaomi de Santiago** no abre el selector de fotos (probable permiso de MIUI).
  Falta una nota de ayuda dentro de la app.
- Registro de cobros en Wompi, con RUT y cuenta Bancolombia.

## Tarea de esta sesión

[Santiago: escribe aquí qué necesitas. Por ejemplo: "preparemos la migración de mis
colegas", "hay una corrección que dictar", o "¿en qué vamos?"]
