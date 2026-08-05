// Componentes de interfaz reutilizables, pensados para móvil:
// botones grandes, inputs de 16px (sin zoom iOS) y confirmaciones claras.

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode
} from 'react';
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

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="luxury-card-soft flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55"
    >
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="min-w-5 text-right text-xs font-semibold text-stone-600">
          {checked ? 'Sí' : 'No'}
        </span>
        <span
          aria-hidden
          className={`relative h-7 w-12 rounded-full border transition-colors ${
            checked
              ? 'border-brand-700 bg-brand-600'
              : 'border-stone-400 bg-stone-300'
          }`}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-[#fff] shadow transition-transform ${
              checked ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </span>
      </span>
    </button>
  );
}

export function SegmentedControl({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  onChange: (value: string) => void;
}) {
  const groupName = useId();
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-stone-700">{label}</legend>
      <div className="luxury-card-soft flex gap-1 rounded-xl p-1">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <label
              key={option.value}
              className={`relative flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg border px-3 text-center text-sm font-semibold transition focus-within:ring-2 focus-within:ring-brand-600 focus-within:ring-offset-2 ${
                selected
                  ? 'border-brand-700 bg-brand-700 text-white shadow-sm'
                  : 'border-transparent text-stone-700'
              } ${
                option.disabled
                  ? 'cursor-not-allowed opacity-50'
                  : selected
                    ? 'cursor-pointer active:bg-brand-800'
                    : 'cursor-pointer active:bg-stone-100'
              }`}
            >
              <input
                className="sr-only"
                type="radio"
                name={groupName}
                value={option.value}
                checked={selected}
                disabled={option.disabled}
                onChange={() => onChange(option.value)}
              />
              {selected ? <span aria-hidden>✓</span> : null}
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function FormDialog({
  title,
  description,
  children,
  footer,
  busy = false,
  onClose
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer: ReactNode;
  busy?: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const appMain = document.querySelector<HTMLElement>('.app-main');
    const previousAppMainOverflow = appMain?.style.overflow ?? '';
    document.body.style.overflow = 'hidden';
    if (appMain) appMain.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => dialogRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      if (appMain) appMain.style.overflow = previousAppMainOverflow;
      previousFocus?.focus();
    };
  }, []);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      if (!busy) {
        event.preventDefault();
        onClose();
      }
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      ) ?? []
    ).filter((element) => !element.hasAttribute('hidden'));
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === dialogRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || active === dialogRef.current)) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="form-dialog-overlay fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="luxury-card flex h-[100dvh] w-full flex-col overflow-hidden shadow-xl outline-none sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-md sm:rounded-2xl"
      >
        <header className="safe-top shrink-0 border-b border-stone-200">
          <div className="flex min-h-16 items-start justify-between gap-3 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <h3 id={titleId} className="text-base font-semibold text-stone-900">
                {title}
              </h3>
              {description ? (
                <p id={descriptionId} className="mt-0.5 text-sm text-stone-600">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Cerrar"
              disabled={busy}
              onClick={onClose}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl leading-none text-stone-600 transition active:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:opacity-40"
            >
              ×
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {children}
        </div>
        <footer className="form-dialog-footer shrink-0 border-t border-stone-200 px-4 pt-3 sm:px-5">
          {footer}
        </footer>
      </div>
    </div>
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
    <div className={`flex min-w-0 justify-between gap-3 text-sm ${bold ? 'font-semibold' : ''}`}>
      <span className="min-w-0 break-words text-stone-600">{label}</span>
      <span className={`min-w-0 break-words text-right ${valueClass ?? 'text-stone-900'}`}>
        {value}
      </span>
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
