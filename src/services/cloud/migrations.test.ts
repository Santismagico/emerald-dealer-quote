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
import jewelTransformationSource from '../../../supabase/migrations/20260804151230_fase_c2_transformacion_joya.sql?raw'
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
const jewelTransformation = jewelTransformationSource.toLowerCase()
const jewelTransformationStart = jewelTransformation.indexOf(
  'create or replace function public.transform_stock_jewel_to_natural'
)
const jewelRestorationStart = jewelTransformation.indexOf(
  'create or replace function public.restore_stock_jewel_transformation'
)
const importAuthorizationStart = jewelTransformation.indexOf(
  'create or replace function public.authorize_cloud_import'
)
const stoneSeedStart = jewelTransformation.indexOf(
  'create or replace function public.seed_stone_lot_transformation_import'
)
const jewelSeedStart = jewelTransformation.indexOf(
  'create or replace function public.seed_stock_jewel_transformation_import'
)
const stoneFinalizeStart = jewelTransformation.indexOf(
  'create or replace function public.finalize_stone_lot_transformation_import'
)
const jewelFinalizeStart = jewelTransformation.indexOf(
  'create or replace function public.finalize_stock_jewel_transformation_import'
)
const c2DeleteStart = jewelTransformation.indexOf(
  'create or replace function public.delete_stone_lot'
)
const jewelTransformationRpc = jewelTransformation.slice(
  jewelTransformationStart,
  jewelRestorationStart
)
const jewelRestorationRpc = jewelTransformation.slice(
  jewelRestorationStart,
  importAuthorizationStart
)
const importAuthorizationRpc = jewelTransformation.slice(
  importAuthorizationStart,
  stoneSeedStart
)
const stoneSeedRpc = jewelTransformation.slice(stoneSeedStart, jewelSeedStart)
const jewelSeedRpc = jewelTransformation.slice(jewelSeedStart, stoneFinalizeStart)
const stoneFinalizeRpc = jewelTransformation.slice(stoneFinalizeStart, jewelFinalizeStart)
const jewelFinalizeRpc = jewelTransformation.slice(jewelFinalizeStart, c2DeleteStart)

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

