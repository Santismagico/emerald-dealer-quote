import test from 'node:test'
import assert from 'node:assert/strict'
import { validateN6Environment } from './test-rls-isolation.mjs'

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
