# Plan — Socios múltiples y fondo de inversión

**Fecha:** 2026-08-05
**Autor:** Claude (arquitectura). Implementa Codex.
**Origen:** prueba de uso de Santiago el día de la publicación del plan v2.
**Estado:** etapas 1 a 7 implementadas y verificadas. Etapas 8 (Excel) y 9 (Nube)
pendientes. El punto de §7 quedó resuelto por Santiago y registrado en D-075.

---

## 1. Qué pidió Santiago, en sus palabras

Al registrar un lote de esmeraldas solo se puede añadir **un** socio. Necesita varios, y que
la app **separe y discrimine a cada uno**: su participación, sus ganancias y sus pérdidas.
Lo mismo en Dinero (cierre del día y consolidado), y un informe por socio con *"cuánta plata
tiene cada uno, cómo ha sido el flujo de su dinero, su inventario, sus ganancias, sus costos,
el valor y el costo de su inventario, y la plata pendiente"*.

Al preguntarle qué era "plata pendiente" apareció lo importante, que no estaba en ningún
documento del proyecto:

> *"Emerald Dealer como empresa a veces recibe dinero de socios que lo único que quieren es,
> después de determinado plazo, tener un rendimiento sobre ese dinero. […] un conocido pone
> un millón, otro pone tres, otro cinco, y ahí consolidamos un pequeño fondo."*

Y al preguntarle qué pasa si el lote sale mal:

> *"Al fondo de inversión le devuelvo su plata más sus rendimientos pase lo que pase, pero
> si estoy yendo en condiciones de igualdad con otro socio, entre dos o entre tres o entre
> cuatro, asumimos ganancias o pérdidas."*

**No es una figura, son dos.** Todo el plan sale de ahí.

## 2. Las dos figuras — la distinción que gobierna el diseño

| | **Fondo de inversión** | **Socio de igualdad** |
|---|---|---|
| Qué hace | Presta plata al negocio | Entra al lote contigo |
| Si el lote pierde | Cobra igual: capital + rendimiento | Pierde su parte, como tú |
| Naturaleza contable | **Pasivo (deuda)** | **Patrimonio (parte)** |
| Se ata a | El negocio, no a un lote | Un lote concreto |
| Su ganancia | Rendimiento pactado | Proporción de la ganancia real |

**Consecuencia de diseño:** la plata del fondo **no diluye** el reparto entre socios de
igualdad. Financia la compra; su costo es el rendimiento pactado.

## 3. Decisiones de Santiago (2026-08-05)

1. **El reparto entre socios de igualdad se declara por la plata que puso cada uno**, no por
   porcentaje. La app deriva el porcentaje. Sin cuadrar a 100 y sin centavos sueltos.
2. **Alcance completo:** lotes de piedras, lotes de material y gastos.
3. **El fondo es un bolsillo común**, no plata amarrada a un lote.
4. **El rendimiento se pacta distinto con cada persona:** unos por porcentaje mensual, otros
   por una cifra fija a un plazo.
5. **Un mismo lote puede mezclar** plata del fondo, de socios de igualdad y propia.

## 4. Por qué el bolsillo común resulta simple

Un fondo de inversión real —donde el rendimiento depende del resultado— obliga a repartir
utilidades entre quienes entran y salen en fechas distintas: unidades, valor de la unidad,
cortes. Es la parte cara.

Aquí **no hace falta**, porque Santiago paga *pase lo que pase*. Cada aporte se comporta
como un préstamo independiente: capital, fecha, trato pactado, pagos hechos. El "bolsillo"
es solo **cuánta plata hay disponible para comprar** — un saldo de caja, no un problema de
reparto.

## 5. Modelo de datos

### 5.1 Personas

Se reutiliza el catálogo que ya existe (`materialPartners`, pantalla **Socios**), que hoy ya
sirve a material, piedras y gastos. **El papel no vive en la persona, vive en el
movimiento**: la misma persona puede prestar al fondo en enero y entrar como socia de
igualdad en marzo.

> Renombrar el concepto en la interfaz a **«Socios e inversionistas»**. El almacén y la tabla
> conservan su nombre técnico: renombrarlos no aporta y sí arriesga los datos vivos.

### 5.2 El fondo NO es un saldo único — es un grupo de personas

