import { useMemo, useState } from 'react';
import {
  PackingConductWaiting,
  PackingFrozenPreparation,
  PackingPlanningRail,
  type PackingPlanningFormState,
} from '../features/packing/components/PackingPlanningRail';
import { PackingRunExecution } from '../features/packing/components/PackingRunExecution';
import { usePackingActiveRun } from '../features/packing/usePackingActiveRun';
import { useLocalStorage } from '../hooks/useLocalStorage';
import {
  calculatePackingOptions,
  isValidPackingInput,
  parsePositiveIntegerInput,
  type PackingInput,
  type PackingPolicy,
} from '../utils/packing';

const defaultForm: PackingPlanningFormState = {
  quantity: '',
  unitsPerCarton: '',
  cartonsPerPalette: '',
  productionStartTime: '',
  referenceCadence: '',
};

function normalizePackingPlanningForm(form: PackingPlanningFormState): PackingPlanningFormState {
  const legacy = form as Partial<PackingPlanningFormState>;
  return {
    quantity: typeof legacy.quantity === 'string' ? legacy.quantity : '',
    unitsPerCarton: typeof legacy.unitsPerCarton === 'string' ? legacy.unitsPerCarton : '',
    cartonsPerPalette: typeof legacy.cartonsPerPalette === 'string' ? legacy.cartonsPerPalette : '',
    productionStartTime: typeof legacy.productionStartTime === 'string' ? legacy.productionStartTime : '',
    referenceCadence: typeof legacy.referenceCadence === 'string' ? legacy.referenceCadence : '',
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

function isValidTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function resolveProductionStartedAt(time: string, now = new Date()): string {
  if (!isValidTime(time)) throw new RangeError('Production start time must use HH:mm.');
  const [hours, minutes] = time.split(':').map(Number);
  const candidate = new Date(now);
  candidate.setHours(hours, minutes, 0, 0);
  if (candidate.getTime() - now.getTime() > 6 * 60 * 60 * 1000) {
    candidate.setDate(candidate.getDate() - 1);
  }
  return candidate.toISOString();
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> };
};

function transitionState(callback: () => void) {
  const transitionDocument = document as ViewTransitionDocument;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !transitionDocument.startViewTransition) {
    callback();
    return;
  }
  transitionDocument.startViewTransition(callback);
}

export function PackingCalculatorPage() {
  const [form, setForm] = useLocalStorage<PackingPlanningFormState>(
    'lineops.packing.form.inputs',
    defaultForm,
    normalizePackingPlanningForm,
  );
  const [selectedPolicy, setSelectedPolicy] = useState<PackingPolicy | null>(null);
  const { activeRun, persistenceStatus, startRun, updateRun, clearRun } = usePackingActiveRun();
  const input = useMemo(() => parsePackingInput(form), [form]);

  const calculation = useMemo(() => {
    if (!input) return null;
    const options = calculatePackingOptions(input);
    const selected = selectedPolicy ? options.find((option) => option.policy === selectedPolicy) ?? null : null;
    return { options, selected };
  }, [input, selectedPolicy]);

  function updateField(field: keyof PackingPlanningFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function numericState(value: string) {
    if (value.trim() === '') return 'empty';
    return parsePositiveIntegerInput(value) === null ? 'invalid' : 'valid';
  }

  const quantityState = numericState(form.quantity);
  const unitsPerCartonState = numericState(form.unitsPerCarton);
  const cartonsPerPaletteState = numericState(form.cartonsPerPalette);
  const cadenceState = numericState(form.referenceCadence);
  const startTimeValid = isValidTime(form.productionStartTime);
  const combinationInvalid =
    quantityState === 'valid' &&
    unitsPerCartonState === 'valid' &&
    cartonsPerPaletteState === 'valid' &&
    !input;
  const canLaunch = Boolean(input && calculation?.selected && selectedPolicy && startTimeValid && cadenceState === 'valid');

  function launchRun() {
    if (!input || !calculation?.selected || !selectedPolicy || !startTimeValid) return;
    const cadence = parsePositiveIntegerInput(form.referenceCadence);
    if (cadence === null) return;
    const productionStartedAt = resolveProductionStartedAt(form.productionStartTime);
    transitionState(() => {
      startRun({
        requestedUnits: input.quantity,
        unitsPerCarton: input.unitsPerCarton,
        cartonsPerLoad: input.cartonsPerPalette,
        selectedPolicy,
        plannedUnits: calculation.selected!.totalPrepared,
        referenceCadenceUnitsPerMinute: cadence,
        productionStartedAt,
      });
    });
  }

  function modifyPreparation() {
    if (!activeRun) return;
    if (activeRun.declarations.length > 0) {
      const confirmed = window.confirm('Modifier la préparation supprimera les déclarations de ce run. Continuer ?');
      if (!confirmed) return;
    }
    const started = new Date(activeRun.productionStartedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    transitionState(() => {
      setForm({
        quantity: String(activeRun.requestedUnits),
        unitsPerCarton: String(activeRun.unitsPerCarton),
        cartonsPerPalette: String(activeRun.cartonsPerLoad),
        productionStartTime: started,
        referenceCadence: String(activeRun.referenceCadenceUnitsPerMinute),
      });
      setSelectedPolicy(activeRun.selectedPolicy);
      clearRun();
    });
  }

  return (
    <main className={`packing-calculator-page packing-v3-page ${activeRun ? 'packing-v3-is-running' : 'packing-v3-is-preparing'}`}>
      <div className="packing-v3-frame">
        {activeRun ? (
          <>
            <PackingRunExecution run={activeRun} persistenceStatus={persistenceStatus} onRunChange={updateRun} />
            <PackingFrozenPreparation run={activeRun} onModify={modifyPreparation} />
          </>
        ) : (
          <>
            <PackingPlanningRail
              form={form}
              input={input}
              calculation={calculation}
              selectedPolicy={selectedPolicy}
              quantityInvalid={quantityState === 'invalid'}
              unitsPerCartonInvalid={unitsPerCartonState === 'invalid'}
              cartonsPerPaletteInvalid={cartonsPerPaletteState === 'invalid'}
              startTimeInvalid={form.productionStartTime !== '' && !startTimeValid}
              cadenceInvalid={cadenceState === 'invalid'}
              combinationInvalid={combinationInvalid}
              canLaunch={canLaunch}
              persistenceDegraded={persistenceStatus === 'degraded'}
              onFieldChange={updateField}
              onSelectPolicy={setSelectedPolicy}
              onLaunch={launchRun}
            />
            <PackingConductWaiting />
          </>
        )}
      </div>
    </main>
  );
}
