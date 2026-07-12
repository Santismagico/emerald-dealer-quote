# Auditoría de identificación — Quote Emerald Dealer

**Fecha de auditoría:** 11 de julio de 2026  
**Modo:** investigación técnica de solo lectura  
**Único archivo creado por esta auditoría:** `FABLE_PROJECT_AUDIT.md`

## Resumen ejecutivo

**Conclusión principal: probablemente es el prototipo de Fable.**  
**Nivel de confianza: 96%.**

La evidencia no depende del nombre “Emerald Dealer”. El historial empieza en una carpeta vacía, el primer cambio registra la creación completa de la aplicación y lleva la firma compartida `Claude Fable 5`. Los diez cambios existentes conservan esa firma, la rama nació con el nombre `fable/regeneracion-emerald-dealer-quote-v1`, existe configuración propia de Claude y no aparecen rastros de Replit ni una historia anterior de otro proyecto.

La aplicación no es una maqueta: el build local respondió correctamente, la copia pública vinculada por el propio repositorio abrió y permitió recorrer la interfaz, y el código contiene cálculos, almacenamiento local, PDF y PWA reales.

La reserva que impide dar 100% es esta: no se tuvo acceso directo al contenido instalado en el celular para compararlo archivo por archivo. Además, la rama abierta contiene un cambio Fable posterior al último cambio de `origin/main`, por lo que pertenece al mismo proyecto, pero puede no ser exactamente la misma revisión que está publicada o almacenada en el teléfono.

---

## 1. Carpeta y proyecto inspeccionado

- **Carpeta:** `C:\Users\santi\OneDrive\Escritorio\EMERALD DEALER\CLAUDE`
- **Proyecto:** `emerald-dealer-quote`
- **Versión declarada:** `0.5.0`
- **Rama abierta:** `fable/regeneracion-emerald-dealer-quote-v1`
- **Cambio actual:** `c3140c4`
- **Repositorio conectado:** `https://github.com/Santismagico/emerald-dealer-quote.git`
- **Copia pública documentada y revisada:** `https://santismagico.github.io/emerald-dealer-quote/`
- **Cantidad de archivos registrados por Git:** 63

Estado previo a la auditoría: ya existían dos documentos sin registrar en Git, `CLAUDE.md` y `PROJECT_STATE.md`. No fueron creados ni modificados durante esta auditoría.

## 2. Conclusión

### Veredicto obligatorio

**Probablemente es el prototipo de Fable.**

No hay evidencia de que esta carpeta sea la versión antigua de Replit. Tampoco hay una historia de código que indique que sea el proyecto antiguo de Codex descartado.

Sí existen documentos posteriores que preparan trabajo futuro para Codex. Esos documentos no forman parte del historial registrado, fueron añadidos después de la aplicación y describen un traspaso futuro. No demuestran que el código encontrado sea la antigua versión de Codex.

### Diferencia importante

- **Confianza de que pertenece al proyecto creado por Fable:** 96%.
- **Confianza de que es exactamente la misma revisión instalada hoy en el celular:** aproximadamente 85%.

La segunda cifra es menor porque la aplicación del celular puede conservar una revisión anterior mediante su PWA, o haberse actualizado desde la copia pública. No se inspeccionó directamente el teléfono.

## 3. Nivel de confianza

**96 de 100.**

La confianza es alta por la combinación de historial, firma, rama, documentación, estructura, funcionamiento y ausencia de señales de las versiones descartadas.

No se asigna 100 porque:

1. La firma `Co-Authored-By: Claude Fable 5` está en los mensajes de Git, pero no es una certificación criptográfica de Anthropic.
2. No se recibió una exportación original de la sesión de Fable para compararla.
3. No se comparó directamente con la PWA guardada en el celular.
4. La rama abierta va un cambio por delante de la rama pública conocida.

## 4. Evidencias que sustentan la conclusión

### Evidencias fuertes de Fable

