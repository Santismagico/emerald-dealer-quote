import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const editableTables = ['org_settings', 'clients', 'quotes', 'appointments', 'stone_lots', 'suppliers']

export function validateN6Environment(env = process.env) {
  const url = env.SUPABASE_URL?.trim()
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY?.trim() || env.SUPABASE_ANON_KEY?.trim()
  const secretKey = env.SUPABASE_SECRET_KEY?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const expectedRef = env.N6_TEST_PROJECT_REF?.trim()
  const projectName = env.N6_TEST_PROJECT_NAME?.trim()

  if (!url || !publishableKey || !secretKey || !expectedRef || !projectName) {
    throw new Error('Faltan datos obligatorios del proyecto de pruebas N6.')
  }
  const hostname = new URL(url).hostname
  const actualRef = hostname.endsWith('.supabase.co') ? hostname.slice(0, -'.supabase.co'.length) : ''
  if (!actualRef || actualRef !== expectedRef) {
    throw new Error('La dirección no coincide con el proyecto de pruebas autorizado.')
  }
  if (!/^Emerald Dealer - Pruebas(?:\b| )/i.test(projectName)) {
    throw new Error('N6 solo puede ejecutarse en un proyecto identificado como pruebas.')
  }
  if (env.N6_PRODUCTION_PROJECT_REF?.trim() === actualRef) {
    throw new Error('N6 se negó a usar un proyecto marcado como producción.')
  }
  if (env.N6_CONFIRM_TEST_PROJECT !== `TEST_ONLY:${actualRef}`) {
    throw new Error('Falta la confirmación exacta del entorno desechable de pruebas.')
  }
  if (secretKey === publishableKey) {
    throw new Error('La clave administrativa no puede ser la misma clave pública.')
  }
  return { url, publishableKey, secretKey, projectRef: actualRef, projectName }
}

