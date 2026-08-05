// JOYAS EN STOCK (D-044): piezas ya fabricadas que están en vitrina para
// vender. No pasan por el cotizador ni por el Taller y se venden SIEMPRE de
// contado. El estado "vendida" no se guarda: se deriva de tener venta.
//
// La gestión sigue siendo INTERNA. El catálogo cliente sale únicamente por la
// lista blanca de services/catalog.ts; costo, resultado y notas no llegan al PDF.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import type {
  PieceType,
  StockJewel,
  StockJewelSale,
  StockJewelStoneKind,
  StoneLot,
  StoneOrigin
} from '../types';
import { PIECE_TYPES } from '../types';
import {
  countStockJewels,
  emptyStockJewel,
  emptyStockJewelSale,
  filterStockJewels,
  jewelDisplayName,
  stockJewelsFlow,
  summarizeStockJewel,
  validateStockJewel,
  validateStockJewelSale,
  withJewelSale,
  withoutJewelSale,
  type JewelFilter,
  type StockJewelDisplayStatus
} from '../services/stockJewels';
import {
  attributedStoneCostCop,
  type StoneJewelTransformationInput
} from '../services/stoneJewelTransformation';
import { lotDisplayName, summarizeStoneLot } from '../services/stones';
import { fileToCompressedDataUrl } from '../utils/images';
import { formatDateCO, todayISO } from '../utils/dates';
import { newId } from '../utils/id';
import { formatCOP } from '../utils/money';
import { activeProductTypes } from '../services/productTypes';
import {
  formatOperationMoney,
  newOperationUsdRate,
  resolveUsdRatePrefill,
  storedUsdRateSource,
  usdRateLabel,
  type CurrencyView
} from '../services/currency';
import {
  Button,
  ConfirmDialog,
  DecimalInput,
  EmptyState,
  Field,
  FormDialog,
  MoneyInput,
  SegmentedControl,
  Select,
  SectionCard,
  SummaryRow,
  TextArea,
  TextInput
} from './ui';
import { CurrencyToggle } from './CurrencyToggle';
import { StockJewelCatalogView } from './StockJewelCatalogView';

const STATUS_CHIP: Record<StockJewelDisplayStatus, string> = {
  disponible: 'bg-emerald-100 text-emerald-800',
  apartada: 'bg-amber-100 text-amber-800',
  vendida: 'bg-stone-200 text-stone-700'
};

const FILTERS: Array<{ key: JewelFilter; label: string }> = [
  { key: 'disponibles', label: 'En vitrina' },
  { key: 'vendidas', label: 'Vendidas' },
  { key: 'todas', label: 'Todas' }
];

const STONE_KIND_LABEL: Record<StockJewelStoneKind, string> = {
  '': 'Sin registrar',
  fantasia: 'Fantasía',
  natural: 'Natural'
};

function historicalNumber(value: number, suffix = ''): string {
  if (!Number.isFinite(value) || value <= 0) return 'Sin registrar';
  return `${value.toLocaleString('es-CO', { maximumFractionDigits: 3 })}${suffix}`;
}

function formatCarats(value: number): string {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  return `${safe.toLocaleString('es-CO', { maximumFractionDigits: 3 })} ct`;
}

