# Orden de trabajo para Codex — Correcciones de Santiago (R2): navegación y gráfica

**Fecha:** 2026-08-04
**Autor:** Claude (arquitectura)
**Rama:** `codex/fase2-nube`
**Punto de restauración:** tag `punto-seguro-pre-v2-2026-08-03`
**Decisiones que la gobiernan:** **D-070 · D-071** (nuevas) · D-046 · D-052 · D-057 · D-063 · D-045

---

## 0. Qué se te pide, en una frase

Quitar la confusión entre la pantalla de inicio y la barra inferior, y convertir el
número suelto del inicio en una **gráfica por períodos**, en **dos commits**.

---

## 1. Orden respecto de R1

Esta orden va **después** de `docs/V2_ORDEN_CORRECCIONES_SANTIAGO_R1.md`. Si R1 aún no
está entregada, **termina R1 primero**. R2 toca las mismas pantallas de inicio e
inventario y mezclarlas complicaría la auditoría.

---

## 2. R2-1 · Un solo vocabulario

**Decisión:** D-070.

### El problema

Al agregar la pantalla de inicio quedaron **dos vocabularios para lo mismo**: Inicio
habla de acciones (*Vender, Producir y atender, La plata*) y la barra de lugares
(*Cotizador, Taller, Agenda*). Solo "Inventario" coincide. **Es un error de diseño de
Claude**, no un descuido tuyo: la barra venía de antes de que Inicio existiera.

### Qué se construye

**La barra inferior queda así**, y es exactamente el primer grupo de Inicio:

```
Inicio · Cotizador · Taller · Inventario · Dinero
```

Cinco botones (D-046 intacto). **La Agenda sale de la barra.**

**Los grupos de Inicio pasan de seis a tres:**

| Grupo | Filas |
|---|---|
| **Tu día a día** | Cotizador · Taller · Inventario · Dinero |
| **Tu gente** | Clientes · Compradores · Proveedores · Socios |
| **Otras cosas** | Agenda · Ajustes y cuenta |

### "Dinero" es un área nueva, con el patrón que ya existe

Hoy el Panel, los cierres, el consolidado y los gastos son destinos sueltos. Pasan a
vivir bajo **Dinero**, con **el mismo patrón de secciones que ya usa Inventario**
(Piedras · Material · Joyas · Cobros). No inventes una navegación distinta: copia la que
ya funciona.

Secciones de Dinero: **Panel · Cierre del día · Cierre mensual · Consolidado · Gastos**.

### Reglas

- **Ninguna ruta desaparece.** Todo lo que hoy se alcanza debe seguir alcanzándose.
  Verifícalo destino por destino antes de dar la etapa por terminada.
- **Un solo nombre por lugar**, en la barra, en Inicio, en los títulos y en los textos.
  Si en alguna pantalla queda "La plata", está mal.
- La Agenda **conserva su globito** de citas de hoy donde aparezca.
- No se toca ningún dato: **cero migraciones, cero campos nuevos**.
- Respeta `runAfterViewFlush`: el guardado diferido del taller y los abonos depende de él.

---

## 3. R2-2 · La gráfica del inicio

**Decisión:** D-071.

### Qué se construye

En lugar del número suelto: **cifra grande + cuánto cambió en el período + gráfica de
área**, con selector **1 día · 7 días · 30 días · 1 año** e interruptor **Ganancia /
Caja**.

Al tocar o arrastrar sobre la gráfica se muestra el valor de ese punto con una línea
guía.

### Una sola medida a la vez — y por qué

**Nunca dibujes Ganancia y Caja superpuestas.** Dos razones, y la primera está medida:

1. Los dos colores de la identidad —esmeralda y latón— se pasaron por un validador de
   daltonismo: quedan a **ΔE 4.5 en protanopía y 15.0 en visión normal**, por debajo del
   mínimo legible. Serían indistinguibles para mucha gente.
2. **Ganancia y caja son cifras distintas** (D-063). Superponerlas invita a la confusión
   que evitamos en todo el plan.

### Colores ya validados — úsalos tal cual

| Modo | Serie | Estado |
|---|---|---|
| Claro | `#0b7f57` | banda de luminosidad, croma y contraste **aprobados** |
| Oscuro | `#2fa87a` | **aprobados** (el `#34b583` de la app queda fuera de banda: L 0.691 contra el tope 0.67) |

### De dónde salen los números

**Del libro del negocio (`ledger.ts`, D-057).** La gráfica **no calcula por su cuenta**;
si lo hace, se rompe la única verdad que costó toda la Fase D construir.

- **Ganancia:** se cuenta el día de la venta (D-063).
- **Caja:** solo lo que entró o salió de verdad (D-045).

### La promesa que no se puede romper

D-052 prometió que la cifra del inicio es la misma del Cierre mensual. Se conserva así:

> Con **Caja** seleccionada y el mes como período, la cifra debe ser **exactamente** la
> del Cierre mensual, y la pantalla debe decirlo.

**Prueba obligatoria** de esa igualdad.

### Riesgo que debes atender: la velocidad

El inicio es **la primera pantalla que se abre**. Si construye un libro de un año
completo antes de pintar, la aplicación se va a sentir lenta —justo en el peor sitio—.

- Calcula el libro **una vez** y filtra por período (regla que ya trae la Fase D).
- **No bloquees el primer pintado.** Que la pantalla aparezca y la gráfica llegue
  enseguida.
- **Mide y reporta** cuánto tarda el inicio con datos abundantes. Si no puedes medirlo,
  dilo.

### Interfaz

- **Sin librería de gráficas y sin dependencia nueva.** SVG propio.
- El globo de información **nunca se sale del lienzo**: recórtalo contra los bordes.
  Claude lo probó y sin recorte se desborda a 320 px.
- Controles **≥ 44 px**, y la gráfica debe responder **al tacto**, no solo al ratón.
- Con un solo dato, o sin datos, la gráfica no se rompe: muestra que aún no hay
  suficiente para dibujar.
- Sin desbordamiento a 320, 390 y 1280 px.
- Respeta `prefers-reduced-motion`.

---

## 4. Reglas que NO se rompen (confírmalas al entregar)

1. `main`, el enlace del piloto y `.github/workflows/deploy.yml` **sin tocar**.
   **Nada publicado.**
2. `src/calc/engine.ts` y `src/services/pdfContent.test.ts` sin cambios.
3. **Sin dependencias nuevas.** La única autorizada en todo el proyecto es
   `write-excel-file`, de R1, y solo para el Excel.
4. **Cero migraciones y cero campos nuevos.** Esta tanda es navegación y presentación.
5. Los cierres, el panel y el consolidado siguen dando **exactamente** los mismos
   totales.
6. Textos en español; botones ≥ 44 px.

---

## 5. Entregable

Por cada commit: el resultado literal de `npm test` y `npm run build`, qué verificaste en
navegador y en qué anchos, y `PROJECT_STATE.md`, `DECISIONS.md` y la bitácora
actualizados.

**Además:**

- En **R2-1**, la **lista de todos los destinos** y desde dónde se alcanza cada uno tras
  el cambio. Es lo que voy a auditar primero.
- En **R2-2**, **cuánto tarda el inicio** en aparecer con datos abundantes.

**Numeración de decisiones:** la más alta hoy es **D-071**. Compruébalo antes de agregar
una nueva.

**No empieces la agenda con reserva de clientes.** Santiago la eligió, pero es un
proyecto aparte con su propio plan y sus propios riesgos de seguridad; no entra aquí.
