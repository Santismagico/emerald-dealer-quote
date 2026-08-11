# Traspaso del proyecto a la Mac

_Escrito el 2026-08-10, al terminar la publicación de socios y fondo. Para Santiago, que se
pasa de un ASUS con Windows a una MacBook Air M4._

## Lo primero: qué viaja solo y qué no

**Viaja solo por GitHub** (todo el proyecto): el código, las migraciones, la documentación,
las pruebas y el historial completo. Nada de eso hay que copiarlo a mano.

**NO viaja, y hay que recrearlo en la Mac:**

| Archivo | Qué es | Cómo se recupera |
|---|---|---|
| `.env.local` | A qué servidor se conecta y con qué llave pública | Se recrea con los datos de abajo |
| `.env.sinnube.local` | Modo local para probar pantallas sin nube | Dos líneas vacías, ver abajo |
| `node_modules/` | Las piezas prestadas | `npm install` las baja solas |
| `dist/` | El resultado de compilar | `npm run build` lo rehace |

**Nada de lo que falta es secreto.** La clave secreta de Supabase no está en ningún archivo
del proyecto: la prueba N6 la pide en pantalla cada vez y no la guarda.

## Pasos en la Mac

### 1. Instalar lo básico

Abre la aplicación **Terminal** y pega esto. Instala las herramientas de desarrollo de Apple
y luego Node.js:

```
xcode-select --install
```

Después, descarga Node.js de https://nodejs.org (la versión "LTS") y instálalo con doble
clic, como cualquier programa.

### 2. Traer el proyecto

```
mkdir -p ~/Dev && cd ~/Dev
git clone https://github.com/Santismagico/emerald-dealer-quote.git emerald-dealer
cd emerald-dealer
git checkout codex/fase2-nube
npm install
```

**La carpeta canónica en la Mac es `~/Dev/emerald-dealer`.** Es el equivalente de
`C:\Dev\emerald-dealer` en el ASUS.

### 3. Recrear la configuración

Crea un archivo llamado `.env.local` dentro de `~/Dev/emerald-dealer` con este contenido.
Las dos llaves se copian de Supabase → **Project Settings → API** del proyecto
**Emerald Dealer - Pruebas**; son las públicas, no la secreta:

```
SUPABASE_URL=https://ovfaehoeidxcjrlapioo.supabase.co
SUPABASE_PUBLISHABLE_KEY=<llave publicable de Pruebas>
VITE_SUPABASE_URL=https://ovfaehoeidxcjrlapioo.supabase.co
VITE_SUPABASE_ANON_KEY=<la misma llave publicable de Pruebas>
N6_TEST_PROJECT_REF=ovfaehoeidxcjrlapioo
N6_TEST_PROJECT_NAME=Emerald Dealer - Pruebas
N6_PRODUCTION_PROJECT_REF=wrvokfzrcmmlzekudypu
N6_CONFIRM_TEST_PROJECT=TEST_ONLY:ovfaehoeidxcjrlapioo
```

Y otro llamado `.env.sinnube.local`, con las dos líneas vacías a propósito. Sirve para abrir
la app en modo local, sin nube ni contraseña, cuando un agente necesita probar pantallas:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### 4. Comprobar que todo quedó bien

```
npm test && npm run build
```

Debe terminar en verde. Si lo hace, la Mac está lista.

## Diferencias con Windows que hay que tener presentes

- **No hay PowerShell.** Los comandos van en Terminal, y son los mismos de arriba.
- **La prueba N6** tenía un guion de Windows (`scripts/run-n6-secure.ps1`). Para la Mac se
  agregó `scripts/run-n6-secure.sh`, que hace lo mismo: pide la clave secreta sin mostrarla,
  la usa solo durante la prueba y la borra al terminar. Se ejecuta así:
  ```
  npm run security:n6:secure:mac
  ```
- **Las rutas** cambian de `C:\Dev\emerald-dealer` a `~/Dev/emerald-dealer`. Cualquier
  documento que diga la ruta vieja se refiere a lo mismo.
- **Ya no hay copia de OneDrive.** Se borró el 2026-08-10 precisamente porque los agentes
  trabajaban sobre ella por error. No la recrees.

## Para abrir Codex y Claude en la Mac

**Claude** conserva las conversaciones porque van con la cuenta: al iniciar sesión, el
historial aparece.

**Codex no las conserva.** Por eso el contexto no vive en el chat sino en el repositorio:
`docs/PROMPT_NUEVA_SESION.md` es el punto de partida. Se abre ese archivo, se copia desde la
línea marcada hasta el final, y se pega como primer mensaje. Ahí está el estado real,
verificado contra el repositorio y no contra la memoria de nadie.

Esa es la regla que hace posible cambiar de computador, de agente o de sesión sin perder
nada: **el estado vive en el proyecto, no en la conversación.**
