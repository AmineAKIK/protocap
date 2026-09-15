import {
  Box,
  Boxes,
  CalendarDays,
  Check,
  Gauge,
  Layers3,
  PackageCheck,
  Play,
  RotateCcw,
} from 'lucide-react';
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import {
  calculatePackingOptions,
  summarizePackingLoads,
  type PackingInput,
  type PackingOption,
  type PackingPolicy,
} from '../../../utils/packing';
import type { PackingPreparationField } from '../preparation/packingPreparationValidation';
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
  fieldErrors: Partial<Record<PackingPreparationField, string>>;
  combinationInvalid: boolean;
  canLaunch: boolean;
  launchGuidance: string | null;
  isLaunching: boolean;
  hasPreparationData: boolean;
  persistenceDegraded: boolean;
  onFieldChange: (field: keyof PackingPlanningFormState, value: string) => void;
  onFieldBlur: (field: PackingPreparationField) => void;
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

function formatPartialLoadDetail(partialLoadCartons: number, partialCartonUnits: number): string {
  const completeCartons = partialLoadCartons > 0
    ? `${partialLoadCartons} carton${partialLoadCartons > 1 ? 's' : ''} complet${partialLoadCartons > 1 ? 's' : ''}`
    : '';
  const incompleteCarton = partialCartonUnits > 0
    ? `1 carton incomplet de ${formatNumber(partialCartonUnits)} unité${partialCartonUnits > 1 ? 's' : ''}`
    : '';
  return [completeCartons, incompleteCarton].filter(Boolean).join(' + ');
}

