import { describe, expect, it } from 'vitest'
import schemaSource from '../../../supabase/migrations/0001_esquema.sql?raw'
import rlsSource from '../../../supabase/migrations/0002_rls.sql?raw'
import functionsSource from '../../../supabase/migrations/0003_funciones.sql?raw'
import hardeningSource from '../../../supabase/migrations/20260718200036_harden_cloud_writes.sql?raw'
import grantClosureSource from '../../../supabase/migrations/20260718212000_close_authenticated_table_grants.sql?raw'
import inventorySource from '../../../supabase/migrations/20260721210000_inventario_compradores_y_joyas.sql?raw'
import materialsSource from '../../../supabase/migrations/20260724210000_inventario_materiales.sql?raw'
import materialValidationFixSource from '../../../supabase/migrations/20260725150651_validar_suma_usos_material.sql?raw'
import expensesSource from '../../../supabase/migrations/20260803205711_gastos_negocio.sql?raw'
import stonePartnershipsSource from '../../../supabase/migrations/20260803220000_sociedades_lotes_piedras.sql?raw'
import productCurrencySource from '../../../supabase/migrations/20260803233000_tipo_producto_moneda.sql?raw'
import cuttingBatchesSource from '../../../supabase/migrations/20260804144748_fase_c1_tandas_talla.sql?raw'
import materialValidationInstructionsSource from '../../../docs/SQL_PRODUCCION_CORRECCION_VALIDACION_MATERIALES.md?raw'

const schema = schemaSource.toLowerCase()
const rls = rlsSource.toLowerCase()
const functions = functionsSource.toLowerCase()
const hardening = hardeningSource.toLowerCase()
const grantClosure = grantClosureSource.toLowerCase()
const inventory = inventorySource.toLowerCase()
const materials = materialsSource.toLowerCase()
const materialValidationFix = materialValidationFixSource.toLowerCase()
const expenses = expensesSource.toLowerCase()
const stonePartnerships = stonePartnershipsSource.toLowerCase()
const productCurrency = productCurrencySource.toLowerCase()
const cuttingBatches = cuttingBatchesSource.toLowerCase()

const tables = [
  'organizations',
  'memberships',
  'org_settings',
  'org_counters',
  'clients',
  'quotes',
  'appointments',
  'stone_lots',
  'suppliers',
]

const editableTables = ['org_settings', 'clients', 'quotes', 'appointments', 'stone_lots', 'suppliers']

