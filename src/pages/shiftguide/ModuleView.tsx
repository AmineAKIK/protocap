import { AlertTriangle, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { SGAction, SGSubModule } from '../../data/shiftguideModules';
import { sgModules } from '../../data/shiftguideModules';
import { useModuleProgress } from '../../hooks/useModuleProgress';

// ─── Exit Warning Modal ──────────────────────────────────────────────────────

function ExitWarningModal({
  onStay,
  onLeave,
}: {
  onStay: () => void;
  onLeave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
      <div className="w-full max-w-sm rounded-2xl bg-[#1e293b] p-6 shadow-2xl">
        <p className="mb-2 text-base font-bold text-[#f1f5f9]">
          Module non terminé
        </p>
        <p className="mb-6 text-sm leading-relaxed text-[#94a3b8]">
          Ce module n'est pas terminé. Ta progression est sauvegardée. Tu
          pourras reprendre où tu en es.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onStay}
            className="flex-1 rounded-xl bg-[#3b82f6] py-3 text-sm font-bold text-white transition hover:bg-blue-400 active:scale-95"
          >
            Continuer
          </button>
          <button
            onClick={onLeave}
            className="flex-1 rounded-xl bg-slate-700 py-3 text-sm font-bold text-slate-200 transition hover:bg-slate-600 active:scale-95"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
      <div className="w-full max-w-sm rounded-2xl bg-[#1e293b] p-6 shadow-2xl">
        <p className="mb-2 text-base font-bold text-[#f1f5f9]">
          Réinitialiser ?
        </p>
        <p className="mb-6 text-sm leading-relaxed text-[#94a3b8]">
          Cela effacera toutes les validations de ce module.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl bg-slate-700 py-3 text-sm font-bold text-slate-200 transition hover:bg-slate-600 active:scale-95"
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
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10">
      <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-slate-500">
        Choisir le type
      </p>
      {subModules.map((sub) => (
        <button
          key={sub.id}
          onClick={() => onSelect(sub)}
          className="flex w-full max-w-sm flex-col rounded-2xl bg-[#1e293b] p-5 text-left transition hover:bg-[#334155] active:scale-95"
        >
          {sub.description && (
            <span className="mb-1 text-xs font-bold uppercase tracking-widest text-[#3b82f6]">
              {sub.description}
            </span>
          )}
          <span className="text-base font-bold text-[#f1f5f9]">
            {sub.title}
          </span>
          <span className="mt-1 text-xs text-slate-400">
            {sub.actions.length} action{sub.actions.length > 1 ? 's' : ''}
          </span>
        </button>
      ))}
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
      <div className="flex-none">
        <div className="h-1.5 bg-slate-800">
          <div
            className="h-full bg-[#2563eb] transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="px-4 py-1.5 text-xs text-slate-500">
          {treatedCount} / {totalActions} actions traitées
          {isComplete && (
            <span className="ml-2 font-bold text-green-400">· Terminé ✓</span>
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
              className={`relative flex min-w-full snap-start flex-col justify-center px-6 py-8 transition-colors ${
                isValidated
                  ? 'bg-[#14532d]/40'
                  : 'bg-[#0f172a]'
              }`}
            >
              {/* Status badge */}
              {isValidated && (
                <span className="absolute right-5 top-5 rounded-full bg-green-700 px-2.5 py-0.5 text-xs font-bold text-green-100">
                  ✓
                </span>
              )}
              {isNA && (
                <span className="absolute right-5 top-5 rounded-full bg-slate-600 px-2.5 py-0.5 text-xs font-bold text-slate-300 line-through">
                  N/A
                </span>
              )}

              {/* Step number */}
              <p className="mb-5 text-5xl font-black text-[#3b82f6] opacity-30">
                {String(i + 1).padStart(2, '0')}
              </p>

              {/* Action text */}
              <p
                className={`text-xl font-bold leading-snug sm:text-2xl ${
                  isNA ? 'text-slate-500 line-through' : 'text-[#f1f5f9]'
                }`}
              >
                {action.text}
              </p>

              {/* Note */}
              {action.note && (
                <p className="mt-4 text-sm leading-relaxed text-[#94a3b8]">
                  {action.note}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation arrows */}
      <div className="flex-none flex items-center justify-between px-4 py-2">
        <button
          onClick={goPrev}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-300 transition hover:bg-slate-700 active:scale-90"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-sm font-semibold text-slate-500">
          {currentIndex + 1} / {actions.length}
        </span>
        <button
          onClick={goNext}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-300 transition hover:bg-slate-700 active:scale-90"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex-none flex gap-3 px-4 pb-3">
        <button
          onClick={handleValidate}
          className={`flex h-14 flex-1 items-center justify-center rounded-xl text-base font-bold uppercase tracking-wide transition active:scale-95 ${
            currentStatus === 'validated'
              ? 'bg-green-600 text-white ring-2 ring-green-400'
              : 'bg-green-700 text-white hover:bg-green-600'
          }`}
        >
          ✓ VALIDER
        </button>
        <button
          onClick={handleNA}
          className={`flex h-14 flex-1 items-center justify-center rounded-xl text-base font-bold uppercase tracking-wide transition active:scale-95 ${
            currentStatus === 'na'
              ? 'bg-slate-500 text-white ring-2 ring-slate-300'
              : 'bg-[#475569] text-white hover:bg-slate-500'
          }`}
        >
          — N/A
        </button>
      </div>

      {/* Footer note */}
      {footerNote && (
        <p className="flex-none px-4 pb-1 text-center text-xs text-slate-600">
          {footerNote}
        </p>
      )}

      {/* Reset */}
      <div className="flex-none pb-4 pt-1 text-center">
        <button
          onClick={() => setShowReset(true)}
          className="text-xs text-slate-600 underline-offset-2 transition hover:text-slate-400 hover:underline"
        >
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

  const module = sgModules.find((m) => m.id === moduleId);

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
    navigate('/shiftguide/modules');
  };

  const handleBackToChoice = () => {
    setSelectedSub(null);
  };

  if (!module) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f172a] text-slate-400">
        Module introuvable
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-[#0f172a] text-[#f1f5f9]">
      {/* Header */}
      <header className="flex-none flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            onClick={handleClose}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
          >
            <X size={20} />
          </button>
          {isChoice && selectedSub && (
            <button
              onClick={handleBackToChoice}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
            >
              <ChevronLeft size={14} />
              Types
            </button>
          )}
        </div>

        <div className="flex flex-col items-center">
          <span className="text-sm font-bold text-[#f1f5f9]">
            {module.icon} {module.title}
          </span>
          {isChoice && selectedSub && (
            <span className="text-xs text-[#3b82f6]">{selectedSub.title}</span>
          )}
        </div>

        <Link
          to="/shiftguide/urgences"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-800/40 text-red-400 transition hover:bg-red-700 hover:text-red-200"
        >
          <AlertTriangle size={16} />
        </Link>
      </header>

      {/* Exit warning modal */}
      {showExitWarning && (
        <ExitWarningModal
          onStay={() => setShowExitWarning(false)}
          onLeave={() => navigate('/shiftguide/modules')}
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
