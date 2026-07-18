# HOJA DE RUTA — Correcciones de funcionamiento y estéticas (post-publicación v1.0)

_Escrita por Claude (Fable) el 2026-07-16, por orden de Santiago. Este documento existe
para que CUALQUIER agente (Claude o Codex) aplique las correcciones que Santiago dicte
con el mismo método, las mismas protecciones y el mismo nivel de verificación, incluso
si el agente que empieza no es el que termina._

## Contexto en una mirada

- **El Ecosistema v1.0 está PUBLICADO** en https://santismagico.github.io/emerald-dealer-quote/
  desde el commit `ae57b95` (`main`). La identidad vigente de Fable quedó respaldada en
  `fable/regeneracion-emerald-dealer-quote-v1` hasta `fb564ca`; las correcciones finales
  viven separadas en `codex/correcciones-finales-fable`. Ninguna de estas dos tandas está publicada.
- Candidata actual: 452 pruebas en 24 archivos, verificación PWA y build en verde. El
  punto seguro es la rama de Fable en `fb564ca`; la rama de Codex conserva ese estado como base.
- La estética oscura/dorada de `55771e0` fue rechazada por Santiago. La identidad vigente
  es D-029, "el mesón del joyero", con el ícono "La gema viva" y el endurecimiento D-030.
- **CUIDADO NUEVO:** ahora hay usuarios potenciales usando la app publicada con datos
  reales en su teléfono. Un push a `main` actualiza la app en vivo. La PWA se actualiza
  sola al reabrir; los datos locales (IndexedDB) NUNCA se tocan al actualizar, salvo
  migraciones — y las migraciones solo AGREGAN (regla D-022: escalera append-only).

## Cómo usar este documento

**Santiago:** dicta tus correcciones al agente en tus palabras. No necesitas clasificarlas
ni saber dónde viven en el código: eso lo hace el agente con este documento.

**Agente:** sigue las fases en orden. No te saltes la Fase 0 aunque la corrección parezca
trivial. Registra cada corrección en la tabla del final ANTES de empezarla.

---

## FASE 0 — Protección (SIEMPRE, antes de tocar cualquier cosa)

1. `git pull origin fable/regeneracion-emerald-dealer-quote-v1` — otro agente pudo avanzar.
2. Verifica árbol limpio (`git status`). Si hay cambios ajenos sin commit, DETENTE y pregunta.
3. Línea base: `npm test && npm run build` deben estar en verde ANTES de empezar.
   (En Windows/PowerShell refresca el PATH primero; ver memoria del proyecto/CLAUDE.md.)
4. Crea el punto seguro de la tanda: `git tag punto-seguro-correcciones-AAAA-MM-DD` y súbelo.
5. Trabaja SIEMPRE en la rama `fable/regeneracion-emerald-dealer-quote-v1`. Push a `main`
   SOLO con orden expresa de Santiago (publica de inmediato).

## FASE 1 — Recibir y clasificar

Anota cada corrección de Santiago en la tabla "Registro de correcciones" (al final) con:

- **F** (funcionamiento): cambia lo que la app HACE (lógica, cálculos, flujos, guardado).
- **E** (estética): cambia lo que la app MUESTRA (textos, colores, tamaños, orden visual,
  íconos, espaciados) sin tocar lógica.
- **D** (dudosa): si no está claro qué quiere Santiago, PREGUNTA con opciones de negocio
  simples antes de tocar código. Nunca adivines una intención de negocio.

Reformula cada corrección en una frase verificable ("el botón X ahora hace/muestra Y")
y confírmala con Santiago si el enunciado original era ambiguo.

## FASE 2 — Orden de ejecución

1. **Funcionales primero**, una por una, cada una con su commit propio.
2. **Estéticas después**, agrupadas por pantalla (una tanda por pantalla = un commit).
3. Nunca mezcles una funcional y una estética en el mismo commit.
4. Si una corrección funcional contradice una decisión registrada (DECISIONS.md D-001…D-024),
   detente y explícale a Santiago el conflicto en lenguaje de negocio; si él decide cambiar
   la regla, registra la nueva decisión en DECISIONS.md ANTES de implementar.

