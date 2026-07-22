# Buenos días, Héctor

_Parte del trabajo de la noche del 22 de julio de 2026._

---

## Lo primero: hay **un solo paso suyo** pendiente

Pegar un texto en Supabase. Cinco minutos. **No borra nada** de lo que ya tiene guardado.

Las instrucciones, con pasos visuales, están en
[docs/SQL_PRODUCCION_INVENTARIO.md](SQL_PRODUCCION_INVENTARIO.md).

Cuando lo haya hecho, avíseme y publico la actualización al enlace nuevo. **En ese
orden**: si publicamos antes, la aplicación buscaría cosas que el servidor todavía no
conoce.

---

## Lo que hice mientras dormía

Me puse a auditar mi propio trabajo del día, con la misma dureza con que revisaría el
de otro. **Encontré dos defectos reales.** Los dos podían costarle dinero.

### Defecto 1 — el grave: se borraban abonos ya recibidos

**Qué pasaba.** Usted vende unas esmeraldas a crédito por $3.000.000. El comprador le
abona $1.200.000. Después usted entra a corregir algo de esa venta y, sin querer, apaga
el interruptor *"se la vendí a crédito"*. Al guardar, **ese abono de $1.200.000
desaparecía para siempre**, sin aviso y sin manera de recuperarlo.

**Por qué pasaba.** La aplicación sí tenía una defensa que impedía ese cambio. Pero el
interruptor borraba los abonos *antes* de que la defensa mirara, así que la defensa no
veía nada que proteger y dejaba pasar el guardado.

**Cómo quedó.** El interruptor ya no borra nada. Ahora, si la venta tiene abonos, le
aparece en rojo:

> Esta venta ya tiene 1 abono(s) por $1.200.000. No se puede pasar a contado sin borrar
> ese historial de cobro: vuelve a activar el crédito para poder guardar.

Y si intenta guardar de todos modos, la app se lo impide. **Lo probé en el navegador
reproduciendo el caso exacto:** el abono sobrevivió y el saldo de $1.800.000 quedó
intacto.

### Defecto 2 — los avisos de borrar callaban plata

Cuando borraba un lote que tenía ventas a crédito sin pagar, ese cobro **desaparecía de
la pantalla de Cobros sin que el aviso lo mencionara**. Igual pasaba al borrar una venta:
se llevaba los abonos en silencio.

Ahora los avisos le dicen el monto exacto antes de que usted confirme. Por ejemplo:

> OJO: también se borrarán $1.800.000 que te deben por ventas a crédito y desaparecerán
> de Cobros.

### Un detalle de uso que mejoré

Cuando alguien terminaba de pagarle, la pantalla se quedaba en $0 sin decir nada. Ahora
dice **"Ya le pagó todo ✓"** y el avisito al guardar el último abono dice **"Venta pagada
por completo ✓"**.

---

## Lo que verifiqué de nuevo, con la app corriendo

- Los datos de anoche seguían ahí después de cerrar y abrir: el abono, el saldo y los
  12 días de vencido.
- **El problema de las ventanas emergentes que usted encontró en julio no volvió**,
  aunque el formulario de venta creció con el bloque de crédito. Lo medí: después de
  desplazar, el botón Guardar queda 40 píxeles por encima del menú, y mide 48 píxeles
  de alto (el mínimo cómodo para el dedo es 44).
- Sin desbordamiento horizontal en teléfono angosto (320), teléfono normal (375) ni
  computador (1280).
- **673 pruebas en verde** y compilación sin errores. Anoche eran 655; las 18 nuevas
  son las que demuestran los defectos corregidos y la sincronización con la nube.

---

## Algo que quiero que sepa, sin que sea un problema todavía

Las fotos de las joyas se guardan dentro de su respaldo. Cada foto pesa como máximo
1,5 MB y el respaldo completo no puede pasar de 25 MB. Con unas 15 joyas con foto se
acercaría al límite.

**No hay que hacer nada ahora.** Solo que si algún día el respaldo le avisa que está muy
grande, ya sabemos por dónde viene y se resuelve fácil.

---

## Nada de esto tocó lo que está en la calle

- `main` **intacto**. Las 7 joyerías amigas siguen con la versión de siempre.
- No publiqué nada a ningún enlace.
- No entré a su servidor de producción.
- Todo el trabajo está guardado en GitHub, en la rama de trabajo, con puntos de
  restauración por si algo hubiera que devolver.

---

## Cuando despierte, dígame nomás

1. **"Ya pegué el SQL"** → publico la actualización y la verificamos juntos en vivo.
2. O si prefiere revisar primero, dígame **"muéstrame cómo quedó"** y le hago un
   recorrido de lo nuevo antes de tocar nada.

Que haya descansado.
