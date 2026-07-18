import test from 'node:test'
import assert from 'node:assert/strict'
import { riskyTrackedPath, scanText } from './check-tracked-secrets.mjs'

test('rechaza archivos privados versionados o preparados', () => {
  assert.equal(riskyTrackedPath('.env.local'), 'archivo de variables privadas')
  assert.equal(riskyTrackedPath('certificados/produccion.pem'), 'archivo de credencial privada')
  assert.equal(riskyTrackedPath('.env.example'), null)
})

test('detecta secretos reales sin imprimir su contenido', () => {
  const secret = `sb_secret_${'a'.repeat(32)}`
  const findings = scanText('config.txt', `SUPABASE_SECRET_KEY=${secret}`)
  assert.ok(findings.length >= 1)
  assert.ok(findings.every((finding) => !finding.includes(secret)))
})

test('acepta nombres de variables y ejemplos sin credenciales', () => {
  const source = [
    'const required = "SUPABASE_SECRET_KEY"',
    'SUPABASE_SECRET_KEY=${SUPABASE_SECRET_KEY}',
    'SUPABASE_SERVICE_ROLE_KEY=<TU_CLAVE_PRIVADA>',
    'role = service_role',
  ].join('\n')
  assert.deepEqual(scanText('script.mjs', source), [])
})

test('detecta otros formatos críticos', () => {
  const databaseUrl = ['postgresql://admin:', 'supersecreta@db.example.test:5432/app'].join('')
  const privateKeyHeader = ['-----BEGIN', 'PRIVATE KEY-----'].join(' ')
  assert.equal(scanText('db.txt', databaseUrl).length, 1)
  assert.equal(scanText('key.txt', privateKeyHeader).length, 1)
})
