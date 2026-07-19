// Componentes de interfaz reutilizables, pensados para móvil:
// botones grandes, inputs de 16px (sin zoom iOS) y confirmaciones claras.

import { useEffect, useState, type ReactNode, type ChangeEvent } from 'react';
import { formatThousands, parseMoney, parseDecimal } from '../utils/money';

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  full = false,
  type = 'button'
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  full?: boolean;
  type?: 'button' | 'submit';
}) {
  const styles: Record<string, string> = {
    primary:
      'bg-brand-600 text-white shadow-sm active:bg-brand-700 disabled:bg-stone-300 disabled:text-stone-500 disabled:shadow-none',
    secondary:
      'border border-stone-300 bg-white text-stone-800 active:bg-stone-100 disabled:border-stone-200 disabled:text-stone-400',
    danger: 'border border-red-200 bg-red-50 text-red-700 active:bg-red-100',
    ghost: 'bg-transparent text-stone-600 active:bg-stone-100'
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-12 rounded-xl px-4 font-semibold tracking-[0.01em] transition-all ${styles[variant]} ${full ? 'w-full' : ''}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-stone-700">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-stone-500">{hint}</span> : null}
    </label>
  );
}

const inputClass =
  'luxury-input w-full min-h-12 rounded-xl border px-3 py-2 focus:outline-none';

export function TextInput({
  value,
  onChange,
  onBlur,
  placeholder,
  type = 'text',
  inputMode
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  type?: string;
  inputMode?: 'text' | 'tel' | 'email' | 'numeric' | 'decimal';
}) {
  return (
    <input
      className={inputClass}
      type={type}
      inputMode={inputMode}
      value={value}
      placeholder={placeholder}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      onBlur={onBlur}
    />
  );
}

/** Input de dinero en COP: solo enteros, con separador de miles visible. */
export function MoneyInput({
  value,
  onValue,
  onBlur,
  placeholder = '0'
}: {
  value: number;
  onValue: (value: number) => void;
  onBlur?: () => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(value ? formatThousands(value) : '');
  useEffect(() => {
    setText(value ? formatThousands(value) : '');
  }, [value]);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-medium text-brand-900">$</span>
      <input
        className={`${inputClass} pl-7`}
        inputMode="numeric"
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          const parsed = parseMoney(e.target.value);
          setText(parsed ? formatThousands(parsed) : '');
          onValue(parsed);
        }}
        onBlur={onBlur}
      />
    </div>
  );
}

/** Input decimal (peso en gramos, quilates, porcentajes). Acepta coma o punto. */
export function DecimalInput({
  value,
  onValue,
  placeholder = '0',
  suffix
}: {
  value: number;
  onValue: (value: number) => void;
  placeholder?: string;
  suffix?: string;
}) {
  const [text, setText] = useState(value ? String(value).replace('.', ',') : '');
  useEffect(() => {
    const current = parseDecimal(text);
    if (current !== value) setText(value ? String(value).replace('.', ',') : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="relative">
      <input
        className={`${inputClass} ${suffix ? 'pr-12' : ''}`}
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d.,]/g, '');
          setText(raw);
          onValue(parseDecimal(raw));
        }}
      />
      {suffix ? (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-brand-900">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

export function Select({
  value,
  onChange,
  options
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      className={`${inputClass} min-h-0`}
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="luxury-card-soft flex min-h-12 w-full items-center justify-between rounded-xl px-3"
    >
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${checked ? 'border-brand-700 bg-brand-600' : 'border-stone-300 bg-stone-200'}`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`}
        />
      </span>
    </button>
  );
}

export function SectionCard({ title, children, subtitle }: { title?: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="luxury-card rounded-2xl p-4">
      {title ? <h2 className="mb-1 text-[15px] font-semibold text-stone-900">{title}</h2> : null}
      {subtitle ? <p className="mb-3 text-xs text-stone-500">{subtitle}</p> : null}
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { chip: string; dot: string }> = {
    borrador: { chip: 'bg-stone-200 text-stone-700', dot: 'bg-stone-400' },
    pendiente: { chip: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
    aprobada: { chip: 'bg-emerald-100 text-emerald-800', dot: 'bg-brand-600' },
    rechazada: { chip: 'bg-red-100 text-red-700', dot: 'bg-red-600' },
    vencida: { chip: 'bg-stone-300 text-stone-600', dot: 'bg-stone-500' }
  };
  const { chip, dot } = colors[status] ?? colors.borrador;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
      {status}
    </span>
  );
}

/** Diálogo de confirmación para acciones destructivas. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  busy = false,
  onConfirm,
  onCancel
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string | null;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] backdrop-blur-sm sm:items-center">
      <div className="luxury-card max-h-full w-full max-w-sm overflow-y-auto overscroll-contain rounded-2xl p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-stone-900">{title}</h3>
        <p className="mt-2 text-sm text-stone-600">{message}</p>
        <div className="mt-5 flex gap-3">
          {cancelLabel !== null ? (
            <div className="flex-1">
              <Button variant="ghost" full disabled={busy} onClick={onCancel}>
                {cancelLabel}
              </Button>
            </div>
          ) : null}
          <div className="flex-1">
            <Button variant={danger ? 'danger' : 'primary'} full disabled={busy} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-8 text-center">
      <p className="font-medium text-stone-700">{title}</p>
      <p className="mt-1 text-sm text-stone-500">{message}</p>
    </div>
  );
}

/** Fila etiqueta/valor para resúmenes internos (costos, abonos, producción). */
export function SummaryRow({
  label,
  value,
  bold = false,
  valueClass
}: {
  label: string;
  value: string;
  bold?: boolean;
  valueClass?: string;
}) {
  return (
    <div className={`flex justify-between gap-3 text-sm ${bold ? 'font-semibold' : ''}`}>
      <span className="text-stone-600">{label}</span>
      <span className={valueClass ?? 'text-stone-900'}>{value}</span>
    </div>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
      <div className="rounded-full bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white shadow-lg">
        {message}
      </div>
    </div>
  );
}
