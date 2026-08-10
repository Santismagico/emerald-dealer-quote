// Sección Materiales (D-048): inventario del oro (u otro material) por lotes.
// Cada compra crea un lote rastreable con su reparto de propiedad (parte suya,
// parte del socio); cada salida descuenta gramos. Existencias y reparto se
// DERIVAN, nunca se guarda un contador a mano. Todo interno: el material no
// entra en documentos del cliente ni toca el cotizador.

import { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { MaterialLot, MaterialLotPartner, MaterialUse } from '../types';
import {
  countMaterialLots,
  emptyMaterialLot,
  emptyMaterialUse,
  filterMaterialLots,
  materialLotDisplayName,
  materialLotPartners,
  materialsFlow,
  materialsInventory,
  summarizeMaterialLot,
  validateMaterialLot,
  validateMaterialUse,
  withMaterialUse,
  withoutMaterialUse,
  type MaterialFilter
} from '../services/materials';
import { splitMaterialByGrams, validateMaterialPartners } from '../services/partnership';
import { formatDateCO, todayISO } from '../utils/dates';
import { formatCOP } from '../utils/money';
import { newId } from '../utils/id';
import {
  Button,
  ConfirmDialog,
  DecimalInput,
  EmptyState,
  Field,
  MoneyInput,
  SectionCard,
  Select,
  SummaryRow,
  TextArea,
  TextInput
} from './ui';

const FILTERS: Array<{ value: MaterialFilter; label: string }> = [
  { value: 'existencias', label: 'Con existencias' },
  { value: 'agotados', label: 'Agotados' },
  { value: 'todos', label: 'Todos' }
];

function formatGrams(grams: number): string {
  return `${grams.toLocaleString('es-CO', { maximumFractionDigits: 3 })} g`;
}

/** Nombres de los socios de un lote, para mostrar. Sirve para uno o para varios. */
function partnerNames(lot: MaterialLot): string {
  const names = materialLotPartners(lot).map((partner) => partner.partnerName.trim() || 'socio');
  if (names.length === 0) return 'el socio';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

export function MaterialsView() {
  const store = useStore();
  const lots = store.materialLots;
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<MaterialFilter>('existencias');
  const [lotForm, setLotForm] = useState<MaterialLot | null>(null);
  const [detailLotId, setDetailLotId] = useState<string | null>(null);

  const flow = useMemo(() => materialsFlow(lots), [lots]);
  const inventory = useMemo(() => materialsInventory(lots), [lots]);
  const filtered = useMemo(() => filterMaterialLots(lots, search, filter), [lots, search, filter]);
  const counts = useMemo(() => countMaterialLots(lots, search), [lots, search]);

  return (
    <div className="space-y-4">
      <Button full onClick={() => setLotForm(emptyMaterialLot(todayISO(), new Date().toISOString()))}>
        ＋ Nueva compra de material
      </Button>

      <SectionCard title="Material disponible">
        <SummaryRow label="Total en existencia" value={formatGrams(flow.totalRemainingGrams)} />
        <SummaryRow label="De eso, tuyo" value={formatGrams(flow.myRemainingGrams)} bold valueClass="text-brand-800" />
        {flow.sharedRemainingGrams > 0 && (
          <SummaryRow label="Compartido con socios" value={formatGrams(flow.sharedRemainingGrams)} />
        )}
      </SectionCard>

      {inventory.length > 0 && (
        <SectionCard title="Existencias" subtitle="Lo que queda por tipo y pureza.">
          <ul className="space-y-2">
            {inventory.map((entry) => (
              <li key={`${entry.materialType}-${entry.purity}`} className="rounded-xl bg-stone-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-stone-800">
                    {entry.materialType}
                    {entry.purity ? ` ${entry.purity}` : ''}
                  </span>
                  <span className="text-sm font-semibold text-brand-800">
                    {formatGrams(entry.remainingGrams)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-stone-500">
                  {formatGrams(entry.myRemainingGrams)} tuyos · en {entry.activeLots}{' '}
                  {entry.activeLots === 1 ? 'lote' : 'lotes'}
                </p>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <TextInput value={search} onChange={setSearch} placeholder="Buscar por material, pureza o socio…" />

      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-2 pb-1">
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`whitespace-nowrap rounded-full px-3.5 py-2 text-sm ${
                filter === value
                  ? 'border border-brand-600 bg-brand-600 font-semibold text-white'
                  : 'border border-stone-200 bg-white text-stone-600'
              }`}
            >
              {label} ({counts[value]})
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Sin material"
          message={
            lots.length === 0
              ? 'Registra tu primera compra de oro u otro material: cada compra crea un lote y de ahí descuentas lo que uses.'
              : 'Ningún lote coincide con la búsqueda o el filtro.'
          }
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((lot) => (
            <li key={lot.id}>
              <MaterialCard lot={lot} onOpen={() => setDetailLotId(lot.id)} />
            </li>
          ))}
        </ul>
      )}

      {lotForm !== null && (
        <MaterialLotForm
          key={lotForm.id}
          initial={lotForm}
          isNew={!lots.some((l) => l.id === lotForm.id)}
          onClose={() => setLotForm(null)}
        />
      )}

      {detailLotId !== null && (
        <MaterialLotDetail lotId={detailLotId} onClose={() => setDetailLotId(null)} />
      )}
    </div>
  );
}

function MaterialCard({ lot, onOpen }: { lot: MaterialLot; onOpen: () => void }) {
  const summary = summarizeMaterialLot(lot);
  return (
    <button
      type="button"
      className="block w-full rounded-2xl bg-white p-4 text-left shadow-sm"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-stone-900">{materialLotDisplayName(lot)}</p>
          <p className="truncate text-xs text-stone-500">
            {formatDateCO(lot.purchaseDate)}
            {summary.shared ? ` · con ${partnerNames(lot)}` : ''}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            summary.exhausted ? 'bg-stone-200 text-stone-600' : 'bg-emerald-100 text-emerald-800'
          }`}
        >
          {summary.exhausted ? 'Agotado' : 'Con existencias'}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="font-semibold text-brand-800">{formatGrams(summary.remainingGrams)}</span>
        <span className="text-xs text-stone-500">
          {summary.shared
            ? `${formatGrams(summary.myRemainingGrams)} tuyos`
            : 'todo tuyo'}
        </span>
      </div>
    </button>
  );
}

function MaterialLotForm({
  initial,
  isNew,
  onClose
}: {
  initial: MaterialLot;
  isNew: boolean;
  onClose: () => void;
}) {
  const store = useStore();
  const [form, setForm] = useState<MaterialLot>(initial);
  const [busy, setBusy] = useState(false);

  const patch = (partial: Partial<MaterialLot>) => setForm((current) => ({ ...current, ...partial }));

  // Sociedad en GRAMOS (D-049 + D-073). Un lote guardado con el modelo de socio
  // único se convierte al abrirlo, para poder editarlo sin perder nada.
  const lotPartners = useMemo(() => materialLotPartners(form), [form]);

  const split = useMemo(
    () => splitMaterialByGrams({ totalGrams: form.grams, partners: lotPartners }),
    [form.grams, lotPartners]
  );

  const setLotPartners = (partners: MaterialLotPartner[]) => patch({ partners });

  const addLotPartner = () =>
    setLotPartners([...lotPartners, { id: newId(), partnerId: null, partnerName: '', grams: 0 }]);

  const removeLotPartner = (index: number) =>
    setLotPartners(lotPartners.filter((_, position) => position !== index));

  const patchLotPartner = (index: number, partial: Partial<MaterialLotPartner>) =>
    setLotPartners(
      lotPartners.map((partner, position) =>
        position === index ? { ...partner, ...partial } : partner
      )
    );

  const selectLotPartner = (index: number, personId: string) => {
    const person = store.materialPartners.find((item) => item.id === personId);
    patchLotPartner(
      index,
      person ? { partnerId: person.id, partnerName: person.name } : { partnerId: null }
    );
  };

  const save = async () => {
    const partnersError = validateMaterialPartners({
      totalGrams: form.grams,
      partners: lotPartners
    });
    if (partnersError) {
      store.showToast(partnersError);
      return;
    }
    // Los gramos propios se DERIVAN del reparto, nunca se escriben a mano.
    const normalized: MaterialLot = { ...form, partners: lotPartners, myGrams: split.myGrams };
    const error = validateMaterialLot(normalized);
    if (error) {
      store.showToast(error);
      return;
    }
    setBusy(true);
    try {
      await store.upsertMaterialLot({ ...normalized, updatedAt: new Date().toISOString() });
      store.showToast(isNew ? 'Material guardado' : 'Material actualizado');
      onClose();
    } catch {
      store.showToast('No se pudo guardar. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-full w-full max-w-sm overflow-y-auto overscroll-contain rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-stone-900">
          {isNew ? 'Nueva compra de material' : 'Editar compra'}
        </h3>
        <div className="mt-4 space-y-3">
          <Field label="Nombre del lote (opcional)">
            <TextInput
              value={form.name}
              onChange={(name) => patch({ name })}
              placeholder="Ej: Oro con el socio, julio"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Material *">
              <TextInput
                value={form.materialType}
                onChange={(materialType) => patch({ materialType })}
                placeholder="Oro"
              />
            </Field>
            <Field label="Pureza / ley">
              <TextInput
                value={form.purity}
                onChange={(purity) => patch({ purity })}
                placeholder="18K"
              />
            </Field>
          </div>
          <Field label="Gramos comprados *">
            <DecimalInput value={form.grams} onValue={(grams) => patch({ grams })} suffix="g" />
          </Field>
          <Field label="Costo total (opcional)" hint="Referencia interna. No entra a la caja de los cierres.">
            <MoneyInput value={form.costCop} onValue={(costCop) => patch({ costCop })} />
          </Field>
          <Field label="Fecha de compra">
            <TextInput
              type="date"
              value={form.purchaseDate}
              onChange={(purchaseDate) => patch({ purchaseDate })}
            />
          </Field>

          {/* Propiedad compartida en GRAMOS (D-049 + D-073): sin socios, el
              lote es 100% suyo. Los gramos propios se derivan del reparto. */}
          <div className="rounded-2xl bg-stone-50 p-3">
            <p className="text-sm font-semibold text-stone-800">De quién es este oro</p>
            <p className="mt-0.5 text-xs text-stone-500">
              Escribe cuántos gramos son de cada socio. Lo tuyo y el porcentaje se calculan solos.
            </p>

            {lotPartners.map((partner, index) => (
              <div key={partner.id} className="mt-3 rounded-xl bg-white p-3 shadow-sm">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <Field label={`Socio ${index + 1}`}>
                      <Select
                        value={partner.partnerId ?? '__libre__'}
                        onChange={(value) => selectLotPartner(index, value)}
                        options={[
                          ...(partner.partnerId === null
                            ? [
                                {
                                  value: '__libre__',
                                  label: partner.partnerName.trim() || 'Elige a quién'
                                }
                              ]
                            : []),
                          ...store.materialPartners.map((person) => ({
                            value: person.id,
                            label: person.name
                          }))
                        ]}
                      />
                    </Field>
                  </div>
                  <button
                    type="button"
                    aria-label={`Quitar a ${partner.partnerName.trim() || 'este socio'}`}
                    className="mt-7 min-h-11 min-w-11 shrink-0 rounded-lg text-red-600 active:bg-red-50"
                    onClick={() => removeLotPartner(index)}
                  >
                    ✕
                  </button>
                </div>
                {partner.partnerId === null ? (
                  <Field label="Nombre del socio">
                    <TextInput
                      value={partner.partnerName}
                      onChange={(partnerName) => patchLotPartner(index, { partnerName })}
                      placeholder="Nombre del socio"
                    />
                  </Field>
                ) : null}
                <Field
                  label="Cuántos gramos son suyos"
                  hint={
                    partner.grams > 0 && form.grams > 0
                      ? `Le corresponde el ${(split.partners[index]?.percent ?? 0).toFixed(1)}% del lote`
                      : 'Escribe los gramos de este socio.'
                  }
                >
                  <DecimalInput
                    value={partner.grams}
                    onValue={(grams) => patchLotPartner(index, { grams })}
                    suffix="g"
                  />
                </Field>
              </div>
            ))}

            <div className="mt-3">
              <Button variant="secondary" full onClick={addLotPartner}>
                + Añadir socio
              </Button>
            </div>

            <div className="mt-2 border-t border-stone-200 pt-2">
              <SummaryRow
                label="Lo tuyo"
                value={`${formatGrams(split.myGrams)}${
                  form.grams > 0 ? ` · ${split.myPercent.toFixed(1)}%` : ''
                }`}
                bold
              />
              {split.overDeclared ? (
                <p className="mt-1 text-xs font-medium text-red-600">
                  Los socios suman más gramos de los que tiene el lote.
                </p>
              ) : null}
            </div>
          </div>

          <Field label="Notas internas">
            <TextArea value={form.notes} onChange={(notes) => patch({ notes })} rows={2} />
          </Field>
        </div>
        <div className="mt-5 flex gap-3">
          <div className="flex-1">
            <Button variant="ghost" full disabled={busy} onClick={onClose}>
              Cancelar
            </Button>
          </div>
          <div className="flex-1">
            <Button full disabled={busy} onClick={() => void save()}>
              Guardar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MaterialLotDetail({ lotId, onClose }: { lotId: string; onClose: () => void }) {
  const store = useStore();
  const lot = store.materialLots.find((l) => l.id === lotId);
  const [useForm, setUseForm] = useState<MaterialUse | null>(null);
  const [useToDelete, setUseToDelete] = useState<MaterialUse | null>(null);
  const [busy, setBusy] = useState(false);

  if (!lot) {
    onClose();
    return null;
  }
  const summary = summarizeMaterialLot(lot);

  const saveUse = async () => {
    if (!useForm) return;
    const error = validateMaterialUse(lot, useForm, lot.uses.some((u) => u.id === useForm.id) ? useForm.id : undefined);
    if (error) {
      store.showToast(error);
      return;
    }
    setBusy(true);
    try {
      await store.upsertMaterialLot(withMaterialUse(lot, useForm, new Date().toISOString()));
      store.showToast('Salida registrada');
      setUseForm(null);
    } catch {
      store.showToast('No se pudo guardar la salida. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-full w-full max-w-sm overflow-y-auto overscroll-contain rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-stone-900">
              {materialLotDisplayName(lot)}
            </h3>
            <p className="text-xs text-stone-500">
              {lot.materialType}
              {lot.purity ? ` ${lot.purity}` : ''} · {formatDateCO(lot.purchaseDate)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            className="min-h-10 min-w-10 shrink-0 rounded-lg text-stone-500 active:bg-stone-100"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-1 rounded-xl bg-stone-50 p-3">
          <SummaryRow label="Comprado" value={formatGrams(lot.grams)} />
          <SummaryRow label="Usado" value={formatGrams(summary.usedGrams)} />
          <SummaryRow label="Queda" value={formatGrams(summary.remainingGrams)} bold valueClass="text-brand-800" />
          {summary.shared ? (
            <>
              <SummaryRow label={`Tuyo (${summary.myPercent}%)`} value={formatGrams(summary.myRemainingGrams)} />
              <SummaryRow
                label={`De ${partnerNames(lot)}`}
                value={formatGrams(summary.partnerRemainingGrams)}
              />
            </>
          ) : null}
          {lot.costCop > 0 ? <SummaryRow label="Costo del lote" value={formatCOP(lot.costCop)} /> : null}
        </div>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-stone-500">
          Salidas del lote ({lot.uses.length})
        </p>
        {lot.uses.length === 0 ? (
          <p className="mt-1 rounded-xl bg-stone-50 p-3 text-xs text-stone-500">
            Aún no has registrado salidas de este lote.
          </p>
        ) : (
          <ul className="mt-1 space-y-2">
            {lot.uses.map((use) => (
              <li key={use.id} className="flex items-center justify-between gap-2 rounded-xl bg-stone-50 p-3">
                <button type="button" className="min-h-10 min-w-0 flex-1 text-left" onClick={() => setUseForm(use)}>
                  <p className="text-sm font-medium text-stone-800">{formatGrams(use.grams)}</p>
                  <p className="text-xs text-stone-500">
                    {formatDateCO(use.date)}
                    {use.notes ? ` · ${use.notes}` : ''}
                  </p>
                </button>
                <button
                  type="button"
                  aria-label="Eliminar salida"
                  className="min-h-10 min-w-10 shrink-0 rounded-lg text-red-600 active:bg-red-50"
                  onClick={() => setUseToDelete(use)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        {!summary.exhausted && (
          <div className="mt-3">
            <Button variant="ghost" full onClick={() => setUseForm(emptyMaterialUse(todayISO()))}>
              ＋ Registrar salida
            </Button>
          </div>
        )}

        <div className="mt-4 border-t border-stone-100 pt-3">
          <button
            type="button"
            className="min-h-11 w-full rounded-lg text-sm font-medium text-red-600 active:bg-red-50"
            onClick={() => setUseToDelete({ id: '__lot__', date: '', grams: 0, notes: '' })}
          >
            Eliminar todo el lote
          </button>
        </div>
      </div>

      {useForm !== null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-full w-full max-w-sm overflow-y-auto overscroll-contain rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-stone-900">
              {lot.uses.some((u) => u.id === useForm.id) ? 'Editar salida' : 'Registrar salida'}
            </h3>
            <p className="mt-1 text-sm text-stone-600">
              Disponible: {formatGrams(summary.remainingGrams)}
            </p>
            <div className="mt-4 space-y-3">
              <Field label="Gramos que salieron">
                <DecimalInput
                  value={useForm.grams}
                  onValue={(grams) => setUseForm({ ...useForm, grams })}
                  suffix="g"
                />
              </Field>
              <Field label="Fecha">
                <TextInput
                  type="date"
                  value={useForm.date}
                  onChange={(date) => setUseForm({ ...useForm, date })}
                />
              </Field>
              <Field label="¿En qué se usó?">
                <TextInput
                  value={useForm.notes}
                  onChange={(notes) => setUseForm({ ...useForm, notes })}
                  placeholder="Argolla de Fulano, venta…"
                />
              </Field>
            </div>
            <div className="mt-5 flex gap-3">
              <div className="flex-1">
                <Button variant="ghost" full disabled={busy} onClick={() => setUseForm(null)}>
                  Cancelar
                </Button>
              </div>
              <div className="flex-1">
                <Button full disabled={busy} onClick={() => void saveUse()}>
                  Guardar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={useToDelete !== null}
        title={useToDelete?.id === '__lot__' ? 'Eliminar lote' : 'Eliminar salida'}
        message={
          useToDelete?.id === '__lot__'
            ? `¿Eliminar el lote "${materialLotDisplayName(lot)}"? Se borrará la compra y sus ${lot.uses.length} salida(s). Esta acción no se puede deshacer.`
            : `¿Eliminar la salida de ${formatGrams(useToDelete?.grams ?? 0)}? Esos gramos vuelven a quedar disponibles.`
        }
        confirmLabel="Eliminar"
        danger
        busy={busy}
        onCancel={() => setUseToDelete(null)}
        onConfirm={async () => {
          if (!useToDelete) return;
          setBusy(true);
          try {
            if (useToDelete.id === '__lot__') {
              await store.removeMaterialLot(lot.id);
              store.showToast('Lote eliminado');
              setUseToDelete(null);
              onClose();
            } else {
              await store.upsertMaterialLot(
                withoutMaterialUse(lot, useToDelete.id, new Date().toISOString())
              );
              store.showToast('Salida eliminada');
              setUseToDelete(null);
            }
          } catch {
            store.showToast('No se pudo eliminar. Intenta de nuevo.');
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