## FASE 3 — Método por corrección

### Si es FUNCIONAL (F)

1. Localiza el archivo con el Mapa del código (abajo). La lógica de negocio vive en
   `src/services/*` y `src/calc/*` como funciones PURAS; la vista solo la llama.
2. Si el cambio toca lógica pura: escribe/ajusta el test PRIMERO o junto al cambio,
   en el `.test.ts` correspondiente. Sin test no hay corrección funcional terminada.
3. Haz el cambio MÁS PEQUEÑO que cumple la corrección. No refactorices de paso.
4. `npm test && npm run build` en verde.
5. Verifica el flujo real en navegador (`npm run dev`, o el panel de preview si es Claude):
   ejercita la corrección de punta a punta, recarga y confirma persistencia si guarda datos.
6. Commit con mensaje claro (qué + por qué) y push de la rama.

### Si es ESTÉTICA (E)

1. Localiza el componente con el Mapa del código. Los textos visibles viven en los
   componentes (`src/components/*.tsx`) y App.tsx; los colores de marca en
   `src/index.css` (bloque `@theme`: paleta `brand` verde esmeralda y `gold` dorado);
   el resto del estilo son clases Tailwind en línea en cada componente.
2. Respeta las reglas móviles YA establecidas (no las "mejores": las de esta app):
   - Área táctil mínima: `min-h-11` / `min-h-12` en botones e inputs.
   - Inputs con fuente de 16px (evita el zoom automático de iOS) — ya global en index.css.
   - Sin overflow horizontal; listas horizontales usan el patrón `-mx-4 overflow-x-auto px-4`.
   - Safe areas de iPhone: clases `safe-top` / `safe-bottom` (no quitarlas).
   - Diálogos: usa los componentes de `src/components/ui.tsx` (ConfirmDialog, Button, etc.),
     no inventes variantes nuevas si ya existe una.
3. Si cambias un TEXTO, revisa si ese texto llega al PDF cliente o a WhatsApp
   (ver "Privacidad" abajo). Los textos del PDF viven en `src/services/pdfContent.ts`
   (contenido) y `src/services/pdf.ts` (diseño/posiciones).
4. `npm test && npm run build` en verde (los tests también cubren textos de servicios).
5. Verificación VISUAL en navegador de la pantalla tocada (y en ancho móvil ~375px).
6. Commit por pantalla y push.

## FASE 4 — Verificación integral de la tanda

Al terminar todas las correcciones de la tanda:

1. `npm test && npm run build` — verde total (hoy: 432 tests, 24 archivos; solo puede crecer).
2. Recorrido de humo en navegador por las 5 áreas: crear cotización → aprobar →
   ver trabajo en Taller → registrar cita en Agenda → abrir Piedras → Más → Cierre del día.
3. Prueba de privacidad rápida: en una cotización escribe "precio por gramo" en las
   observaciones del cliente e intenta generar el PDF cliente → DEBE bloquearse.
   Bórralo después.
4. Actualiza `PROJECT_STATE.md` (bitácora + qué está funcionando) y, si hubo decisión
   nueva, `DECISIONS.md`. Actualiza la tabla de este documento.

## FASE 5 — Publicar (SOLO con orden expresa de Santiago)

1. Pregunta a Santiago con la lista de lo corregido: "¿publico estas correcciones?".
2. Con su sí: sube la rama y luego lleva `main` al mismo commit (merge fast-forward o push).
   El workflow `.github/workflows/deploy.yml` publica solo desde `main` — NO tocarlo.
3. Verifica el sitio en vivo tras el deploy (Actions en verde + abrir la URL pública +
   consola sin errores).
4. Considera subir la versión en `package.json` (hoy `0.5.0`; el ecosistema amerita `1.0.0`)
   — SOLO si Santiago lo aprueba, porque la versión se muestra en Ajustes.

