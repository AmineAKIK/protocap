import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from 'lucide-react';
import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}

export function DecimalField({
  label,
  unit,
  hint,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  unit?: string;
  hint?: string;
  error?: string;
}) {
  const generatedId = useId();
  const inputId = props.id ?? props.name ?? generatedId;
  const descriptionId = `${inputId}-description`;
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wide text-slate-600">{label}</span>
      <span
        className={`mt-1 flex min-h-12 overflow-hidden rounded-xl border bg-white focus-within:ring-4 ${
          error
            ? 'border-rose-400 focus-within:ring-rose-100'
            : 'border-slate-300 focus-within:border-teal-600 focus-within:ring-teal-100'
        }`}
      >
        <input
          {...props}
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={Boolean(error)}
          aria-describedby={hint || error ? descriptionId : undefined}
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-base font-bold tabular-nums text-slate-950 outline-none"
        />
        {unit ? (
          <span className="grid min-w-14 place-items-center border-l border-slate-200 bg-slate-50 px-2 text-sm font-black text-slate-600">
            {unit}
          </span>
        ) : null}
      </span>
      {hint || error ? (
        <span
          id={descriptionId}
          className={`mt-1 block text-xs font-semibold ${error ? 'text-rose-700' : 'text-slate-500'}`}
        >
          {error ?? hint}
        </span>
      ) : null}
    </label>
  );
}

export function StatusNotice({
  tone,
  title,
  children,
}: {
  tone: 'info' | 'success' | 'warning' | 'danger';
  title: string;
  children?: ReactNode;
}) {
  const styles = {
    info: 'border-blue-200 bg-blue-50 text-blue-950',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    warning: 'border-amber-200 bg-amber-50 text-amber-950',
    danger: 'border-rose-200 bg-rose-50 text-rose-950',
  };
  const icons = {
    info: Info,
    success: CheckCircle2,
    warning: AlertTriangle,
    danger: OctagonAlert,
  };
  const Icon = icons[tone];
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${styles[tone]}`} role="status">
      <Icon size={20} className="mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-black">{title}</p>
        {children ? <div className="mt-1 text-sm leading-5 opacity-90">{children}</div> : null}
      </div>
    </div>
  );
}

export function ValueCard({
  label,
  value,
  unit,
  primary = false,
}: {
  label: string;
  value: string;
  unit: string;
  primary?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-4 ${
        primary ? 'border-teal-500 bg-teal-700 text-white shadow-lg' : 'border-slate-200 bg-white'
      }`}
    >
      <p className={`text-xs font-black uppercase tracking-wider ${primary ? 'text-teal-100' : 'text-slate-500'}`}>
        {label}
      </p>
      <p className="mt-2 whitespace-nowrap text-3xl font-black tabular-nums sm:text-4xl">
        {value} <span className="text-lg">{unit}</span>
      </p>
    </div>
  );
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
