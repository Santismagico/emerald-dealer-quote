import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  assertAllChecksPassed,
  assertDeniedOrFiltered,
  assertRejectedWithCode,
  assertRowUnchanged,
  n6EditableTables,
  n6EntitySpecs,
  validPayloads,
  validateN6Environment,
} from './test-rls-isolation.mjs'

const n6Source = readFileSync(new URL('./test-rls-isolation.mjs', import.meta.url), 'utf8')

const valid = {
  SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'public-test-key',
  SUPABASE_SECRET_KEY: 'secret-test-key',
  N6_TEST_PROJECT_REF: 'abcdefghijklmnopqrst',
  N6_TEST_PROJECT_NAME: 'Emerald Dealer - Pruebas Fase 2',
  N6_CONFIRM_TEST_PROJECT: 'TEST_ONLY:abcdefghijklmnopqrst',
}

test('acepta únicamente el marcador exacto del proyecto de pruebas', () => {
  assert.equal(validateN6Environment(valid).projectRef, valid.N6_TEST_PROJECT_REF)
})

test('rechaza una dirección que no coincide', () => {
  assert.throws(() => validateN6Environment({ ...valid, N6_TEST_PROJECT_REF: 'otra' }))
})

test('rechaza nombres que no identifican el entorno como pruebas', () => {
  assert.throws(() => validateN6Environment({ ...valid, N6_TEST_PROJECT_NAME: 'Emerald Dealer Producción' }))
})

test('rechaza un proyecto marcado como producción', () => {
  assert.throws(() => validateN6Environment({
    ...valid, N6_PRODUCTION_PROJECT_REF: valid.N6_TEST_PROJECT_REF,
  }))
})

test('rechaza si falta la confirmación exacta', () => {
  assert.throws(() => validateN6Environment({ ...valid, N6_CONFIRM_TEST_PROJECT: 'SI' }))
})

test('N6 cubre las doce tablas editables, incluidos gastos y Fondo', () => {
  assert.deepEqual(n6EditableTables, [
    'org_settings',
    'clients',
    'quotes',
    'appointments',
    'stone_lots',
    'suppliers',
    'buyers',
    'stock_jewels',
    'material_partners',
    'material_lots',
    'expenses',
    'fund_contributions',
  ])
})

test('cada entidad nueva tiene sus RPC protegidas de guardar y borrar', () => {
  const specs = new Map(n6EntitySpecs.map((spec) => [spec.table, spec]))
  assert.deepEqual(specs.get('buyers'), {
    table: 'buyers',
    upsertRpc: 'upsert_buyer',
    deleteRpc: 'delete_buyer',
  })
  assert.deepEqual(specs.get('stock_jewels'), {
    table: 'stock_jewels',
    upsertRpc: 'upsert_stock_jewel',
    deleteRpc: 'delete_stock_jewel',
  })
  assert.deepEqual(specs.get('material_partners'), {
    table: 'material_partners',
    upsertRpc: 'upsert_material_partner',
    deleteRpc: 'delete_material_partner',
  })
  assert.deepEqual(specs.get('material_lots'), {
    table: 'material_lots',
    upsertRpc: 'upsert_material_lot',
    deleteRpc: 'delete_material_lot',
  })
  assert.deepEqual(specs.get('expenses'), {
    table: 'expenses',
    upsertRpc: 'upsert_expense',
    deleteRpc: 'delete_expense',
  })
  assert.deepEqual(specs.get('fund_contributions'), {
    table: 'fund_contributions',
    upsertRpc: 'upsert_fund_contribution',
    deleteRpc: 'delete_fund_contribution',
  })
})

