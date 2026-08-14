# Plan de salida al mercado — beta de 20 cupos

_Escrito el 2026-08-12, con las decisiones comerciales de Santiago._

## Las decisiones que mandan

| | |
|---|---|
| Cupo | **20 cuentas** en total |
| Prueba | **1 mes gratis** por cuenta, desde su creación |
| Precio | **$80.000 COP** al mes por joyería |
| Cobro | **Manual**, por transferencia. Sin tarjeta ni débito automático |
| Mora | **10 días** de gracia, luego **solo lectura** (nunca se pierde el acceso a consultar y exportar) |
| Al cancelar | Datos **30 días**, luego eliminación definitiva |
| Los del piloto | De los 7 originales **solo 1 usa la app de verdad**. Entra dentro de los 20 |

Ese último dato cambia el tamaño del problema: la "migración de las 7 joyerías" es en realidad
**una persona**. Deja de ser un riesgo y pasa a ser un trámite.

## La regla de oro de la secuencia

**El mes gratis compra un mes de tiempo.** Nadie debe dinero hasta 30 días después de
registrarse, así que todo lo relacionado con cobrar y con la mora **no bloquea el lanzamiento**;
bloquea el primer cobro.

Lo que sí bloquea el lanzamiento es lo que empieza a correr en el instante en que un colega
registra a su primer cliente: las obligaciones sobre **datos personales de terceros**.

## Bloque 1 — Antes del PRIMER usuario — **COMPLETO el 2026-08-13**

| # | Qué | Estado | Quién |
|---|---|---|---|
| 1 | **Supabase Pro** | ✅ **Activado el 2026-08-12.** Sin él el servidor se apaga tras una semana y no hay copias de seguridad, y los términos prometen respaldo diario | Santiago |
| 2 | **Cupo de 20** | ✅ Construido y aplicado en **Pruebas y Producción** | — |
| 3 | **Borrar cuenta y datos** | ✅ Construido y aplicado en **Pruebas y Producción**. El borrado del correo de acceso sigue siendo manual, documentado en `ACTIVACION_CUPO_Y_BORRADO.md` | — |
| 4 | **Aplicar en Producción** el cupo y el borrado | ✅ **Hecho el 2026-08-12.** Verificado con sonda pública: `delete_my_organization` existe y solo la app puede llamarla | Santiago |
| 5 | **Correo de registro y recuperación** | ✅ **Hecho el 2026-08-13.** Gmail como servidor SMTP con contraseña de aplicación. Probado en vivo: se disparó un correo de recuperación y llegó. Límite subido a 100/hora | Santiago + Claude |
| 6 | **Publicar la app actualizada** | ✅ **Publicado el 2026-08-12** con orden expresa. Sitio `8551516`, fuente `bc5cfd0`. Verificado en vivo | — |

## Bloque 2 — Durante el mes gratis (bloquea el primer COBRO, no el lanzamiento)

| # | Qué | Por qué | Quién |
|---|---|---|---|
| 7 | **Contador** | Régimen tributario, si $80.000 incluye o excluye impuestos, cómo facturar. Con 20 clientes son $1.600.000 al mes | Profesional |
| 8 | **Modo solo lectura** | ✅ **Construido el 2026-08-13** y aplicado en Pruebas. Probado en vivo por N6: bloquea, deja leer y exportar, y reactiva sin pérdida | — |
| 9 | **Estado de la cuenta** | La app no sabe quién está en prueba, quién al día y quién en mora. Con 20 se puede llevar a mano al principio | Construir o llevar a mano |
| 10 | **Control de cuentas compartidas** | ✅ **Construido el 2026-08-13** y aplicado en Pruebas. Probado en vivo: registra, deduplica y ninguna joyería puede leer el registro | — |

## El control de cuentas compartidas

Santiago pidió el 2026-08-12 poder controlar que una cuenta pagada no la usen varias joyerías.
Los términos `v1-2026-08-12` ya lo prohíben expresamente (numeral 3, «Una cuenta por joyería»
y «Verificación del uso»; numeral 6 para las consecuencias), y la política de privacidad ya
declara el registro técnico que lo hace verificable.

**Lo que hay que construir:** guardar por cuenta un identificador de dispositivo y la fecha
del último acceso, y una consulta que le diga a Santiago desde cuántos dispositivos distintos
se usó cada cuenta en los últimos 30 días. Nada más: ni ubicación, ni navegación, ni actividad
comercial — la política promete justamente eso y no puede quedarse corta ni pasarse.

**Umbral decidido por Santiago el 2026-08-12: tres (3) equipos por cuenta.** Cubre el uso
legítimo —celular, tableta y computador— y deja fuera el reparto entre varias joyerías. Al
construirlo hay que contar **dispositivos distintos vistos en los últimos 30 días**, no
acumulados de por vida: si no, cambiar de teléfono dos veces en un año dispararía la alarma
de un cliente honesto.

**Enforcement manual, no automático.** Con 20 cuentas, la app **señala** y Santiago decide.
Bloquear solo por número de dispositivos castigaría a un cliente honesto sin que nadie
revisara el caso; los términos ya obligan a pedir explicación antes de aplicar el numeral 6.

**Disuasión que ya existe y conviene recordar:** ocho joyerías bajo una sola cuenta compartirían
**una sola joyería** — los mismos clientes, las mismas cotizaciones, la misma numeración
consecutiva y los mismos precios a la vista. Entre competidores eso es inservible. El riesgo
real no son ocho negocios distintos, sino un grupo que ya opera como uno solo.

## Bloque 3 — Operación del lanzamiento

1. **Avisar al colega activo** que exporte su respaldo (Ajustes → Exportar respaldo). Es el único
   que tiene datos que perder.
