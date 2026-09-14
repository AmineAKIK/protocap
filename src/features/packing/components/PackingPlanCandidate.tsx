import { CheckCircle2 } from 'lucide-react';
import type { PackingInput, PackingOption } from '../../../utils/packing';
import type { PackingShipmentPlan } from '../../../utils/packingShipment';

interface PackingPlanCandidateProps {
  input: PackingInput;
  selected: PackingOption;
  plan: PackingShipmentPlan;
}

const numberFormatter = new Intl.NumberFormat('fr-FR');

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function PlanMetric({ value, label }: { value: number; label: string }) {
  return (
    <div className="packing-plan-metric min-w-0">
      <p className="break-words text-[clamp(2rem,5vw,4.25rem)] font-black leading-none tracking-[-0.05em] tabular-nums text-white">
        {formatNumber(value)}
      </p>
      <p className="mt-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 sm:text-xs">{label}</p>
    </div>
  );
}

export function PackingPlanCandidate({ input, selected, plan }: PackingPlanCandidateProps) {
  return (
    <section aria-labelledby="packing-plan-candidate-title" className="packing-plan overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-[0_30px_90px_rgba(15,23,42,0.18)]">
      <div className="packing-plan-header border-b border-white/10 px-5 py-4 sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-teal-300">Plan candidat</p>
            <h2 id="packing-plan-candidate-title" className="mt-1 text-xl font-black tracking-tight">Plan prêt à activer</h2>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-200">
            <CheckCircle2 size={14} className="text-teal-300" aria-hidden="true" />
            {selected.label}
          </span>
        </div>
      </div>
      <div className="packing-plan-body p-5 sm:p-7">
        <div className="packing-plan-metrics grid gap-6 sm:grid-cols-3">
          <PlanMetric value={plan.fullLoadCount} label="Charges complètes" />
          <PlanMetric value={plan.remainderLoad ? 1 : 0} label="Charge partielle théorique" />
          <PlanMetric value={plan.totalLoads} label="Charges planifiées" />
        </div>
        <div className="mt-7 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-3">
          <div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Demandé</p><p className="mt-1 break-words text-xl font-black tabular-nums">{formatNumber(input.quantity)}</p></div>
          <div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Planifié</p><p className="mt-1 break-words text-xl font-black tabular-nums">{formatNumber(selected.totalPrepared)}</p></div>
          <div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Écart</p><p className={`mt-1 break-words text-xl font-black tabular-nums ${selected.variance === 0 ? 'text-emerald-300' : 'text-amber-300'}`}>{selected.variance === 0 ? '0' : `+${formatNumber(selected.variance)}`}</p></div>
        </div>
      </div>
    </section>
  );
}
