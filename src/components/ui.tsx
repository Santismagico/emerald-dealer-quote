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
      'border border-gold-300/70 bg-gold-400 text-brand-950 shadow-[0_10px_24px_rgba(0,0,0,0.24)] active:bg-gold-500 disabled:border-stone-500 disabled:bg-stone-600 disabled:text-stone-300',
    secondary:
      'border border-gold-400/70 bg-transparent text-gold-300 active:bg-brand-800/70 disabled:border-stone-500 disabled:text-stone-500',
    danger: 'border border-red-700/70 bg-red-950/25 text-red-200 active:bg-red-900/45',
    ghost: 'bg-transparent text-ivory-200 active:bg-brand-800/55'
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
      <span className="mb-1.5 block text-sm font-medium text-ivory-200">{label}</span>
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
      <span className="text-sm font-medium text-ivory-200">{label}</span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${checked ? 'border-gold-300/70 bg-gold-400' : 'border-stone-500 bg-stone-700'}`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-ivory-100 shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`}
        />
      </span>
    </button>
  );
}

export function SectionCard({ title, children, subtitle }: { title?: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="luxury-card rounded-2xl p-4">
      {title ? <h2 className="luxury-title mb-1 text-lg font-semibold text-gold-300">{title}</h2> : null}
      {subtitle ? <p className="mb-3 text-xs text-stone-500">{subtitle}</p> : null}
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    borrador: 'bg-stone-200 text-stone-700',
    pendiente: 'bg-amber-100 text-amber-800',
    aprobada: 'bg-emerald-100 text-emerald-800',
    rechazada: 'bg-red-100 text-red-700',
    vencida: 'bg-stone-300 text-stone-600'
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${colors[status] ?? colors.borrador}`}>
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
      <div className="luxury-card w-full max-w-sm rounded-2xl p-5 shadow-xl">
        <h3 className="luxury-title text-lg font-semibold text-gold-300">{title}</h3>
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
    <div className="luxury-card-soft rounded-2xl border border-dashed border-gold-400/35 p-8 text-center">
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
      <div className="rounded-full border border-gold-300/60 bg-gold-400 px-5 py-2.5 text-sm font-semibold text-brand-950 shadow-lg">
        {message}
      </div>
    </div>
  );
}