describe('migraciones de nube', () => {
  it('C1 protege tandas, orígenes e inventarios sin reescribir tablas ni datos', () => {
    expect(cuttingBatches).toContain('function private.assert_stone_lot_cutting_payload')
    expect(cuttingBatches).toContain("set search_path = ''")
    expect(cuttingBatches).toContain("':stone_lots:' || p_id")
    expect(cuttingBatches).toContain('for update')
    expect(cuttingBatches).toContain("p_data ? 'cuttingbatches'")
    expect(cuttingBatches).toContain('stone cutting cannot predate purchase')
    expect(cuttingBatches).toContain("batch->>'sentdate') < (p_data->>'purchasedate")
    expect(cuttingBatches).toContain("coalesce(sale->>'origin', 'bruto')")
    expect(cuttingBatches).toContain("not in ('bruto', 'tallado')")
    expect(cuttingBatches).toContain('raw stone inventory exceeded')
    expect(cuttingBatches).toContain('cut stone inventory exceeded')
    expect(cuttingBatches).toContain('round(v_sent_carats, 3)')
    expect(cuttingBatches).toContain('returned cutting inventory is immutable')
    expect(cuttingBatches).toContain("batch->>'returnedcarats'")
    expect(cuttingBatches).not.toContain("returnedquantity')::numeric > (batch->>'sentquantity")
    expect(cuttingBatches).toContain(
      'revoke all on function private.assert_stone_lot_cutting_payload'
    )
    expect(cuttingBatches).toContain(
      'grant execute on function public.upsert_stone_lot(text, jsonb, timestamptz) to authenticated'
    )
    expect(cuttingBatches).not.toMatch(/\b(create|alter|drop)\s+table\b/)
    expect(cuttingBatches).not.toContain('create policy')
    expect(cuttingBatches).not.toContain('p_organization_id')
  })

  it('crea todas las tablas y activa RLS en cada una', () => {
    for (const table of tables) {
      expect(schema).toContain(`create table public.${table}`)
      expect(rls).toContain(`alter table public.${table} enable row level security`)
    }
  })

  it('define permisos separados por operacion para cada tabla editable', () => {
    for (const table of editableTables) {
      for (const operation of ['select', 'insert', 'update', 'delete']) {
        expect(rls).toContain(`create policy ${table}_${operation}_member`)
      }
    }
    expect(rls.match(/with check/g)?.length).toBeGreaterThanOrEqual(editableTables.length * 2)
  })

  it('no permite modificar membresias ni el contador directamente', () => {
    expect(rls).toContain('create policy memberships_select_self')
    expect(rls).not.toMatch(/create policy memberships_(insert|update|delete)/)
    expect(schema).toContain('revoke all on table public.org_counters from authenticated')
  })

  it('incluye permisos explicitos para proyectos nuevos sin abrir acceso anonimo', () => {
    expect(schema).toContain('revoke all on table public.organizations')
    expect(schema).toContain('from anon')
    expect(schema).toContain('grant select, insert, update, delete on table public.org_settings')
  })

  it('deja las lecturas directas y obliga todas las escrituras a pasar por RPC', () => {
    expect(hardening).toContain(
      'revoke insert, update, delete on table public.org_settings, public.clients,'
    )
    expect(hardening).toContain('public.stone_lots, public.suppliers from authenticated')
    expect(hardening).toContain(
      'grant select on table public.org_settings, public.clients, public.quotes,'
    )
    expect(hardening).toContain('revoke select, insert, update, delete on tables from anon, authenticated, service_role')
    expect(hardening).toContain('revoke execute on functions from public, anon, authenticated, service_role')
    for (const table of editableTables) {
      for (const operation of ['insert', 'update', 'delete']) {
        expect(hardening).toContain(`drop policy if exists ${table}_${operation}_member`)
      }
    }
  })

  it('retira todos los permisos de tabla sobrantes antes de reabrir solo lecturas', () => {
    expect(grantClosure).toContain(
      'revoke all privileges on table public.organizations, public.memberships,'
    )
    expect(grantClosure).toContain('public.stone_lots, public.suppliers from authenticated')
    expect(grantClosure).toContain(
      'grant select on table public.organizations, public.memberships, public.org_settings,'
    )
    expect(grantClosure).not.toMatch(/grant\s+(insert|update|delete|truncate|references|trigger)/)
  })

  it('valida identidad, fechas, estados y dinero critico dentro de la base de datos', () => {
    expect(hardening).toContain('function private.assert_entity_payload')
    expect(hardening).toContain("p_data->>'id' <> p_id")
    expect(hardening).toContain("interval '1 day'")
    expect(hardening).toContain("'borrador', 'pendiente', 'aprobada', 'rechazada', 'vencida'")
    expect(hardening).toContain("'programada', 'cumplida', 'cancelada', 'noasistio'")
    expect(hardening).toContain('function private.is_nonnegative_integer')
    expect(hardening).toContain("p_data->'purchasevaluecop'")
    expect(hardening).toContain("p_data->'deposit'")
  })

  it('protege todas las funciones elevadas y valida la sesion dentro de ellas', () => {
    expect(functions).toContain("set search_path = ''")
    expect(functions).toContain('auth.uid()')
    expect(functions).toContain('revoke all on schema private from public, anon, authenticated')

    const names = [
      'create_organization', 'next_quote_number', 'upsert_settings', 'upsert_client',
      'upsert_quote', 'upsert_appointment', 'upsert_stone_lot', 'upsert_supplier',
      'delete_settings', 'delete_client', 'delete_quote', 'delete_appointment',
      'delete_stone_lot', 'delete_supplier',
    ]
    for (const name of names) {
      expect(functions).toContain(`function public.${name}`)
      expect(functions).toContain(`grant execute on function public.${name}`)
    }
  })
})

