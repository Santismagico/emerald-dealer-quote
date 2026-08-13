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

## Bloque 1 — Antes del PRIMER usuario (bloquea el lanzamiento)

| # | Qué | Por qué | Quién |
|---|---|---|---|
| 1 | **Supabase Pro** | Sin él el servidor se apaga tras una semana y **no hay copias de seguridad**. Los términos ya prometen respaldo diario: sin Pro, ese texto sería falso | Santiago (~$25 USD/mes) |
| 2 | **Cupo de 20** | Hoy cualquiera con el enlace crea cuenta. Sin tope no hay beta controlada | Construir |
| 3 | **Borrar cuenta y datos** | Es un derecho del titular, no una función opcional. **Puede ser manual al principio** (el operador borra y deja constancia), pero el procedimiento tiene que existir y estar probado | Construir o documentar como manual |
| 4 | **Correo de registro y recuperación** | El servicio básico de Supabase es limitado. Con 20 personas no técnicas, un correo que no llega es una llamada | Construir |
| 5 | **Aceptar el acuerdo de datos de Supabase** | Cierra 4 de los 6 huecos legales que quedan | Santiago, trámite de lectura |
| 6 | **Publicar la app actualizada** | La versión publicada es del 10 de agosto: no tiene el arreglo del `id` ni la versión nueva de los términos | Publicar |

## Bloque 2 — Durante el mes gratis (bloquea el primer COBRO, no el lanzamiento)

| # | Qué | Por qué | Quién |
|---|---|---|---|
| 7 | **Contador** | Régimen tributario, si $80.000 incluye o excluye impuestos, cómo facturar. Con 20 clientes son $1.600.000 al mes | Profesional |
| 8 | **Modo solo lectura** | Los términos lo prometen para el día 11 de mora. No hace falta antes de que alguien deba dinero, pero sí antes de cobrar | Construir |
| 9 | **Estado de la cuenta** | La app no sabe quién está en prueba, quién al día y quién en mora. Con 20 se puede llevar a mano al principio | Construir o llevar a mano |
| 10 | **Abogado** | Revisar los dos documentos y responder una pregunta concreta: **si le toca registrar bases de datos ante la SIC** | Profesional |

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

Los tres documentos pasaron de **11 huecos a 6**, y los 6 dependen de terceros:

| Hueco | De quién depende |
|---|---|
| Régimen tributario, impuestos y facturación | Contador |
| Acuerdo de datos de Supabase, región y transmisión internacional | Santiago (aceptar) + abogado |
| Confirmar condiciones de proveedores y subencargados (×2) | Lo anterior lo resuelve |
| Dejar evidencia de esa revisión | Lo anterior lo resuelve |
| Enlace público permanente de los documentos | Solo si el abogado lo exige |

Todo lo demás quedó redactado: precio, mes gratis, cupo, medio de pago, mora, solo lectura,
reactivación, cancelación, reembolsos, cambios de precio, medidas de seguridad verificadas,
aviso de incidentes, procedimiento de advertencia y suspensión, exportación permanente,
conservación 30 días, eliminación anticipada y comprobable, y aviso de cambios con 30 días.

**Los documentos siguen marcados BORRADOR**, y deben seguir así hasta que el abogado los
revise. Hay una prueba automática que lo obliga mientras quede cualquier `[COMPLETAR`.

## La frontera que no se cruza

Santiago asume los riesgos de producto: que guste o no, que falle, que toque devolver plata.
Eso es suyo y está decidido.

Lo que no es suyo de asumir son los **datos personales de los clientes de sus colegas**. Ahí
él es Encargado y cada joyería es Responsable, y la Ley 1581 impone deberes que no dependen de
la voluntad de ninguno de los dos. Por eso los puntos 1, 3, 5 y 10 no son negociables por
prisa: son los que sostienen esa parte.
