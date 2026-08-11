// Fondo de inversión, PERSONA POR PERSONA (D-074 + D-076).
//
// Santiago lo subrayó: el fondo no es una bolsa única, es un grupo de gente que
// cambia con el tiempo. Por eso esta pantalla se lee por persona y el total va
// al PIE, no al encabezado. Ningún saldo se guarda: capital devuelto, rendimiento
// devengado y lo que se debe se DERIVAN del historial de aportes y pagos (D-023).
//
// Un aporte devuelto por completo NO se borra: queda saldado y su historia sigue
// visible. Borrar existe solo para deshacer un registro creado por error.

import { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { FundContribution, FundPayment, FundPaymentKind } from '../types';
import {
  contributionBalance,
  emptyFundContribution,
  emptyFundPayment,
  fundByPerson,
  fundTotals,
  validateFundContribution
} from '../services/fund';
import { formatDateCO, todayISO } from '../utils/dates';
import { formatCOP } from '../utils/money';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  FormDialog,
  MoneyInput,
  SectionCard,
  Select,
  SummaryRow,
  TextArea,
  TextInput
} from './ui';

/** Clave con la que se agrupa a una persona: su ficha, o su nombre si no tiene. */
function personKeyOf(contribution: FundContribution): string {
  return contribution.personId ?? `name:${contribution.personName.trim().toLocaleLowerCase('es')}`;
}

