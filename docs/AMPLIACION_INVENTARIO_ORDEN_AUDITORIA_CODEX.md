# Orden de auditoría para Codex — Ampliación de inventario (antes de publicar)

_Creada el 2026-07-25 por Claude. Santiago (Héctor) pidió expresamente que **Codex
audite y autorice** esta ampliación **antes** de publicarla al enlace nuevo. Hasta que
Codex autorice, **NO se publica nada**._

---

## 0. Qué se te pide, en una frase

Auditar los cambios sin publicar de la rama `codex/fase2-nube` y **decidir**: los
apruebas para publicar al enlace nuevo, o los bloqueas con hallazgos concretos.
Al final, escribe tu veredicto en `docs/AUDITORIA_AMPLIACION_INVENTARIO_CODEX.md`.

**No publiques tú.** La publicación (recompilar + push a `Santismagico/emerald-dealer-app`)
la hará Claude, y solo después de tu autorización y con orden de Santiago.

---

## 1. Contexto: qué se construyó y por qué

Dos ampliaciones pedidas por un comerciante grande de esmeraldas (cliente real de
Héctor) y por el propio Héctor:

- **Ampliación 1 — Piedras a crédito y joyas en stock (D-042 a D-047).**
  Crédito al vender piedras (fecha acordada + abonos), compradores como entidad,
  joyas en stock de contado, y su efecto en los cierres. Incluye la corrección de
  dos defectos de dinero que Claude encontró en su propia auditoría (D-047, H1/H2).
- **Ampliación 2 — Inventario de materiales y espacio de joyas (D-048 a D-050).**
  Inventario de oro por lotes con **propiedad compartida** (parte suya, parte del
  socio), socios de material como entidad propia, y "Inventario" con cuatro
  secciones. Campo `collectionId` reservado en joyas para colecciones futuras.

Estado actual: **720 pruebas en verde, compilación limpia**. Todo en
`codex/fase2-nube`. **`main` (las 7 joyerías del piloto) NO fue tocado.**

Las **dos migraciones SQL** ya fueron aplicadas por Héctor al servidor de producción
`wrvokfzrcmmlzekudypu` el 2026-07-25 (él confirmó "Success" en ambas). Parte de tu
auditoría es confirmar que esas migraciones eran seguras de aplicar sobre datos reales.

## 2. Alcance exacto (commits a revisar)

Desde `3edf476` (último commit previo a la ampliación) hasta `HEAD` (`3cd9e5c`):

```
951b654 plan piedras con credito y joyas en stock (D-042 a D-046)
7a9d7df E1 tipos, normalizacion, migraciones v6
7921615 E2 nube y cierres con la plata real
1e57606 E3 pantallas Inventario/Joyas/Cobros/Compradores
9962ef2 fix H1 y H2 (no perder dinero cobrado, D-047)
bee7d89 plan inventario de materiales (D-048 a D-050)
420a867 E1 materiales: tipos, motor, migraciones v7
a42c507 E2 materiales: nube y migracion SQL aditiva
4a5b6e7 E3 materiales: pantallas Material y Socios
(+ commits de docs)
```

Documentos de referencia: `docs/PLAN_PIEDRAS_Y_JOYAS_EN_STOCK.md`,
`docs/PLAN_MATERIALES_Y_JOYAS.md`, `DECISIONS.md` (D-042 a D-050).

## 3. Verificación mecánica (córrela tú mismo, no confíes en lo escrito)

```bash
cd /c/Dev/emerald-dealer
git status                      # árbol limpio, rama codex/fase2-nube
npm test                        # deben pasar TODAS (esperado: 720)
npm run build                   # tsc --noEmit && vite build sin errores
```

Compilación pública (sin Supabase, como las 7 joyerías) para confirmar que la nube no
se filtra al modo local:

```bash
npm run build                   # sin .env de produccion
grep -ri "wrvokfzrcmmlzekudypu" dist/ || echo "OK: sin URL de produccion en el bundle publico"
```

## 4. Lo que DEBES auditar (checklist crítico)

### 4.1 El dinero nunca se pierde ni se duplica
- [ ] Editar una venta a crédito y apagar "es a crédito" **no** borra abonos ya
  recibidos (D-047/H1). Revisa `withSaleCredit` en `src/services/stones.ts` y su
  prueba `src/services/stonesCreditGuards.test.ts`.
- [ ] Los avisos de borrar lote/venta **nombran** la plata que se pierde (D-047/H2):
  `stoneLotDeletionWarning`, `stoneSaleDeletionWarning`.
