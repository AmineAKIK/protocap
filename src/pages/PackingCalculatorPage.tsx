import { Boxes, CheckCircle2, CircleDot } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PackingCockpitSummary } from '../features/packing/components/PackingCockpitSummary';
import { PackingPlanCandidate } from '../features/packing/components/PackingPlanCandidate';
import {
  PackingPlanningRail,
  type PackingPlanningFormState,
} from '../features/packing/components/PackingPlanningRail';
import { PackingRunExecution } from '../features/packing/components/PackingRunExecution';
import { usePackingActiveRun } from '../features/packing/usePackingActiveRun';
import { useLocalStorage } from '../hooks/useLocalStorage';
import {
  calculateExactPacking,
  calculatePackingOptions,
  getPackingRecommendation,
  isValidPackingInput,
  parsePositiveIntegerInput,
  summarizePackingLoads,
  type PackingInput,
  type PackingPolicy,
} from '../utils/packing';

const defaultForm: PackingPlanningFormState = {
  quantity: '',
  unitsPerCarton: '',
  cartonsPerPalette: '',
};

function normalizePackingPlanningForm(form: PackingPlanningFormState): PackingPlanningFormState {
  return {
    quantity: form.quantity,
    unitsPerCarton: form.unitsPerCarton,
    cartonsPerPalette: form.cartonsPerPalette,
  };
}

function parsePackingInput(form: PackingPlanningFormState): PackingInput | null {
  const quantity = parsePositiveIntegerInput(form.quantity);
  const unitsPerCarton = parsePositiveIntegerInput(form.unitsPerCarton);
  const cartonsPerPalette = parsePositiveIntegerInput(form.cartonsPerPalette);

  if (quantity === null || unitsPerCarton === null || cartonsPerPalette === null) return null;
  const input = { quantity, unitsPerCarton, cartonsPerPalette };
  return isValidPackingInput(input) ? input : null;
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
    <section aria-labelledby="packing-run-activation-title" className="packing-run-activation rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-6">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-teal-700">Passer en exécution</p>
      <h2 id="packing-run-activation-title" className="mt-1 text-lg font-black tracking-tight text-slate-950">Activer le run</h2>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
        Le plan devient un snapshot opérationnel indépendant du brouillon de préparation.
      </p>
      <label className="mt-4 block max-w-sm">
        <span className="mb-1.5 block text-xs font-black text-slate-700">Cadence de référence · unités/minute</span>
        <input
          aria-label="Cadence de référence en unités par minute"
          inputMode="numeric"
          pattern="[0-9]*"
          value={cadence}
          onChange={(event) => onCadenceChange(event.target.value.replace(/\D/g, ''))}
          className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 font-black tabular-nums outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10"
        />
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={parsedCadence === null}
          onClick={onActivate}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
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
  const [form, setForm] = useLocalStorage<PackingPlanningFormState>(
    'lineops.packing.form.inputs',
    defaultForm,
    normalizePackingPlanningForm,
  );
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

  const candidate = (() => {
    if (activeRun || !input || !calculation?.selected || !selectedPolicy) return null;
    return {
      input,
      selected: calculation.selected,
      plan: summarizePackingLoads(input, calculation.selected),
    };
  })();

  function updateField(field: keyof PackingPlanningFormState, value: string) {
    const nextValue = value.replace(/\D/g, '');
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
  const neutral = !activeRun && candidate === null;

  return (
    <div className="packing-calculator-page relative overflow-hidden bg-slate-50/40">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-slate-100/90 via-slate-50/60 to-transparent" aria-hidden="true" />
      <div className="packing-page-frame relative mx-auto max-w-[1480px] px-3 py-5 sm:px-6 sm:py-7 lg:px-8 xl:py-8">
        <header className="packing-page-header mb-5 flex flex-col gap-4 border-b border-slate-200/80 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-teal-700">
              <Boxes size={14} aria-hidden="true" />
              ProtoCap · Conditionnement
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-slate-950 sm:text-4xl">Packing Cockpit</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-600">
              Préparer le plan, lire l’état de production à distance, puis déclarer le volume réellement conditionné.
            </p>
          </div>
          <div className="packing-local-status flex items-center gap-2 self-start rounded-full border border-slate-200 bg-white/90 px-3 py-2 text-[11px] font-bold text-slate-600 shadow-sm backdrop-blur sm:self-auto">
            <CircleDot size={13} className="text-teal-700" aria-hidden="true" />
            Run local · cockpit opérationnel
          </div>
        </header>

        <div className="packing-columns grid gap-5 xl:grid-cols-[minmax(22rem,0.78fr)_minmax(0,1.22fr)] xl:items-start">
          <section aria-label="Référence et résultat exact" className="min-w-0">
            <PackingPlanningRail
              form={form}
              input={input}
              calculation={calculation}
              selectedPolicy={selectedPolicy}
              quantityInvalid={quantityState === 'invalid'}
              unitsPerCartonInvalid={unitsPerCartonState === 'invalid'}
              cartonsPerPaletteInvalid={cartonsPerPaletteState === 'invalid'}
              combinationInvalid={combinationInvalid}
              onFieldChange={updateField}
              onSelectPolicy={setSelectedPolicy}
            />
          </section>

          <section aria-label="Plan actif et déclarations de production" className="min-w-0 space-y-5">
            {neutral ? (
              <div className="packing-empty-state grid min-h-[28rem] place-items-center rounded-[2rem] border border-dashed border-slate-300 bg-white/80 px-6 text-center shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
                <div className="max-w-md">
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-slate-200 bg-slate-100 text-slate-500"><Boxes size={27} aria-hidden="true" /></span>
                  <h2 className="mt-5 text-xl font-black tracking-tight text-slate-950">Cockpit en attente</h2>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                    {combinationInvalid ? 'La combinaison saisie dépasse le domaine de calcul exact.' : input && calculation ? 'Choisissez une stratégie pour préparer l’activation du run.' : 'Renseignez la quantité et le conditionnement.'}
                  </p>
                </div>
              </div>
            ) : activeRun ? (
              <>
                <PackingCockpitSummary run={activeRun} />
                <PackingRunExecution run={activeRun} persistenceStatus={persistenceStatus} onRunChange={updateRun} onNewRun={clearRun} />
              </>
            ) : candidate ? (
              <>
                <PackingPlanCandidate input={candidate.input} selected={candidate.selected} plan={candidate.plan} />
                <RunActivation cadence={referenceCadence} onCadenceChange={setReferenceCadence} onActivate={activateRun} persistenceDegraded={persistenceStatus === 'degraded'} />
              </>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
