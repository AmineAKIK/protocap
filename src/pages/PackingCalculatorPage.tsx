import { useMemo, useRef, useState } from 'react';
import { AccessibleDialog } from '../components/AccessibleDialog';
import {
  PackingConductWaiting,
  PackingFrozenPreparation,
  PackingPlanningRail,
  type PackingPlanningFormState,
} from '../features/packing/components/PackingPlanningRail';
import { PackingRunExecution } from '../features/packing/components/PackingRunExecution';
import { getPackingRunProductionStartedAt } from '../features/packing/domain/packingRun';
import {
  parsePackingProductionStart,
  validatePackingPreparation,
  type PackingPreparationField,
} from '../features/packing/preparation/packingPreparationValidation';
import { usePackingActiveRun } from '../features/packing/usePackingActiveRun';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { calculatePackingOptions, parsePositiveIntegerInput, type PackingPolicy } from '../utils/packing';

const defaultForm: PackingPlanningFormState = {
  quantity: '',
  unitsPerCarton: '',
  cartonsPerPalette: '',
  productionStartTime: '',
  referenceCadence: '',
};

function normalizePackingPlanningForm(form: PackingPlanningFormState): PackingPlanningFormState {
  const legacy = form as Partial<PackingPlanningFormState>;
  const storedStart = typeof legacy.productionStartTime === 'string' ? legacy.productionStartTime : '';
  const legacyTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(storedStart) ? storedStart : undefined;
  return {
    quantity: typeof legacy.quantity === 'string' ? legacy.quantity : '',
    unitsPerCarton: typeof legacy.unitsPerCarton === 'string' ? legacy.unitsPerCarton : '',
    cartonsPerPalette: typeof legacy.cartonsPerPalette === 'string' ? legacy.cartonsPerPalette : '',
    productionStartTime: legacyTime ? '' : storedStart,
    legacyProductionStartTime: legacyTime ?? (typeof legacy.legacyProductionStartTime === 'string' ? legacy.legacyProductionStartTime : undefined),
    referenceCadence: typeof legacy.referenceCadence === 'string' ? legacy.referenceCadence : '',
  };
}

function resolveProductionStartedAt(value: string): string {
  const parsed = parsePackingProductionStart(value);
  if (!parsed) throw new RangeError('Production start must include a valid date and time.');
  return parsed.toISOString();
}

function toLocalDateTimeInputValue(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function focusAfterRender(selector: string) {
  window.requestAnimationFrame(() => document.querySelector<HTMLElement>(selector)?.focus());
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> };
};

function transitionState(callback: () => void) {
  const transitionDocument = document as ViewTransitionDocument;
  const prefersReducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion || !transitionDocument.startViewTransition) {
    callback();
    return;
  }
  transitionDocument.startViewTransition(callback);
}