describe('migracion C2: transformacion atomica de joya fantasia a natural', () => {
  it('es aditiva y no acepta la organizacion ni el costo desde el navegador', () => {
    expect(jewelTransformation).toContain(
      'function public.transform_stock_jewel_to_natural'
    )
    expect(jewelTransformation).not.toMatch(/\b(create|alter|drop)\s+table\b/)
    expect(jewelTransformation).not.toContain('create policy')
    expect(jewelTransformation).not.toContain('drop policy')
    expect(jewelTransformation).not.toContain('p_organization_id')
    expect(jewelTransformationRpc).not.toContain('p_cost')
  })

  it('publica una RPC protegida con la firma exacta y permisos minimos', () => {
    for (const parameter of [
      'p_event_id text',
      'p_date text',
      'p_lot_id text',
      'p_jewel_id text',
      'p_origin text',
      'p_carats numeric',
      'p_quantity integer',
      'p_notes text',
      'p_updated_at timestamptz'
    ]) {
      expect(jewelTransformationRpc).toContain(parameter)
    }
    expect(jewelTransformationRpc).toContain('returns jsonb')
    expect(jewelTransformationRpc).toContain('security definer')
    expect(jewelTransformationRpc).toContain("set search_path = ''")
    expect(jewelTransformation).toContain(
      'revoke all on function public.transform_stock_jewel_to_natural('
    )
    expect(jewelTransformation).toContain(
      ') from public, anon, authenticated, service_role;'
    )
    expect(jewelTransformation).toContain(
      'grant execute on function public.transform_stock_jewel_to_natural('
    )
    expect(jewelTransformation).toContain(') to authenticated;')
  })

  it('resuelve la organizacion y bloquea evento, lote y joya en orden fijo', () => {
    expect(jewelTransformationRpc).toContain(
      'private.current_organization_id_for_roles'
    )
    expect(jewelTransformationRpc).toContain('organization_id = v_organization_id')
    const eventLock = jewelTransformationRpc.indexOf(':stock_transform_events:')
    const lotLock = jewelTransformationRpc.indexOf(':stone_lots:')
    const jewelLock = jewelTransformationRpc.indexOf(':stock_jewels:')
    expect(eventLock).toBeGreaterThan(-1)
    expect(lotLock).toBeGreaterThan(eventLock)
    expect(jewelLock).toBeGreaterThan(lotLock)

    const lotRowLock = jewelTransformationRpc.indexOf('from public.stone_lots lot')
    const jewelRowLock = jewelTransformationRpc.indexOf('from public.stock_jewels jewel')
    expect(lotRowLock).toBeGreaterThan(jewelLock)
    expect(jewelRowLock).toBeGreaterThan(lotRowLock)
    expect(jewelTransformationRpc.match(/for update/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it('valida forma, fechas y existencias brutas o talladas en el servidor', () => {
    expect(jewelTransformation).toContain(
      'function private.assert_stone_lot_internal_uses_payload'
    )
    expect(jewelTransformation).toContain(
      'function private.assert_stock_jewel_c2_payload'
    )
    expect(jewelTransformation).toContain("not in ('bruto', 'tallado')")
    expect(jewelTransformation).toContain(
      "<> round((use_item->>'carats')::numeric, 3)"
    )
    expect(jewelTransformation).toContain('stone internal use cannot predate lot purchase')
    expect(jewelTransformation).toContain(
      'stock jewel transformation cannot predate acquisition'
    )
    expect(jewelTransformation).toContain(
      'stock jewel transformation cannot postdate sale'
    )
    expect(jewelTransformation).toContain('9007199254740991')
    expect(jewelTransformation).toContain('stone internal uses exceed raw inventory')
    expect(jewelTransformation).toContain('stone internal uses exceed cut inventory')
    expect(jewelTransformationRpc).toContain('a sold stock jewel cannot be transformed')
    expect(jewelTransformationRpc).toContain(
      'only a fantasia stock jewel can become natural'
    )
  })

  it('calcula el costo en el servidor con compra y tallas ya pagadas', () => {
    expect(jewelTransformationRpc).toContain(
      "where coalesce(batch->>'cuttingpaiddate', '') <> ''"
    )
    expect(jewelTransformationRpc).toContain(
      "v_total_invested := (v_lot_data->>'purchasevaluecop')::numeric + v_paid_cutting_cost"
    )
    expect(jewelTransformationRpc).toContain(
      "v_purchase_millicarats := round((v_lot_data->>'carats')::numeric * 1000)"
    )
    expect(jewelTransformationRpc).toContain(
      '(v_total_invested * v_consumed_millicarats) / v_purchase_millicarats'
    )
    expect(jewelTransformationRpc).toContain("'{costcop}'")
    expect(jewelTransformationRpc).toContain('v_jewel_cost + v_attributed_cost')
    expect(jewelTransformationRpc).toContain(
      'stock jewel transformation cost exceeds safe cop range'
    )
  })

  it('guarda ambas mitades atomicamente y reintenta sin duplicar el evento', () => {
    expect(jewelTransformationRpc).toContain("'{internaluses}'")
    expect(jewelTransformationRpc).toContain("'{stonetransformations}'")
    expect(jewelTransformationRpc).toContain("'fromstonekind', 'fantasia'")
    expect(jewelTransformationRpc).toContain("'tostonekind', 'natural'")
    expect(jewelTransformationRpc).toContain('v_existing_use is not null')
    expect(jewelTransformationRpc).toContain('v_existing_event is not null')
    expect(jewelTransformationRpc).toContain(
      'transformation event id already belongs to another record'
    )
    expect(jewelTransformationRpc).toContain(
      'transformation event id was reused with different data'
    )
    const lotUpdate = jewelTransformationRpc.indexOf('update public.stone_lots')
    const jewelUpdate = jewelTransformationRpc.indexOf('update public.stock_jewels')
    expect(lotUpdate).toBeGreaterThan(-1)
    expect(jewelUpdate).toBeGreaterThan(lotUpdate)
    expect(jewelTransformationRpc).toContain(
      "return jsonb_build_object('lot', v_lot_data, 'jewel', v_jewel_data)"
    )
    expect(jewelTransformationRpc).toContain(
      "return jsonb_build_object('lot', v_new_lot_data, 'jewel', v_new_jewel_data)"
    )
  })

  it('impide crear, cambiar o borrar la historia por las RPC normales', () => {
    expect(jewelTransformation).toContain(
      'function private.assert_stone_internal_uses_preserved'
    )
    expect(jewelTransformation).toContain(
      'function private.assert_stock_transformations_preserved'
    )
    expect(jewelTransformation).toContain(
      'perform private.assert_stone_internal_uses_preserved(p_id, p_data)'
    )
    expect(jewelTransformation).toContain(
      'perform private.assert_stock_transformations_preserved(p_id, p_data)'
    )
    expect(jewelTransformation).toContain(
      'returned cutting inventory is immutable after an internal use'
    )
    expect(jewelTransformation).toContain(
      'stone lot with internal uses cannot be deleted'
    )
    expect(jewelTransformation).toContain(
      'transformed stock jewel cannot be deleted'
    )
    expect(jewelTransformation).toContain(
      'fantasia to natural requires the protected transformation rpc'
    )
  })

  it('restaura el costo historico solo para owner/admin y sin cambiar la RPC normal', () => {
    expect(jewelTransformationStart).toBeGreaterThan(-1)
    expect(jewelRestorationStart).toBeGreaterThan(jewelTransformationStart)
    expect(jewelTransformationRpc).not.toContain('p_cost_cop')
    expect(jewelRestorationRpc).toContain(
      'function public.restore_stock_jewel_transformation'
    )
    expect(jewelRestorationRpc).toContain('p_cost_cop numeric')
    expect(jewelRestorationRpc).not.toContain('p_cost_cop integer')
    expect(jewelRestorationRpc).toContain('returns jsonb')
    expect(jewelRestorationRpc).toContain(
      "current_organization_id_for_roles(array['owner', 'admin'])"
    )
    expect(jewelRestorationRpc).not.toContain("'seller'")
    expect(jewelRestorationRpc).not.toContain('p_organization_id')
    expect(jewelRestorationRpc).toContain('p_cost_cop is null or p_cost_cop < 0')
    expect(jewelRestorationRpc).toContain("p_cost_cop = 'nan'::numeric")
    expect(jewelRestorationRpc).toContain('p_cost_cop > 9007199254740991')
    expect(jewelRestorationRpc).toContain('trunc(p_cost_cop) <> p_cost_cop')
    expect(jewelRestorationRpc).toContain("set search_path = ''")
    expect(jewelRestorationRpc).toContain('security definer')
  })

  it('protege el cutoff antes de transformar y conserva el orden fijo de bloqueos', () => {
    const eventLock = jewelRestorationRpc.indexOf(':stock_transform_events:')
    const lotLock = jewelRestorationRpc.indexOf(':stone_lots:')
    const jewelLock = jewelRestorationRpc.indexOf(':stock_jewels:')
    const lotRowLock = jewelRestorationRpc.indexOf('from public.stone_lots lot')
    const jewelRowLock = jewelRestorationRpc.indexOf('from public.stock_jewels jewel')
    const detection = jewelRestorationRpc.indexOf('into v_existed_before')
    const cutoff = jewelRestorationRpc.indexOf(
      'stock jewel transformation import cutoff no longer matches'
    )
    const baseCall = jewelRestorationRpc.indexOf(
      'perform public.transform_stock_jewel_to_natural('
    )
    expect(eventLock).toBeGreaterThan(-1)
    expect(lotLock).toBeGreaterThan(eventLock)
    expect(jewelLock).toBeGreaterThan(lotLock)
    expect(lotRowLock).toBeGreaterThan(jewelLock)
    expect(jewelRowLock).toBeGreaterThan(lotRowLock)
    expect(detection).toBeGreaterThan(jewelRowLock)
    expect(cutoff).toBeGreaterThan(detection)
    expect(baseCall).toBeGreaterThan(cutoff)
    expect(jewelRestorationRpc.match(/for update/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it('en un evento nuevo reemplaza ambos costos y ajusta solo la diferencia', () => {
    expect(jewelRestorationRpc).toContain(
      'v_cost_delta := p_cost_cop::numeric - v_calculated_cost'
    )
    expect(jewelRestorationRpc).toContain(
      "jsonb_set(use_item, '{costcop}', to_jsonb(p_cost_cop), false)"
    )
    expect(jewelRestorationRpc).toContain(
      "jsonb_set(event_item, '{costcop}', to_jsonb(p_cost_cop), false)"
    )
    expect(jewelRestorationRpc).toContain(
      "v_new_jewel_cost := (v_jewel_data->>'costcop')::numeric + v_cost_delta"
    )
    expect(jewelRestorationRpc).toContain(
      'perform private.assert_stone_lot_internal_uses_payload(v_new_lot_data)'
    )
    expect(jewelRestorationRpc).toContain(
      'perform private.assert_stock_jewel_c2_payload(v_new_jewel_data)'
    )
    const lotUpdate = jewelRestorationRpc.indexOf('update public.stone_lots')
    const jewelUpdate = jewelRestorationRpc.indexOf('update public.stock_jewels')
    expect(lotUpdate).toBeGreaterThan(-1)
    expect(jewelUpdate).toBeGreaterThan(lotUpdate)
  })

  it('un reintento confirma el costo ya guardado y nunca lo reemplaza', () => {
    const retryBranch = jewelRestorationRpc.slice(
      jewelRestorationRpc.indexOf('if v_existed_before then'),
      jewelRestorationRpc.indexOf('v_calculated_cost :=')
    )
    expect(retryBranch).toContain(
      "(v_existing_use->>'costcop')::numeric"
    )
    expect(retryBranch).toContain('is distinct from p_cost_cop::numeric')
    expect(retryBranch).toContain('restored transformation cost differs from stored history')
    expect(retryBranch).toContain(
      "return jsonb_build_object('lot', v_lot_data, 'jewel', v_jewel_data)"
    )
    expect(retryBranch).not.toContain('jsonb_set')
  })

  it('la restauracion nueva devuelve los dos JSON finales autoritativos', () => {
    expect(jewelRestorationRpc).toContain(
      "return jsonb_build_object('lot', v_new_lot_data, 'jewel', v_new_jewel_data)"
    )
    expect(jewelRestorationRpc).not.toMatch(/\breturn\s*;/)
  })

  it('cierra la restauracion a todos por defecto y la abre a authenticated', () => {
    expect(jewelTransformation).toContain(
      'revoke all on function public.restore_stock_jewel_transformation('
    )
    expect(jewelTransformation).toContain(
      'text, text, text, text, text, numeric, integer, text, timestamptz, numeric'
    )
    expect(jewelTransformation).toContain(
      'grant execute on function public.restore_stock_jewel_transformation('
    )
    expect(jewelTransformation).toContain(') to authenticated;')
  })

  it('el costo historico admite COP enteros superiores al limite de 32 bits', () => {
    const historicalCostCop = 3_000_000_000
    expect(historicalCostCop).toBeGreaterThan(2_147_483_647)
    expect(jewelRestorationRpc).toContain('p_cost_cop numeric')
    expect(jewelRestorationRpc).toContain('trunc(p_cost_cop) <> p_cost_cop')
    expect(jewelRestorationRpc).toContain('to_jsonb(p_cost_cop)')
  })

  it('autoriza la importacion antes de escribir y bloquea a seller', () => {
    expect(importAuthorizationStart).toBeGreaterThan(jewelRestorationStart)
    expect(importAuthorizationRpc).toContain('function public.authorize_cloud_import()')
    expect(importAuthorizationRpc).toContain('returns void')
    expect(importAuthorizationRpc).toContain('security definer')
    expect(importAuthorizationRpc).toContain("set search_path = ''")
    expect(importAuthorizationRpc).toContain(
      "current_organization_id_for_roles(array['owner', 'admin'])"
    )
    expect(importAuthorizationRpc).not.toContain("'seller'")
    expect(importAuthorizationRpc).not.toContain('p_organization_id')
    expect(jewelTransformation).toContain(
      'revoke all on function public.authorize_cloud_import()'
    )
    expect(jewelTransformation).toContain(
      'grant execute on function public.authorize_cloud_import()'
    )
  })

  it('los seeds reciben baseline y final, validan ambos y solo insertan', () => {
    for (const seedRpc of [stoneSeedRpc, jewelSeedRpc]) {
      expect(seedRpc).toContain('p_id text')
      expect(seedRpc).toContain('p_baseline_data jsonb')
      expect(seedRpc).toContain('p_final_data jsonb')
      expect(seedRpc).toContain('p_updated_at timestamptz')
      expect(seedRpc).toContain(
        "current_organization_id_for_roles(array['owner', 'admin'])"
      )
      expect(seedRpc).not.toContain("'seller'")
      expect(seedRpc).not.toContain('p_organization_id')
      expect(seedRpc).toContain('for update')
      expect(seedRpc).toContain('on conflict (organization_id, id) do nothing')
      expect(seedRpc).not.toMatch(/update\s+public\./)
    }
    expect(stoneSeedRpc).toContain(
      "jsonb_array_length(p_baseline_data->'internaluses') <> 0"
    )
    expect(stoneSeedRpc).toContain(
      'perform private.assert_stone_lot_internal_uses_payload(p_final_data)'
    )
    expect(jewelSeedRpc).toContain(
      "jsonb_array_length(p_baseline_data->'stonetransformations') <> 0"
    )
    expect(jewelSeedRpc).toContain(
      'perform private.assert_stock_jewel_c2_payload(p_final_data)'
    )
  })

  it('el seed de lote solo acepta baseline o un prefijo exacto y ordenado del final', () => {
    expect(stoneSeedRpc).toContain('v_baseline_match :=')
    expect(stoneSeedRpc).toContain(
      'v_existing_data is not distinct from p_baseline_data'
    )
    expect(stoneSeedRpc).toContain(
      "v_existing_data - 'updatedat' - 'internaluses'"
    )
    expect(stoneSeedRpc).toContain(
      "p_final_data - 'updatedat' - 'internaluses'"
    )
    expect(stoneSeedRpc).toContain('with ordinality as current_uses')
    expect(stoneSeedRpc).toContain('with ordinality as final_uses')
    expect(stoneSeedRpc).toContain(
      'current_uses.use_item is distinct from final_uses.use_item'
    )
    expect(stoneSeedRpc).toContain(
      "jsonb_array_length(v_existing_data->'internaluses')"
    )
    expect(stoneSeedRpc).toContain(
      "jsonb_array_length(p_final_data->'internaluses')"
    )
    expect(stoneSeedRpc).toContain(
      'stone lot import seed collides with another record or edit'
    )
    expect(stoneSeedRpc).toContain(
      'v_existing_updated_at is not distinct from p_updated_at'
    )
    expect(stoneSeedRpc).toContain('v_existing_updated_at >= p_updated_at')
  })

  it('el seed de joya solo acepta baseline, intermedio exacto o final exacto', () => {
    expect(jewelSeedRpc).toContain(
      'v_baseline_match := v_existing_data is not distinct from p_baseline_data'
    )
    expect(jewelSeedRpc).toContain(
      "v_existing_data - 'updatedat' - 'sale'"
    )
    expect(jewelSeedRpc).toContain(
      "p_final_data - 'updatedat' - 'sale'"
    )
    expect(jewelSeedRpc).toContain(
      "coalesce(v_existing_data->'sale', 'null'::jsonb)"
    )
    expect(jewelSeedRpc).toContain("v_existing_data - 'updatedat'")
    expect(jewelSeedRpc).toContain("p_final_data - 'updatedat'")
    expect(jewelSeedRpc).toContain(
      'if not v_baseline_match and not v_intermediate_match and not v_final_match'
    )
    expect(jewelSeedRpc).toContain(
      'stock jewel import seed collides with another record or edit'
    )
    expect(jewelSeedRpc).toContain(
      'v_existing_updated_at is not distinct from p_updated_at'
    )
    expect(jewelSeedRpc).toContain('v_existing_updated_at >= p_updated_at')
  })

  it('los finalizers exigen fila, historia y registro completo sin ediciones laterales', () => {
    for (const finalizeRpc of [stoneFinalizeRpc, jewelFinalizeRpc]) {
      expect(finalizeRpc).toContain(
        "current_organization_id_for_roles(array['owner', 'admin'])"
      )
      expect(finalizeRpc).not.toContain("'seller'")
      expect(finalizeRpc).not.toContain('p_organization_id')
      expect(finalizeRpc).toContain('for update')
      expect(finalizeRpc).toContain('import seed not found')
    }
    expect(stoneFinalizeRpc).toContain(
      "p_data->'internaluses' is distinct from v_existing_data->'internaluses'"
    )
    expect(stoneFinalizeRpc).toContain(
      "(v_existing_data - 'updatedat') is distinct from (p_data - 'updatedat')"
    )
    expect(jewelFinalizeRpc).toContain(
      "p_data->'stonetransformations'"
    )
    expect(jewelFinalizeRpc).toContain(
      "is distinct from v_existing_data->'stonetransformations'"
    )
    expect(jewelFinalizeRpc).toContain(
      "p_data->'costcop' is distinct from v_existing_data->'costcop'"
    )
    expect(jewelFinalizeRpc).toContain(
      "v_existing_data - 'updatedat' - 'sale'"
    )
    expect(jewelFinalizeRpc).toContain(
      "p_data - 'updatedat' - 'sale'"
    )
  })

  it('finalizar joya solo agrega venta desde null o reintenta la misma venta', () => {
    expect(jewelFinalizeRpc).toContain(
      "v_existing_sale := coalesce(v_existing_data->'sale', 'null'::jsonb)"
    )
    expect(jewelFinalizeRpc).toContain(
      "v_existing_sale is distinct from 'null'::jsonb"
    )
    expect(jewelFinalizeRpc).toContain(
      "v_existing_sale is distinct from p_data->'sale'"
    )
    expect(jewelFinalizeRpc).toContain(
      'stock jewel import sale differs from existing sale'
    )
  })

  it('los finalizers usan un timestamp efectivo comun para columna y data', () => {
    for (const finalizeRpc of [stoneFinalizeRpc, jewelFinalizeRpc]) {
      expect(finalizeRpc).toContain('v_effective_updated_at := greatest(')
      expect(finalizeRpc).toContain('v_existing_updated_at')
      expect(finalizeRpc).toContain('p_updated_at')
      expect(finalizeRpc).toContain('pg_catalog.statement_timestamp()')
      expect(finalizeRpc).toContain("'{updatedat}'")
      expect(finalizeRpc).toContain('to_jsonb(v_updated_at_text)')
      expect(finalizeRpc).toContain('updated_at = v_effective_updated_at')
    }
  })

  it('el cutoff impide revivir cambios posteriores y permite reintento final exacto', () => {
    expect(stoneFinalizeRpc).toContain(
      'if v_existing_updated_at > p_updated_at then return; end if;'
    )
    expect(stoneFinalizeRpc).toContain(
      'if v_existing_updated_at is distinct from p_updated_at then'
    )
    expect(stoneFinalizeRpc).toContain(
      'stone lot import cutoff no longer matches current row'
    )
    expect(jewelFinalizeRpc).toContain(
      "v_existing_sale is not distinct from p_data->'sale'"
    )
    expect(jewelFinalizeRpc).toContain(
      'and v_existing_updated_at > p_updated_at then'
    )
    expect(jewelFinalizeRpc).toContain(
      'if v_existing_updated_at is distinct from p_updated_at then'
    )
    expect(jewelFinalizeRpc).toContain(
      'stock jewel import cutoff no longer matches current row'
    )
  })

  it('protege las cuatro RPC de importacion y usa sus firmas exactas', () => {
    const names = [
      'seed_stone_lot_transformation_import',
      'seed_stock_jewel_transformation_import',
      'finalize_stone_lot_transformation_import',
      'finalize_stock_jewel_transformation_import'
    ]
    for (const name of names) {
      expect(jewelTransformation).toContain(`revoke all on function public.${name}(`)
      expect(jewelTransformation).toContain(`grant execute on function public.${name}(`)
    }
    expect(jewelTransformation).toContain('text, jsonb, jsonb, timestamptz')
    expect(jewelTransformation).toContain('text, jsonb, timestamptz')
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