export function FundView() {
  const store = useStore();
  const hoy = todayISO();
  const [editing, setEditing] = useState<FundContribution | null>(null);
  const [payingFor, setPayingFor] = useState<FundContribution | null>(null);
  const [payment, setPayment] = useState<FundPayment | null>(null);
  const [toDelete, setToDelete] = useState<FundContribution | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const contributions = store.fundContributions;
  const people = useMemo(() => fundByPerson(contributions, hoy), [contributions, hoy]);
  const totals = useMemo(() => fundTotals(contributions, hoy), [contributions, hoy]);

  const openNew = () => {
    setError('');
    setEditing(emptyFundContribution(hoy));
  };

  const save = async () => {
    if (!editing || busy) return;
    const problem = validateFundContribution(editing);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    try {
      await store.upsertFundContribution({ ...editing, updatedAt: new Date().toISOString() });
      store.showToast('Aporte guardado');
      setEditing(null);
      setError('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el aporte.');
    } finally {
      setBusy(false);
    }
  };

  const savePayment = async () => {
    if (!payingFor || !payment || busy) return;
    const next: FundContribution = {
      ...payingFor,
      payments: [...payingFor.payments, payment],
      updatedAt: new Date().toISOString()
    };
    const problem = validateFundContribution(next);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    try {
      await store.upsertFundContribution(next);
      store.showToast('Pago registrado');
      setPayingFor(null);
      setPayment(null);
      setError('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo registrar el pago.');
    } finally {
      setBusy(false);
    }
  };

  const removePayment = async (contribution: FundContribution, paymentId: string) => {
    const next: FundContribution = {
      ...contribution,
      payments: contribution.payments.filter((item) => item.id !== paymentId),
      updatedAt: new Date().toISOString()
    };
    await store.upsertFundContribution(next);
    store.showToast('Pago borrado');
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    await store.removeFundContribution(toDelete.id);
    store.showToast('Aporte borrado');
    setToDelete(null);
  };

  return (
    <div className="space-y-4">
      <SectionCard
        title="Fondo de inversión"
        subtitle="La plata que te prestan tus amigos para comprar. No es de ellos el negocio: es deuda tuya, con su rendimiento. Se lee persona por persona."
      >
        <Button full onClick={openNew}>
          ＋ Registrar aporte
        </Button>
      </SectionCard>

      {people.length === 0 ? (
        <EmptyState
          title="Sin aportes"
          message="Registra quién te prestó plata, cuánto y qué rendimiento le pactaste. La app calcula sola lo que le debes hoy."
        />
      ) : null}

      {people.map((person) => {
        const suyos = contributions.filter(
          (contribution) =>
            personKeyOf(contribution) ===
            (person.personId ?? `name:${person.personName.trim().toLocaleLowerCase('es')}`)
        );
        return (
          <SectionCard
            key={person.personId ?? person.personName}
            title={person.personName}
            subtitle={
              person.openCount === 0
                ? 'Todo saldado. Su historia se conserva.'
                : `${person.openCount} aporte${person.openCount === 1 ? '' : 's'} abierto${person.openCount === 1 ? '' : 's'}`
            }
          >
            <SummaryRow label="Puso" value={formatCOP(person.capitalCop)} />
            <SummaryRow label="Rendimiento hasta hoy" value={formatCOP(person.accruedReturnCop)} />
            <SummaryRow label="Le has devuelto" value={formatCOP(person.capitalRepaidCop)} />
            <SummaryRow label="Rendimiento ya pagado" value={formatCOP(person.returnPaidCop)} />
            <SummaryRow
              label="Le debes hoy"
              value={formatCOP(person.owedCop)}
              bold
              valueClass={person.owedCop > 0 ? 'text-red-600' : 'text-brand-800'}
            />
            {person.nextDueDate ? (
              <p className={`mt-1 text-xs ${person.overdue ? 'font-medium text-red-600' : 'text-stone-500'}`}>
                {person.overdue ? 'Vencido desde el ' : 'Próximo vencimiento: '}
                {formatDateCO(person.nextDueDate)}
              </p>
            ) : null}

            <div className="mt-3 space-y-3 border-t border-stone-100 pt-3">
              {suyos.map((contribution) => {
                const balance = contributionBalance(contribution, hoy);
                return (
                  <div key={contribution.id} className="rounded-xl bg-stone-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-stone-800">
                          {formatCOP(balance.capitalCop)} · {formatDateCO(contribution.date)}
                        </p>
                        <p className="text-xs text-stone-600">
                          {contribution.returnKind === 'mensual'
                            ? `${contribution.monthlyRatePercent ?? 0}% mensual · ${balance.monthsElapsed} ${
                                balance.monthsElapsed === 1 ? 'mes cumplido' : 'meses cumplidos'
                              }`
                            : `Total pactado ${formatCOP(contribution.agreedTotalCop ?? 0)}`}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          balance.settled
                            ? 'bg-stone-200 text-stone-700'
                            : balance.overdue
                              ? 'bg-red-100 text-red-700'
                              : 'bg-brand-100 text-brand-800'
                        }`}
                      >
                        {balance.settled ? 'Saldado' : balance.overdue ? 'Vencido' : 'Abierto'}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-stone-600">
                      Le debes {formatCOP(balance.owedCop)}
                      {balance.capitalOutstandingCop > 0
                        ? ` · capital ${formatCOP(balance.capitalOutstandingCop)}`
                        : ''}
                      {balance.returnOutstandingCop > 0
                        ? ` · rendimiento ${formatCOP(balance.returnOutstandingCop)}`
                        : ''}
                      {contribution.dueDate ? ` · plazo ${formatDateCO(contribution.dueDate)}` : ''}
                    </p>

                    {contribution.payments.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {contribution.payments.map((item) => (
                          <li
                            key={item.id}
                            className="flex items-center justify-between gap-2 text-xs text-stone-600"
                          >
                            <span className="min-w-0 truncate">
                              {formatDateCO(item.date)} · {formatCOP(item.amountCop)} ·{' '}
                              {item.kind === 'capital' ? 'capital' : 'rendimiento'}
                            </span>
                            <button
                              type="button"
                              aria-label={`Borrar el pago del ${formatDateCO(item.date)}`}
                              className="min-h-11 min-w-11 shrink-0 rounded-lg text-red-600 active:bg-red-50"
                              onClick={() => removePayment(contribution, item.id)}
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setError('');
                          setPayingFor(contribution);
                          setPayment(emptyFundPayment(hoy));
                        }}
                      >
                        Pagar
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setError('');
                          setEditing(contribution);
                        }}
                      >
                        Editar
                      </Button>
                      <Button variant="secondary" onClick={() => setToDelete(contribution)}>
                        Borrar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        );
      })}

      {/* El total va AL PIE, nunca al encabezado: el fondo se lee por persona. */}
      {people.length > 0 ? (
        <SectionCard
          title="Total del fondo"
          subtitle={`${totals.personCount} ${totals.personCount === 1 ? 'persona' : 'personas'} · ${
            totals.contributionCount
          } ${totals.contributionCount === 1 ? 'aporte' : 'aportes'}`}
        >
          <SummaryRow label="Capital recibido" value={formatCOP(totals.capitalCop)} />
          <SummaryRow label="Rendimiento hasta hoy" value={formatCOP(totals.accruedReturnCop)} />
          <SummaryRow label="Capital devuelto" value={formatCOP(totals.capitalRepaidCop)} />
          <SummaryRow label="Rendimiento pagado" value={formatCOP(totals.returnPaidCop)} />
          <SummaryRow
            label="Debes en total"
            value={formatCOP(totals.owedCop)}
            bold
            valueClass={totals.owedCop > 0 ? 'text-red-600' : 'text-brand-800'}
          />
          <p className="mt-2 text-xs text-stone-500">
            El rendimiento del fondo lo pagas tú, no tus socios de igualdad: ellos no pidieron
            este préstamo.
          </p>
        </SectionCard>
      ) : null}

      {editing ? (
        <FormDialog
          title={contributions.some((c) => c.id === editing.id) ? 'Editar aporte' : 'Nuevo aporte'}
          description="Quién te prestó, cuánto y qué le pactaste. Lo que le debes se calcula solo."
          busy={busy}
          onClose={() => {
            setEditing(null);
            setError('');
          }}
          footer={
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setEditing(null);
                  setError('');
                }}
              >
                Cancelar
              </Button>
              <Button disabled={busy} onClick={save}>
                {busy ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <Field label="Quién puso la plata *">
              <Select
                value={editing.personId ?? '__libre__'}
                onChange={(value) => {
                  const person = store.materialPartners.find((item) => item.id === value);
                  setEditing(
                    person
                      ? { ...editing, personId: person.id, personName: person.name }
                      : { ...editing, personId: null }
                  );
                }}
                options={[
                  ...(editing.personId === null
                    ? [{ value: '__libre__', label: editing.personName.trim() || 'Escribir el nombre' }]
                    : []),
                  ...store.materialPartners.map((person) => ({ value: person.id, label: person.name }))
                ]}
              />
            </Field>
            {editing.personId === null ? (
              <Field label="Nombre">
                <TextInput
                  value={editing.personName}
                  onChange={(personName) => setEditing({ ...editing, personName })}
                  placeholder="Nombre de quien te prestó"
                />
              </Field>
            ) : null}
            <Field label="Fecha en que te entregó la plata">
              <TextInput
                type="date"
                value={editing.date}
                onChange={(date) => setEditing({ ...editing, date })}
              />
            </Field>
            <Field label="Cuánto te prestó *">
              <MoneyInput
                value={editing.amountCop}
                onValue={(amountCop) => setEditing({ ...editing, amountCop })}
              />
            </Field>
            <Field
              label="Qué le pactaste"
              hint="Mensual: un porcentaje del capital cada mes cumplido. Fijo: un total acordado de una vez."
            >
              <Select
                value={editing.returnKind}
                onChange={(value) =>
                  setEditing({
                    ...editing,
                    returnKind: value === 'fijo' ? 'fijo' : 'mensual',
                    monthlyRatePercent: value === 'fijo' ? null : (editing.monthlyRatePercent ?? 0),
                    agreedTotalCop: value === 'fijo' ? (editing.agreedTotalCop ?? 0) : null
                  })
                }
                options={[
                  { value: 'mensual', label: 'Un porcentaje cada mes' },
                  { value: 'fijo', label: 'Un total fijo pactado' }
                ]}
              />
            </Field>
            {editing.returnKind === 'mensual' ? (
              <Field label="Porcentaje mensual" hint="Por ejemplo 2 significa 2% del capital cada mes cumplido.">
                <TextInput
                  inputMode="decimal"
                  value={String(editing.monthlyRatePercent ?? '')}
                  onChange={(value) => {
                    const limpio = value.replace(',', '.').replace(/[^0-9.]/g, '');
                    setEditing({
                      ...editing,
                      monthlyRatePercent: limpio === '' ? null : Number(limpio)
                    });
                  }}
                />
              </Field>
            ) : (
              <Field label="Total pactado a devolver" hint="Capital más rendimiento, todo junto.">
                <MoneyInput
                  value={editing.agreedTotalCop ?? 0}
                  onValue={(agreedTotalCop) => setEditing({ ...editing, agreedTotalCop })}
                />
              </Field>
            )}
            <Field label="Fecha de devolución (opcional)" hint="Si la pactaste, la app te avisa cuando se pase.">
              <TextInput
                type="date"
                value={editing.dueDate}
                onChange={(dueDate) => setEditing({ ...editing, dueDate })}
              />
            </Field>
            <Field label="Notas">
              <TextArea
                value={editing.notes}
                onChange={(notes) => setEditing({ ...editing, notes })}
                rows={2}
              />
            </Field>
            {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          </div>
        </FormDialog>
      ) : null}

      {payingFor && payment ? (
        <FormDialog
          title="Registrar pago"
          description={`Lo que le entregaste a ${payingFor.personName.trim() || 'esta persona'} por este aporte.`}
          busy={busy}
          onClose={() => {
            setPayingFor(null);
            setPayment(null);
            setError('');
          }}
          footer={
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setPayingFor(null);
                  setPayment(null);
                  setError('');
                }}
              >
                Cancelar
              </Button>
              <Button disabled={busy} onClick={savePayment}>
                {busy ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <Field label="Fecha del pago">
              <TextInput
                type="date"
                value={payment.date}
                onChange={(date) => setPayment({ ...payment, date })}
              />
            </Field>
            <Field label="Cuánto le entregaste">
              <MoneyInput
                value={payment.amountCop}
                onValue={(amountCop) => setPayment({ ...payment, amountCop })}
              />
            </Field>
            <Field
              label="Qué le estás pagando"
              hint="Rendimiento es la ganancia pactada. Capital es devolverle su plata."
            >
              <Select
                value={payment.kind}
                onChange={(value) =>
                  setPayment({ ...payment, kind: (value === 'capital' ? 'capital' : 'rendimiento') as FundPaymentKind })
                }
                options={[
                  { value: 'rendimiento', label: 'Rendimiento' },
                  { value: 'capital', label: 'Capital (le devuelves su plata)' }
                ]}
              />
            </Field>
            <Field label="Notas">
              <TextArea
                value={payment.notes}
                onChange={(notes) => setPayment({ ...payment, notes })}
                rows={2}
              />
            </Field>
            {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          </div>
        </FormDialog>
      ) : null}

      {toDelete ? (
        <ConfirmDialog
          open
          danger
          title="¿Borrar este aporte?"
          message="Esto es para deshacer un registro hecho por error. Si ya se lo devolviste, no lo borres: registra el pago y el aporte queda saldado, conservando su historia."
          confirmLabel="Borrar"
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      ) : null}
    </div>
  );
}
