# Prompt para abrir una sesión nueva de trabajo

_Actualizado: **2026-08-10**. Copiar desde la línea siguiente hasta el final y pegarlo como
primer mensaje. **Abrir la sesión en `C:\Dev\emerald-dealer`** (la carpeta de OneDrive es
una copia congelada; si la sesión abrió allí, usa siempre rutas explícitas hacia
`C:\Dev`)._

> **Para el agente que actualice este archivo:** este prompt es la primera cosa que lee una
> sesión nueva. Si queda desactualizado, la sesión arranca creyendo cosas falsas y gasta su
> contexto en trabajo equivocado. **Regenéralo al cerrar cualquier sesión que cambie el
> estado**, y verifica las cifras contra el repositorio en vez de copiarlas de memoria.

---

Proyecto: **Emerald Dealer**, aplicación de gestión para el negocio de joyería y
esmeraldas de Santiago (comerciante en Colombia).
Carpeta canónica: `C:\Dev\emerald-dealer`.

## Quién es el dueño — esto manda sobre todo lo demás

Santiago es **principiante absoluto**: no programa, no usa terminales, no interpreta
errores. **Nunca le pidas que ejecute comandos ni que lea código.** Todo lo técnico lo
haces tú. Si algo necesita sus manos, se explica como pasos visuales concretos —"pega con
Ctrl+V", "haz clic en el botón verde"—. Pregúntale **solo decisiones de negocio**.

Sus pruebas de usuario han encontrado defectos que ninguna revisión técnica vio. Cuando
reporte algo, **reprodúcelo antes de opinar**.

**Si te sugiere una herramienta para ahorrar tokens o tiempo, es una recomendación
secundaria, no la tarea.** Empieza siempre por el trabajo pendiente. El camino barato para
"¿en qué vamos?" es `git log -1` más el **final** de `PROJECT_STATE.md`, no releer los
documentos grandes.

## Lee primero, en este orden

1. `CLAUDE.md` y `AGENTS.md` — tu rol y las reglas inquebrantables.
2. `PROJECT_STATE.md` — la foto real. **Empieza por el final del archivo.**
3. `docs/PLAN_SOCIOS_Y_FONDO.md` — el plan en curso, con sus 9 etapas.
4. `DECISIONS.md`, de **D-070 a D-077** — lo vigente.

## Estado a 2026-08-10 — verificado

**Los dos enlaces están PUBLICADOS desde el 2026-08-05.** Lo que se está construyendo
ahora vive aparte, en la rama, y **no** está publicado.

| Enlace | Qué sirve | Quién lo usa |
|---|---|---|
| `emerald-dealer-quote` | `main` = `d3e5af4` | Las **7 joyerías del piloto**. 100% local, sin servidor |
| `emerald-dealer-app` | compilado de `codex/fase2-nube@0aca89e` | **Solo Santiago**, con nube |

- Rama de trabajo `codex/fase2-nube`, sin publicar. No calcular su estado desde la copia de
  OneDrive: verificarlo en `C:\Dev\emerald-dealer`.
- **1115 pruebas en 74 archivos**, `npm run build` en verde.
- Punto de retorno si algo sale mal en vivo: `main` → `0a86e5a`; el enlace de nube →
  `762dc7c`.

## Trabajo en curso: **Socios y fondo** — Etapa 9 preparada, pendiente en vivo

Nació de lo que Santiago pidió el 2026-08-06: poder repartir una compra entre **varios**
socios y que la app **discrimine a cada uno**, ver eso también en Dinero, tener un informe
por socio, y que **el fondo de amigos no sea una bolsa única** sino gente identificable,
editable y con seguimiento.

| | Etapa | Estado |
|---|---|---|
| ✅ | 1. Motor puro de N socios y devengo del fondo | Hecha |
| ✅ | 2. Base local v9 y respaldo | Hecha |
| ✅ | 3. Piedras con varios socios | Hecha |
| ✅ | 4. Material (en **gramos**) y Gastos (en plata) | Hecha 2026-08-10 |
| ✅ | 5. El fondo, persona por persona (`FundView`) | Hecha 2026-08-10 |
| ✅ | 6. Informe por socio completo (§6 del plan) | Hecha y reforzada 2026-08-10 |
| ✅ | 7. Socios en Cierre del día, Cierre mensual y Consolidado | Hecha y reforzada 2026-08-10 |
| ✅ | 8. Excel por socio y hoja del fondo | Hecha y verificada 2026-08-10 |
| ⏳ | 9. Nube: migración SQL, RPC, RLS y sincronización | Preparada localmente; falta proyecto desechable, N6 y autorización de Producción |

La pantalla Socios ya separa, persona por persona, el fondo, los lotes, el material, los
gastos, la ganancia cobrada y la plata pendiente de cobro. Muestra el **costo real** del
inventario vivo. El **valor estimado de mercado** no se muestra porque todavía falta que
Santiago defina cómo valorar una piedra no vendida; no se debe inventar esa cifra.

La etapa 7 quedó reforzada después de una auditoría independiente: el Consolidado encuentra
a cualquiera de los socios de un lote, los pesos se reparten sin perder residuos, la deuda
pendiente nunca se infla al dividirla y los cierres muestran el resultado de cada venta de
piedras persona por persona.

La etapa 8 añade a los Excel de Cierres, Panel y Consolidado una hoja **Socios**, con una
columna por persona y sumas exactas, y una hoja **Fondo**, con resumen por persona, detalle
de cada aporte, vencimientos e historial de pagos. Dos personas distintas con el mismo
nombre se mantienen en columnas separadas. Los archivos reales fueron abiertos, revisados
visualmente y no mostraron errores.

