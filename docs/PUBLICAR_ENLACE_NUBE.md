# Cómo se publica el enlace de la nube (`emerald-dealer-app`)

_Escrito el 2026-08-10 después de publicarlo. **Este procedimiento no estaba documentado en
ninguna parte**: la publicación anterior se había hecho a mano y nadie podía repetirla._

> Este enlace es el de **Santiago solo**, con nube. No confundir con `main`, que publica
> `emerald-dealer-quote` para las 7 joyerías del piloto por GitHub Actions y es otra cosa.

## Antes de nada

Publicar exige **orden expresa y separada de Santiago en ese momento**. Que el trabajo esté
listo no autoriza a publicar.

## Los dos accidentes que hay que evitar

**1. Publicar apuntando al servidor equivocado.** Después de trabajar en el proyecto de
pruebas, los archivos `.env` de la máquina quedan apuntando a **Pruebas**. Compilar así
publica la app conectada a una base vacía: Santiago abriría su aplicación, no vería ni una
cotización y creería que perdió su trabajo. **Nunca compilar el enlace de la nube con la
configuración de trabajo diaria.**

**2. Perder `.nojekyll`.** El repositorio del sitio tiene ese archivo en la raíz. Si el
borrado previo a copiar se lo lleva, GitHub Pages puede dejar de servir el sitio.

## Procedimiento

### 1. Sacar la configuración de Producción del sitio ya publicado

No hace falta pedirle ninguna llave a Santiago: la que necesita el navegador **ya viaja
dentro de la app publicada**, así que es información pública. Se lee de ahí, y de paso se
confirma a qué servidor apunta el enlace hoy:

```bash
curl -s https://santismagico.github.io/emerald-dealer-app/ | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js'
curl -s https://santismagico.github.io/emerald-dealer-app/assets/<archivo>.js -o /tmp/pub.js
grep -oE "https://[a-z]+\.supabase\.co" /tmp/pub.js | sort -u
```

Debe decir `wrvokfzrcmmlzekudypu` (Producción). Con eso se escribe `.env.produccion.local`,
que está ignorado por git:

```
VITE_SUPABASE_URL=https://wrvokfzrcmmlzekudypu.supabase.co
VITE_SUPABASE_ANON_KEY=<la llave publicable que trae el bundle>
```

**La clave secreta no interviene en este proceso.** Si alguien la pide, algo está mal.

### 2. Pasar los candados

```bash
npm audit --audit-level=high
npm run security:secrets
npm run security:evidence
npm test
```

Los cuatro en verde. Si uno falla, se para.

### 3. Compilar apuntando a Producción

```bash
DEPLOY_BASE=/emerald-dealer-app/ npm run build -- --mode produccion
```

**Comprobar antes de seguir**, no después:

```bash
grep -rhoE "https://[a-z]+\.supabase\.co" dist/assets/*.js | sort -u   # wrvokfzrcmmlzekudypu
grep -oE 'src="[^"]*"' dist/index.html | head -2                       # /emerald-dealer-app/...
```

### 4. Publicar

```bash
git clone https://github.com/Santismagico/emerald-dealer-app.git sitio
cd sitio
git log -1 --format='%h'          # ANOTAR: este es el punto de retorno
find . -mindepth 1 -not -path './.git*' -delete
cp -r ../dist/. .
touch .nojekyll                    # imprescindible, ver arriba
git add -A && git commit -m "publicar <que> (fuente <commit>)" && git push origin main
```

### 5. Verificar en vivo, no suponer

GitHub Pages tarda un momento. Comprobar que el sitio sirve el archivo **nuevo** y que ese
archivo apunta al servidor real:

```bash
curl -s "https://santismagico.github.io/emerald-dealer-app/?v=$(date +%s)" \
  | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js'
```

### 6. Registrar

Anotar en `PROJECT_STATE.md`: commit del sitio, commit fuente, punto de retorno y qué se
verificó en vivo.

## Si algo sale mal

Se vuelve al punto de retorno anotado en el paso 4 y se publica esa versión otra vez. No se
borra nada ni se toca el servidor.
