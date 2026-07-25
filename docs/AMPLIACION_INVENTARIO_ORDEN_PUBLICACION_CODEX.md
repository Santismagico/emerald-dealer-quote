# Orden de publicación para Codex — Ampliación de inventario (SOLO al enlace nuevo)

_Creada el 2026-07-25 por Claude. Santiago autorizó publicar esta ampliación al enlace
nuevo, y pidió que Codex pueda hacerlo de forma autónoma si la auditoría pasa. Esta
orden es autosuficiente: no necesita a Claude para ejecutarse._

---

## 0. Reja de seguridad (obligatoria antes de publicar)

Publica **solo si TODO esto se cumple**:

1. Completaste la auditoría de `docs/AMPLIACION_INVENTARIO_ORDEN_AUDITORIA_CODEX.md`
   y el veredicto es **APROBADO** (sin hallazgos que bloqueen).
2. `npm test` pasa **todas** las pruebas (esperado: 720).
3. `npm run build` compila sin errores.

Si algo de esto falla, **NO publiques**: escribe el hallazgo en
`docs/AUDITORIA_AMPLIACION_INVENTARIO_CODEX.md` y detente.

**Nunca** toques `main` ni `.github/workflows/deploy.yml`. La publicación es a un
repositorio SEPARADO (`Santismagico/emerald-dealer-app`), no al piloto de las 7
joyerías.

---

## 1. Compilar la versión de producción

Desde `C:\Dev\emerald-dealer`:

```bash
# a) credenciales de producción (la anon key es PUBLICABLE, no secreta; va en el bundle)
cat > .env.production.local << 'EOF'
VITE_SUPABASE_URL=https://wrvokfzrcmmlzekudypu.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable__xmdQ7mav5ao4lAu7EO4qA_ksZaMdJA
EOF

# b) compilar con la base del enlace nuevo
MSYS_NO_PATHCONV=1 DEPLOY_BASE=/emerald-dealer-app/ npm run build

# c) VERIFICAR que la base salió bien (debe decir /emerald-dealer-app/…)
grep -oE 'src="[^"]*index-[A-Za-z0-9_]+\.js"' dist/index.html
```

⚠ Sin `MSYS_NO_PATHCONV=1`, Git Bash convierte la ruta y la base sale como
`/Program Files/Git/emerald-dealer-app/` → el sitio queda EN BLANCO. Si el `grep` del
paso (c) no muestra `/emerald-dealer-app/`, **no publiques**: algo salió mal.

## 2. Publicar el `dist` al repositorio del enlace nuevo

```bash
# clonar el repo de publicación en una carpeta temporal
cd /tmp && rm -rf emerald-dealer-app && gh repo clone Santismagico/emerald-dealer-app
cd emerald-dealer-app

# reemplazar el contenido por el dist nuevo (conserva .git)
git rm -rf . >/dev/null 2>&1
cp -r /c/Dev/emerald-dealer/dist/* .
cp -r /c/Dev/emerald-dealer/dist/.[!.]* . 2>/dev/null || true
touch .nojekyll   # para que GitHub Pages no ignore archivos que empiezan con _

git add -A
git commit -m "publicar ampliacion de inventario (materiales y joyas)"
git push origin main
```

GitHub Pages reconstruye solo en 1–2 minutos.

## 3. Limpiar (IMPORTANTE)

```bash
rm -f /c/Dev/emerald-dealer/.env.production.local
```

Si se queda, un build futuro podría meter producción donde no debe.

## 4. Verificar el sitio EN VIVO antes de dar nada por hecho

- Abre `https://santismagico.github.io/emerald-dealer-app/`.
- Debe cargar sin pantalla en blanco y sin errores en consola.
- En "Inventario" deben verse las cuatro secciones: **Piedras · Material · Joyas ·
  Cobros**. En "Más" debe estar **Compradores** y **Socios de material**.
- No inicies sesión con cuentas reales de clientes para probar; con que cargue la
  interfaz nueva basta.

## 5. Dejar constancia

Escribe en `docs/AUDITORIA_AMPLIACION_INVENTARIO_CODEX.md`:
- Que publicaste, con el commit exacto que quedó en `Santismagico/emerald-dealer-app`.
- El resultado del `grep` del paso 1c (que la base era `/emerald-dealer-app/`).
- Que verificaste el sitio en vivo.
- Que borraste `.env.production.local`.

## 6. Si algo sale mal en vivo

El enlace nuevo es independiente del piloto. Para revertir: vuelve el `dist` del repo
`Santismagico/emerald-dealer-app` al commit anterior (`git revert` o `git reset` al
commit previo + push). No toques `main` del repo de código.
