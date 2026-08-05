import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { createClient } from '@supabase/supabase-js'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const evidenceDirectory = resolve(root, 'security-evidence')
const evidencePath = resolve(evidenceDirectory, 'n6-evidence.json')

export const n6EntitySpecs = Object.freeze([
  { table: 'clients', upsertRpc: 'upsert_client', deleteRpc: 'delete_client' },
  { table: 'quotes', upsertRpc: 'upsert_quote', deleteRpc: 'delete_quote' },
  { table: 'appointments', upsertRpc: 'upsert_appointment', deleteRpc: 'delete_appointment' },
  { table: 'stone_lots', upsertRpc: 'upsert_stone_lot', deleteRpc: 'delete_stone_lot' },
  { table: 'suppliers', upsertRpc: 'upsert_supplier', deleteRpc: 'delete_supplier' },
  { table: 'buyers', upsertRpc: 'upsert_buyer', deleteRpc: 'delete_buyer' },
  { table: 'stock_jewels', upsertRpc: 'upsert_stock_jewel', deleteRpc: 'delete_stock_jewel' },
  {
    table: 'material_partners',
    upsertRpc: 'upsert_material_partner',
    deleteRpc: 'delete_material_partner',
  },
  { table: 'material_lots', upsertRpc: 'upsert_material_lot', deleteRpc: 'delete_material_lot' },
  { table: 'expenses', upsertRpc: 'upsert_expense', deleteRpc: 'delete_expense' },
])

export const n6EditableTables = Object.freeze([
  'org_settings',
  ...n6EntitySpecs.map(({ table }) => table),
])

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

function gitValue(args) {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  })
  if (result.status !== 0) {
    throw new Error('N6 no pudo identificar el commit candidato.')
  }
  return result.stdout.trim()
}

function readCandidateGitState() {
  const commit = gitValue(['rev-parse', 'HEAD'])
  const branch = gitValue(['branch', '--show-current'])
  const changes = gitValue(['status', '--porcelain', '--untracked-files=normal'])
  if (branch !== 'codex/fase2-nube') {
    throw new Error(`N6 debe ejecutarse desde codex/fase2-nube, no desde ${branch || 'otra rama'}.`)
  }
  if (changes) {
    throw new Error('N6 exige un commit exacto: hay cambios sin guardar en Git.')
  }
  return { commit, branch }
}