---

## MAPA DEL CÓDIGO (dónde vive cada cosa)

### Por pantalla (lo que Santiago ve → archivo)

| Pantalla / elemento visible | Archivo |
|---|---|
| Barra superior (nombre, subtítulo "Cotizaciones de joyería", rombo) | `src/App.tsx` (header) |
| Barra inferior de pestañas (íconos, nombres, globito de Agenda) | `src/App.tsx` (nav + NavButton) |
| Cotizador: historial, búsqueda, filtros, menú de estado | `src/components/HistoryView.tsx` |
| Cotizador: formulario por pasos (Cliente/Pieza/Piedras/Costos) | `src/components/QuoteFormView.tsx` |
| Cotizador: vista previa cliente/interna, botones PDF/WhatsApp/estado | `src/components/PreviewView.tsx` |
| Taller: lista de trabajos, filtros, barra de progreso | `src/components/WorkshopView.tsx` |
| Taller: pantalla de un trabajo (resumen, abonos, producción) | `src/components/WorkshopJobView.tsx` |
| Paneles de producción y abonos (etapas, pagos) | `src/components/ProductionPanel.tsx`, `PaymentsPanel.tsx` |
| Agenda: citas, aviso de hoy, formulario de cita | `src/components/AgendaView.tsx` |
| Piedras: lotes, existencias, flujo, formularios de compra/venta | `src/components/StonesView.tsx` |
| Más: menú (Cierre del día, Clientes, Ajustes) | `src/App.tsx` (MoreView) |
| Cierre del día: vista previa y botón de PDF | `src/components/DailyCloseView.tsx` |
| Clientes | `src/components/ClientsView.tsx` |
| Ajustes | `src/components/SettingsView.tsx` |
| Piezas reutilizables (botones, inputs, diálogos, etiquetas de estado) | `src/components/ui.tsx` |

### Por concepto (lo que hace la app → archivo)

| Concepto | Archivo | Regla |
|---|---|---|
| Colores de marca (verde `brand`, dorado `gold`) | `src/index.css` bloque `@theme` | Cambiar aquí re-tiñe toda la app |
| Cálculo de la cotización (totales, margen, descuento) | `src/calc/engine.ts` | NO tocar salvo bug demostrado con test |
| Precio del oro automático | `src/services/goldPrice.ts` | NO tocar salvo decisión registrada (D-002) |
| Contenido de los PDF (cliente e interno) | `src/services/pdfContent.ts` | Detector de privacidad vive aquí (`SENSITIVE_TERMS`) |
| Diseño/posiciones de los PDF | `src/services/pdf.ts` | Renderizador compartido por todos los PDF |
| Cierre del día (qué entra al reporte) | `src/services/dailyReport.ts` | Motor puro, con tests |
| Mensaje de WhatsApp | `src/services/whatsapp.ts` | Pasa por el detector antes de abrir |
| Estados de cotización + approvedAt + etapas al aprobar | `src/services/quoteStatus.ts` (`withQuoteStatus`) | ÚNICA lógica de cambio de estado (D-024) |
| Trabajos del taller (derivación, filtros) | `src/services/workshop.ts` | Derivado, nunca guardado |
| Citas (orden, filtros, aviso de hoy) | `src/services/agenda.ts` | — |
| Lotes de piedras (existencias, flujo, validación de ventas) | `src/services/stones.ts` | `validateStoneSale` impide sobreventa |
| Forma única de los datos (defaults, normalización) | `src/services/schema.ts` | TODO dato que entra pasa por aquí (D-010) |
| Base local y migraciones | `src/services/db.ts` | Escalera append-only; NUNCA reordenar (D-022) |
| Respaldos (exportar/importar, versión 4) | `src/services/backup.ts` | Acepta v1–v4; restauración atómica |
| Guardado diferido de producción/abonos | `src/services/quoteAutosave.ts` | 650 ms, serial; NO tocar (D-014) |
| Estado global React | `src/store.tsx` | Actualización optimista + escritura detrás |

