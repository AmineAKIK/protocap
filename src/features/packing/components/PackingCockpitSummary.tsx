import { CheckCircle2 } from 'lucide-react';
import { calculatePackingOptions, type PackingInput } from '../../../utils/packing';
import { createPackingShipmentPlan } from '../../../utils/packingShipment';
import { formatPackingDuration, getPackingRunProgress, type PackingRun } from '../domain/packingRun';

interface PackingCockpitSummaryProps {
  run: PackingRun;
}

const numberFormatter = new Intl.NumberFormat('fr-FR');

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function CockpitMetric({
  label,
  value,
  detail,
  compact = false,
  priority = false,
}: {
  label: string;
  value: string;
  detail?: string;
  compact?: boolean;
  priority?: boolean;
}) {
  return (
    <div className={`packing-cockpit-metric min-w-0 rounded-2xl border p-4 ${priority ? 'packing-cockpit-metric-priority border-teal-300/20 bg-teal-300/10' : 'border-white/10 bg-white/[0.045]'}`}>
      <p className={`text-[10px] font-black uppercase tracking-[0.14em] ${priority ? 'text-teal-200' : 'text-slate-400'}`}>{label}</p>
      <p className={`mt-1 break-words font-black tabular-nums text-white ${compact ? 'text-lg' : 'text-2xl'}`}>{value}</p>
      {detail ? <p className="mt-1 text-xs font-semibold text-slate-400">{detail}</p> : null}
    </div>
  );
}

export function PackingCockpitSummary({ run }: PackingCockpitSummaryProps) {
  const input: PackingInput = {
    quantity: run.requestedUnits,
    unitsPerCarton: run.unitsPerCarton,
    cartonsPerPalette: run.cartonsPerLoad,
  };
  const selected = calculatePackingOptions(input).find((option) => option.policy === run.selectedPolicy);
  if (!selected) return null;

  const shipmentPlan = createPackingShipmentPlan(input, selected);
  const progress = getPackingRunProgress(run);
  const isComplete = progress.remainingUnits === 0;
  const progressPercent = isComplete ? 100 : Math.floor(progress.progressRatio * 100);

  return (
    <section aria-labelledby="packing-cockpit-title" className={`packing-cockpit overflow-hidden rounded-[2rem] text-white shadow-[0_30px_90px_rgba(15,23,42,0.18)] ${isComplete ? 'packing-cockpit-complete bg-emerald-950' : 'bg-slate-950'}`}>
      <div className="packing-plan-header border-b border-white/10 px-5 py-4 sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-teal-300">Run actif · lecture manager</p>
            <h2 id="packing-cockpit-title" className="mt-1 text-xl font-black tracking-tight">État de production</h2>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-100">
            <CheckCircle2 size={14} className={isComplete ? 'text-emerald-300' : 'text-teal-300'} aria-hidden="true" />
            {selected.label}
          </span>
        </div>
      </div>

      <div className="packing-plan-body p-5 sm:p-7">
        <div className="packing-cockpit-primary grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          <CockpitMetric label="Planifié" value={formatNumber(run.plannedUnits)} detail={`${formatNumber(run.requestedUnits)} demandées`} />
          <CockpitMetric priority label="Déclaré" value={formatNumber(progress.declaredUnits)} detail="production conditionnée" />
          <CockpitMetric priority label="Progression" value={`${formatNumber(progressPercent)} %`} detail={isComplete ? 'Run terminé' : 'Production en cours'} />
          <CockpitMetric label="Restant" value={formatNumber(progress.remainingUnits)} detail="unités à conditionner" />
        </div>

        <div
          className="packing-progress mt-4"
          role="progressbar"
          aria-label="Avancement conditionné"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
        >
          <div className="packing-progress-label mb-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Avancement conditionné</div>
          <div className="packing-progress-track h-2 overflow-hidden rounded-full bg-white/10">
            <div className={`packing-progress-fill h-full rounded-full ${isComplete ? 'bg-emerald-300' : 'bg-teal-300'}`} style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <div className="packing-cockpit-secondary mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          <CockpitMetric compact label="Cadence de référence" value={`${formatNumber(run.referenceCadenceUnitsPerMinute)} u/min`} />
          <CockpitMetric compact label="Temps total estimé" value={formatPackingDuration(progress.estimatedTotalMinutes)} />
          <CockpitMetric compact label="Temps restant estimé" value={formatPackingDuration(progress.estimatedRemainingMinutes)} />
          <CockpitMetric compact label="Écart plan / demande" value={run.varianceUnits === 0 ? '0' : `+${formatNumber(run.varianceUnits)}`} detail={`${formatNumber(shipmentPlan.totalLoads)} charge${shipmentPlan.totalLoads > 1 ? 's' : ''} planifiée${shipmentPlan.totalLoads > 1 ? 's' : ''}`} />
        </div>
      </div>
    </section>
  );
}
