# Documentos del proyecto

> **Regla de esta carpeta:** en `docs/` solo vive lo **vigente**. Todo lo que ya se
> cumplió, se auditó y se cerró vive en `docs/historico/`. Si terminas un plan o una orden
> de trabajo, muévela a `historico/` en el mismo commit que la cierra.
>
> Esto existe porque varias sesiones arrancaron leyendo documentos viejos y creyendo que
> describían el presente. Un documento cerrado que sigue en `docs/` no es historia: es una
> trampa.

## Vigente

| Documento | Para qué sirve |
|---|---|
| `PROMPT_NUEVA_SESION.md` | El punto de partida de toda sesión nueva. **Regenerarlo al cerrar cualquier sesión que cambie el estado.** |
| `PLAN_SOCIOS_Y_FONDO.md` | El plan en curso, con sus 9 etapas y las decisiones que lo gobiernan |
| `ACTIVACION_ETAPA9_NUBE.md` | Guía paso a paso para activar la etapa 9 en el servidor. **Todavía no ejecutada** |
| `SQL_PRODUCCION_PENDIENTE.md` | SQL que aún no se ha aplicado en Producción |
| `SQL_PRODUCCION_CORRECCION_VALIDACION_MATERIALES.md` | **No moverlo.** Una prueba (`cloud/migrations.test.ts`) lo lee como contrato: si se mueve, la suite falla |
| `HOJA_DE_RUTA_CORRECCIONES.md` | El método con el que se reciben y aplican las correcciones que dicta Santiago |
| `RELEASE_SECURITY_PROCESS.md` | Los candados de seguridad antes de publicar |
| `EXECUTION_PLAN.md` | Etapas de trabajo |
| `TRASPASO_A_MAC.md` | Cómo montar el proyecto en la Mac y qué archivos no viajan por GitHub |
| `PUBLICAR_ENLACE_NUBE.md` | Procedimiento manual para publicar el enlace de la nube, con sus dos trampas |
| `legal/` | Términos, privacidad y aviso de tratamiento de datos. **En borrador**, sin revisión profesional |

## Histórico

`historico/` guarda las auditorías cerradas, las órdenes de trabajo ya cumplidas y los
planes ya ejecutados. **No se borran**: son el registro de por qué se decidió cada cosa y
sirven para defender una decisión más adelante. Pero no describen el presente.

Ojo con dos de ellos: `FABLE_PROJECT_AUDIT.md` y `ARCHITECTURE_REVIEW_MANIFEST.md`
describen un estado del proyecto en el que ni siquiera existía la carpeta `docs/`. Son
correctos como fotografía de su momento y falsos como descripción de hoy.
