import { Clock3, Gauge, Layers3, Pencil, Trash2, TriangleAlert } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { AccessibleDialog } from '../../../components/AccessibleDialog';
import {
  addPackingDeclaration,
  formatPackingDuration,
  getPackingDeclarationUnits,
  getPackingRunProductionStartedAt,
  getPackingRunProgress,
  getPackingRunTiming,
  normalizePackingDeclaration,
  removePackingDeclaration,
  replacePackingDeclaration,
  type PackingRun,
} from '../domain/packingRun';
import type { PackingPersistenceStatus } from '../usePackingActiveRun';
import type { PackingRunWriteResult, PersistedPackingDraft } from '../persistence/packingRunStorage';
import {
  createPackingDeclarationIdentity,
  emptyDeclarationDraft,
  formatPackingClock,
  formatPackingFinish,
  formatPackingNumber,
  formatPackingPercent,
  formatPackingReferenceVariance,
  getDeclarationDraftInput,
  getPackingDeclarationErrorMessage,
  getPackingRemainingWork,
  normalizePackingDraft,
  parseNonNegativeSafeInteger,
  type DeclarationDraft,
} from './packingRunExecutionModel';
import { usePackingNow } from './usePackingNow';

interface PackingRunExecutionProps {
  run: PackingRun;
  persistenceStatus: PackingPersistenceStatus;
  persistedDraft: PersistedPackingDraft | null;
  conflictDetected: boolean;
  onRunChange: (run: PackingRun) => PackingRunWriteResult;
  onDraftChange: (draft: PersistedPackingDraft | null) => void;
}

