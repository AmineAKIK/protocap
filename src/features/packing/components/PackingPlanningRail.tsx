import {
  Box,
  Boxes,
  CalendarClock,
  Check,
  Gauge,
  Layers3,
  PackageCheck,
  Play,
  RotateCcw,
} from 'lucide-react';
import type { ReactNode } from 'react';
import {
  calculatePackingOptions,
  summarizePackingLoads,
  type PackingInput,
  type PackingOption,
  type PackingPolicy,
} from '../../../utils/packing';
import { getPackingRunProductionStartedAt, type PackingRun } from '../domain/packingRun';

export interface PackingPlanningFormState {
  quantity: string;
  unitsPerCarton: string;
  cartonsPerPalette: string;
  productionStartTime: string;
  legacyProductionStartTime?: string;
  referenceCadence: string;
}

interface PackingPlanningCalculation {
  options: PackingOption[];
  selected: PackingOption | null;
}

interface PackingPlanningRailProps {
  form: PackingPlanningFormState;
  input: PackingInput | null;
  calculation: PackingPlanningCalculation | null;
  selectedPolicy: PackingPolicy | null;
  quantityInvalid: boolean;
  unitsPerCartonInvalid: boolean;
  cartonsPerPaletteInvalid: boolean;
  startTimeInvalid: boolean;
  cadenceInvalid: boolean;
  combinationInvalid: boolean;
  canLaunch: boolean;
  persistenceDegraded: boolean;
  onFieldChange: (field: keyof PackingPlanningFormState, value: string) => void;
  onSelectPolicy: (policy: PackingPolicy) => void;
  onLaunch: () => void;
  onReset: () => void;
}

const numberFormatter = new Intl.NumberFormat('fr-FR');
const formatNumber = (value: number) => numberFormatter.format(value);

const policyCopy: Record<PackingPolicy, { title: string; description: string }> = {
  'no-overrun': { title: 'Sans dépassement', description: 'Quantité exacte · dernier carton potentiellement incomplet' },
  'round-carton': { title: 'Carton complet', description: 'Arrondi au carton supérieur' },
  'round-pallet': { title: 'Palette complète', description: 'Arrondi à la palette supérieure' },
};

function NumericField({
  icon,
  label,
  value,
  invalid,
  suffix,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  invalid: boolean;
  suffix?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="packing-v3-field min-w-0">
      <span className="packing-v3-field-label">{label}</span>
      <span className={`packing-v3-field-control ${invalid ? 'packing-v3-field-invalid' : ''}`}>
        <span aria-hidden="true">{icon}</span>
        <input
          aria-label={label}
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          aria-invalid={invalid}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
        />
        {suffix ? <span className="packing-v3-field-suffix">{suffix}</span> : null}
      </span>
    </label>
  );
}

function StartTimeField({
  value,
  legacyTime,
  invalid,
  onChange,
}: {
  value: string;
  legacyTime?: string;
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="packing-v3-field min-w-0">
      <span className="packing-v3-field-label">Début OC</span>
      <span className={`packing-v3-field-control ${invalid ? 'packing-v3-field-invalid' : ''}`}>
        <CalendarClock size={18} aria-hidden="true" />
        <input
          aria-label="Début OC"
          type="datetime-local"
          value={value}
          aria-invalid={invalid}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
      {legacyTime ? (
        <small className="packing-v3-legacy-time">Heure enregistrée précédemment : {legacyTime}. Choisissez la date correspondante.</small>
      ) : null}
    </label>
  );
}

function StrategyCard({ option, active, onSelect }: { option: PackingOption; active: boolean; onSelect: () => void }) {
  const copy = policyCopy[option.policy];
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      className={`packing-v3-strategy ${active ? 'packing-v3-strategy-active' : ''}`}
      onClick={onSelect}
    >
      <span className="packing-v3-strategy-head">
        <span>
          <strong>{copy.title}</strong>
          <small>{copy.description}</small>
        </span>
        <span className="packing-v3-radio" aria-hidden="true">{active ? <Check size={13} strokeWidth={3} /> : null}</span>
      </span>
      <span className="packing-v3-strategy-result-label">Quantité résultante</span>
      <strong className="packing-v3-strategy-result">{formatNumber(option.totalPrepared)} unités</strong>
    </button>
  );
}