1. El primer cambio del historial es `a5f24ca`, del 8 de julio de 2026. Su descripción dice expresamente: **“Aplicación completa creada desde cero (carpeta vacía)”**.
2. Ese primer cambio creó en un solo bloque la interfaz, cálculos, clientes, historial, PDF, almacenamiento, PWA, pruebas y documentación.
3. El primer cambio termina con `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
4. Los diez cambios del historial, desde `a5f24ca` hasta `c3140c4`, tienen la misma firma compartida de Claude Fable 5.
5. El historial nació directamente en `fable/regeneracion-emerald-dealer-quote-v1`; la rama `main` fue creada después desde ese trabajo.
6. `WEEKLY_PROGRESS.md` y `DECISIONS.md` confirman que la carpeta estaba vacía y que el proyecto se creó desde cero.
7. `.claude/launch.json` fue incluido en el primer cambio y contiene las dos formas de abrir esta aplicación: desarrollo y vista del build.
8. El registro local de Claude es coherente con la creación del repositorio, la rama Fable, las verificaciones y la publicación.
9. La copia pública indicada por el proyecto abrió correctamente y su interfaz coincide con las vistas y textos del código inspeccionado.
10. La copia pública mostró `Emerald Dealer Quote v0.5.0`, igual que la versión declarada por esta carpeta.

### Evidencias contra una versión antigua de Replit

- No existe `.replit`.
- No existe `replit.nix`.
- No hay configuración, paquetes, direcciones ni comentarios propios de Replit.
- No aparece la palabra Replit en el código registrado ni en el historial.
- No existe un historial anterior importado desde otro repositorio.

### Evidencias contra el proyecto antiguo de Codex

- El historial tiene un solo origen y ese origen está firmado como Fable.
- No hay una segunda base de código mezclada, carpetas duplicadas ni cambios que unan dos historias distintas.
- Las referencias a Codex están en `CLAUDE.md` y `PROJECT_STATE.md`, documentos que ya estaban sin registrar en Git antes de esta auditoría.
- `PROJECT_STATE.md` presenta a Codex como ejecutor del **siguiente** trabajo pendiente, especialmente las pruebas del detector de palabras sensibles.
- Los documentos de traspaso que esos archivos mencionan (`docs/EXECUTION_PLAN.md` y `docs/HANDOFF_TO_CODEX.md`) no están presentes.

### Evidencia visual y de ejecución

- El build ya existente se sirvió localmente sin instalar ni reconstruir nada.
- Respondieron correctamente la página principal, JavaScript, estilos, manifiesto PWA, service worker e iconos.
- La copia pública abrió y permitió revisar Historial, Nueva cotización, Clientes y Ajustes.
- Se recorrieron los cuatro pasos de una cotización: Cliente, Pieza, Piedras y Costos.
- En una vista móvil de 390 × 844, la aplicación ocupó el ancho disponible y no presentó desplazamiento horizontal.
- El precio automático del oro apareció cargado en la interfaz durante la revisión pública, confirmando que la integración no es solo una simulación visual.

## 5. Tecnología y estructura general

### Tecnología

- React 19.
- TypeScript.
- Vite.
- Tailwind CSS.
- IndexedDB para guardar la información en el dispositivo.
- jsPDF para crear documentos PDF en el navegador.
- vite-plugin-pwa para instalación y funcionamiento sin conexión.
- Vitest para pruebas automáticas.
- GitHub Pages para la copia pública.

No hay servidor propio, base de datos en la nube, cuentas de usuario ni inicio de sesión.

### Estructura

- `src/App.tsx`: navegación principal.
- `src/components/`: pantallas y bloques visibles.
- `src/calc/`: motor de cálculos.
- `src/services/`: datos locales, respaldos, PDF, WhatsApp y precio del oro.
- `src/types/`: estructura común de los datos.
- `src/utils/`: dinero, fechas, imágenes e identificadores.
- `src/test/` y archivos `*.test.ts`: datos de prueba y pruebas automáticas.
- `public/`: iconos de la PWA.
- `scripts/`: generación de iconos.
- `dist/`: build ya generado; sirve para ejecutar, pero no debe tratarse como código fuente.
- `.github/workflows/`: publicación automática en GitHub Pages.
- `.claude/`: configuración para abrir la aplicación desde Claude.
- Documentación raíz: producto, arquitectura, decisiones, seguridad, pruebas, hoja de ruta y cambios.

`node_modules/` contiene dependencias instaladas y tampoco es código fuente del producto.

## 6. Funcionalidades encontradas

### Pantallas principales

1. **Historial de cotizaciones**
   - Búsqueda por cliente o número.
   - Filtros por estado.
   - Apertura, edición, duplicado y eliminación.
   - Acceso al avance de producción.

2. **Nueva cotización / edición**
   - Paso Cliente y fechas.
   - Paso Pieza y material.
   - Paso Piedras.
   - Paso Costos, descuentos, impuestos, anticipo, notas e imágenes.
   - Cálculo visible del total.

3. **Vista previa**
   - Vista para el cliente.
   - Vista interna confidencial.
   - Guardado y número `ED-AÑO-0001`.
   - PDF cliente.
   - PDF interno.
   - Mensaje para WhatsApp.
   - Producción y abonos en la vista interna.

4. **Clientes**
   - Crear, editar y eliminar clientes.
   - Nombre, teléfono, correo, ciudad, documento y notas.

5. **Ajustes**
   - Nombre y logo de la joyería.
   - NIT, teléfono, WhatsApp, dirección, ciudad y correo.
   - Mensaje comercial y condiciones.
   - Validez de cotizaciones.
   - Precio automático y precio manual del oro.
   - Recargo, margen e impuesto.
   - Exportación e importación de respaldo.
   - Instrucciones para instalar la PWA.

### Funciones internas adicionales

- Seguimiento de producción por etapas.
- Registro local de gastos de taller.
- Registro local de abonos recibidos.
- PDF interno con costos y seguimiento.
- Respaldo completo en JSON.
- Consulta de oro internacional y conversión USD a COP.

## 7. Funciones reales, parciales, simuladas o rotas

### Reales

| Función | Estado comprobado |
|---|---|
| Interfaz principal | Abrió en la copia pública y se recorrieron sus pantallas. |
| Creación de cotización | Formulario real enlazado al cálculo y a la vista previa. |
| Cálculos | Motor separado para material, piedras, mano de obra, margen, descuento, impuesto, anticipo y saldo. |
| Clientes e historial | Operaciones reales sobre almacenamiento local. |
| Ajustes de joyería | Campos reales guardados en el dispositivo. |
| Persistencia | IndexedDB real, no datos escritos dentro de la pantalla. |
| Respaldo | Exportación e importación JSON reales, con validación y confirmación. |
| PDF | Generación real con jsPDF y descarga desde el navegador. |
| PWA | Manifiesto, iconos, registro del service worker y precarga real. |
| Precio del oro | Dos consultas externas reales; el valor se cargó durante la revisión pública. |

### Parciales

| Función | Límite actual |
|---|---|
| WhatsApp | Abre `wa.me` con un mensaje; no adjunta el PDF ni usa una integración empresarial. |
| PWA sin conexión | Está implementada, pero esta auditoría no certificó la instalación y el flujo completo sin internet en un celular físico. |
| Experiencia iPhone | Tiene medidas específicas para iPhone, pero el checklist real de Safari sigue pendiente. |
| Cotizaciones vencidas | Muestra una advertencia visual; no cambia automáticamente el estado guardado. |
| Aviso de palabras sensibles | Existe en la rama actual, permite continuar y el último cambio está expresamente marcado como pendiente de pruebas. |
| Servicios del oro | Funcionaron durante la revisión, pero dependen de páginas externas disponibles. |

### Simuladas o manuales

Estas funciones existen como registros locales, pero no conectan con sistemas externos:

- Los abonos no procesan pagos bancarios.
- La producción no se conecta con talleres o proveedores.
- WhatsApp no envía automáticamente ni confirma entrega.
- No hay nube, cuentas, permisos, organizaciones ni sincronización entre dispositivos.
- El plan de Supabase es documentación futura, no una función construida.

### Rotas o con defectos confirmados

No se comprobó una pantalla principal completamente rota. Sí se encontraron defectos o riesgos reales:

1. **Último cambio sin pruebas:** `c3140c4` añade el detector de términos sensibles, pero el propio historial declara que faltan sus pruebas.
2. **Protección de privacidad incompleta:** el detector revisa descripción, observaciones y piedras, pero el PDF también usa material, condiciones y mensaje comercial configurables. Además, permite “Continuar igual”.
3. **Clientes sin normalización completa:** la documentación afirma que todo dato leído se corrige, pero la lista de clientes no pasa por esa corrección.
4. **Restauración no atómica:** la importación borra clientes y cotizaciones antes de escribir el respaldo. Un fallo a mitad del proceso podría dejar información incompleta.
5. **Dos saldos independientes:** el anticipo cotizado y los abonos reales se guardan por separado; pueden mostrar saldos distintos si no se mantienen alineados.
6. **Precio cero permitido:** si es el primer uso y fallan ambos servicios externos, el formulario advierte sobre el precio del oro en cero, pero no bloquea la cotización.
7. **Documentación desalineada:** `ROADMAP.md` todavía marca pendientes algunas funciones ya construidas, y los documentos de traspaso a Codex mencionados no existen.

## 8. Estado de la PWA

**Estado: real e implementada, con validación física pendiente.**

Evidencias:

- Manifiesto con nombre `Emerald Dealer Quote`, nombre corto `ED Quote`, idioma español, colores, modo independiente e iconos.
- Iconos reales de 192 × 192, 512 × 512 y Apple Touch.
- Service worker generado y registrado automáticamente.
- Precarga de la aplicación, estilos, PDF, iconos y manifiesto.
- Actualización automática.
- Publicación bajo `/emerald-dealer-quote/` preparada por el flujo de GitHub Pages.
- Instrucciones visibles de instalación para iPhone y Android.

Limitaciones:

- No se instaló una nueva copia durante esta auditoría.
- No se verificó un ciclo completo de abrir, cerrar y volver a abrir sin conexión en un teléfono físico.
- El checklist del proyecto todavía muestra esa prueba como pendiente.
- La PWA instalada en el celular puede tener una revisión guardada distinta de la rama actualmente abierta.

## 9. Estado del PDF

**Estado: implementación real; generación visual no repetida durante esta auditoría.**

Evidencias:

- `src/services/pdf.ts` crea PDF reales con jsPDF.
- Hay una salida para cliente y otra salida interna.
- La descarga usa nombres de archivo basados en el número de cotización.
- El build contiene jsPDF y sus módulos auxiliares.
- Existen pruebas que separan contenido de cliente e información interna.
- El PDF interno incluye costos, producción y abonos.

Límites y riesgos:

- No se creó ni descargó un PDF nuevo para evitar guardar datos o archivos adicionales.
- No hay prueba automática del PDF ya dibujado ni de su descarga en iPhone.
- El último detector de términos sensibles está pendiente de pruebas y no revisa todos los textos configurables.
- WhatsApp no adjunta el PDF; solo prepara el mensaje.

## 10. Estado de la experiencia móvil

**Estado: diseñada y funcionando como interfaz móvil; falta validación completa en dispositivos físicos.**

Comprobado:

- La copia pública abrió en un tamaño de 390 × 844.
- La estructura principal ocupó los 390 píxeles disponibles.
- No hubo desplazamiento horizontal.
- Hay navegación inferior fija.
- Los campos usan 16 px para evitar el aumento automático de Safari.
- Los controles principales tienen altura táctil aproximada de 44 a 48 px.
- Se usan las áreas seguras superior e inferior de iPhone.
- La interfaz usa encabezado verde esmeralda, fondos claros, tarjetas redondeadas y acentos dorados.
- Se recorrieron todas las pantallas principales sin encontrar una pantalla en blanco.

No comprobado:

- iPhone físico y Safari.
- Android físico y Chrome.
- Teclado real, cámara/galería, instalación y uso offline.
- PDF y descarga desde el teléfono.
- Comparación visual directa con la copia que Santiago recuerda como aprobada.

## 11. Riesgos encontrados

### Altos

1. **Datos solo en el dispositivo:** si se borra la información del navegador o se pierde el teléfono sin respaldo, se pueden perder cotizaciones, clientes, logo y ajustes.
2. **Importación con posible pérdida parcial:** la restauración no se realiza como una única operación indivisible.
3. **Privacidad del PDF:** el detector nuevo no cubre todos los campos visibles y permite continuar pese al aviso.

### Medios

1. **Revisión exacta no confirmada:** la rama actual está por delante de `origin/main`; la copia pública y la PWA del celular pueden no ser idénticas al cambio `c3140c4`.
2. **Último cambio sin pruebas:** no debe considerarse cerrado hasta probar el detector.
3. **Clientes antiguos o dañados:** pueden fallar al cargarse por la falta de normalización en `listClients`.
4. **Anticipo y abonos:** pueden generar saldos contradictorios.
5. **Dependencia externa:** el precio automático depende de dos servicios de terceros.
6. **Documentación incompleta:** faltan los archivos de traspaso a Codex citados por los documentos nuevos.

### Bajos

1. La carpeta vive dentro de OneDrive; el propio proyecto advierte que la sincronización puede interferir con dependencias o Git.
2. `ROADMAP.md` no refleja completamente el estado del código.
3. `dist/` existe y funciona, pero puede confundirse con el código fuente si un futuro equipo no lee la documentación.

No se encontraron claves, contraseñas o secretos evidentes en los archivos revisados.

## 12. Archivos importantes para los arquitectos

### Procedencia y estado

- Historial de Git completo, especialmente `a5f24ca`, `95e98f2` y `c3140c4`.
- `WEEKLY_PROGRESS.md`
- `DECISIONS.md`
- `CHANGELOG.md`
- `PROJECT_STATE.md` — revisar con cuidado: no está registrado y menciona archivos ausentes.
- `CLAUDE.md` — revisar como documento posterior de traspaso, no como prueba única del origen.

### Entrada y navegación

- `package.json`
- `vite.config.ts`
- `index.html`
- `src/main.tsx`
- `src/App.tsx`
- `src/index.css`

### Datos y cálculos

- `src/types/index.ts`
- `src/calc/engine.ts`
- `src/store.tsx`
- `src/services/db.ts`
- `src/services/storage.ts`
- `src/services/schema.ts`
- `src/services/backup.ts`

### Interfaz

- `src/components/QuoteFormView.tsx`
- `src/components/PreviewView.tsx`
- `src/components/HistoryView.tsx`
- `src/components/ClientsView.tsx`
- `src/components/SettingsView.tsx`
- `src/components/ProductionPanel.tsx`
- `src/components/PaymentsPanel.tsx`
- `src/components/ui.tsx`

### PDF e integraciones

- `src/services/pdfContent.ts`
- `src/services/pdf.ts`
- `src/services/whatsapp.ts`
- `src/services/goldPrice.ts`

### PWA y publicación

- `public/pwa-192.png`
- `public/pwa-512.png`
- `public/apple-touch-icon.png`
- `.github/workflows/deploy.yml`
- `dist/manifest.webmanifest` y `dist/sw.js` — revisar como evidencia del build, no editarlos como fuente.

### Pruebas más importantes

- `src/calc/engine.test.ts`
- `src/services/pdfContent.test.ts`
- `src/services/persistence.test.ts`
- `src/services/schema.test.ts`
- `src/services/goldPrice.test.ts`
- `src/services/whatsapp.test.ts`
- `src/services/production.test.ts`
- `src/services/payments.test.ts`

## 13. Información que falta

1. Capturas o video de la versión de Fable que Santiago aprobó visualmente.
2. Dirección exacta desde la cual se instaló la PWA en el celular.
3. Revisión o versión que conserva actualmente el service worker del teléfono.
4. Exportación original, conversación o paquete entregado por Fable.
5. Copias identificadas de las versiones antiguas de Replit y Codex para una comparación negativa directa.
6. Una ejecución actual de todas las pruebas y del build después de `c3140c4`. No se hizo porque el build volvería a escribir `dist/` y la misión prohibió modificaciones.
7. Prueba real de PDF, instalación PWA, modo sin conexión y restauración de respaldo en un dispositivo de prueba.
8. Los documentos `docs/EXECUTION_PLAN.md` y `docs/HANDOFF_TO_CODEX.md` citados por los archivos nuevos.

## 14. Siguiente paso seguro recomendado

**Tratar esta carpeta como el candidato principal y muy probable código fuente de Fable, pero no empezar todavía cambios de arquitectura.**

Orden seguro recomendado:

1. No mezclar esta carpeta con Replit ni con el proyecto antiguo de Codex.
2. Conservar intactos la rama `fable/regeneracion-emerald-dealer-quote-v1`, el cambio `c3140c4` y la referencia pública `origin/main` en `95e98f2`.
3. Antes de abrir o reinstalar la PWA del celular con internet, conservar evidencia de lo que hay instalado: capturas de todas las pantallas, icono, dirección y versión visible en Ajustes. La PWA usa actualización automática y abrirla conectada puede actualizarla.
4. Comparar esa evidencia con:
   - la copia pública asociada a `origin/main`;
   - la rama actual con el cambio adicional `c3140c4`.
5. Cuando Santiago confirme cuál coincide visualmente con su prototipo aprobado, crear un punto de referencia protegido para los arquitectos y usar solo esa revisión como fuente de verdad.

---

## Integridad de la auditoría

- No se instaló nada.
- No se reconstruyó `dist/`.
- No se ejecutaron pruebas que pudieran generar archivos temporales.
- No se guardaron clientes ni cotizaciones.
- No se descargaron PDF ni respaldos.
- No se borró ni reemplazó ningún archivo.
- Se detuvieron los servidores temporales usados para la comprobación.
- Los archivos registrados por Git permanecieron sin cambios.
- El único archivo de proyecto creado para esta misión es este informe.
