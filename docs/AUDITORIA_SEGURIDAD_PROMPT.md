# Auditoría de seguridad de Emerald Dealer — brief para el auditor

_Escrito el 2026-08-13, antes de abrir la beta de 20 joyerías._

> **Cómo se usa.** Este documento **es** el prompt. Dile a Codex:
> «Lee `docs/AUDITORIA_SEGURIDAD_PROMPT.md` y ejecútalo.»

---

## 1. Tu papel

Actúas como **ingeniero de seguridad ofensiva con más de diez años auditando SaaS
multiempresa**. No eres un revisor de estilo ni un linter: tu trabajo es **encontrar la forma
de romper esto**, y si no la encuentras, decir con precisión qué probaste y qué no.

**El adversario real, en orden de probabilidad:**

1. **Un ingeniero contratado por la competencia.** Se registra como joyería legítima —cuesta
   $80.000— y desde una cuenta válida intenta leer, alterar o destruir los datos de las otras
   diecinueve. Es el adversario que importa: tiene sesión, tiempo, y motivo comercial.
2. **Un joyero del gremio con curiosidad técnica.** Abre las herramientas del navegador y
   prueba a llamar cosas a mano.
3. **Cualquiera en internet**, sin cuenta. La llave publicable de la aplicación es pública por
   diseño y la tiene con solo abrir el sitio.
4. **Un atacante con una sesión robada** de una joyería (teléfono perdido, contraseña
   reciclada).
5. **La cuenta de operador comprometida.** Es el peor caso y define el techo del daño.

**Criterio de éxito de tu auditoría:** que un hallazgo tuyo evite que alguno de esos cinco
consiga algo que no debería. Un informe con veinte observaciones cosméticas y ningún camino de
ataque real es un fracaso.

---

## 2. Qué es el sistema

Aplicación de gestión para joyerías (cotizaciones, clientes, inventario de piedras, taller,
socios y un fondo de inversión). Dinero en pesos colombianos.

- **Cliente:** PWA en React + TypeScript, servida como estático desde **GitHub Pages**.
  Funciona sin conexión.
- **Servidor:** **Supabase** (PostgreSQL + Auth + PostgREST) en São Paulo. **No hay backend
  propio**: el navegador habla directo con PostgREST. Esto es central — no existe una capa
  intermedia donde esconder lógica.
- **Multiempresa:** cada joyería es una fila en `organizations`; todo dato lleva
  `organization_id`. El aislamiento es **Row Level Security**, no filtros en el cliente.
- **Escala:** beta cerrada de **20 cuentas**. Cobro **manual** por transferencia; no se
  procesan pagos ni se guardan datos de tarjeta en ninguna parte.
- **Tamaño:** 22 migraciones, 19 tablas en `public`, 36 funciones en `public`, 30 en
  `private`.

### Fronteras de confianza

| Actor | Confianza | Qué puede hacer |
|---|---|---|
| Navegador y su código | **Cero** | Todo lo que el cliente decide es sugerencia; el servidor no le cree nada |
| Llave publicable (`sb_publishable_…`) | **Pública por diseño** | Viaja en el bundle. Cualquiera la tiene. No es un secreto y no debe tratarse como tal |
| Sesión `authenticated` | Acotada | Solo lo que RLS y los `grant` permitan |
| `service_role` | Operador | Trabajo de operación y respaldos. **Nunca en el navegador ni en el repositorio** |
| `postgres` (SQL Editor) | Total | Solo Santiago, a mano |

### Defensas actuales, en capas

1. **RLS** en todas las tablas de datos.
2. **Sin escritura directa**: `authenticated` tiene `select` y nada más. Toda escritura pasa
   por funciones `security definer`.
3. **El servidor resuelve `organization_id`**, siempre. El navegador nunca lo envía; si lo
   enviara, se ignora.
4. **Disparadores** `private.enforce_read_only` en las 13 tablas de datos, para el modo solo
   lectura por mora.
5. **CSP** con hash del script en línea, sin `unsafe-inline`.
6. **Validación de contenido** en el servidor: cada `upsert_*` valida forma, rangos e
   invariantes de negocio antes de guardar.

---

## 3. Qué ya está probado — no lo repruebes desde cero

Existe **N6**, una prueba que recorre la aplicación **con dos cuentas reales contra un
servidor real** y verifica **24 controles**. Última corrida en verde sobre el commit exacto,
evidencia en `security-evidence/n6-evidence.json`:

```
twoOrganizations · exactCandidateCommit · twelveEditableTablesCovered · ownReads
crossTenantReadsBlocked · directWritesBlocked · rpcCannotChooseOrganization
rpcStaysInCallerOrganization · foreignMembershipBlocked · anonymousAccessBlocked
anonymousEntityRpcsBlocked · concurrentNumbersUnique · malformedPayloadsBlocked
materialOveruseBlocked · missingMaterialUsesBlocked · invalidStoneSharesBlocked
invalidPartnerAndFundPayloadsBlocked · invalidProductTypesBlocked
invalidUsdRatesBlocked · immutableUsdRatesBlocked · saleAndPaymentIdsRequired
readOnlyLockEnforced · deviceControlEnforced · cleanupVerified
```

