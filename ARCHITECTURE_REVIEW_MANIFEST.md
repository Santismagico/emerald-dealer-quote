# ARCHITECTURE REVIEW MANIFEST

**Paquete:** `FABLE_ARCHITECTURE_REVIEW_PACKAGE.zip`  
**Preparado:** 11 de julio de 2026  
**Propósito:** copia técnica de revisión para el arquitecto principal  
**Criterio:** código y documentación del proyecto, sin dependencias instaladas, builds, historial interno de Git, datos reales ni archivos locales sensibles.

## 1. Proyecto representado

- **Nombre:** Emerald Dealer Quote / Quote Emerald Dealer
- **Ubicación original:** `C:\Users\santi\OneDrive\Escritorio\EMERALD DEALER\CLAUDE`
- **Repositorio conectado:** `https://github.com/Santismagico/emerald-dealer-quote.git`
- **Rama actual:** `fable/regeneracion-emerald-dealer-quote-v1`
- **Commit actual completo:** `c3140c4a1e6192bf35d1d7e29bd24e4ce6adcc2d`
- **Commit corto:** `c3140c4`
- **Versión declarada:** `0.5.0`
- **Referencia de seguridad existente:** tag `punto-seguro-2026-07-09`
- **Referencia remota de la rama:** `origin/fable/regeneracion-emerald-dealer-quote-v1`, también en `c3140c4`
- **Referencia remota principal:** `origin/main`, en `95e98f2`

## 2. Confirmación de la revisión incluida

**Sí: el código fuente, las configuraciones y los archivos registrados incluidos en este paquete representan la rama actual `c3140c4`.**

No había modificaciones locales en archivos registrados por Git al preparar el paquete. Además del contenido de `c3140c4`, el paquete incluye expresamente los siguientes documentos no registrados:

- `CLAUDE.md`
- `PROJECT_STATE.md`
- `FABLE_PROJECT_AUDIT.md`
- `ARCHITECTURE_REVIEW_MANIFEST.md`

Estos documentos adicionales no cambian el código de la aplicación.

## 3. Revisión de seguridad antes de empacar

Resultado: **apto para compartir con un arquitecto de confianza**.

- No se detectaron claves, tokens, contraseñas, credenciales, llaves privadas ni direcciones con autenticación incrustada.
- No se encontraron archivos `.env`, certificados, llaves, bases de datos, PDF generados, ZIP anteriores ni respaldos comerciales.
- No se encontraron clientes ni cotizaciones reales.
- Los nombres, teléfonos y correo presentes en `src/test/fixtures.ts` están identificados como datos de ejemplo y usan un dominio reservado para pruebas.
- Los tres PNG de `public/` son iconos genéricos de la PWA, no fotos de clientes ni un logo privado cargado por un usuario.
- El código contiene reglas comerciales internas, márgenes y PDF interno. Por eso el paquete es para un arquitecto autorizado, no para clientes ni publicación abierta.

Se excluyó `.claude/settings.local.json`: no contiene un token detectado, pero es una configuración local ignorada por Git con permisos y comandos autorizados específicamente en este computador. No es necesaria para revisar la arquitectura.

## 4. Archivos incluidos

### Manifiesto

- `ARCHITECTURE_REVIEW_MANIFEST.md`

### Configuración y dependencias

- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `tsconfig.json`
- `index.html`

No existe otro archivo de bloqueo como `pnpm-lock.yaml` o `yarn.lock`.

### Código fuente completo: `src/`

- `src/App.tsx`
- `src/index.css`
- `src/main.tsx`
- `src/store.tsx`
- `src/vite-env.d.ts`
- `src/calc/engine.ts`
- `src/calc/engine.test.ts`
- `src/components/ClientsView.tsx`
- `src/components/HistoryView.tsx`
- `src/components/PaymentsPanel.tsx`
- `src/components/PreviewView.tsx`
- `src/components/ProductionPanel.tsx`
- `src/components/QuoteFormView.tsx`
- `src/components/SettingsView.tsx`
- `src/components/ui.tsx`
- `src/services/backup.ts`
- `src/services/db.ts`
- `src/services/goldPrice.ts`
- `src/services/goldPrice.test.ts`
- `src/services/payments.ts`
- `src/services/payments.test.ts`
- `src/services/pdf.ts`
- `src/services/pdfContent.ts`
- `src/services/pdfContent.test.ts`
- `src/services/persistence.test.ts`
- `src/services/production.ts`
- `src/services/production.test.ts`
- `src/services/schema.ts`
- `src/services/schema.test.ts`
- `src/services/storage.ts`
- `src/services/whatsapp.ts`
- `src/services/whatsapp.test.ts`
- `src/test/fixtures.ts`
- `src/types/index.ts`
- `src/utils/collections.ts`
- `src/utils/dates.ts`
- `src/utils/id.ts`
- `src/utils/images.ts`
- `src/utils/money.ts`
- `src/utils/money.test.ts`

### Recursos públicos completos: `public/`

- `public/apple-touch-icon.png`
- `public/pwa-192.png`
- `public/pwa-512.png`

### Publicación automática

- `.github/workflows/deploy.yml`

### Configuración de Claude incluida

- `.claude/launch.json`

La configuración local `.claude/settings.local.json` fue excluida por seguridad y portabilidad.

### Documentación del proyecto

