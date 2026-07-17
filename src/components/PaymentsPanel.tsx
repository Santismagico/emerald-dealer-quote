// Panel de abonos recibidos del cliente (SOLO vista interna).
// Registra cuánto entró, cuándo, quién lo recibió y por qué medio,
// y muestra el saldo real pendiente.

import { useState } from 'react';
import type { ClientPayment } from '../types';
import { runAfterSuccessfulFlush, type QuoteSaveMode } from '../services/quoteAutosave';
import { clientPaidTotal, emptyPayment, paymentsTotal } from '../services/payments';
import { formatCOP } from '../utils/money';
import { formatDateCO, isValidISODate } from '../utils/dates';
import { patchById } from '../utils/collections';
import { Button, Field, TextInput, MoneyInput, ConfirmDialog, SummaryRow } from './ui';

export function PaymentsPanel({
  deposit,
  depositDate,
  payments,
  quoteTotal,
  onChange,
  onCommit
}: {
  deposit: number;
  depositDate: string;
  payments: ClientPayment[];
  quoteTotal: number;
  onChange: (updater: (current: ClientPayment[]) => ClientPayment[], mode: QuoteSaveMode) => void;
  onCommit: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<ClientPayment | null>(null);

  const laterPayments = paymentsTotal(payments);
  const totalPaid = clientPaidTotal(deposit, payments);
  const realBalance = quoteTotal - totalPaid;
  const commitInBackground = () => void onCommit().catch(() => {});

  const patchPayment = (id: string, partial: Partial<ClientPayment>) =>
    onChange((current) => patchById(current, id, partial), 'deferred');

  const toggleExpanded = async (id: string) => {
    const action = () => setExpanded(expanded === id ? null : id);
    if (expanded === null) {
      action();
      return;
    }
    await runAfterSuccessfulFlush(onCommit, action);
  };

  return (
    <div className="mt-4 border-t border-amber-200 pt-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
        Pagos recibidos del cliente
      </p>

      {deposit > 0 && (
        <div className="mb-2 rounded-xl bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-stone-800">Anticipo pagado</span>
            <span className="font-medium text-stone-800">{formatCOP(deposit)}</span>
          </div>
          <p className="text-xs text-stone-500">
            {isValidISODate(depositDate)
              ? `Recibido el ${formatDateCO(depositDate)}`
              : 'Fecha no registrada en este dato antiguo'}
          </p>
        </div>
      )}

      {payments.length === 0 && (
        <p className="rounded-xl bg-white/60 p-3 text-xs text-stone-500">
          Aún no has registrado abonos posteriores. Registra cada nuevo pago que reciba la joyería: cuánto, cuándo y quién lo recibió.
        </p>
      )}

      <ul className="space-y-2">
        {payments.map((payment) => (
          <li key={payment.id} className="rounded-xl bg-white p-3 shadow-sm">
            <button
              type="button"
              className="block min-h-11 w-full text-left"
              onClick={() => void toggleExpanded(payment.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-stone-800">{formatCOP(payment.amount)}</span>
                <span className="text-xs text-stone-500">{formatDateCO(payment.date)}</span>
              </div>
              <p className="text-xs text-stone-500">
                {payment.receivedBy ? `Recibió: ${payment.receivedBy}` : 'Toca para completar los datos'}
                {payment.method ? ` · ${payment.method}` : ''}
              </p>
            </button>

            {expanded === payment.id && (
              <div className="mt-3 space-y-3 border-t border-stone-100 pt-3">
                <Field label="Monto del abono">
                  <MoneyInput
                    value={payment.amount}
                    onValue={(amount) => patchPayment(payment.id, { amount })}
                    onBlur={commitInBackground}
                  />
                </Field>
                <Field label="Fecha">
                  <TextInput
                    type="date"
                    value={payment.date}
                    onChange={(date) =>
                      onChange((current) => patchById(current, payment.id, { date }), 'immediate')
                    }
                  />
                </Field>
                <Field label="Quién lo recibió">
                  <TextInput
                    value={payment.receivedBy}
                    onChange={(receivedBy) => patchPayment(payment.id, { receivedBy })}
                    onBlur={commitInBackground}
                    placeholder="Nombre de quien recibió el dinero"
                  />
                </Field>
                <Field label="Medio de pago">
                  <TextInput
                    value={payment.method}
                    onChange={(method) => patchPayment(payment.id, { method })}
                    onBlur={commitInBackground}
                    placeholder="Efectivo, transferencia, Nequi…"
                  />
                </Field>
                <Field label="Nota">
                  <TextInput
                    value={payment.notes}
                    onChange={(notes) => patchPayment(payment.id, { notes })}
                    onBlur={commitInBackground}
                  />
                </Field>
                <Button variant="danger" full onClick={() => setToRemove(payment)}>
                  Eliminar abono
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-2">
        <Button
          variant="secondary"
          full
          onClick={() => {
            const payment = emptyPayment();
            onChange((current) => [...current, payment], 'immediate');
            setExpanded(payment.id);
          }}
        >
          ＋ Registrar abono
        </Button>
      </div>

      <div className="mt-3 space-y-1 rounded-xl bg-white p-3 shadow-sm">
        <SummaryRow label="Abonos posteriores" value={formatCOP(laterPayments)} />
        <SummaryRow label="Total pagado" value={formatCOP(totalPaid)} />
        <SummaryRow
          label="Saldo real pendiente"
          value={formatCOP(realBalance)}
          bold
          valueClass={realBalance < 0 ? 'text-red-600' : undefined}
        />
        {realBalance < 0 && (
          <p className="text-[11px] text-red-600">Los abonos superan el total cotizado: revisa los montos.</p>
        )}
      </div>

      <ConfirmDialog
        open={toRemove !== null}
        title="Eliminar abono"
        message={`¿Eliminar el abono de ${formatCOP(toRemove?.amount ?? 0)}${toRemove?.receivedBy ? ` recibido por ${toRemove.receivedBy}` : ''}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
        onCancel={() => setToRemove(null)}
        onConfirm={() => {
          if (toRemove) onChange((current) => current.filter((payment) => payment.id !== toRemove.id), 'immediate');
          setToRemove(null);
        }}
      />
    </div>
  );
}