- [ ] Saldos, vencimientos y días de atraso son **derivados**, nunca contadores
  guardados (`src/services/receivables.ts`).
- [ ] Materiales: el reparto (myGrams) nunca supera los gramos del lote; el restante
  no baja de 0; el reparto se mantiene al usar gramos (`src/services/materials.ts`).

### 4.2 Cierres honestos (D-045)
- [ ] Una venta a crédito **no** entra a caja el día de la venta; los abonos entran el
  día que se reciben; una joya sale de caja el día que entra al inventario.
- [ ] Un día/mes sin crédito da **exactamente el mismo neto que antes** (no regresión).
  Ver `src/services/dailyReportInventory.test.ts`.

### 4.3 Privacidad del cliente (LEY)
- [ ] `src/services/pdfContent.test.ts` sigue pasando sin cambios.
- [ ] Nada interno (costos de joyas, márgenes, nombres de compradores/socios, notas,
  reparto de materiales) puede llegar a un documento del cliente.

### 4.4 Seguridad de las migraciones sobre PRODUCCIÓN viva
Las dos migraciones ya se aplicaron; confirma que eran seguras:
- [ ] `supabase/migrations/20260721210000_inventario_compradores_y_joyas.sql`
- [ ] `supabase/migrations/20260724210000_inventario_materiales.sql`
- [ ] Son **puramente aditivas**: solo `create ... if not exists`, `create or replace`,
  `grant`. **Ningún** `drop table`, `drop column`, `truncate`, ni `delete from` de
  tablas con datos. Repetibles sin daño.
- [ ] RLS activada, solo lectura directa; escrituras solo por funciones protegidas.
- [ ] El `organization_id` se resuelve **en el servidor** (`current_organization_id_for_roles`),
  nunca se acepta del navegador. Revisa que ninguna función reciba `p_organization_id`.
- [ ] Validación en servidor de gramos/costos/dinero (`assert_material_lot_payload`,
  `assert_stock_jewel_payload`, ampliación de `assert_stone_lot_payload`).
- Prueba: `src/services/cloud/migrations.test.ts`.

### 4.5 Aislamiento y cadena de nube
- [ ] Renombrar/borrar un comprador o un socio **arrastra a la nube** los lotes/joyas
  que cambiaron, y **no** sube lo que no cambió
  (`src/services/cloud/inventoryCloud.test.ts`, `materialsCloud.test.ts`).
- [ ] Cada tabla nueva usa su función protegida (upsert_/delete_) correcta.

### 4.6 Migraciones locales y respaldos
- [ ] IndexedDB v7 solo AGREGA escalones; una base v5/v6 real migra sin pérdida.
- [ ] `BACKUP_VERSION 7` acepta respaldos v1–v6; importación atómica con rollback.
- [ ] Una venta vieja (sin marcas de crédito) se lee como de CONTADO con su mismo
  valor (no regresión de datos ya instalados).

### 4.7 Interfaz
- [ ] Sin desbordamiento horizontal a 320/390/1280 px; overlays con colchón del menú.
- [ ] Menú inferior en 5 botones; "Inventario" con 4 secciones legibles.

## 5. Reglas que NO se rompen (confírmalas)
- [ ] `main` intacto (`git log -1 main` = `0a86e5a`), `.github/workflows/deploy.yml`
  sin tocar.
- [ ] Ninguna dependencia nueva (revisa `package.json`).
- [ ] Ningún secreto en el repo. La service_role key jamás aparece. La anon key es
  publicable y solo entra al bundle en la compilación de producción, nunca al repo.
- [ ] Motor de cálculo y precio del oro sin cambios no justificados.

## 6. Tu veredicto (entregable)

Escribe `docs/AUDITORIA_AMPLIACION_INVENTARIO_CODEX.md` con:

1. **APROBADO PARA PUBLICAR** o **BLOQUEADO**.
2. Resultado exacto de `npm test` y `npm run build` que corriste tú.
3. Cada punto del checklist (§4 y §5) con ✔ o el hallazgo concreto (archivo:línea,
   cómo reproducir, impacto).
4. Si hay hallazgos: severidad y si bloquean o no la publicación.

Si algo bloquea, **no lo arregles en silencio**: repórtalo para decidir con Santiago.
Si todo pasa, deja escrito que Claude queda autorizado a publicar al enlace nuevo
siguiendo el procedimiento documentado (recompilar con las credenciales de producción,
push del `dist` a `Santismagico/emerald-dealer-app`, borrar el `.env.production.local`,
verificar el sitio en vivo), **con orden expresa de Santiago para el push final.**
