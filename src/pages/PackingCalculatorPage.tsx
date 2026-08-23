import { Calculator, CheckCircle2, PackageCheck, PackagePlus, Scale, TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import {
  calculateExactPacking,
  calculatePackingOptions,
  getPackingRecommendation,
  isValidPackingInput,
  parsePositiveIntegerInput,
  type PackingInput,
  type PackingPolicy
} from '../utils/packing';

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
  policy: 'no-overrun'
};

const policyLabels: Record<PackingPolicy, string> = {
  'no-overrun': 'Ne pas dépasser',
  'round-carton': 'Arrondir au carton',
  'round-pallet': 'Arrondir à la palette'
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

function ResultMetric({ label, value, detail }: { label: string; value: number; detail?: string }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="label leading-4">{label}</p>
      <p className="mt-2 truncate text-2xl font-black tabular-nums text-slate-950 sm:text-3xl">{formatNumber(value)}</p>
      {detail ? <p className="mt-1 text-xs font-medium text-slate-500">{detail}</p> : null}
    </div>
  );
}

export function PackingCalculatorPage() {
  const [form, setForm] = useLocalStorage<PackingFormState>('lineops.packing.form.inputs', defaultForm);
  const input = useMemo(() => parsePackingInput(form), [form]);

  const calculation = useMemo(() => {
    if (!input) return null;
    const exact = calculateExactPacking(input);
    const options = calculatePackingOptions(input);
    const recommendation = getPackingRecommendation(options);
    const selected = options.find((option) => option.policy === form.policy) ?? options[0];
    return { exact, options, recommendation, selected };
  }, [form.policy, input]);

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
  const neutral = !calculation || !input;

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-6">
        <p className="label">Module calcul</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">Packing Calculator</h1>
        <p className="mt-2 max-w-3xl text-slate-600">Convertir une quantité demandée en découpage opérationnel selon le conditionnement de la référence.</p>
        <p className="mt-2 max-w-3xl text-sm font-semibold text-teal-800">Calcul rapide, écart visible, décision fiabilisée.</p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[0.92fr_1.08fr]">
        <section className="panel p-4 sm:p-5">
          <div className="mb-5 flex items-start gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700">
              <Calculator size={24} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-950">Paramètres de référence</h2>
              <p className="text-sm text-slate-500">Les dernières valeurs sont conservées localement dans le navigateur.</p>
            </div>
          </div>

          <div className="grid gap-4">
            <label>
              <span className="label">Quantité demandée en unités</span>
              <input
                className={`field mt-1 ${quantityState === 'invalid' ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/10' : ''}`}
                autoComplete="off"
                inputMode="numeric"
                pattern="[0-9]*"
                type="text"
                value={form.quantity}
                placeholder="Ex : 30880"
                aria-invalid={quantityState === 'invalid'}
                onChange={(event) => updateField('quantity', event.target.value)}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="label">Unités par carton</span>
                <input
                  className={`field mt-1 ${unitsPerCartonState === 'invalid' ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/10' : ''}`}
                  autoComplete="off"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  type="text"
                  value={form.unitsPerCarton}
                  placeholder="Ex : 128"
                  aria-invalid={unitsPerCartonState === 'invalid'}
                  onChange={(event) => updateField('unitsPerCarton', event.target.value)}
                />
              </label>
              <label>
                <span className="label">Cartons par palette</span>
                <input
                  className={`field mt-1 ${cartonsPerPaletteState === 'invalid' ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/10' : ''}`}
                  autoComplete="off"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  type="text"
                  value={form.cartonsPerPalette}
                  placeholder="Ex : 40"
                  aria-invalid={cartonsPerPaletteState === 'invalid'}
                  onChange={(event) => updateField('cartonsPerPalette', event.target.value)}
                />
              </label>
            </div>

            {!neutral && calculation ? (
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-4">
                <ResultMetric label="Unités / palette" value={calculation.exact.unitsPerPalette} />
                <ResultMetric label="Palettes pleines" value={calculation.exact.palettesCompletes} />
                <ResultMetric label="Cartons pleins" value={calculation.exact.cartonsComplets} />
                <ResultMetric label="Unités restantes" value={calculation.exact.unitesRestantes} />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-500">
                Renseigne trois entiers positifs dont les calculs restent représentables exactement pour afficher le découpage.
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          {calculation ? (
            <>
              <div className="panel p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="label">Option recommandée</p>
                    <h2 className="mt-1 text-lg font-bold text-slate-950">{calculation.recommendation.label}</h2>
                  </div>
                  <CheckCircle2 className="text-emerald-600" size={28} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <ResultMetric label="Palettes" value={calculation.recommendation.palettes} />
                  <ResultMetric label="Cartons" value={calculation.recommendation.cartons} />
                  <ResultMetric label="Unités" value={calculation.recommendation.units} />
                  <ResultMetric label="Écart" value={calculation.recommendation.variance} />
                </div>
              </div>

              <div className="grid gap-3">
                {calculation.options.map((option) => {
                  const selected = calculation.selected.policy === option.policy;
                  return (
                    <button
                      type="button"
                      key={option.policy}
                      onClick={() => updateField('policy', option.policy)}
                      className={`rounded-2xl border p-4 text-left transition ${selected ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-500/20' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-950">{policyLabels[option.policy]}</p>
                          <p className="mt-1 text-sm text-slate-500">Préparé : {formatNumber(option.totalPrepared)} unités</p>
                        </div>
                        {option.variance > 0 ? (
                          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">+{formatNumber(option.variance)}</span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800">Exact</span>
                        )}
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                        <span><strong>{formatNumber(option.palettes)}</strong> palettes</span>
                        <span><strong>{formatNumber(option.cartons)}</strong> cartons</span>
                        <span><strong>{formatNumber(option.units)}</strong> unités</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <PackageCheck className="text-teal-700" size={20} />
                  <p className="mt-2 text-sm font-bold text-slate-950">Sans dépassement</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Respecte exactement la quantité demandée.</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <PackagePlus className="text-amber-700" size={20} />
                  <p className="mt-2 text-sm font-bold text-slate-950">Carton supérieur</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Complète le dernier carton si nécessaire.</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <Scale className="text-slate-700" size={20} />
                  <p className="mt-2 text-sm font-bold text-slate-950">Palette supérieure</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Complète la dernière palette si nécessaire.</p>
                </div>
              </div>
            </>
          ) : (
            <div className="panel grid min-h-72 place-items-center p-6 text-center">
              <div>
                <TriangleAlert className="mx-auto text-slate-400" size={30} />
                <h2 className="mt-3 text-lg font-bold text-slate-950">Aucun calcul fiable à afficher</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Saisis des valeurs positives dont toutes les opérations restent dans la plage d’entiers exactement représentables.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