function PlanSummary({ input, selected }: { input: PackingInput; selected: PackingOption }) {
  const plan = summarizePackingLoads(input, selected);
  const partialText = plan.partialLoadCount
    ? `1 palette partielle (${plan.partialLoadCartons} carton${plan.partialLoadCartons > 1 ? 's' : ''}${plan.partialCartonUnits ? ` + ${formatNumber(plan.partialCartonUnits)} unités` : ''})`
    : 'Aucune palette partielle';

  return (
    <section className="packing-v3-plan" aria-label="Plan de conditionnement">
      <div className="packing-v3-plan-lead">
        <span className="packing-v3-kicker">Plan de conditionnement</span>
        <strong>{formatNumber(plan.fullLoadCount)} palette{plan.fullLoadCount > 1 ? 's' : ''} complète{plan.fullLoadCount > 1 ? 's' : ''} + {partialText}</strong>
        <small>{formatNumber(plan.totalLoads)} palette{plan.totalLoads > 1 ? 's' : ''} au total à envoyer</small>
      </div>
      <div className="packing-v3-plan-metrics">
        <div><span>Palettes</span><strong>{formatNumber(plan.totalLoads)} palettes</strong><small>{formatNumber(plan.fullLoadCount)} complètes + {plan.partialLoadCount} partielle</small></div>
        <div><span>Cartons</span><strong>{formatNumber(plan.totalCartons)} cartons</strong><small>Conditionnement physique</small></div>
        <div><span>Unités planifiées</span><strong>{formatNumber(selected.totalPrepared)} unités</strong><small>{selected.variance === 0 ? 'Aucun dépassement' : `+${formatNumber(selected.variance)} vs demande`}</small></div>
        <div className={selected.variance === 0 ? '' : 'packing-v3-variance'}><span>Écart</span><strong>{selected.variance === 0 ? '0 unité' : `+${formatNumber(selected.variance)} unités`}</strong></div>
      </div>
    </section>
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
  startTimeInvalid,
  cadenceInvalid,
  combinationInvalid,
  canLaunch,
  persistenceDegraded,
  onFieldChange,
  onSelectPolicy,
  onLaunch,
  onReset,
}: PackingPlanningRailProps) {
  return (
    <section aria-labelledby="packing-preparation-title" className="packing-v3-preparation packing-v3-stage">
      <header className="packing-v3-stage-header">
        <div>
          <h1 id="packing-preparation-title">Préparer l’ordre de conditionnement</h1>
          <p>Renseignez les paramètres, choisissez la stratégie puis lancez le suivi.</p>
        </div>
        <span className="packing-v3-status packing-v3-status-preparing"><span /> En préparation</span>
      </header>

      <div className="packing-v3-inputs">
        <NumericField icon={<Box size={18} />} label="Quantité demandée" value={form.quantity} invalid={quantityInvalid} suffix="unités" onChange={(value) => onFieldChange('quantity', value)} />
        <NumericField icon={<Boxes size={18} />} label="Unités par carton" value={form.unitsPerCarton} invalid={unitsPerCartonInvalid} onChange={(value) => onFieldChange('unitsPerCarton', value)} />
        <NumericField icon={<Layers3 size={18} />} label="Cartons par palette" value={form.cartonsPerPalette} invalid={cartonsPerPaletteInvalid} onChange={(value) => onFieldChange('cartonsPerPalette', value)} />
        <StartTimeField value={form.productionStartTime} legacyTime={form.legacyProductionStartTime} invalid={startTimeInvalid} onChange={(value) => onFieldChange('productionStartTime', value)} />
        <NumericField icon={<Gauge size={18} />} label="Cadence réf." value={form.referenceCadence} invalid={cadenceInvalid} suffix="u/min" onChange={(value) => onFieldChange('referenceCadence', value)} />
      </div>

      {combinationInvalid ? <p className="packing-v3-inline-error">La combinaison saisie dépasse le domaine de calcul exact.</p> : null}

      <div className="packing-v3-strategy-heading">
        <strong>Stratégie de conditionnement</strong>
        <span>Choisissez une seule logique de préparation.</span>
      </div>
      <div role="radiogroup" aria-label="Stratégie de conditionnement" className="packing-v3-strategies">
        {calculation
          ? calculation.options.map((option) => <StrategyCard key={option.policy} option={option} active={selectedPolicy === option.policy} onSelect={() => onSelectPolicy(option.policy)} />)
          : (Object.keys(policyCopy) as PackingPolicy[]).map((policy) => (
              <button key={policy} type="button" disabled className="packing-v3-strategy packing-v3-strategy-disabled">
                <span className="packing-v3-strategy-head"><span><strong>{policyCopy[policy].title}</strong><small>{policyCopy[policy].description}</small></span></span>
                <span className="packing-v3-strategy-result-label">Quantité résultante</span><strong className="packing-v3-strategy-result">—</strong>
              </button>
            ))}
      </div>

      {input && calculation?.selected ? <PlanSummary input={input} selected={calculation.selected} /> : null}

      <button type="button" className="packing-v3-launch" disabled={!canLaunch} onClick={onLaunch}>
        <Play size={18} aria-hidden="true" />
        Lancer le suivi de production
        <span aria-hidden="true">→</span>
      </button>
      <div className="packing-v3-preparation-reset-row">
        <button type="button" className="packing-v3-preparation-reset" onClick={onReset}>
          <RotateCcw size={14} aria-hidden="true" />
          Réinitialiser la préparation
        </button>
      </div>
      {persistenceDegraded ? <p className="packing-v3-persistence-warning">Le stockage local est indisponible : le run pourra ne pas survivre à un rechargement.</p> : null}
    </section>
  );
}

