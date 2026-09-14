import { Check, PackageCheck, Sparkles, TriangleAlert } from 'lucide-react';
import type { PackingInput, PackingOption, PackingPolicy } from '../../../utils/packing';

export interface PackingPlanningFormState {
  quantity: string;
  unitsPerCarton: string;
  cartonsPerPalette: string;
}

interface PackingPlanningCalculation {
  exact: { unitsPerPalette: number };
  options: PackingOption[];
  recommendation: PackingOption;
}

interface PackingPlanningRailProps {
  form: PackingPlanningFormState;
  input: PackingInput | null;
  calculation: PackingPlanningCalculation | null;
  selectedPolicy: PackingPolicy | null;
  quantityInvalid: boolean;
  unitsPerCartonInvalid: boolean;
  cartonsPerPaletteInvalid: boolean;
  combinationInvalid: boolean;
  onFieldChange: (field: keyof PackingPlanningFormState, value: string) => void;
  onSelectPolicy: (policy: PackingPolicy) => void;
}

const policyLabels: Record<PackingPolicy, string> = {
  'no-overrun': 'Exact',
  'round-carton': 'Carton',
  'round-pallet': 'Palette',
};

const policyDescriptions: Record<PackingPolicy, string> = {
  'no-overrun': 'Sans dépassement',
  'round-carton': 'Cartons complets',
  'round-pallet': 'Palettes complètes',
};

const numberFormatter = new Intl.NumberFormat('fr-FR');

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function PackingField({
  label,
  value,
  placeholder,
  invalid,
  onChange,
  prominent = false,
}: {
  label: string;
  value: string;
  placeholder: string;
  invalid: boolean;
  onChange: (value: string) => void;
  prominent?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <input
        className={`w-full rounded-2xl border bg-white font-black tabular-nums text-slate-950 outline-none transition focus:ring-4 ${
          prominent ? 'packing-primary-input min-h-16 px-4 text-2xl sm:text-3xl' : 'min-h-14 px-4 text-lg'
        } ${
          invalid
            ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/10'
            : 'border-slate-200 focus:border-teal-600 focus:ring-teal-600/10'
        }`}
        autoComplete="off"
        inputMode="numeric"
        pattern="[0-9]*"
        type="text"
        value={value}
        placeholder={placeholder}
        aria-invalid={invalid}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function StrategyCard({
  option,
  active,
  recommended,
  onSelect,
}: {
  option: PackingOption;
  active: boolean;
  recommended: boolean;
  onSelect: () => void;
}) {
  const varianceLabel = option.variance === 0 ? 'Écart 0' : `+${formatNumber(option.variance)} unités`;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={`group min-w-0 rounded-2xl border p-4 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-700/20 ${
        active
          ? 'border-slate-900 bg-slate-950 text-white shadow-xl shadow-slate-950/10'
          : 'border-slate-200 bg-white text-slate-950 hover:border-slate-300 hover:shadow-md'
      }`}
    >
      <div className="packing-strategy-heading grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0 pr-1">
          <p className={`break-words text-[10px] font-black uppercase leading-tight tracking-[0.12em] ${active ? 'text-teal-300' : 'text-slate-400'}`}>
            {policyDescriptions[option.policy]}
          </p>
          <p className="mt-1 text-base font-black">{policyLabels[option.policy]}</p>
        </div>
        <span className={`ml-1 grid h-7 w-7 shrink-0 place-items-center rounded-full border ${active ? 'border-teal-400 bg-teal-400 text-slate-950' : 'border-slate-200 text-transparent'}`}>
          <Check size={15} strokeWidth={3} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-5 break-words text-2xl font-black tabular-nums sm:text-[1.7rem]">{formatNumber(option.totalPrepared)}</p>
      <p className={`mt-1 text-xs font-bold ${option.variance === 0 ? (active ? 'text-emerald-300' : 'text-emerald-700') : (active ? 'text-amber-300' : 'text-amber-700')}`}>
        {varianceLabel}
      </p>
      <div className={`packing-strategy-recommendation mt-4 flex min-h-6 items-center gap-1.5 text-[11px] font-black uppercase tracking-wide ${active ? 'text-slate-300' : 'text-slate-500'}`}>
        {recommended ? (
          <>
            <Sparkles size={13} aria-hidden="true" />
            Recommandé
          </>
        ) : null}
      </div>
    </button>
  );
}

export function PackingPlanningRail({
  form,
  input,
  calculation,
  selectedPolicy,
  quantityInvalid,
  unitsPerCartonInvalid,
  cartonsPerPaletteInvalid,
  combinationInvalid,
  onFieldChange,
  onSelectPolicy,
}: PackingPlanningRailProps) {
  return (
    <section aria-label="Préparation du run" className="min-w-0 space-y-5">
      <section className="packing-reference-card rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Préparer</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Référence du run</h2>
          </div>
          <PackageCheck size={22} className="text-teal-700" aria-hidden="true" />
        </div>
        <div className="grid gap-4">
          <PackingField label="Quantité demandée en unités" value={form.quantity} placeholder="Ex : 30880" invalid={quantityInvalid} prominent onChange={(value) => onFieldChange('quantity', value)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <PackingField label="Unités par carton" value={form.unitsPerCarton} placeholder="Ex : 128" invalid={unitsPerCartonInvalid} onChange={(value) => onFieldChange('unitsPerCarton', value)} />
            <PackingField label="Cartons par palette" value={form.cartonsPerPalette} placeholder="Ex : 40" invalid={cartonsPerPaletteInvalid} onChange={(value) => onFieldChange('cartonsPerPalette', value)} />
          </div>
        </div>
        {combinationInvalid ? (
          <div role="alert" className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium leading-6 text-rose-900">
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-rose-600" aria-hidden="true" />
            Cette combinaison dépasse le domaine de calcul entier exact. Réduisez la quantité ou le conditionnement.
          </div>
        ) : null}
        <div className="mt-5 rounded-2xl bg-slate-950 px-4 py-4 text-white">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Capacité de référence</p>
          {input && calculation ? (
            <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-2xl font-black tabular-nums">{formatNumber(calculation.exact.unitsPerPalette)}</span>
              <span className="text-sm font-bold text-slate-300">unités / palette</span>
              <span className="text-xs font-semibold text-slate-500">· {formatNumber(input.cartonsPerPalette)} cartons × {formatNumber(input.unitsPerCarton)}</span>
            </div>
          ) : (
            <p className="mt-2 text-sm font-medium text-slate-400">Renseignez les trois valeurs pour construire le plan.</p>
          )}
        </div>
      </section>

      <section className="packing-strategies rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.05)] sm:p-6">
        <div className="mb-4">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Décider</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Stratégie de préparation</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">Le choix modifie le brouillon, jamais un run déjà actif.</p>
        </div>
        <div role="radiogroup" aria-label="Politique opérationnelle" className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
          {calculation
            ? calculation.options.map((option) => (
                <StrategyCard key={option.policy} option={option} active={selectedPolicy === option.policy} recommended={calculation.recommendation.policy === option.policy} onSelect={() => onSelectPolicy(option.policy)} />
              ))
            : (Object.keys(policyLabels) as PackingPolicy[]).map((policy) => (
                <button key={policy} type="button" disabled className="min-h-36 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left opacity-60">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{policyDescriptions[policy]}</p>
                  <p className="mt-1 font-black text-slate-700">{policyLabels[policy]}</p>
                  <p className="mt-5 text-2xl font-black text-slate-300">—</p>
                </button>
              ))}
        </div>
      </section>
    </section>
  );
}