**Límite consciente y anotado:** Socios y Fondo ya están conectados en la candidata local y
la migración nueva crea `fund_contributions`. Sin embargo, **esa migración no se ha aplicado
a ningún servidor** y N6 no se ha ejecutado sobre este commit. No afirmar que funciona en
vivo hasta cerrar esos pasos. La guía exacta está en `docs/ACTIVACION_ETAPA9_NUBE.md`.

**Decisiones ya tomadas, no volver a preguntarlas:** el material se comparte en **gramos**,
no en plata (confirmado por Santiago el 2026-08-10). Los gastos van en plata y **no** admiten
financiación del fondo. El rendimiento del fondo lo paga Santiago solo, no sus socios de
igualdad (D-075).

## El mapa de Supabase — verificado, no lo adivines

| Proyecto | Ref | Realidad |
|---|---|---|
| **Emerald Dealer Produccion** | `wrvokfzrcmmlzekudypu` | Servidor **real**: a él se conecta `emerald-dealer-app` |
| **Emerald Dealer Pruebas** | `ovfaehoeidxcjrlapioo` | Ensayo, **sin usuarios reales** |
| enlace `emerald-dealer-quote` | — | Los 7 del piloto. **No usa ningún servidor** |

Esto se verificó inspeccionando los bundles publicados. Una versión anterior de esta
información estaba equivocada y casi lleva a borrar un proyecto. **Si dudas, verifica el
bundle publicado.**

**La trampa que costó media sesión:** el editor de Supabase dijo *Success* y solo había
entrado un cuarto del SQL. *Success* **no prueba que entró todo**. Todo pegado grande va en
bloques de 20–30 mil caracteres, sin partir un bloque `$$`, y **cada bloque termina en una
consulta que verifica por CONTENIDO** (`pg_proc.prosrc like '%frase de la versión nueva%'`),
nunca por nombre: casi todas las migraciones reemplazan funciones que ya existen.

Santiago **no quiere archivos de doble clic**: pidió SQL para copiar y pegar. Rutina fija,
misma pestaña: clic dentro · `Ctrl+A` · `Suprimir` · `Ctrl+V` · `Run`. Si aparece el aviso
de Row Level Security, la respuesta correcta es **"Run and enable RLS"**.

## Cómo verificar en el navegador

`preview_start` con la configuración **`emerald-local-dev`** (puerto 5175) abre la app en
modo local, sin nube ni inicio de sesión — útil porque la configuración normal pide
contraseña y un agente no debe escribirla. Usa `--mode sinnube` y `.env.sinnube.local`.
Revisa siempre a **320 y 375 px** que no haya desbordamiento horizontal.

## Reglas que no se rompen

- **No publiques nada sin una orden expresa y separada de Santiago en ese momento.** Que el
  plan exista no autoriza a publicar. Un push a `main` llega a las 7 joyerías del piloto.
- **Nunca pidas ni manejes la clave secreta de Supabase.**
- **No borres ningún proyecto de Supabase.**
- `main`, `.github/workflows/deploy.yml`, `src/calc/engine.ts` y
  `src/services/pdfContent.test.ts` no se tocan.
- Dinero en COP enteros; motores puros; nada de saldos guardados —se DERIVAN (D-023)—;
  migraciones que solo agregan escalones; datos ficticios en todo el repositorio (es
  público).
- Antes de dar algo por terminado: `npm test` y `npm run build`, y **verificación real en
  el navegador**. En Windows/PowerShell refresca el PATH primero.
- Al terminar: commit y push de la rama, y **regenera este archivo** si cambió el estado.

## Pendientes abiertos con Santiago

- **Pregunta sin responder:** en el panel, "Ganancia" es el margen de las ventas y **no
  descuenta los gastos** (arriendo, servicios). Él pidió los gastos diciendo que "sin
  gastos, cualquier ganancia sería mentira". Debe decidir si se queda así o se agrega una
  tercera cifra, *Resultado del negocio*. Detalle en
  `docs/historico/AUDITORIA_CLAUDE_CORRECCIONES_R2.md`, observación O1.
- **Redacción del informe por socio:** al compartir un mismo lote entre dos personas, cada
  tarjeta habla del mismo registro. Ya se corrigió para que no se pueda sumar dos veces,
  pero conviene mostrárselo cuando exista la etapa 6.
- Que Santiago **abra un Excel** y sume una columna: único punto verificado de forma
  indirecta.
- **Agenda con reserva de citas por el cliente:** él la eligió sabiendo que es un proyecto
  aparte y grande. Sin planear. Su mayor riesgo: sería la primera vez que algo escribe en
  la base sin sesión iniciada, y toca el aislamiento entre joyerías.
- En el **Xiaomi de Santiago** no abre el selector de fotos (probable permiso de MIUI).
  Falta una nota de ayuda dentro de la app.
- Supabase está en **plan gratuito**: 2 proyectos por organización y se pausan tras una
  semana sin uso.
- Bloqueos anteriores que siguen: documentos legales en borrador, SMTP propio, registro de
  cobros en Wompi.

## Tarea de esta sesión

[Santiago: escribe aquí qué necesitas. Por ejemplo: "activemos la etapa 9 en el proyecto de
pruebas", "hay una corrección que dictar", o "¿en qué vamos?"]