## REGLAS INQUEBRANTABLES (resumen; detalle en AGENTS.md y DECISIONS.md)

1. **Privacidad del cliente:** nada de costo/margen/utilidad/precio por gramo/pureza/notas
   internas puede llegar al PDF cliente, Web Share ni WhatsApp. Los tests de
   `src/services/pdfContent.test.ts` son la ley: si un cambio los rompe, el cambio está mal.
2. **Dinero en COP enteros.** Nunca decimales en pesos.
3. **Motor puro:** la lógica de negocio no lee ni escribe la base; recibe datos y devuelve datos.
4. **Cero dependencias nuevas** sin registrarlas en DECISIONS.md con justificación.
5. **`.github/workflows/deploy.yml` y `main` no se tocan** sin orden de Santiago.
6. **Migraciones de IndexedDB:** solo agregar escalones al final de `DB_MIGRATIONS`.
7. **Datos ficticios siempre** en pruebas y capturas (el repo es público).

## TRABAJO EN SIMULTÁNEO (Claude + Codex a la vez)

Si Santiago reparte correcciones entre los dos agentes al mismo tiempo:

1. **Repartir por archivo, no por tema:** dos agentes NUNCA deben editar el mismo archivo
   en paralelo (el conflicto de git lo pagaría Santiago). Reparto natural: uno toma
   funcionales (services/) y otro estéticas (components/), o se reparten por pantalla.
2. Cada agente hace `git pull` ANTES de cada corrección y `push` DESPUÉS de cada commit
   (commits pequeños y frecuentes minimizan choques).
3. Si aparece un conflicto de merge: NO resolverlo a ciegas; el agente que lo encuentra
   avisa qué archivos chocan y quién ganó qué.
4. La tabla de registro (abajo) es el tablero compartido: marca la corrección como
   "en curso (Claude)" o "en curso (Codex)" ANTES de empezarla.

## REVERSIÓN (si algo sale mal)

- Descartar cambios sin commit: `git restore .`
- Deshacer UNA corrección ya commiteada: `git revert <hash>` (nunca reset en historia pública).
- Volver al estado pre-tanda: tag `punto-seguro-correcciones-AAAA-MM-DD`.
- La publicación en vivo solo cambia con push a `main`: si lo publicado falla,
  se lleva `main` al último commit bueno y el deploy automático restaura el sitio.

---

## REGISTRO DE CORRECCIONES

_El agente llena esta tabla al recibir las correcciones de Santiago y la mantiene al día.
Estados: pendiente → en curso (agente) → verificada → publicada._

