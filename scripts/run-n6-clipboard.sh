#!/usr/bin/env bash
# Prueba N6 de aislamiento, variante que toma la clave del portapapeles de macOS.
#
# Existe porque el prompt oculto de run-n6-secure.sh confunde: al pegar no se ve
# nada en pantalla y parece que el teclado no responde. Aqui la clave se copia una
# sola vez desde Supabase y el script la lee del portapapeles.
#
# Mantiene exactamente las mismas garantias que run-n6-secure.sh:
#   - la clave nunca se escribe en un archivo;
#   - nunca se muestra en pantalla (la salida se filtra por si acaso);
#   - se borra de la memoria y del portapapeles al terminar;
#   - la prueba se niega a correr si .env.local no apunta al proyecto de pruebas.
#
# Uso:  npm run security:n6:mac:portapapeles

set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCHIVO_ENTORNO="$RAIZ/.env.local"

if ! command -v pbpaste >/dev/null 2>&1; then
  echo "Esta variante solo sirve en macOS. En otros sistemas usa run-n6-secure.sh." >&2
  exit 1
fi

if [ ! -f "$ARCHIVO_ENTORNO" ]; then
  echo "Falta .env.local con la identidad del proyecto de pruebas." >&2
  echo "Como recrearlo: docs/TRASPASO_A_MAC.md" >&2
  exit 1
fi

# Cargar solo lineas con forma NOMBRE=valor, ignorando comentarios y vacias.
while IFS= read -r linea || [ -n "$linea" ]; do
  case "$linea" in
    ''|'#'*) continue ;;
  esac
  nombre="${linea%%=*}"
  valor="${linea#*=}"
  case "$nombre" in
    [A-Z0-9_]*) export "$nombre=$valor" ;;
  esac
done < "$ARCHIVO_ENTORNO"

# Candado: la prueba nunca debe correr contra Produccion.
if [ "${SUPABASE_URL:-}" != "https://${N6_TEST_PROJECT_REF:-sin-definir}.supabase.co" ]; then
  echo "El .env.local no apunta al proyecto de pruebas declarado. Se detiene." >&2
  exit 1
fi

# Leer del portapapeles y quitar espacios o saltos de linea pegados por error.
CLAVE="$(pbpaste | tr -d '\r\n' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

if [ "${#CLAVE}" -lt 20 ]; then
  unset CLAVE
  echo "El portapapeles no tiene una clave con formato valido." >&2
  echo "Copia de nuevo la clave secreta del proyecto DE PRUEBAS y vuelve a intentar." >&2
  exit 1
fi

if [ "$CLAVE" = "${SUPABASE_PUBLISHABLE_KEY:-}" ] || [ "$CLAVE" = "${VITE_SUPABASE_ANON_KEY:-}" ]; then
  unset CLAVE
  echo "Eso es la clave PUBLICA, no la secreta. La prueba necesita la secreta." >&2
  exit 1
fi

echo "Clave recibida del portapapeles (${#CLAVE} caracteres). No se muestra ni se guarda."

export SUPABASE_SECRET_KEY="$CLAVE"

limpiar() {
  unset SUPABASE_SECRET_KEY
  # Vaciar el portapapeles para que la clave no quede rondando en el sistema.
  printf '' | pbcopy 2>/dev/null || true
}
trap limpiar EXIT

cd "$RAIZ"

# Ultima red de seguridad: si algun mensaje de error llegara a contener la clave,
# se reemplaza antes de que aparezca en pantalla o en un chat.
node scripts/test-rls-isolation.mjs 2>&1 | sed -e "s|${CLAVE}|<clave oculta>|g"
