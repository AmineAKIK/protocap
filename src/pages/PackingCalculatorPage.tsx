import {
  ArrowRight,
  Boxes,
  Check,
  CheckCircle2,
  CircleDot,
  Minus,
  PackageCheck,
  Plus,
  RotateCcw,
  Sparkles,
  TriangleAlert,
  Truck
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import {
  calculateExactPacking,
  calculatePackingOptions,
  getPackingRecommendation,
  isValidPackingInput,
  parsePositiveIntegerInput,
  type PackingInput,
  type PackingOption,
  type PackingPolicy
} from '../utils/packing';
import {
  createPackingShipmentPlan,
  getPackingShipmentProgress,
  type PackingShipmentLoad,
  type PackingShipmentPlan,
  type PackingShipmentProgress
} from '../utils/packingShipment';

interface PackingFormState {
  quantity: string;
  unitsPerCarton: string;
  cartonsPerPalette: string;
  policy: PackingPolicy;
}

interface PackingTrackingState {
  progressByCalculation: Record<string, number>;
}

const defaultForm: PackingFormState = {
  quantity: '',
  unitsPerCarton: '',
  cartonsPerPalette: '',
  policy: 'no-overrun'
};

const defaultTracking: PackingTrackingState = {
  progressByCalculation: {}
};

const policyLabels: Record<PackingPolicy, string> = {
  'no-overrun': 'Exact',
  'round-carton': 'Carton',
  'round-pallet': 'Palette'
};

const policyDescriptions: Record<PackingPolicy, string> = {
  'no-overrun': 'Sans dépassement',
  'round-carton': 'Cartons complets',
  'round-pallet': 'Palettes complètes'
};

const numberFormatter = new Intl.NumberFormat('fr-FR');
const percentFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function formatPercent(ratio: number): string {
  return percentFormatter.format(ratio * 100);
}

function parsePackingInput(form: PackingFormState): PackingInput | null {
  const quantity = parsePositiveIntegerInput(form.quantity);
  const unitsPerCarton = parsePositiveIntegerInput(form.unitsPerCarton);
  const cartonsPerPalette = parsePositiveIntegerInput(form.cartonsPerPalette);

  if (quantity === null || unitsPerCarton === null || cartonsPerPalette === null) return null;
  const input = { quantity, unitsPerCarton, cartonsPerPalette };
  return isValidPackingInput(input) ? input : null;
}

function getTrackingProgress(tracking: PackingTrackingState | null | undefined): Record<string, number> {
  const progress = tracking?.progressByCalculation;
  return progress && typeof progress === 'object' && !Array.isArray(progress) ? progress : {};
}

function PackingField({
  label,
  value,
  placeholder,
  invalid,
  onChange,
  prominent = false
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
          prominent ? 'min-h-16 px-4 text-2xl sm:text-3xl' : 'min-h-14 px-4 text-lg'
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
  onSelect
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
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
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

      <div className={`mt-4 flex min-h-6 items-center gap-1.5 text-[11px] font-black uppercase tracking-wide ${active ? 'text-slate-300' : 'text-slate-500'}`}>
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
    <div className="min-w-0">
      <p className="break-words text-[clamp(2rem,5vw,4.25rem)] font-black leading-none tracking-[-0.05em] tabular-nums text-white">
        {formatNumber(value)}
      </p>
      <p className="mt-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 sm:text-xs">{label}</p>
    </div>
  );
}

function loadDescription(load: PackingShipmentLoad | null): string {
  if (!load) return 'Aucune charge restante';
  if (load.kind === 'full-pallet') {
    return `${formatNumber(load.cartons)} cartons · ${formatNumber(load.totalUnits)} unités`;
  }

  const parts: string[] = [];
  if (load.cartons > 0) parts.push(`${formatNumber(load.cartons)} ${load.cartons === 1 ? 'carton' : 'cartons'}`);
  if (load.looseUnits > 0) parts.push(`${formatNumber(load.looseUnits)} unités libres`);
  return `${parts.join(' + ')} · ${formatNumber(load.totalUnits)} unités`;
}

function ShipmentExecution({
  plan,
  progress,
  onDecrement,
  onIncrement,
  onReset
}: {
  plan: PackingShipmentPlan;
  progress: PackingShipmentProgress;
  onDecrement: () => void;
  onIncrement: () => void;
  onReset: () => void;
}) {
  const isComplete = progress.remainingLoads === 0;
  const loadPercent = formatPercent(progress.loadProgressRatio);
  const volumePercent = formatPercent(progress.unitProgressRatio);

  return (
    <section
      aria-labelledby="packing-shipment-title"
      className={`overflow-hidden rounded-[1.75rem] border bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)] ${isComplete ? 'border-emerald-200' : 'border-slate-200'}`}
    >
      <div className={`border-b px-5 py-4 sm:px-6 ${isComplete ? 'border-emerald-200 bg-emerald-50/70' : 'border-slate-200 bg-white'}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`grid h-10 w-10 place-items-center rounded-xl ${isComplete ? 'bg-emerald-700 text-white' : 'bg-slate-950 text-white'}`}>
              {isComplete ? <CheckCircle2 size={20} aria-hidden="true" /> : <Truck size={20} aria-hidden="true" />}
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Exécution atelier</p>
              <h2 id="packing-shipment-title" className="mt-0.5 text-lg font-black tracking-tight text-slate-950">Charges à expédier</h2>
            </div>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-500">Enregistré sur cet appareil</span>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <p className="sr-only" role="status" aria-live="polite">
          {formatNumber(progress.remainingLoads)} {progress.remainingLoads === 1 ? 'charge restante' : 'charges restantes'}, {formatNumber(progress.shippedLoads)} {progress.shippedLoads === 1 ? 'charge expédiée' : 'charges expédiées'} sur {formatNumber(plan.totalLoads)}.
        </p>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.72fr)] xl:items-end">
          <div className="min-w-0">
            <p
              className={`text-[clamp(3.5rem,8vw,6.5rem)] font-black leading-[0.85] tracking-[-0.07em] tabular-nums ${isComplete ? 'text-emerald-700' : 'text-slate-950'}`}
              aria-label={`${formatNumber(progress.remainingLoads)} ${progress.remainingLoads === 1 ? 'charge restante' : 'charges restantes'}`}
            >
              {formatNumber(progress.remainingLoads)}
            </p>
            <p className="mt-3 text-sm font-black uppercase tracking-[0.14em] text-slate-500">
              {progress.remainingLoads === 1 ? 'charge restante' : 'charges restantes'}
            </p>
            <p className="mt-3 text-sm font-semibold text-slate-600">
              {isComplete
                ? 'Toutes les charges prévues ont été déclarées comme expédiées.'
                : `${formatNumber(progress.shippedLoads)} / ${formatNumber(plan.totalLoads)} charges expédiées`}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{isComplete ? 'Statut' : 'Prochaine charge'}</p>
            <p className="mt-2 text-lg font-black text-slate-950">
              {isComplete ? 'Expédition terminée' : progress.nextLoad?.kind === 'remainder' ? 'Charge reliquat' : `Palette ${formatNumber((progress.nextLoad?.index ?? 0) + 1)}`}
            </p>
            <p className="mt-1 text-sm font-medium leading-6 text-slate-600">
              {isComplete ? `${formatNumber(plan.totalUnits)} unités déclarées expédiées.` : loadDescription(progress.nextLoad)}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Avancement des charges</p>
                <p className="mt-1 text-xl font-black tabular-nums text-slate-950">{formatNumber(progress.shippedLoads)} / {formatNumber(plan.totalLoads)}</p>
              </div>
              <span className="text-sm font-black tabular-nums text-slate-500">{loadPercent} %</span>
            </div>
            <div
              role="progressbar"
              aria-label="Avancement des charges expédiées"
              aria-valuemin={0}
              aria-valuemax={plan.totalLoads}
              aria-valuenow={progress.shippedLoads}
              className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"
            >
              <div
                className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${isComplete ? 'bg-emerald-600' : 'bg-teal-600'}`}
                style={{ width: `${progress.loadProgressRatio * 100}%` }}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Volume expédié</p>
                <p className="mt-1 break-words text-xl font-black tabular-nums text-slate-950">{formatNumber(progress.shippedUnits)} / {formatNumber(plan.totalUnits)}</p>
              </div>
              <span className="shrink-0 text-sm font-black tabular-nums text-slate-500">{volumePercent} %</span>
            </div>
            <div
              role="progressbar"
              aria-label="Volume d'unités expédié"
              aria-valuemin={0}
              aria-valuemax={plan.totalUnits}
              aria-valuenow={progress.shippedUnits}
              className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"
            >
              <div
                className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${isComplete ? 'bg-emerald-600' : 'bg-slate-800'}`}
                style={{ width: `${progress.unitProgressRatio * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
          <button
            type="button"
            aria-label="Corriger la dernière charge expédiée"
            disabled={progress.shippedLoads === 0}
            onClick={onDecrement}
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300 sm:min-w-36"
          >
            <Minus size={18} aria-hidden="true" />
            Corriger
          </button>
          <button
            type="button"
            aria-label={isComplete ? 'Expédition terminée' : 'Déclarer la prochaine charge expédiée'}
            disabled={isComplete}
            onClick={onIncrement}
            className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-teal-700 px-6 text-base font-black text-white shadow-lg shadow-teal-900/15 transition hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-700/20 disabled:cursor-not-allowed disabled:bg-emerald-700 sm:min-h-16"
          >
            {isComplete ? <CheckCircle2 size={21} aria-hidden="true" /> : <Plus size={21} aria-hidden="true" />}
            {isComplete ? 'Expédition terminée' : 'Déclarer la prochaine charge expédiée'}
          </button>
        </div>

        {progress.shippedLoads > 0 ? (
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={onReset} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-950">
              <RotateCcw size={15} aria-hidden="true" />
              Réinitialiser le suivi
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function PackingCalculatorPage() {
  const [form, setForm] = useLocalStorage<PackingFormState>('lineops.packing.form.inputs', defaultForm);
  const [tracking, setTracking] = useLocalStorage<PackingTrackingState>('lineops.packing.shipment.progress', defaultTracking);
  const [selectedPolicy, setSelectedPolicy] = useState<PackingPolicy | null>(null);
  const input = useMemo(() => parsePackingInput(form), [form]);

  const calculation = useMemo(() => {
    if (!input) return null;
    const exact = calculateExactPacking(input);
    const options = calculatePackingOptions(input);
    const recommendation = getPackingRecommendation(options);
    const selected = selectedPolicy ? options.find((option) => option.policy === selectedPolicy) ?? null : null;
    return { exact, options, recommendation, selected };
  }, [input, selectedPolicy]);

  const shipment = useMemo(() => {
    if (!calculation?.selected || !input || !selectedPolicy) return null;

    const calculationKey = `${input.quantity}:${input.unitsPerCarton}:${input.cartonsPerPalette}:${selectedPolicy}`;
    const plan = createPackingShipmentPlan(input, calculation.selected);
    const storedCount = getTrackingProgress(tracking)[calculationKey];
    const progress = getPackingShipmentProgress(plan, Number.isSafeInteger(storedCount) ? storedCount : 0);

    return { calculationKey, plan, progress };
  }, [calculation, input, selectedPolicy, tracking]);

  function changeShippedPallets(delta: number) {
    if (!shipment) return;

    setTracking((current) => {
      const progressByCalculation = getTrackingProgress(current);
      const storedCount = progressByCalculation[shipment.calculationKey];
      const currentCount = Number.isSafeInteger(storedCount) ? storedCount : 0;
      return {
        progressByCalculation: {
          ...progressByCalculation,
          [shipment.calculationKey]: Math.min(shipment.plan.totalLoads, Math.max(0, currentCount + delta))
        }
      };
    });
  }

  function resetShipmentTracking() {
    if (!shipment) return;
    setTracking((current) => ({
      progressByCalculation: {
        ...getTrackingProgress(current),
        [shipment.calculationKey]: 0
      }
    }));
  }

  function updateField(field: keyof PackingFormState, value: string) {
    const nextValue = field === 'policy' ? value : value.replace(/\D/g, '');
    setForm((current) => ({ ...current, [field]: nextValue }));
  }

  function fieldState(value: string) {
    if (value.trim() === '') return 'empty';
    return parsePositiveIntegerInput(value) === null ? 'invalid' : 'valid';
  }

  const quantityState = fieldState(form.quantity);
  const unitsPerCartonState = fieldState(form.unitsPerCarton);
  const cartonsPerPaletteState = fieldState(form.cartonsPerPalette);
  const combinationInvalid =
    quantityState === 'valid' &&
    unitsPerCartonState === 'valid' &&
    cartonsPerPaletteState === 'valid' &&
    !input;
  const selectedOption = calculation?.selected ?? null;
  const neutral = !calculation || !input || !selectedOption;

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-slate-100/80 to-transparent" aria-hidden="true" />
      <div className="relative mx-auto max-w-[1480px] px-3 py-5 sm:px-6 sm:py-7 lg:px-8 xl:py-8">
        <header className="mb-5 flex flex-col gap-4 border-b border-slate-200/80 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-teal-700">
              <Boxes size={14} aria-hidden="true" />
              ProtoCap · Conditionnement
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-slate-950 sm:text-4xl">Packing Calculator</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-600">
              Transformer une quantité demandée en plan de préparation clair, comparable et directement exécutable à l'atelier.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-[11px] font-bold text-slate-500 shadow-sm backdrop-blur sm:self-auto">
            <CircleDot size={13} className="text-teal-700" aria-hidden="true" />
            Calcul local · instantané
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[minmax(22rem,0.78fr)_minmax(0,1.22fr)] xl:items-start">
          <section aria-label="Référence et résultat exact" className="min-w-0 space-y-5">
            <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">01 · Référence</p>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Paramètres de référence</h2>
                </div>
                <PackageCheck size={22} className="text-teal-700" aria-hidden="true" />
              </div>

              <div className="grid gap-4">
                <PackingField
                  label="Quantité demandée en unités"
                  value={form.quantity}
                  placeholder="Ex : 30880"
                  invalid={quantityState === 'invalid'}
                  prominent
                  onChange={(value) => updateField('quantity', value)}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <PackingField
                    label="Unités par carton"
                    value={form.unitsPerCarton}
                    placeholder="Ex : 128"
                    invalid={unitsPerCartonState === 'invalid'}
                    onChange={(value) => updateField('unitsPerCarton', value)}
                  />
                  <PackingField
                    label="Cartons par palette"
                    value={form.cartonsPerPalette}
                    placeholder="Ex : 40"
                    invalid={cartonsPerPaletteState === 'invalid'}
                    onChange={(value) => updateField('cartonsPerPalette', value)}
                  />
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
                    <span className="text-xs font-semibold text-slate-500">
                      · {formatNumber(input.cartonsPerPalette)} cartons × {formatNumber(input.unitsPerCarton)}
                    </span>
                  </div>
                ) : (
                  <p className="mt-2 text-sm font-medium text-slate-400">Renseignez les trois valeurs pour construire le plan.</p>
                )}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.05)] sm:p-6">
              <div className="mb-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">02 · Décision</p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Stratégie de préparation</h2>
                <p className="mt-1 text-sm font-medium text-slate-500">Comparez l'impact avant de choisir.</p>
              </div>

              <div role="radiogroup" aria-label="Politique opérationnelle" className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                {calculation
                  ? calculation.options.map((option) => (
                      <StrategyCard
                        key={option.policy}
                        option={option}
                        active={selectedPolicy === option.policy}
                        recommended={calculation.recommendation.policy === option.policy}
                        onSelect={() => setSelectedPolicy(option.policy)}
                      />
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

            {calculation && input ? (
              <section aria-labelledby="packing-exact-title" className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Référence théorique</p>
                    <h2 id="packing-exact-title" className="mt-1 text-sm font-black text-slate-950">Résultat exact</h2>
                  </div>
                  <p className="text-right text-sm font-bold tabular-nums text-slate-600">
                    {formatNumber(calculation.exact.palettesCompletes)} P · {formatNumber(calculation.exact.cartonsComplets)} C · {formatNumber(calculation.exact.unitesRestantes)} U
                  </p>
                </div>
              </section>
            ) : null}
          </section>

          <section aria-label="Découpage final et suivi manuel" className="min-w-0 space-y-5">
            {neutral ? (
              <div className="grid min-h-[28rem] place-items-center rounded-[2rem] border border-dashed border-slate-300 bg-white/70 px-6 text-center shadow-sm">
                <div className="max-w-md">
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
                    <Boxes size={27} aria-hidden="true" />
                  </span>
                  <h2 className="mt-5 text-xl font-black tracking-tight text-slate-950">Plan en attente</h2>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                    {combinationInvalid
                      ? 'La combinaison saisie dépasse le domaine de calcul exact.'
                      : input && calculation
                        ? 'Choisissez une stratégie de préparation pour activer le plan et le suivi atelier.'
                        : 'Renseignez la quantité et le conditionnement. Les trois stratégies seront calculées avant votre choix.'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <section className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-[0_30px_90px_rgba(15,23,42,0.18)]">
                  <div className="border-b border-white/10 px-5 py-4 sm:px-7">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-teal-300">03 · Plan actif</p>
                        <h2 className="mt-1 text-xl font-black tracking-tight">Découpage final sélectionné</h2>
                      </div>
                      <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-200">
                        <CheckCircle2 size={14} className="text-teal-300" aria-hidden="true" />
                        {selectedOption.label}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 sm:p-7">
                    <div className="grid gap-6 sm:grid-cols-3">
                      <PlanMetric value={shipment!.plan.fullLoadCount} label="Palettes complètes" />
                      <PlanMetric value={shipment!.plan.remainderLoad ? 1 : 0} label="Charge reliquat" />
                      <PlanMetric value={shipment!.plan.totalLoads} label="Charges à expédier" />
                    </div>

                    {shipment!.plan.remainderLoad ? (
                      <div className="mt-7 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Composition du reliquat</p>
                          <p className="mt-1 text-base font-black">
                            {loadDescription({ index: shipment!.plan.fullLoadCount, ...shipment!.plan.remainderLoad })}
                          </p>
                        </div>
                        <ArrowRight size={20} className="hidden text-teal-300 sm:block" aria-hidden="true" />
                      </div>
                    ) : (
                      <div className="mt-7 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-200">
                        Aucun reliquat : le plan utilise uniquement des palettes complètes.
                      </div>
                    )}

                    <div className="mt-7 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Demandé</p>
                        <p className="mt-1 break-words text-xl font-black tabular-nums">{formatNumber(input.quantity)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Préparé</p>
                        <p className="mt-1 break-words text-xl font-black tabular-nums">{formatNumber(selectedOption.totalPrepared)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Écart</p>
                        <p className={`mt-1 break-words text-xl font-black tabular-nums ${selectedOption.variance === 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                          +{formatNumber(selectedOption.variance)}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                {shipment ? (
                  <ShipmentExecution
                    plan={shipment.plan}
                    progress={shipment.progress}
                    onDecrement={() => changeShippedPallets(-1)}
                    onIncrement={() => changeShippedPallets(1)}
                    onReset={resetShipmentTracking}
                  />
                ) : null}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}