describe('migracion de inventario: compradores y joyas en stock', () => {
  const newTables = ['buyers', 'stock_jewels']

  it('crea las tablas nuevas sin destruir nada de la base viva', () => {
    for (const table of newTables) {
      expect(inventory).toContain(`create table if not exists public.${table}`)
    }
    // Es la garantia de que se puede pegar sobre produccion con datos reales.
    expect(inventory).not.toMatch(/drop\s+table/)
    expect(inventory).not.toMatch(/drop\s+column/)
    expect(inventory).not.toMatch(/truncate/)
    expect(inventory).not.toMatch(/delete\s+from\s+public\.(clients|quotes|stone_lots|suppliers|org_settings)/)
  })

  it('activa RLS y solo permite LEER directamente cada tabla nueva', () => {
    for (const table of newTables) {
      expect(inventory).toContain(`alter table public.${table} enable row level security`)
      expect(inventory).toContain(`create policy ${table}_select_member`)
      // Ninguna politica de escritura directa: todo pasa por RPC protegida.
      expect(inventory).not.toContain(`create policy ${table}_insert_member`)
      expect(inventory).not.toContain(`create policy ${table}_update_member`)
      expect(inventory).not.toContain(`create policy ${table}_delete_member`)
    }
  })

  it('abre solo la lectura al navegador y cierra el acceso anonimo', () => {
    expect(inventory).toContain('grant select on table public.buyers, public.stock_jewels to authenticated')
    expect(inventory).toContain('revoke all on table public.buyers, public.stock_jewels from anon')
    expect(inventory).toContain(
      'revoke insert, update, delete on table public.buyers, public.stock_jewels from authenticated'
    )
  })

  it('protege las funciones nuevas y resuelve la organizacion en el servidor', () => {
    const names = ['upsert_buyer', 'upsert_stock_jewel', 'delete_buyer', 'delete_stock_jewel']
    for (const name of names) {
      expect(inventory).toContain(`function public.${name}`)
      expect(inventory).toContain(`grant execute on function public.${name}`)
      expect(inventory).toContain(`revoke all on function public.${name}`)
    }
    expect(inventory).toContain("set search_path = ''")
    expect(inventory).toContain('private.current_organization_id_for_roles')
    // Jamas se acepta un organization_id enviado por el navegador.
    expect(inventory).not.toContain('p_organization_id')
  })

  it('valida en la base el dinero de las joyas y de los abonos del comprador', () => {
    expect(inventory).toContain('function private.assert_stock_jewel_payload')
    expect(inventory).toContain("p_data->'costcop'")
    expect(inventory).toContain("p_data->'pricecop'")
    expect(inventory).toContain("'disponible', 'apartada'")
    // Los abonos del comprador (D-042) tambien son dinero validado en servidor.
    expect(inventory).toContain('function private.assert_stone_lot_payload')
    expect(inventory).toContain("sale->'payments'")
  })
})