| # | Tipo (F/E) | Corrección (en palabras de Santiago) | Pantalla/archivo | Estado | Commit |
|---|---|---|---|---|---|
| C1 | F | Etapas del taller: Diseño, Fundición, Terminado y engaste, Material, Varios (sin Impresión) | production.ts | verificada y reforzada | 0791c20 + deeab61 |
| C2 | F | Apartado extra cuando la joya ya se entregó (lista ≠ entregada), siempre con fecha real | workshop.ts, WorkshopView/JobView | verificada y reforzada | 03e4d17 + deeab61 |
| C3 | F | Crear e ingresar proveedores como los clientes; al borrar o renombrar uno, conservar su nombre en lotes anteriores | SuppliersView, store, db v4, respaldo v5 | verificada y reforzada | 8107989 + 2b1b220 |
| C4 | F | Piedras a crédito: cuándo compré, cuánto pagué, cuánto falta; proteger pagos y ventas ya registrados | stones.ts, StonesView | verificada y reforzada | 94da638 + 2b1b220 |
| C5 | F+E | Cierre separado Joyería vs Piedras + columna corrida del "Día del cierre" | dailyReport.ts, DailyCloseView, index.css | verificada y reforzada | 05d301d + deeab61 |
| C6 | F | Cierre mensual acumulado: ventas, compras, deudas, balance y comparación solo con meses anteriores | dailyReport.ts, DailyCloseView | verificada y reforzada | 05d301d + deeab61 |
| C7 | F | El anticipo significa dinero ya pagado: suma a lo recibido y reduce la deuda; los anticipos nuevos o modificados llevan fecha real | QuoteForm, PaymentsPanel, dailyReport | verificada | deeab61 |
| C8 | F | Confusión entre anticipo y abonos: registrar el saldo real y mostrar "Pagada" sin mezclarlo con "Entregada" | payments.ts, workshop.ts, WorkshopJobView, PaymentsPanel, WorkshopView | publicada | 5d67440 + D-030 |
| C9 | F | Hacer visible cualquier sobrepago, retirar la acción falsa cuando el total es $0 y evitar duplicados por doble toque/reintento | payments.ts, workshop.ts, Taller y cierres | publicada | d251ad3 |
| C10 | F | Permitir deslizar todos los pasos del cotizador en Android y mantener accesibles los botones de navegación | App, QuoteForm, index.css | publicada | ab77ad3 |
| E1 | E | Primera estética oscura/dorada de Codex | App, componentes e íconos | rechazada por Santiago; reemplazada, no publicar | 55771e0 |
| E2 | E | Primer ícono de esmeralda dentro de rombo dorado | íconos PWA y manifiesto | rechazado con E1; reemplazado, no publicar | 55771e0 |
| E3 | E | Nueva identidad "el mesón del joyero" e ícono "La gema viva" con volumen | App, componentes, temas e íconos | publicada | 4f3df5f + fb564ca |
| E4 | E | Corregir recorte adaptable, arranque oscuro, contraste nocturno y pantallas de 320–360 px | generadores PWA, manifiesto, estilos y formulario | publicada | d251ad3 |
| E5 | E | Adaptar la aplicación a PC con contenido amplio, formularios en columnas y menú lateral | App, QuoteForm, index.css | publicada | e27654a |
| E6 | E | En Android, devolver Siguiente/Anterior a su posición normal sin perder el desplazamiento corregido | QuoteForm, index.css | publicada | 33d5d53 |
| E7 | E | En PC, devolver Siguiente/Anterior y Guardar ajustes a su posición normal; ningún botón queda anclado | QuoteForm, SettingsView, index.css | publicada | 877a8cc |

_Siguiente control antes de publicar: reinstalar la PWA en un teléfono real para comprobar el
nuevo ícono; los dispositivos que ya la tenían pueden conservar el anterior por caché._

_Antes de publicar: revisar manualmente cotizaciones antiguas que tengan anticipo y también un
abono posterior por el mismo valor. La app no intenta adivinar ni borrar automáticamente un posible
registro duplicado._

_Tanda del 2026-07-17 (Fable, publicada en `7c3d49f`): C10-F fotos reales de teléfono
aceptadas al cargar logo/referencias — el límite de 1.5 MB pasó al resultado comprimido
(D-034); C11-E "Guardar ajustes" fluye normal en el teléfono y solo flota en computador;
C12-E el cierre del trabajo (pagada/entregada) pasó al final de la pantalla del taller,
después de pagos y producción. 468 pruebas y build en verde; bundle en vivo verificado._

_C13 (EN PAUSA, 2026-07-17): en el Xiaomi de Santiago el selector de fotos no abre en
ninguna variante (programática, nativa visible, importar respaldo), ni en la PWA ni en
Chrome pestaña, aunque el toque llega a la app (v1.0.1 diagnóstica lo demostró). Causa
probable: MIUI niega a Chrome el permiso de Fotos/Almacenamiento o la app "Archivos"
del sistema está deshabilitada. Pasos de solución ya entregados a Santiago; sin
dispositivo disponible para confirmar. Pendiente: nota de ayuda dentro de la app para
usuarios Xiaomi (folclor común en Colombia) — incluirla en la siguiente tanda._
