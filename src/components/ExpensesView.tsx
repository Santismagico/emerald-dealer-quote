import { useMemo, useState } from 'react';
import type { Expense } from '../types';
import { useStore } from '../store';
import {
  activeExpenseCategories,
  addExpenseCategory,
  emptyExpense,
  expenseCategoryHistory,
  expenseSplit,
  filterExpenses,
  setExpenseCategoryActive,
  validateExpense
} from '../services/expenses';
import { formatDateCO, todayISO } from '../utils/dates';
import { formatCOP, toSafeCOP } from '../utils/money';
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
    const next = emptyExpense(todayISO(), new Date().toISOString());
    next.category = activeCategories[0] ?? '';
    setError('');
    setForm(next);
  };

  const save = async () => {
    if (!form || busy) return;
    const next = { ...form, updatedAt: new Date().toISOString() };
    const validation = validateExpense(next);
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
            return (
              <article key={expense.id} className="rounded-xl border border-stone-200 p-3">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-stone-900">{expense.concept}</p>
                    <p className="text-xs text-stone-500">
                      {formatDateCO(expense.date)} · {expense.category}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold text-red-700">- {formatCOP(expense.amountCop)}</span>
                </div>
                <p className="mt-2 break-words text-xs text-stone-600">
                  {expense.method} · pagó {expense.paidBy}
                  {expense.partnerName
                    ? ` · ${expense.partnerName}: tu parte ${formatCOP(split.myAmountCop)}, socio ${formatCOP(split.partnerAmountCop)}`
                    : ''}
                </p>
                {expense.notes ? <p className="mt-1 break-words text-xs text-stone-500">{expense.notes}</p> : null}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="min-h-11 rounded-lg text-sm font-semibold text-brand-800 active:bg-brand-50"
                    onClick={() => { setError(''); setForm(expense); }}
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
          onChange={(next) => { setForm(next); setError(''); }}
          onSave={() => void save()}
          onClose={() => { if (!busy) setForm(null); }}
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
  onChange,
  onSave,
  onClose
}: {
  form: Expense;
  activeCategories: string[];
  partners: ReturnType<typeof useStore>['materialPartners'];
  busy: boolean;
  error: string;
  onChange: (expense: Expense) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const patch = (partial: Partial<Expense>) => onChange({ ...form, ...partial });
  const historicalPartner = !form.partnerId && form.partnerName.trim();
  const categoryOptions = [...new Set([
    ...activeCategories,
    ...(form.category ? [form.category] : [])
  ])];
  const partnerValue = form.partnerId ?? (historicalPartner ? '__historical__' : '');
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
        <Field label="Forma de pago">
          <TextInput value={form.method} onChange={(method) => patch({ method })} placeholder="Efectivo, transferencia…" />
        </Field>
        <Field label="Quién pagó">
          <TextInput value={form.paidBy} onChange={(paidBy) => patch({ paidBy })} />
        </Field>
        <Field label="Sociedad" hint="Si no eliges socio, el gasto queda 100% como propio.">
          <Select
            value={partnerValue}
            onChange={(value) => {
              if (value === '__historical__') return;
              const partner = partners.find((item) => item.id === value);
              patch(partner
                ? { partnerId: partner.id, partnerName: partner.name }
                : { partnerId: null, partnerName: '', myPercent: 100 });
            }}
            options={[
              { value: '', label: 'Sin socio · 100% propio' },
              ...(historicalPartner
                ? [{ value: '__historical__', label: `${form.partnerName} · ficha eliminada` }]
                : []),
              ...partners.map((partner) => ({ value: partner.id, label: partner.name }))
            ]}
          />
        </Field>
        {form.partnerId !== null || form.partnerName ? (
          <Field label="Tu porcentaje" hint={`Parte del socio: ${100 - form.myPercent}%`}>
            <TextInput
              inputMode="numeric"
              value={String(form.myPercent)}
              onChange={(value) => {
                const digits = value.replace(/\D/g, '');
                patch({ myPercent: digits ? Math.min(100, Number(digits)) : 0 });
              }}
            />
          </Field>
        ) : null}
        <Field label="Notas">
          <TextArea value={form.notes} onChange={(notes) => patch({ notes })} />
        </Field>
        {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      </div>
    </FormDialog>
  );
}