test('los payloads N6 nuevos son válidos y completos', () => {
  const payloads = validPayloads('guard')
  assert.equal(payloads.buyers.id, 'guard-buyer')
  assert.equal(payloads.stock_jewels.id, 'guard-stock-jewel')
  assert.equal(payloads.stock_jewels.costCop, 800000)
  assert.equal(payloads.stock_jewels.priceCop, 1200000)
  assert.equal(payloads.stock_jewels.status, 'disponible')
  assert.equal(payloads.stock_jewels.sale.productType, 'Aretes')
  assert.equal(payloads.stock_jewels.sale.usdRate, 4200.5)
  assert.equal(payloads.stone_lots.partnerId, null)
  assert.equal(payloads.stone_lots.partnerName, '')
  assert.equal(payloads.stone_lots.myPercent, 100)
  assert.equal(payloads.stone_lots.partners[0].amountCop, 300000)
  assert.equal(payloads.stone_lots.fundedFromFundCop, 100000)
  assert.equal(payloads.stone_lots.sales[0].productType, 'Anillo')
  assert.equal(payloads.stone_lots.sales[0].usdRate, 4200.5)
  assert.equal(payloads.stone_lots.sales[0].payments[0].usdRate, 4210)
  assert.equal(payloads.material_partners.id, 'guard-material-partner')
  assert.equal(payloads.material_lots.id, 'guard-material-lot')
  assert.equal(payloads.material_lots.grams, 10)
  assert.equal(payloads.material_lots.myGrams, 6)
  assert.equal(payloads.material_lots.costCop, 5000000)
  assert.equal(payloads.material_lots.partners[0].grams, 4)
  assert.deepEqual(payloads.material_lots.uses.map(({ grams }) => grams), [2])
  assert.equal(payloads.expenses.id, 'guard-expense')
  assert.equal(payloads.expenses.amountCop, 300000)
  assert.equal(payloads.expenses.usdRate, 4200.5)
  assert.equal(payloads.expenses.myPercent, 100)
  assert.equal(payloads.expenses.method, 'Transferencia')
  assert.equal(payloads.expenses.partners[0].amountCop, 120000)
  assert.equal(payloads.fund_contributions.id, 'guard-fund-contribution')
  assert.equal(payloads.fund_contributions.amountCop, 2000000)
  assert.equal(payloads.fund_contributions.payments[0].kind, 'rendimiento')
})

// N6 real no se corria nunca, asi que sus payloads envejecieron sin que nadie lo
// notara: C1 volvio obligatorios los quilates el 2026-08-04 y el guion siguio
// enviando lotes sin ellos. La prueba en vivo se detenia en la preparacion, antes
// de comprobar un solo control de aislamiento. Esta guarda lee el SQL vigente y
// exige que el payload lo cumpla, para que `npm test` lo detecte sin servidor.
test('el lote de piedras N6 cumple lo que exige el SQL de inventario', () => {
  const c1 = readFileSync(
    new URL('../supabase/migrations/20260804144748_fase_c1_tandas_talla.sql', import.meta.url),
    'utf8'
  )
  // Si el SQL dejara de exigirlo, esta guarda debe enterarse en vez de seguir sola.
  assert.ok(
    c1.includes("private.is_nonnegative_number(p_data->'carats')"),
    'C1 ya no exige quilates en el lote: revisar esta guarda'
  )
  assert.ok(
    c1.includes("private.is_nonnegative_number(sale->'carats')"),
    'C1 ya no exige quilates en la venta: revisar esta guarda'
  )

  const lot = validPayloads('guard').stone_lots
  const esNumeroNoNegativo = (valor) => typeof valor === 'number' && Number.isFinite(valor) && valor >= 0
  const esEnteroNoNegativo = (valor) => Number.isInteger(valor) && valor >= 0

  assert.ok(esNumeroNoNegativo(lot.carats), 'el lote N6 debe declarar quilates comprados')
  assert.ok(esEnteroNoNegativo(lot.quantity), 'el lote N6 debe declarar cantidad comprada')
  for (const sale of lot.sales) {
    assert.ok(esNumeroNoNegativo(sale.carats), 'cada venta N6 debe declarar quilates vendidos')
    assert.ok(esEnteroNoNegativo(sale.quantity), 'cada venta N6 debe declarar cantidad vendida')
  }

  // Lo comprado tiene que alcanzar para lo vendido, o el servidor responde
  // 'raw stone inventory exceeded'. Sin tandas de talla, lo vendido es en bruto.
  const vendidosQuilates = lot.sales.reduce((total, sale) => total + sale.carats, 0)
  const vendidasPiedras = lot.sales.reduce((total, sale) => total + sale.quantity, 0)
  assert.ok(lot.carats >= vendidosQuilates, 'el lote N6 vende mas quilates de los que compro')
  assert.ok(lot.quantity >= vendidasPiedras, 'el lote N6 vende mas piedras de las que compro')
})

