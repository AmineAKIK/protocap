import { Clock3, Gauge, Layers3, Pencil, Trash2, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  addPackingDeclaration,
  formatPackingDuration,
  getPackingDeclarationUnits,
  getPackingRunProductionStartedAt,
  getPackingRunProgress,
  getPackingRunTiming,
  normalizePackingDeclaration,
  PackingRunDomainError,
  removePackingDeclaration,
  replacePackingDeclaration,
  type PackingDeclarationInput,
  type PackingRun,
} from '../domain/packingRun';
import type { PackingPersistenceStatus } from '../usePackingActiveRun';

interface PackingRunExecutionProps {
  run: PackingRun;
  persistenceStatus: PackingPersistenceStatus;
  onRunChange: (run: PackingRun) => void;
}

interface DeclarationDraft {
  completeCartons: string;
  partialCartonUnits: string;
}

const emptyDraft: DeclarationDraft = { completeCartons: '', partialCartonUnits: '' };
const numberFormatter = new Intl.NumberFormat('fr-FR');
const percentFormatter = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const formatNumber = (value: number) => numberFormatter.format(value);

function parseNonNegativeSafeInteger(value: string): number | null {
  if (value.trim() === '') return 0;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function getDraftInput(draft: DeclarationDraft): PackingDeclarationInput | null {
  const completeCartons = parseNonNegativeSafeInteger(draft.completeCartons);
  const partialCartonUnits = parseNonNegativeSafeInteger(draft.partialCartonUnits);
  if (completeCartons === null || partialCartonUnits === null) return null;
  return { completeCartons, partialCartonUnits };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof PackingRunDomainError) {
    if (error.code === 'OVER_DECLARATION') return 'Cette déclaration dépasse le volume restant du run actif.';
    if (error.code === 'ZERO_DECLARATION') return 'Saisissez au moins un carton complet ou une unité dans le carton incomplet.';
    return error.message;
  }
  return 'La déclaration n’a pas pu être enregistrée.';
}

function createDeclarationIdentity(): { id: string; createdAt: string } {
  if (typeof globalThis.crypto?.randomUUID !== 'function') throw new Error('Secure declaration identity generation is unavailable.');
  return { id: globalThis.crypto.randomUUID(), createdAt: new Date().toISOString() };
}

function usePackingNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);
  return now;
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatVariance(minutes: number): { label: string; tone: 'ahead' | 'late' | 'neutral' } {
  const rounded = Math.round(Math.abs(minutes));
  if (rounded < 1) return { label: 'À l’heure', tone: 'neutral' };
  return minutes > 0
    ? { label: `${rounded} min d’avance`, tone: 'ahead' }
    : { label: `${rounded} min de retard`, tone: 'late' };
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
  const [draft, setDraft] = useState<DeclarationDraft>(emptyDraft);
  const [editingDeclarationId, setEditingDeclarationId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const fullLoadUnits = run.unitsPerCarton * run.cartonsPerLoad;
  const canDeclareFullLoad = progress.remainingUnits >= fullLoadUnits;
  const isComplete = progress.remainingUnits === 0;
  const progressPercent = progress.progressRatio * 100;
  const variance = formatVariance(timing.varianceMinutesVsReference);

  const preview = useMemo(() => {
    const input = getDraftInput(draft);
    if (!input) return { units: null, error: 'Saisissez uniquement des nombres entiers positifs ou zéro.' };
    if (input.completeCartons === 0 && input.partialCartonUnits === 0) return { units: 0, error: '' };
    try {
      const normalized = normalizePackingDeclaration(input, run.unitsPerCarton);
      return { units: getPackingDeclarationUnits(normalized, run.unitsPerCarton), error: '' };
    } catch (error) {
      return { units: null, error: getErrorMessage(error) };
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
        ...createDeclarationIdentity(),
        completeCartons: run.cartonsPerLoad,
        partialCartonUnits: 0,
      });
      commitRun(nextRun, `${formatNumber(fullLoadUnits)} unités déclarées.`);
    } catch (error) {
      setFeedback('');
      setErrorMessage(getErrorMessage(error));
    }
  }

  function submitPartialDeclaration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = getDraftInput(draft);
    if (!input) {
      setErrorMessage('Saisissez uniquement des nombres entiers positifs ou zéro.');
      return;
    }
    try {
      const nextRun = editingDeclarationId
        ? replacePackingDeclaration(run, editingDeclarationId, input)
        : addPackingDeclaration(run, { ...createDeclarationIdentity(), ...input });
      commitRun(nextRun, editingDeclarationId ? 'Déclaration corrigée.' : `${formatNumber(preview.units ?? 0)} unités déclarées.`);
      setEditingDeclarationId(null);
      setDraft(emptyDraft);
    } catch (error) {
      setFeedback('');
      setErrorMessage(getErrorMessage(error));
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
        setDraft(emptyDraft);
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  return (
    <section aria-labelledby="packing-production-title" className="packing-v3-production packing-v3-stage">
      <header className="packing-v3-stage-header">
        <div><h1 id="packing-production-title">Conduite de production</h1><p>Suivez l’avancement et déclarez ce qui est réellement conditionné.</p></div>
        <span className="packing-v3-status packing-v3-status-running"><span /> Production en cours</span>
      </header>

      <div className="packing-v3-production-grid">
        <div className="packing-v3-production-main">
          <div className="packing-v3-primary-kpis">
            <div><span>Quantité planifiée</span><strong>{formatNumber(run.plannedUnits)}</strong><small>{formatNumber(Math.ceil(run.plannedUnits / run.unitsPerCarton))} cartons</small></div>
            <div><span>Quantité déclarée</span><strong>{formatNumber(progress.declaredUnits)}</strong><small>{progress.declarationCount} déclaration{progress.declarationCount > 1 ? 's' : ''}</small></div>
            <div className="packing-v3-remaining"><span>Quantité restante</span><strong>{formatNumber(progress.remainingUnits)} unités</strong><small>{percentFormatter.format(Math.max(0, 100 - progressPercent))} % du plan restant</small></div>
          </div>

          <div className="packing-v3-progress" role="progressbar" aria-label="Progression de l’ordre de conditionnement" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressPercent)}>
            <div><span>Progression de l’ordre de conditionnement</span><strong>{percentFormatter.format(progressPercent)} %</strong></div>
            <div className="packing-v3-progress-track"><span style={{ width: `${Math.min(100, progressPercent)}%` }} /></div>
          </div>

          <div className="packing-v3-time-kpis">
            <div><span><Clock3 size={16} /> Temps écoulé</span><strong>{formatPackingDuration(timing.elapsedMinutes)}</strong><small>Depuis {formatClock(productionStartedAt)}</small></div>
            <div><span><Gauge size={16} /> Temps estimé total</span><strong>{formatPackingDuration(progress.estimatedTotalMinutes)}</strong><small>À {formatNumber(run.referenceCadenceUnitsPerMinute)} u/min</small></div>
            <div><span><Clock3 size={16} /> Temps estimé restant</span><strong>{formatPackingDuration(progress.estimatedRemainingMinutes)}</strong><small>Fin estimée {formatClock(timing.projectedFinishAt)}</small></div>
            <div className={`packing-v3-reference-gap packing-v3-reference-gap-${variance.tone}`}><span>Écart vs référence</span><strong>{variance.label}</strong><small>{timing.varianceUnitsVsReference >= 0 ? '+' : '−'}{formatNumber(Math.round(Math.abs(timing.varianceUnitsVsReference)))} unités</small></div>
          </div>

          <button type="button" className="packing-v3-full-load-action" disabled={!canDeclareFullLoad || isComplete} onClick={declareFullLoad}>
            <span><Layers3 size={20} aria-hidden="true" /><strong>{isComplete ? 'Production terminée' : 'Déclarer une palette complète'}</strong></span>
            <small>{formatNumber(run.cartonsPerLoad)} cartons · {formatNumber(fullLoadUnits)} unités</small>
            <b aria-hidden="true">→</b>
          </button>

          <form className="packing-v3-partial" onSubmit={submitPartialDeclaration}>
            <div className="packing-v3-partial-heading"><div><strong>{editingDeclarationId ? 'Corriger la déclaration' : 'Palette partielle'}</strong><span>Cartons + unités du carton incomplet</span></div><div><span>Aperçu</span><strong>{preview.units === null ? '—' : formatNumber(preview.units)} unités</strong>{preview.units ? <small>({draft.completeCartons || '0'} × {formatNumber(run.unitsPerCarton)} + {draft.partialCartonUnits || '0'})</small> : null}</div></div>
            <div className="packing-v3-partial-controls">
              <Stepper label="Cartons complets" value={draft.completeCartons} onChange={(value) => setDraft((current) => ({ ...current, completeCartons: value }))} />
              <Stepper label="Unités dans le carton incomplet" value={draft.partialCartonUnits} onChange={(value) => setDraft((current) => ({ ...current, partialCartonUnits: value }))} />
              <button type="submit" disabled={isComplete && !editingDeclarationId}>{editingDeclarationId ? 'Enregistrer la correction' : 'Enregistrer la palette partielle'} <span aria-hidden="true">→</span></button>
            </div>
            {editingDeclarationId ? <button type="button" className="packing-v3-cancel-edit" onClick={() => { setEditingDeclarationId(null); setDraft(emptyDraft); }}>Annuler la correction</button> : null}
            {preview.error ? <p className="packing-v3-inline-error">{preview.error}</p> : null}
          </form>

          {persistenceStatus === 'degraded' ? <p className="packing-v3-persistence-warning">Le stockage local est indisponible : les dernières déclarations pourront être perdues au rechargement.</p> : null}
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
                  <time dateTime={declaration.createdAt}>{formatClock(declaration.createdAt)}</time>
                  <span><Layers3 size={14} aria-hidden="true" />{fullPalette ? 'Palette complète' : 'Palette partielle'}</span>
                  <strong>{formatNumber(units)} unités</strong>
                  <button type="button" onClick={() => beginCorrection(declaration.id)} aria-label={`Corriger la déclaration de ${formatNumber(units)} unités`}><Pencil size={14} />Corriger</button>
                  <button type="button" className="packing-v3-history-delete" onClick={() => deleteDeclaration(declaration.id)} aria-label={`Supprimer la déclaration de ${formatNumber(units)} unités`}><Trash2 size={14} /></button>
                </div>
              );
            })}
          </div>
          <div className="packing-v3-history-total"><span>Total déclaré</span><strong>{formatNumber(progress.declaredUnits)} unités</strong></div>
        </aside>
      </div>
    </section>
  );
}
