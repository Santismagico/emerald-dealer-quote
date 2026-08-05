# Prompt para abrir una sesión nueva de Claude

_Actualizado: 2026-08-05. Copiar desde la línea siguiente hasta el final y pegarlo como
primer mensaje. **Abrir la sesión en `C:\Dev\emerald-dealer`** (la carpeta de OneDrive es
una copia congelada; si la sesión abrió allí, usa siempre rutas explícitas hacia
`C:\Dev`)._

---

Proyecto: **Emerald Dealer**, aplicación de gestión para el negocio de joyería y
esmeraldas de Santiago (comerciante en Colombia).
Carpeta canónica: `C:\Dev\emerald-dealer`.

## Quién es el dueño — esto manda sobre todo lo demás

Santiago es **principiante absoluto**: no programa, no usa terminales, no interpreta
errores. **Nunca le pidas que ejecute comandos ni que lea código.** Todo lo técnico lo
haces tú. Si algo necesita sus manos, se explica como pasos visuales concretos —"doble
clic en este archivo", "pega con Ctrl+V", "haz clic en el botón verde"— y, si se puede
automatizar con un archivo de doble clic, se automatiza. Hay ejemplos en `PARA-SANTIAGO/`.

Sus pruebas de usuario han encontrado defectos que ninguna revisión técnica vio. Cuando
reporte algo, **reprodúcelo antes de opinar**.

## Lee primero, en este orden

1. `CLAUDE.md` y `AGENTS.md` — tu rol (arquitectura, planificación y auditoría; Codex
   implementa) y las reglas inquebrantables.
2. `PROJECT_STATE.md` — la foto del estado real. **Empieza por el final del archivo.**
3. `docs/PLAN_MAESTRO_V2.md` — el plan grande, ya completo.
4. `docs/PLAN_DE_PUBLICACION_V2.md` — dónde estamos ahora mismo.
5. `DECISIONS.md`, de **D-052 a D-071** — las decisiones del plan v2.

## Estado a 2026-08-05

**Todo el trabajo está terminado y auditado. Nada publicado.**

- **Plan v2 completo:** seis fases (A–F) construidas por Codex y auditadas de forma
  independiente por Claude. Informes en `docs/AUDITORIA_CLAUDE_V2_*.md`.
  A: pantalla de inicio · B: gastos, sociedades en piedras, tipo de producto y moneda ·
  C: talla por tandas y joyas fantasía/natural · D: el libro del negocio (`ledger.ts`) ·
  E: panel, Excel y consolidado · F: catálogo PDF.
- **Dos tandas de corrección** salidas de la prueba de usuario de Santiago, también
  auditadas: `docs/AUDITORIA_CLAUDE_CORRECCIONES_R1.md` y `..._R2.md`.
- **985 pruebas en 68 archivos**, compilación y compilación pública en verde.
- Rama de trabajo `codex/fase2-nube`, unos 95 commits por delante de `main`.
- `main` sigue en `0a86e5a`. **El enlace de los 7 amigos del piloto no se ha tocado.**
- Única dependencia nueva de todo el proyecto: `write-excel-file` 4.1.1, con carga
  diferida y versión exacta (D-066).

## El mapa de Supabase — verificado, no lo adivines

| Proyecto | Ref | Realidad |
|---|---|---|
| **Emerald Dealer Produccion** | `wrvokfzrcmmlzekudypu` | Servidor **real**: a él se conecta el enlace `emerald-dealer-app` que usan Santiago, Héctor y sus socios |
| **Emerald Dealer Pruebas** | `ovfaehoeidxcjrlapioo` | Ensayo, **sin usuarios reales** |
| enlace `emerald-dealer-quote` | — | Los 7 amigos del piloto. **No usa ningún servidor**: es 100% local, en el teléfono de cada uno |

Esto se verificó inspeccionando los bundles publicados. Una versión anterior de la
información estaba equivocada y casi lleva a borrar un proyecto. **Si dudas, verifica el
bundle publicado; no confíes en variables de configuración ni en memoria previa.**

## Dónde estamos exactamente

Santiago pidió publicar. El plan está en `docs/PLAN_DE_PUBLICACION_V2.md` y su orden
**no se puede invertir**: primero el servidor, después la aplicación. Hay 7 migraciones
SQL que aún no están en Produccion; publicar antes de aplicarlas rompería la app.

### ✅ HECHO el 2026-08-05 — no pedirlo otra vez