describe('migracion de inventario de materiales: socios y lotes', () => {
  const newTables = ['material_partners', 'material_lots']

  it('crea las tablas nuevas sin destruir nada de la base viva', () => {
    for (const table of newTables) {
      expect(materials).toContain(`create table if not exists public.${table}`)
    }
    expect(materials).not.toMatch(/drop\s+table/)
    expect(materials).not.toMatch(/drop\s+column/)
    expect(materials).not.toMatch(/truncate/)
    expect(materials).not.toMatch(/delete\s+from\s+public\.(clients|quotes|stone_lots|suppliers|buyers|stock_jewels|org_settings)/)
  })

  it('activa RLS y solo permite LEER directamente cada tabla nueva', () => {
    for (const table of newTables) {
      expect(materials).toContain(`alter table public.${table} enable row level security`)
      expect(materials).toContain(`create policy ${table}_select_member`)
      expect(materials).not.toContain(`create policy ${table}_insert_member`)
      expect(materials).not.toContain(`create policy ${table}_update_member`)
      expect(materials).not.toContain(`create policy ${table}_delete_member`)
    }
  })

  it('abre solo la lectura al navegador y cierra el acceso anonimo', () => {
    expect(materials).toContain('grant select on table public.material_partners, public.material_lots to authenticated')
    expect(materials).toContain('revoke all on table public.material_partners, public.material_lots from anon')
    expect(materials).toContain(
      'revoke insert, update, delete on table public.material_partners, public.material_lots from authenticated'
    )
  })

  it('protege las funciones nuevas y resuelve la organizacion en el servidor', () => {
    const names = [
      'upsert_material_partner',
      'upsert_material_lot',
      'delete_material_partner',
      'delete_material_lot'
    ]
    for (const name of names) {
      expect(materials).toContain(`function public.${name}`)
      expect(materials).toContain(`grant execute on function public.${name}`)
      expect(materials).toContain(`revoke all on function public.${name}`)
    }
    expect(materials).toContain("set search_path = ''")
    expect(materials).toContain('private.current_organization_id_for_roles')
    expect(materials).not.toContain('p_organization_id')
  })

  it('valida en la base los gramos, el costo y que mi parte no supere el lote', () => {
    expect(materials).toContain('function private.assert_material_lot_payload')
    expect(materials).toContain("p_data->'grams'")
    expect(materials).toContain("p_data->'mygrams'")
    expect(materials).toContain("p_data->'costcop'")
    // Mi parte nunca puede ser mayor que los gramos del lote.
    expect(materials).toContain("(p_data->>'mygrams')::numeric > (p_data->>'grams')::numeric")
  })
})

describe('migracion correctiva de validacion de materiales', () => {
  it('reemplaza solo el validador privado sin tocar tablas ni datos', () => {
    expect(materialValidationFix).toContain(
      'create or replace function private.assert_material_lot_payload'
    )
    expect(materialValidationFix).toContain('security invoker')
    expect(materialValidationFix).toContain("set search_path = ''")
    expect(materialValidationFix).toContain(
      'revoke all on function private.assert_material_lot_payload'
    )
    expect(materialValidationFix).not.toMatch(
      /grant\s+execute\s+on\s+function\s+private\.assert_material_lot_payload/
    )
    expect(materialValidationFix).not.toMatch(/drop\s+(table|column)/)
    expect(materialValidationFix).not.toMatch(/truncate/)
    expect(materialValidationFix).not.toMatch(/\b(insert|update|delete)\s+(into|from|public\.)/)
  })

  it('contiene la regla que N6 ejerce con un lote de 10 g y salidas de 14 g', () => {
    // La suma se hace con numeric en PostgreSQL y se compara contra los gramos
    // comprados. N6 prueba el caso real uses=[7, 7] contra grams=10.
    expect(materialValidationFix).toMatch(
      /coalesce\(sum\(\(item->>'grams'\)::numeric\),\s*0::numeric\)/
    )
    expect(materialValidationFix).toMatch(
      /into\s+v_used_grams\s+from\s+jsonb_array_elements\(p_data->'uses'\)\s+item/
    )
    expect(materialValidationFix).toMatch(
      /if\s+v_used_grams\s*>\s*\(p_data->>'grams'\)::numeric\s+then/
    )
    expect(materialValidationFix).toContain('material lot uses exceed available grams')
    expect(materialValidationFix).toContain("errcode = '22023'")
  })

  it('tambien rechaza uses ausente, nulo o con una forma distinta de arreglo', () => {
    expect(materialValidationFix).toContain(
      "jsonb_typeof(p_data->'uses') is distinct from 'array'"
    )
  })

  it('mantiene el texto para SQL Editor identico a la migracion versionada', () => {
    const sqlBlock = materialValidationInstructionsSource.match(/```sql\s*([\s\S]*?)```/i)
    expect(sqlBlock?.[1].trim()).toBe(materialValidationFixSource.trim())
  })
})