test('un rechazo N6 solo cuenta cuando coincide con el código esperado', () => {
  assert.doesNotThrow(() => assertRejectedWithCode(
    { error: { code: '42501', message: 'permiso denegado' } },
    'escritura directa',
    '42501'
  ))
  assert.throws(() => assertRejectedWithCode(
    { error: { code: '23505', message: 'registro duplicado' } },
    'escritura directa',
    '42501'
  ))
})

test('un update o delete filtrado por RLS se acepta solo si no devuelve otro error', () => {
  assert.doesNotThrow(() => assertDeniedOrFiltered(
    { error: { code: '42501', message: 'permiso denegado' } },
    'update directo'
  ))
  assert.doesNotThrow(() => assertDeniedOrFiltered(
    { error: null, data: null },
    'delete filtrado'
  ))
  assert.throws(() => assertDeniedOrFiltered(
    { error: { code: '23505', message: 'otro error' } },
    'update directo'
  ))
})

test('N6 detecta una escritura filtrada que sí alteró el registro protegido', () => {
  const before = { id: 'fila-1', data: { name: 'Original' } }
  assert.doesNotThrow(() => assertRowUnchanged(
    before,
    { id: 'fila-1', data: { name: 'Original' } },
    'escritura directa'
  ))
  assert.throws(() => assertRowUnchanged(
    before,
    { id: 'fila-1', data: { name: 'Alterado' } },
    'escritura directa'
  ))
})

test('N6 no puede anunciar aprobación si algún control queda en falso', () => {
  assert.doesNotThrow(() => assertAllChecksPassed({ aislamiento: true, limpieza: true }))
  assert.throws(() => assertAllChecksPassed({ aislamiento: true, limpieza: false }))
})

test('el runner invalida evidencia vieja y cubre escrituras anónimas completas', () => {
  assert.match(n6Source, /rmSync\(evidencePath,\s*\{\s*force:\s*true\s*\}\)/)
  assert.match(n6Source, /update anónimo \$\{table\}/)
  assert.match(n6Source, /delete anónimo \$\{table\}/)
  assert.match(n6Source, /assertRowUnchanged\(before,\s*afterUpdate/)
  assert.match(n6Source, /assertRowUnchanged\(before,\s*afterDelete/)
  assert.match(n6Source, /n6DirectWriteProbe/)
  assert.match(n6Source, /n6AnonymousWriteProbe/)
  assert.match(n6Source, /assertAllChecksPassed\(evidence\.checks\)/)
  assert.match(n6Source, /commit:\s*candidate\.commit/)
  assert.match(n6Source, /exactCandidateCommit:\s*true/)
})

test('el runner distingue permisos, parámetros prohibidos y payloads inválidos', () => {
  assert.match(n6Source, /'42501'/)
  assert.match(n6Source, /'PGRST202'/)
  assert.match(n6Source, /'22023'/)
  assert.match(n6Source, /gasto sin concepto/)
  assert.match(n6Source, /porcentaje mayor a 100/)
  assert.match(n6Source, /for \(const invalidPercent of \[-1, 101, 60\.5\]\)/)
  assert.match(n6Source, /lote de piedras con porcentaje invalido/)
  assert.match(n6Source, /assertRowUnchanged\(\s*stoneBefore,\s*stoneAfter/)
  assert.match(n6Source, /tipos de producto duplicados/)
  assert.match(n6Source, /ultima tasa menor al minimo/)
  assert.match(n6Source, /ultima tasa mayor al maximo/)
  assert.match(n6Source, /tipo de producto no textual/)
  assert.match(n6Source, /cambio de tasa de venta/)
  assert.match(n6Source, /cambio de tasa de abono/)
  assert.match(n6Source, /lote historico que intenta completar tasa/)
  assert.match(n6Source, /joya con \$\{label\}/)
  assert.match(n6Source, /gasto historico con tasa \$\{invalidRate\}/)
  assert.match(n6Source, /assertRowUnchanged\(\s*historicalStoneBefore/)
  assert.match(n6Source, /assertRowUnchanged\(jewelBefore/)
  assert.match(n6Source, /assertRowUnchanged\(expenseBefore/)
  assert.match(n6Source, /piedras con socios y fondo por encima del costo/)
  assert.match(n6Source, /material con socios por encima de los gramos/)
  assert.match(n6Source, /gasto con socios por encima del monto/)
  assert.match(n6Source, /fondo con pago repetido/)
  assert.match(n6Source, /fondo con dinero fuera del límite seguro/)
  assert.match(n6Source, /twelveEditableTablesCovered/)
})