export function PackingConductWaiting() {
  return (
    <section aria-label="Conduite de production en attente" className="packing-v3-waiting packing-v3-stage">
      <div className="packing-v3-waiting-head"><div><strong>Conduite de production</strong><span>Le suivi s’active après le lancement.</span></div><span className="packing-v3-status"><span /> En attente</span></div>
      <div className="packing-v3-waiting-metrics"><span>Quantité restante <b>—</b></span><span>Progression <b>—</b></span><span>Temps restant <b>—</b></span><span>Écart vs référence <b>—</b></span></div>
    </section>
  );
}

export function PackingFrozenPreparation({ run, onModify }: { run: PackingRun; onModify: () => void }) {
  const option = calculatePackingOptions({ quantity: run.requestedUnits, unitsPerCarton: run.unitsPerCarton, cartonsPerPalette: run.cartonsPerLoad }).find((entry) => entry.policy === run.selectedPolicy);
  if (!option) return null;
  const plan = summarizePackingLoads({ quantity: run.requestedUnits, unitsPerCarton: run.unitsPerCarton, cartonsPerPalette: run.cartonsPerLoad }, option);
  const start = new Date(getPackingRunProductionStartedAt(run)).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  const policy = policyCopy[run.selectedPolicy].title;

  return (
    <section aria-label="Préparation figée" className="packing-v3-frozen">
      <div className="packing-v3-frozen-title"><PackageCheck size={16} aria-hidden="true" /><div><strong>Préparation figée</strong><small>Référence du run actif</small></div></div>
      <div className="packing-v3-frozen-values">
        <span>{formatNumber(run.requestedUnits)} demandées</span><i>·</i><span>{formatNumber(run.unitsPerCarton)} u/carton</span><i>·</i><span>{formatNumber(run.cartonsPerLoad)} cartons/palette</span><i>·</i><span>{start}</span><i>·</i><span>{formatNumber(run.referenceCadenceUnitsPerMinute)} u/min</span><i>·</i><span>{policy}</span>
      </div>
      <div className="packing-v3-frozen-plan"><strong>Plan :</strong> {formatNumber(plan.fullLoadCount)} pal. compl. + {plan.partialLoadCount ? `1 partielle (${formatNumber(plan.partialLoadCartons)} cart.)` : 'aucune partielle'} · {formatNumber(plan.totalLoads)} palettes · {formatNumber(plan.totalCartons)} cartons · {formatNumber(run.plannedUnits)} unités · {run.varianceUnits === 0 ? 'écart 0' : `+${formatNumber(run.varianceUnits)} vs dem.`}</div>
      <button type="button" onClick={onModify}>Modifier la préparation</button>
    </section>
  );
}
