import { useMemo, useRef, useState } from 'react';
import type { Expense, LotPartner } from '../types';
import { useStore } from '../store';
import { partnersFromLegacy, validatePartnersAndFunding } from '../services/partnership';
import { newId } from '../utils/id';
import {
  activeExpenseCategories,
  addExpenseCategory,
  emptyExpense,
  expenseCategoryHistory,
  expensePartners,
  expenseSplit,
  filterExpenses,
  setExpenseCategoryActive,
  validateExpenseOperation
} from '../services/expenses';
import { formatDateCO, todayISO } from '../utils/dates';
import { formatCOP, toSafeCOP } from '../utils/money';
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
  SectionCard,
  Select,
  SummaryRow,
  TextArea,
  TextInput
} from './ui';
import { CurrencyToggle } from './CurrencyToggle';

/** Une nombres para leerlos de corrido: "Ana", "Ana y Beto", "Ana, Beto y Caro". */
function joinNames(names: readonly string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

/**
 * Deja al día los campos viejos del gasto a partir de la lista de socios (D-073).
 * El porcentaje propio se DERIVA; si Santiago quitó a todos los socios, el gasto
 * vuelve a ser 100% suyo y los campos del socio único quedan limpios, para que
 * una versión anterior de la app no siga viéndolo compartido.
 */
function withDerivedShare(expense: Expense): Expense {
  if (!Array.isArray(expense.partners)) return expense;
  const total = toSafeCOP(expense.amountCop);
  const partnersTotal = expense.partners.reduce(
    (sum, partner) => sum + Math.max(0, Math.trunc(partner.amountCop || 0)),
    0
  );
  if (expense.partners.length === 0) {
    return { ...expense, partnerId: null, partnerName: '', myPercent: 100 };
  }
  const mine = Math.max(0, total - partnersTotal);
  return { ...expense, myPercent: total > 0 ? Math.round((mine * 100) / total) : 100 };
}

export function ExpensesView() {
  const store = useStore();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<Expense | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [categoriesBusy, setCategoriesBusy] = useState(false);
  const [currencyView, setCurrencyView] = useState<CurrencyView>('COP');
  const [rateSource, setRateSource] = useState('');
  const rateTouchedRef = useRef(false);
  const rateRequestIdRef = useRef('');

  const categoryHistory = useMemo(
    () => expenseCategoryHistory(store.settings.expenseCategories, store.expenses),
    [store.expenses, store.settings.expenseCategories]
  );
  const activeCategories = useMemo(
    () => activeExpenseCategories(store.settings.expenseCategories),
    [store.settings.expenseCategories]
  );
  const filtered = useMemo(
    () => filterExpenses(store.expenses, { from, to, category, search }),
    [category, from, search, store.expenses, to]
  );
  const total = filtered.reduce((sum, expense) => sum + toSafeCOP(expense.amountCop), 0);

  const startNew = () => {
    rateTouchedRef.current = false;
    const next = emptyExpense(
      todayISO(),
      new Date().toISOString(),
      newOperationUsdRate(store.settings.lastKnownUsdRate)
    );
    next.category = activeCategories[0] ?? '';
    rateRequestIdRef.current = next.id;
    setError('');
    setRateSource(
      storedUsdRateSource(next.usdRate, store.settings.usdRateUpdatedAt)
    );
    setForm(next);
    void store.refreshUsdRate()
      .then((snapshot) => {
        if (rateRequestIdRef.current !== next.id) return;
        setForm((current) => current?.id === next.id
          ? {
              ...current,
              usdRate: resolveUsdRatePrefill(
                current.usdRate,
                snapshot.rate,
                rateTouchedRef.current
              )
            }
          : current);
        if (!rateTouchedRef.current) setRateSource('Tasa vigente consultada');
      })
      .catch(() => {
        if (rateRequestIdRef.current === next.id && !rateTouchedRef.current) {
          setRateSource(
            storedUsdRateSource(
              next.usdRate,
              store.settings.usdRateUpdatedAt,
              true
            )
          );
        }
      });
  };

  const save = async () => {
    if (!form || busy) return;
    const partnersError = validatePartnersAndFunding({
      totalCostCop: toSafeCOP(form.amountCop),
      partners: form.partners,
      subject: 'gasto'
    });
    if (partnersError) {
      setError(partnersError);
      return;
    }
    const next = { ...withDerivedShare(form), updatedAt: new Date().toISOString() };
    const previous = store.expenses.find((expense) => expense.id === next.id) ?? null;
    const validation = validateExpenseOperation(next, previous);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    try {
      await store.upsertExpense(next);
      store.showToast(form.createdAt === form.updatedAt ? 'Gasto guardado' : 'Gasto actualizado');
      setForm(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el gasto.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!pendingDelete || busy) return;
    setBusy(true);
    try {
      await store.removeExpense(pendingDelete.id);
      store.showToast('Gasto eliminado');
      setPendingDelete(null);
    } catch {
      store.showToast('No se pudo eliminar el gasto.');
    } finally {
      setBusy(false);
    }
  };

  const addCategory = async () => {
    if (!newCategory.trim() || categoriesBusy) return;
    setCategoriesBusy(true);
    try {
      await store.updateExpenseCategories((current) => addExpenseCategory(current, newCategory));
      setNewCategory('');
      store.showToast('Categoría disponible');
    } catch {
      store.showToast('No se pudo guardar la categoría.');
    } finally {
      setCategoriesBusy(false);
    }
  };

  const toggleCategory = async (name: string, active: boolean) => {
    if (categoriesBusy) return;
    setCategoriesBusy(true);
    try {
      await store.updateExpenseCategories((current) =>
        setExpenseCategoryActive(current, name, active)
      );
    } catch {
      store.showToast('No se pudo actualizar la categoría.');
    } finally {
      setCategoriesBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <SectionCard
        title="Gastos del negocio"
        subtitle="Cada gasto sale de caja en la fecha en que se pagó. Esta información es interna."
      >
        <Button full onClick={startNew} disabled={activeCategories.length === 0}>
          + Registrar gasto
        </Button>
        {activeCategories.length === 0 ? (
          <p className="text-sm text-amber-700">Activa o agrega una categoría para registrar gastos.</p>
        ) : null}
      </SectionCard>

      <CurrencyToggle value={currencyView} onChange={setCurrencyView} />
      <p className="text-[11px] text-stone-500">
        Solo cambia cada gasto con su propia tasa. El total filtrado sigue en COP.
      </p>

      <SectionCard title="Buscar y filtrar">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Desde">
            <TextInput type="date" value={from} onChange={setFrom} />
          </Field>
          <Field label="Hasta">
            <TextInput type="date" value={to} onChange={setTo} />
          </Field>
        </div>
        <Field label="Categoría">
          <Select
            value={category}
            onChange={setCategory}
            options={[
              { value: '', label: 'Todas' },
              ...categoryHistory.map((name) => ({ value: name, label: name }))
            ]}
          />
        </Field>
        <Field label="Buscar">
          <TextInput value={search} onChange={setSearch} placeholder="Concepto, pagador, socio…" />
        </Field>
        <SummaryRow label={`${filtered.length} gasto${filtered.length === 1 ? '' : 's'}`} value={formatCOP(total)} bold />
      </SectionCard>

      {filtered.length === 0 ? (
        <EmptyState title="Sin gastos" message="No hay gastos que coincidan con estos filtros." />
      ) : (
        <SectionCard title="Historial">
          {filtered.map((expense) => {
            const split = expenseSplit(expense);
            const sharedWith = expensePartners(expense);
            const sharedNames = joinNames(sharedWith.map((p) => p.partnerName.trim() || 'socio'));
            return (
              <article key={expense.id} className="rounded-xl border border-stone-200 p-3">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-stone-900">{expense.concept}</p>
                    <p className="text-xs text-stone-500">
                      {formatDateCO(expense.date)} · {expense.category}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold text-red-700">
                    - {formatOperationMoney(expense.amountCop, expense.usdRate, currencyView)}
                  </span>
                </div>
                <p className="mt-2 break-words text-xs text-stone-600">
                  {expense.method} · pagó {expense.paidBy}
                  {sharedNames
                    ? ` · ${sharedNames}: tu parte ${formatOperationMoney(split.myAmountCop, expense.usdRate, currencyView)}, ${sharedWith.length > 1 ? 'socios' : 'socio'} ${formatOperationMoney(split.partnerAmountCop, expense.usdRate, currencyView)}`
                    : ''}
                </p>
                <p className="mt-1 text-xs text-stone-500">{usdRateLabel(expense.usdRate)}</p>
                {expense.notes ? <p className="mt-1 break-words text-xs text-stone-500">{expense.notes}</p> : null}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="min-h-11 rounded-lg text-sm font-semibold text-brand-800 active:bg-brand-50"
                    onClick={() => {
                      rateRequestIdRef.current = '';
                      rateTouchedRef.current = true;
                      setError('');
                      setForm(expense);
                    }}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="min-h-11 rounded-lg text-sm font-medium text-red-600 active:bg-red-50"
                    onClick={() => setPendingDelete(expense)}
                  >
                    Eliminar
                  </button>
                </div>
              </article>
            );
          })}
        </SectionCard>
      )}

      <SectionCard
        title="Categorías"
        subtitle="Puedes agregar categorías propias. Si dejas de ofrecer una, su historial se conserva."
      >
        <div className="flex min-w-0 gap-2">
          <div className="min-w-0 flex-1">
            <TextInput value={newCategory} onChange={setNewCategory} placeholder="Nueva categoría" />
          </div>
          <Button variant="secondary" disabled={categoriesBusy || !newCategory.trim()} onClick={() => void addCategory()}>
            Agregar
          </Button>
        </div>
        <div className="space-y-2">
          {store.settings.expenseCategories.map((option) => (
            <div key={option.name} className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-stone-50 px-3 py-2">
              <span className="min-w-0 break-words text-sm text-stone-800">{option.name}</span>
              <button
                type="button"
                disabled={categoriesBusy}
                onClick={() => void toggleCategory(option.name, !option.active)}
                className={`min-h-11 shrink-0 rounded-lg px-3 text-sm font-semibold ${
                  option.active ? 'text-red-600 active:bg-red-50' : 'text-brand-800 active:bg-brand-50'
                }`}
              >
                {option.active ? 'Dejar de ofrecer' : 'Volver a ofrecer'}
              </button>
            </div>
          ))}
        </div>
      </SectionCard>

      {form ? (
        <ExpenseForm
          form={form}
          activeCategories={activeCategories}
          partners={store.materialPartners}
          busy={busy}
          error={error}
          isNew={!store.expenses.some((expense) => expense.id === form.id)}
          rateSource={rateSource}
          onRateTouched={() => {
            rateTouchedRef.current = true;
            setRateSource('Tasa escrita manualmente');
          }}
          onChange={(next) => { setForm(next); setError(''); }}
          onSave={() => void save()}
          onClose={() => {
            if (!busy) {
              rateRequestIdRef.current = '';
              setForm(null);
            }
          }}
        />
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Eliminar gasto"
        message="Se borrará este gasto y los cierres dejarán de contarlo. Esta acción no se puede deshacer."
        confirmLabel={busy ? 'Eliminando…' : 'Eliminar gasto'}
        danger
        busy={busy}
        onConfirm={() => void remove()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function ExpenseForm({
  form,
  activeCategories,
  partners,
  busy,
  error,
  isNew,
  rateSource,
  onRateTouched,
  onChange,
  onSave,
  onClose
}: {
  form: Expense;
  activeCategories: string[];
  partners: ReturnType<typeof useStore>['materialPartners'];
  busy: boolean;
  error: string;
  isNew: boolean;
  rateSource: string;
  onRateTouched: () => void;
  onChange: (expense: Expense) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const patch = (partial: Partial<Expense>) => onChange({ ...form, ...partial });
  const categoryOptions = [...new Set([
    ...activeCategories,
    ...(form.category ? [form.category] : [])
  ])];

  // Sociedad del gasto (D-073). Un gasto guardado con el modelo de socio único
  // se convierte al abrirlo, para poder editarlo sin perder nada. Se lee la
  // lista cruda —no `activePartners`— para que una fila recién añadida no
  // desaparezca mientras Santiago todavía la está llenando.
  const expenseLotPartners = useMemo(
    () =>
      form.partners && form.partners.length > 0
        ? form.partners
        : partnersFromLegacy({
            partnerId: form.partnerId,
            partnerName: form.partnerName,
            myPercent: form.myPercent,
            totalCostCop: toSafeCOP(form.amountCop)
          }),
    [form.partners, form.partnerId, form.partnerName, form.myPercent, form.amountCop]
  );
  const expenseTotal = toSafeCOP(form.amountCop);
  const expensePartnersTotal = expenseLotPartners.reduce(
    (sum, partner) => sum + Math.max(0, Math.trunc(partner.amountCop || 0)),
    0
  );
  const myExpenseShare = Math.max(0, expenseTotal - expensePartnersTotal);

  const setExpensePartners = (next: LotPartner[]) => patch({ partners: next });

  const addExpensePartner = () =>
    setExpensePartners([
      ...expenseLotPartners,
      { id: newId(), partnerId: null, partnerName: '', amountCop: 0 }
    ]);

  const removeExpensePartner = (index: number) =>
    setExpensePartners(expenseLotPartners.filter((_, position) => position !== index));

  const patchExpensePartner = (index: number, partial: Partial<LotPartner>) =>
    setExpensePartners(
      expenseLotPartners.map((partner, position) =>
        position === index ? { ...partner, ...partial } : partner
      )
    );

  const selectExpensePartner = (index: number, personId: string) => {
    const person = partners.find((item) => item.id === personId);
    patchExpensePartner(
      index,
      person ? { partnerId: person.id, partnerName: person.name } : { partnerId: null }
    );
  };

  return (
    <FormDialog
      title={form.createdAt === form.updatedAt ? 'Registrar gasto' : 'Editar gasto'}
      description="Uso interno. El monto completo sale de caja en la fecha indicada."
      busy={busy}
      onClose={onClose}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" disabled={busy} onClick={onClose}>Cancelar</Button>
          <Button disabled={busy} onClick={onSave}>{busy ? 'Guardando…' : 'Guardar'}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Fecha de pago">
          <TextInput type="date" value={form.date} onChange={(date) => patch({ date })} />
        </Field>
        <Field label="Concepto">
          <TextInput value={form.concept} onChange={(concept) => patch({ concept })} placeholder="Ej. Arriendo del local" />
        </Field>
        <Field label="Categoría">
          <Select
            value={form.category}
            onChange={(category) => patch({ category })}
            options={categoryOptions.map((name) => ({ value: name, label: name }))}
          />
        </Field>
        <Field label="Monto en COP">
          <MoneyInput value={form.amountCop} onValue={(amountCop) => patch({ amountCop })} />
        </Field>
        <Field
          label="Tasa USD/COP"
          hint={isNew
            ? `${rateSource}. Puedes ajustarla manualmente antes de guardar.`
            : 'Quedó fijada al registrar el gasto.'}
        >
          {isNew ? (
            <DecimalInput
              value={form.usdRate ?? 0}
              onValue={(value) => {
                onRateTouched();
                patch({ usdRate: value > 0 ? value : null });
              }}
              suffix="COP"
            />
          ) : (
            <p className="min-h-11 rounded-xl bg-stone-100 px-3 py-3 text-sm text-stone-700">
              {usdRateLabel(form.usdRate)}
            </p>
          )}
        </Field>
        <Field label="Forma de pago">
          <TextInput value={form.method} onChange={(method) => patch({ method })} placeholder="Efectivo, transferencia…" />
        </Field>
        <Field label="Quién pagó">
          <TextInput value={form.paidBy} onChange={(paidBy) => patch({ paidBy })} />
        </Field>
        {/* Sociedad del gasto (D-073): cada socio declara la plata que puso y lo
            propio se DERIVA. El fondo no entra: financia compras, no gastos. */}
        <div className="rounded-2xl bg-stone-50 p-3">
          <p className="text-sm font-semibold text-stone-800">Quién puso la plata</p>
          <p className="mt-0.5 text-xs text-stone-500">
            Si no agregas a nadie, el gasto queda 100% tuyo.
          </p>

          {expenseLotPartners.map((partner, index) => (
            <div key={partner.id} className="mt-3 rounded-xl bg-white p-3 shadow-sm">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <Field label={`Socio ${index + 1}`}>
                    <Select
                      value={partner.partnerId ?? '__libre__'}
                      onChange={(value) => selectExpensePartner(index, value)}
                      options={[
                        ...(partner.partnerId === null
                          ? [
                              {
                                value: '__libre__',
                                label: partner.partnerName.trim() || 'Elige a quién'
                              }
                            ]
                          : []),
                        ...partners.map((person) => ({ value: person.id, label: person.name }))
                      ]}
                    />
                  </Field>
                </div>
                <button
                  type="button"
                  aria-label={`Quitar a ${partner.partnerName.trim() || 'este socio'}`}
                  className="mt-7 min-h-11 min-w-11 shrink-0 rounded-lg text-red-600 active:bg-red-50"
                  onClick={() => removeExpensePartner(index)}
                >
                  ✕
                </button>
              </div>
              {partner.partnerId === null ? (
                <Field label="Nombre del socio">
                  <TextInput
                    value={partner.partnerName}
                    onChange={(partnerName) => patchExpensePartner(index, { partnerName })}
                    placeholder="Nombre del socio"
                  />
                </Field>
              ) : null}
              <Field
                label="Cuánto puso"
                hint={
                  partner.amountCop > 0 && expenseTotal > 0
                    ? `Le corresponde el ${((partner.amountCop * 100) / expenseTotal).toFixed(1)}% del gasto`
                    : 'Escribe la plata que puso.'
                }
              >
                <MoneyInput
                  value={partner.amountCop}
                  onValue={(amountCop) => patchExpensePartner(index, { amountCop })}
                />
              </Field>
            </div>
          ))}

          <div className="mt-3">
            <Button variant="secondary" full onClick={addExpensePartner}>
              + Añadir socio
            </Button>
          </div>

          <div className="mt-2 border-t border-stone-200 pt-2">
            <SummaryRow
              label="Lo tuyo"
              value={`${formatCOP(myExpenseShare)}${
                expenseTotal > 0 ? ` · ${((myExpenseShare * 100) / expenseTotal).toFixed(1)}%` : ''
              }`}
              bold
            />
            {expensePartnersTotal > expenseTotal ? (
              <p className="mt-1 text-xs font-medium text-red-600">
                Los socios suman más de lo que costó el gasto.
              </p>
            ) : null}
          </div>
        </div>
        <Field label="Notas">
          <TextArea value={form.notes} onChange={(notes) => patch({ notes })} />
        </Field>
        {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      </div>
    </FormDialog>
  );
}
