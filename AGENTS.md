# AGENTS.md — Guía para agentes de IA y colaboradores

Reglas que **todo agente o desarrollador** debe respetar en este repositorio.

## Reglas de negocio inquebrantables

1. **Nunca exponer al cliente**: margen, utilidad, ganancia, costo interno, precio por gramo, pureza (18K/24K), fórmula del oro, notas internas ni notas internas de piedras. Hay tests que lo verifican (`src/services/pdfContent.test.ts`); si un cambio los rompe, el cambio está mal.
2. El precio del oro es configuración interna editable. Referencia comercial del dueño: **precio internacional 24K + $100.000 COP/gramo** (ver DECISIONS.md). No cambiar esta lógica sin marcarlo como decisión pendiente.
3. Todo el dinero se maneja en **COP como enteros** (`Math.round`), formateado con `formatCOP`.
4. El motor de cálculo (`src/calc/engine.ts`) es de **funciones puras**: sin dependencias de UI, DOM ni almacenamiento.

## Reglas técnicas

- No agregar dependencias sin justificación escrita en DECISIONS.md.
- No guardar secretos, tokens ni claves en el repositorio.
- No hacer cambios destructivos en datos del usuario: toda eliminación o importación de respaldo pide confirmación en la UI.
- No decir que algo funciona sin correr `npm test` y `npm run build`.
- Mobile-first: inputs mínimo 16px (evita zoom iOS), sin overflow horizontal, botones táctiles ≥ 44px.
- Textos de la interfaz en español.

## Antes de entregar cualquier cambio

```bash
npm test        # todos los tests deben pasar
npm run build   # el build debe compilar sin errores
```

## Trabajo futuro SaaS

No construir multiempresa falsa. Si algún día se agrega backend: toda consulta limitada por `organization_id` y autorización validada en el backend. Ver ARCHITECTURE.md § Migración a SaaS.
