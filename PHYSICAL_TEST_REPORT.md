# Informe de prueba fisica - Emerald Dealer Quote

Fecha: 12 de julio de 2026  
Responsable de la prueba fisica: Santiago  
Candidata auditada: `fable/regeneracion-emerald-dealer-quote-v1`  
Commit probado: `c00ba698ce1b1cd3767c3d768e6d45ebc1cd21ae`  
Tag seguro: `punto-seguro-codex-etapa5-2026-07-12`

## Resumen ejecutivo

La candidata supero las pruebas automaticas y la prueba fisica realizada en iPhone con Safari y como aplicacion instalada. No se identificaron fallas de la aplicacion durante esa prueba.

La prueba en Android con Chrome fue aplazada por falta temporal de un dispositivo disponible. Esto se registra como **No probado**, no como una falla.

Recomendacion: conservar este commit como candidata. No se recomienda autorizar la publicacion definitiva hasta completar el mismo recorrido fisico en Android. Por ahora no hay correcciones identificadas; falta cerrar esa validacion.

## Preparacion verificada

- Rama autorizada: **Aprobado**.
- HEAD exacto `c00ba698ce1b1cd3767c3d768e6d45ebc1cd21ae`: **Aprobado**.
- Tag seguro apuntando al mismo commit: **Aprobado**.
- Pruebas automaticas: **Aprobado** — 294 pruebas aprobadas en 16 archivos.
- Generacion del build: **Aprobado**.
- Copia temporal del build auditado: **Aprobado** — 15 archivos y ninguna diferencia detectada.
- Acceso HTTPS temporal valido: **Aprobado**.
- Uso exclusivo de informacion ficticia: **Aprobado**.

## Resultados en iPhone

1. Apertura directa en Safari: **Aprobado**.
2. Agregar a pantalla de inicio: **Aprobado**.
3. Apertura como aplicacion instalada: **Aprobado**.
4. Ausencia de zoom y desplazamiento horizontal: **Aprobado**.
5. Persistencia despues de cerrar y abrir: **Aprobado**.
6. Funcionamiento sin conexion: **Aprobado**.
7. Descarga del PDF cliente: **Aprobado**.
8. Apertura de Compartir PDF: **Aprobado**.
9. Un unico PDF cliente adjunto: **Aprobado**.
10. Cancelacion sin descarga adicional: **Aprobado**.

## Resultados en Android

1. Apertura en Chrome: **No probado**.
2. Instalacion de la aplicacion: **No probado**.
3. Apertura como aplicacion instalada: **No probado**.
4. Ausencia de zoom y desplazamiento horizontal: **No probado**.
5. Persistencia despues de cerrar y abrir: **No probado**.
6. Funcionamiento sin conexion: **No probado**.
7. Descarga del PDF cliente: **No probado**.
8. Apertura de Compartir PDF: **No probado**.
9. Un unico PDF cliente adjunto: **No probado**.
10. Cancelacion sin duplicados: **No probado**.

Motivo: Santiago no tenia un dispositivo Android disponible en el momento de la prueba.

## Prueba de privacidad en iPhone

Texto utilizado: `Precio del material por gramo: $550.000`

- Bloqueo de PDF cliente: **Aprobado**.
- Bloqueo de Compartir PDF: **Aprobado**.
- Bloqueo de WhatsApp: **Aprobado**.
- Restablecimiento de las tres acciones despues de corregir el texto: **Aprobado**.

## Validaciones adicionales en iPhone

- El PDF cliente no muestra informacion interna: **Aprobado**.
- El PDF interno contiene el desglose: **Aprobado**.
- WhatsApp comparte texto y permanece separado de Compartir PDF: **Aprobado**.
- Exportar respaldo produce un archivo JSON: **Aprobado**.
- Importar respaldo restaura la informacion ficticia: **Aprobado**.
- Dos cotizaciones reciben numeros diferentes: **Aprobado**.
- El aviso de respaldo no interfiere con la prueba: **Aprobado**.
- Un abono ficticio permanece guardado: **Aprobado**.
- Dos etapas de produccion modificadas permanecen guardadas: **Aprobado**.
- No se utilizaron clientes, cotizaciones ni fotografias reales: **Aprobado**.

## Datos ficticios utilizados

- Cliente: Cliente Prueba.
- Telefono: 3000000000.
- Correo: prueba@example.com.
- Ciudad: Bogota.
- Pieza: anillo de oro de 5 gramos.
- Dos piedras ficticias.
- Mano de obra, costos y abono ficticios.
- Dos etapas de produccion modificadas.
- Sin fotografias personales.

## Incidencias de preparacion

- La primera direccion entregada incluyo una ruta adicional que no correspondia al build temporal. En iPhone produjo una pantalla de error y luego un 404. Se corrigio la direccion y la aplicacion abrio correctamente. Se clasifica como error de preparacion del acceso, no como falla de la candidata.
- La primera conexion temporal termino despues de completar la prueba en iPhone. Se preparo una segunda direccion para Android, pero la prueba fue aplazada. No se modifico la aplicacion.

## Cierre y preservacion

- Servidor temporal: **Detenido**.
- Acceso HTTPS temporal: **Detenido**.
- Herramienta y archivos temporales creados para la prueba: **Eliminados**.
- Servicios o tuneles permanentes: **Ninguno**.
- Software permanente instalado: **Ninguno**.
- Cambios en la aplicacion: **Ninguno**.
- Nuevos commits: **Ninguno**.
- Merge a `main`: **Ninguno**.
- Publicacion nueva en GitHub Pages: **Ninguna**.
- Rama `main` local preservada en `a94a3bc009f11f57854b998e4c9ecad5ba5a751b`.
- Rama `main` de GitHub preservada en `95e98f2916f8933db72df3fb93bb15ceb6785187`.
- GitHub Pages existente responde correctamente y su ultima publicacion sigue siendo la anterior a esta prueba.
- Archivos ajenos que ya estaban sin seguimiento: **Preservados sin cambios**.
- Este informe queda sin commit, a la espera de autorizacion.

## Estado final

- iPhone con Safari: **Aprobado**.
- Android con Chrome: **No probado**.
- Candidata: **Sin fallas conocidas, pendiente de validacion fisica en Android antes de publicar**.

---

## Prueba física sobre la versión PUBLICADA (2026-07-17)

Con la v2 ya publicada en https://santismagico.github.io/emerald-dealer-quote/
(`main` = c365aaf: correcciones C1–C9, identidad "el mesón del joyero" D-029 e
ícono "La gema viva"), Santiago desinstaló y reinstaló la PWA en su teléfono
personal siguiendo los pasos visuales y reportó textualmente: **"todo perfecto"**.

Cubre: instalación desde el navegador, ícono nuevo visible en la pantalla de
inicio, arranque y uso de la aplicación publicada en dispositivo real, con los
datos existentes intactos.

## Estado final actualizado

- Teléfono de Santiago (dispositivo real, versión publicada): **Aprobado**.
- Versión publicada: **Sin fallas reportadas**.