function NumericField({
  field,
  icon,
  label,
  value,
  error,
  suffix,
  onChange,
  onBlur,
}: {
  field: PackingPreparationField;
  icon: ReactNode;
  label: string;
  value: string;
  error?: string;
  suffix?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const inputId = `packing-${field}`;
  const errorId = `${inputId}-error`;
  return (
    <div className="packing-v3-field min-w-0">
      <label className="packing-v3-field-label" htmlFor={inputId}>{label}<span className="packing-v3-required" aria-hidden="true"> *</span></label>
      <span className={`packing-v3-field-control ${error ? 'packing-v3-field-invalid' : ''}`}>
        <span aria-hidden="true">{icon}</span>
        <input
          id={inputId}
          aria-label={label}
          inputMode="numeric"
          value={value}
          required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
        />
        {suffix ? <span className="packing-v3-field-suffix">{suffix}</span> : null}
      </span>
      {error ? <small id={errorId} className="packing-v3-field-error">{error}</small> : null}
    </div>
  );
}

function StartTimeField({
  value,
  legacyTime,
  error,
  onChange,
  onBlur,
}: {
  value: string;
  legacyTime?: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = 'packing-production-start-error';
  const legacyId = 'packing-production-start-legacy';
  const describedBy = [error ? errorId : null, legacyTime ? legacyId : null].filter(Boolean).join(' ') || undefined;

  function openPicker() {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    if (typeof input.showPicker === 'function') input.showPicker();
    else input.click();
  }

  return (
    <div className="packing-v3-field min-w-0">
      <label className="packing-v3-field-label" htmlFor="packing-production-start">Début OC<span className="packing-v3-required" aria-hidden="true"> *</span></label>
      <div className={`packing-v3-field-control packing-v3-datetime-control ${error ? 'packing-v3-field-invalid' : ''}`}>
        <button type="button" className="packing-v3-datetime-trigger" aria-label="Choisir la date et l’heure de début OC" onClick={openPicker}>
          <CalendarDays size={17} aria-hidden="true" />
        </button>
        <input
          ref={inputRef}
          id="packing-production-start"
          className="packing-v3-datetime-input"
          aria-label="Début OC"
          type="datetime-local"
          value={value}
          required
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
        />
      </div>
      {error ? <small id={errorId} className="packing-v3-field-error">{error}</small> : null}
      {legacyTime ? <small id={legacyId} className="packing-v3-legacy-time">Heure enregistrée précédemment : {legacyTime}. Choisissez la date correspondante.</small> : null}
    </div>
  );
}

function StrategyCard({
  option,
  active,
  tabIndex,
  onSelect,
}: {
  option: PackingOption;
  active: boolean;
  tabIndex: number;
  onSelect: () => void;
}) {
  const copy = policyCopy[option.policy];
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      data-packing-policy={option.policy}
      tabIndex={tabIndex}
      className={`packing-v3-strategy ${active ? 'packing-v3-strategy-active' : ''}`}
      onClick={onSelect}
    >
      <span className="packing-v3-strategy-head">
        <span><strong>{copy.title}</strong><small>{copy.description}</small></span>
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
    ? `1 palette partielle (${formatPartialLoadDetail(plan.partialLoadCartons, plan.partialCartonUnits)})`
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
  fieldErrors,
  combinationInvalid,
  canLaunch,
  launchGuidance,
  isLaunching,
  hasPreparationData,
  persistenceDegraded,
  onFieldChange,
  onFieldBlur,
  onSelectPolicy,
  onLaunch,
  onReset,
}: PackingPlanningRailProps) {
  function handleStrategyKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) return;
    const radios = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)'));
    const current = document.activeElement as HTMLButtonElement | null;
    const currentIndex = current ? radios.indexOf(current) : -1;
    if (currentIndex < 0 || radios.length === 0) return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
    const next = radios[(currentIndex + direction + radios.length) % radios.length];
    next.focus();
    next.click();
  }

  return (
    <section aria-labelledby="packing-preparation-title" className="packing-v3-preparation packing-v3-stage">
      <header className="packing-v3-stage-header">
        <div>
          <h1 id="packing-preparation-title">Préparer l’ordre de conditionnement</h1>
          <p>Renseignez les paramètres, choisissez la stratégie puis lancez le suivi. Tous les champs sont obligatoires.</p>
        </div>
        <span className="packing-v3-status packing-v3-status-preparing"><span /> En préparation</span>
      </header>

      <div className="packing-v3-inputs">
        <NumericField field="quantity" icon={<Box size={18} />} label="Quantité demandée" value={form.quantity} error={fieldErrors.quantity} suffix="unités" onChange={(value) => onFieldChange('quantity', value)} onBlur={() => onFieldBlur('quantity')} />
        <NumericField field="unitsPerCarton" icon={<Boxes size={18} />} label="Unités par carton" value={form.unitsPerCarton} error={fieldErrors.unitsPerCarton} onChange={(value) => onFieldChange('unitsPerCarton', value)} onBlur={() => onFieldBlur('unitsPerCarton')} />
        <NumericField field="cartonsPerPalette" icon={<Layers3 size={18} />} label="Cartons par palette" value={form.cartonsPerPalette} error={fieldErrors.cartonsPerPalette} onChange={(value) => onFieldChange('cartonsPerPalette', value)} onBlur={() => onFieldBlur('cartonsPerPalette')} />
        <StartTimeField value={form.productionStartTime} legacyTime={form.legacyProductionStartTime} error={fieldErrors.productionStartTime} onChange={(value) => onFieldChange('productionStartTime', value)} onBlur={() => onFieldBlur('productionStartTime')} />
        <NumericField field="referenceCadence" icon={<Gauge size={18} />} label="Cadence réf." value={form.referenceCadence} error={fieldErrors.referenceCadence} suffix="u/min" onChange={(value) => onFieldChange('referenceCadence', value)} onBlur={() => onFieldBlur('referenceCadence')} />
      </div>

      {combinationInvalid ? <p role="alert" className="packing-v3-inline-error">Ces valeurs sont trop élevées pour calculer un plan de manière fiable. Vérifiez les paramètres saisis.</p> : null}

      <div className="packing-v3-strategy-heading">
        <strong>Stratégie de conditionnement</strong>
        <span>Choisissez une seule logique de préparation.</span>
      </div>
      <div role="radiogroup" aria-label="Stratégie de conditionnement" className="packing-v3-strategies" onKeyDown={handleStrategyKeyDown}>
        {calculation
          ? calculation.options.map((option, index) => (
              <StrategyCard
                key={option.policy}
                option={option}
                active={selectedPolicy === option.policy}
                tabIndex={selectedPolicy ? (selectedPolicy === option.policy ? 0 : -1) : (index === 0 ? 0 : -1)}
                onSelect={() => onSelectPolicy(option.policy)}
              />
            ))
          : (Object.keys(policyCopy) as PackingPolicy[]).map((policy) => (
              <button
                key={policy}
                type="button"
                role="radio"
                aria-checked={false}
                tabIndex={-1}
                disabled
                className="packing-v3-strategy packing-v3-strategy-disabled"
              >
                <span className="packing-v3-strategy-head"><span><strong>{policyCopy[policy].title}</strong><small>{policyCopy[policy].description}</small></span></span>
                <span className="packing-v3-strategy-result-label">Quantité résultante</span><strong className="packing-v3-strategy-result">—</strong>
              </button>
            ))}
      </div>

      {input && calculation?.selected ? <PlanSummary input={input} selected={calculation.selected} /> : null}

      <button type="button" className="packing-v3-launch" disabled={!canLaunch || isLaunching} onClick={onLaunch}>
        <Play size={18} aria-hidden="true" />
        {isLaunching ? 'Lancement…' : 'Lancer le suivi de production'}
      </button>
      {!canLaunch && launchGuidance ? <p className="packing-v3-launch-guidance" aria-live="polite">{launchGuidance}</p> : null}
      <div className="packing-v3-preparation-reset-row">
        <button type="button" className="packing-v3-preparation-reset" disabled={!hasPreparationData || isLaunching} onClick={onReset}>
          <RotateCcw size={14} aria-hidden="true" />
          Réinitialiser la préparation
        </button>
      </div>
      {persistenceDegraded ? <p role="status" className="packing-v3-persistence-warning">La sauvegarde locale n’est pas garantie. Un rechargement peut faire perdre cette préparation ou le suivi en cours.</p> : null}
    </section>
  );
}

