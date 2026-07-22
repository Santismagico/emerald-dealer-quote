# Turno nocturno del 2026-07-22 — qué voy a hacer mientras Héctor duerme

Héctor autorizó trabajo autónomo. Este documento dice **exactamente** qué me permito
hacer sin él, qué NO voy a tocar aunque tenga permiso, y en qué orden trabajo.
Al final queda el parte de la mañana en `docs/PARTE_DE_LA_MANANA.md`.

---

## Lo que NO voy a hacer, aunque tenga acceso

Estas cosas no dependen de permiso: dependen de que **alguien podría salir
perjudicado** o de que **no las puedo deshacer**.

| No lo hago | Por qué |
|---|---|
| Avanzar `main` o tocar `.github/workflows/deploy.yml` | Publica a las 7 joyerías del piloto. Eso solo con orden expresa suya, cada vez. |
| Aplicar el SQL al servidor de producción | Es su panel, sus datos reales y sus cuentas. El texto queda listo; el botón lo presiona usted. |
| Publicar al enlace nuevo | Va **después** del SQL. Publicar antes dejaría la app pidiendo tablas que no existen. |
| Quitar la marca `BORRADOR` de los documentos legales | Falta revisión profesional. La prueba que lo exige se queda como está. |
| Tocar el motor de cálculo, el precio del oro o las pruebas de privacidad | Son la ley del proyecto. |
| Inventar decisiones de negocio suyas | Si algo necesita su criterio, lo anoto y lo espero. |

**Sí voy a subir la rama de trabajo `codex/fase2-nube` a GitHub.** No es publicar:
el despliegue solo corre a mano, solo desde `main` y solo con su confirmación. Subir
la rama protege el trabajo de esta noche si algo le pasa al computador, y es la
regla 1 del propio proyecto.

---

## El orden en que trabajo

### 1. Proteger lo hecho
Subir la rama y su tag a GitHub para que nada de hoy se pierda.

### 2. Auditar mi propio trabajo (lo más importante)
Hoy escribí mucho código de una sola pasada. Eso siempre deja defectos. Voy a
buscarlos yo mismo, con la misma dureza con que auditaría el trabajo de otro,
concentrándome en:

- **Dinero que se pierde o se duplica.** Editar una venta que ya tiene abonos,
  bajarle el precio por debajo de lo ya abonado, borrar un lote que tiene una deuda
  viva.
- **Ventanas emergentes en el teléfono.** El formulario de venta creció con el
  bloque de crédito. El defecto que usted mismo encontró el 18 de julio (botones
  incrustados tras el menú, sin poder desplazar) puede haber vuelto justo ahí.
- **La cadena de la nube.** Que guardar o borrar un comprador realmente suba
  también los lotes y las joyas que cambiaron.
- **Privacidad.** Que nada de lo nuevo (costos de joyas, nombres de compradores,
  notas) pueda colarse a un documento del cliente.

### 3. Corregir lo que encuentre
Cada corrección entra con una prueba que **falla antes y pasa después**. Si no
puedo demostrar el defecto con una prueba, no lo toco: sería adivinar.

### 4. Rellenar la cobertura que quedó corta
Pruebas de la cadena de nube para compradores y joyas, y del recorrido de la
interfaz nueva.

### 5. Volver a verificar en el navegador
Recorrido real otra vez, en 320, 375 y 1280 px, después de todas las correcciones.

### 6. Dejar el parte de la mañana
`docs/PARTE_DE_LA_MANANA.md`: qué encontré, qué corregí, qué falta y **qué
necesito de usted**, en lenguaje sencillo y con pasos visuales.

---

## Lo que va a estar esperándolo cuando despierte

1. **Un solo paso suyo pendiente:** pegar el texto SQL en Supabase
   (`docs/SQL_PRODUCCION_INVENTARIO.md`). Cinco minutos, no borra nada.
2. **Una decisión de negocio pendiente**, si aparece alguna que de verdad cambie
   lo que ve el cliente. Se la dejo escrita con una recomendación.
3. Todo lo demás, terminado y probado.

---

_Bitácora de la noche al final de este documento, según vaya avanzando._

---

## Bitácora de la noche (cerrada)

| Hecho | Resultado |
|---|---|
| Proteger el trabajo | Rama `codex/fase2-nube` y sus tags subidos a GitHub |
| Auditar mi propio trabajo | **2 defectos reales encontrados**, ambos con dinero de por medio |
| H1 · abonos borrados por el interruptor de crédito | Corregido con `withSaleCredit` + aviso en pantalla; 8 pruebas |
| H2 · avisos de borrado que callaban la plata | Corregido en lote y venta; 4 pruebas |
| Cobertura de nube que faltaba | 6 pruebas: propagación al renombrar/borrar comprador y funciones protegidas |
| Mejora de uso | "Ya le pagó todo ✓" cuando una deuda queda saldada |
| Verificación en navegador | Defecto H1 reproducido y confirmado corregido; ventanas emergentes sin regresión a 320 px |
| Decisión registrada | **D-047** en `DECISIONS.md` |
| Estado final | **673 pruebas y compilación en verde** (antes 655) |

Nada de lo prohibido se tocó: `main` intacto, sin publicar, sin entrar al servidor de
producción. El parte para Héctor quedó en `docs/PARTE_DE_LA_MANANA.md`.