function client(url, key) {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function assertSuccess(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`)
  return result.data
}

export function assertRejectedWithCode(result, label, expectedCode) {
  if (!result.error) throw new Error(`${label}: la operación debía ser rechazada`)
  if (result.error.code !== expectedCode) {
    throw new Error(
      `${label}: se esperaba ${expectedCode}, pero el servidor devolvió `
      + `${result.error.code || 'un error sin código'} (${result.error.message})`
    )
  }
}

export function assertDeniedOrFiltered(result, label) {
  if (result.error && result.error.code !== '42501') {
    throw new Error(
      `${label}: se esperaba un rechazo de permisos o cero filas, pero el servidor devolvió `
      + `${result.error.code || 'un error sin código'} (${result.error.message})`
    )
  }
}

export function assertRowUnchanged(before, after, label) {
  if (!isDeepStrictEqual(after, before)) {
    throw new Error(`${label}: la escritura directa alteró datos protegidos`)
  }
}

function assertNoVisibleRows(result, label) {
  if (result.error) {
    assertRejectedWithCode(result, label, '42501')
    return
  }
  if (result.data?.length) throw new Error(`${label}: expuso datos protegidos`)
}

export function assertAllChecksPassed(checks) {
  const failed = Object.entries(checks)
    .filter(([, passed]) => passed !== true)
    .map(([name]) => name)
  if (failed.length > 0) {
    throw new Error(`N6 no aprobó estos controles: ${failed.join(', ')}`)
  }
}

function rowFor(table, organizationId, id, now) {
  if (table === 'org_settings') return { organization_id: organizationId, data: { currency: 'COP' }, updated_at: now }
  const base = { id, organization_id: organizationId, data: { id }, updated_at: now }
  if (table === 'quotes') return { ...base, number: 'ED-N6-DIRECTA', status: 'borrador' }
  return base
}

export function validPayloads(prefix) {
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
      partnerId: null, partnerName: '', myPercent: 100,
      supplierPayments: [],
      sales: [{
        id: `${prefix}-stone-sale`,
        valueCop: 700000,
        quantity: 1,
        productType: 'Anillo',
        usdRate: 4200.5,
        payments: [{ amount: 200000, usdRate: 4210 }],
      }],
    },
    suppliers: { id: `${prefix}-supplier`, name: `Proveedor ${prefix}` },
    buyers: { id: `${prefix}-buyer`, name: `Comprador ${prefix}` },
    stock_jewels: {
      id: `${prefix}-stock-jewel`,
      costCop: 800000,
      priceCop: 1200000,
      status: 'disponible',
      sale: {
        id: `${prefix}-stock-jewel-sale`,
        priceCop: 1200000,
        productType: 'Aretes',
        usdRate: 4200.5,
      },
    },
    material_partners: {
      id: `${prefix}-material-partner`,
      name: `Socio ${prefix}`,
    },
    material_lots: {
      id: `${prefix}-material-lot`,
      grams: 10,
      myGrams: 6,
      costCop: 5000000,
      uses: [{
        id: `${prefix}-material-use`,
        date: '2026-07-25',
        grams: 2,
        notes: 'Prueba N6',
      }],
    },
    expenses: {
      id: `${prefix}-expense`,
      date: '2026-08-03',
      concept: `Publicidad ${prefix}`,
      category: 'Publicidad',
      amountCop: 300000,
      usdRate: 4200.5,
      method: 'Transferencia',
      paidBy: 'Santiago',
      partnerId: null,
      partnerName: '',
      myPercent: 100,
      notes: '',
      createdAt: '2026-08-03T10:00:00.000Z',
      updatedAt: '2026-08-03T10:00:00.000Z',
    },
  }
}

async function upsertAll(api, payloads, now) {
  assertSuccess(await api.rpc('upsert_settings', {
    p_data: {
      currency: 'COP',
      goldPricePerGram: 500000,
      goldMarkupPerGram: 100000,
      productTypes: [
        { name: 'Anillo', active: true },
        { name: 'Aretes', active: true },
      ],
      lastKnownUsdRate: 4200.5,
      usdRateUpdatedAt: '2026-08-03T10:00:00.000Z',
    },
    p_updated_at: now,
  }), 'guardar configuración por RPC')
  for (const { table, upsertRpc } of n6EntitySpecs) {
    const data = payloads[table]
    assertSuccess(
      await api.rpc(upsertRpc, { p_id: data.id, p_data: data, p_updated_at: now }),
      `${upsertRpc} legítima`
    )
  }
}

async function verifyOwnReads(api, organizationId) {
  for (const table of n6EditableTables) {
    const result = await api.from(table).select('organization_id').eq('organization_id', organizationId)
    const rows = assertSuccess(result, `lectura propia ${table}`)
    if (!rows || rows.length === 0) throw new Error(`lectura propia ${table}: no devolvió datos`)
  }
}

async function verifyCrossTenantReads(api, otherOrganizationId) {
  for (const table of n6EditableTables) {
    const result = await api.from(table).select('organization_id').eq('organization_id', otherOrganizationId)
    const rows = assertSuccess(result, `lectura cruzada ${table}`)
    if (rows?.length !== 0) throw new Error(`lectura cruzada ${table}: expuso datos de otra joyería`)
  }
}

async function verifyDirectWritesDenied(api, organizationId, payloads, prefix, now) {
  for (const table of n6EditableTables) {
    const id = `${prefix}-direct-${table}`
    const before = await readEditableRow(
      api,
      table,
      organizationId,
      payloads,
      `leer ${table} antes de escritura directa`
    )
    if (!before) throw new Error(`${table}: falta el registro protegido antes de la prueba directa`)

    const directCreate = table === 'org_settings'
      ? api
        .from(table)
        .upsert(rowFor(table, organizationId, id, now), { onConflict: 'organization_id' })
      : api.from(table).insert(rowFor(table, organizationId, id, now))
    assertRejectedWithCode(await directCreate, `insert/upsert directo ${table}`, '42501')

    const forbiddenTimestamp = '2099-12-31T23:59:59.000Z'
    let update = api
      .from(table)
      .update({
        data: { n6DirectWriteProbe: `${prefix}:${table}` },
        updated_at: forbiddenTimestamp,
      })
      .eq('organization_id', organizationId)
    let remove = api.from(table).delete().eq('organization_id', organizationId)
    if (table !== 'org_settings') {
      const storedId = payloads[table].id
      update = update.eq('id', storedId)
      remove = remove.eq('id', storedId)
    }
    assertDeniedOrFiltered(await update, `update directo ${table}`)
    const afterUpdate = await readEditableRow(
      api,
      table,
      organizationId,
      payloads,
      `leer ${table} después de update directo`
    )
    assertRowUnchanged(before, afterUpdate, `update directo ${table}`)

    assertDeniedOrFiltered(await remove, `delete directo ${table}`)
    const afterDelete = await readEditableRow(
      api,
      table,
      organizationId,
      payloads,
      `leer ${table} después de delete directo`
    )
    assertRowUnchanged(before, afterDelete, `delete directo ${table}`)
  }
}

async function readEntityRow(api, table, organizationId, id, label) {
  return assertSuccess(
    await api
      .from(table)
      .select('id, organization_id, data, updated_at')
      .eq('organization_id', organizationId)
      .eq('id', id)
      .maybeSingle(),
    label
  )
}

async function readEditableRow(api, table, organizationId, payloads, label) {
  if (table === 'org_settings') {
    return assertSuccess(
      await api
        .from(table)
        .select('organization_id, data, updated_at')
        .eq('organization_id', organizationId)
        .maybeSingle(),
      label
    )
  }
  return readEntityRow(api, table, organizationId, payloads[table].id, label)
}

async function verifyRpcCannotTargetOtherTenant(
  api,
  ownOrganizationId,
  otherApi,
  otherOrganizationId,
  otherPayloads
) {
  for (const { table, upsertRpc, deleteRpc } of n6EntitySpecs) {
    const data = otherPayloads[table]
    const before = await readEntityRow(
      otherApi,
      table,
      otherOrganizationId,
      data.id,
      `leer ${table} ajena antes de probar RPC`
    )
    if (!before) throw new Error(`${table}: falta el registro de la otra joyería`)

    const result = await api.rpc(upsertRpc, {
      p_id: data.id,
      p_data: data,
      p_updated_at: new Date().toISOString(),
      p_organization_id: otherOrganizationId,
    })
    assertRejectedWithCode(
      result,
      `${upsertRpc} con organization_id enviado por el navegador`,
      'PGRST202'
    )
    assertRejectedWithCode(
      await api.rpc(deleteRpc, { p_id: data.id, p_organization_id: otherOrganizationId }),
      `${deleteRpc} con organization_id enviado por el navegador`,
      'PGRST202'
    )

    const probeData = {
      ...data,
      n6IsolationProbe: `${ownOrganizationId}:${otherOrganizationId}`,
    }
    assertSuccess(
      await api.rpc(upsertRpc, {
        p_id: probeData.id,
        p_data: probeData,
        p_updated_at: new Date().toISOString(),
      }),
      `${upsertRpc} normal durante prueba de aislamiento`
    )

    const ownProbe = await readEntityRow(
      api,
      table,
      ownOrganizationId,
      data.id,
      `leer ${table} creada en la joyería llamadora`
    )
    if (!ownProbe || ownProbe.organization_id !== ownOrganizationId) {
      throw new Error(`${upsertRpc}: no guardó dentro de la joyería llamadora`)
    }
    if (ownProbe.data?.n6IsolationProbe !== probeData.n6IsolationProbe) {
      throw new Error(`${upsertRpc}: no conservó la marca de aislamiento`)
    }

    const afterUpsert = await readEntityRow(
      otherApi,
      table,
      otherOrganizationId,
      data.id,
      `leer ${table} ajena después de upsert`
    )
    if (!isDeepStrictEqual(afterUpsert, before)) {
      throw new Error(`${upsertRpc}: modificó el registro de otra joyería`)
    }

    assertSuccess(
      await api.rpc(deleteRpc, { p_id: data.id }),
      `${deleteRpc} normal durante prueba de aislamiento`
    )
    const ownAfterDelete = await readEntityRow(
      api,
      table,
      ownOrganizationId,
      data.id,
      `comprobar borrado propio de ${table}`
    )
    if (ownAfterDelete) throw new Error(`${deleteRpc}: no borró el registro propio de prueba`)

    const afterDelete = await readEntityRow(
      otherApi,
      table,
      otherOrganizationId,
      data.id,
      `leer ${table} ajena después de delete`
    )
    if (!isDeepStrictEqual(afterDelete, before)) {
      throw new Error(`${deleteRpc}: borró o alteró el registro de otra joyería`)
    }
  }
}

async function verifyAnonymous(api, ownerApi, organizationId, protectedPayloads, now) {
  for (const table of n6EditableTables) {
    const read = await api.from(table).select('*').limit(1)
    assertNoVisibleRows(read, `lectura anónima ${table}`)

    const before = await readEditableRow(
      ownerApi,
      table,
      organizationId,
      protectedPayloads,
      `leer ${table} antes de escritura anónima`
    )
    if (!before) throw new Error(`${table}: falta el registro protegido antes de la prueba anónima`)

    const directCreate = table === 'org_settings'
      ? api
        .from(table)
        .upsert(
          rowFor(table, organizationId, `anon-${table}`, now),
          { onConflict: 'organization_id' }
        )
      : api
        .from(table)
        .insert(rowFor(table, organizationId, `anon-${table}`, now))
    assertRejectedWithCode(
      await directCreate,
      `insert/upsert anónimo ${table}`,
      '42501'
    )

    let update = api
      .from(table)
      .update({
        data: { n6AnonymousWriteProbe: table },
        updated_at: '2099-12-31T23:59:59.000Z',
      })
      .eq('organization_id', organizationId)
    let remove = api.from(table).delete().eq('organization_id', organizationId)
    if (table !== 'org_settings') {
      const protectedId = protectedPayloads[table].id
      update = update.eq('id', protectedId)
      remove = remove.eq('id', protectedId)
    }
    assertDeniedOrFiltered(await update, `update anónimo ${table}`)
    const afterUpdate = await readEditableRow(
      ownerApi,
      table,
      organizationId,
      protectedPayloads,
      `leer ${table} después de update anónimo`
    )
    assertRowUnchanged(before, afterUpdate, `update anónimo ${table}`)

    assertDeniedOrFiltered(await remove, `delete anónimo ${table}`)
    const afterDelete = await readEditableRow(
      ownerApi,
      table,
      organizationId,
      protectedPayloads,
      `leer ${table} después de delete anónimo`
    )
    assertRowUnchanged(before, afterDelete, `delete anónimo ${table}`)
  }

  const payloads = validPayloads('n6-anon')
  for (const { table, upsertRpc, deleteRpc } of n6EntitySpecs) {
    const data = payloads[table]
    assertRejectedWithCode(
      await api.rpc(upsertRpc, { p_id: data.id, p_data: data, p_updated_at: now }),
      `sesión anónima llamó ${upsertRpc}`,
      '42501'
    )
    assertRejectedWithCode(
      await api.rpc(deleteRpc, { p_id: data.id }),
      `sesión anónima llamó ${deleteRpc}`,
      '42501'
    )
  }
  assertRejectedWithCode(
    await api.rpc('create_organization', { org_name: 'No permitida' }),
    'RPC anónima',
    '42501'
  )
}

async function verifyConcurrentNumbers(api) {
  const results = await Promise.all(Array.from({ length: 20 }, () => api.rpc('next_quote_number')))
  const numbers = results.map((result, index) => assertSuccess(result, `consecutivo concurrente ${index + 1}`))
  if (new Set(numbers).size !== numbers.length) throw new Error('El consecutivo produjo números duplicados.')
}

async function assertEntityAbsent(api, table, organizationId, id, label) {
  const row = await readEntityRow(api, table, organizationId, id, label)
  if (row) throw new Error(`${label}: el servidor guardó un registro rechazado`)
}

async function verifyMalformedPayloads(api, organizationId, now) {
  assertRejectedWithCode(
    await api.rpc('upsert_quote', {
      p_id: 'n6-invalid-quote',
      p_data: {
        id: 'n6-invalid-quote', number: 'ED-N6-INVALID', status: 'inventado',
        materialPricePerGram: -1, laborCost: 0, deposit: 0,
        stones: [], extraCosts: [], production: [], payments: [],
      },
      p_updated_at: now,
    }),
    'cotización inválida',
    '22023'
  )
  assertRejectedWithCode(
    await api.rpc('upsert_appointment', {
      p_id: 'n6-invalid-appointment',
      p_data: { id: 'n6-invalid-appointment', status: 'inventado', durationMinutes: 0 },
      p_updated_at: now,
    }),
    'cita inválida',
    '22023'
  )

  const overusedId = 'n6-invalid-material-overuse'
  assertRejectedWithCode(
    await api.rpc('upsert_material_lot', {
      p_id: overusedId,
      p_data: {
        id: overusedId,
        grams: 10,
        myGrams: 6,
        costCop: 1000000,
        uses: [
          { id: 'n6-use-1', date: '2026-07-25', grams: 7, notes: '' },
          { id: 'n6-use-2', date: '2026-07-25', grams: 7, notes: '' },
        ],
      },
      p_updated_at: now,
    }),
    'lote de 10 g con salidas de 14 g',
    '22023'
  )
  await assertEntityAbsent(
    api,
    'material_lots',
    organizationId,
    overusedId,
    'lote con sobreuso'
  )

  const missingUsesId = 'n6-invalid-material-without-uses'
  assertRejectedWithCode(
    await api.rpc('upsert_material_lot', {
      p_id: missingUsesId,
      p_data: {
        id: missingUsesId,
        grams: 10,
        myGrams: 10,
        costCop: 1000000,
      },
      p_updated_at: now,
    }),
    'lote de material sin arreglo uses',
    '22023'
  )
  await assertEntityAbsent(
    api,
    'material_lots',
    organizationId,
    missingUsesId,
    'lote sin uses'
  )

  const missingConceptId = 'n6-invalid-expense-without-concept'
  const invalidExpense = {
    ...validPayloads('n6-invalid').expenses,
    id: missingConceptId,
  }
  delete invalidExpense.concept
  assertRejectedWithCode(
    await api.rpc('upsert_expense', {
      p_id: missingConceptId,
      p_data: invalidExpense,
      p_updated_at: now,
    }),
    'gasto sin concepto',
    '22023'
  )
  await assertEntityAbsent(api, 'expenses', organizationId, missingConceptId, 'gasto sin concepto')

  const invalidShareId = 'n6-invalid-expense-share'
  assertRejectedWithCode(
    await api.rpc('upsert_expense', {
      p_id: invalidShareId,
      p_data: {
        ...validPayloads('n6-invalid-share').expenses,
        id: invalidShareId,
        partnerId: 'soc-1',
        partnerName: 'Socio',
        myPercent: 101,
      },
      p_updated_at: now,
    }),
    'gasto con porcentaje mayor a 100',
    '22023'
  )
  await assertEntityAbsent(api, 'expenses', organizationId, invalidShareId, 'gasto con porcentaje invalido')

  const protectedStone = {
    ...validPayloads('n6-protected-stone-share').stone_lots,
    partnerId: 'soc-n6',
    partnerName: 'Socio N6',
    myPercent: 60,
  }
  assertSuccess(
    await api.rpc('upsert_stone_lot', {
      p_id: protectedStone.id,
      p_data: protectedStone,
      p_updated_at: now,
    }),
    'lote compartido valido antes de probar porcentajes'
  )
  const stoneBefore = await readEntityRow(
    api,
    'stone_lots',
    organizationId,
    protectedStone.id,
    'leer lote compartido antes de porcentajes invalidos'
  )
  if (!stoneBefore) throw new Error('falta el lote compartido protegido')

  for (const invalidPercent of [-1, 101, 60.5]) {
    assertRejectedWithCode(
      await api.rpc('upsert_stone_lot', {
        p_id: protectedStone.id,
        p_data: { ...protectedStone, myPercent: invalidPercent },
        p_updated_at: now,
      }),
      `lote de piedras con porcentaje invalido ${invalidPercent}`,
      '22023'
    )
    const stoneAfter = await readEntityRow(
      api,
      'stone_lots',
      organizationId,
      protectedStone.id,
      `leer lote despues de porcentaje invalido ${invalidPercent}`
    )
    assertRowUnchanged(
      stoneBefore,
      stoneAfter,
      `porcentaje invalido de piedras ${invalidPercent}`
    )
  }

  const settingsPayloads = validPayloads('n6-settings-guard')
  const settingsBefore = await readEditableRow(
    api,
    'org_settings',
    organizationId,
    settingsPayloads,
    'leer configuracion antes de campos B3 invalidos'
  )
  if (!settingsBefore) throw new Error('falta la configuracion protegida')
  for (const [label, invalidSettings] of [
    ['tipos de producto duplicados', {
      ...settingsBefore.data,
      productTypes: [
        { name: 'Anillo', active: true },
        { name: ' anillo ', active: false },
      ],
    }],
    ['ultima tasa menor al minimo', { ...settingsBefore.data, lastKnownUsdRate: 999 }],
    ['ultima tasa mayor al maximo', { ...settingsBefore.data, lastKnownUsdRate: 20001 }],
  ]) {
    assertRejectedWithCode(
      await api.rpc('upsert_settings', { p_data: invalidSettings, p_updated_at: now }),
      `configuracion con ${label}`,
      '22023'
    )
    const settingsAfter = await readEditableRow(
      api,
      'org_settings',
      organizationId,
      settingsPayloads,
      `leer configuracion despues de ${label}`
    )
    assertRowUnchanged(settingsBefore, settingsAfter, `configuracion con ${label}`)
  }

  const immutableStoneSale = protectedStone.sales[0]
  const immutableBuyerPayment = immutableStoneSale.payments[0]
  for (const [label, invalidSales] of [
    ['tipo de producto no textual', [{ ...immutableStoneSale, productType: 7 }]],
    ['tasa de venta fuera de rango', [{ ...immutableStoneSale, usdRate: 999 }]],
    ['cambio de tasa de venta', [{ ...immutableStoneSale, usdRate: 4300 }]],
    ['cambio de tasa de abono', [{
      ...immutableStoneSale,
      payments: [{ ...immutableBuyerPayment, usdRate: 4300 }],
    }]],
  ]) {
    assertRejectedWithCode(
      await api.rpc('upsert_stone_lot', {
        p_id: protectedStone.id,
        p_data: { ...protectedStone, sales: invalidSales },
        p_updated_at: now,
      }),
      `lote con ${label}`,
      '22023'
    )
    const stoneAfter = await readEntityRow(
      api,
      'stone_lots',
      organizationId,
      protectedStone.id,
      `leer lote despues de ${label}`
    )
    assertRowUnchanged(stoneBefore, stoneAfter, `lote con ${label}`)
  }

  const historicalStone = {
    ...validPayloads('n6-historical-stone-rate').stone_lots,
    sales: [{
      ...validPayloads('n6-historical-stone-rate').stone_lots.sales[0],
      usdRate: null,
      payments: [{
        ...validPayloads('n6-historical-stone-rate').stone_lots.sales[0].payments[0],
        usdRate: null,
      }],
    }],
  }
  assertSuccess(
    await api.rpc('upsert_stone_lot', {
      p_id: historicalStone.id,
      p_data: historicalStone,
      p_updated_at: now,
    }),
    'guardar lote historico sin tasas'
  )
  const historicalStoneBefore = await readEntityRow(
    api,
    'stone_lots',
    organizationId,
    historicalStone.id,
    'leer lote historico antes de intentar completar tasas'
  )
  for (const [label, changedSale] of [
    ['venta', { ...historicalStone.sales[0], usdRate: 4200 }],
    ['abono', {
      ...historicalStone.sales[0],
      payments: [{ ...historicalStone.sales[0].payments[0], usdRate: 4200 }],
    }],
  ]) {
    assertRejectedWithCode(
      await api.rpc('upsert_stone_lot', {
        p_id: historicalStone.id,
        p_data: { ...historicalStone, sales: [changedSale] },
        p_updated_at: now,
      }),
      `lote historico que intenta completar tasa de ${label}`,
      '22023'
    )
    const historicalStoneAfter = await readEntityRow(
      api,
      'stone_lots',
      organizationId,
      historicalStone.id,
      `leer lote historico despues de completar tasa de ${label}`
    )
    assertRowUnchanged(
      historicalStoneBefore,
      historicalStoneAfter,
      `tasa historica de ${label} inmutable`
    )
  }

  const protectedJewel = validPayloads('n6-protected-jewel-rate').stock_jewels
  assertSuccess(
    await api.rpc('upsert_stock_jewel', {
      p_id: protectedJewel.id,
      p_data: protectedJewel,
      p_updated_at: now,
    }),
    'guardar joya con tasa valida'
  )
  const jewelBefore = await readEntityRow(
    api,
    'stock_jewels',
    organizationId,
    protectedJewel.id,
    'leer joya antes de alterar campos B3'
  )
  for (const [label, invalidSale] of [
    ['tipo de producto no textual', { ...protectedJewel.sale, productType: false }],
    ['tasa fuera de rango', { ...protectedJewel.sale, usdRate: 20001 }],
    ['cambio de tasa', { ...protectedJewel.sale, usdRate: 4300 }],
  ]) {
    assertRejectedWithCode(
      await api.rpc('upsert_stock_jewel', {
        p_id: protectedJewel.id,
        p_data: { ...protectedJewel, sale: invalidSale },
        p_updated_at: now,
      }),
      `joya con ${label}`,
      '22023'
    )
    const jewelAfter = await readEntityRow(
      api,
      'stock_jewels',
      organizationId,
      protectedJewel.id,
      `leer joya despues de ${label}`
    )
    assertRowUnchanged(jewelBefore, jewelAfter, `joya con ${label}`)
  }

  const historicalJewel = {
    ...validPayloads('n6-historical-jewel-rate').stock_jewels,
    sale: {
      ...validPayloads('n6-historical-jewel-rate').stock_jewels.sale,
      usdRate: null,
    },
  }
  assertSuccess(
    await api.rpc('upsert_stock_jewel', {
      p_id: historicalJewel.id,
      p_data: historicalJewel,
      p_updated_at: now,
    }),
    'guardar joya historica sin tasa'
  )
  const historicalJewelBefore = await readEntityRow(
    api,
    'stock_jewels',
    organizationId,
    historicalJewel.id,
    'leer joya historica antes de completar tasa'
  )
  assertRejectedWithCode(
    await api.rpc('upsert_stock_jewel', {
      p_id: historicalJewel.id,
      p_data: {
        ...historicalJewel,
        sale: { ...historicalJewel.sale, usdRate: 4200 },
      },
      p_updated_at: now,
    }),
    'joya historica que intenta completar tasa',
    '22023'
  )
  const historicalJewelAfter = await readEntityRow(
    api,
    'stock_jewels',
    organizationId,
    historicalJewel.id,
    'leer joya historica despues de completar tasa'
  )
  assertRowUnchanged(
    historicalJewelBefore,
    historicalJewelAfter,
    'tasa historica de joya inmutable'
  )

  const historicalExpense = {
    ...validPayloads('n6-historical-expense-rate').expenses,
    usdRate: null,
  }
  assertSuccess(
    await api.rpc('upsert_expense', {
      p_id: historicalExpense.id,
      p_data: historicalExpense,
      p_updated_at: now,
    }),
    'guardar gasto historico sin tasa'
  )
  const expenseBefore = await readEntityRow(
    api,
    'expenses',
    organizationId,
    historicalExpense.id,
    'leer gasto historico antes de alterar tasa'
  )
  for (const invalidRate of [999, 20001, 4200]) {
    assertRejectedWithCode(
      await api.rpc('upsert_expense', {
        p_id: historicalExpense.id,
        p_data: { ...historicalExpense, usdRate: invalidRate },
        p_updated_at: now,
      }),
      `gasto historico con tasa ${invalidRate}`,
      '22023'
    )
    const expenseAfter = await readEntityRow(
      api,
      'expenses',
      organizationId,
      historicalExpense.id,
      `leer gasto despues de tasa ${invalidRate}`
    )
    assertRowUnchanged(expenseBefore, expenseAfter, `gasto con tasa ${invalidRate}`)
  }
}

async function cleanupN6(admin, apis, organizations, users) {
  const errors = []

  for (const [index, api] of apis.entries()) {
    const result = await api.auth.signOut({ scope: 'global' })
    if (result.error) errors.push(`cerrar sesión ${index + 1}: ${result.error.message}`)
  }

  if (organizations.length > 0) {
    const deletion = await admin.from('organizations').delete().in('id', organizations)
    if (deletion.error) errors.push(`borrar joyerías: ${deletion.error.message}`)

    const remaining = await admin.from('organizations').select('id').in('id', organizations)
    if (remaining.error) {
      errors.push(`comprobar joyerías borradas: ${remaining.error.message}`)
    } else if (remaining.data?.length) {
      errors.push(`quedaron ${remaining.data.length} joyerías de prueba`)
    }
  }

  for (const [index, user] of users.entries()) {
    const result = await admin.auth.admin.deleteUser(user.id)
    if (result.error) errors.push(`borrar usuario ${index + 1}: ${result.error.message}`)
  }

  if (errors.length > 0) {
    throw new Error(`Limpieza N6 incompleta: ${errors.join(' | ')}`)
  }
}

export async function runN6(env = process.env) {
  // Una ejecución nueva nunca puede heredar un resultado verde anterior.
  rmSync(evidencePath, { force: true })
  const config = validateN6Environment(env)
  const candidate = readCandidateGitState()
  const admin = client(config.url, config.secretKey)
  const anonymous = client(config.url, config.publishableKey)
  const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const password = `N6-${crypto.randomUUID()}-Aa1!`
  const users = []
  const organizations = []
  const apis = []
  const startedAt = Date.now()
  let evidence
  let executionError

  try {
    for (const label of ['a', 'b']) {
      const email = `n6-${label}-${nonce}@example.invalid`
      const created = assertSuccess(await admin.auth.admin.createUser({ email, password, email_confirm: true }), `crear usuario ${label}`)
      users.push({ id: created.user.id, email })
    }

    for (const [index, user] of users.entries()) {
      const api = client(config.url, config.publishableKey)
      assertSuccess(await api.auth.signInWithPassword({ email: user.email, password }), `ingreso usuario ${index + 1}`)
      apis.push(api)
      const organizationId = assertSuccess(await api.rpc('create_organization', { org_name: `N6 ${index + 1} ${nonce}` }), `crear joyería ${index + 1}`)
      organizations.push(organizationId)
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
    await verifyDirectWritesDenied(apis[0], organizations[0], payloadA, 'n6-a', now)
    await verifyDirectWritesDenied(apis[1], organizations[1], payloadB, 'n6-b', now)
    await verifyRpcCannotTargetOtherTenant(
      apis[0],
      organizations[0],
      apis[1],
      organizations[1],
      payloadB
    )
    await verifyRpcCannotTargetOtherTenant(
      apis[1],
      organizations[1],
      apis[0],
      organizations[0],
      payloadA
    )
    assertRejectedWithCode(
      await apis[0].from('memberships').insert({
        user_id: users[0].id, organization_id: organizations[1], role: 'owner',
      }),
      'membresía ajena',
      '42501'
    )
    await verifyAnonymous(anonymous, apis[0], organizations[0], payloadA, now)
    await verifyConcurrentNumbers(apis[0])
    await verifyMalformedPayloads(apis[0], organizations[0], now)

    evidence = {
      checkedAt: new Date().toISOString(),
      commit: candidate.commit,
      branch: candidate.branch,
      projectRef: config.projectRef,
      projectName: config.projectName,
      durationMs: 0,
      checks: {
        twoOrganizations: true,
        exactCandidateCommit: true,
        elevenEditableTablesCovered: n6EditableTables.length === 11,
        ownReads: true,
        crossTenantReadsBlocked: true,
        directWritesBlocked: true,
        rpcCannotChooseOrganization: true,
        rpcStaysInCallerOrganization: true,
        foreignMembershipBlocked: true,
        anonymousAccessBlocked: true,
        anonymousEntityRpcsBlocked: true,
        concurrentNumbersUnique: true,
        malformedPayloadsBlocked: true,
        materialOveruseBlocked: true,
        missingMaterialUsesBlocked: true,
        invalidStoneSharesBlocked: true,
        invalidProductTypesBlocked: true,
        invalidUsdRatesBlocked: true,
        immutableUsdRatesBlocked: true,
      },
    }
  } catch (error) {
    executionError = error
  }

  let cleanupError
  try {
    await cleanupN6(admin, apis, organizations, users)
  } catch (error) {
    cleanupError = error
  }

  if (executionError && cleanupError) {
    throw new AggregateError(
      [executionError, cleanupError],
      'N6 falló y además no pudo completar la limpieza'
    )
  }
  if (executionError) throw executionError
  if (cleanupError) throw cleanupError

  evidence.checks.cleanupVerified = true
  evidence.durationMs = Date.now() - startedAt
  assertAllChecksPassed(evidence.checks)
  mkdirSync(evidenceDirectory, { recursive: true })
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')
  return evidence
}

function describeError(error) {
  if (error instanceof AggregateError) {
    const causes = error.errors.map((cause, index) => {
      const message = cause instanceof Error ? cause.message : String(cause)
      return `causa ${index + 1}: ${message}`
    })
    return `${error.message}\n${causes.join('\n')}`
  }
  return error instanceof Error ? error.message : 'error desconocido'
}

async function main() {
  const evidence = await runN6()
  console.log(`N6 aprobado: ${Object.keys(evidence.checks).length} controles en ${evidence.durationMs} ms.`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`N6 detenido: ${describeError(error)}`)
    process.exitCode = 1
  })
}