function client(url, key) {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function assertSuccess(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`)
  return result.data
}

function assertRejected(result, label) {
  if (!result.error) throw new Error(`${label}: la operación debía ser rechazada`)
}

function rowFor(table, organizationId, id, now) {
  if (table === 'org_settings') return { organization_id: organizationId, data: { currency: 'COP' }, updated_at: now }
  const base = { id, organization_id: organizationId, data: { id }, updated_at: now }
  if (table === 'quotes') return { ...base, number: 'ED-N6-DIRECTA', status: 'borrador' }
  return base
}

function validPayloads(prefix) {
  return {
    clients: { id: `${prefix}-client`, name: `Cliente ${prefix}` },
    quotes: {
      id: `${prefix}-quote`, number: `ED-N6-${prefix}`, status: 'borrador',
      materialPricePerGram: 500000, laborCost: 100000, deposit: 0,
      stones: [], extraCosts: [], production: [], payments: [],
    },
    appointments: { id: `${prefix}-appointment`, status: 'programada', durationMinutes: 60 },
    stone_lots: {
      id: `${prefix}-stone`, purchaseValueCop: 1000000, quantity: 1,
      supplierPayments: [], sales: [],
    },
    suppliers: { id: `${prefix}-supplier`, name: `Proveedor ${prefix}` },
  }
}

async function upsertAll(api, payloads, now) {
  assertSuccess(await api.rpc('upsert_settings', {
    p_data: { currency: 'COP', goldPricePerGram: 500000, goldMarkupPerGram: 100000 },
    p_updated_at: now,
  }), 'guardar configuración por RPC')
  const calls = [
    ['clients', 'upsert_client'],
    ['quotes', 'upsert_quote'],
    ['appointments', 'upsert_appointment'],
    ['stone_lots', 'upsert_stone_lot'],
    ['suppliers', 'upsert_supplier'],
  ]
  for (const [table, rpc] of calls) {
    const data = payloads[table]
    assertSuccess(await api.rpc(rpc, { p_id: data.id, p_data: data, p_updated_at: now }), `${rpc} legítima`)
  }
}

async function verifyOwnReads(api, organizationId) {
  for (const table of editableTables) {
    const result = await api.from(table).select('organization_id').eq('organization_id', organizationId)
    const rows = assertSuccess(result, `lectura propia ${table}`)
    if (!rows || rows.length === 0) throw new Error(`lectura propia ${table}: no devolvió datos`)
  }
}

async function verifyCrossTenantReads(api, otherOrganizationId) {
  for (const table of editableTables) {
    const result = await api.from(table).select('organization_id').eq('organization_id', otherOrganizationId)
    const rows = assertSuccess(result, `lectura cruzada ${table}`)
    if (rows?.length !== 0) throw new Error(`lectura cruzada ${table}: expuso datos de otra joyería`)
  }
}

async function verifyDirectWritesDenied(api, organizationId, prefix, now) {
  for (const table of editableTables) {
    const id = `${prefix}-direct-${table}`
    assertRejected(await api.from(table).insert(rowFor(table, organizationId, id, now)), `insert directo ${table}`)

    let update = api.from(table).update({ updated_at: now }).eq('organization_id', organizationId)
    let remove = api.from(table).delete().eq('organization_id', organizationId)
    if (table !== 'org_settings') {
      update = update.eq('id', `${prefix}-${table === 'stone_lots' ? 'stone' : table.slice(0, -1)}`)
      remove = remove.eq('id', `${prefix}-${table === 'stone_lots' ? 'stone' : table.slice(0, -1)}`)
    }
    assertRejected(await update, `update directo ${table}`)
    assertRejected(await remove, `delete directo ${table}`)
  }
}

async function verifyRpcCannotTargetOtherTenant(api, otherOrganizationId, otherPayloads) {
  const calls = [
    ['upsert_client', otherPayloads.clients],
    ['upsert_quote', otherPayloads.quotes],
    ['upsert_appointment', otherPayloads.appointments],
    ['upsert_stone_lot', otherPayloads.stone_lots],
    ['upsert_supplier', otherPayloads.suppliers],
  ]
  for (const [rpc, data] of calls) {
    const result = await api.rpc(rpc, {
      p_id: data.id,
      p_data: data,
      p_updated_at: new Date().toISOString(),
      p_organization_id: otherOrganizationId,
    })
    assertRejected(result, `${rpc} con joyería ajena`)
  }
}

async function verifyAnonymous(api, organizationId, now) {
  for (const table of editableTables) {
    const read = await api.from(table).select('*').limit(1)
    if (!read.error && read.data?.length) throw new Error(`sesión anónima leyó ${table}`)
    assertRejected(await api.from(table).insert(rowFor(table, organizationId, `anon-${table}`, now)), `sesión anónima escribió ${table}`)
  }
  assertRejected(await api.rpc('create_organization', { org_name: 'No permitida' }), 'RPC anónima')
}

async function verifyConcurrentNumbers(api) {
  const results = await Promise.all(Array.from({ length: 20 }, () => api.rpc('next_quote_number')))
  const numbers = results.map((result, index) => assertSuccess(result, `consecutivo concurrente ${index + 1}`))
  if (new Set(numbers).size !== numbers.length) throw new Error('El consecutivo produjo números duplicados.')
}

async function verifyMalformedPayloads(api, now) {
  assertRejected(await api.rpc('upsert_quote', {
    p_id: 'n6-invalid-quote',
    p_data: {
      id: 'n6-invalid-quote', number: 'ED-N6-INVALID', status: 'inventado',
      materialPricePerGram: -1, laborCost: 0, deposit: 0,
      stones: [], extraCosts: [], production: [], payments: [],
    },
    p_updated_at: now,
  }), 'cotización inválida')
  assertRejected(await api.rpc('upsert_appointment', {
    p_id: 'n6-invalid-appointment',
    p_data: { id: 'n6-invalid-appointment', status: 'inventado', durationMinutes: 0 },
    p_updated_at: now,
  }), 'cita inválida')
}

export async function runN6(env = process.env) {
  const config = validateN6Environment(env)
  const admin = client(config.url, config.secretKey)
  const anonymous = client(config.url, config.publishableKey)
  const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const password = `N6-${crypto.randomUUID()}-Aa1!`
  const users = []
  const organizations = []
  const startedAt = Date.now()

  try {
    for (const label of ['a', 'b']) {
      const email = `n6-${label}-${nonce}@example.invalid`
      const created = assertSuccess(await admin.auth.admin.createUser({ email, password, email_confirm: true }), `crear usuario ${label}`)
      users.push({ id: created.user.id, email })
    }

    const apis = []
    for (const [index, user] of users.entries()) {
      const api = client(config.url, config.publishableKey)
      assertSuccess(await api.auth.signInWithPassword({ email: user.email, password }), `ingreso usuario ${index + 1}`)
      const organizationId = assertSuccess(await api.rpc('create_organization', { org_name: `N6 ${index + 1} ${nonce}` }), `crear joyería ${index + 1}`)
      organizations.push(organizationId)
      apis.push(api)
    }

    const now = new Date().toISOString()
    const payloadA = validPayloads('n6-a')
    const payloadB = validPayloads('n6-b')
    await upsertAll(apis[0], payloadA, now)
    await upsertAll(apis[1], payloadB, now)
    await verifyOwnReads(apis[0], organizations[0])
    await verifyOwnReads(apis[1], organizations[1])
    await verifyCrossTenantReads(apis[0], organizations[1])
    await verifyCrossTenantReads(apis[1], organizations[0])
    await verifyDirectWritesDenied(apis[0], organizations[0], 'n6-a', now)
    await verifyDirectWritesDenied(apis[1], organizations[1], 'n6-b', now)
    await verifyRpcCannotTargetOtherTenant(apis[0], organizations[1], payloadB)
    await verifyRpcCannotTargetOtherTenant(apis[1], organizations[0], payloadA)
    assertRejected(await apis[0].from('memberships').insert({
      user_id: users[0].id, organization_id: organizations[1], role: 'owner',
    }), 'membresía ajena')
    await verifyAnonymous(anonymous, organizations[0], now)
    await verifyConcurrentNumbers(apis[0])
    await verifyMalformedPayloads(apis[0], now)

    const evidence = {
      checkedAt: new Date().toISOString(),
      projectRef: config.projectRef,
      projectName: config.projectName,
      durationMs: Date.now() - startedAt,
      checks: {
        twoOrganizations: true,
        ownReads: true,
        crossTenantReadsBlocked: true,
        directWritesBlocked: true,
        rpcCannotChooseOrganization: true,
        foreignMembershipBlocked: true,
        anonymousAccessBlocked: true,
        concurrentNumbersUnique: true,
        malformedPayloadsBlocked: true,
      },
    }
    const directory = resolve(root, 'security-evidence')
    mkdirSync(directory, { recursive: true })
    writeFileSync(resolve(directory, 'n6-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')
    return evidence
  } finally {
    if (organizations.length > 0) {
      await admin.from('organizations').delete().in('id', organizations)
    }
    for (const user of users) await admin.auth.admin.deleteUser(user.id)
  }
}

async function main() {
  const evidence = await runN6()
  console.log(`N6 aprobado: ${Object.keys(evidence.checks).length} controles en ${evidence.durationMs} ms.`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`N6 detenido: ${error instanceof Error ? error.message : 'error desconocido'}`)
    process.exitCode = 1
  })
}
