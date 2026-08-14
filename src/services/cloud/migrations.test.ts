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
import stonePurchaseOriginSource from '../../../supabase/migrations/20260804184500_compra_lote_bruto_tallado.sql?raw'
import deletedStoneLotHistorySource from '../../../supabase/migrations/20260804193000_eliminar_lote_con_historia_joya.sql?raw'
import sociosFundCloudSource from '../../../supabase/migrations/20260811023039_etapa9_socios_fondo_nube.sql?raw'
import saleIdentifiersSource from '../../../supabase/migrations/20260813050000_exigir_id_en_ventas_y_abonos.sql?raw'
import betaLimitsSource from '../../../supabase/migrations/20260813120000_cupo_beta_y_borrado_de_cuenta.sql?raw'
import readOnlySource from '../../../supabase/migrations/20260814090000_modo_solo_lectura.sql?raw'
import devicesSource from '../../../supabase/migrations/20260814093000_control_de_equipos.sql?raw'
import operatorAccessSource from '../../../supabase/migrations/20260814120000_devolver_acceso_al_operador.sql?raw'
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
const stonePurchaseOrigin = stonePurchaseOriginSource.toLowerCase()
const deletedStoneLotHistory = deletedStoneLotHistorySource.toLowerCase()
const sociosFundCloud = sociosFundCloudSource.toLowerCase()
const saleIdentifiers = saleIdentifiersSource.toLowerCase()
const betaLimits = betaLimitsSource.toLowerCase()
const readOnly = readOnlySource.toLowerCase()
const devices = devicesSource.toLowerCase()
const operatorAccess = operatorAccessSource.toLowerCase()
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
  it('C4 permite borrar el lote y conserva nombre, costo e historia dentro de la joya', () => {
    expect(deletedStoneLotHistory).toContain("jsonb_build_object('lotname', v_lot_name)")
    expect(deletedStoneLotHistory).toContain("event_item->>'lotid' = p_id")
    expect(deletedStoneLotHistory).toContain("'{stonetransformations}'")
    expect(deletedStoneLotHistory).toContain("'{updatedat}'")
    expect(deletedStoneLotHistory).toContain('delete from public.stone_lots')
    expect(deletedStoneLotHistory).not.toContain(
      'stone lot with internal uses cannot be deleted'
    )
    expect(deletedStoneLotHistory).toContain("old_event - 'lotname'")
    expect(deletedStoneLotHistory).toContain(
      'deleted-lot jewel import requires a name and an absent lot'
    )
    expect(deletedStoneLotHistory).toContain(
      'grant execute on function public.delete_stone_lot(text) to authenticated'
    )
    expect(deletedStoneLotHistory).not.toMatch(/\b(create|alter|drop)\s+table\b/)
    expect(deletedStoneLotHistory).not.toContain('create policy')
    expect(deletedStoneLotHistory).not.toContain('p_organization_id')
  })

  it('C2 valida compras en bruto o talladas sin alterar tablas ni perder compatibilidad', () => {
    expect(stonePurchaseOrigin).toContain("coalesce(p_data->>'purchaseorigin', 'bruto')")
    expect(stonePurchaseOrigin).toContain("not in ('bruto', 'tallado')")
    expect(stonePurchaseOrigin).toContain('purchased cut stone lot cannot have cutting batches')
    expect(stonePurchaseOrigin).toContain("'id', '__purchase_tallado__'")
    expect(stonePurchaseOrigin).toContain("'returnedcarats', p_data->'carats'")
    expect(stonePurchaseOrigin).toContain('stone lot purchase origin is immutable')
    expect(stonePurchaseOrigin).toContain(
      'perform private.assert_stone_lot_cutting_payload(p_id, p_data, p_updated_at)'
    )
    expect(stonePurchaseOrigin).toContain(
      'perform private.assert_stone_lot_internal_uses_payload(p_data)'
    )
    expect(stonePurchaseOrigin).toContain(
      'perform private.assert_stone_internal_uses_preserved(p_id, p_data)'
    )
    expect(stonePurchaseOrigin).toContain(
      'grant execute on function public.upsert_stone_lot(text, jsonb, timestamptz) to authenticated'
    )
    expect(stonePurchaseOrigin).not.toMatch(/\b(create|alter|drop)\s+table\b/)
    expect(stonePurchaseOrigin).not.toContain('create policy')
    expect(stonePurchaseOrigin).not.toContain('p_organization_id')
  })

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

