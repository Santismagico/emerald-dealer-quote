import { describe, expect, it } from 'vitest'
import schemaSource from '../../../supabase/migrations/0001_esquema.sql?raw'
import rlsSource from '../../../supabase/migrations/0002_rls.sql?raw'
import functionsSource from '../../../supabase/migrations/0003_funciones.sql?raw'
import hardeningSource from '../../../supabase/migrations/20260718200036_harden_cloud_writes.sql?raw'
import grantClosureSource from '../../../supabase/migrations/20260718212000_close_authenticated_table_grants.sql?raw'
import inventorySource from '../../../supabase/migrations/20260721210000_inventario_compradores_y_joyas.sql?raw'

const schema = schemaSource.toLowerCase()
const rls = rlsSource.toLowerCase()
const functions = functionsSource.toLowerCase()
const hardening = hardeningSource.toLowerCase()
const grantClosure = grantClosureSource.toLowerCase()
const inventory = inventorySource.toLowerCase()

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
