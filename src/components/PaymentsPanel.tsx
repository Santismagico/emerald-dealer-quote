// Panel de abonos recibidos del cliente (SOLO vista interna).
// Registra cuánto entró, cuándo, quién lo recibió y por qué medio,
// y muestra el saldo real pendiente.

import { useState } from 'react';
import type { ClientPayment } from '../types';
import { emptyPayment, paymentsTotal } from '../services/payments';
import { formatCOP } from '../utils/money';
import { formatDateCO } from '../utils/dates';
import { Button, Field, TextInput, MoneyInput, ConfirmDialog } from './ui';

export function PaymentsPanel({
  payments,
  quoteTotal,
  onChange
}: {
  payments: ClientPayment[];
  quoteTotal: number;
  onChange: (payments: ClientPayment[]) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<ClientPayment | null>(null);

  const totalPaid = paymentsTotal(payments);
  const realBalance = quoteTotal - totalPaid;

  const patchPayment = (id: string, partial: Partial<ClientPayment>) =>
    onChange(payments.map((p) => (p.id === id ? { ...p, ...partial } : p)));

  return (
    <div className="mt-4 border-t border-amber-200 pt-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
        💰 Abonos recibidos del cliente
      </p>

      {payments.length === 0 && (
        <p className="rounded-xl bg-white/60 p-3 text-xs text-stone-500">
          Aún no has registrado abonos. Registra cada pago que reciba la joyería: cuánto, cuándo y quién lo recibió.
        </p>
      )}

      <ul className="space-y-2">
        {payments.map((payment) => (
          <li key={payment.id} className="rounded-xl bg-white p-3 shadow-sm">
            <button
              type="button"
              className="block w-full text-left"
              onClick={() => setExpanded(expanded === payment.id ? null : payment.id)}
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
                  <MoneyInput value={payment.amount} onValue={(amount) => patchPayment(payment.id, { amount })} />
                </Field>
                <Field label="Fecha">
                  <TextInput type="date" value={payment.date} onChange={(date) => patchPayment(payment.id, { date })} />
                </Field>
                <Field label="Quién lo recibió">
                  <TextInput
                    value={payment.receivedBy}
                    onChange={(receivedBy) => patchPayment(payment.id, { receivedBy })}
                    placeholder="Nombre de quien recibió el dinero"
                  />
                </Field>
                <Field label="Medio de pago">
                  <TextInput
                    value={payment.method}
                    onChange={(method) => patchPayment(payment.id, { method })}
                    placeholder="Efectivo, transferencia, Nequi…"
                  />
                </Field>
                <Field label="Nota">
                  <TextInput value={payment.notes} onChange={(notes) => patchPayment(payment.id, { notes })} />
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
            onChange([...payments, payment]);
            setExpanded(payment.id);
          }}
        >
          ＋ Registrar abono
        </Button>
      </div>

      <div className="mt-3 space-y-1 rounded-xl bg-white p-3 shadow-sm">
        <div className="flex justify-between text-sm text-stone-600">
          <span>Total abonado</span>
          <span className="text-stone-900">{formatCOP(totalPaid)}</span>
        </div>
        <div className="flex justify-between text-sm font-semibold">
          <span className="text-stone-600">Saldo real pendiente</span>
          <span className={realBalance < 0 ? 'text-red-600' : 'text-stone-900'}>{formatCOP(realBalance)}</span>
        </div>
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
          if (toRemove) onChange(payments.filter((p) => p.id !== toRemove.id));
          setToRemove(null);
        }}
      />
    </div>
  );
}
