import {
  AlertTriangle,
  BadgeCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Factory,
  Flag,
  GitBranch,
  IdCard,
  Layers3,
  ListChecks,
  PackageCheck,
  PlayCircle,
  RotateCcw,
  Waves,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { SGAction, SGSubModule } from '../../data/shiftguideModules';
import { getSgModules } from '../../data/shiftguideModules';
import { useModuleProgress } from '../../hooks/useModuleProgress';

const moduleIconMap: Record<string, LucideIcon> = {
  badgeage: IdCard,
  debut_poste: ClipboardCheck,
  fin_poste: Flag,
  debut_oc: PlayCircle,
  fin_oc: BadgeCheck,
  changement_oc: GitBranch,
  debut_cuve: Waves,
  fin_cuve: PackageCheck,
  production: Factory,
  tri: Layers3,
};

function getModuleIcon(moduleId: string | undefined): LucideIcon {
  if (!moduleId) return ListChecks;
  return moduleIconMap[moduleId] ?? ListChecks;
}

// ─── Exit Warning Modal ──────────────────────────────────────────────────────

function ExitWarningModal({
  onStay,
  onLeave,
}: {
  onStay: () => void;
  onLeave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-6 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
        <p className="mb-2 text-base font-bold text-slate-950">
          Module non terminé
        </p>
        <p className="mb-6 text-sm leading-relaxed text-slate-500">
          Ce module n'est pas terminé. Ta progression est sauvegardée. Tu
          pourras reprendre où tu en es.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onStay}
            className="flex-1 rounded-xl bg-teal-700 py-3 text-sm font-bold text-white transition hover:bg-teal-600 active:scale-95"
          >
            Continuer
          </button>
          <button
            onClick={onLeave}
            className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-200 active:scale-95"
          >
            Quitter
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reset Confirm Modal ─────────────────────────────────────────────────────

function ResetConfirmModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-6 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
        <p className="mb-2 text-base font-bold text-slate-950">
          Réinitialiser ?
        </p>
        <p className="mb-6 text-sm leading-relaxed text-slate-500">
          Cela effacera toutes les validations de ce module.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-200 active:scale-95"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-red-700 py-3 text-sm font-bold text-white transition hover:bg-red-600 active:scale-95"
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Choice Screen ───────────────────────────────────────────────────────────

function ChoiceScreen({
  subModules,
  onSelect,
}: {
  subModules: SGSubModule[];
  onSelect: (sub: SGSubModule) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-5 px-4 py-8 sm:px-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Choisir le type</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-950">Quel scénario veux-tu suivre ?</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Le choix ouvre uniquement les actions adaptées au contexte terrain.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {subModules.map((sub) => (
          <button
            key={sub.id}
            onClick={() => onSelect(sub)}
            className="panel group flex min-h-36 flex-col p-5 text-left transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md active:scale-[0.99]"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-100">
              <GitBranch size={19} />
            </span>
            {sub.description && (
              <span className="mt-4 text-xs font-bold uppercase tracking-widest text-teal-700">
                {sub.description}
              </span>
            )}
            <span className="mt-1 text-base font-bold text-slate-950 transition group-hover:text-teal-700">
              {sub.title}
            </span>
            <span className="mt-2 text-xs font-semibold text-slate-500">
              {sub.actions.length} action{sub.actions.length > 1 ? 's' : ''}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Action Carousel ─────────────────────────────────────────────────────────

interface ActionCarouselProps {
  moduleId: string;
  actions: SGAction[];
  footerNote?: string;
}

function ActionCarousel({ moduleId, actions, footerNote }: ActionCarouselProps) {
  const actionIds = actions.map((a) => a.id);
  const { progress, setAction, resetModule, treatedCount, totalActions, isComplete } =
    useModuleProgress(moduleId, actionIds);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showReset, setShowReset] = useState(false);

  const currentAction = actions[currentIndex];
  const currentStatus = progress[currentAction?.id] ?? 'pending';

  const scrollTo = useCallback((index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });
    setCurrentIndex(index);
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== currentIndex) setCurrentIndex(idx);
  }, [currentIndex]);

  const goNext = () => {
    const next = (currentIndex + 1) % actions.length;
    scrollTo(next);
  };

  const goPrev = () => {
    const prev = (currentIndex - 1 + actions.length) % actions.length;
    scrollTo(prev);
  };

  const handleValidate = () => setAction(currentAction.id, 'validated');
  const handleNA = () => setAction(currentAction.id, 'na');

  const handleReset = () => {
    resetModule();
    setShowReset(false);
    scrollTo(0);
  };

  const progressPct = totalActions > 0 ? (treatedCount / totalActions) * 100 : 0;

  return (
    <>
      {showReset && (
        <ResetConfirmModal
          onCancel={() => setShowReset(false)}
          onConfirm={handleReset}
        />
      )}

      {/* Progress bar */}
      <div className="flex-none border-b border-slate-200 bg-white">
        <div className="h-1.5 bg-slate-100">
          <div
            className="h-full bg-teal-700 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="mx-auto max-w-5xl px-4 py-2 text-xs font-semibold text-slate-500 sm:px-6">
          {treatedCount} / {totalActions} actions traitées
          {isComplete && (
            <span className="ml-2 font-bold text-emerald-700">Terminé</span>
          )}
        </p>
      </div>

      {/* Carousel */}
      <div
        ref={scrollRef}
        className="flex flex-1 snap-x snap-mandatory overflow-x-auto"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
        onScroll={handleScroll}
      >
        {actions.map((action, i) => {
          const status = progress[action.id] ?? 'pending';
          const isValidated = status === 'validated';
          const isNA = status === 'na';

          return (
            <div
              key={action.id}
              className="relative flex min-w-full snap-start flex-col justify-center bg-slate-50 px-4 py-8 sm:px-6"
            >
              <article
                className={`panel mx-auto flex w-full max-w-3xl flex-col p-6 shadow-sm transition sm:p-8 ${
                  isValidated
                    ? 'border-emerald-300 ring-1 ring-emerald-100'
                    : isNA
                    ? 'border-slate-300 opacity-80'
                    : ''
                }`}
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                      Action {String(i + 1).padStart(2, '0')}
                    </p>
                    <p className="mt-3 text-xl font-bold leading-snug text-slate-950 sm:text-2xl">
                      <span className={isNA ? 'text-slate-400 line-through' : ''}>
                        {action.text}
                      </span>
                    </p>
                  </div>
                  {isValidated && (
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-white ring-1 ring-emerald-200 sm:inline-flex sm:w-auto sm:gap-1.5 sm:px-2.5 sm:text-xs sm:font-bold sm:text-emerald-700 sm:bg-emerald-50"
                      title="Validé"
                    >
                      <Check size={14} />
                      <span className="hidden sm:inline">Validé</span>
                    </span>
                  )}
                  {isNA && (
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500 ring-1 ring-slate-200">
                      N/A
                    </span>
                  )}
                </div>

                {action.note && (
                  <p className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-500 ring-1 ring-slate-100">
                    {action.note}
                  </p>
                )}
              </article>
            </div>
          );
        })}
      </div>

      {/* Navigation arrows */}
      <div className="mx-auto flex w-full max-w-5xl flex-none items-center justify-between px-4 py-2 sm:px-6">
        <button
          onClick={goPrev}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-950 active:scale-95"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-sm font-bold text-slate-500">
          {currentIndex + 1} / {actions.length}
        </span>
        <button
          onClick={goNext}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-950 active:scale-95"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Action buttons */}
      <div className="mx-auto flex w-full max-w-5xl flex-none gap-3 px-4 pb-3 sm:px-6">
        <button
          onClick={handleValidate}
          className={`flex h-14 flex-1 items-center justify-center gap-2 rounded-xl text-base font-bold uppercase tracking-wide transition active:scale-95 ${
            currentStatus === 'validated'
              ? 'bg-emerald-600 text-white ring-2 ring-emerald-200'
              : 'bg-teal-700 text-white hover:bg-teal-600'
          }`}
        >
          <Check size={17} />
          Valider
        </button>
        <button
          onClick={handleNA}
          className={`flex h-14 flex-1 items-center justify-center rounded-xl text-base font-bold uppercase tracking-wide transition active:scale-95 ${
            currentStatus === 'na'
              ? 'bg-slate-700 text-white ring-2 ring-slate-300'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          N/A
        </button>
      </div>

      {/* Footer note */}
      {footerNote && (
        <p className="flex-none px-4 pb-1 text-center text-xs font-semibold text-slate-500">
          {footerNote}
        </p>
      )}

      {/* Reset */}
      <div className="flex-none pb-4 pt-1 text-center">
        <button
          onClick={() => setShowReset(true)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 underline-offset-2 transition hover:text-slate-700 hover:underline"
        >
          <RotateCcw size={12} />
          Réinitialiser la progression
        </button>
      </div>
    </>
  );
}

// ─── ModuleView ───────────────────────────────────────────────────────────────

export function ModuleView() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();

  const module = getSgModules().find((m) => m.id === moduleId);

  const [selectedSub, setSelectedSub] = useState<SGSubModule | null>(null);
  const [showExitWarning, setShowExitWarning] = useState(false);

  const isChoice = module?.type === 'choice';
  const activeActions: SGAction[] = isChoice
    ? (selectedSub?.actions ?? [])
    : (module?.actions ?? []);
  const activeModuleId = isChoice
    ? (selectedSub?.id ?? module?.id ?? '')
    : (module?.id ?? '');
  const activeFooterNote = isChoice ? selectedSub?.footerNote : module?.footerNote;

  // We need progress count for exit warning, but only after actions are loaded
  const actionIds = activeActions.map((a) => a.id);
  const progressKey = `shiftguide_module_${activeModuleId}`;

  const checkIsComplete = useCallback(() => {
    if (actionIds.length === 0) return true;
    try {
      const saved = localStorage.getItem(progressKey);
      if (!saved) return false;
      const { actions } = JSON.parse(saved);
      const treated = actionIds.filter(
        (id) => actions[id] === 'validated' || actions[id] === 'na'
      ).length;
      return treated === actionIds.length;
    } catch {
      return false;
    }
  }, [actionIds, progressKey]);

  const handleClose = () => {
    if (!isChoice || selectedSub) {
      if (actionIds.length > 0 && !checkIsComplete()) {
        setShowExitWarning(true);
        return;
      }
    }
    navigate(-1);
  };

  const handleBackToChoice = () => {
    setSelectedSub(null);
  };

  if (!module) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        Module introuvable
      </div>
    );
  }

  const ModuleIcon = getModuleIcon(module.id);

  return (
    <div className="flex h-[100dvh] flex-col bg-slate-50 text-slate-950">
      {/* Header */}
      <header className="flex-none border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto grid h-14 max-w-5xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            onClick={handleClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
          >
            <X size={20} />
          </button>
          {isChoice && selectedSub && (
            <button
              onClick={handleBackToChoice}
              className="hidden items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 min-[380px]:flex"
            >
              <ChevronLeft size={14} />
              Types
            </button>
          )}
        </div>

        <div className="flex min-w-0 flex-col items-center">
          <span className="flex min-w-0 max-w-full items-center gap-2 text-sm font-bold text-slate-950">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-teal-700 text-white">
              <ModuleIcon size={16} />
            </span>
            <span className="truncate">{module.title}</span>
          </span>
          {isChoice && selectedSub && (
            <span className="max-w-full truncate text-xs font-semibold text-teal-700">{selectedSub.title}</span>
          )}
        </div>

        <Link
          to="/shiftguide/urgences"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-700 ring-1 ring-red-100 transition hover:bg-red-100"
        >
          <AlertTriangle size={16} />
        </Link>
        </div>
      </header>

      {/* Exit warning modal */}
      {showExitWarning && (
        <ExitWarningModal
          onStay={() => setShowExitWarning(false)}
          onLeave={() => navigate(-1)}
        />
      )}

      {/* Content */}
      {isChoice && !selectedSub ? (
        <ChoiceScreen
          subModules={module.subModules ?? []}
          onSelect={setSelectedSub}
        />
      ) : (
        <ActionCarousel
          key={activeModuleId}
          moduleId={activeModuleId}
          actions={activeActions}
          footerNote={activeFooterNote}
        />
      )}
    </div>
  );
}
