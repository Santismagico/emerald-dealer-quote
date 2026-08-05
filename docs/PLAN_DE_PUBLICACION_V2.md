# Plan de publicación — Plan v2

**Fecha:** 2026-08-04
**Autor:** Claude
**Rama:** `codex/fase2-nube` (91 commits por delante de `main`)
**Punto de restauración:** tag `punto-seguro-pre-v2-2026-08-03`

**Decisiones de Santiago (2026-08-04):**

1. **Probar el aislamiento entre joyerías ANTES de publicar.**
2. **Publicar a los DOS enlaces:** el de la nube y el de los 7 amigos.

---

## 0. La regla que gobierna todo el plan

> **Primero el servidor, después la aplicación.** Nunca al revés.

Hay **7 migraciones SQL** del plan v2 que no están en el servidor de producción. Si se
publica la aplicación antes de aplicarlas, **pedirá tablas y funciones que no existen** y
se romperá para Santiago.

Las siete, en orden: gastos · sociedades en lotes de piedras · tipo de producto y moneda ·
tandas de talla · transformación de joyas · compra en bruto o tallado · borrado de lote
con historia.

Están unidas y listas para pegar en **`docs/SQL_PRODUCCION_PLAN_V2.sql`**. Verificado:
**cero** `drop table`, `drop column`, `truncate` o `alter column … drop`. Es aditivo y
repetible.

---

## 1. Sobre los dos enlaces: van separados en el tiempo

Santiago pidió publicar a los dos. **Se hará**, pero **no el mismo día**.

| Enlace | Quién lo usa | Qué recibe |
|---|---|---|
| `emerald-dealer-app` | Solo Santiago | Todo el plan v2, con nube |
| `emerald-dealer-quote` (`main`) | Los 7 amigos del piloto | Todo el plan v2, versión local sin cuentas |

**Primero el de la nube, y solo cuando esté probado en vivo, el de los amigos.** Razón:
si algo falla, falla sobre la única cuenta del dueño, que se da cuenta al momento, no sobre
siete personas que no saben que hubo un cambio.

> **Corrección del dueño (2026-08-05):** una versión anterior de este plan decía que el
> enlace de la nube lo usaban «Santiago y Héctor». **Es falso.** Santiago es el único
> usuario. «Héctor» es el alias con el que los documentos antiguos nombran al propio dueño
> para no poner su nombre real en un repositorio público. No hay a quién avisar.

### Qué le pasa a la app de los 7 amigos — verificado

Su base local está en **v4** y saltaría a **v8**. Revisé los cuatro escalones
(`src/services/db.ts`): **v5 `cloudOutbox` · v6 `buyers` + `stockJewels` · v7
`materialPartners` + `materialLots` · v8 `expenses`**. Los cuatro **solo crean almacenes
nuevos vacíos** (`createStoreIfMissing`); **ninguno toca, reescribe ni borra** sus
ajustes, clientes, cotizaciones, citas, lotes ni proveedores.

El riesgo técnico es bajo. Pero **sus datos viven solo en sus teléfonos**, sin copia en la
nube, así que la precaución vale la pena igual (§5).

Lo que sí cambia para ellos, y no lo pidieron: la app abre distinto, la barra cambia, y
aparecen seis fases de funciones nuevas. **Es una decisión de producto de Santiago, no un
problema técnico.**

---

## 2. Paso 1 — La prueba de aislamiento (la hace Santiago)

Comprueba que una joyería no puede ver ni tocar los datos de otra, en **todas** las tablas,
incluidas las siete migraciones nuevas.

**La prueba tiene una protección deliberada: se niega a correr contra producción.** Exige
un proyecto marcado como desechable, la rama correcta y un Git sin cambios pendientes. Por
eso hace falta un proyecto nuevo.

Lo que Santiago hace:

1. Crear un **proyecto nuevo de Supabase**, desechable, con un nombre que diga que es de
   pruebas.
