// Sección Materiales (D-048): inventario del oro (u otro material) por lotes.
// Cada compra crea un lote rastreable con su reparto de propiedad (parte suya,
// parte del socio); cada salida descuenta gramos. Existencias y reparto se
// DERIVAN, nunca se guarda un contador a mano. Todo interno: el material no
// entra en documentos del cliente ni toca el cotizador.

import { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { MaterialLot, MaterialUse } from '../types';
import {
  countMaterialLots,
  emptyMaterialLot,
  emptyMaterialUse,
  filterMaterialLots,
  materialLotDisplayName,
  materialsFlow,
  materialsInventory,
  summarizeMaterialLot,
  validateMaterialLot,
  validateMaterialUse,
  withMaterialUse,
  withoutMaterialUse,
  type MaterialFilter
} from '../services/materials';
import { formatDateCO, todayISO } from '../utils/dates';
import { formatCOP } from '../utils/money';
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
  TextInput,
  Toggle
} from './ui';

const FILTERS: Array<{ value: MaterialFilter; label: string }> = [
  { value: 'existencias', label: 'Con existencias' },
  { value: 'agotados', label: 'Agotados' },
  { value: 'todos', label: 'Todos' }
];

function formatGrams(grams: number): string {
  return `${grams.toLocaleString('es-CO', { maximumFractionDigits: 3 })} g`;
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
            {summary.shared ? ` · con ${lot.partnerName || 'socio'}` : ''}
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
  // "Compartido" es una elección de la interfaz, no algo derivado de partnerId:
  // un socio escrito a mano tiene partnerId null pero el lote SÍ es compartido.
  const [shared, setShared] = useState(
    initial.partnerId !== null || initial.partnerName.trim().length > 0
  );

  const patch = (partial: Partial<MaterialLot>) => setForm((current) => ({ ...current, ...partial }));

  const save = async () => {
    const error = validateMaterialLot(form);
    if (error) {
      store.showToast(error);
      return;
    }
    setBusy(true);
    try {
      // Sin socio, todo el lote es suyo: myGrams = grams.
      const normalized = shared ? form : { ...form, myGrams: form.grams };
      await store.upsertMaterialLot({ ...normalized, updatedAt: new Date().toISOString() });
      store.showToast(isNew ? 'Material guardado' : 'Material actualizado');
      onClose();
    } catch {
      store.showToast('No se pudo guardar. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const partnerGrams = Math.max(0, form.grams - form.myGrams);

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

          {/* Propiedad compartida (D-048): sin socio, el lote es 100% suyo. */}
          <Toggle
            checked={shared}
            label="Este oro lo comparto con un socio"
            onChange={(on) => {
              setShared(on);
              if (on) {
                patch({ myGrams: Math.round((form.grams / 2) * 1000) / 1000 });
              } else {
                patch({ partnerId: null, partnerName: '', myGrams: form.grams });
              }
            }}
          />
          {shared ? (
            <>
              <Field label="¿Con quién?">
                <Select
                  value={form.partnerId ?? ''}
                  onChange={(partnerId) => {
                    const partner = store.materialPartners.find((p) => p.id === partnerId);
                    patch({
                      partnerId: partner ? partner.id : null,
                      partnerName: partner ? partner.name : form.partnerName
                    });
                  }}
                  options={[
                    { value: '', label: 'Escribir el nombre' },
                    ...store.materialPartners.map((p) => ({ value: p.id, label: p.name }))
                  ]}
                />
              </Field>
              {form.partnerId === null ? (
                <Field label="Nombre del socio">
                  <TextInput
                    value={form.partnerName}
                    onChange={(partnerName) => patch({ partnerName })}
                    placeholder="Nombre del socio"
                  />
                </Field>
              ) : null}
              <Field label="¿Cuántos gramos son tuyos?">
                <DecimalInput value={form.myGrams} onValue={(myGrams) => patch({ myGrams })} suffix="g" />
              </Field>
              <p className="rounded-xl bg-stone-50 p-3 text-xs text-stone-600">
                De {formatGrams(form.grams)}: {formatGrams(form.myGrams)} tuyos ·{' '}
                {formatGrams(partnerGrams)} del socio.
              </p>
            </>
          ) : null}

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
                label={`De ${lot.partnerName || 'el socio'}`}
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
