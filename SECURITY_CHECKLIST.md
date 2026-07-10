# SECURITY_CHECKLIST — Emerald Dealer Quote

## Estado actual (MVP local, sin backend)

- [x] **Sin secretos en el repositorio**: no hay tokens, claves ni credenciales. `.env` está en `.gitignore` por si en el futuro se necesita.
- [x] **Separación cliente/interno**: el PDF y el mensaje de WhatsApp del cliente nunca incluyen margen, utilidad, costos, precio por gramo, pureza ni notas internas. Verificado con tests automáticos (`pdfContent.test.ts`, `whatsapp.test.ts`).
- [x] **Datos locales**: todo vive en IndexedDB del dispositivo. No se envía nada a servidores propios. (El enlace de WhatsApp abre wa.me con el texto del mensaje, decisión consciente del flujo.)
- [x] **Confirmaciones destructivas**: eliminar cotización/cliente e importar respaldo piden confirmación explícita; la importación advierte que reemplaza todo.
- [x] **Validación de respaldos**: el JSON importado se valida (app, versión, estructura) antes de tocar los datos.
- [x] **Sin dependencias innecesarias**: 3 dependencias de runtime (react, react-dom, jspdf).
- [x] **Normalización total al importar** (v0.5.0): un respaldo corrupto, editado o de versión anterior se corrige antes de persistirse; nunca puede dejar la app inservible (`services/schema.ts`).
- [x] **Imágenes solo internas** (v0.5.0): las imágenes deben ser data URLs generadas por la app; URLs externas en respaldos se descartan (impide balizas de rastreo).
- [x] **Content-Security-Policy en producción** (v0.5.0): red permitida únicamente hacia las dos APIs del precio del oro; mitiga XSS y dependencias comprometidas. Ver plugin en `vite.config.ts`.
- [x] **Límites de sanidad del precio del oro** (v0.5.0): valores absurdos de las APIs se rechazan; se conserva el último precio bueno.
- [x] **Auditoría multi-ángulo ejecutada el 2026-07-09** (8 ángulos + verificación). Resultados y decisiones en DECISIONS.md D-010.

## Riesgos conocidos y aceptados en el MVP

- Los datos **no están cifrados** en el dispositivo: quien tenga acceso al teléfono desbloqueado puede ver cotizaciones. Mitigación: bloqueo del dispositivo; cifrado quedará para la versión con backend.
- Si el usuario borra los datos del navegador, **pierde todo** salvo que tenga respaldo JSON. Mitigación: sección de respaldo visible en Ajustes y advertencias en README.
- El PDF interno descargado es un archivo sensible: es responsabilidad del usuario no compartirlo. El archivo se nombra `Interno-…` y está rotulado "NO ENTREGAR AL CLIENTE".
- El **respaldo JSON exportado contiene TODO** (márgenes, pagos del taller, abonos, notas internas) en texto plano. No compartirlo jamás; al adjuntar archivos por WhatsApp, verificar dos veces que se elige el PDF y no el respaldo. Cifrado con contraseña queda para la etapa con backend.
- Los campos "Observaciones para el cliente" y "Observaciones internas" están cerca en el formulario: revisar antes de generar el PDF que no se escribió información sensible en el campo visible (mejora de interfaz anotada en ROADMAP).

## Obligatorio antes de cualquier versión con backend/SaaS

- [ ] Autenticación gestionada (no casera) y autorización validada en backend.
- [ ] Aislamiento por `organization_id` en TODAS las consultas (idealmente RLS).
- [ ] HTTPS obligatorio, cabeceras de seguridad, rate limiting.
- [ ] Secretos en gestor de secretos, jamás en el repo.
- [ ] Backups cifrados y política de retención.
- [ ] Revisión de privacidad de datos personales de clientes (Ley 1581 de 2012, Colombia).