Santiago lo subrayó el 2026-08-05: *"no lo tratemos como un único fondo, sino podamos
diferenciar qué personas integran ese fondo […] las personas que integren ese fondo van a
cambiar, y necesito poder editarlas y trackearlas, hacer un seguimiento muy riguroso."*

**En ninguna parte de la aplicación existe "el saldo del fondo" como cifra guardada.** Lo
que existe es una lista de aportes, cada uno de una persona con nombre y apellido. El total
disponible es un **derivado** de sumarlos (regla D-023), nunca un contador propio.

De ahí tres requisitos que no son opcionales:

1. **Quién entra y quién sale queda registrado con su fecha.** Un aporte devuelto por
   completo no desaparece: queda cerrado, con su historia visible.
2. **Todo aporte es editable y todo cambio deja rastro** (`updatedAt`). La composición del
   grupo cambia con el tiempo y él necesita poder reconstruir cómo estaba en cualquier
   momento.
3. **La pantalla del fondo se lee por persona, no por total.** El total es el pie de página,
   no el encabezado.

### 5.3 Aporte al fondo — entidad nueva `fundContributions`

```
id, personId (null si se borró la ficha), personName (histórico),
date, amountCop,
returnKind: 'mensual' | 'fijo',
  monthlyRatePercent   — si es 'mensual'
  agreedTotalCop, dueDate — si es 'fijo'
payments: [{ id, date, amountCop, kind: 'capital' | 'rendimiento' }],
notes, createdAt, updatedAt
```

Derivados, nunca guardados (regla D-023): rendimiento devengado a hoy, capital devuelto,
rendimiento pagado y **saldo que se le debe**.

### 5.4 Participación en lotes y gastos

En `StoneLot`, `MaterialLot` y `Expense`, el trío `partnerId` / `partnerName` / `myPercent`
(o `myGrams`) se sustituye por:

```
partners: [{ id, partnerId, partnerName, amountCop }]   — socios de igualdad
fundedFromFundCop: number                                — plata del fondo usada
```

- **Lo propio se deriva:** `costo total − Σ partners.amountCop − fundedFromFundCop`.
- **El porcentaje de cada socio se deriva** sobre la porción de patrimonio
  (lo propio + los socios), **excluyendo la plata del fondo**, que es deuda.

### 5.5 Datos que ya existen — Santiago liberó esta restricción

El 2026-08-05 avisó: *"no te preocupes por mover información que ya esté, porque ya depuré
la aplicación para que podamos trabajar sobre ella con libertad."*

**Eso elimina el riesgo más grave del plan.** No hace falta una conversión exacta al peso de
lotes con historia real, ni la prueba de que ninguna cifra se mueve.

Lo que **sí** se mantiene, porque cuesta poco y evita una pantalla en blanco:

- Leer un registro en formato viejo (con `myPercent` y sin `partners`) **sin romperse**:
  se interpreta como un solo socio con esa proporción.
- Importar un respaldo **v8 sigue funcionando** (§8).

Lo que se descarta: conservar `myPercent` como verdad histórica paralela, y la batería de
pruebas de conversión al peso. Si aparece un registro viejo, se normaliza y ya.

## 6. Informe por socio

Extiende la pantalla **Socios**. Por cada persona, dos bloques según su papel:

**Como inversionista del fondo**
capital puesto · rendimiento devengado a hoy · capital devuelto · rendimiento pagado ·
**saldo que le debes** · próximo vencimiento

**Como socio de igualdad**
en qué lotes está y cuánto puso · **costo de su inventario vivo** · **valor de su inventario
vivo** · ganancias ya realizadas · su parte pendiente de cobro a compradores

Además, en **Dinero → Cierre del día** y **Consolidado**, una sección que separa por persona,
que hoy solo vive en la pantalla Socios.

## 7. Resuelto — el rendimiento del fondo es costo personal de Santiago

Pregunta: en un lote de 10 millones —4 del fondo, 3 de un socio de igualdad, 3 suyos—,
¿quién paga el rendimiento de esos 4 millones?

**Santiago eligió (b), el 2026-08-05: es un costo suyo, personal.** El socio de igualdad
reparte sobre la ganancia **sin descontar el financiamiento**.

