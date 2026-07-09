# Emerald Dealer Quote

PWA para que joyerías creen **cotizaciones profesionales de joyas** desde el celular o el computador. Funciona sin internet: los datos se guardan localmente en el dispositivo.

Marca comercial: **Emerald Dealer** · Nombre técnico: Joyeria Quote Generator

## Qué hace

- Crear cotizaciones con cliente, pieza, material, peso, piedras, mano de obra, costos, margen interno, descuento, impuestos, anticipo e imágenes.
- Motor de cálculo en COP (enteros, sin errores de decimales), separado de la interfaz y con pruebas.
- Vista previa doble: **vista cliente** (presentable) y **vista interna** (confidencial, con costos y margen).
- PDF elegante para el cliente **sin información sensible** + PDF interno opcional.
- Compartir por WhatsApp con mensaje profesional.
- Historial: buscar, editar, duplicar, cambiar estado.
- Respaldo: exportar/importar todos los datos en JSON.
- Instalable como app (PWA) en iPhone y Android.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS 4 · IndexedDB (sin backend) · jsPDF · vite-plugin-pwa · Vitest

## Comandos

```bash
npm install        # instalar dependencias
npm run dev        # servidor de desarrollo (http://localhost:5173)
npm test           # pruebas unitarias (motor de cálculo, privacidad, persistencia)
npm run build      # verificación de tipos + build de producción en dist/
npm run preview    # servir el build de producción
npm run icons      # regenerar los iconos PWA en public/
```

## Primer uso

1. Abre **Ajustes** y configura el nombre de la joyería, contacto y — importante — el **precio del oro por gramo** (dato interno, nunca visible al cliente).
2. Crea clientes en la pestaña **Clientes**.
3. Crea una cotización con **＋ Nueva**: el formulario va por pasos (Cliente → Pieza → Piedras → Costos).
4. En la **vista previa** puedes guardar, generar el PDF del cliente, ver la vista interna y compartir por WhatsApp.

## Instalación como app

- **iPhone:** Safari → Compartir → “Añadir a pantalla de inicio”.
- **Android:** Chrome → menú ⋮ → “Instalar aplicación”.

## Respaldo de datos

Los datos viven **solo en tu dispositivo** (IndexedDB). Si borras los datos del navegador, se pierden. Exporta un respaldo JSON con frecuencia desde **Ajustes → Respaldo de datos**. La importación reemplaza todo y pide confirmación.

## Estructura

```
src/
  calc/        motor de cálculo (funciones puras + tests)
  components/  vistas e interfaz (mobile-first)
  services/    persistencia, PDF, WhatsApp, respaldo
  types/       modelo de datos
  utils/       dinero, fechas, imágenes, ids
scripts/       generador de iconos PWA
```

Más detalle en [ARCHITECTURE.md](ARCHITECTURE.md), [PRODUCT_SPEC.md](PRODUCT_SPEC.md) y [DECISIONS.md](DECISIONS.md).
