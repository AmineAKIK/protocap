import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const preparationFieldSelectors: Record<PackingPreparationField, string> = {
  quantity: '#packing-quantity',
  unitsPerCarton: '#packing-unitsPerCarton',
  cartonsPerPalette: '#packing-cartonsPerPalette',
  productionStartTime: '#packing-production-start',
  referenceCadence: '#packing-referenceCadence',
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
  if (!parsed) throw new RangeError('Production start must include a valid, unambiguous date and time.');
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
  const shouldRestoreFocus = useCallback(() => restoreFocusRef.current, []);

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
      shouldRestoreFocus={shouldRestoreFocus}
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
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDegradedLaunchConfirm, setShowDegradedLaunchConfirm] = useState(false);
  const [showModifyConfirm, setShowModifyConfirm] = useState(false);
  const [showDegradedModifyConfirm, setShowDegradedModifyConfirm] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [validationNow, setValidationNow] = useState(() => new Date());
  const {
    activeRun,
    draft: activeRunDraft,
    conflictDetected,
    externalSyncVersion,
    persistenceStatus,
    probePersistence,
    tryStartRun,
    startRun,
    updateRun,
    updateDraft,
    tryClearRun,
    clearRun,
  } = usePackingActiveRun();

  useEffect(() => {
    if (activeRun) return;
    const timer = window.setInterval(() => setValidationNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, [activeRun]);

  useEffect(() => {
    const scrollLockClass = 'packing-active-run-scroll-lock';
    document.documentElement.classList.toggle(scrollLockClass, Boolean(activeRun));
    document.body.classList.toggle(scrollLockClass, Boolean(activeRun));
    return () => {
      document.documentElement.classList.remove(scrollLockClass);
      document.body.classList.remove(scrollLockClass);
    };
  }, [activeRun]);

  const validation = useMemo(
    () => validatePackingPreparation(form, selectedPolicy, validationNow),
    [form, selectedPolicy, validationNow],
  );
  const input = validation.input;
  const calculation = useMemo(() => {
    if (!input) return null;
    const options = calculatePackingOptions(input);
    const selected = selectedPolicy ? options.find((option) => option.policy === selectedPolicy) ?? null : null;
    return { options, selected };
  }, [input, selectedPolicy]);

  const fieldErrors = useMemo(() => {
    const errors: Partial<Record<PackingPreparationField, string>> = {};
    if (!validationAttempted) return errors;
    (Object.keys(validation.fields) as PackingPreparationField[]).forEach((field) => {
      const message = validation.fields[field].message;
      if (message) errors[field] = message;
    });
    return errors;
  }, [validationAttempted, validation.fields]);

  const hasPreparationData = Boolean(
    form.quantity.trim() ||
    form.unitsPerCarton.trim() ||
    form.cartonsPerPalette.trim() ||
    form.productionStartTime.trim() ||
    form.legacyProductionStartTime ||
    form.referenceCadence.trim() ||
    selectedPolicy,
  );
  const persistenceDegraded = formPersistenceStatus === 'degraded' || formPersistenceStatus === 'readonly' || persistenceStatus === 'degraded';
  const draftRecovered = formPersistenceStatus === 'recovered';

  function updateField(field: keyof PackingPlanningFormState, value: string) {
    setLaunchError(null);
    setValidationNow(new Date());
    setForm((current) =>
      field === 'productionStartTime'
        ? { ...current, productionStartTime: value, legacyProductionStartTime: undefined }
        : { ...current, [field]: value },
    );
  }

  function refreshValidationClock() {
    setValidationNow(new Date());
  }

  function confirmResetPreparation() {
    setShowResetConfirm(false);
    transitionState(() => {
      setForm(defaultForm);
      setSelectedPolicy(null);
      setValidationAttempted(false);
      setLaunchError(null);
      setValidationNow(new Date());
      focusAfterRender('#packing-quantity');
    });
  }

  function getLaunchInput() {
    if (!input || !calculation?.selected || !selectedPolicy) return null;
    const cadence = parsePositiveIntegerInput(form.referenceCadence);
    if (cadence === null) return null;
    return {
      requestedUnits: input.quantity,
      unitsPerCarton: input.unitsPerCarton,
      cartonsPerLoad: input.cartonsPerPalette,
      selectedPolicy,
      plannedUnits: calculation.selected.totalPrepared,
      referenceCadenceUnitsPerMinute: cadence,
      productionStartedAt: resolveProductionStartedAt(form.productionStartTime),
    };
  }

  async function performLaunch(allowDegraded: boolean) {
    const freshValidation = validatePackingPreparation(form, selectedPolicy, new Date());
    if (isLaunching || !freshValidation.canLaunch) {
      setValidationNow(new Date());
      return;
    }
    const launchInput = getLaunchInput();
    if (!launchInput) return;

    setIsLaunching(true);
    setLaunchError(null);
    try {
        if (allowDegraded) {
          await startRun(launchInput);
        } else {
          const attempt = await tryStartRun(launchInput);
          if (attempt.status === 'degraded') {
            setIsLaunching(false);
            setShowDegradedLaunchConfirm(true);
            return;
          }
        }
        setIsLaunching(false);
        focusAfterRender('#packing-production-title');
      } catch {
        setIsLaunching(false);
        setLaunchError('Le suivi n’a pas pu démarrer. Réessayez ou vérifiez la disponibilité du navigateur.');
      }
  }

  function requestLaunch() {
    if (isLaunching) return;
    const freshNow = new Date();
    setValidationNow(freshNow);
    setValidationAttempted(true);
    const freshValidation = validatePackingPreparation(form, selectedPolicy, freshNow);
    if (!freshValidation.canLaunch) {
      const firstInvalidField = (Object.keys(freshValidation.fields) as PackingPreparationField[])
        .find((field) => freshValidation.fields[field].state !== 'valid');
      if (firstInvalidField) {
        focusAfterRender(preparationFieldSelectors[firstInvalidField]);
      } else if (!freshValidation.input || freshValidation.combinationInvalid) {
        focusAfterRender('#packing-quantity');
      } else if (!selectedPolicy) {
        focusAfterRender('[role="radiogroup"] [role="radio"]:not(:disabled)');
      }
      return;
    }
    if (persistenceDegraded || probePersistence() === 'degraded') {
      setShowDegradedLaunchConfirm(true);
      return;
    }
    void performLaunch(false);
  }

  function continueWithoutPersistence() {
    setShowDegradedLaunchConfirm(false);
    void performLaunch(true);
  }

  function getRestoredPreparation(): PackingPlanningFormState | null {
    if (!activeRun) return null;
    return {
      quantity: String(activeRun.requestedUnits),
      unitsPerCarton: String(activeRun.unitsPerCarton),
      cartonsPerPalette: String(activeRun.cartonsPerLoad),
      productionStartTime: toLocalDateTimeInputValue(getPackingRunProductionStartedAt(activeRun)),
      referenceCadence: String(activeRun.referenceCadenceUnitsPerMinute),
    };
  }

  function finishModifyPreparation(policy: PackingPolicy) {
    setSelectedPolicy(policy);
    setValidationAttempted(false);
    setLaunchError(null);
    setValidationNow(new Date());
    focusAfterRender('#packing-quantity');
  }

  async function performModifyPreparation(allowDegraded: boolean) {
    if (!activeRun) return;
    const restored = getRestoredPreparation();
    if (!restored) return;
    const policy = activeRun.selectedPolicy;
    setShowModifyConfirm(false);
    setShowDegradedModifyConfirm(false);

      if (allowDegraded) {
        setForm(restored);
        const clearResult = await clearRun();
        if (clearResult.status !== 'persisted') {
          setShowDegradedModifyConfirm(true);
          return;
        }
        finishModifyPreparation(policy);
        return;
      }

      const draftWrite = setForm(restored);
      if (draftWrite.status === 'degraded') {
        setShowDegradedModifyConfirm(true);
        return;
      }
      const clearResult = await tryClearRun();
      if (clearResult.status === 'degraded') {
        setShowDegradedModifyConfirm(true);
        return;
      }
      finishModifyPreparation(policy);
  }

  function requestModifyPreparation() {
    if (!activeRun) return;
    if (activeRun.declarations.length > 0) {
      setShowModifyConfirm(true);
      return;
    }
    void performModifyPreparation(false);
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
          description="L’écriture réelle du suivi n’a pas pu être garantie. Un rechargement de la page peut faire perdre la progression."
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
          onConfirm={() => void performModifyPreparation(false)}
        />
      ) : null}
      {showDegradedModifyConfirm ? (
        <ConfirmDialog
          title="Préparation non sauvegardée"
          description="La préparation de remplacement ou la suppression du run actif n’a pas pu être garantie dans le stockage local. Le run reste conservé tant que vous n’acceptez pas de continuer sans sauvegarde."
          confirmLabel="Continuer sans sauvegarde"
          tone="warning"
          onCancel={() => setShowDegradedModifyConfirm(false)}
          onConfirm={() => void performModifyPreparation(true)}
        />
      ) : null}

      <div className="packing-v3-frame">
        {activeRun ? (
          <>
            <PackingRunExecution
              key={`${activeRun.id}:${externalSyncVersion}`}
              run={activeRun}
              persistedDraft={activeRunDraft}
              persistenceStatus={persistenceStatus}
              conflictDetected={conflictDetected}
              onRunChange={updateRun}
              onDraftChange={updateDraft}
            />
            <PackingFrozenPreparation run={activeRun} onModify={requestModifyPreparation} draftRecovered={draftRecovered} />
          </>
        ) : (
          <>
            <PackingPlanningRail
              form={form}
              input={input}
              calculation={calculation}
              selectedPolicy={selectedPolicy}
              fieldErrors={fieldErrors}
              combinationInvalid={validationAttempted && validation.combinationInvalid}
              canLaunch={validation.canLaunch}
              launchGuidance={validationAttempted ? validation.launchGuidance : null}
              isLaunching={isLaunching}
              hasPreparationData={hasPreparationData}
              persistenceDegraded={persistenceDegraded}
              onFieldChange={updateField}
              onFieldBlur={refreshValidationClock}
              onSelectPolicy={(policy) => {
                setLaunchError(null);
                setSelectedPolicy(policy);
              }}
              onLaunch={requestLaunch}
              onReset={() => setShowResetConfirm(true)}
            />
            {draftRecovered ? <p role="status" className="packing-v3-frame-error">Une préparation locale invalide a été ignorée et remplacée par un brouillon sûr. Vérifiez les paramètres avant de continuer.</p> : null}
            {launchError ? <p role="alert" className="packing-v3-frame-error">{launchError}</p> : null}
            <PackingConductWaiting />
          </>
        )}
      </div>
    </main>
  );
}
