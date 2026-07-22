// COBROS (D-042/D-046): quién le debe, cuánto y hace cuántos días.
// Nace de una petición concreta de un comerciante real: «vendo a crédito y
// necesito revisar si ya me pagaron en las fechas acordadas».
//
// Todo lo que se ve aquí es DERIVADO de las ventas: saldos, semáforo y días
// de atraso se calculan al mostrarlos y nunca se guardan.

import { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { BuyerPayment, StoneLot, StoneSale } from '../types';
import {
  listBuyerDebts,
  receivablesOfBuyer,
  receivablesTotals,
  type BuyerDebt,
  type Receivable,
  type ReceivableStatus
} from '../services/receivables';
import { emptyBuyerPayment, validateBuyerPayment, withBuyerPayment } from '../services/stones';
import { formatDateCO, todayISO } from '../utils/dates';
import { formatCOP } from '../utils/money';
import { Button, Field, MoneyInput, TextInput, TextArea, EmptyState, SummaryRow } from './ui';

const STATUS_STYLE: Record<ReceivableStatus, { chip: string; dot: string }> = {
  alDia: { chip: 'bg-emerald-100 text-emerald-800', dot: 'bg-brand-600' },
  porVencer: { chip: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  vencido: { chip: 'bg-red-100 text-red-700', dot: 'bg-red-600' }
};

/** Texto humano del estado de una deuda: sin tecnicismos ni fechas crudas. */
function statusLabel(status: ReceivableStatus, daysOverdue: number, daysUntilDue: number): string {
  if (status === 'vencido') {
    return daysOverdue === 1 ? 'Vencido hace 1 día' : `Vencido hace ${daysOverdue} días`;
  }
  if (status === 'porVencer') {
    if (daysUntilDue === 0) return 'Vence hoy';
    return daysUntilDue === 1 ? 'Vence mañana' : `Vence en ${daysUntilDue} días`;
  }
  return 'Al día';
}

function StatusChip({
  status,
  daysOverdue,
  daysUntilDue
}: {
  status: ReceivableStatus;
  daysOverdue: number;
  daysUntilDue: number;
}) {
  const { chip, dot } = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${chip}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
      {statusLabel(status, daysOverdue, daysUntilDue)}
    </span>
  );
}

export function ReceivablesView() {
  const store = useStore();
  const today = todayISO();
  const [openBuyer, setOpenBuyer] = useState<{ id: string | null; name: string } | null>(null);
  const [paying, setPaying] = useState<{ receivable: Receivable; payment: BuyerPayment } | null>(
    null
  );
  const [error, setError] = useState('');

  const totals = useMemo(
    () => receivablesTotals(store.stoneLots, today),
    [store.stoneLots, today]
  );
  const debts = useMemo(() => listBuyerDebts(store.stoneLots, today), [store.stoneLots, today]);

  const saveBuyerPayment = async (receivable: Receivable, payment: BuyerPayment) => {
    const lot = store.stoneLots.find((l: StoneLot) => l.id === receivable.lotId);
    const sale = lot?.sales.find((s: StoneSale) => s.id === receivable.saleId);
    if (!lot || !sale) {
      setError('No se encontró la venta. Vuelve a intentarlo.');
      return;
    }
    const problem = validateBuyerPayment(sale, payment);
    if (problem) {
      setError(problem);
      return;
    }
    const nextSale = withBuyerPayment(sale, payment);
    await store.upsertStoneLot({
      ...lot,
      sales: lot.sales.map((s) => (s.id === sale.id ? nextSale : s)),
      updatedAt: new Date().toISOString()
    });
    store.showToast('Abono registrado');
    setPaying(null);
    setError('');
  };

  if (paying) {
    const { receivable, payment } = paying;
    return (
      <div className="space-y-4">
        <button
          type="button"
          className="min-h-11 text-sm font-medium text-brand-800"
          onClick={() => {
            setPaying(null);
            setError('');
          }}
        >
          ← Volver
        </button>
        <section className="luxury-card rounded-2xl p-4">
          <h2 className="text-[15px] font-semibold text-stone-900">Registrar abono</h2>
          <p className="mb-3 text-xs text-stone-500">
            {receivable.buyerName} · {receivable.lotName}
          </p>
          <div className="space-y-3">
            <SummaryRow label="Valor de la venta" value={formatCOP(receivable.totalCop)} />
            <SummaryRow label="Ya abonado" value={formatCOP(receivable.paidCop)} />
            <SummaryRow
              label="Le falta pagar"
              value={formatCOP(receivable.balanceCop)}
              bold
              valueClass="text-brand-800"
            />
            <Field label="Fecha del abono">
              <TextInput
                type="date"
                value={payment.date}
                onChange={(date) => setPaying({ receivable, payment: { ...payment, date } })}
              />
            </Field>
            <Field label="¿Cuánto le abonaron?">
              <MoneyInput
                value={payment.amount}
                onValue={(amount) => setPaying({ receivable, payment: { ...payment, amount } })}
              />
            </Field>
            <Field label="Notas">
              <TextArea
                value={payment.notes}
                onChange={(notes) => setPaying({ receivable, payment: { ...payment, notes } })}
              />
            </Field>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="flex gap-3 pt-1">
              <div className="flex-1">
                <Button
                  variant="ghost"
                  full
                  onClick={() => {
                    setPaying(null);
                    setError('');
                  }}
                >
                  Cancelar
                </Button>
              </div>
              <div className="flex-1">
                <Button full onClick={() => void saveBuyerPayment(receivable, payment)}>
                  Guardar abono
                </Button>
              </div>
            </div>
            {receivable.balanceCop > 0 ? (
              <Button
                variant="ghost"
                full
                onClick={() =>
                  setPaying({
                    receivable,
                    payment: { ...payment, amount: receivable.balanceCop }
                  })
                }
              >
                Me pagó todo ({formatCOP(receivable.balanceCop)})
              </Button>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  if (openBuyer) {
    const receivables = receivablesOfBuyer(store.stoneLots, today, openBuyer.id, openBuyer.name);
    const total = receivables.reduce((sum, r) => sum + r.balanceCop, 0);
    return (
      <div className="space-y-4">
        <button
          type="button"
          className="min-h-11 text-sm font-medium text-brand-800"
          onClick={() => setOpenBuyer(null)}
        >
          ← Cobros
        </button>
        <section className="luxury-card rounded-2xl p-4">
          <h2 className="text-[15px] font-semibold text-stone-900">{openBuyer.name}</h2>
          <p className="mt-1 text-2xl font-semibold text-brand-800">{formatCOP(total)}</p>
          <p className="text-xs text-stone-500">
            {receivables.length === 1 ? '1 venta sin pagar' : `${receivables.length} ventas sin pagar`}
          </p>
        </section>

        <ul className="space-y-3">
          {receivables.map((r) => (
            <li key={r.saleId} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-stone-900">{r.lotName}</p>
                  <p className="text-xs text-stone-500">
                    Vendido el {formatDateCO(r.date)} · quedaron de pagar el {formatDateCO(r.dueDate)}
                  </p>
                </div>
                <StatusChip
                  status={r.status}
                  daysOverdue={r.daysOverdue}
                  daysUntilDue={r.daysUntilDue}
                />
              </div>
              <div className="mt-3 space-y-1">
                <SummaryRow label="Valor de la venta" value={formatCOP(r.totalCop)} />
                <SummaryRow label="Ya abonó" value={formatCOP(r.paidCop)} />
                <SummaryRow
                  label="Le falta"
                  value={formatCOP(r.balanceCop)}
                  bold
                  valueClass={r.status === 'vencido' ? 'text-red-600' : 'text-brand-800'}
                />
              </div>
              <div className="mt-3 border-t border-stone-100 pt-3">
                <Button
                  full
                  onClick={() => {
                    setError('');
                    setPaying({ receivable: r, payment: emptyBuyerPayment(today) });
                  }}
                >
                  Registrar abono
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="luxury-card rounded-2xl p-4">
        <p className="text-xs text-stone-500">Le deben en total</p>
        <p className="text-3xl font-semibold text-brand-800">{formatCOP(totals.balanceCop)}</p>
        {totals.overdueCop > 0 ? (
          <p className="mt-1 text-sm font-medium text-red-600">
            De eso, {formatCOP(totals.overdueCop)} ya está vencido
          </p>
        ) : totals.balanceCop > 0 ? (
          <p className="mt-1 text-sm text-stone-600">Nada vencido por ahora</p>
        ) : null}
      </section>

      {debts.length === 0 ? (
        <EmptyState
          title="Nadie le debe"
          message="Cuando venda piedras a crédito, aquí verá quién le debe, cuánto y si ya se pasó la fecha en que quedaron de pagarle."
        />
      ) : (
        <ul className="space-y-3">
          {debts.map((debt: BuyerDebt) => (
            <li key={`${debt.buyerId ?? 'libre'}-${debt.buyerName}`}>
              <button
                type="button"
                className="w-full rounded-2xl bg-white p-4 text-left shadow-sm active:bg-stone-50"
                onClick={() => setOpenBuyer({ id: debt.buyerId, name: debt.buyerName })}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-stone-900">{debt.buyerName}</p>
                    <p className="text-xs text-stone-500">
                      {debt.saleCount === 1 ? '1 venta' : `${debt.saleCount} ventas`} · quedaron de
                      pagar el {formatDateCO(debt.oldestDueDate)}
                    </p>
                  </div>
                  <StatusChip
                    status={debt.status}
                    daysOverdue={debt.maxDaysOverdue}
                    daysUntilDue={debt.daysUntilDue}
                  />
                </div>
                <p
                  className={`mt-2 text-xl font-semibold ${
                    debt.status === 'vencido' ? 'text-red-600' : 'text-brand-800'
                  }`}
                >
                  {formatCOP(debt.balanceCop)}
                </p>
                {debt.overdueCop > 0 && debt.overdueCop !== debt.balanceCop ? (
                  <p className="text-xs text-red-600">
                    {formatCOP(debt.overdueCop)} de eso está vencido
                  </p>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
