#!/usr/bin/env bash
# Prueba N6 de aislamiento, version para Mac y Linux.
#
# Equivale a scripts/run-n6-secure.ps1, que solo servia en Windows. Pide la clave
# secreta del proyecto DE PRUEBAS sin mostrarla, la mantiene unicamente durante la
# prueba y la borra al terminar. Nunca se escribe en un archivo, un chat ni una
# captura.
#
# Uso:  npm run security:n6:secure:mac

set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCHIVO_ENTORNO="$RAIZ/.env.local"

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

printf 'Pega la clave secreta del proyecto DE PRUEBAS (no se mostrara ni se guardara): '
stty -echo
IFS= read -r CLAVE
stty echo
printf '\n'

if [ "${#CLAVE}" -lt 20 ]; then
  unset CLAVE
  echo "La clave no tiene un formato valido." >&2
  exit 1
fi

export SUPABASE_SECRET_KEY="$CLAVE"
unset CLAVE

limpiar() {
  unset SUPABASE_SECRET_KEY
  stty echo 2>/dev/null || true
}
trap limpiar EXIT

cd "$RAIZ"
node scripts/test-rls-isolation.mjs
