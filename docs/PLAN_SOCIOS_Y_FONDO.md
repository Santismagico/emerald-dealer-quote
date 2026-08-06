# Plan — Socios múltiples y fondo de inversión

**Fecha:** 2026-08-05
**Autor:** Claude (arquitectura). Implementa Codex.
**Origen:** prueba de uso de Santiago el día de la publicación del plan v2.
**Estado:** diseñado, sin implementar. Falta que Santiago confirme el punto abierto de §7.

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

### 5.2 Aporte al fondo — entidad nueva `fundContributions`

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

### 5.3 Participación en lotes y gastos

En `StoneLot`, `MaterialLot` y `Expense`, el trío `partnerId` / `partnerName` / `myPercent`
(o `myGrams`) se sustituye por:

```
partners: [{ id, partnerId, partnerName, amountCop }]   — socios de igualdad
fundedFromFundCop: number                                — plata del fondo usada
```

- **Lo propio se deriva:** `costo total − Σ partners.amountCop − fundedFromFundCop`.
- **El porcentaje de cada socio se deriva** sobre la porción de patrimonio
  (lo propio + los socios), **excluyendo la plata del fondo**, que es deuda.

### 5.4 Datos que ya existen — conversión sin perder nada

Los lotes actuales guardan `myPercent`, no cantidades. La conversión es determinista:

```
amountCop del socio = round(costo total × (100 − myPercent) / 100)
```

**Se conserva `myPercent` original** en el registro como verdad histórica. Ninguna cifra
mostrada hoy puede cambiar tras la conversión: es requisito de prueba, no aspiración.

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

## 7. Punto abierto — Santiago debe confirmarlo

**¿Quién paga el rendimiento del fondo cuando el lote también tiene un socio de igualdad?**

Ejemplo: lote de 10 millones — 4 del fondo, 3 de un socio, 3 suyos.

- **(a) Es un costo del lote**, como el corte: se descuenta antes de repartir. El socio de
  igualdad ayuda a pagarlo.
- **(b) Es un costo suyo**, personal: el socio reparte sobre la ganancia sin descontar el
  financiamiento.

**Se implementará (a)** salvo que él diga lo contrario: el fondo financió *ese* lote, así que
su costo pertenece al lote. Es la lectura contable normal y cambiarlo después es una línea.

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

1. **Tipos y motor puro.** Reparto de N partes y devengo del rendimiento, con pruebas de
   mesa. Sin tocar pantallas.
2. **Conversión de los datos actuales.** Un lote con `myPercent` queda idéntico al peso tras
   convertirse. Prueba explícita de que ninguna cifra se mueve.
3. **Base local y respaldo v9.** Escalón nuevo; importar v8 sigue funcionando.
4. **Pantalla de lotes de piedras:** añadir y quitar socios, ver el porcentaje derivado.
5. **Material y gastos**, con el mismo patrón.
6. **El fondo:** registrar aportes, pagos y ver el saldo de cada inversionista.
7. **Informe por socio** en la pantalla Socios (§6).
8. **Dinero:** separación por socio en Cierre del día y Consolidado.
9. **Excel.**
10. **Nube:** migración SQL, RPC, RLS y sincronización. **Va al final**, y se aplica a
    Producción con el método verificado el 2026-08-05: bloques de 20–30 mil caracteres, cada
    uno con su comprobación por contenido (`pg_proc.prosrc like`), nunca por nombre.

## 10. Riesgos

- **El más grave: mover una cifra del pasado.** La conversión del §5.4 toca lotes con
  historia real. La prueba de que nada cambia es el requisito que manda sobre los demás.
- **Regla de negocio:** dinero en COP enteros y motores puros (AGENTS.md). El devengo mensual
  del rendimiento debe redondearse a peso entero de forma explícita y probada.
- **Legal, señalado una vez:** recibir dinero de varias personas prometiendo rendimientos
  está regulado en Colombia cuando crece. Con un grupo pequeño de amigos no suele haber
  problema; conviene consultarlo con su contador antes de que sea grande. No bloquea nada.
- **Supabase en plan gratuito:** 2 proyectos por organización y pausa tras una semana sin
  uso.
