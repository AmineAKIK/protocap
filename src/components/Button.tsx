import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ReactNode;
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-teal-700 text-white hover:bg-teal-800 focus:ring-teal-700/20',
  secondary: 'bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-900/20',
  ghost: 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 focus:ring-slate-900/10',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-600/20'
};

export function Button({ children, variant = 'primary', icon, className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-center text-sm font-semibold leading-5 transition focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      {children}
    </button>
  );
}