export function StockJewelsView() {
  const store = useStore();
  const today = todayISO();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<JewelFilter>('disponibles');
  const [editing, setEditing] = useState<StockJewel | null>(null);
  const [selling, setSelling] = useState<{ jewel: StockJewel; sale: StockJewelSale } | null>(null);
  const [transforming, setTransforming] = useState<StockJewel | null>(null);
  const [toDelete, setToDelete] = useState<StockJewel | null>(null);
  const [toUndoSale, setToUndoSale] = useState<StockJewel | null>(null);
  const [error, setError] = useState('');
  const [currencyView, setCurrencyView] = useState<CurrencyView>('COP');
  const [rateSource, setRateSource] = useState('');
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [recentlySoldId, setRecentlySoldId] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const rateTouchedRef = useRef(false);
  const rateRequestIdRef = useRef('');

  const visible = useMemo(
    () => filterStockJewels(store.stockJewels, search, filter),
    [store.stockJewels, search, filter]
  );
  const counts = useMemo(
    () => countStockJewels(store.stockJewels, search),
    [store.stockJewels, search]
  );
  const flow = useMemo(() => stockJewelsFlow(store.stockJewels), [store.stockJewels]);

  useEffect(() => {
    if (!recentlySoldId || selling !== null) return;
    const frame = window.requestAnimationFrame(() => {
      const target = Array.from(
        document.querySelectorAll<HTMLElement>('[data-stock-jewel-id]')
      ).find((element) => element.dataset.stockJewelId === recentlySoldId);
      if (!target) return;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'nearest' });
      setRecentlySoldId(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [recentlySoldId, selling, visible]);

  const buyerOptions = [
    { value: '', label: 'Escribir el nombre' },
    ...store.buyers.map((b) => ({ value: b.id, label: b.name }))
  ];

  const startSale = (jewel: StockJewel) => {
    rateTouchedRef.current = false;
    const sale = {
      ...emptyStockJewelSale(
        today,
        newOperationUsdRate(store.settings.lastKnownUsdRate)
      ),
      priceCop: jewel.priceCop
    };
    rateRequestIdRef.current = sale.id;
    setError('');
    setRateSource(
      storedUsdRateSource(sale.usdRate, store.settings.usdRateUpdatedAt)
    );
    setSelling({ jewel, sale });
    void store.refreshUsdRate()
      .then((snapshot) => {
        if (rateRequestIdRef.current !== sale.id) return;
        setSelling((current) => current?.sale.id === sale.id
          ? {
              ...current,
              sale: {
                ...current.sale,
                usdRate: resolveUsdRatePrefill(
                  current.sale.usdRate,
                  snapshot.rate,
                  rateTouchedRef.current
                )
              }
            }
          : current);
        if (!rateTouchedRef.current) setRateSource('Tasa vigente consultada');
      })
      .catch(() => {
        if (rateRequestIdRef.current === sale.id && !rateTouchedRef.current) {
          setRateSource(
            storedUsdRateSource(
              sale.usdRate,
              store.settings.usdRateUpdatedAt,
              true
            )
          );
        }
      });
  };

  if (catalogOpen) {
    return (
      <StockJewelCatalogView
        jewels={store.stockJewels}
        settings={store.settings}
        generatedDate={today}
        onClose={() => setCatalogOpen(false)}
      />
    );
  }

  const pickPhoto = async (files: FileList | null) => {
    if (!files || files.length === 0 || !editing) return;
    setError('');
    try {
      setEditing({ ...editing, photo: await fileToCompressedDataUrl(files[0]) });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'No se pudo procesar la foto.');
    }
  };

  if (transforming) {
    return (
      <StockJewelTransformationForm
        jewel={transforming}
        onClose={() => setTransforming(null)}
      />
    );
  }

  // ---------- Formulario de pieza ----------
  if (editing) {
    const isNew = !store.stockJewels.some((j) => j.id === editing.id);
    return (
      <div className="space-y-4">
        <SectionCard title={isNew ? 'Nueva pieza en vitrina' : 'Editar pieza'}>
          <Field label="Nombre de la pieza *">
            <TextInput
              value={editing.name}
              onChange={(name) => setEditing({ ...editing, name })}
              placeholder="Anillo esmeralda oval"
            />
          </Field>
          <Field label="Tipo">
            <Select
              value={editing.pieceType}
              onChange={(pieceType) =>
                setEditing({ ...editing, pieceType: pieceType as PieceType })
              }
              options={PIECE_TYPES.map((t) => ({ value: t, label: t }))}
            />
          </Field>
          <Field label="Material">
            <TextInput
              value={editing.material}
              onChange={(material) => setEditing({ ...editing, material })}
              placeholder="Oro 18K"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Peso total">
              <DecimalInput
                value={editing.weightGrams}
                onValue={(weightGrams) => setEditing({ ...editing, weightGrams })}
                suffix="g"
              />
            </Field>
            <Field label="Número de piedras">
              {!isNew && editing.stoneTransformations.length > 0 ? (
                <p className="min-h-12 rounded-xl bg-stone-100 px-3 py-3 text-base text-stone-700">
                  {editing.stoneCount}
                </p>
              ) : (
                <DecimalInput
                  value={editing.stoneCount}
                  onValue={(stoneCount) => setEditing({ ...editing, stoneCount })}
                />
              )}
            </Field>
          </div>
          <Field
            label="Talla o medida"
            hint="Texto libre: talla del anillo, largo, diámetro u otra medida."
          >
            <TextInput
              value={editing.size}
              onChange={(size) => setEditing({ ...editing, size })}
              placeholder="Ej. talla 7, 45 cm, diámetro 18 mm"
            />
          </Field>
          <Field
            label="Clase de piedra"
            hint={
              !isNew && editing.stoneKind === 'fantasia'
                ? 'El cambio a natural se registra desde la ficha de la joya para descontar el lote correcto.'
                : !isNew && editing.stoneKind === 'natural'
                  ? 'Una joya natural conserva esta clasificación.'
                  : undefined
            }
          >
            {!isNew && editing.stoneKind !== '' ? (
              <p className="min-h-12 rounded-xl bg-stone-100 px-3 py-3 text-base text-stone-700">
                {STONE_KIND_LABEL[editing.stoneKind]}
              </p>
            ) : (
              <Select
                value={editing.stoneKind}
                onChange={(stoneKind) =>
                  setEditing({
                    ...editing,
                    stoneKind: stoneKind as StockJewelStoneKind
                  })
                }
                options={[
                  { value: '', label: 'Sin registrar' },
                  { value: 'fantasia', label: 'Fantasía' },
                  { value: 'natural', label: 'Natural' }
                ]}
              />
            )}
          </Field>
          <Field label="Entró al inventario *" hint="El día en que pagó por la pieza.">
            <TextInput
              type="date"
              value={editing.acquiredDate}
              onChange={(acquiredDate) => setEditing({ ...editing, acquiredDate })}
            />
          </Field>
          <Field label="Cuánto le costó" hint="Interno. Nunca aparece en un documento del cliente.">
            <MoneyInput
              value={editing.costCop}
              onValue={(costCop) => setEditing({ ...editing, costCop })}
            />
          </Field>
          <Field label="En cuánto la vende *">
            <MoneyInput
              value={editing.priceCop}
              onValue={(priceCop) => setEditing({ ...editing, priceCop })}
            />
          </Field>
          <Field label="Estado">
            <Select
              value={editing.status}
              onChange={(status) =>
                setEditing({ ...editing, status: status === 'apartada' ? 'apartada' : 'disponible' })
              }
              options={[
                { value: 'disponible', label: 'Disponible' },
                { value: 'apartada', label: 'Apartada' }
              ]}
            />
          </Field>

          <Field label="Foto">
            <div className="space-y-2">
              {editing.photo ? (
                <div className="relative">
                  <img
                    src={editing.photo}
                    alt={editing.name || 'Pieza'}
                    className="h-44 w-full rounded-xl object-cover"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-2 min-h-11 rounded-lg bg-black/60 px-3 text-sm font-medium text-white"
                    onClick={() => setEditing({ ...editing, photo: '' })}
                  >
                    Quitar
                  </button>
                </div>
              ) : null}
              {/* Clic programático: en la PWA instalada de Android un input
                  oculto dentro de un label puede no abrir el selector. */}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void pickPhoto(e.target.files);
                  e.target.value = '';
                }}
              />
              <Button variant="ghost" full onClick={() => photoInputRef.current?.click()}>
                {editing.photo ? 'Cambiar foto' : '＋ Agregar foto'}
              </Button>
            </div>
          </Field>

          <Field label="Notas">
            <TextArea
              value={editing.notes}
              onChange={(notes) => setEditing({ ...editing, notes })}
            />
          </Field>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex gap-3 pt-1">
            <div className="flex-1">
              <Button
                variant="ghost"
                full
                onClick={() => {
                  setEditing(null);
                  setError('');
                }}
              >
                Cancelar
              </Button>
            </div>
            <div className="flex-1">
              <Button
                full
                onClick={async () => {
                  const problem = validateStockJewel(editing);
                  if (problem) {
                    setError(problem);
                    return;
                  }
                  await store.upsertStockJewel({
                    ...editing,
                    name: editing.name.trim(),
                    updatedAt: new Date().toISOString()
                  });
                  store.showToast('Pieza guardada');
                  setEditing(null);
                  setError('');
                }}
              >
                Guardar
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>
    );
  }

  // ---------- Formulario de venta ----------
  if (selling) {
    const { jewel, sale } = selling;
    const isNewSale = jewel.sale?.id !== sale.id;
    const productTypeOptions = [
      { value: '', label: 'Selecciona un tipo' },
      ...[...new Set([
        ...activeProductTypes(store.settings.productTypes),
        ...(sale.productType ? [sale.productType] : [])
      ])].map((name) => ({ value: name, label: name }))
    ];
    return (
      <div className="space-y-4">
        <SectionCard
          title="Vender la pieza"
          subtitle={`${jewelDisplayName(jewel)} · la pide en ${formatCOP(jewel.priceCop)}`}
        >
          <Field label="Fecha de la venta *">
            <TextInput
              type="date"
              value={sale.date}
              onChange={(date) => setSelling({ jewel, sale: { ...sale, date } })}
            />
          </Field>
          <Field label="¿A quién le vendió?">
            <Select
              value={sale.buyerId ?? ''}
              onChange={(buyerId) => {
                const buyer = store.buyers.find((b) => b.id === buyerId);
                setSelling({
                  jewel,
                  sale: {
                    ...sale,
                    buyerId: buyer ? buyer.id : null,
                    buyer: buyer ? buyer.name : sale.buyer
                  }
                });
              }}
              options={buyerOptions}
            />
          </Field>
          {sale.buyerId === null ? (
            <Field label="Nombre del comprador">
              <TextInput
                value={sale.buyer}
                onChange={(buyer) => setSelling({ jewel, sale: { ...sale, buyer } })}
                placeholder="Nombre de quien la compró"
              />
            </Field>
          ) : null}
          <Field label="¿Cuánto recibió? *" hint="Las joyas en vitrina se venden de contado.">
            <MoneyInput
              value={sale.priceCop}
              onValue={(priceCop) => setSelling({ jewel, sale: { ...sale, priceCop } })}
            />
          </Field>
          <Field label="Tipo de producto">
            <Select
              value={sale.productType}
              onChange={(productType) =>
                setSelling({ jewel, sale: { ...sale, productType } })
              }
              options={productTypeOptions}
            />
          </Field>
          <Field
            label="Tasa USD/COP"
            hint={isNewSale
              ? `${rateSource}. Puedes ajustarla manualmente antes de guardar.`
              : 'Quedó fijada al registrar la venta.'}
          >
            {isNewSale ? (
              <DecimalInput
                value={sale.usdRate ?? 0}
                onValue={(value) => {
                  rateTouchedRef.current = true;
                  setRateSource('Tasa escrita manualmente');
                  setSelling({
                    jewel,
                    sale: { ...sale, usdRate: value > 0 ? value : null }
                  });
                }}
                suffix="COP"
              />
            ) : (
              <p className="min-h-11 rounded-xl bg-stone-100 px-3 py-3 text-sm text-stone-700">
                {usdRateLabel(sale.usdRate)}
              </p>
            )}
          </Field>
          <Field label="¿Cómo le pagaron? *">
            <TextInput
              value={sale.method}
              onChange={(method) => setSelling({ jewel, sale: { ...sale, method } })}
              placeholder="Efectivo, transferencia, Nequi…"
            />
          </Field>
          <Field label="¿Quién recibió el dinero? *">
            <TextInput
              value={sale.receivedBy}
              onChange={(receivedBy) => setSelling({ jewel, sale: { ...sale, receivedBy } })}
              placeholder="Nombre de quien recibió"
            />
          </Field>
          <Field label="Notas">
            <TextArea
              value={sale.notes}
              onChange={(notes) => setSelling({ jewel, sale: { ...sale, notes } })}
            />
          </Field>

          {sale.priceCop > 0 ? (
            <div className="space-y-1 rounded-xl bg-stone-50 p-3">
              <SummaryRow label="Costo total" value={formatCOP(jewel.costCop)} />
              <SummaryRow
                label="Resultado"
                value={formatCOP(sale.priceCop - jewel.costCop)}
                bold
                valueClass={
                  sale.priceCop - jewel.costCop < 0 ? 'text-red-600' : 'text-brand-800'
                }
              />
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex gap-3 pt-1">
            <div className="flex-1">
              <Button
                variant="ghost"
                full
                onClick={() => {
                  rateRequestIdRef.current = '';
                  setSelling(null);
                  setError('');
                }}
              >
                Cancelar
              </Button>
            </div>
            <div className="flex-1">
              <Button
                full
                onClick={async () => {
                  const problem = validateStockJewelSale(jewel, sale);
                  if (problem) {
                    setError(problem);
                    return;
                  }
                  await store.upsertStockJewel(
                    withJewelSale(jewel, sale, new Date().toISOString())
                  );
                  store.showToast('Venta registrada');
                  setSearch('');
                  setFilter('vendidas');
                  setRecentlySoldId(jewel.id);
                  setSelling(null);
                  setError('');
                }}
              >
                Registrar venta
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>
    );
  }

  // ---------- Lista ----------
  return (
    <div className="space-y-4">
      <section className="luxury-card rounded-2xl p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-stone-500">En vitrina</p>
            <p className="text-xl font-semibold text-stone-900">{flow.availableCount}</p>
            <p className="text-xs text-stone-500">pide {formatCOP(flow.inventoryPriceCop)}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Ya vendidas</p>
            <p className="text-xl font-semibold text-stone-900">{flow.soldCount}</p>
            <p className="text-xs text-stone-500">recibió {formatCOP(flow.totalSoldCop)}</p>
          </div>
        </div>
      </section>

      <CurrencyToggle value={currencyView} onChange={setCurrencyView} />
      <p className="text-[11px] text-stone-500">
        Solo cambia cada venta con su propia tasa. Los totales combinados siguen en COP.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button full onClick={() => setEditing(emptyStockJewel(today, new Date().toISOString()))}>
          ＋ Nueva pieza
        </Button>
        <Button variant="secondary" full onClick={() => setCatalogOpen(true)}>
          Crear catálogo PDF
        </Button>
      </div>

      <TextInput value={search} onChange={setSearch} placeholder="Buscar pieza…" />

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`min-h-11 flex-1 rounded-xl border px-2 text-xs font-semibold ${
              filter === f.key
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-stone-200 bg-white text-stone-600'
            }`}
          >
            {f.label} ({counts[f.key]})
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="Sin piezas"
          message="Registre aquí las joyas ya fabricadas que tiene para vender. No pasan por el cotizador ni por el Taller."
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((jewel) => {
            const summary = summarizeStockJewel(jewel);
            return (
              <li
                key={jewel.id}
                data-stock-jewel-id={jewel.id}
                tabIndex={-1}
                className="overflow-hidden rounded-2xl bg-white shadow-sm outline-none"
              >
                {jewel.photo ? (
                  <img
                    src={jewel.photo}
                    alt={jewelDisplayName(jewel)}
                    className="h-40 w-full object-cover"
                  />
                ) : null}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-stone-900">
                        {jewelDisplayName(jewel)}
                      </p>
                      <p className="text-xs text-stone-500">
                        {[jewel.pieceType, jewel.material].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                        STATUS_CHIP[summary.displayStatus]
                      }`}
                    >
                      {summary.displayStatus}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1">
                    <SummaryRow
                      label="Peso"
                      value={historicalNumber(jewel.weightGrams, ' g')}
                    />
                    <SummaryRow
                      label="Talla o medida"
                      value={jewel.size?.trim() || 'Sin registrar'}
                    />
                    <SummaryRow
                      label="Número de piedras"
                      value={historicalNumber(jewel.stoneCount)}
                    />
                    <SummaryRow
                      label="Clase de piedra"
                      value={STONE_KIND_LABEL[jewel.stoneKind] ?? 'Sin registrar'}
                    />
                    {summary.sold && jewel.sale ? (
                      <>
                        <SummaryRow
                          label={`Vendida el ${formatDateCO(jewel.sale.date)}`}
                          value={formatOperationMoney(
                            jewel.sale.priceCop,
                            jewel.sale.usdRate,
                            currencyView
                          )}
                        />
                        <SummaryRow
                          label="Tipo de producto"
                          value={jewel.sale.productType || 'Sin registrar'}
                        />
                        <SummaryRow label="Tasa" value={usdRateLabel(jewel.sale.usdRate)} />
                        {jewel.sale.buyer ? (
                          <SummaryRow label="Comprador" value={jewel.sale.buyer} />
                        ) : null}
                        <SummaryRow
                          label="Medio de pago"
                          value={jewel.sale.method || 'Sin registrar'}
                        />
                        <SummaryRow
                          label="Recibió"
                          value={jewel.sale.receivedBy || 'Sin registrar'}
                        />
                        <SummaryRow label="Costo total" value={formatCOP(jewel.costCop)} />
                        <SummaryRow
                          label="Resultado"
                          value={formatCOP(summary.resultCop)}
                          bold
                          valueClass={summary.resultCop < 0 ? 'text-red-600' : 'text-brand-800'}
                        />
                        {jewel.sale.notes ? (
                          <p className="break-words rounded-xl bg-stone-50 p-3 text-xs text-stone-600">
                            <span className="font-semibold">Nota de la venta:</span>{' '}
                            {jewel.sale.notes}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <SummaryRow label="La pide en" value={formatCOP(jewel.priceCop)} />
                        <SummaryRow label="Costo total" value={formatCOP(jewel.costCop)} />
                      </>
                    )}
                  </div>

                  {(jewel.stoneTransformations?.length ?? 0) > 0 ? (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                        Historia de la piedra
                      </p>
                      <p className="mt-1 text-xs text-stone-600">
                        Esta joya empezó con fantasía y ahora lleva piedra natural.
                      </p>
                      <ul className="mt-2 space-y-2">
                        {(jewel.stoneTransformations ?? []).map((transformation) => {
                          const lot = store.stoneLots.find(
                            (candidate) => candidate.id === transformation.lotId
                          );
                          return (
                            <li key={transformation.id} className="rounded-lg bg-white/80 p-2">
                              <p className="break-words text-xs font-medium text-stone-800">
                                {formatDateCO(transformation.date)} ·{' '}
                                {lot ? lotDisplayName(lot) : `Lote ${transformation.lotId}`}
                              </p>
                              <p className="break-words text-xs text-stone-600">
                                {transformation.origin === 'tallado' ? 'Tallado' : 'Bruto'} ·{' '}
                                {formatCarats(transformation.carats)} ·{' '}
                                {transformation.quantity} piedra(s)
                              </p>
                              <p className="text-xs text-stone-600">
                                Costo atribuido: {formatCOP(transformation.costCop)}
                              </p>
                              {transformation.notes ? (
                                <p className="break-words text-xs text-stone-500">
                                  Nota: {transformation.notes}
                                </p>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2 border-t border-stone-100 pt-3">
                    {!summary.sold && jewel.stoneKind === 'fantasia' ? (
                      <button
                        type="button"
                        className="min-h-11 w-full shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-800 active:bg-emerald-100"
                        onClick={() => {
                          setError('');
                          setTransforming(jewel);
                        }}
                      >
                        Cambiar a piedra natural
                      </button>
                    ) : null}
                    {summary.sold && jewel.sale ? (
                      <>
                        <button
                          type="button"
                          className="min-h-11 basis-[calc(50%-0.25rem)] flex-1 rounded-lg border border-brand-200 bg-brand-50 px-2 text-sm font-semibold text-brand-900 active:bg-brand-100"
                          onClick={() => {
                            setError('');
                            rateRequestIdRef.current = '';
                            rateTouchedRef.current = true;
                            setSelling({ jewel, sale: jewel.sale! });
                          }}
                        >
                          Editar venta
                        </button>
                        <button
                          type="button"
                          className="min-h-11 basis-[calc(50%-0.25rem)] flex-1 rounded-lg border border-stone-300 bg-white px-2 text-sm font-semibold text-stone-700 active:bg-stone-100"
                          onClick={() => setToUndoSale(jewel)}
                        >
                          Deshacer venta
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="min-h-11 basis-[calc(50%-0.25rem)] flex-1 rounded-lg border border-brand-200 bg-brand-50 px-2 text-sm font-semibold text-brand-900 active:bg-brand-100"
                        onClick={() => {
                          startSale(jewel);
                        }}
                      >
                        Vender
                      </button>
                    )}
                    <button
                      type="button"
                      className="min-h-11 basis-[calc(50%-0.25rem)] flex-1 rounded-lg border border-brand-200 bg-white px-2 text-sm font-semibold text-brand-900 active:bg-brand-50"
                      onClick={() => {
                        setError('');
                        setEditing(jewel);
                      }}
                    >
                      {summary.sold ? 'Editar pieza' : 'Editar'}
                    </button>
                    <button
                      type="button"
                      disabled={(jewel.stoneTransformations?.length ?? 0) > 0}
                      className="min-h-11 basis-[calc(50%-0.25rem)] flex-1 rounded-lg border border-red-200 bg-red-50 px-2 text-sm font-semibold text-red-700 active:bg-red-100 disabled:cursor-not-allowed disabled:border-stone-200 disabled:bg-stone-50 disabled:text-stone-300"
                      onClick={() => setToDelete(jewel)}
                    >
                      Eliminar
                    </button>
                  </div>
                  {(jewel.stoneTransformations?.length ?? 0) > 0 ? (
                    <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                      Esta joya no se puede eliminar porque su piedra natural está unida al
                      inventario de Piedras.
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Eliminar pieza"
        message={`¿Eliminar ${toDelete ? jewelDisplayName(toDelete) : 'la pieza'} del inventario? Si ya se vendió, esa venta también desaparecerá de los cierres.`}
        confirmLabel="Eliminar"
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete) {
            await store.removeStockJewel(toDelete.id);
            store.showToast('Pieza eliminada');
          }
          setToDelete(null);
        }}
      />

      <ConfirmDialog
        open={toUndoSale !== null}
        title="Deshacer la venta"
        message={`¿Devolver ${toUndoSale ? jewelDisplayName(toUndoSale) : 'la pieza'} a la vitrina? El dinero de esa venta dejará de contar en los cierres.`}
        confirmLabel="Deshacer venta"
        danger
        onCancel={() => setToUndoSale(null)}
        onConfirm={async () => {
          if (toUndoSale) {
            await store.upsertStockJewel(withoutJewelSale(toUndoSale, new Date().toISOString()));
            store.showToast('Venta deshecha');
          }
          setToUndoSale(null);
        }}
      />
    </div>
  );
}

function originHasInventory(lot: StoneLot, origin: StoneOrigin): boolean {
  const summary = summarizeStoneLot(lot);
  return origin === 'tallado'
    ? summary.cutAvailableCarats > 0 && summary.cutAvailableQuantity > 0
    : summary.rawAvailableCarats > 0 && summary.rawAvailableQuantity > 0;
}

function preferredOrigin(lot: StoneLot): StoneOrigin {
  return originHasInventory(lot, 'bruto') ? 'bruto' : 'tallado';
}

function StockJewelTransformationForm({
  jewel,
  onClose
}: {
  jewel: StockJewel;
  onClose: () => void;
}) {
  const store = useStore();
  const availableLots = useMemo(
    () =>
      store.stoneLots.filter(
        (lot) => originHasInventory(lot, 'bruto') || originHasInventory(lot, 'tallado')
      ),
    [store.stoneLots]
  );
  const initialLot = availableLots[0] ?? null;
  const [form, setForm] = useState<StoneJewelTransformationInput>(() => ({
    id: newId(),
    date: todayISO(),
    lotId: initialLot?.id ?? '',
    jewelId: jewel.id,
    origin: initialLot ? preferredOrigin(initialLot) : 'bruto',
    carats: 0,
    quantity: jewel.stoneCount > 0 ? jewel.stoneCount : 0,
    notes: ''
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selectedLot = availableLots.find((lot) => lot.id === form.lotId) ?? null;
  const selectedSummary = selectedLot ? summarizeStoneLot(selectedLot) : null;
  const attributedCost =
    selectedLot && form.carats > 0
      ? attributedStoneCostCop(selectedLot, form.carats)
      : 0;

  const patch = (partial: Partial<StoneJewelTransformationInput>) =>
    setForm((current) => ({ ...current, ...partial }));

  const save = async () => {
    if (!selectedLot) {
      setError('Necesitas un lote con piedras disponibles para hacer el cambio.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await store.transformStockJewelToNatural(form);
      store.showToast('Piedra natural registrada');
      onClose();
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : 'No se pudo registrar el cambio. Intenta de nuevo.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialog
      title="Cambiar a piedra natural"
      description={jewelDisplayName(jewel)}
      busy={busy}
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <div className="flex-1">
            <Button variant="ghost" full disabled={busy} onClick={onClose}>
              Cancelar
            </Button>
          </div>
          <div className="flex-1">
            <Button full disabled={busy || !selectedLot} onClick={() => void save()}>
              Guardar cambio
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
          La piedra natural se descontará del lote elegido y su costo se sumará a la joya.
          Este historial queda protegido y no se puede deshacer.
        </p>

        <Field label="Fecha del cambio *">
          <TextInput
            type="date"
            value={form.date}
            onChange={(date) => patch({ date })}
          />
        </Field>

        <Field label="Lote de la piedra natural *">
          <Select
            value={form.lotId}
            onChange={(lotId) => {
              const lot = availableLots.find((candidate) => candidate.id === lotId);
              patch({
                lotId,
                origin: lot ? preferredOrigin(lot) : 'bruto'
              });
            }}
            options={
              availableLots.length > 0
                ? availableLots.map((lot) => ({ value: lot.id, label: lotDisplayName(lot) }))
                : [{ value: '', label: 'No hay lotes con existencias' }]
            }
          />
        </Field>

        {selectedLot && selectedSummary ? (
          <>
            <SegmentedControl
              label="Origen dentro del lote"
              value={form.origin}
              options={[
                {
                  value: 'bruto',
                  label: 'En bruto',
                  disabled: !originHasInventory(selectedLot, 'bruto')
                },
                {
                  value: 'tallado',
                  label: 'Tallada',
                  disabled: !originHasInventory(selectedLot, 'tallado')
                }
              ]}
              onChange={(origin) => patch({ origin: origin as StoneOrigin })}
            />
            <p className="rounded-xl bg-stone-50 p-3 text-xs text-stone-600">
              Disponible en bruto: {formatCarats(selectedSummary.rawAvailableCarats)}
              {' · '}{selectedSummary.rawAvailableQuantity} piedra(s)
              <br />
              Disponible tallado: {formatCarats(selectedSummary.cutAvailableCarats)}
              {' · '}{selectedSummary.cutAvailableQuantity} piedra(s)
            </p>
          </>
        ) : (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            Primero registra o completa un lote con piedras disponibles en el área Piedras.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Quilates usados *">
            <DecimalInput
              value={form.carats}
              onValue={(carats) => patch({ carats })}
              suffix="ct"
            />
          </Field>
          <Field label="N.º de piedras *">
            <DecimalInput
              value={form.quantity}
              onValue={(quantity) => patch({ quantity })}
            />
          </Field>
        </div>

        <div className="space-y-1 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
          <SummaryRow
            label="Costo atribuido (calculado)"
            value={form.carats > 0 ? formatCOP(attributedCost) : 'Pendiente'}
          />
          <SummaryRow label="Costo actual de la joya" value={formatCOP(jewel.costCop)} />
          <SummaryRow
            label="Costo nuevo de la joya"
            value={formatCOP(jewel.costCop + attributedCost)}
            bold
            valueClass="text-brand-800"
          />
          <p className="pt-1 text-[11px] text-stone-500">
            El costo se calcula automáticamente desde el lote. No mueve dinero de caja.
          </p>
        </div>

        <Field label="Notas internas">
          <TextArea
            value={form.notes}
            onChange={(notes) => patch({ notes })}
            rows={2}
            placeholder="Detalle del cambio de piedra"
          />
        </Field>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </FormDialog>
  );
}