function Stepper({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const parsed = parseNonNegativeSafeInteger(value) ?? 0;
  return (
    <div className="packing-v3-stepper">
      <span>{label}</span>
      <div>
        <button type="button" aria-label={`Diminuer ${label}`} onClick={() => onChange(String(Math.max(0, parsed - 1)))}>−</button>
        <input aria-label={label} inputMode="numeric" pattern="[0-9]*" value={value} onChange={(event) => onChange(event.target.value)} />
        <button type="button" aria-label={`Augmenter ${label}`} onClick={() => onChange(String(parsed + 1))}>+</button>
      </div>
    </div>
  );
}

function formatDraftComposition(completeLoads: number, completeCartons: number, partialCartonUnits: number): string {
  const parts: string[] = [];
  if (completeLoads > 0) parts.push(`${formatPackingNumber(completeLoads)} palette${completeLoads > 1 ? 's' : ''} complète${completeLoads > 1 ? 's' : ''}`);
  if (completeCartons > 0) parts.push(`${formatPackingNumber(completeCartons)} carton${completeCartons > 1 ? 's' : ''}`);
  if (partialCartonUnits > 0) parts.push(`${formatPackingNumber(partialCartonUnits)} unité${partialCartonUnits > 1 ? 's' : ''} dans le carton incomplet`);
  return parts.length > 0 ? parts.join(' + ') : 'Aucune quantité en cours';
}

function formatLiveDraftComposition(
  normalization: { completeLoads: number; completeCartons: number; partialCartonUnits: number } | null,
): string {
  if (!normalization) return '— carton';

  const completeLoads = normalization.completeLoads;
  const completeCartons = normalization.completeCartons;
  const partialCartonUnits = normalization.partialCartonUnits;
  const parts: string[] = [];

  if (completeLoads > 0) {
    parts.push(`${formatPackingNumber(completeLoads)} palette${completeLoads > 1 ? 's' : ''} complète${completeLoads > 1 ? 's' : ''}`);
  }
  parts.push(`${formatPackingNumber(completeCartons)} carton${completeCartons > 1 ? 's' : ''}`);
  if (partialCartonUnits > 0) {
    parts.push(`${formatPackingNumber(partialCartonUnits)} unité${partialCartonUnits > 1 ? 's' : ''} dans le carton incomplet`);
  }

  return parts.join(' + ');
}

function formatDeclarationKind(completeCartons: number, partialCartonUnits: number, cartonsPerLoad: number): string {
  const completeLoads = Math.floor(completeCartons / cartonsPerLoad);
  const remainingCartons = completeCartons % cartonsPerLoad;
  if (completeLoads === 1 && remainingCartons === 0 && partialCartonUnits === 0) return 'Palette complète';
  return formatDraftComposition(completeLoads, remainingCartons, partialCartonUnits);
}

export function PackingRunExecution({ run, persistenceStatus, persistedDraft, conflictDetected, onRunChange, onDraftChange }: PackingRunExecutionProps) {
  const now = usePackingNow();
  const productionStartedAt = getPackingRunProductionStartedAt(run);
  const [draft, setDraft] = useState<DeclarationDraft>(() => persistedDraft?.runId === run.id ? {
    completeCartons: persistedDraft.completeCartons,
    partialCartonUnits: persistedDraft.partialCartonUnits,
  } : emptyDeclarationDraft);
  const [editingDeclarationId, setEditingDeclarationId] = useState<string | null>(() => persistedDraft?.runId === run.id ? persistedDraft.editingDeclarationId : null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(100);
  const [feedback, setFeedback] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const committedProgress = getPackingRunProgress(run);

  const preview = useMemo(() => {
    const input = getDeclarationDraftInput(draft);
    if (!input) {
      return { units: null, error: 'Saisissez uniquement des nombres entiers positifs ou zéro.', normalization: null, liveRun: null };
    }
    const normalization = normalizePackingDraft(draft, run.unitsPerCarton, run.cartonsPerLoad);
    if (!normalization) {
      return { units: null, error: 'Cette saisie est trop élevée pour être calculée de manière fiable.', normalization: null, liveRun: null };
    }
    if (normalization.totalUnits === 0) {
      return { units: 0, error: '', normalization, liveRun: run };
    }
    try {
      const normalized = normalizePackingDeclaration(input, run.unitsPerCarton);
      const liveRun = editingDeclarationId
        ? replacePackingDeclaration(run, editingDeclarationId, input)
        : addPackingDeclaration(run, {
            id: '__packing-live-draft__',
            createdAt: now.toISOString(),
            ...normalized,
          });
      return {
        units: getPackingDeclarationUnits(normalized, run.unitsPerCarton),
        error: '',
        normalization,
        liveRun,
      };
    } catch (error) {
      return { units: null, error: getPackingDeclarationErrorMessage(error), normalization, liveRun: null };
    }
  }, [draft, editingDeclarationId, now, run]);

  const liveRun = preview.liveRun ?? run;
  const progress = getPackingRunProgress(liveRun);
  const timing = getPackingRunTiming(liveRun, now);
  const fullLoadUnits = run.unitsPerCarton * run.cartonsPerLoad;
  const isComplete = committedProgress.remainingUnits === 0;
  const hasLiveDraft = Boolean(preview.units && preview.liveRun);
  const canDeclareFullLoad = !hasLiveDraft && committedProgress.remainingUnits >= fullLoadUnits;
  const progressPercent = progress.progressRatio * 100;
  const variance = formatPackingReferenceVariance(timing.varianceMinutesVsReference);
  const remainingWork = getPackingRemainingWork(progress.remainingUnits, run.unitsPerCarton, run.cartonsPerLoad);
  const visibleDeclarations = useMemo(
    () => [...run.declarations].reverse().slice(0, visibleHistoryCount),
    [run.declarations, visibleHistoryCount],
  );

  function updateWorkingDraft(nextDraft: DeclarationDraft, nextEditingId = editingDeclarationId) {
    setDraft(nextDraft);
    onDraftChange(nextDraft.completeCartons === '' && nextDraft.partialCartonUnits === '' && !nextEditingId ? null : {
      runId: run.id,
      ...nextDraft,
      editingDeclarationId: nextEditingId,
      updatedAt: new Date().toISOString(),
    });
  }

  function commitRun(nextRun: PackingRun, message: string): boolean {
    const result = onRunChange(nextRun);
    if (result.status === 'conflict') {
      setFeedback('');
      setErrorMessage('La déclaration n’a pas été enregistrée car un autre onglet a modifié ce suivi. Les données récentes ont été rechargées.');
      return false;
    }
    setErrorMessage('');
    setFeedback(message);
    return true;
  }

  function declareFullLoad() {
    try {
      const nextRun = addPackingDeclaration(run, {
        ...createPackingDeclarationIdentity(),
        completeCartons: run.cartonsPerLoad,
        partialCartonUnits: 0,
      });
      commitRun(nextRun, `${formatPackingNumber(fullLoadUnits)} unités déclarées.`);
    } catch (error) {
      setFeedback('');
      setErrorMessage(getPackingDeclarationErrorMessage(error));
    }
  }

  function submitPartialDeclaration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = getDeclarationDraftInput(draft);
    if (!input) {
      setErrorMessage('Saisissez uniquement des nombres entiers positifs ou zéro.');
      return;
    }
    try {
      const nextRun = editingDeclarationId
        ? replacePackingDeclaration(run, editingDeclarationId, input)
        : addPackingDeclaration(run, { ...createPackingDeclarationIdentity(), ...input });
      if (!commitRun(nextRun, editingDeclarationId ? 'Déclaration corrigée.' : `${formatPackingNumber(preview.units ?? 0)} unités déclarées.`)) return;
      setEditingDeclarationId(null);
      setDraft(emptyDeclarationDraft);
    } catch (error) {
      setFeedback('');
      setErrorMessage(getPackingDeclarationErrorMessage(error));
    }
  }

  function beginCorrection(declarationId: string) {
    const declaration = run.declarations.find((entry) => entry.id === declarationId);
    if (!declaration) return;
    setEditingDeclarationId(declarationId);
    updateWorkingDraft({ completeCartons: String(declaration.completeCartons), partialCartonUnits: String(declaration.partialCartonUnits) }, declarationId);
    setFeedback('');
    setErrorMessage('');
  }

  function deleteDeclaration(declarationId: string) {
    try {
      if (!commitRun(removePackingDeclaration(run, declarationId), 'Déclaration supprimée et progression recalculée.')) return;
      setPendingDeleteId(null);
      if (editingDeclarationId === declarationId) {
        setEditingDeclarationId(null);
        setDraft(emptyDeclarationDraft);
      }
    } catch (error) {
      setErrorMessage(getPackingDeclarationErrorMessage(error));
    }
  }

  return (
    <section aria-labelledby="packing-production-title" className="packing-v3-production packing-v3-stage">
      {pendingDeleteId ? (
        <AccessibleDialog title="Supprimer cette déclaration ?" description="La progression et toutes les estimations seront recalculées immédiatement." contentClassName="p-5" onClose={() => setPendingDeleteId(null)}>
          <div className="flex gap-3">
            <button type="button" className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-bold" onClick={() => setPendingDeleteId(null)}>Annuler</button>
            <button type="button" className="flex-1 rounded-xl bg-red-700 py-3 text-sm font-bold text-white" onClick={() => deleteDeclaration(pendingDeleteId)}>Supprimer</button>
          </div>
        </AccessibleDialog>
      ) : null}
      <header className="packing-v3-stage-header">
        <div><h1 id="packing-production-title" tabIndex={-1}>Conduite de production</h1><p>Suivez l’avancement et déclarez ce qui est réellement conditionné.</p></div>
        <span className="packing-v3-status packing-v3-status-running"><span /> Production en cours</span>
      </header>

      <div className="packing-v3-production-grid">
        <div className="packing-v3-production-main">
          <div className="packing-v3-primary-kpis">
            <div><span>Quantité planifiée</span><strong>{formatPackingNumber(run.plannedUnits)}</strong><small>{formatPackingNumber(Math.ceil(run.plannedUnits / run.unitsPerCarton))} cartons</small></div>
            <div><span>Quantité enregistrée</span><strong>{formatPackingNumber(committedProgress.declaredUnits)}</strong><small>{committedProgress.declarationCount} déclaration{committedProgress.declarationCount > 1 ? 's' : ''} enregistrée{committedProgress.declarationCount > 1 ? 's' : ''}{hasLiveDraft ? ' · saisie en cours incluse ci-dessous' : ''}</small></div>
            <div className="packing-v3-remaining"><span>Quantité restante</span><strong>{formatPackingNumber(progress.remainingUnits)} unités</strong><small>{formatPackingPercent(Math.max(0, 100 - progressPercent))} % du plan restant</small></div>
          </div>

          <div className="packing-v3-progress" role="progressbar" aria-label="Progression de l’ordre de conditionnement" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressPercent)}>
            <div><span>Progression de l’ordre de conditionnement</span><strong>{formatPackingPercent(progressPercent)} %</strong></div>
            <div className="packing-v3-progress-track"><span style={{ width: `${Math.min(100, progressPercent)}%` }} /></div>
          </div>

          <div className="packing-v3-time-kpis">
            <div><span><Clock3 size={16} /> Temps écoulé</span><strong>{formatPackingDuration(timing.elapsedMinutes)}</strong><small>Depuis {formatPackingClock(productionStartedAt)}</small></div>
            <div><span><Gauge size={16} /> Temps estimé total</span><strong>{formatPackingDuration(progress.estimatedTotalMinutes)}</strong><small>À {formatPackingNumber(run.referenceCadenceUnitsPerMinute)} u/min</small></div>
            <div><span><Clock3 size={16} /> Temps estimé restant</span><strong>{formatPackingDuration(progress.estimatedRemainingMinutes)}</strong><small>Fin estimée {formatPackingFinish(timing.projectedFinishAt, now)}</small></div>
            <div className={`packing-v3-reference-gap packing-v3-reference-gap-${variance.tone}`}><span>Écart vs référence</span><strong>{variance.label}</strong><small>{timing.varianceUnitsVsReference >= 0 ? '+' : '−'}{formatPackingNumber(Math.round(Math.abs(timing.varianceUnitsVsReference)))} unités</small></div>
          </div>

          <button type="button" className="packing-v3-full-load-action" disabled={!canDeclareFullLoad || isComplete} onClick={declareFullLoad}>
            <small>{formatPackingNumber(run.cartonsPerLoad)} cartons · {formatPackingNumber(fullLoadUnits)} unités</small>
            <span><Layers3 size={20} aria-hidden="true" /><strong>{isComplete ? 'Production terminée' : 'Déclarer une palette complète'}</strong></span>
          </button>

          <form className="packing-v3-partial" onSubmit={submitPartialDeclaration}>
            <div className="packing-v3-partial-heading"><div><strong>{editingDeclarationId ? 'Corriger la déclaration' : 'Palette partielle'}</strong><span>Cartons + unités du carton incomplet</span></div><div><span>Aperçu temps réel</span><strong>{preview.units === null ? '—' : formatPackingNumber(preview.units)} unités</strong><small className="packing-v3-live-composition">{formatLiveDraftComposition(preview.normalization)}</small></div></div>
            <div className="packing-v3-partial-controls">
              <Stepper label="Cartons complets" value={draft.completeCartons} onChange={(value) => updateWorkingDraft({ ...draft, completeCartons: value })} />
              <Stepper label="Unités dans le carton incomplet" value={draft.partialCartonUnits} onChange={(value) => updateWorkingDraft({ ...draft, partialCartonUnits: value })} />
              <button type="submit" disabled={isComplete && !editingDeclarationId}>{editingDeclarationId ? 'Enregistrer la correction' : 'Enregistrer la palette partielle'}</button>
            </div>
            {editingDeclarationId ? <button type="button" className="packing-v3-cancel-edit" onClick={() => { setEditingDeclarationId(null); updateWorkingDraft(emptyDeclarationDraft, null); }}>Annuler la correction</button> : null}
            <p role={hasLiveDraft ? 'status' : undefined} aria-hidden={!hasLiveDraft} className={`packing-v3-feedback packing-v3-live-feedback ${hasLiveDraft ? '' : 'packing-v3-live-feedback-empty'}`}>{hasLiveDraft ? 'Saisie en cours incluse dans la progression et les estimations. Validez pour l’ajouter à l’historique.' : '\u00a0'}</p>
            {preview.error ? <p className="packing-v3-inline-error">{preview.error}</p> : null}
          </form>

          <section className="packing-v3-next-work" aria-label="Suite du conditionnement">
            <div className="packing-v3-next-work-heading">
              <span><Layers3 size={16} aria-hidden="true" /> Suite du conditionnement</span>
              <strong>{remainingWork.summary}</strong>
            </div>
            {remainingWork.afterNextFullLoad ? (
              <div className="packing-v3-next-work-after">
                <span>Après la prochaine palette</span>
                <strong>{remainingWork.afterNextFullLoad.replace(/^Après cette palette complète : /, '')}</strong>
              </div>
            ) : null}
          </section>

          {persistenceStatus === 'degraded' ? <p className="packing-v3-persistence-warning">La sauvegarde locale n’est pas garantie : les dernières déclarations pourront être perdues au rechargement.</p> : null}
          {conflictDetected ? <p role="alert" className="packing-v3-persistence-warning">Ce suivi a été modifié dans un autre onglet. Les données les plus récentes ont été rechargées ; vérifiez-les avant de continuer.</p> : null}
          {errorMessage ? <div role="alert" className="packing-v3-error"><TriangleAlert size={16} />{errorMessage}</div> : null}
          {feedback ? <p role="status" aria-live="polite" className="packing-v3-feedback">{feedback}</p> : null}
        </div>

        <aside className="packing-v3-history" aria-label="Historique des déclarations">
          <div className="packing-v3-history-head"><div><strong>Historique des déclarations</strong><span>{run.declarations.length} déclaration{run.declarations.length > 1 ? 's' : ''} enregistrée{run.declarations.length > 1 ? 's' : ''}</span></div></div>
          <div className="packing-v3-history-scroll">
            {run.declarations.length === 0 ? <p className="packing-v3-history-empty">Aucune production déclarée pour le moment.</p> : visibleDeclarations.map((declaration) => {
              const units = getPackingDeclarationUnits(declaration, run.unitsPerCarton);
              const declarationKind = formatDeclarationKind(declaration.completeCartons, declaration.partialCartonUnits, run.cartonsPerLoad);
              const isCompleteLoadDeclaration =
                declaration.partialCartonUnits === 0 &&
                declaration.completeCartons >= run.cartonsPerLoad &&
                declaration.completeCartons % run.cartonsPerLoad === 0;
              return (
                <div className="packing-v3-history-row" key={declaration.id}>
                  <time dateTime={declaration.createdAt}>{formatPackingClock(declaration.createdAt)}</time>
                  <span><Layers3 size={14} aria-hidden="true" />{isCompleteLoadDeclaration ? declarationKind : 'Palette partielle'}{!isCompleteLoadDeclaration ? <small> · {declarationKind}</small> : null}</span>
                  <strong>{formatPackingNumber(units)} unités</strong>
                  <button type="button" onClick={() => beginCorrection(declaration.id)} aria-label={`Corriger la déclaration de ${formatPackingNumber(units)} unités`}><Pencil size={14} />Corriger</button>
                  <button type="button" className="packing-v3-history-delete" onClick={() => setPendingDeleteId(declaration.id)} aria-label={`Supprimer la déclaration de ${formatPackingNumber(units)} unités`}><Trash2 size={14} /></button>
                </div>
              );
            })}
            {visibleHistoryCount < run.declarations.length ? (
              <button type="button" className="packing-v3-history-more" onClick={() => setVisibleHistoryCount((count) => count + 100)}>
                Afficher 100 déclarations supplémentaires
              </button>
            ) : null}
          </div>
          <div className="packing-v3-history-total"><span>Total enregistré</span><strong>{formatPackingNumber(committedProgress.declaredUnits)} unités</strong></div>
        </aside>
      </div>
    </section>
  );
}
