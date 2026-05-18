import type { ReactNode } from 'react';

type BadgeTone = 'green' | 'amber' | 'red' | 'blue' | 'slate' | 'teal';

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
}

const tones: Record<BadgeTone, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/15',
  red: 'bg-rose-50 text-rose-700 ring-rose-600/15',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/15',
  slate: 'bg-slate-100 text-slate-700 ring-slate-600/10',
  teal: 'bg-teal-50 text-teal-700 ring-teal-600/15'
};

export function Badge({ children, tone = 'slate' }: BadgeProps) {
  return (
    <span className={`inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-xs font-semibold leading-4 ring-1 ${tones[tone]}`}>
      {children}
    </span>
  );
}
