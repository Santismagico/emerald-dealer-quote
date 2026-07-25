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

test('N6 cubre las diez tablas editables, incluidas las cuatro de inventario nuevo', () => {
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
})

test('los payloads N6 de las cuatro tablas nuevas son válidos y completos', () => {
  const payloads = validPayloads('guard')
  assert.equal(payloads.buyers.id, 'guard-buyer')
  assert.equal(payloads.stock_jewels.id, 'guard-stock-jewel')
  assert.equal(payloads.stock_jewels.costCop, 800000)
  assert.equal(payloads.stock_jewels.priceCop, 1200000)
  assert.equal(payloads.stock_jewels.status, 'disponible')
  assert.equal(payloads.material_partners.id, 'guard-material-partner')
  assert.equal(payloads.material_lots.id, 'guard-material-lot')
  assert.equal(payloads.material_lots.grams, 10)
  assert.equal(payloads.material_lots.myGrams, 6)
  assert.equal(payloads.material_lots.costCop, 5000000)
  assert.deepEqual(payloads.material_lots.uses.map(({ grams }) => grams), [2])
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
})
