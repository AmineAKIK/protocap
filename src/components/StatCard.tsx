import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: ReactNode;
  detail?: string;
}

export function StatCard({ label, value, detail }: StatCardProps) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <p className="break-normal text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-2 min-w-0 break-normal text-2xl font-bold text-slate-950">{value}</div>
      {detail ? <p className="mt-1 break-normal text-sm text-slate-500">{detail}</p> : null}
    </div>
  );
}