export function PackingConductWaiting() {
  return (
    <section aria-label="Conduite de production en attente" className="packing-v3-waiting packing-v3-stage">
      <div className="packing-v3-waiting-head">
        <div><strong>Conduite de production</strong><span>La progression, le temps restant et les déclarations apparaîtront après le lancement.</span></div>
        <span className="packing-v3-status"><span /> En attente</span>
      </div>
    </section>
  );
}

export function PackingFrozenPreparation({
  run,
  onModify,
  draftRecovered = false,
}: {
  run: PackingRun;
  onModify: () => void;
  draftRecovered?: boolean;
}) {
  const option = calculatePackingOptions({ quantity: run.requestedUnits, unitsPerCarton: run.unitsPerCarton, cartonsPerPalette: run.cartonsPerLoad }).find((entry) => entry.policy === run.selectedPolicy);
  if (!option) return null;
  const plan = summarizePackingLoads({ quantity: run.requestedUnits, unitsPerCarton: run.unitsPerCarton, cartonsPerPalette: run.cartonsPerLoad }, option);
  const start = new Date(getPackingRunProductionStartedAt(run)).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  const policy = policyCopy[run.selectedPolicy].title;
  const partialPlan = plan.partialLoadCount
    ? `1 partielle (${formatPartialLoadDetail(plan.partialLoadCartons, plan.partialCartonUnits)})`
    : 'aucune partielle';
  return (
    <section aria-label="Préparation figée" className="packing-v3-frozen">
      <div className="packing-v3-frozen-title"><PackageCheck size={16} aria-hidden="true" /><div><strong>Préparation figée</strong><small>Référence du run actif</small></div></div>
      <div className="packing-v3-frozen-values"><span>{formatNumber(run.requestedUnits)} demandées</span><i>·</i><span>{formatNumber(run.unitsPerCarton)} u/carton</span><i>·</i><span>{formatNumber(run.cartonsPerLoad)} cartons/palette</span><i>·</i><span>{start}</span><i>·</i><span>{formatNumber(run.referenceCadenceUnitsPerMinute)} u/min</span><i>·</i><span>{policy}</span></div>
      <div className="packing-v3-frozen-plan"><strong>Plan :</strong> {formatNumber(plan.fullLoadCount)} pal. compl. + {partialPlan} · {formatNumber(plan.totalLoads)} palettes · {formatNumber(plan.totalCartons)} cartons · {formatNumber(run.plannedUnits)} unités · {run.varianceUnits === 0 ? 'écart 0' : `+${formatNumber(run.varianceUnits)} vs dem.`}</div>
      {draftRecovered ? <p role="status" className="packing-v3-persistence-warning">Une préparation locale invalide a été ignorée et remplacée par un brouillon sûr. Vérifiez les paramètres avant de les réutiliser.</p> : null}
      <button type="button" onClick={onModify}>Modifier la préparation</button>
    </section>
  );
}
