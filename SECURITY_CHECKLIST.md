# SECURITY_CHECKLIST — Emerald Dealer Quote

## Estado actual (MVP local, sin backend)

- [x] **Sin secretos en el repositorio**: no hay tokens, claves ni credenciales. `.env` está en `.gitignore` por si en el futuro se necesita.
- [x] **Separación cliente/interno**: el PDF y el mensaje de WhatsApp del cliente nunca incluyen margen, utilidad, costos, precio por gramo, pureza ni notas internas. Verificado con tests automáticos (`pdfContent.test.ts`, `whatsapp.test.ts`).
- [x] **Datos locales**: todo vive en IndexedDB del dispositivo. No se envía nada a servidores propios. (El enlace de WhatsApp abre wa.me con el texto del mensaje, decisión consciente del flujo.)
- [x] **Confirmaciones destructivas**: eliminar cotización/cliente e importar respaldo piden confirmación explícita; la importación advierte que reemplaza todo.
- [x] **Validación de respaldos**: el JSON importado se valida (app, versión, estructura) antes de tocar los datos.
- [x] **Sin dependencias innecesarias**: 3 dependencias de runtime (react, react-dom, jspdf).

## Riesgos conocidos y aceptados en el MVP

- Los datos **no están cifrados** en el dispositivo: quien tenga acceso al teléfono desbloqueado puede ver cotizaciones. Mitigación: bloqueo del dispositivo; cifrado quedará para la versión con backend.
- Si el usuario borra los datos del navegador, **pierde todo** salvo que tenga respaldo JSON. Mitigación: sección de respaldo visible en Ajustes y advertencias en README.
- El PDF interno descargado es un archivo sensible: es responsabilidad del usuario no compartirlo. El archivo se nombra `Interno-…` y está rotulado "NO ENTREGAR AL CLIENTE".

## Obligatorio antes de cualquier versión con backend/SaaS

- [ ] Autenticación gestionada (no casera) y autorización validada en backend.
- [ ] Aislamiento por `organization_id` en TODAS las consultas (idealmente RLS).
- [ ] HTTPS obligatorio, cabeceras de seguridad, rate limiting.
- [ ] Secretos en gestor de secretos, jamás en el repo.
- [ ] Backups cifrados y política de retención.
- [ ] Revisión de privacidad de datos personales de clientes (Ley 1581 de 2012, Colombia).
