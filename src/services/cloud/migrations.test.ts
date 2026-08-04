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
