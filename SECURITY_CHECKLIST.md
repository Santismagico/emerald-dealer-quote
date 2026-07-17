# SECURITY_CHECKLIST — Emerald Dealer Quote

## Estado actual verificado el 2026-07-17 (MVP local, sin backend)

- [x] **Sin secretos en el repositorio**: no hay tokens, claves ni credenciales. `.env` está en `.gitignore` por si en el futuro se necesita.
- [x] **Separación cliente/interno**: PDF cliente, Web Share y WhatsApp bloquean la salida si detectan margen, utilidad, costos, precio por gramo, pureza o notas internas. No existe una confirmación para saltar la protección. Cubierto por `pdfContent.test.ts`, `pdfShare.test.ts` y `whatsapp.test.ts`.
- [x] **Datos locales**: todo vive en IndexedDB del dispositivo y no se envía a servidores propios. El enlace de WhatsApp entrega el texto a `wa.me`; Web Share entrega el PDF cliente únicamente a la aplicación que el usuario elija en el selector nativo.
- [x] **Confirmaciones destructivas**: eliminar cotización/cliente e importar respaldo piden confirmación explícita; la importación advierte que reemplaza todo.
- [x] **Validación de respaldos**: el JSON importado se valida (app, versión, estructura y abonos) antes de tocar los datos; máximo 25 MB y restauración atómica.
- [x] **Formato de respaldo vigente**: se exporta v5 y se aceptan v1–v5, siempre con normalización antes de guardar.
- [x] **Sin dependencias innecesarias**: 3 dependencias de runtime (React, React DOM y jsPDF). `npm audit` del 2026-07-17: 0 vulnerabilidades.
- [x] **Normalización total al importar** (v0.5.0): un respaldo corrupto, editado o de versión anterior se corrige antes de persistirse; nunca puede dejar la app inservible (`services/schema.ts`).
- [x] **Imágenes solo internas** (v0.5.0): las imágenes deben ser data URLs generadas por la app; URLs externas en respaldos se descartan (impide balizas de rastreo).
- [x] **Límite de imágenes** (D-033): máximo cuatro por cotización y 1.5 MB por archivo original, con mensaje claro antes de procesar.
- [x] **Content-Security-Policy en producción** (v0.5.0): conexiones permitidas al propio origen y a las dos APIs del precio del oro; mitiga XSS y dependencias comprometidas. Ver plugin en `vite.config.ts`.
- [x] **Entradas hostiles a PDF y WhatsApp**: texto largo, controles, emoji y árabe generan PDF; WhatsApp limpia el teléfono y codifica símbolos, comillas y saltos. La privacidad se revisa antes de abrir.
- [x] **Límites de sanidad del precio del oro** (v0.5.0): valores absurdos de las APIs se rechazan; se conserva el último precio bueno.
- [x] **Auditoría multi-ángulo ejecutada el 2026-07-09** (8 ángulos + verificación). Resultados y decisiones en DECISIONS.md D-010.

## Riesgos conocidos y aceptados en el MVP

- Los datos **no están cifrados** en el dispositivo: quien tenga acceso al teléfono desbloqueado puede ver cotizaciones. Mitigación: bloqueo del dispositivo; cifrado quedará para la versión con backend.
- Si el usuario borra los datos del navegador, **pierde todo** salvo que tenga respaldo JSON. Mitigación: sección de respaldo visible en Ajustes y advertencias en README.
- El PDF interno descargado es un archivo sensible: es responsabilidad del usuario no compartirlo. El archivo se nombra `Interno-…` y está rotulado "NO ENTREGAR AL CLIENTE".
- El **respaldo JSON exportado contiene TODO** (márgenes, pagos del taller, abonos, notas internas) en texto plano. No compartirlo jamás; al adjuntar archivos por WhatsApp, verificar dos veces que se elige el PDF y no el respaldo. Cifrado con contraseña queda para la etapa con backend.
- Los campos "Observaciones para el cliente" y "Observaciones internas" están cerca en el formulario. El detector textual bloquea términos internos antes de la salida, pero no puede leer texto incrustado dentro de logos o imágenes; esas imágenes deben revisarse visualmente antes de compartir.

## Obligatorio antes de cualquier versión con backend/SaaS

- [ ] Autenticación gestionada (no casera) y autorización validada en backend.
- [ ] Aislamiento por `organization_id` en TODAS las consultas (idealmente RLS).
- [ ] HTTPS obligatorio, cabeceras de seguridad, rate limiting.
- [ ] Secretos en gestor de secretos, jamás en el repo.
- [ ] Backups cifrados y política de retención.
- [ ] Revisión de privacidad de datos personales de clientes (Ley 1581 de 2012, Colombia).