**El SQL ya se aplicó en Emerald Dealer Pruebas.** Santiago ejecutó
`PARA-SANTIAGO/SQL-PRUEBAS-VERSION-2.sql` y Supabase respondió *"Success. No rows
returned"*, que es la respuesta correcta para instrucciones que crean tablas y políticas.
**El proyecto de Pruebas está al día.**

Hubo dos tropiezos por el camino, ya resueltos, que no deben repetirse:

- La primera versión del archivo **no era repetible** y falló con `42P07: relation
  "organizations" already exists`. Los dos archivos de `PARA-SANTIAGO/` se hicieron
  idempotentes: tablas e índices con `if not exists` y `drop policy if exists` antes de
  cada política.
- El error volvió a salir una segunda vez porque se ejecutó texto viejo que había quedado
  en el editor. Por eso el archivo lleva ahora una **marca visible en su primera línea**
  (`VERSION 2 - CORREGIDA`) y las instrucciones incluyen vaciar el editor con `Ctrl+A` y
  `Suprimir` antes de pegar.

Si Supabase muestra el aviso de Row Level Security, la respuesta correcta es **"Run and
enable RLS"**: las 14 tablas activan RLS dentro del propio script y el aviso es una falsa
alarma de su revisor estático.

### Lo que sigue, en orden

1. **Prueba de aislamiento** (siguiente paso inmediato, en manos de Santiago): doble clic
   en `PARA-SANTIAGO/PASO-2-hacer-la-prueba-de-seguridad.bat`. Le pedirá la clave secreta
   del proyecto de **Pruebas** por consola —sin mostrarla ni guardarla— y generará
   `PARA-SANTIAGO/RESULTADO-DE-LA-PRUEBA.txt`. Santiago te manda ese archivo, pase o
   falle. **Si falla, no se publica nada.**
2. Respaldo desde la app (él y Héctor) y las 7 migraciones a **Produccion** con
   `PARA-SANTIAGO/sql-para-produccion.sql` (doble clic en `PASO-3`, que pide escribir SI).
3. Publicar el enlace de la nube y verificarlo en vivo.
4. **Días después**, y solo si todo va bien, publicar el enlace de los 7 amigos —
   avisándoles antes y pidiéndoles que exporten su respaldo, porque sus datos viven solo
   en su teléfono. Su base local salta de v4 a v8; verificado: los cuatro escalones solo
   crean almacenes nuevos vacíos y no tocan sus datos.

## Reglas que no se rompen

- **No publiques nada sin una orden expresa y separada de Santiago en ese momento.** Que
  el plan exista no autoriza a publicar.
- **Nunca pidas ni manejes la clave secreta de Supabase.** `npm run security:n6:secure`
  la pide por consola sin mostrarla ni guardarla. Si un agente la solicita por chat, algo
  está mal.
- **No borres ningún proyecto de Supabase.**
- `main`, `.github/workflows/deploy.yml`, `src/calc/engine.ts` y
  `src/services/pdfContent.test.ts` no se tocan.
- Dinero en COP enteros; motores puros; migraciones que solo agregan escalones; datos
  ficticios en todo el repositorio (es público).
- Punto de restauración: tag `punto-seguro-pre-v2-2026-08-03`.
- Antes de dar algo por terminado: `npm test` y `npm run build`.

## Pendientes que no bloquean la publicación

- **Pregunta abierta para Santiago:** en el panel, "Ganancia" es el margen de las ventas
  y **no descuenta los gastos** del negocio (arriendo, servicios). Es coherente con
  D-063, pero él pidió los gastos diciendo que "sin gastos, cualquier ganancia sería
  mentira". Debe decidir si se queda así o se agrega una tercera cifra, *Resultado del
  negocio*. Detalle en `docs/AUDITORIA_CLAUDE_CORRECCIONES_R2.md`, observación O1.
- Que Santiago **abra un Excel** y sume una columna: es el único punto que se verificó de
  forma indirecta.
- **Agenda con reserva de citas por parte del cliente**: Santiago la eligió sabiendo que
  es un proyecto aparte. Sin planear. Su mayor riesgo: sería la primera vez que algo
  escribe en la base de datos sin sesión iniciada, y toca el aislamiento entre joyerías.
- Supabase está en **plan gratuito**: 2 proyectos por organización y los proyectos se
  pausan tras una semana sin uso. Hablarlo si más gente empieza a depender de la app.
- Bloqueos premercado anteriores: documentos legales en borrador, SMTP propio, registro
  de cobros.

## Tarea de esta sesión

[Santiago: escribe aquí qué necesitas. Por ejemplo: "ya corrí el SQL en Pruebas, sigamos",
"aquí está el resultado de la prueba de seguridad", o "¿en qué vamos?"]