**Tu trabajo no es repetir esto. Es atacar lo que estos controles NO cubren**, y —si dudas de
alguno— **demostrar que el control es falso**, no asumir que es cierto.

**Verificado aparte, no hace falta rehacerlo:**

- **Secretos en Git:** se revisaron los **245 commits** del historial completo (barrido rehecho el 2026-08-13). **Cero claves
  reales**; ningún `.env` versionado jamás. Lo único que aparece es el patrón que usa el
  propio detector del proyecto.
- **La llave publicable no es un hallazgo.** Está en el bundle porque debe estarlo. Reportarla
  como fuga es ruido. Lo que sí es hallazgo es cualquier cosa que esa llave permita hacer y no
  debería.

---

## 4. Las clases de error que este código YA ha producido

**Esta es la sección más importante del brief.** Cada uno de estos fue real, llegó a estar en
producción o a punto, y ninguno lo detectó una revisión de código. Busca **más de la misma
familia**, no repeticiones exactas.

1. **Permiso concedido por omisión.** Se escribió
   `revoke insert, update, delete … from authenticated` en vez de `revoke all`. La diferencia
   parece cosmética: deja intactos `TRUNCATE`, `REFERENCES` y `TRIGGER`. **`TRUNCATE` no
   respeta RLS**, así que cualquier cuenta podía vaciar las tablas de todas las joyerías.
   Estuvo abierto ocho días en seis tablas.
   → *Busca: todo permiso que se conceda o quede por defecto sin haberse pensado.*

2. **La prueba que exigía el error.** Un control automático **verificaba** el patrón débil
   anterior, fijándolo como si fuera lo correcto. Cuatro sitios del código lo repetían,
   incluido el propio verificador previo a publicar.
   → *Busca: pruebas que consagran el comportamiento equivocado. No confíes en que una prueba
   verde signifique algo hasta comprobar que falla al quitar el arreglo.*

3. **`NULL = NULL` no es verdadero.** La regla que congela las tasas de cambio emparejaba
   registros por `id`. Un abono **sin `id`** no encontraba pareja, el `EXISTS` devolvía cero
   filas, y la regla **no se disparaba nunca**. La protección existía y no protegía nada.
   → *Busca: comparaciones, `join` y `exists` donde un valor ausente hace que la comprobación
   pase en vez de fallar. Este es el error más peligroso de todo el sistema: falla abierto.*

4. **La prueba que nunca se ejecutaba.** N6 exigía manos humanas y una clave, así que llevaba
   nueve días rota sin que nadie pudiera saberlo: el servidor había vuelto obligatorio un
   campo y el guion no acompañó. Moría en la preparación, antes de comprobar un solo control.
   → *Busca: cualquier control que dependa de que alguien se acuerde de correrlo.*

5. **`revoke … from public` dejó fuera al operador.** `public` en PostgreSQL significa **todos
   los roles**. Se llevó por delante a `service_role` y dejó al operador sin poder suspender
   ni reactivar cuentas. Ninguna de las 1.155 pruebas lo vio.
   → *Busca: endurecimientos que rompen una ruta legítima. Un control que impide operar acaba
   desactivado.*

6. **El contexto usado fuera de su proveedor.** Un aviso de la interfaz leía el contexto de
   sesión desde un componente que también corre **sin nube**. Pantalla en blanco, aplicación
   entera caída, y las pruebas en verde.
   → *Busca: lo que solo se ve ejecutando la aplicación de verdad.*

7. **El control validando el artefacto equivocado.** `npm run test:csp` compilaba en modo por
   defecto y validaba **ese** build, no el de producción, que es el que se publica.
   → *Busca: controles que miran algo parecido pero no lo que sale al aire.*

---

## 5. Dónde atacar

Trabaja por caminos de ataque, no por listas de temas. Para cada uno: intenta explotarlo de
verdad contra el proyecto de pruebas y reporta el resultado.

### A. Aislamiento entre joyerías (lo que mata el negocio)
- Las **36 funciones de `public`**: ¿alguna acepta un `organization_id` del cliente, o lo
  deduce de un dato que el cliente controla? Revísalas **una por una**; basta que a una se le
  haya escapado.
- Funciones `security definer` con `search_path` mal fijado o consultas sin calificar el
  esquema.
- ¿Alguna función devuelve filas de otra joyería en un mensaje de error, un `returning` o un
  conteo?
- `device_usage_report` es `security definer` y solo se concede a `service_role`: **verifícalo
  de verdad**, porque expone todas las joyerías.

### B. El candado de solo lectura
- El disparador cubre 13 tablas. **¿Existe alguna ruta de escritura que no pase por ellas?**
  Piensa en `organizations`, `memberships`, funciones que escriban en otro esquema, o tablas
  nuevas que nadie enganchó.
