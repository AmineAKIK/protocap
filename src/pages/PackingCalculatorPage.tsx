import { Calculator, CheckCircle2, PackageCheck, PackagePlus, Scale, TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import {
  calculateExactPacking,
  calculatePackingOptions,
  getPackingRecommendation,
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
  return { quantity, unitsPerCarton, cartonsPerPalette };
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
    const recommendation = getPackingRecommendation(options, form.policy, input.unitsPerCarton);
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
          </div>

          <div className="mt-5">
            <p className="label mb-2">Politique opérationnelle</p>
            <div className="grid gap-2 min-[520px]:grid-cols-3">
              {(Object.keys(policyLabels) as PackingPolicy[]).map((policy) => (
                <button
                  key={policy}
                  type="button"
                  onClick={() => updateField('policy', policy)}
                  className={`min-h-[4rem] rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                    form.policy === policy
                      ? 'border-teal-700 bg-teal-700 text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="block">{policyLabels[policy]}</span>
                  <span className={`mt-0.5 block min-h-4 text-[11px] font-bold ${form.policy === policy ? 'text-teal-100' : 'text-teal-700'}`}>
                    {calculation && calculation.recommendation.policy === policy ? 'Recommandé' : ''}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-start gap-3">
              <PackageCheck size={18} className="mt-0.5 shrink-0 text-teal-700" />
              <div>
                <p className="text-sm font-bold text-slate-900">Mini formule</p>
                <p className="mt-1 text-sm text-slate-600">
                  {input && calculation
                    ? `1 palette = ${formatNumber(input.cartonsPerPalette)} cartons × ${formatNumber(input.unitsPerCarton)} unités = ${formatNumber(calculation.exact.unitsPerPalette)} unités.`
                    : 'Renseignez des nombres entiers positifs pour afficher la capacité palette.'}
                </p>
              </div>
            </div>
          </div>

          {!neutral && calculation.selected.variance > 0 ? (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <TriangleAlert size={18} className="mt-0.5 shrink-0 text-amber-600" />
              <p>
                {form.policy === 'round-pallet' ? "L'arrondi palette" : "L'arrondi carton"} prépare {formatNumber(calculation.selected.variance)} unités de plus que la quantité demandée.
              </p>
            </div>
          ) : null}
        </section>

        <section className="space-y-5">
          {neutral ? (
            <div className="panel px-4 py-14 text-center sm:px-6">
              <Scale size={36} className="mx-auto mb-3 text-slate-300" />
              <h2 className="text-lg font-bold text-slate-950">Calcul en attente</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Saisissez une quantité, des unités par carton et des cartons par palette avec des nombres entiers positifs.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border-2 border-teal-500 bg-teal-50 p-3 shadow-md sm:p-4">
                <div className="rounded-xl bg-teal-700 px-4 py-4 text-white">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-teal-100">Découpage final sélectionné</p>
                      <h2 className="mt-1 text-2xl font-black">{calculation.selected.label}</h2>
                    </div>
                    <CheckCircle2 size={28} className="text-teal-100" />
                  </div>
                </div>

                <div className="mt-3 grid gap-3 min-[520px]:grid-cols-3">
                  <ResultMetric label="Palettes complètes" value={calculation.selected.palettes} />
                  <ResultMetric label="Cartons complets" value={calculation.selected.cartons} />
                  <ResultMetric label="Unités restantes" value={calculation.selected.units} />
                </div>

                <div className="mt-3 grid gap-3 min-[520px]:grid-cols-3">
                  <div className="rounded-lg bg-white px-4 py-3">
                    <p className="label">Total demandé</p>
                    <p className="mt-1 truncate text-lg font-black tabular-nums text-slate-950">{formatNumber(input.quantity)}</p>
                  </div>
                  <div className="rounded-lg bg-white px-4 py-3">
                    <p className="label">Total préparé</p>
                    <p className="mt-1 truncate text-lg font-black tabular-nums text-slate-950">{formatNumber(calculation.selected.totalPrepared)}</p>
                  </div>
                  <div className="rounded-lg bg-white px-4 py-3">
                    <p className="label">Écart</p>
                    <p className={`mt-1 text-lg font-black tabular-nums ${calculation.selected.variance === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                      +{formatNumber(calculation.selected.variance)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="panel p-4 sm:p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-900 text-white">
                    <PackagePlus size={20} />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-950">Résultat exact</h2>
                    <p className="text-sm text-slate-500">
                      {formatNumber(calculation.exact.palettesCompletes)} palettes complètes, {formatNumber(calculation.exact.cartonsComplets)} cartons complets, {formatNumber(calculation.exact.unitesRestantes)} unités restantes.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 min-[520px]:grid-cols-3">
                  <ResultMetric label="Capacité palette" value={calculation.exact.unitsPerPalette} detail={`${formatNumber(input.cartonsPerPalette)} cartons`} />
                  <ResultMetric label="Capacité carton" value={input.unitsPerCarton} detail="unités par carton" />
                  <ResultMetric label="Total" value={input.quantity} detail="quantité demandée" />
                </div>
              </div>

            </>
          )}
        </section>
      </div>

      <section className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
        <h2 className="text-base font-bold text-slate-950">Pourquoi ce module ?</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Réduit les calculs manuels et rend visible l'écart entre la quantité demandée et la quantité préparée.
        </p>
      </section>
    </div>
  );
}
