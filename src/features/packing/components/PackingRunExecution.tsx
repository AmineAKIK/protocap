import { CheckCircle2, Pencil, Plus, RotateCcw, Trash2, TriangleAlert } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import {
  addPackingDeclaration,
  getPackingDeclarationUnits,
  getPackingRunProgress,
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
  onNewRun: () => void;
}

interface DeclarationDraft {
  completeCartons: string;
  partialCartonUnits: string;
}

const emptyDraft: DeclarationDraft = {
  completeCartons: '',
  partialCartonUnits: '',
};

const numberFormatter = new Intl.NumberFormat('fr-FR');

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

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
    if (error.code === 'OVER_DECLARATION') {
      return 'Cette déclaration dépasse le volume restant du run actif.';
    }
    if (error.code === 'ZERO_DECLARATION') {
      return 'Saisissez au moins un carton complet ou une unité partielle.';
    }
    return error.message;
  }
  return 'La déclaration n’a pas pu être enregistrée.';
}

function createDeclarationIdentity(): { id: string; createdAt: string } {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new Error('Secure declaration identity generation is unavailable.');
  }
  return { id: globalThis.crypto.randomUUID(), createdAt: new Date().toISOString() };
}

export function PackingRunExecution({
  run,
  persistenceStatus,
  onRunChange,
  onNewRun,
}: PackingRunExecutionProps) {
  const progress = getPackingRunProgress(run);
  const [draft, setDraft] = useState<DeclarationDraft>(emptyDraft);
  const [editingDeclarationId, setEditingDeclarationId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const fullLoadUnits = run.unitsPerCarton * run.cartonsPerLoad;
  const canDeclareFullLoad = progress.remainingUnits >= fullLoadUnits;
  const isComplete = progress.remainingUnits === 0;

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
      commitRun(nextRun, `${formatNumber(fullLoadUnits)} unités déclarées produites.`);
    } catch (error) {
      setFeedback('');
      setErrorMessage(getErrorMessage(error));
    }
  }

  function submitPartialDeclaration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = getDraftInput(draft);
    if (!input) {
      setFeedback('');
      setErrorMessage('Saisissez uniquement des nombres entiers positifs ou zéro.');
      return;
    }

    try {
      if (editingDeclarationId) {
        const nextRun = replacePackingDeclaration(run, editingDeclarationId, input);
        commitRun(nextRun, 'Déclaration corrigée.');
        setEditingDeclarationId(null);
      } else {
        const nextRun = addPackingDeclaration(run, {
          ...createDeclarationIdentity(),
          ...input,
        });
        const declaration = nextRun.declarations[nextRun.declarations.length - 1];
        commitRun(
          nextRun,
          `${formatNumber(getPackingDeclarationUnits(declaration, run.unitsPerCarton))} unités déclarées produites.`,
        );
      }
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
    setDraft({
      completeCartons: String(declaration.completeCartons),
      partialCartonUnits: String(declaration.partialCartonUnits),
    });
    setFeedback('');
    setErrorMessage('');
  }

  function cancelCorrection() {
    setEditingDeclarationId(null);
    setDraft(emptyDraft);
    setErrorMessage('');
  }

  function removeDeclaration(declarationId: string) {
    try {
      const nextRun = removePackingDeclaration(run, declarationId);
      commitRun(nextRun, 'Déclaration supprimée et progression recalculée.');
      if (editingDeclarationId === declarationId) cancelCorrection();
    } catch (error) {
      setFeedback('');
      setErrorMessage(getErrorMessage(error));
    }
  }

  return (
    <section
      aria-labelledby="packing-run-execution-title"
      className={`overflow-hidden rounded-[1.75rem] border bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)] ${isComplete ? 'border-emerald-200' : 'border-slate-200'}`}
    >
      <div className={`border-b px-5 py-4 sm:px-6 ${isComplete ? 'border-emerald-200 bg-emerald-50/70' : 'border-slate-200'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Exécution atelier · run actif</p>
            <h2 id="packing-run-execution-title" className="mt-0.5 text-lg font-black tracking-tight text-slate-950">
              Déclarations de production
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${persistenceStatus === 'persisted' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>
              {persistenceStatus === 'persisted' ? 'Enregistré localement' : 'Stockage local indisponible'}
            </span>
            <button
              type="button"
              onClick={onNewRun}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw size={13} aria-hidden="true" />
              Nouveau run
            </button>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <p className="sr-only" role="status" aria-live="polite">{feedback}</p>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Déclaré</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-slate-950">{formatNumber(progress.declaredUnits)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Restant</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-slate-950">{formatNumber(progress.remainingUnits)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Progression</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-slate-950">{formatNumber(Math.round(progress.progressRatio * 100))} %</p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Chemin rapide</p>
              <p className="mt-1 text-sm font-bold text-slate-700">
                Charge complète · {formatNumber(run.cartonsPerLoad)} cartons · {formatNumber(fullLoadUnits)} unités
              </p>
            </div>
            <button
              type="button"
              disabled={!canDeclareFullLoad || isComplete}
              onClick={declareFullLoad}
              className="inline-flex min-h-14 min-w-48 items-center justify-center gap-2 rounded-2xl bg-teal-700 px-5 text-sm font-black text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isComplete ? <CheckCircle2 size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
              {isComplete ? 'Run terminé' : 'Déclarer une charge'}
            </button>
          </div>
          {!isComplete && !canDeclareFullLoad ? (
            <p className="mt-3 text-xs font-bold text-amber-800">
              Le restant est inférieur à une charge complète. Utilisez la déclaration partielle.
            </p>
          ) : null}
        </div>

        <form onSubmit={submitPartialDeclaration} className="mt-5 rounded-2xl border border-slate-200 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                {editingDeclarationId ? 'Correction' : 'Déclaration partielle'}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-600">Cartons complets + unités dans le carton partiel final.</p>
            </div>
            {editingDeclarationId ? (
              <button type="button" onClick={cancelCorrection} className="min-h-9 rounded-xl px-3 text-xs font-bold text-slate-500 hover:bg-slate-100">
                Annuler
              </button>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-black text-slate-600">Cartons complets</span>
              <input
                aria-label="Cartons complets à déclarer"
                inputMode="numeric"
                pattern="[0-9]*"
                value={draft.completeCartons}
                onChange={(event) => setDraft((current) => ({ ...current, completeCartons: event.target.value.replace(/\D/g, '') }))}
                className="min-h-12 w-full rounded-xl border border-slate-200 px-3 font-black tabular-nums outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-black text-slate-600">Unités du carton partiel</span>
              <input
                aria-label="Unités du carton partiel à déclarer"
                inputMode="numeric"
                pattern="[0-9]*"
                value={draft.partialCartonUnits}
                onChange={(event) => setDraft((current) => ({ ...current, partialCartonUnits: event.target.value.replace(/\D/g, '') }))}
                className="min-h-12 w-full rounded-xl border border-slate-200 px-3 font-black tabular-nums outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-sm font-bold text-slate-600">
              Aperçu : <span className="font-black tabular-nums text-slate-950">{preview.units === null ? '—' : formatNumber(preview.units)} unités</span>
            </p>
            <button
              type="submit"
              disabled={isComplete && !editingDeclarationId}
              className="min-h-11 rounded-xl border border-slate-900 bg-slate-950 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {editingDeclarationId ? 'Enregistrer la correction' : 'Déclarer ce volume'}
            </button>
          </div>
          {preview.error ? <p className="mt-2 text-xs font-bold text-rose-700">{preview.error}</p> : null}
        </form>

        {errorMessage ? (
          <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-900">
            <TriangleAlert size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
            {errorMessage}
          </div>
        ) : null}
        {feedback ? <p className="mt-4 text-sm font-bold text-emerald-800">{feedback}</p> : null}

        <div className="mt-6 border-t border-slate-200 pt-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-black text-slate-950">Historique du run</h3>
            <span className="text-xs font-bold text-slate-500">{run.declarations.length} déclaration{run.declarations.length > 1 ? 's' : ''}</span>
          </div>

          {run.declarations.length === 0 ? (
            <p className="mt-3 text-sm font-medium text-slate-500">Aucune production déclarée pour ce run.</p>
          ) : (
            <ul className="mt-3 space-y-2" aria-label="Historique des déclarations">
              {run.declarations.map((declaration, index) => {
                const units = getPackingDeclarationUnits(declaration, run.unitsPerCarton);
                return (
                  <li key={declaration.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-3">
                    <div>
                      <p className="text-sm font-black tabular-nums text-slate-950">#{index + 1} · {formatNumber(units)} unités</p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-500">
                        {formatNumber(declaration.completeCartons)} cartons + {formatNumber(declaration.partialCartonUnits)} unités partielles
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Corriger la déclaration ${index + 1}`}
                        onClick={() => beginCorrection(declaration.id)}
                        className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-950"
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Supprimer la déclaration ${index + 1}`}
                        onClick={() => removeDeclaration(declaration.id)}
                        className="grid h-10 w-10 place-items-center rounded-xl text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