- `AGENTS.md`
- `ARCHITECTURE.md`
- `CHANGELOG.md`
- `DECISIONS.md`
- `FABLE_PROJECT_AUDIT.md`
- `PRODUCT_SPEC.md`
- `README.md`
- `ROADMAP.md`
- `SAAS_PLAN.md`
- `SECURITY_CHECKLIST.md`
- `TEST_PLAN.md`
- `WEEKLY_PROGRESS.md`

### Documentación posterior no registrada

- `CLAUDE.md`
- `PROJECT_STATE.md`

## 5. Archivos y carpetas excluidos

### Exclusiones obligatorias

- `.git/` — historial interno, objetos y configuración local del repositorio.
- `node_modules/` — dependencias instaladas y cachés.
- `dist/` — build generado; no es código fuente.
- Cualquier archivo `.env` — no existen en la carpeta revisada.
- Claves, tokens, contraseñas o secretos — no se detectaron archivos que debieran copiarse o aislarse por este motivo.
- Datos reales de clientes — no se encontraron en el proyecto.
- Cotizaciones reales — no se encontraron en el proyecto.
- Respaldos con información comercial — no se encontraron.
- PDF generados — no se encontraron.
- Archivos temporales, registros y cachés — no se incluyeron.

### Exclusiones específicas adicionales

- `.claude/settings.local.json` — permisos y comandos locales del computador; no está registrado en Git y no es necesario para arquitectura.
- `.agents/` — carpeta interna vacía de herramientas; ajena al código.
- `.codex/` — carpeta interna vacía de herramientas; ajena al código.
- `.gitignore` — no solicitado para la revisión y no necesario para leer la aplicación.
- `scripts/generate-icons.mjs` — herramienta auxiliar para regenerar iconos; no forma parte del alcance solicitado.
- `FABLE_ARCHITECTURE_REVIEW_PACKAGE.zip` — el paquete nunca se incluye dentro de sí mismo.

No existe la carpeta `docs/`. Por eso tampoco existen `docs/EXECUTION_PLAN.md` ni `docs/HANDOFF_TO_CODEX.md`, aunque son mencionados en documentos posteriores.

## 6. Advertencia sobre documentos posteriores

> **`CLAUDE.md` y `PROJECT_STATE.md` no están registrados en Git. Son documentos posteriores de contexto y traspaso. No deben tratarse como fuente histórica principal ni como prueba del origen del código.**

Ambos se incluyen porque fueron solicitados expresamente y pueden orientar al arquitecto. Para establecer la historia del proyecto deben prevalecer el historial de Git, `WEEKLY_PROGRESS.md`, `DECISIONS.md`, `CHANGELOG.md` y `FABLE_PROJECT_AUDIT.md`.

`FABLE_PROJECT_AUDIT.md` tampoco está registrado en Git porque fue creado como resultado de la auditoría aceptada el 11 de julio de 2026.

## 7. Resumen de los últimos cambios

1. **`c3140c4` — 9 de julio de 2026:** aviso de palabras sensibles antes de generar el PDF cliente o abrir WhatsApp. El mensaje del cambio indica que sus pruebas están pendientes.
2. **`95e98f2` — 9 de julio de 2026:** auditoría de seguridad y calidad, versión 0.5.0.
3. **`c7ca039` — 9 de julio de 2026:** abonos del cliente, acceso a producción y mejoras para Android, versión 0.4.0.
4. **`8d439ec` — 8 de julio de 2026:** seguimiento de producción del taller, versión 0.3.0.
5. **`a7aba03` — 8 de julio de 2026:** corrección de WhatsApp y plan futuro SaaS.
6. **`4a4b3b0` — 8 de julio de 2026:** mensaje comercial y pie de PDF en varias líneas.

## 8. Diferencia entre `origin/main` y la rama actual

- `origin/main`: `95e98f2`
- Rama actual: `c3140c4`
- La rama actual está un cambio por delante de `origin/main`.
- Archivos diferentes:
  - `src/components/PreviewView.tsx`
  - `src/services/pdfContent.ts`
- Resumen: **91 líneas añadidas y 6 retiradas**.
- Naturaleza del cambio: detector y confirmación de términos sensibles antes del PDF cliente o WhatsApp.
- Estado declarado por el propio historial: pruebas específicas pendientes.

No hay diferencias en documentación Markdown registrada entre `origin/main` y `c3140c4`.

## 9. Límites de este paquete

- No incluye el historial interno de Git. El resumen de procedencia está en este manifiesto y en `FABLE_PROJECT_AUDIT.md`.
- No incluye el build publicado ni dependencias instaladas.
- No se ejecutaron pruebas, compilación, migraciones o publicación para crear el paquete.
- No contiene datos guardados en el navegador del celular o del computador.
- No demuestra qué revisión exacta está almacenada actualmente en la PWA del celular.

## 10. Orden sugerido de lectura para el arquitecto

1. `FABLE_PROJECT_AUDIT.md`
2. `ARCHITECTURE_REVIEW_MANIFEST.md`
3. `PRODUCT_SPEC.md`
4. `ARCHITECTURE.md`
5. `DECISIONS.md`
6. `src/types/index.ts`
7. `src/calc/engine.ts`
8. `src/store.tsx`
9. `src/services/`
10. `src/components/`

Consultar `CLAUDE.md` y `PROJECT_STATE.md` únicamente después de leer la advertencia de la sección 6.