describe('migracion de gastos del negocio (B1)', () => {
  it('crea una tabla aditiva sin destruir datos existentes', () => {
    expect(expenses).toContain('create table if not exists public.expenses')
    expect(expenses).toContain('create index if not exists expenses_org_updated')
    expect(expenses).not.toMatch(/drop\s+table/)
    expect(expenses).not.toMatch(/drop\s+column/)
    expect(expenses).not.toMatch(/truncate/)
    expect(expenses).not.toMatch(/delete\s+from\s+public\.(clients|quotes|stone_lots|suppliers|buyers|stock_jewels|material_lots|org_settings)/)
  })

  it('activa RLS y expone solo lectura autenticada por la API', () => {
    expect(expenses).toContain('alter table public.expenses enable row level security')
    expect(expenses).toContain('create policy expenses_select_member')
    expect(expenses).not.toContain('create policy expenses_insert_member')
    expect(expenses).not.toContain('create policy expenses_update_member')
    expect(expenses).not.toContain('create policy expenses_delete_member')
    expect(expenses).toContain('revoke all on table public.expenses from anon')
    expect(expenses).toContain('revoke insert, update, delete on table public.expenses from authenticated')
    expect(expenses).toContain('grant select on table public.expenses to authenticated')
    expect(expenses).toContain('grant select, insert, update, delete on table public.expenses to service_role')
  })

  it('protege las RPC y resuelve la organizacion exclusivamente en servidor', () => {
    for (const name of ['upsert_expense', 'delete_expense']) {
      expect(expenses).toContain(`function public.${name}`)
      expect(expenses).toContain(`revoke all on function public.${name}`)
      expect(expenses).toContain(`grant execute on function public.${name}`)
    }
    expect(expenses).toContain("set search_path = ''")
    expect(expenses).toContain('private.current_organization_id_for_roles')
    expect(expenses).not.toContain('p_organization_id')
  })

  it('valida en servidor fecha, COP, trazabilidad y reparto 0..100', () => {
    expect(expenses).toContain('function private.assert_expense_payload')
    expect(expenses).toContain('select coalesce(')
    expect(expenses).toContain("p_data->'date'")
    expect(expenses).toContain("p_data->'amountcop'")
    expect(expenses).toContain("p_data->'method'")
    expect(expenses).toContain("p_data->'paidby'")
    expect(expenses).toContain("p_data->'partnername'")
    expect(expenses).toContain("p_data->'mypercent'")
    expect(expenses).toContain('v_my_percent > 100')
    expect(expenses).toContain('v_my_percent <> 100')
    expect(expenses).toContain("errcode = '22023'")
    expect(expenses).toContain('revoke all on function private.assert_expense_payload')
  })

  it('valida también la lista administrada de categorías en org_settings', () => {
    expect(expenses).toContain('create or replace function private.assert_settings_payload')
    expect(expenses).toContain("p_data->'expensecategories'")
    expect(expenses).toContain("item->'active'")
    expect(expenses).toContain("group by lower(btrim(item->>'name'))")
  })
})

describe('migracion de sociedades en lotes de piedras (B2)', () => {
  it('reemplaza solo el validador privado sin tocar tablas, RLS ni datos', () => {
    expect(stonePartnerships).toContain(
      'create or replace function private.assert_stone_lot_payload'
    )
    expect(stonePartnerships).toContain('security invoker')
    expect(stonePartnerships).toContain("set search_path = ''")
    expect(stonePartnerships).toContain(
      'revoke all on function private.assert_stone_lot_payload'
    )
    expect(stonePartnerships).not.toMatch(/create\s+table/)
    expect(stonePartnerships).not.toMatch(/drop\s+(table|column|policy)/)
    expect(stonePartnerships).not.toMatch(/truncate/)
    expect(stonePartnerships).not.toMatch(/\b(insert|update|delete)\s+(into|from|public\.)/)
    expect(stonePartnerships).not.toMatch(/create\s+policy/)
  })

  it('mantiene las validaciones existentes de costo, ventas, credito y pagos', () => {
    expect(stonePartnerships).toContain("p_data->'purchasevaluecop'")
    expect(stonePartnerships).toContain("p_data->'quantity'")
    expect(stonePartnerships).toContain("p_data->'supplierpayments'")
    expect(stonePartnerships).toContain("p_data->'sales'")
    expect(stonePartnerships).toContain("item->'amount'")
    expect(stonePartnerships).toContain("item->'valuecop'")
    expect(stonePartnerships).toContain("sale->'payments'")
  })

  it('acepta lotes antiguos y valida sin corregir porcentajes nuevos', () => {
    expect(stonePartnerships).toContain("p_data ? 'partnerid'")
    expect(stonePartnerships).toContain("p_data ? 'partnername'")
    expect(stonePartnerships).toContain("p_data ? 'mypercent'")
    expect(stonePartnerships).toContain(
      "private.is_nonnegative_integer(p_data->'mypercent')"
    )
    expect(stonePartnerships).toContain('v_my_percent > 100')
    expect(stonePartnerships).toContain('v_my_percent <> 100')
    expect(stonePartnerships).toContain("errcode = '22023'")
  })
})