function ConfirmDialog({
  title,
  description,
  cancelLabel = 'Annuler',
  confirmLabel,
  tone = 'danger',
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  cancelLabel?: string;
  confirmLabel: string;
  tone?: 'danger' | 'warning';
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(true);

  function handleConfirm() {
    restoreFocusRef.current = false;
    onConfirm();
  }

  return (
    <AccessibleDialog
      title={title}
      description={description}
      onClose={onCancel}
      hideCloseButton
      initialFocusRef={cancelRef}
      restoreFocusRef={restoreFocusRef}
      className="max-w-sm"
      contentClassName="p-6"
    >
      <div className="flex gap-3">
        <button ref={cancelRef} type="button" onClick={onCancel} className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-700/20">
          {cancelLabel}
        </button>
        <button type="button" onClick={handleConfirm} className={`flex-1 rounded-xl py-3 text-sm font-bold text-white transition focus-visible:outline-none focus-visible:ring-4 ${tone === 'danger' ? 'bg-red-700 hover:bg-red-600 focus-visible:ring-red-700/20' : 'bg-amber-700 hover:bg-amber-600 focus-visible:ring-amber-700/20'}`}>
          {confirmLabel}
        </button>
      </div>
    </AccessibleDialog>
  );
}

export function PackingCalculatorPage() {
  const [form, setForm, formPersistenceStatus] = useLocalStorage<PackingPlanningFormState>(
    'lineops.packing.form.inputs',
    defaultForm,
    normalizePackingPlanningForm,
  );
  const [selectedPolicy, setSelectedPolicy] = useState<PackingPolicy | null>(null);
  const [touchedFields, setTouchedFields] = useState<Partial<Record<PackingPreparationField, boolean>>>({});
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDegradedLaunchConfirm, setShowDegradedLaunchConfirm] = useState(false);
  const [showModifyConfirm, setShowModifyConfirm] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const { activeRun, persistenceStatus, probePersistence, startRun, updateRun, clearRun } = usePackingActiveRun();

  const validation = useMemo(() => validatePackingPreparation(form, selectedPolicy), [form, selectedPolicy]);
  const input = validation.input;
  const calculation = useMemo(() => {
    if (!input) return null;
    const options = calculatePackingOptions(input);
    const selected = selectedPolicy ? options.find((option) => option.policy === selectedPolicy) ?? null : null;
    return { options, selected };
  }, [input, selectedPolicy]);

  const fieldErrors = useMemo(() => {
    const errors: Partial<Record<PackingPreparationField, string>> = {};
    (Object.keys(validation.fields) as PackingPreparationField[]).forEach((field) => {
      const message = validation.fields[field].message;
      if (touchedFields[field] && message) errors[field] = message;
    });
    return errors;
  }, [touchedFields, validation.fields]);

  const hasPreparationData = Boolean(
    form.quantity.trim() ||
    form.unitsPerCarton.trim() ||
    form.cartonsPerPalette.trim() ||
    form.productionStartTime.trim() ||
    form.legacyProductionStartTime ||
    form.referenceCadence.trim() ||
    selectedPolicy,
  );
  const persistenceDegraded = formPersistenceStatus === 'degraded' || persistenceStatus === 'degraded';

  function updateField(field: keyof PackingPlanningFormState, value: string) {
    setLaunchError(null);
    setForm((current) =>
      field === 'productionStartTime'
        ? { ...current, productionStartTime: value, legacyProductionStartTime: undefined }
        : { ...current, [field]: value },
    );
  }

  function markFieldTouched(field: PackingPreparationField) {
    setTouchedFields((current) => ({ ...current, [field]: true }));
  }

  function confirmResetPreparation() {
    setShowResetConfirm(false);
    transitionState(() => {
      setForm(defaultForm);
      setSelectedPolicy(null);
      setTouchedFields({});
      setLaunchError(null);
      focusAfterRender('#packing-quantity');
    });
  }

  function performLaunch() {
    if (isLaunching || !validation.canLaunch || !input || !calculation?.selected || !selectedPolicy) return;
    const cadence = parsePositiveIntegerInput(form.referenceCadence);
    if (cadence === null) return;
    const productionStartedAt = resolveProductionStartedAt(form.productionStartTime);
    setIsLaunching(true);
    setLaunchError(null);
    transitionState(() => {
      try {
        startRun({
          requestedUnits: input.quantity,
          unitsPerCarton: input.unitsPerCarton,
          cartonsPerLoad: input.cartonsPerPalette,
          selectedPolicy,
          plannedUnits: calculation.selected!.totalPrepared,
          referenceCadenceUnitsPerMinute: cadence,
          productionStartedAt,
        });
        setIsLaunching(false);
        focusAfterRender('#packing-production-title');
      } catch {
        setIsLaunching(false);
        setLaunchError('Le suivi n’a pas pu démarrer. Réessayez ou vérifiez la disponibilité du navigateur.');
      }
    });
  }

  function requestLaunch() {
    if (!validation.canLaunch || isLaunching) return;
    if (persistenceDegraded || probePersistence() === 'degraded') {
      setShowDegradedLaunchConfirm(true);
      return;
    }
    performLaunch();
  }

  function continueWithoutPersistence() {
    setShowDegradedLaunchConfirm(false);
    performLaunch();
  }

  function performModifyPreparation() {
    if (!activeRun) return;
    const started = toLocalDateTimeInputValue(getPackingRunProductionStartedAt(activeRun));
    setShowModifyConfirm(false);
    transitionState(() => {
      setForm({
        quantity: String(activeRun.requestedUnits),
        unitsPerCarton: String(activeRun.unitsPerCarton),
        cartonsPerPalette: String(activeRun.cartonsPerLoad),
        productionStartTime: started,
        referenceCadence: String(activeRun.referenceCadenceUnitsPerMinute),
      });
      setSelectedPolicy(activeRun.selectedPolicy);
      setTouchedFields({});
      clearRun();
      focusAfterRender('#packing-quantity');
    });
  }

  function requestModifyPreparation() {
    if (!activeRun) return;
    if (activeRun.declarations.length > 0) {
      setShowModifyConfirm(true);
      return;
    }
    performModifyPreparation();
  }

  return (
    <main className={`packing-calculator-page packing-v3-page ${activeRun ? 'packing-v3-is-running' : 'packing-v3-is-preparing'}`}>
      {showResetConfirm ? (
        <ConfirmDialog
          title="Réinitialiser la préparation ?"
          description="Les paramètres saisis et la stratégie sélectionnée seront effacés."
          confirmLabel="Réinitialiser"
          onCancel={() => setShowResetConfirm(false)}
          onConfirm={confirmResetPreparation}
        />
      ) : null}
      {showDegradedLaunchConfirm ? (
        <ConfirmDialog
          title="Sauvegarde locale indisponible"
          description="La sauvegarde du suivi n’est pas garantie. Un rechargement de la page peut faire perdre la progression."
          confirmLabel="Continuer sans sauvegarde"
          tone="warning"
          onCancel={() => setShowDegradedLaunchConfirm(false)}
          onConfirm={continueWithoutPersistence}
        />
      ) : null}
      {showModifyConfirm ? (
        <ConfirmDialog
          title="Modifier la préparation ?"
          description="Les déclarations déjà enregistrées pour ce run seront supprimées."
          confirmLabel="Modifier et supprimer"
          onCancel={() => setShowModifyConfirm(false)}
          onConfirm={performModifyPreparation}
        />
      ) : null}

      <div className="packing-v3-frame">
        {activeRun ? (
          <>
            <PackingRunExecution run={activeRun} persistenceStatus={persistenceStatus} onRunChange={updateRun} />
            <PackingFrozenPreparation run={activeRun} onModify={requestModifyPreparation} />
          </>
        ) : (
          <>
            <PackingPlanningRail
              form={form}
              input={input}
              calculation={calculation}
              selectedPolicy={selectedPolicy}
              fieldErrors={fieldErrors}
              combinationInvalid={validation.combinationInvalid}
              canLaunch={validation.canLaunch}
              launchGuidance={validation.launchGuidance}
              isLaunching={isLaunching}
              hasPreparationData={hasPreparationData}
              persistenceDegraded={persistenceDegraded}
              onFieldChange={updateField}
              onFieldBlur={markFieldTouched}
              onSelectPolicy={(policy) => {
                setLaunchError(null);
                setSelectedPolicy(policy);
              }}
              onLaunch={requestLaunch}
              onReset={() => setShowResetConfirm(true)}
            />
            {launchError ? <p role="alert" className="packing-v3-frame-error">{launchError}</p> : null}
            <PackingConductWaiting />
          </>
        )}
      </div>
    </main>
  );
}
