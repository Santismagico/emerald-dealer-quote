# SECURITY_CHECKLIST — Emerald Dealer Quote

## Base local verificada el 2026-07-17

- [x] **Sin secretos en el repositorio**: no hay tokens, claves ni credenciales. `.env` está en `.gitignore` por si en el futuro se necesita.
- [x] **Separación cliente/interno**: PDF cliente, Web Share y WhatsApp bloquean la salida si detectan margen, utilidad, costos, precio por gramo, pureza o notas internas. No existe una confirmación para saltar la protección. Cubierto por `pdfContent.test.ts`, `pdfShare.test.ts` y `whatsapp.test.ts`.
- [x] **Datos locales**: todo vive en IndexedDB del dispositivo y no se envía a servidores propios. El enlace de WhatsApp entrega el texto a `wa.me`; Web Share entrega el PDF cliente únicamente a la aplicación que el usuario elija en el selector nativo.
- [x] **Confirmaciones destructivas**: eliminar cotización/cliente e importar respaldo piden confirmación explícita; la importación advierte que reemplaza todo.
- [x] **Validación de respaldos**: el JSON importado se valida (app, versión, estructura y abonos) antes de tocar los datos; máximo 25 MB y restauración atómica.
- [x] **Formato de respaldo vigente**: se exporta v5 y se aceptan v1–v5, siempre con normalización antes de guardar.
- [x] **Sin dependencias innecesarias**: 4 dependencias de runtime en la candidata (React, React DOM, jsPDF y `@supabase/supabase-js` fijado en 2.110.7). `npm audit` del 2026-07-18: 0 vulnerabilidades.
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

- [x] Autenticación gestionada (no casera) y autorización validada en operaciones protegidas.
- [x] Aislamiento por `organization_id` en todas las tablas, con RLS activado.
- [x] Escrituras directas cerradas; la aplicación solo puede cambiar datos mediante operaciones protegidas.
- [x] Validación en servidor para identificadores, fechas, estados y valores COP críticos.
- [x] Publicación manual con revisión de credenciales, dependencias, pruebas, compilación y evidencia por commit.
- [x] Proyecto desechable de São Paulo creado, migraciones aplicadas, nueve tablas con RLS y confirmación de correo activada.
- [x] Primera ejecución N6 detectó una omisión de permisos heredados; todos los datos ficticios se limpiaron y la omisión quedó corregida y comprobada en el proyecto de pruebas.
- [x] N6 repetido y aprobado: 9/9 controles en 20.498 ms sobre `fffa1bdbf0600c7077f473d39a90546a4926166f`; limpieza total y permisos mínimos comprobados después de la ejecución.
- [x] N7 real aprobado: sesión confirmada, joyería de prueba, recorrido de Cotizador/Taller/Agenda/Piedras/Más, caché visible sin red y operación pendiente enviada una sola vez al recuperar la conexión.
- [x] Importación repetida de cinco registros locales ejecutada contra la cuenta de prueba; las cantidades remotas permanecieron en 3 clientes, 1 cotización, 1 cita, 1 lote, 0 proveedores y 1 configuración.
- [x] La vista del cliente de `ED-2026-0001` no mostró margen, costo, precio por gramo ni nota interna; la vista interna sí conservó esos datos separados.
- [ ] Aprobar una matriz de permisos antes de habilitar invitaciones o varios roles.
- [ ] Configurar un SMTP propio, verificar entrega de confirmación y recuperación, y mantener activada la confirmación de correo. El correo integrado de prueba alcanzó el límite del proveedor y no es aceptable para mercado.
- [ ] Activar protección contra contraseñas filtradas antes de mercado o documentar formalmente la aceptación del riesgo; Supabase la ofrece desde el plan Pro. Mientras el proyecto siga gratuito, exigir al menos ocho caracteres en servidor y aplicación.
- [ ] Completar la revisión profesional de términos, privacidad y tratamiento de datos; no retirar las marcas de borrador antes de esa aprobación.
- [x] Nombrar un revisor independiente y cerrar sus hallazgos antes de aceptar información real de joyerías. Fable auditó la candidata 1.1.0 en tres pasadas (`docs/AUDITORIA_FABLE_FASE2.md`, `_SEGUNDA.md`, `_TERCERA.md`); los cinco hallazgos quedaron corregidos y verificados. Pendiente menor sin bloqueo: O1.
- [ ] Repetir N6 sobre el commit final de la candidata que se vaya a publicar; el despliegue rechaza cualquier commit distinto.
- [ ] Configurar en GitHub `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` únicamente cuando Santiago ordene el corte público. La clave `service_role` nunca entra en GitHub ni en el navegador.
- [ ] Confirmar HTTPS, cabeceras de seguridad y límites de abuso en el entorno público final.
- [ ] Secretos administrativos en gestor de secretos, jamás en el repo ni en variables públicas del navegador.
- [ ] Backups cifrados y política de retención.
- [ ] Revisión de privacidad de datos personales de clientes (Ley 1581 de 2012, Colombia).