2. Pegar allí **todo** `supabase/migrations/` en orden, incluidas las 7 nuevas.
3. Poner sus llaves en un archivo local de entorno —**que no se sube al repositorio**— con
   `SUPABASE_URL`, la llave publicable, la llave secreta, `N6_TEST_PROJECT_REF` y
   `N6_TEST_PROJECT_NAME`.
4. Ejecutar:

```bash
npm run security:n6
```

> **La llave secreta la maneja únicamente Santiago.** Ningún agente debe pedirla, verla ni
> escribirla. Si un agente la solicita, algo está mal.

**Si la prueba pasa:** seguir al paso 2.
**Si falla:** detenerse y traer el resultado. No se publica nada.

Al terminar, **borrar el proyecto desechable**.

---

## 3. Paso 2 — El SQL a producción (lo hace Santiago)

1. Abrir el proyecto **`Emerald Dealer Produccion`** en Supabase → SQL Editor.
2. Pegar **completo** el contenido de `docs/SQL_PRODUCCION_PLAN_V2.sql`.
3. Ejecutar y confirmar **Success**.

Es aditivo y repetible: si algo se corta a medias, se puede volver a ejecutar entero sin
daño.

**Antes de esto, Santiago exporta un respaldo desde la app en cada dispositivo suyo.** Es
un minuto y es la red de seguridad.

---

## 4. Paso 3 — Publicar el enlace de la nube

Solo cuando los pasos 1 y 2 estén aprobados.

1. Tag de publicación sobre el commit exacto que se va a publicar.
2. Compilar con el entorno de producción y subir el resultado al repositorio
   `Santismagico/emerald-dealer-app`.
3. **Verificar en vivo:** entrar con la cuenta real, comprobar que Inicio carga con su
   gráfica, que Inventario abre sus cuatro secciones, que Dinero abre sus cinco, que un
   cierre se descarga en Excel y que la consola no tiene errores.
4. No hay a quién avisar: Santiago es el único usuario de este enlace.

**Cómo volver atrás:** el repositorio del sitio guarda el commit anterior; revertirlo
restaura la versión previa. Las tablas nuevas del paso 2 **no estorban** a la versión
anterior, porque esta simplemente no las usa.

---

## 5. Paso 4 — Publicar el enlace de los 7 amigos

**Solo después de que el enlace de la nube lleve al menos unos días funcionando bien.**

1. **Avisarles antes.** Van a ver una aplicación distinta al abrirla. Un mensaje corto
   basta: que la app se actualizó, que sus datos siguen ahí, y que ahora hay más
   herramientas.
2. **Pedirles que exporten un respaldo antes de actualizar.** La app tiene el botón; sus
   datos viven solo en su teléfono y no hay copia en la nube. Es la única precaución que de
   verdad importa.
3. Llevar `main` al commit aprobado y ejecutar el workflow de despliegue, que exige
   ejecución manual, commit exacto y la confirmación `PUBLICAR`.
4. Verificar el sitio en vivo.

**Cómo volver atrás:** devolver `main` a `0a86e5a` restaura la versión que tienen hoy.

---

## 6. Lo que queda pendiente y no bloquea

- **Abrir un Excel** y sumar una columna: es el único punto que Claude verificó de forma
  indirecta.
- **La pregunta de "Ganancia"** (auditoría R2, O1): hoy es el margen de las ventas y no
  descuenta el arriendo ni los servicios. Santiago debe decidir si la quiere así o si se
  agrega una tercera cifra, *Resultado del negocio*.
- **La agenda con reserva de clientes**: aceptada como proyecto aparte, sin planear.
- Los bloqueos premercado que ya existían: documentos legales en borrador, SMTP propio,
  registro de cobros.

---

## 7. Resumen del orden

```
1. Prueba de aislamiento en proyecto desechable   → Santiago
2. Respaldo + las 7 migraciones a producción      → Santiago
3. Publicar enlace de la nube + verificar en vivo → agente, con orden expresa
4. (días después) Avisar a los 7 + publicar main  → agente, con orden expresa
```

**Nada de los pasos 3 y 4 se ejecuta sin una orden expresa y separada de Santiago en ese
momento.** Que este plan exista no autoriza a publicar.