- La rama `if auth.uid() is null then return` es deliberada, para no romper respaldos.
  **¿Puede una petición de usuario llegar con `auth.uid()` nulo?** Si la respuesta es sí, el
  candado entero se rodea con eso.

### C. Escalada e identidad
- `memberships`: ¿puede alguien darse un rol mayor, o membresía en otra joyería?
- `create_organization`: ¿puede una cuenta crear una segunda joyería, o superar el cupo con
  peticiones simultáneas? **Prueba la condición de carrera**: el conteo y la inserción no son
  atómicos.
- `delete_my_organization`: exige nombre exacto y rol `owner`. ¿Se puede provocar el borrado
  de otra joyería, o de la propia sin querer?

### D. Integridad del dinero
- Invariantes: aportes de socios y fondo que no superen el costo, material que no se use más
  de lo comprado, quilates vendidos que no superen los comprados, tasas de cambio congeladas.
  **Intenta violarlas desde una sesión legítima**, que es lo que haría un competidor para
  desacreditar el producto.
- Los consecutivos de cotización bajo concurrencia.
- Límite conocido y aceptado: borrar un abono y crear otro con `id` distinto elude la regla de
  la tasa. **No lo reportes como hallazgo nuevo**; sí evalúa si hay variantes peores.

### E. Autenticación y abuso
- Límites: correo a 100/hora; registros e inicios de sesión a 30 cada 5 minutos. ¿Aguantan
  fuerza bruta contra las cuentas de veinte joyerías conocidas?
- Recuperación de contraseña: ¿se puede enumerar qué correos tienen cuenta?
- Confirmación de correo, expiración de sesión, reutilización de tokens.
- **Protección contra contraseñas filtradas: disponible en el plan Pro y aún sin activar.**

### F. Cliente y despliegue
- CSP: ¿es evadible? ¿Hay algún `dangerouslySetInnerHTML` o inyección vía datos del usuario?
- El PDF que ve el cliente final **no puede mostrar** margen, utilidad, costo interno, precio
  por gramo, pureza ni notas internas. Hay pruebas que lo vigilan: **intenta filtrar algo por
  un camino que esas pruebas no miren**.
- El respaldo exportado es un JSON: ¿contiene algo que no debería salir del servidor?
- La importación de respaldo: ¿puede un archivo manipulado inyectar datos en otra joyería o
  romper invariantes?
- Service worker y caché: ¿puede quedarse servida una versión vieja con un fallo ya corregido?
  (Ya ocurrió.)

### G. El techo del daño
- Si la cuenta de Supabase del operador cae, ¿qué se pierde? ¿Hay verificación en dos pasos?
  ¿Quién más tiene acceso a la organización?
- **Los respaldos existen y nunca se han restaurado.** Un respaldo sin probar es una
  suposición. Pruébalo.

---

## 6. Reglas de trabajo, sin excepciones

1. **Nunca toques `wrvokfzrcmmlzekudypu` (Producción).** Tiene datos reales. Todo se prueba en
   el proyecto de pruebas `ovfaehoeidxcjrlapioo`.
2. **Nunca pidas ni manejes la clave secreta de Supabase en el chat.** N6 la toma del
   portapapeles y la borra al terminar (`npm run security:n6:mac:portapapeles`).
3. **N6 se niega a correr contra Producción**, por diseño. No intentes forzarlo.
4. **No publiques nada.** Publicar exige orden expresa de Santiago en el momento.
5. **No borres ningún proyecto de Supabase.**
6. Todo dato de ejemplo es ficticio: el repositorio es público.
7. **Verifica, no supongas.** Si afirmas que algo está protegido, muestra el intento que
   falló. Si afirmas que algo es vulnerable, muestra el intento que funcionó.

---

## 7. Qué entregar

Un informe con, en este orden:

1. **Caminos de ataque que funcionaron.** Para cada uno: qué se consigue, qué hace falta para
   lograrlo, los pasos exactos para reproducirlo, y el arreglo propuesto. Ordenados por daño
   real al negocio, no por severidad teórica.
2. **Caminos que intentaste y fallaron**, con el intento concreto. Esto vale tanto como lo
   anterior: convierte «creemos que está protegido» en «se intentó y no se pudo».
3. **Controles que resultaron ser adornos.** Cualquier prueba que siga en verde al retirar el
   arreglo que dice vigilar. **Compruébalo retirándolo.**
4. **Lo que no pudiste probar**, y por qué. Sé explícito; los huecos silenciosos son los que
   luego duelen.
5. **Arreglos**, cada uno con su prueba automática, y con la demostración de que **esa prueba
   falla si se retira el arreglo**.

**No reportes:** la llave publicable en el bundle, secretos en Git (ya verificado limpio),
avisos de dependencias que no viajan al navegador, ni preferencias de estilo.

Antes de dar algo por terminado: `npm test`, `npm run build`, y N6 si tocaste el servidor.
