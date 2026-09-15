import { Clock3, Gauge, Layers3, Pencil, Trash2, TriangleAlert } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
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
import {
  createPackingDeclarationIdentity,
  emptyDeclarationDraft,
  formatPackingClock,
  formatPackingNumber,
  formatPackingPercent,
  formatPackingReferenceVariance,
  getDeclarationDraftInput,
  getPackingDeclarationErrorMessage,
  getPackingRemainingWork,
  parseNonNegativeSafeInteger,
  type DeclarationDraft,
} from './packingRunExecutionModel';
import { usePackingNow } from './usePackingNow';

interface PackingRunExecutionProps {
  run: PackingRun;
  persistenceStatus: PackingPersistenceStatus;
  onRunChange: (run: PackingRun) => void;
}

function Stepper({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const parsed = parseNonNegativeSafeInteger(value) ?? 0;
  return (
    <div className="packing-v3-stepper">
      <span>{label}</span>
      <div>
        <button type="button" aria-label={`Diminuer ${label}`} onClick={() => onChange(String(Math.max(0, parsed - 1)))}>−</button>
        <input aria-label={label} inputMode="numeric" pattern="[0-9]*" value={value} onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))} />
        <button type="button" aria-label={`Augmenter ${label}`} onClick={() => onChange(String(parsed + 1))}>+</button>
      </div>
    </div>
  );
}