describe('etapa 9: socios y fondo en la nube', () => {
  it('agrega el fondo sin borrar tablas, columnas ni datos existentes', () => {
    expect(sociosFundCloud).toContain('create table if not exists public.fund_contributions')
    expect(sociosFundCloud).toContain('primary key (organization_id, id)')
    expect(sociosFundCloud).toContain('create index if not exists fund_contributions_org_updated')
    expect(sociosFundCloud).not.toMatch(/drop\s+(table|column)/)
    // Se miran las SENTENCIAS, no los comentarios: el bloque explica por que
    // TRUNCATE es peligroso, y esa explicacion no debe hacer fallar la prueba.
    const sentencias = sociosFundCloud
      .split('\n')
      .filter((linea) => !linea.trim().startsWith('--'))
      .join('\n')
    expect(sentencias).not.toMatch(/truncate/i)
    for (const table of ['stone_lots', 'material_lots', 'expenses']) {
      expect(sociosFundCloud).not.toMatch(new RegExp(`delete\\s+from\\s+public\\.${table}`))
    }
  })

  it('cierra escritura directa y permite leer solo a miembros de la joyeria', () => {
    expect(sociosFundCloud).toContain(
      'alter table public.fund_contributions enable row level security'
    )
    expect(sociosFundCloud).toContain('create policy fund_contributions_select_member')
    expect(sociosFundCloud).toContain('membership.user_id = (select auth.uid())')
    // Antes esta prueba exigia `revoke insert, update, delete`, que era justo el
    // patron que dejaba TRUNCATE abierto: la prueba fijaba el error como si fuera
    // lo correcto. Ahora exige `revoke all`, que es lo unico que cierra de verdad.
    expect(sociosFundCloud).toContain(
      'revoke all on table public.fund_contributions from anon, authenticated'
    )
    expect(sociosFundCloud).not.toMatch(
      /revoke\s+insert,\s*update,\s*delete\s+on\s+table\s+public\.fund_contributions/
    )
    expect(sociosFundCloud).toContain(
      'grant select on table public.fund_contributions to authenticated'
    )
    expect(sociosFundCloud).not.toContain('policy fund_contributions_insert')
    expect(sociosFundCloud).not.toContain('policy fund_contributions_update')
    expect(sociosFundCloud).not.toContain('policy fund_contributions_delete')
  })

  it('resuelve la organizacion en el servidor y no acepta organization_id del navegador', () => {
    for (const name of ['upsert_fund_contribution', 'delete_fund_contribution']) {
      expect(sociosFundCloud).toContain(`function public.${name}`)
      expect(sociosFundCloud).toContain(`revoke all on function public.${name}`)
      expect(sociosFundCloud).toContain(`grant execute on function public.${name}`)
    }
    expect(sociosFundCloud).toContain(
      "private.current_organization_id_for_roles(\n    array['owner', 'admin', 'seller']"
    )
    expect(sociosFundCloud).not.toContain('p_organization_id')
    expect(sociosFundCloud).toContain("set search_path = ''")
  })

  it('valida listas completas, duplicados, sumas y fondo fuera del reparto', () => {
    expect(sociosFundCloud).toContain('function private.assert_money_partners_payload')
    expect(sociosFundCloud).toContain("partner->'amountcop'")
    expect(sociosFundCloud).toContain("new.data->'fundedfromfundcop'")
    expect(sociosFundCloud).toContain('v_partners_total + v_funded > v_total')
    expect(sociosFundCloud).toContain("'name:' || lower(btrim(partner->>'partnername'))")
    expect(sociosFundCloud).toContain('duplicate % partner')
    expect(sociosFundCloud).toContain("errcode = '22023'")
  })

  it('protege material por gramos y el fondo por persona y pagos', () => {
    expect(sociosFundCloud).toContain('function private.assert_material_partners_payload')
    expect(sociosFundCloud).toContain("partner->'grams'")
    expect(sociosFundCloud).toContain('v_partners_grams > v_total_grams')
    expect(sociosFundCloud).toContain('function private.assert_fund_contribution_payload')
    expect(sociosFundCloud).toContain("p_data->'personname'")
    expect(sociosFundCloud).toContain("p_data->>'returnkind'")
    expect(sociosFundCloud).toContain("p_data->'monthlyratepercent'")
    expect(sociosFundCloud).toContain("p_data->'agreedtotalcop'")
    expect(sociosFundCloud).toContain("p_data->'payments'")
    expect(sociosFundCloud).toContain('duplicate fund payment')
    expect(sociosFundCloud).toContain('9007199254740991')
  })

  it('aplica la frontera nueva a toda ruta de escritura, incluidas importaciones', () => {
    for (const table of ['stone_lots', 'material_lots', 'expenses', 'fund_contributions']) {
      expect(sociosFundCloud).toContain(`before insert or update on public.${table}`)
      expect(sociosFundCloud).toContain(`validate_socios_fondo_${table}`)
    }
    expect(sociosFundCloud).toContain('function private.assert_socios_fondo_row_payload')
    expect(sociosFundCloud).toContain('for each row execute function private.assert_socios_fondo_row_payload()')
  })

  it('termina con comprobacion por contenido de los seis cuerpos nuevos', () => {
    expect(sociosFundCloud).toContain("procedure.prosrc like '%etapa9_socios_fondo_v1%'")
    expect(sociosFundCloud).toContain('debe devolver 6')
    for (const name of [
      'assert_money_partners_payload',
      'assert_material_partners_payload',
      'assert_fund_contribution_payload',
      'assert_socios_fondo_row_payload',
      'upsert_fund_contribution',
      'delete_fund_contribution'
    ]) {
      expect(sociosFundCloud).toContain(`'${name}'`)
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

describe('migracion que exige id en ventas y abonos (2026-08-13)', () => {
  it('exige un id no vacio en la venta, el abono y la venta de joya', () => {
    expect(saleIdentifiers).toContain('assert_stone_sale_identifiers')
    expect(saleIdentifiers).toContain('assert_stock_jewel_sale_identifier')
    expect(saleIdentifiers).toContain("private.is_nonblank_string(sale->'id')")
    expect(saleIdentifiers).toContain("private.is_nonblank_string(payment->'id')")
    expect(saleIdentifiers).toContain("private.is_nonblank_string(p_data->'sale'->'id')")
    expect(saleIdentifiers).toContain('stone sale requires an id')
    expect(saleIdentifiers).toContain('buyer payment requires an id')
    expect(saleIdentifiers).toContain('stock jewel sale requires an id')
  })

  it('rechaza ids repetidos, que confundirian el emparejamiento de la tasa', () => {
    expect(saleIdentifiers).toContain('duplicate stone sale id')
    expect(saleIdentifiers).toContain('duplicate buyer payment id')
    expect(saleIdentifiers.match(/having count\(\*\) > 1/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it('engancha las comprobaciones en las dos funciones protegidas', () => {
    expect(saleIdentifiers).toContain('perform private.assert_stone_sale_identifiers(p_data)')
    expect(saleIdentifiers).toContain('perform private.assert_stock_jewel_sale_identifier(p_data)')
    // Redefinir la funcion no puede perder ninguna comprobacion que ya existia.
    for (const previa of [
      'perform private.assert_stone_lot_payload(p_id, p_data, p_updated_at)',
      'perform private.assert_stone_lot_cutting_payload(p_id, p_data, p_updated_at)',
      'perform private.assert_stone_lot_internal_uses_payload(p_data)',
      'perform private.assert_stone_internal_uses_preserved(p_id, p_data)',
      'perform private.assert_stock_jewel_payload(p_id, p_data, p_updated_at)',
      'perform private.assert_stock_jewel_c2_payload(p_data)',
      'perform private.assert_stock_transformations_preserved(p_id, p_data)',
    ]) {
      expect(saleIdentifiers).toContain(previa)
    }
  })

  it('usa revoke all y nunca la forma debil que abrio el hueco de TRUNCATE', () => {
    expect(saleIdentifiers).toContain('revoke all on function')
    expect(saleIdentifiers).not.toContain('revoke insert, update, delete')
    expect(saleIdentifiers).toContain(
      'grant execute on function public.upsert_stone_lot(text, jsonb, timestamptz) to authenticated'
    )
    expect(saleIdentifiers).toContain(
      'grant execute on function public.upsert_stock_jewel(text, jsonb, timestamptz) to authenticated'
    )
  })

  it('no toca datos ya guardados: solo valida escrituras', () => {
    // Los comentarios explican el hueco de TRUNCATE del 2026-08-10, asi que se
    // miran las sentencias reales y no el texto de la cabecera.
    const sentencias = saleIdentifiers
      .split('\n')
      .filter((linea) => !linea.trimStart().startsWith('--'))
      .join('\n')
    expect(sentencias).not.toContain('update public.stone_lots set')
    expect(sentencias).not.toContain('update public.stock_jewels set')
    expect(sentencias).not.toContain('delete from public.')
    expect(sentencias).not.toContain('truncate')
    // El unico insert permitido es el que ya hacia la funcion protegida.
    expect(sentencias.match(/insert into public\./g)).toHaveLength(2)
  })
})

describe('migracion de cupo beta y borrado de cuenta (2026-08-13)', () => {
  it('pone un tope configurable, sin obligar a una migracion nueva para cambiarlo', () => {
    expect(betaLimits).toContain('create table if not exists public.platform_limits')
    expect(betaLimits).toContain('max_organizations')
    expect(betaLimits).toContain('values (true, 20)')
    expect(betaLimits).toContain('beta capacity reached')
    // Un tope nulo significa "sin tope": hay que poder abrir la beta sin migrar.
    expect(betaLimits).toContain('if v_max is not null and')
  })

  it('conserva intactas las comprobaciones que create_organization ya hacia', () => {
    for (const previa of [
      "raise exception 'authentication required'",
      "raise exception 'invalid organization name'",
      "raise exception 'user already belongs to an organization'",
      'insert into public.organizations (name)',
      'insert into public.memberships (user_id, organization_id, role)',
      'insert into public.org_counters (organization_id, quote_seq)',
      'insert into public.org_settings (organization_id, data, updated_at)',
    ]) {
      expect(betaLimits).toContain(previa)
    }
  })

  it('el borrado exige ser dueno y escribir el nombre exacto de la joyeria', () => {
    expect(betaLimits).toContain('create or replace function public.delete_my_organization')
    expect(betaLimits).toContain("m.role = 'owner'")
    expect(betaLimits).toContain("raise exception 'only the owner can delete the jewelry'")
    expect(betaLimits).toContain("raise exception 'deletion confirmation does not match'")
    expect(betaLimits).toContain('is distinct from btrim(coalesce(v_name')
  })

  it('deja constancia con conteos, y nunca con datos de clientes', () => {
    expect(betaLimits).toContain('create table if not exists public.deletion_records')
    expect(betaLimits).toContain('insert into public.deletion_records')
    // El alcance se cuenta antes de borrar: despues no queda nada que contar.
    const alcance = betaLimits.indexOf('into v_scope')
    const borrado = betaLimits.indexOf('delete from public.organizations where id = v_organization_id')
    expect(alcance).toBeGreaterThan(0)
    expect(borrado).toBeGreaterThan(alcance)
    // La constancia guarda conteos, no nombres ni contactos de clientes.
    for (const columna of ['clients', 'quotes', 'stonelots', 'expenses', 'fundcontributions']) {
      expect(betaLimits).toContain(`'${columna}', (select count(*)`)
    }
  })

  it('las tablas nuevas no quedan al alcance de una sesion cualquiera', () => {
    expect(betaLimits).toContain('alter table public.platform_limits enable row level security')
    expect(betaLimits).toContain('alter table public.deletion_records enable row level security')
    expect(betaLimits).toContain('revoke all on table public.platform_limits from public, anon, authenticated')
    expect(betaLimits).toContain('revoke all on table public.deletion_records from public, anon, authenticated')
    expect(betaLimits).not.toContain('revoke insert, update, delete')
  })
})

const TABLAS_CON_CANDADO = [
  'org_settings', 'org_counters', 'clients', 'quotes', 'appointments',
  'stone_lots', 'suppliers', 'buyers', 'stock_jewels',
  'material_partners', 'material_lots', 'expenses', 'fund_contributions',
]

describe('migracion del modo solo lectura (2026-08-14)', () => {
  it('pone el candado en la TABLA y no en cada funcion, que es lo que no se puede rodear', () => {
    // 31 funciones publicas de escritura: comprobar en cada una deja el sistema
    // a merced de que ninguna se olvide. El disparador atrapa cualquier camino.
    expect(readOnly).toContain('create or replace function private.enforce_read_only')
    for (const tabla of TABLAS_CON_CANDADO) {
      expect(readOnly, tabla).toContain(`'${tabla}'`)
    }
    expect(readOnly).toContain('before insert or update or delete')
    expect(readOnly).toContain('for each row execute function private.enforce_read_only')
  })

  it('distingue DELETE de INSERT: en un borrado no existe la fila nueva', () => {
    expect(readOnly).toContain("if tg_op = 'delete' then")
    expect(readOnly).toContain('v_fila := to_jsonb(old)')
    expect(readOnly).toContain('v_fila := to_jsonb(new)')
  })

  it('no bloquea respaldos, importacion ni soporte', () => {
    // Sin usuario autenticado es service_role o conexion directa: si esta rama
    // se cierra, un respaldo sobre una cuenta suspendida falla.
    expect(readOnly).toContain('if auth.uid() is null then')
  })

  it('bloquear es una decision explicita, nunca un olvido', () => {
    // Sin fila en organization_billing la joyeria escribe: el estado por defecto
    // jamas puede dejar a un cliente encerrado por descuido.
    expect(readOnly).toContain("status text not null default 'activa'")
    expect(readOnly).toContain("check (status in ('activa', 'solo_lectura'))")
    expect(readOnly).toContain("if v_status = 'solo_lectura' then")
  })

  it('deja intactas la lectura y la exportacion, que los terminos garantizan siempre', () => {
    const sentencias = readOnly.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n')
    // El disparador solo se engancha a escrituras.
    expect(sentencias).not.toContain('before select')
    expect(sentencias).not.toContain('after select')
    // La joyeria puede leer su propio estado para que la app se lo explique.
    expect(readOnly).toContain('grant select on table public.organization_billing to authenticated')
    expect(sentencias).not.toContain('revoke insert, update, delete')
  })
})

describe('migracion del control de equipos (2026-08-14)', () => {
  it('guarda exactamente lo que promete la politica de privacidad, y nada mas', () => {
    expect(devices).toContain('create table if not exists public.device_sessions')
    for (const columna of ['organization_id', 'user_id', 'device_id', 'first_seen_at', 'last_seen_at']) {
      expect(devices, columna).toContain(columna)
    }
  })

  it('NO guarda navegador, IP, ubicacion ni actividad: la promesa es verificable', () => {
    // Agregar cualquiera de estos exige cambiar antes la politica de privacidad
    // y volver a pedir aceptacion. La prueba existe para que nadie lo haga solo.
    const definicion = devices.slice(
      devices.indexOf('create table if not exists public.device_sessions'),
      devices.indexOf('create index')
    )
    for (const prohibido of ['user_agent', 'ip_address', 'ip ', 'latitude', 'longitude', 'location', 'referrer', 'url']) {
      expect(definicion, prohibido).not.toContain(prohibido)
    }
  })

  it('el servidor decide la joyeria; el navegador nunca la envia', () => {
    expect(devices).toContain('v_organization_id := private.current_organization_id()')
    expect(devices).toContain("raise exception 'authentication required'")
    expect(devices).toContain("raise exception 'invalid device identifier'")
  })

  it('el informe es solo del operador: una joyeria no puede ver a las demas', () => {
    expect(devices).toContain('revoke all on table public.device_sessions from public, anon, authenticated')
    expect(devices).toContain('grant execute on function public.device_usage_report(integer) to service_role')
    expect(devices).not.toContain('grant execute on function public.device_usage_report(integer) to authenticated')
  })

  it('el umbral senala, no bloquea', () => {
    expect(devices).toContain('supera_umbral')
    expect(devices).toContain('count(distinct d.device_id) > 3')
    // No debe existir ninguna excepcion por exceso de equipos.
    expect(devices).not.toContain('too many devices')
  })

  it('usa revoke all, nunca la forma debil que abrio el hueco de TRUNCATE', () => {
    expect(devices).toContain('revoke all on function')
    expect(devices).not.toContain('revoke insert, update, delete')
  })
})

describe('acceso del operador a las tablas de operacion (2026-08-14)', () => {
  it('devuelve a service_role lo que necesita en cada tabla', () => {
    expect(operatorAccess).toContain(
      'grant select, insert, update, delete on table public.organization_billing to service_role'
    )
    expect(operatorAccess).toContain('on table public.platform_limits to service_role')
    expect(operatorAccess).toContain('on table public.deletion_records to service_role')
    expect(operatorAccess).toContain('on table public.device_sessions to service_role')
  })

  it('no le devuelve nada a una sesion normal', () => {
    // La correccion no puede aprovecharse para abrir lo que estaba cerrado.
    const sentencias = operatorAccess
      .split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n')
    expect(sentencias).not.toContain('to authenticated')
    expect(sentencias).not.toContain('to anon')
    expect(sentencias).not.toContain('to public')
  })

  it('mantiene minimo privilegio: nadie recibe grant all', () => {
    const sentencias = operatorAccess
      .split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n')
    expect(sentencias).not.toContain('grant all')
    // Las constancias solo se leen: reescribirlas destruiria su valor probatorio.
    expect(operatorAccess).toContain('grant select on table public.deletion_records to service_role')
  })

  it('ninguna tabla de operacion queda al alcance de anon', () => {
    for (const fuente of [betaLimits, readOnly, devices]) {
      expect(fuente).toContain('from public, anon, authenticated')
    }
  })
})
