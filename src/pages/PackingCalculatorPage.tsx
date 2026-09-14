import {
  Boxes,
  Check,
  CheckCircle2,
  CircleDot,
  PackageCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { PackingRunExecution } from '../features/packing/components/PackingRunExecution';
import { usePackingActiveRun } from '../features/packing/usePackingActiveRun';
import { useLocalStorage } from '../hooks/useLocalStorage';
import {
  calculateExactPacking,
  calculatePackingOptions,
  getPackingRecommendation,
  isValidPackingInput,
  parsePositiveIntegerInput,
  type PackingInput,
  type PackingOption,
  type PackingPolicy,
} from '../utils/packing';
import { createPackingShipmentPlan } from '../utils/packingShipment';

interface PackingFormState {
  quantity: string;
  unitsPerCarton: string;
  cartonsPerPalette: string;
  policy: PackingPolicy;
}

const defaultForm: PackingFormState = {
  quantity: '',
  unitsPerCarton: '',
  cartonsPerPalette: '',
  policy: 'no-overrun',
};

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

function parsePackingInput(form: PackingFormState): PackingInput | null {
  const quantity = parsePositiveIntegerInput(form.quantity);
  const unitsPerCarton = parsePositiveIntegerInput(form.unitsPerCarton);
  const cartonsPerPalette = parsePositiveIntegerInput(form.cartonsPerPalette);

  if (quantity === null || unitsPerCarton === null || cartonsPerPalette === null) return null;
  const input = { quantity, unitsPerCarton, cartonsPerPalette };
  return isValidPackingInput(input) ? input : null;
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

function RunActivation({
  cadence,
  onCadenceChange,
  onActivate,
  persistenceDegraded,
}: {
  cadence: string;
  onCadenceChange: (value: string) => void;
  onActivate: () => void;
  persistenceDegraded: boolean;
}) {
  const parsedCadence = parsePositiveIntegerInput(cadence);

  return (
    <section aria-labelledby="packing-run-activation-title" className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-6">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Exécution atelier</p>
      <h2 id="packing-run-activation-title" className="mt-1 text-lg font-black tracking-tight text-slate-950">Activer le run</h2>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
        Le plan devient alors un snapshot opérationnel indépendant du brouillon de calcul.
      </p>
      <label className="mt-4 block max-w-sm">
        <span className="mb-1.5 block text-xs font-black text-slate-600">Cadence de référence · unités/minute</span>
        <input
          aria-label="Cadence de référence en unités par minute"
          inputMode="numeric"
          pattern="[0-9]*"
          value={cadence}
          onChange={(event) => onCadenceChange(event.target.value.replace(/\D/g, ''))}
          className="min-h-12 w-full rounded-xl border border-slate-200 px-3 font-black tabular-nums outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10"
        />
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={parsedCadence === null}
          onClick={onActivate}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <CheckCircle2 size={17} aria-hidden="true" />
          Activer ce run
        </button>
        {persistenceDegraded ? (
          <span className="text-xs font-bold text-amber-800">Persistance locale dégradée : la conservation du run n’est pas garantie.</span>
        ) : null}
      </div>
    </section>
  );
}

export function PackingCalculatorPage() {
  const [form, setForm] = useLocalStorage<PackingFormState>('lineops.packing.form.inputs', defaultForm);
  const [selectedPolicy, setSelectedPolicy] = useState<PackingPolicy | null>(null);
  const [referenceCadence, setReferenceCadence] = useState('');
  const {
    activeRun,
    persistenceStatus,
    startRun,
    updateRun,
    clearRun,
  } = usePackingActiveRun();
  const input = useMemo(() => parsePackingInput(form), [form]);

  const calculation = useMemo(() => {
    if (!input) return null;
    const exact = calculateExactPacking(input);
    const options = calculatePackingOptions(input);
    const recommendation = getPackingRecommendation(options);
    const selected = selectedPolicy ? options.find((option) => option.policy === selectedPolicy) ?? null : null;
    return { exact, options, recommendation, selected };
  }, [input, selectedPolicy]);

  const operational = (() => {
    if (activeRun) {
      const activeInput: PackingInput = {
        quantity: activeRun.requestedUnits,
        unitsPerCarton: activeRun.unitsPerCarton,
        cartonsPerPalette: activeRun.cartonsPerLoad,
      };
      const selected = calculatePackingOptions(activeInput).find((option) => option.policy === activeRun.selectedPolicy);
      if (!selected) return null;
      return {
        input: activeInput,
        selected,
        plan: createPackingShipmentPlan(activeInput, selected),
        isActive: true,
      };
    }

    if (!input || !calculation?.selected || !selectedPolicy) return null;
    return {
      input,
      selected: calculation.selected,
      plan: createPackingShipmentPlan(input, calculation.selected),
      isActive: false,
    };
  })();

  function updateField(field: keyof PackingFormState, value: string) {
    const nextValue = field === 'policy' ? value : value.replace(/\D/g, '');
    setForm((current) => ({ ...current, [field]: nextValue }));
  }

  function fieldState(value: string) {
    if (value.trim() === '') return 'empty';
    return parsePositiveIntegerInput(value) === null ? 'invalid' : 'valid';
  }

  function activateRun() {
    if (!input || !calculation?.selected || !selectedPolicy) return;
    const cadence = parsePositiveIntegerInput(referenceCadence);
    if (cadence === null) return;
    startRun({
      requestedUnits: input.quantity,
      unitsPerCarton: input.unitsPerCarton,
      cartonsPerLoad: input.cartonsPerPalette,
      selectedPolicy,
      plannedUnits: calculation.selected.totalPrepared,
      referenceCadenceUnitsPerMinute: cadence,
    });
  }

  const quantityState = fieldState(form.quantity);
  const unitsPerCartonState = fieldState(form.unitsPerCarton);
  const cartonsPerPaletteState = fieldState(form.cartonsPerPalette);
  const combinationInvalid =
    quantityState === 'valid' &&
    unitsPerCartonState === 'valid' &&
    cartonsPerPaletteState === 'valid' &&
    !input;
  const neutral = operational === null;

  return (
    <div className="packing-calculator-page relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-slate-100/80 to-transparent" aria-hidden="true" />
      <div className="packing-page-frame relative mx-auto max-w-[1480px] px-3 py-5 sm:px-6 sm:py-7 lg:px-8 xl:py-8">
        <header className="mb-5 flex flex-col gap-4 border-b border-slate-200/80 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-teal-700">
              <Boxes size={14} aria-hidden="true" />
              ProtoCap · Conditionnement
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-slate-950 sm:text-4xl">Packing Calculator</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-600">
              Transformer une quantité demandée en plan de préparation clair, puis déclarer la production réellement conditionnée.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-[11px] font-bold text-slate-500 shadow-sm backdrop-blur sm:self-auto">
            <CircleDot size={13} className="text-teal-700" aria-hidden="true" />
            Calcul local · instantané
          </div>
        </header>

        <div className="packing-columns grid gap-5 xl:grid-cols-[minmax(22rem,0.78fr)_minmax(0,1.22fr)] xl:items-start">
          <section aria-label="Référence et résultat exact" className="min-w-0 space-y-5">
            <section className="packing-reference-card rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">01 · Référence</p>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Paramètres de référence</h2>
                </div>
                <PackageCheck size={22} className="text-teal-700" aria-hidden="true" />
              </div>
              <div className="grid gap-4">
                <PackingField label="Quantité demandée en unités" value={form.quantity} placeholder="Ex : 30880" invalid={quantityState === 'invalid'} prominent onChange={(value) => updateField('quantity', value)} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <PackingField label="Unités par carton" value={form.unitsPerCarton} placeholder="Ex : 128" invalid={unitsPerCartonState === 'invalid'} onChange={(value) => updateField('unitsPerCarton', value)} />
                  <PackingField label="Cartons par palette" value={form.cartonsPerPalette} placeholder="Ex : 40" invalid={cartonsPerPaletteState === 'invalid'} onChange={(value) => updateField('cartonsPerPalette', value)} />
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
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">02 · Décision</p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Stratégie de préparation</h2>
                <p className="mt-1 text-sm font-medium text-slate-500">Le choix modifie le brouillon, jamais un run déjà actif.</p>
              </div>
              <div role="radiogroup" aria-label="Politique opérationnelle" className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                {calculation
                  ? calculation.options.map((option) => (
                      <StrategyCard key={option.policy} option={option} active={selectedPolicy === option.policy} recommended={calculation.recommendation.policy === option.policy} onSelect={() => setSelectedPolicy(option.policy)} />
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

          <section aria-label="Plan actif et déclarations de production" className="min-w-0 space-y-5">
            {neutral ? (
              <div className="grid min-h-[28rem] place-items-center rounded-[2rem] border border-dashed border-slate-300 bg-white/70 px-6 text-center shadow-sm">
                <div className="max-w-md">
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Boxes size={27} aria-hidden="true" /></span>
                  <h2 className="mt-5 text-xl font-black tracking-tight text-slate-950">Plan en attente</h2>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                    {combinationInvalid ? 'La combinaison saisie dépasse le domaine de calcul exact.' : input && calculation ? 'Choisissez une stratégie pour préparer l’activation du run.' : 'Renseignez la quantité et le conditionnement.'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <section className="packing-plan overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-[0_30px_90px_rgba(15,23,42,0.18)]">
                  <div className="packing-plan-header border-b border-white/10 px-5 py-4 sm:px-7">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-teal-300">03 · {operational.isActive ? 'Run actif' : 'Plan candidat'}</p>
                        <h2 className="mt-1 text-xl font-black tracking-tight">Découpage final sélectionné</h2>
                      </div>
                      <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-200">
                        <CheckCircle2 size={14} className="text-teal-300" aria-hidden="true" />
                        {operational.selected.label}
                      </span>
                    </div>
                  </div>
                  <div className="packing-plan-body p-5 sm:p-7">
                    <div className="packing-plan-metrics grid gap-6 sm:grid-cols-3">
                      <PlanMetric value={operational.plan.fullLoadCount} label="Charges complètes" />
                      <PlanMetric value={operational.plan.remainderLoad ? 1 : 0} label="Charge partielle théorique" />
                      <PlanMetric value={operational.plan.totalLoads} label="Charges planifiées" />
                    </div>
                    <div className="mt-7 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-3">
                      <div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Demandé</p><p className="mt-1 break-words text-xl font-black tabular-nums">{formatNumber(operational.input.quantity)}</p></div>
                      <div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Planifié</p><p className="mt-1 break-words text-xl font-black tabular-nums">{formatNumber(operational.selected.totalPrepared)}</p></div>
                      <div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Écart</p><p className={`mt-1 break-words text-xl font-black tabular-nums ${operational.selected.variance === 0 ? 'text-emerald-300' : 'text-amber-300'}`}>+{formatNumber(operational.selected.variance)}</p></div>
                    </div>
                  </div>
                </section>

                {activeRun ? (
                  <PackingRunExecution run={activeRun} persistenceStatus={persistenceStatus} onRunChange={updateRun} onNewRun={clearRun} />
                ) : (
                  <RunActivation cadence={referenceCadence} onCadenceChange={setReferenceCadence} onActivate={activateRun} persistenceDegraded={persistenceStatus === 'degraded'} />
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