describe('migracion de tipo de producto y moneda (B3)', () => {
  const validators = [
    'assert_settings_payload',
    'assert_stone_lot_payload',
    'assert_stock_jewel_payload',
    'assert_expense_payload',
  ]

  it('reemplaza los cuatro validadores y la RPC de ajustes sin tocar tablas ni RLS', () => {
    for (const validator of validators) {
      expect(productCurrency).toContain(`create or replace function private.${validator}`)
      expect(productCurrency).toContain(`revoke all on function private.${validator}`)
    }
    expect(productCurrency).toContain('create or replace function public.upsert_settings')
    expect(productCurrency.match(/security invoker/g)).toHaveLength(4)
    expect(productCurrency.match(/security definer/g)).toHaveLength(1)
    expect(productCurrency.match(/set search_path = ''/g)).toHaveLength(5)
    expect(productCurrency).not.toMatch(/create\s+table/)
    expect(productCurrency).not.toMatch(/drop\s+(table|column|policy)/)
    expect(productCurrency).not.toMatch(/truncate/)
    expect(productCurrency).not.toMatch(/create\s+policy/)
    for (const table of ['clients', 'quotes', 'stone_lots', 'stock_jewels', 'expenses']) {
      expect(productCurrency).not.toMatch(
        new RegExp(`\\b(insert\\s+into|update|delete\\s+from)\\s+public\\.${table}`)
      )
    }
    expect(productCurrency).toContain(
      'revoke all on function public.upsert_settings(jsonb, timestamptz)'
    )
    expect(productCurrency).toContain(
      'grant execute on function public.upsert_settings(jsonb, timestamptz) to authenticated'
    )
  })

  it('valida el catalogo administrado y la ultima tasa sin perder categorias ni settings previos', () => {
    expect(productCurrency).toContain("p_data->'producttypes'")
    expect(productCurrency).toContain("p_data->'lastknownusdrate'")
    expect(productCurrency).toContain("p_data->'usdrateupdatedat'")
    expect(productCurrency).toContain("p_data->'producttypesupdatedat'")
    expect(productCurrency).toContain("p_data->'expensecategories'")
    expect(productCurrency).toContain("group by lower(btrim(item->>'name'))")
    expect(productCurrency).toContain("p_data->'goldpricepergram'")
    expect(productCurrency).toContain("p_data->'settingsversion'")
  })

  it('fusiona ajustes por organizacion sin que un payload B2 borre claves B3', () => {
    expect(productCurrency).toContain(
      "current_organization_id_for_roles(array['owner', 'admin'])"
    )
    expect(productCurrency).toContain("v_organization_id::text || ':org_settings'")
    expect(productCurrency).toContain('from public.org_settings settings')
    expect(productCurrency).toContain('settings.organization_id = v_organization_id')
    expect(productCurrency).toContain('v_merged_data := v_existing_data || p_data')
    expect(productCurrency).toContain('v_merged_data := p_data || v_existing_data')
    expect(productCurrency).toContain(
      'v_merged_updated_at := greatest(v_existing_updated_at, p_updated_at)'
    )
    expect(productCurrency).toContain(
      'greatest(v_existing_version, v_incoming_version)'
    )
  })

  it('resuelve tasa y catalogo por fecha, une nombres y deja active al catalogo ganador', () => {
    expect(productCurrency).toContain('v_incoming_rate_at >= v_existing_rate_at')
    expect(productCurrency).toContain("'{lastknownusdrate}'")
    expect(productCurrency).toContain("'{usdrateupdatedat}'")
    expect(productCurrency).toContain('v_incoming_catalog_at >= v_existing_catalog_at')
    expect(productCurrency).toContain('jsonb_agg(candidate.item order by candidate.source_priority')
    expect(productCurrency).toContain('with ordinality as winner(item, ordinality)')
    expect(productCurrency).toContain('with ordinality as loser(item, ordinality)')
    expect(productCurrency).toContain(
      "lower(btrim(winner_item->>'name')) = lower(btrim(loser.item->>'name'))"
    )
    expect(productCurrency).toContain("'{producttypes}'")
    expect(productCurrency).toContain("'{producttypesupdatedat}'")
    expect(productCurrency).toContain(
      "jsonb_typeof(v_existing_data->'producttypes') is distinct from 'array'"
    )
    expect(productCurrency).toContain(
      "jsonb_typeof(v_existing_data->'lastknownusdrate') = 'number'"
    )
  })

  it('protege ventas, abonos y gastos con tasa finita 1000..20000 cuando existe', () => {
    expect(productCurrency).toContain("sale->'producttype'")
    expect(productCurrency).toContain("sale->'usdrate'")
    expect(productCurrency).toContain("item->'usdrate'")
    expect(productCurrency).toContain("p_data->'sale'->'producttype'")
    expect(productCurrency).toContain("p_data->'sale'->'usdrate'")
    expect(productCurrency).toContain("p_data->'usdrate'")
    expect(productCurrency).toContain("not in ('number', 'null')")
    expect(productCurrency).toContain('::numeric < 1000')
    expect(productCurrency).toContain('::numeric > 20000')
    expect(productCurrency).toContain("errcode = '22023'")
  })

  it('impide cambiar una tasa ya guardada dentro de la misma organizacion', () => {
    expect(productCurrency.match(/current_organization_id_for_roles/g)).toHaveLength(4)
    expect(productCurrency).toContain('from public.stone_lots')
    expect(productCurrency).toContain('from public.stock_jewels')
    expect(productCurrency).toContain('from public.expenses')
    expect(productCurrency.match(/pg_advisory_xact_lock/g)).toHaveLength(4)
    expect(productCurrency.match(/for update/g)?.length).toBeGreaterThanOrEqual(4)
    expect(productCurrency).toContain("new_sale->>'id' = old_sale->>'id'")
    expect(productCurrency).toContain("new_payment->>'id' = old_payment->>'id'")
    expect(productCurrency).toContain("v_existing_data->'sale'->>'id' = p_data->'sale'->>'id'")
    expect(productCurrency).toContain("coalesce(old_sale->'usdrate', 'null'::jsonb)")
    expect(productCurrency).toContain("coalesce(old_payment->'usdrate', 'null'::jsonb)")
    expect(productCurrency).toContain("coalesce(v_existing_data->'usdrate', 'null'::jsonb)")
    expect(productCurrency).toContain('usd rate is immutable')
  })

  it('conserva las reglas B1, B2, credito, pagos y joyas ya vigentes', () => {
    expect(productCurrency).toContain("p_data->'purchasevaluecop'")
    expect(productCurrency).toContain("p_data->'supplierpayments'")
    expect(productCurrency).toContain("sale->'payments'")
    expect(productCurrency).toContain("p_data ? 'partnerid'")
    expect(productCurrency).toContain("p_data ? 'mypercent'")
    expect(productCurrency).toContain('v_my_percent > 100')
    expect(productCurrency).toContain('v_my_percent <> 100')
    expect(productCurrency).toContain("p_data->'costcop'")
    expect(productCurrency).toContain("p_data->'pricecop'")
    expect(productCurrency).toContain("p_data->'amountcop'")
    expect(productCurrency).toContain("p_data->'paidby'")
  })
})
