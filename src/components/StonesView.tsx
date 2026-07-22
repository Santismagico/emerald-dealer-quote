// Área Piedras: lotes de piedras compradas con sus ventas (decisión D-023:
// cada compra es un lote rastreable y cada venta se descuenta de su lote).
// Todo es INTERNO (COP entero): ni los lotes ni los precios entran jamás en
// un documento del cliente. Existencias y resultado se calculan con motor puro.

import { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { StoneLot, StoneSale, SupplierPayment } from '../types';
import {
  countStoneLots,
  emptyStoneLot,
  emptyStoneSale,
  emptySupplierPayment,
  filterStoneLots,
  isStoneLotValid,
  lotDisplayName,
  stonesFlow,
  stonesInventory,
  summarizeStoneLot,
  summarizeStoneSale,
  validateStoneSale,
  validateStoneLotPurchaseUpdate,
  validateSupplierPayment,
  withLotSale,
  withoutLotSale,
  withSaleCredit,
  withSupplierPayment,
  withoutSupplierPayment,
  type LotFilter
} from '../services/stones';
import { receivableStatus } from '../services/receivables';
import { formatCOP } from '../utils/money';
import { formatDateCO, todayISO } from '../utils/dates';
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

const FILTERS: Array<{ value: LotFilter; label: string }> = [
  { value: 'existencias', label: 'Con existencias' },
  { value: 'agotados', label: 'Agotados' },
  { value: 'todos', label: 'Todos' }
];

function formatCarats(carats: number): string {
  return `${carats.toLocaleString('es-CO', { maximumFractionDigits: 3 })} ct`;
}

export function stoneLotDeletionWarning(lot: StoneLot): string {
  const summary = summarizeStoneLot(lot);
  // Si el lote tiene ventas a crédito sin saldar, borrarlo también borra ese
  // cobro de la pantalla de Cobros. Callarlo sería hacer desaparecer plata
  // que a Héctor le deben (hallazgo H2 de la auditoría propia, 2026-07-22).
  const cobro =
    summary.buyersDebt > 0
      ? ` OJO: también se borrarán ${formatCOP(summary.buyersDebt)} que te deben por ventas a crédito y desaparecerán de Cobros.`
      : '';
  return `¿Eliminar el lote "${lotDisplayName(lot)}"? Se borrará la compra y todo su historial: ${
    lot.sales.length
  } venta(s), ${lot.supplierPayments.length} pago(s) al proveedor y una deuda pendiente de ${formatCOP(
    summary.supplierDebt
  )}.${cobro} Esta acción no se puede deshacer.`;
}

/** Aviso al eliminar una venta: nombra los abonos que se pierden con ella. */
export function stoneSaleDeletionWarning(sale: StoneSale): string {
  const base = `¿Eliminar la venta de ${formatCOP(sale.valueCop)} del ${
    formatDateCO(sale.date) || 'sin fecha'
  }?`;
  if (!sale.onCredit || sale.payments.length === 0) {
    return `${base} Las existencias del lote vuelven a subir.`;
  }
  const summary = summarizeStoneSale(sale);
  return `${base} Se perderán también ${sale.payments.length} abono(s) por ${formatCOP(
    summary.receivedCop
  )} que ya te había pagado${sale.buyer ? ` ${sale.buyer}` : ''}, y el saldo de ${formatCOP(
    summary.balanceCop
  )} desaparecerá de Cobros.`;
}

export function StonesView() {
  const store = useStore();
  const lots = store.stoneLots;
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<LotFilter>('existencias');
  const [lotForm, setLotForm] = useState<StoneLot | null>(null);
  const [detailLotId, setDetailLotId] = useState<string | null>(null);

  const flow = useMemo(() => stonesFlow(lots), [lots]);
  const inventory = useMemo(() => stonesInventory(lots), [lots]);
  const filtered = useMemo(() => filterStoneLots(lots, search, filter), [lots, search, filter]);
  const counts = useMemo(() => countStoneLots(lots, search), [lots, search]);

  return (
    <div className="space-y-4">
      <Button full onClick={() => setLotForm(emptyStoneLot(todayISO(), new Date().toISOString()))}>
        ＋ Nueva compra (lote)
      </Button>

      <SectionCard title="Negocio de piedras">
        <SummaryRow label="Invertido comprando lotes" value={formatCOP(flow.totalSpent)} />
        <SummaryRow label="Vendido (valor acordado)" value={formatCOP(flow.totalEarned)} />
        <SummaryRow label="Ya recibido de verdad" value={formatCOP(flow.totalReceived)} />
        {flow.totalReceivable > 0 && (
          <SummaryRow
            label="Te deben por ventas a crédito"
            value={formatCOP(flow.totalReceivable)}
            bold
            valueClass="text-brand-800"
          />
        )}
        <div className="border-t border-stone-100 pt-1">
          <SummaryRow
            label="Flujo neto (ventas − compras)"
            value={formatCOP(flow.balance)}
            bold
            valueClass={flow.balance < 0 ? 'text-red-600' : 'text-brand-800'}
          />
        </div>
        {flow.totalDebt > 0 && (
          <SummaryRow
            label="Debes a proveedores (crédito)"
            value={formatCOP(flow.totalDebt)}
            bold
            valueClass="text-red-600"
          />
        )}
        <p className="text-[11px] text-stone-400">
          Un flujo negativo es normal mientras tengas lotes comprados sin vender.
        </p>
      </SectionCard>

      {inventory.length > 0 && (
        <SectionCard title="Existencias" subtitle="Lo que queda en tus lotes, por tipo de piedra.">
          <ul className="space-y-2">
            {inventory.map((entry) => (
              <li key={entry.stoneType} className="rounded-xl bg-stone-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-stone-800">{entry.stoneType}</span>
                  <span className="text-sm font-semibold text-brand-800">
                    {formatCarats(entry.remainingCarats)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-stone-500">
                  {entry.remainingQuantity} piedra(s) en {entry.activeLots}{' '}
                  {entry.activeLots === 1 ? 'lote' : 'lotes'}
                </p>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <TextInput value={search} onChange={setSearch} placeholder="Buscar por lote, piedra o persona…" />

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
          title="Sin lotes"
          message={
            lots.length === 0
              ? 'Registra tu primera compra de piedras: cada compra crea un lote y de ahí descuentas cada venta.'
              : 'Ningún lote coincide con la búsqueda o el filtro.'
          }
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((lot) => (
            <li key={lot.id}>
              <LotCard lot={lot} onOpen={() => setDetailLotId(lot.id)} />
            </li>
          ))}
        </ul>
      )}

      {lotForm !== null && (
        <LotForm
          key={lotForm.id}
          initial={lotForm}
          isNew={!lots.some((l) => l.id === lotForm.id)}
          onClose={() => setLotForm(null)}
        />
      )}

      {detailLotId !== null && (
        <LotDetail lotId={detailLotId} onClose={() => setDetailLotId(null)} />
      )}
    </div>
  );
}

function LotCard({ lot, onOpen }: { lot: StoneLot; onOpen: () => void }) {
  const summary = summarizeStoneLot(lot);
  return (
    <button type="button" className="block w-full rounded-2xl bg-white p-4 text-left shadow-sm" onClick={onOpen}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-stone-900">{lotDisplayName(lot)}</p>
          <p className="truncate text-xs text-stone-500">
            {lot.stoneType || 'Sin especificar'} · {formatDateCO(lot.purchaseDate)}
            {lot.supplier ? ` · ${lot.supplier}` : ''}
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
      <div className="mt-2 flex items-center justify-between text-xs text-stone-500">
        <span>
          {summary.exhausted
            ? `Vendido todo (${formatCarats(lot.carats)} · ${lot.quantity} pz)`
            : `Quedan ${formatCarats(summary.remainingCarats)} · ${summary.remainingQuantity} pz de ${formatCarats(lot.carats)} · ${lot.quantity} pz`}
        </span>
        {lot.sales.length > 0 ? (
          <span className={`font-semibold ${summary.result < 0 ? 'text-stone-600' : 'text-brand-800'}`}>
            {summary.exhausted ? 'Resultado: ' : 'Parcial: '}
            {formatCOP(summary.result)}
          </span>
        ) : (
          <span>Sin ventas aún</span>
        )}
      </div>
      {lot.onCredit && summary.supplierDebt > 0 && (
        <p className="mt-1 text-xs font-medium text-red-600">
          Crédito: debes {formatCOP(summary.supplierDebt)} al proveedor
        </p>
      )}
      {lot.onCredit && summary.creditSettled && (
        <p className="mt-1 text-xs font-medium text-brand-700">Crédito saldado ✓</p>
      )}
    </button>
  );
}

/** Detalle de un lote: compra, ventas y acciones. Muestra un solo panel a la vez. */
function LotDetail({ lotId, onClose }: { lotId: string; onClose: () => void }) {
  const store = useStore();
  const [saleForm, setSaleForm] = useState<StoneSale | null>(null);
  const [paymentForm, setPaymentForm] = useState<SupplierPayment | null>(null);
  const [editingLot, setEditingLot] = useState(false);
  const [confirmDeleteLot, setConfirmDeleteLot] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<StoneSale | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<SupplierPayment | null>(null);
  const [busy, setBusy] = useState(false);

  const lot = store.stoneLots.find((l) => l.id === lotId);
  if (!lot) return null;
  const summary = summarizeStoneLot(lot);

  if (editingLot) {
    return <LotForm key={lot.id} initial={lot} isNew={false} onClose={() => setEditingLot(false)} />;
  }
  if (saleForm !== null) {
    return (
      <SaleForm
        key={saleForm.id}
        lot={lot}
        initial={saleForm}
        onClose={() => setSaleForm(null)}
      />
    );
  }
  if (paymentForm !== null) {
    return (
      <SupplierPaymentForm
        key={paymentForm.id}
        lot={lot}
        initial={paymentForm}
        onClose={() => setPaymentForm(null)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-full w-full max-w-sm overflow-y-auto overscroll-contain rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-stone-900">{lotDisplayName(lot)}</h3>
            <p className="text-xs text-stone-500">
              {lot.stoneType || 'Sin especificar'} · {formatDateCO(lot.purchaseDate)}
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

        <div className="mt-3 space-y-1 rounded-xl bg-stone-50 p-3">
          <SummaryRow label="Comprado" value={`${formatCarats(lot.carats)} · ${lot.quantity} pz`} />
          <SummaryRow label="Costo del lote" value={formatCOP(lot.purchaseValueCop)} />
          {lot.supplier ? <SummaryRow label="Proveedor" value={lot.supplier} /> : null}
          <SummaryRow
            label="Vendido"
            value={`${formatCarats(summary.soldCarats)} · ${summary.soldQuantity} pz · ${formatCOP(summary.soldValue)}`}
          />
          <SummaryRow
            label="Queda"
            value={`${formatCarats(summary.remainingCarats)} · ${summary.remainingQuantity} pz`}
          />
          <div className="border-t border-stone-200 pt-1">
            <SummaryRow
              label={summary.exhausted ? 'Resultado del lote' : 'Resultado parcial'}
              value={formatCOP(summary.result)}
              bold
              valueClass={summary.result < 0 ? 'text-red-600' : 'text-brand-800'}
            />
          </div>
          {!summary.exhausted && lot.sales.length > 0 ? (
            <p className="text-[11px] text-stone-400">
              Parcial: aún quedan piedras por vender de este lote.
            </p>
          ) : null}
        </div>

        {lot.description ? <p className="mt-2 text-sm text-stone-600">{lot.description}</p> : null}
        {lot.notes ? <p className="mt-1 text-xs text-stone-500">{lot.notes}</p> : null}

        {lot.onCredit && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Crédito con el proveedor
              </p>
              {summary.creditSettled ? (
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                  Saldado ✓
                </span>
              ) : (
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                  Debes {formatCOP(summary.supplierDebt)}
                </span>
              )}
            </div>
            <div className="mt-2 space-y-1">
              <SummaryRow label="Costo del lote" value={formatCOP(lot.purchaseValueCop)} />
              <SummaryRow label="Pagado al proveedor" value={formatCOP(summary.paidToSupplier)} />
              <SummaryRow
                label="Pendiente"
                value={formatCOP(summary.supplierDebt)}
                bold
                valueClass={summary.supplierDebt > 0 ? 'text-red-600' : 'text-brand-800'}
              />
            </div>
            {lot.supplierPayments.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {lot.supplierPayments.map((payment) => (
                  <li key={payment.id} className="flex items-center justify-between gap-2 rounded-lg bg-white p-2">
                    <button
                      type="button"
                      className="min-h-11 min-w-0 flex-1 text-left"
                      onClick={() => setPaymentForm(payment)}
                    >
                      <p className="text-sm font-medium text-stone-800">{formatCOP(payment.amount)}</p>
                      <p className="text-xs text-stone-500">
                        {formatDateCO(payment.date)}
                        {payment.notes ? ` · ${payment.notes}` : ''}
                      </p>
                    </button>
                    <button
                      type="button"
                      aria-label="Eliminar pago"
                      className="min-h-10 min-w-10 shrink-0 rounded-lg text-red-600 active:bg-red-50"
                      onClick={() => setPaymentToDelete(payment)}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!summary.creditSettled && (
              <div className="mt-2">
                <Button
                  variant="secondary"
                  full
                  onClick={() => setPaymentForm(emptySupplierPayment(todayISO()))}
                >
                  ＋ Registrar pago al proveedor
                </Button>
              </div>
            )}
          </div>
        )}

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-stone-500">
          Ventas del lote ({lot.sales.length})
        </p>
        {lot.sales.length === 0 ? (
          <p className="mt-1 rounded-xl bg-stone-50 p-3 text-xs text-stone-500">
            Aún no has vendido piedras de este lote.
          </p>
        ) : (
          <ul className="mt-1 space-y-2">
            {lot.sales.map((sale) => (
              <li key={sale.id} className="rounded-xl bg-stone-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="min-h-11 min-w-0 flex-1 text-left"
                    onClick={() => setSaleForm(sale)}
                  >
                    <p className="text-sm font-medium text-stone-800">
                      {formatCOP(sale.valueCop)}
                      <span className="font-normal text-stone-500">
                        {' '}
                        · {formatCarats(sale.carats)} · {sale.quantity} pz
                      </span>
                    </p>
                    <p className="text-xs text-stone-500">
                      {formatDateCO(sale.date)}
                      {sale.buyer ? ` · ${sale.buyer}` : ''}
                    </p>
                    {sale.onCredit ? (
                      <p
                        className={`text-xs font-medium ${
                          summarizeStoneSale(sale).balanceCop > 0 &&
                          receivableStatus(sale.dueDate, todayISO()) === 'vencido'
                            ? 'text-red-600'
                            : 'text-stone-600'
                        }`}
                      >
                        {summarizeStoneSale(sale).balanceCop > 0
                          ? `Le debe ${formatCOP(summarizeStoneSale(sale).balanceCop)} · pagan el ${formatDateCO(sale.dueDate)}`
                          : 'Crédito ya pagado ✓'}
                      </p>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    aria-label="Eliminar venta"
                    className="min-h-10 min-w-10 shrink-0 rounded-lg text-red-600 active:bg-red-50"
                    onClick={() => setSaleToDelete(sale)}
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 space-y-2">
          {!summary.exhausted && (
            <Button full onClick={() => setSaleForm(emptyStoneSale(todayISO()))}>
              ＋ Registrar venta
            </Button>
          )}
          <div className="flex gap-2">
            <div className="flex-1">
              <Button variant="secondary" full onClick={() => setEditingLot(true)}>
                Editar compra
              </Button>
            </div>
            <div className="flex-1">
              <Button variant="danger" full onClick={() => setConfirmDeleteLot(true)}>
                Eliminar lote
              </Button>
            </div>
          </div>
          <Button variant="ghost" full onClick={onClose}>
            Cerrar
          </Button>
        </div>

        <ConfirmDialog
          open={confirmDeleteLot}
          title="Eliminar lote"
          message={stoneLotDeletionWarning(lot)}
          confirmLabel="Eliminar"
          danger
          busy={busy}
          onCancel={() => setConfirmDeleteLot(false)}
          onConfirm={async () => {
            setBusy(true);
            try {
              await store.removeStoneLot(lot.id);
              store.showToast('Lote eliminado');
              setConfirmDeleteLot(false);
              onClose();
            } catch {
              store.showToast('No se pudo eliminar el lote. Intenta de nuevo.');
            } finally {
              setBusy(false);
            }
          }}
        />

        <ConfirmDialog
          open={paymentToDelete !== null}
          title="Eliminar pago al proveedor"
          message={`¿Eliminar el pago de ${formatCOP(paymentToDelete?.amount ?? 0)} del ${
            formatDateCO(paymentToDelete?.date ?? '') || 'sin fecha'
          }? La deuda del lote vuelve a subir.`}
          confirmLabel="Eliminar"
          danger
          busy={busy}
          onCancel={() => setPaymentToDelete(null)}
          onConfirm={async () => {
            if (!paymentToDelete) return;
            setBusy(true);
            try {
              await store.upsertStoneLot(
                withoutSupplierPayment(lot, paymentToDelete.id, new Date().toISOString())
              );
              store.showToast('Pago eliminado');
              setPaymentToDelete(null);
            } catch {
              store.showToast('No se pudo eliminar el pago. Intenta de nuevo.');
            } finally {
              setBusy(false);
            }
          }}
        />

        <ConfirmDialog
          open={saleToDelete !== null}
          title="Eliminar venta"
          message={saleToDelete ? stoneSaleDeletionWarning(saleToDelete) : ''}
          confirmLabel="Eliminar"
          danger
          busy={busy}
          onCancel={() => setSaleToDelete(null)}
          onConfirm={async () => {
            if (!saleToDelete) return;
            setBusy(true);
            try {
              await store.upsertStoneLot(withoutLotSale(lot, saleToDelete.id, new Date().toISOString()));
              store.showToast('Venta eliminada');
              setSaleToDelete(null);
            } catch {
              store.showToast('No se pudo eliminar la venta. Intenta de nuevo.');
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
    </div>
  );
}

/** Formulario de crear/editar la COMPRA de un lote, con guardado explícito. */
function LotForm({
  initial,
  isNew,
  onClose
}: {
  initial: StoneLot;
  isNew: boolean;
  onClose: () => void;
}) {
  const store = useStore();
  const [form, setForm] = useState<StoneLot>(initial);
  const [busy, setBusy] = useState(false);

  const patch = (partial: Partial<StoneLot>) => setForm((current) => ({ ...current, ...partial }));

  const selectSupplier = (supplierId: string) => {
    if (!supplierId) {
      patch({ supplierId: null });
      return;
    }
    const supplier = store.suppliers.find((s) => s.id === supplierId);
    patch({ supplierId, supplier: supplier ? supplier.name : form.supplier });
  };

  const save = async () => {
    if (!isStoneLotValid(form)) {
      store.showToast('El lote necesita fecha de compra y tipo de piedra.');
      return;
    }
    const sold = summarizeStoneLot(form);
    if (sold.remainingCarats < 0 || sold.remainingQuantity < 0) {
      store.showToast(
        `El lote ya vendió ${sold.soldQuantity} pz y ${sold.soldCarats} ct; la compra no puede quedar por debajo.`
      );
      return;
    }
    const purchaseError = validateStoneLotPurchaseUpdate(isNew ? null : initial, form);
    if (purchaseError) {
      store.showToast(purchaseError);
      return;
    }
    setBusy(true);
    try {
      await store.upsertStoneLot({ ...form, updatedAt: new Date().toISOString() });
      store.showToast(isNew ? 'Lote registrado' : 'Compra actualizada');
      onClose();
    } catch {
      store.showToast('No se pudo guardar el lote. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-full w-full max-w-sm overflow-y-auto overscroll-contain rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-stone-900">
          {isNew ? 'Nueva compra (lote)' : 'Editar compra del lote'}
        </h3>
        <div className="mt-4 space-y-3">
          <Field label="Nombre del lote" hint="Opcional. Ej: Lote Ejemplo 12.">
            <TextInput value={form.name} onChange={(name) => patch({ name })} placeholder="Ej: Lote Ejemplo 12" />
          </Field>
          <Field label="Tipo de piedra">
            <TextInput
              value={form.stoneType}
              onChange={(stoneType) => patch({ stoneType })}
              placeholder="Ej: Esmeralda"
            />
          </Field>
          <Field label="Descripción" hint="Talla, calidad, origen…">
            <TextInput
              value={form.description}
              onChange={(description) => patch({ description })}
              placeholder="Ej: talla esmeralda, calidad alta"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quilates">
              <DecimalInput value={form.carats} onValue={(carats) => patch({ carats })} suffix="ct" />
            </Field>
            <Field label="N.º de piedras">
              <DecimalInput value={form.quantity} onValue={(quantity) => patch({ quantity })} />
            </Field>
          </div>
          <Field label="Costo total del lote">
            <MoneyInput value={form.purchaseValueCop} onValue={(purchaseValueCop) => patch({ purchaseValueCop })} />
          </Field>
          <Toggle
            checked={form.onCredit}
            onChange={(onCredit) => patch({ onCredit })}
            label="Compra a crédito (quedo debiendo)"
          />
          {store.suppliers.length > 0 && (
            <Field label="Proveedor registrado (opcional)">
              <Select
                value={form.supplierId ?? ''}
                onChange={selectSupplier}
                options={[
                  { value: '', label: '— Sin vincular —' },
                  ...store.suppliers.map((s) => ({ value: s.id, label: s.name }))
                ]}
              />
            </Field>
          )}
          <Field label="A quién le compraste">
            <TextInput
              value={form.supplier}
              onChange={(supplier) => patch({ supplier, supplierId: null })}
              placeholder="Nombre del proveedor"
            />
          </Field>
          <Field label="Fecha de compra">
            <TextInput type="date" value={form.purchaseDate} onChange={(purchaseDate) => patch({ purchaseDate })} />
          </Field>
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

/** Formulario de registrar/editar un pago al proveedor, con validación de la deuda. */
function SupplierPaymentForm({
  lot,
  initial,
  onClose
}: {
  lot: StoneLot;
  initial: SupplierPayment;
  onClose: () => void;
}) {
  const store = useStore();
  const [form, setForm] = useState<SupplierPayment>(initial);
  const [busy, setBusy] = useState(false);
  const isNew = !lot.supplierPayments.some((p) => p.id === initial.id);

  const others = lot.supplierPayments.filter((p) => p.id !== initial.id);
  const pending = summarizeStoneLot({ ...lot, supplierPayments: others }).supplierDebt;

  const save = async () => {
    const error = validateSupplierPayment(lot, form, isNew ? undefined : initial.id);
    if (error) {
      store.showToast(error);
      return;
    }
    setBusy(true);
    try {
      await store.upsertStoneLot(withSupplierPayment(lot, form, new Date().toISOString()));
      store.showToast(isNew ? 'Pago registrado' : 'Pago actualizado');
      onClose();
    } catch {
      store.showToast('No se pudo guardar el pago. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-full w-full max-w-sm overflow-y-auto overscroll-contain rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-stone-900">
          {isNew ? 'Pago al proveedor' : 'Editar pago'}
        </h3>
        <p className="mt-1 text-sm text-stone-600">
          {lotDisplayName(lot)}
          {lot.supplier ? ` · ${lot.supplier}` : ''} · pendiente {formatCOP(pending)}
        </p>
        <div className="mt-4 space-y-3">
          <Field label="Monto pagado">
            <MoneyInput value={form.amount} onValue={(amount) => setForm({ ...form, amount })} />
          </Field>
          <Field label="Fecha del pago">
            <TextInput type="date" value={form.date} onChange={(date) => setForm({ ...form, date })} />
          </Field>
          <Field label="Notas">
            <TextInput
              value={form.notes}
              onChange={(notes) => setForm({ ...form, notes })}
              placeholder="Efectivo, transferencia…"
            />
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

/** Formulario de registrar/editar una venta del lote, con validación de existencias. */
function SaleForm({
  lot,
  initial,
  onClose
}: {
  lot: StoneLot;
  initial: StoneSale;
  onClose: () => void;
}) {
  const store = useStore();
  const [form, setForm] = useState<StoneSale>(initial);
  const [busy, setBusy] = useState(false);
  const isNew = !lot.sales.some((s) => s.id === initial.id);

  const patch = (partial: Partial<StoneSale>) => setForm((current) => ({ ...current, ...partial }));

  const others = lot.sales.filter((s) => s.id !== initial.id);
  const available = summarizeStoneLot({ ...lot, sales: others });
  const saleSummary = summarizeStoneSale(form);

  const save = async () => {
    const error = validateStoneSale(lot, form, isNew ? undefined : initial.id);
    if (error) {
      store.showToast(error);
      return;
    }
    setBusy(true);
    try {
      await store.upsertStoneLot(withLotSale(lot, form, new Date().toISOString()));
      store.showToast(isNew ? 'Venta registrada' : 'Venta actualizada');
      onClose();
    } catch {
      store.showToast('No se pudo guardar la venta. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-full w-full max-w-sm overflow-y-auto overscroll-contain rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-stone-900">
          {isNew ? 'Registrar venta' : 'Editar venta'}
        </h3>
        <p className="mt-1 text-sm text-stone-600">
          {lotDisplayName(lot)} · disponibles {formatCarats(available.remainingCarats)} ·{' '}
          {available.remainingQuantity} pz
        </p>
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quilates vendidos">
              <DecimalInput value={form.carats} onValue={(carats) => patch({ carats })} suffix="ct" />
            </Field>
            <Field label="N.º de piedras">
              <DecimalInput value={form.quantity} onValue={(quantity) => patch({ quantity })} />
            </Field>
          </div>
          <Field label="Valor de la venta (total)">
            <MoneyInput value={form.valueCop} onValue={(valueCop) => patch({ valueCop })} />
          </Field>
          <Field label="A quién le vendiste">
            <Select
              value={form.buyerId ?? ''}
              onChange={(buyerId) => {
                const buyer = store.buyers.find((b) => b.id === buyerId);
                patch({
                  buyerId: buyer ? buyer.id : null,
                  buyer: buyer ? buyer.name : form.buyer
                });
              }}
              options={[
                { value: '', label: 'Escribir el nombre' },
                ...store.buyers.map((b) => ({ value: b.id, label: b.name }))
              ]}
            />
          </Field>
          {form.buyerId === null ? (
            <Field label="Nombre del comprador">
              <TextInput
                value={form.buyer}
                onChange={(buyer) => patch({ buyer })}
                placeholder="Nombre del comprador"
              />
            </Field>
          ) : null}
          <Field label="Fecha de la venta">
            <TextInput type="date" value={form.date} onChange={(date) => patch({ date })} />
          </Field>

          {/* Crédito al vender (D-042): una fecha acordada y abonos libres. */}
          <Toggle
            checked={form.onCredit}
            label="Se la vendí a crédito"
            onChange={(onCredit) => setForm(withSaleCredit(form, onCredit, todayISO()))}
          />
          {!form.onCredit && form.payments.length > 0 ? (
            <p className="rounded-xl bg-red-50 p-3 text-xs text-red-700">
              Esta venta ya tiene {form.payments.length} abono(s) por{' '}
              {formatCOP(summarizeStoneSale({ ...form, onCredit: true }).receivedCop)}. No se
              puede pasar a contado sin borrar ese historial de cobro: vuelve a activar el
              crédito para poder guardar.
            </p>
          ) : null}
          {form.onCredit ? (
            <>
              <Field label="¿Cuándo quedaron de pagarte?">
                <TextInput
                  type="date"
                  value={form.dueDate}
                  onChange={(dueDate) => patch({ dueDate })}
                />
              </Field>
              {form.payments.length > 0 ? (
                <div className="space-y-1 rounded-xl bg-stone-50 p-3">
                  <SummaryRow label="Ya te abonó" value={formatCOP(saleSummary.receivedCop)} />
                  <SummaryRow
                    label="Le falta"
                    value={formatCOP(saleSummary.balanceCop)}
                    bold
                    valueClass="text-brand-800"
                  />
                  <p className="pt-1 text-xs text-stone-500">
                    Los abonos se registran desde Cobros.
                  </p>
                </div>
              ) : (
                <p className="rounded-xl bg-stone-50 p-3 text-xs text-stone-500">
                  Al guardar, esta venta aparecerá en Cobros y allí podrás registrar los abonos.
                </p>
              )}
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
