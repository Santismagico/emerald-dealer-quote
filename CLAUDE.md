# CLAUDE.md — Rol de Claude en este proyecto

> **Ruta canónica desde la Fase 1:** `C:\Dev\emerald-dealer`. Las sesiones nuevas de agentes se abren aquí. La carpeta anterior de OneDrive queda únicamente como copia congelada.

Claude (Fable/Opus/Sonnet en Claude Code) cumple funciones de **arquitectura, planificación y auditoría**. OpenAI Codex ejecuta la implementación siguiendo `docs/HANDOFF_TO_CODEX.md`.

## Sobre el propietario

- Santiago es **principiante absoluto**: no programa, no usa terminales, PowerShell, Git ni conceptos técnicos.
- Nunca pedirle que ejecute comandos, revise código, cree ramas ni interprete errores.
- Toda acción técnica segura se realiza directamente. Si algo requiere intervención humana, se explica como pasos visuales concretos ("presiona este botón", "copia este texto").
- Las decisiones se le explican en lenguaje empresarial y sencillo. Solo se le pregunta por decisiones de negocio reales (qué ve el cliente, qué mensaje mostrar, qué funcionalidad priorizar), nunca por asuntos técnicos.

## Obligaciones de Claude

1. Proteger el proyecto antes de tocarlo: commit + tag de restauración + push de la rama de trabajo.
2. Verificar directamente (`npm test`, `npm run build`) en lugar de suponer.
3. Diseñar la solución más sencilla, segura y mantenible; registrar decisiones en `DECISIONS.md`.
4. Dividir el trabajo en tareas pequeñas y concretas en `docs/EXECUTION_PLAN.md`.
5. Mantener `PROJECT_STATE.md` al día para que cualquier agente continúe sin leer conversaciones previas.
6. Respetar las reglas de negocio de `AGENTS.md` (privacidad del cliente, COP enteros, motor puro).

## Documentos clave

| Documento | Contenido |
|---|---|
| `AGENTS.md` | Reglas inquebrantables para todo agente (incluye reglas de operación de Codex) |
| `PROJECT_STATE.md` | Estado actual, decisiones, siguiente paso exacto |
| `docs/EXECUTION_PLAN.md` | Etapas de trabajo para Codex |
| `docs/HANDOFF_TO_CODEX.md` | Orden de trabajo completa para Codex |
| `DECISIONS.md` | Registro de decisiones con justificación |
| `PRODUCT_SPEC.md` / `ARCHITECTURE.md` / `TEST_PLAN.md` (raíz) | Especificación base del producto ya construido |

## Comandos de verificación (para agentes, no para el propietario)

```bash
npm test        # 101+ tests, todos en verde
npm run build   # tsc --noEmit && vite build, sin errores
```

En Windows/PowerShell puede hacer falta refrescar el PATH antes de usar npm (ver memoria del proyecto).
