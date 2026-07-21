# Prompt para abrir una sesión nueva de Claude (Fable)

_Copiar desde la línea siguiente hasta el final y pegarlo como primer mensaje.
Importante: abrir la sesión en la carpeta `C:\Dev\emerald-dealer` (la de
OneDrive es una copia congelada)._

---

Proyecto: **Emerald Dealer** (PWA de gestión para joyerías de Santiago,
comerciante de esmeraldas en Colombia, en camino a SaaS cobrable).
Carpeta canónica: `C:\Dev\emerald-dealer` (si la sesión abrió en la copia
vieja de OneDrive, trabaja siempre con rutas explícitas hacia C:\Dev).

LEE PRIMERO, EN ESTE ORDEN (contienen todo el contexto; no adivines nada):
1. CLAUDE.md y AGENTS.md — tu rol (arquitectura, planificación, auditoría;
   Codex ejecuta) y las reglas inquebrantables.
2. PROJECT_STATE.md — foto del estado real y el siguiente trabajo exacto.
3. SAAS_PLAN.md — la hoja de ruta de negocio (fases 0–4, calendario a octubre).
4. docs/FASE2_ORDEN_DE_TRABAJO_CODEX.md — el plano de la fase en curso.
5. DECISIONS.md, D-028 a D-041 — decisiones vigentes (identidad, pagos,
   arquitectura de la nube y cierre técnico del primer acceso legal).
6. docs/HOJA_DE_RUTA_CORRECCIONES.md — método de correcciones y su tabla.

ESTADO VERIFICADO AL CIERRE DE LA SESIÓN ANTERIOR (2026-07-20):
- `main` = lo PUBLICADO en https://santismagico.github.io/emerald-dealer-quote/
  — versión 1.0.1 "Emerald Dealer": identidad "mesón del joyero" (claro/oscuro),
  ícono "La gema viva", Fase 1 de auditoría completa (2 hallazgos altos
  corregidos), 468 pruebas en 26 archivos, build con verificación PWA y CSP.
- **Piloto activo:** siete joyerías reales usando la app publicada. La lista de
  sus nombres es PRIVADA de Santiago y JAMÁS se escribe en el repositorio.
- **Fase 2 (nube) CERRADA COMO CANDIDATA, NO PUBLICADA:** vive en
  `codex/fase2-nube`; las tres auditorías de Fable y la regresión A1 están
  cerradas. C14 completó la tanda legal/técnica que Fable dejó inconclusa:
  contraseña temporal y aceptación son independientes, hay dos casillas,
  aviso visible y versiones separadas por documento. Cierre: 521 pruebas en
  35 archivos, PWA, build, CSP y secretos aprobados.
- **Bloqueo legal vigente:** los tres documentos siguen como `BORRADOR` con
  campos `[COMPLETAR]`. Faltan datos reales del negocio, revisión profesional
  y una decisión/implementación para guardar evidencia protegida en servidor;
  la metadata actual solo demuestra el recorrido técnico.
- C13 EN PAUSA: en el Xiaomi de Santiago no abre el selector de fotos (ni
  nativo); diagnóstico: permisos MIUI o app "Archivos" deshabilitada. Incluir
  nota de ayuda para Xiaomi en la próxima tanda de correcciones.

REGLAS QUE NO SE ROMPEN:
- NUNCA push a `main` ni tocar `.github/workflows/deploy.yml` sin la orden
  expresa de Santiago: publica de inmediato a las siete joyerías del piloto.
- Privacidad del cliente final: los tests de `src/services/pdfContent.test.ts`
  son la ley. Dinero en COP enteros; motores puros; migraciones IndexedDB solo
  agregan escalones; datos ficticios en todo el repo (es público).
- Única dependencia nueva autorizada: `@supabase/supabase-js` (D-035). La
  service key de Supabase jamás entra al repositorio.
- Antes de tocar código: `git pull`, árbol limpio, `npm test && npm run build`
  en verde (en PowerShell refrescar el PATH primero; ver CLAUDE.md). Al
  terminar: tests + build + verificación real + commit + push de la rama.
- El shell puede iniciar cada comando en la carpeta vieja de OneDrive:
  prefija SIEMPRE los comandos con `cd /c/Dev/emerald-dealer &&`.

SOBRE SANTIAGO (importante):
Principiante absoluto: no programa ni usa terminales. Nunca pedirle comandos ni
código. Todo en lenguaje empresarial sencillo; preguntarle SOLO decisiones de
negocio. Sus pendientes de calendario: registro del comercio en Wompi (con RUT
y cuenta Bancolombia), borradores de docs/legal al contador, y enviar la
invitación del piloto a sus colegas. Meta: primeros cobros de $50.000 COP/mes
en octubre 2026.

TAREA DE ESTA SESIÓN:
[Santiago: escribe aquí qué necesitas — por ejemplo: "audita la Fase 2 que
Codex terminó", "guíame para crear la cuenta de Supabase", "hay una corrección
que dictar", o "¿en qué vamos?"]