2. **Migrarlo a él primero** y mirar una semana cómo se comporta antes de abrir el resto.
3. **Abrir las 19 plazas restantes**, con su mes gratis contado desde el registro de cada uno.
4. **A los 25 días**, avisar a cada quien que se le vence la prueba.
5. **Cobrar**, confirmar y activar.

## Lo que NO hay que construir, y conviene recordarlo

- **Cobro automático.** Con 20 personas, una transferencia y una confirmación por WhatsApp
  funcionan. Wompi se justifica cuando el volumen duela, no antes.
- **Flujo de invitación.** La app ya tiene "Crear cuenta". El cupo lo controla el tope, no una
  lista de invitados.
- **Aceptación de términos.** Ya está construida, con fecha, hora y versión, y ya obliga a
  re-aceptar cuando cambia la versión. Eso último se activará solo con el cambio de hoy.

## Estado legal a 2026-08-12

Los tres documentos quedaron **sin ningún hueco** y en versión final. Cómo se cerró cada uno:

| Hueco que había | Cómo se cerró |
|---|---|
| Régimen tributario e IVA | Santiago determinó que como persona natural no está obligado a facturar. Se retiró la mención contable y quedó que los $80.000 son el valor total a pagar |
| Acuerdo de datos de Supabase | **Verificado:** su DPA (v1, 1 de agosto de 2026) forma parte de sus Términos de Servicio y rige automáticamente. No había nada que firmar ni solicitar. Santiago dudó de esta tarea y tenía razón |
| Región y transmisión internacional | Confirmada por Santiago: los dos proyectos en Sudamérica (São Paulo) |
| Registro de bases ante la SIC | Santiago, abogado en ejercicio, determinó que no aplica |
| Enlace público permanente | El revisor no lo exigió |

**Dato de hecho que se le reportó antes de decidir:** la app sí guarda teléfono, correo,
ciudad y documento de identidad de los clientes, y teléfono de compradores y proveedores —no
solo el nombre—. La conclusión jurídica es suya, tomada con ese dato a la vista.

Todo lo demás quedó redactado: precio, mes gratis, cupo, medio de pago, mora, solo lectura,
reactivación, cancelación, reembolsos, cambios de precio, medidas de seguridad verificadas,
aviso de incidentes, procedimiento de advertencia y suspensión, exportación permanente,
conservación 30 días, eliminación anticipada y comprobable, y aviso de cambios con 30 días.

**Los tres documentos pasaron a `v1-2026-08-12`** el 2026-08-12: Santiago los leyó, los aprobó
y quitó la marca de borrador. Él es abogado en ejercicio y es el revisor. Las constantes del
código cambiaron con ellos, así que la app **pedirá aceptación** — hoy no hay nadie
registrado, que era el momento barato para hacerlo.

## La frontera que no se cruza

Santiago asume los riesgos de producto: que guste o no, que falle, que toque devolver plata.
Eso es suyo y está decidido.

Lo que no es suyo de asumir son los **datos personales de los clientes de sus colegas**. Ahí
él es Encargado y cada joyería es Responsable, y la Ley 1581 impone deberes que no dependen de
la voluntad de ninguno de los dos. Por eso los puntos 1, 3, 5 y 10 no son negociables por
prisa: son los que sostienen esa parte.


## El correo transaccional y por qué no sirve un Gmail como remitente

**Error cometido el 2026-08-13, para que no se repita.** Se le indicó a Santiago crear cuenta
en Brevo y verificar su Gmail como remitente. **Eso ya no es posible** y le costó tiempo.

**La causa.** Desde febrero de 2024 Gmail y Yahoo exigen que quien envía correo automático
autentique su propio dominio; Microsoft se sumó en 2025. Un proveedor externo no puede enviar
«de parte de» una dirección `@gmail.com`: el mensaje no pasaría la verificación. Brevo lo
aplica reemplazando el remitente por uno suyo, del tipo `algo@brevosend.com`.

**Regla para futuras sesiones:** cualquier proveedor de correo transaccional —Brevo, SendGrid,
Resend, SES— exige **dominio propio** para poder poner al usuario como remitente. Ninguno
acepta ya webmail gratuito. No sugerir «verifica un solo remitente» sin comprobarlo antes.

**Las dos salidas reales**, en `docs/` y explicadas paso a paso para Santiago:

1. **Gmail directo como servidor SMTP** (`smtp.gmail.com:587`, usuario = el Gmail completo,
   contraseña = una **contraseña de aplicación** de 16 letras que exige verificación en dos
   pasos). No hay problema de autenticación porque el correo sale realmente de Gmail. Límite:
   **500 al día**, veinticinco veces lo que necesita la beta. Gratis, veinte minutos.
   **No funciona** con cuentas de Google Workspace —Google retiró las contraseñas de
   aplicación en mayo de 2025— ni con Protección Avanzada ni con 2FA solo por llave física.
2. **Dominio propio** (~$50.000 COP/año) autenticado en Brevo con SPF, DKIM y DMARC. Es lo
   que conviene a mediano plazo, y no solo por el correo: un producto de pago viviendo en una
   dirección de GitHub se ve improvisado.

**Recomendado:** el 1 ahora para desbloquear la beta, el 2 dentro del mes. Cambiar de uno a
otro son cuatro campos en Supabase, no rompe nada.

**Ojo con el campo Username, que es la confusión número uno:** con Gmail es el correo
completo; con Brevo es un identificador propio terminado en `@smtp-brevo.com`, **no** el
correo. Supabase arranca todo SMTP nuevo limitado a **30 correos por hora**, ajustable en
Authentication → Rate Limits.
