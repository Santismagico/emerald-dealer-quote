# Prompt para abrir una sesión nueva de trabajo

_Actualizado: **2026-08-11**, al confirmar la instalación en la MacBook.
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

## Estado a 2026-08-11 — verificado

**La aplicación de Santiago está PUBLICADA con socios y fondo funcionando.**

| Enlace | Qué sirve | Quién lo usa |
|---|---|---|
| `emerald-dealer-app` | sitio `a5b9ca1`, compilado de `codex/fase2-nube@4a12ff7` | **Solo Santiago**, con nube. Verificado en vivo |
| `emerald-dealer-quote` | `main` = `d3e5af4` | Las **7 joyerías del piloto**. 100% local, sin servidor. **No se tocó** |

- Rama de trabajo `codex/fase2-nube`. **1120 pruebas en 75 archivos**, build en verde.
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

## Lo que sigue

**El siguiente proyecto que Santiago quiere: migrar a las 7 joyerías del piloto** a la
aplicación con nube, y dejar un solo enlace para pruebas. Hoy usan la versión local, sin
servidor y **sin ningún respaldo**: si a un colega se le daña el teléfono, pierde el
historial de su negocio. Ese es el mejor argumento a favor de migrarlos.

**Tres candados que dejan de ser opcionales antes de esa migración.** Los tres se saltaron
conscientemente para el enlace de Santiago solo, y eso ya no aplica con siete negocios de
terceros:

1. **N6 real** con dos cuentas a través de la app. Nunca se ha corrido sobre este código.
   En Mac: `npm run security:n6:secure:mac` (pide la clave secreta en pantalla, no la
   guarda). Hoy solo hay evidencia de aislamiento **en la base de datos**, probada con dos
   joyerías reales: es fuerte, pero no es lo mismo.
2. **Documentos legales.** Siguen marcados `BORRADOR`, versión `draft-2026-07-20`, sin
   revisión profesional. Con datos de clientes de terceros y cobro de por medio, no se
   sostiene.
3. **Plan pago de Supabase.** El gratuito apaga el proyecto tras una semana sin uso; con
   clientes pagando, eso es la app caída.

Dos cosas más de la misma migración, aún sin resolver: **no existe flujo de invitación** de
joyerías (crear cuentas sería manual, una por una) y **el correo de recuperación de
contraseña** sale por el servicio básico de Supabase, que con siete personas no técnicas es
un problema semanal.

Cuando llegue el momento, la forma sensata es migrar **a un solo colega primero**, con sus
datos, y mirarlo una semana antes de seguir con los demás.

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