Consecuencias para el cálculo, y hay que respetarlas al pie de la letra:

- La ganancia que se reparte entre socios de igualdad se calcula **sin restar** el rendimiento
  del fondo. El socio recibe su proporción como si el lote se hubiera comprado sin préstamo.
- El rendimiento del fondo se descuenta **después**, y **solo de la parte de Santiago**.
- Por tanto su parte puede quedar por debajo de la proporción que puso, e incluso en
  negativo, mientras el socio sigue en positivo. **Eso es correcto y debe poder mostrarse
  así.** Él tomó el riesgo del financiamiento; el socio no.
- La proporción del socio se calcula sobre lo propio + los socios, **excluyendo siempre la
  plata del fondo** (D-072).

## 8. Alcance técnico — nada de esto es opcional

| Capa | Qué cambia |
|---|---|
| Tipos | `StoneLot`, `MaterialLot`, `Expense`; entidad nueva `FundContribution` |
| Motor | Reparto binario → N partes; el motor sigue **puro** (AGENTS.md) |
| Base local | Escalón nuevo: almacén `fundContributions`. Solo crea, no toca lo existente |
| Respaldo | `BACKUP_VERSION` **8 → 9**. Importar un respaldo v8 debe seguir funcionando |
| Nube | Tabla `fund_contributions` + RPC protegidas + RLS + validadores. **Migración SQL nueva a Producción** |
| Pantallas | Piedras, Material, Gastos, Socios, Cierre del día, Consolidado |
| Excel | Columnas por socio y hoja del fondo |

## 9. Orden de trabajo para Codex

Cada etapa cierra con `npm test` y `npm run build` en verde.

1. ✅ **Tipos y motor puro.** Reparto de N partes, devengo del rendimiento y **la regla del §7**
   —el financiamiento se descuenta solo de la parte de Santiago—, con pruebas de mesa que
   incluyan el caso en que él queda en negativo y el socio en positivo. Sin tocar pantallas.
2. ✅ **Base local y respaldo v9.** Escalón nuevo para `fundContributions`; importar un respaldo
   v8 sigue funcionando; un registro viejo con `myPercent` se lee sin romperse (§5.5).
3. ✅ **Pantalla de lotes de piedras:** añadir y quitar socios, ver el porcentaje derivado.
4. ✅ **Material y gastos**, con el mismo patrón.
5. ✅ **El fondo, por persona:** registrar aportes, editarlos, registrar pagos y ver el saldo de
   **cada** inversionista (§5.2). El total va al pie, no al encabezado.
6. ✅ **Informe por socio** en la pantalla Socios (§6). Muestra el costo real del inventario
   vivo. El valor estimado de mercado queda pendiente de una regla de valoración de Santiago;
   no se inventa una cifra.
7. ✅ **Dinero:** separación por socio en Cierre del día, Cierre mensual y Consolidado.
8. ⬜ **Excel.**
9. ⬜ **Nube:** migración SQL, RPC, RLS y sincronización. **Va al final**, y se aplica a
   Producción con el método verificado el 2026-08-05: bloques de 20–30 mil caracteres, cada
   uno con su comprobación por contenido (`pg_proc.prosrc like`), nunca por nombre.

## 10. Riesgos

- **El riesgo más grave desapareció.** Santiago depuró los datos (§5.5), así que ya no hay
  que convertir lotes con historia real al peso. Queda solo la robustez básica de leer un
  registro viejo sin romperse.
- **El cálculo del §7 es el nuevo punto delicado.** Que la parte de Santiago pueda quedar en
  negativo mientras el socio sigue en positivo es correcto, no un error, y hay que probarlo
  explícitamente para que nadie lo "arregle" más adelante.
- **Regla de negocio:** dinero en COP enteros y motores puros (AGENTS.md). El devengo mensual
  del rendimiento debe redondearse a peso entero de forma explícita y probada.
- **Legal, señalado una vez:** recibir dinero de varias personas prometiendo rendimientos
  está regulado en Colombia cuando crece. Con un grupo pequeño de amigos no suele haber
  problema; conviene consultarlo con su contador antes de que sea grande. No bloquea nada.
- **Supabase en plan gratuito:** 2 proyectos por organización y pausa tras una semana sin
  uso.