export function PackingRunExecution({ run, persistenceStatus, onRunChange }: PackingRunExecutionProps) {
  const now = usePackingNow();
  const productionStartedAt = getPackingRunProductionStartedAt(run);
  const progress = getPackingRunProgress(run);
  const timing = getPackingRunTiming(run, now);
  const [draft, setDraft] = useState<DeclarationDraft>(emptyDeclarationDraft);
  const [editingDeclarationId, setEditingDeclarationId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const fullLoadUnits = run.unitsPerCarton * run.cartonsPerLoad;
  const canDeclareFullLoad = progress.remainingUnits >= fullLoadUnits;
  const isComplete = progress.remainingUnits === 0;
  const progressPercent = progress.progressRatio * 100;
  const variance = formatPackingReferenceVariance(timing.varianceMinutesVsReference);
  const remainingWork = getPackingRemainingWork(progress.remainingUnits, run.unitsPerCarton, run.cartonsPerLoad);

  const preview = useMemo(() => {
    const input = getDeclarationDraftInput(draft);
    if (!input) return { units: null, error: 'Saisissez uniquement des nombres entiers positifs ou zéro.' };
    if (input.completeCartons === 0 && input.partialCartonUnits === 0) return { units: 0, error: '' };
    try {
      const normalized = normalizePackingDeclaration(input, run.unitsPerCarton);
      return { units: getPackingDeclarationUnits(normalized, run.unitsPerCarton), error: '' };
    } catch (error) {
      return { units: null, error: getPackingDeclarationErrorMessage(error) };
    }
  }, [draft, run.unitsPerCarton]);

  function commitRun(nextRun: PackingRun, message: string) {
    onRunChange(nextRun);
    setErrorMessage('');
    setFeedback(message);
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
      commitRun(nextRun, editingDeclarationId ? 'Déclaration corrigée.' : `${formatPackingNumber(preview.units ?? 0)} unités déclarées.`);
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
    setDraft({ completeCartons: String(declaration.completeCartons), partialCartonUnits: String(declaration.partialCartonUnits) });
    setFeedback('');
    setErrorMessage('');
  }

  function deleteDeclaration(declarationId: string) {
    try {
      commitRun(removePackingDeclaration(run, declarationId), 'Déclaration supprimée et progression recalculée.');
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
      <header className="packing-v3-stage-header">
        <div><h1 id="packing-production-title" tabIndex={-1}>Conduite de production</h1><p>Suivez l’avancement et déclarez ce qui est réellement conditionné.</p></div>
        <span className="packing-v3-status packing-v3-status-running"><span /> Production en cours</span>
      </header>

      <div className="packing-v3-production-grid">
        <div className="packing-v3-production-main">
          <div className="packing-v3-primary-kpis">
            <div><span>Quantité planifiée</span><strong>{formatPackingNumber(run.plannedUnits)}</strong><small>{formatPackingNumber(Math.ceil(run.plannedUnits / run.unitsPerCarton))} cartons</small></div>
            <div><span>Quantité déclarée</span><strong>{formatPackingNumber(progress.declaredUnits)}</strong><small>{progress.declarationCount} déclaration{progress.declarationCount > 1 ? 's' : ''}</small></div>
            <div className="packing-v3-remaining"><span>Quantité restante</span><strong>{formatPackingNumber(progress.remainingUnits)} unités</strong><small>{formatPackingPercent(Math.max(0, 100 - progressPercent))} % du plan restant</small></div>
          </div>

          <div className="packing-v3-progress" role="progressbar" aria-label="Progression de l’ordre de conditionnement" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressPercent)}>
            <div><span>Progression de l’ordre de conditionnement</span><strong>{formatPackingPercent(progressPercent)} %</strong></div>
            <div className="packing-v3-progress-track"><span style={{ width: `${Math.min(100, progressPercent)}%` }} /></div>
          </div>

          <div className="packing-v3-time-kpis">
            <div><span><Clock3 size={16} /> Temps écoulé</span><strong>{formatPackingDuration(timing.elapsedMinutes)}</strong><small>Depuis {formatPackingClock(productionStartedAt)}</small></div>
            <div><span><Gauge size={16} /> Temps estimé total</span><strong>{formatPackingDuration(progress.estimatedTotalMinutes)}</strong><small>À {formatPackingNumber(run.referenceCadenceUnitsPerMinute)} u/min</small></div>
            <div><span><Clock3 size={16} /> Temps estimé restant</span><strong>{formatPackingDuration(progress.estimatedRemainingMinutes)}</strong><small>Fin estimée {formatPackingClock(timing.projectedFinishAt)}</small></div>
            <div className={`packing-v3-reference-gap packing-v3-reference-gap-${variance.tone}`}><span>Écart vs référence</span><strong>{variance.label}</strong><small>{timing.varianceUnitsVsReference >= 0 ? '+' : '−'}{formatPackingNumber(Math.round(Math.abs(timing.varianceUnitsVsReference)))} unités</small></div>
          </div>

          <button type="button" className="packing-v3-full-load-action" disabled={!canDeclareFullLoad || isComplete} onClick={declareFullLoad}>
            <span><Layers3 size={20} aria-hidden="true" /><strong>{isComplete ? 'Production terminée' : 'Déclarer une palette complète'}</strong></span>
            <small>{formatPackingNumber(run.cartonsPerLoad)} cartons · {formatPackingNumber(fullLoadUnits)} unités</small>
            <b aria-hidden="true">→</b>
          </button>

          <form className="packing-v3-partial" onSubmit={submitPartialDeclaration}>
            <div className="packing-v3-partial-heading"><div><strong>{editingDeclarationId ? 'Corriger la déclaration' : 'Palette partielle'}</strong><span>Cartons + unités du carton incomplet</span></div><div><span>Aperçu</span><strong>{preview.units === null ? '—' : formatPackingNumber(preview.units)} unités</strong>{preview.units ? <small>({draft.completeCartons || '0'} × {formatPackingNumber(run.unitsPerCarton)} + {draft.partialCartonUnits || '0'})</small> : null}</div></div>
            <div className="packing-v3-partial-controls">
              <Stepper label="Cartons complets" value={draft.completeCartons} onChange={(value) => setDraft((current) => ({ ...current, completeCartons: value }))} />
              <Stepper label="Unités dans le carton incomplet" value={draft.partialCartonUnits} onChange={(value) => setDraft((current) => ({ ...current, partialCartonUnits: value }))} />
              <button type="submit" disabled={isComplete && !editingDeclarationId}>{editingDeclarationId ? 'Enregistrer la correction' : 'Enregistrer la palette partielle'} <span aria-hidden="true">→</span></button>
            </div>
            {editingDeclarationId ? <button type="button" className="packing-v3-cancel-edit" onClick={() => { setEditingDeclarationId(null); setDraft(emptyDeclarationDraft); }}>Annuler la correction</button> : null}
            {preview.error ? <p className="packing-v3-inline-error">{preview.error}</p> : null}
          </form>

          <section className="packing-v3-next-work" aria-label="Suite du conditionnement">
            <div className="packing-v3-next-work-heading">
              <span><Layers3 size={16} aria-hidden="true" /> Suite du conditionnement</span>
              <strong>{remainingWork.summary}</strong>
            </div>
            {remainingWork.afterNextFullLoad ? <p>{remainingWork.afterNextFullLoad}</p> : null}
          </section>

          {persistenceStatus === 'degraded' ? <p className="packing-v3-persistence-warning">La sauvegarde locale n’est pas garantie : les dernières déclarations pourront être perdues au rechargement.</p> : null}
          {errorMessage ? <div role="alert" className="packing-v3-error"><TriangleAlert size={16} />{errorMessage}</div> : null}
          {feedback ? <p role="status" aria-live="polite" className="packing-v3-feedback">{feedback}</p> : null}
        </div>

        <aside className="packing-v3-history" aria-label="Historique des déclarations">
          <div className="packing-v3-history-head"><div><strong>Historique des déclarations</strong><span>{run.declarations.length} déclaration{run.declarations.length > 1 ? 's' : ''} enregistrée{run.declarations.length > 1 ? 's' : ''}</span></div></div>
          <div className="packing-v3-history-scroll">
            {run.declarations.length === 0 ? <p className="packing-v3-history-empty">Aucune production déclarée pour le moment.</p> : [...run.declarations].reverse().map((declaration) => {
              const units = getPackingDeclarationUnits(declaration, run.unitsPerCarton);
              const fullPalette = declaration.completeCartons === run.cartonsPerLoad && declaration.partialCartonUnits === 0;
              return (
                <div className="packing-v3-history-row" key={declaration.id}>
                  <time dateTime={declaration.createdAt}>{formatPackingClock(declaration.createdAt)}</time>
                  <span><Layers3 size={14} aria-hidden="true" />{fullPalette ? 'Palette complète' : 'Palette partielle'}</span>
                  <strong>{formatPackingNumber(units)} unités</strong>
                  <button type="button" onClick={() => beginCorrection(declaration.id)} aria-label={`Corriger la déclaration de ${formatPackingNumber(units)} unités`}><Pencil size={14} />Corriger</button>
                  <button type="button" className="packing-v3-history-delete" onClick={() => deleteDeclaration(declaration.id)} aria-label={`Supprimer la déclaration de ${formatPackingNumber(units)} unités`}><Trash2 size={14} /></button>
                </div>
              );
            })}
          </div>
          <div className="packing-v3-history-total"><span>Total déclaré</span><strong>{formatPackingNumber(progress.declaredUnits)} unités</strong></div>
        </aside>
      </div>
    </section>
  );
}
