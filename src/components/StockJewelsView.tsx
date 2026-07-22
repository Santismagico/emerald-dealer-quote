// JOYAS EN STOCK (D-044): piezas ya fabricadas que están en vitrina para
// vender. No pasan por el cotizador ni por el Taller y se venden SIEMPRE de
// contado. El estado "vendida" no se guarda: se deriva de tener venta.
//
// Todo aquí es INTERNO. El costo y el resultado nunca salen a un documento
// del cliente porque estas piezas no generan ninguno.

import { useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import type { PieceType, StockJewel, StockJewelSale } from '../types';
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
import { fileToCompressedDataUrl } from '../utils/images';
import { formatDateCO, todayISO } from '../utils/dates';
import { formatCOP } from '../utils/money';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  MoneyInput,
  Select,
  SectionCard,
  SummaryRow,
  TextArea,
  TextInput
} from './ui';

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

export function StockJewelsView() {
  const store = useStore();
  const today = todayISO();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<JewelFilter>('disponibles');
  const [editing, setEditing] = useState<StockJewel | null>(null);
  const [selling, setSelling] = useState<{ jewel: StockJewel; sale: StockJewelSale } | null>(null);
  const [toDelete, setToDelete] = useState<StockJewel | null>(null);
  const [toUndoSale, setToUndoSale] = useState<StockJewel | null>(null);
  const [error, setError] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(
    () => filterStockJewels(store.stockJewels, search, filter),
    [store.stockJewels, search, filter]
  );
  const counts = useMemo(
    () => countStockJewels(store.stockJewels, search),
    [store.stockJewels, search]
  );
  const flow = useMemo(() => stockJewelsFlow(store.stockJewels), [store.stockJewels]);

  const buyerOptions = [
    { value: '', label: 'Escribir el nombre' },
    ...store.buyers.map((b) => ({ value: b.id, label: b.name }))
  ];

  const pickPhoto = async (files: FileList | null) => {
    if (!files || files.length === 0 || !editing) return;
    setError('');
    try {
      setEditing({ ...editing, photo: await fileToCompressedDataUrl(files[0]) });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'No se pudo procesar la foto.');
    }
  };

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
          <Field label="Notas">
            <TextArea
              value={sale.notes}
              onChange={(notes) => setSelling({ jewel, sale: { ...sale, notes } })}
            />
          </Field>

          {sale.priceCop > 0 ? (
            <div className="space-y-1 rounded-xl bg-stone-50 p-3">
              <SummaryRow label="Le costó" value={formatCOP(jewel.costCop)} />
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

      <Button full onClick={() => setEditing(emptyStockJewel(today, new Date().toISOString()))}>
        ＋ Nueva pieza
      </Button>

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
              <li key={jewel.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
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
                    {summary.sold && jewel.sale ? (
                      <>
                        <SummaryRow
                          label={`Vendida el ${formatDateCO(jewel.sale.date)}`}
                          value={formatCOP(jewel.sale.priceCop)}
                        />
                        {jewel.sale.buyer ? (
                          <SummaryRow label="Comprador" value={jewel.sale.buyer} />
                        ) : null}
                        <SummaryRow
                          label="Resultado"
                          value={formatCOP(summary.resultCop)}
                          bold
                          valueClass={summary.resultCop < 0 ? 'text-red-600' : 'text-brand-800'}
                        />
                      </>
                    ) : (
                      <>
                        <SummaryRow label="La pide en" value={formatCOP(jewel.priceCop)} />
                        <SummaryRow label="Le costó" value={formatCOP(jewel.costCop)} />
                      </>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 border-t border-stone-100 pt-3">
                    {summary.sold ? (
                      <button
                        type="button"
                        className="min-h-10 flex-1 rounded-lg text-sm font-medium text-stone-600 active:bg-stone-100"
                        onClick={() => setToUndoSale(jewel)}
                      >
                        Deshacer venta
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="min-h-10 flex-1 rounded-lg text-sm font-semibold text-brand-800 active:bg-brand-50"
                        onClick={() => {
                          setError('');
                          setSelling({
                            jewel,
                            sale: { ...emptyStockJewelSale(today), priceCop: jewel.priceCop }
                          });
                        }}
                      >
                        Vender
                      </button>
                    )}
                    <button
                      type="button"
                      className="min-h-10 flex-1 rounded-lg text-sm font-medium text-brand-800 active:bg-brand-50"
                      onClick={() => {
                        setError('');
                        setEditing(jewel);
                      }}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="min-h-10 flex-1 rounded-lg text-sm font-medium text-red-600 active:bg-red-50"
                      onClick={() => setToDelete(jewel)}
                    >
                      Eliminar
                    </button>
                  </div>
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
