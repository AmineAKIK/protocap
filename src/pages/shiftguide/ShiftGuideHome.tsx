import { AlertTriangle, BookOpen, ChevronLeft, HelpCircle, MessageSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { SGModule } from '../../data/shiftguideModules';
import { sgModules } from '../../data/shiftguideModules';
import { getModuleProgressSummary } from '../../hooks/useModuleProgress';

// ─── Types ────────────────────────────────────────────────────────────────────

type ContextId =
  | 'debut_equipe'
  | 'debut_oc'
  | 'production'
  | 'evenement'
  | 'cloture'
  | 'tri'
  | 'reprise';

interface ContextDef {
  id: ContextId;
  label: string;
  emoji: string;
  description: string;
  priority: string[];
  secondary: string[];
}

interface ModuleSummary {
  treatedCount: number;
  totalActions: number;
  isComplete: boolean;
}

// ─── Context definitions ──────────────────────────────────────────────────────

const CONTEXTS: ContextDef[] = [
  {
    id: 'debut_equipe',
    label: "Début d'équipe",
    emoji: '🌅',
    description: 'Tu arrives pour prendre ton poste',
    priority: ['badgeage', 'debut_poste'],
    secondary: ['debut_oc'],
  },
  {
    id: 'debut_oc',
    label: 'Lancement OC',
    emoji: '🚀',
    description: "Tu prépares un nouvel ordre de conditionnement",
    priority: ['debut_oc'],
    secondary: ['debut_cuve', 'production'],
  },
  {
    id: 'production',
    label: 'En production',
    emoji: '⚙️',
    description: 'La ligne tourne',
    priority: ['production'],
    secondary: ['debut_cuve', 'fin_cuve', 'changement_oc', 'fin_oc'],
  },
  {
    id: 'evenement',
    label: 'Événement',
    emoji: '⚡',
    description: 'Changement OC, nouvelle cuve ou arrêt',
    priority: ['debut_cuve', 'fin_cuve', 'changement_oc'],
    secondary: ['production', 'fin_oc'],
  },
  {
    id: 'cloture',
    label: 'Clôture',
    emoji: '🏁',
    description: "Fin d'OC ou fin de poste",
    priority: ['fin_oc', 'fin_poste', 'badgeage'],
    secondary: ['production'],
  },
  {
    id: 'tri',
    label: 'Tri',
    emoji: '🗂️',
    description: 'Tu es affecté à une mission de tri',
    priority: ['tri'],
    secondary: [],
  },
  {
    id: 'reprise',
    label: 'Reprise',
    emoji: '🔄',
    description: 'Tu reprends un poste déjà démarré',
    priority: [],
    secondary: [],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAllSummaries(): Record<string, ModuleSummary> {
  const result: Record<string, ModuleSummary> = {};
  for (const m of sgModules) {
    if (m.type === 'choice' || !m.actions) {
      result[m.id] = { treatedCount: 0, totalActions: 0, isComplete: false };
    } else {
      result[m.id] = getModuleProgressSummary(
        m.id,
        m.actions.map((a) => a.id)
      );
    }
  }
  return result;
}

function getModuleById(id: string): SGModule | undefined {
  return sgModules.find((m) => m.id === id);
}

// ─── Priority card (large) ────────────────────────────────────────────────────

function PriorityCard({
  module,
  summary,
  index,
}: {
  module: SGModule;
  summary: ModuleSummary;
  index: number;
}) {
  const isChoice = module.type === 'choice';
  const pct =
    summary.totalActions > 0
      ? (summary.treatedCount / summary.totalActions) * 100
      : 0;

  return (
    <Link
      to={`/shiftguide/module/${module.id}`}
      className={`block rounded-2xl border p-5 transition active:scale-[0.98] ${
        summary.isComplete
          ? 'border-green-700/60 bg-green-900/20'
          : summary.treatedCount > 0
          ? 'border-blue-600/60 bg-blue-900/20'
          : 'border-[#3b82f6]/30 bg-[#1e293b] hover:bg-[#283548]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-3xl leading-none">{module.icon}</span>
        {summary.isComplete ? (
          <span className="rounded-full bg-green-800 px-2.5 py-0.5 text-xs font-bold text-green-200">
            Terminé ✓
          </span>
        ) : summary.treatedCount > 0 ? (
          <span className="rounded-full bg-blue-800/60 px-2.5 py-0.5 text-xs font-bold text-blue-200">
            En cours
          </span>
        ) : (
          <span className="rounded-full bg-[#3b82f6]/20 px-2.5 py-0.5 text-xs font-bold text-[#3b82f6]">
            {index === 0 ? 'Maintenant' : `Étape ${index + 1}`}
          </span>
        )}
      </div>

      <p className="mt-3 text-lg font-bold text-[#f1f5f9]">{module.title}</p>
      <p className="mt-0.5 text-xs leading-snug text-[#94a3b8]">
        {module.description}
      </p>

      {!isChoice && summary.totalActions > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-xs text-slate-500">
            <span>
              {summary.treatedCount} / {summary.totalActions} actions traitées
            </span>
            {!summary.isComplete && summary.treatedCount > 0 && (
              <span>{Math.round(pct)}%</span>
            )}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
            <div
              className={`h-full rounded-full transition-all ${
                summary.isComplete ? 'bg-green-500' : 'bg-[#2563eb]'
              }`}
              style={{ width: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }}
            />
          </div>
        </div>
      )}

      {isChoice && (
        <p className="mt-4 text-xs text-slate-600">
          Sélection du type à l'ouverture
        </p>
      )}
    </Link>
  );
}

// ─── Secondary card (medium) ──────────────────────────────────────────────────

function SecondaryCard({
  module,
  summary,
}: {
  module: SGModule;
  summary: ModuleSummary;
}) {
  const isChoice = module.type === 'choice';
  const pct =
    summary.totalActions > 0
      ? (summary.treatedCount / summary.totalActions) * 100
      : 0;

  return (
    <Link
      to={`/shiftguide/module/${module.id}`}
      className={`flex flex-col rounded-xl border p-3.5 transition active:scale-95 ${
        summary.isComplete
          ? 'border-green-800/40 bg-green-900/10'
          : summary.treatedCount > 0
          ? 'border-blue-800/40 bg-blue-900/10'
          : 'border-transparent bg-[#1e293b] hover:bg-[#283548]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xl leading-none">{module.icon}</span>
        {summary.isComplete && (
          <span className="text-xs font-bold text-green-400">✓</span>
        )}
        {!summary.isComplete && summary.treatedCount > 0 && (
          <span className="text-xs text-blue-400">{Math.round(pct)}%</span>
        )}
      </div>
      <p className="mt-2 text-sm font-bold text-[#f1f5f9]">{module.title}</p>
      {!isChoice && summary.totalActions > 0 && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-700">
          <div
            className={`h-full rounded-full ${
              summary.isComplete ? 'bg-green-500' : 'bg-[#2563eb]'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </Link>
  );
}

// ─── Mini card (small, for "tous les modules") ────────────────────────────────

function MiniCard({
  module,
  summary,
}: {
  module: SGModule;
  summary: ModuleSummary;
}) {
  return (
    <Link
      to={`/shiftguide/module/${module.id}`}
      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition active:scale-95 ${
        summary.isComplete
          ? 'border-green-800/30 bg-[#1e293b]'
          : 'border-transparent bg-[#1e293b] hover:bg-[#283548]'
      }`}
    >
      <span className="text-base leading-none">{module.icon}</span>
      <span
        className={`flex-1 text-sm font-medium ${
          summary.isComplete ? 'text-slate-500' : 'text-[#94a3b8]'
        }`}
      >
        {module.title}
      </span>
      {summary.isComplete && (
        <span className="text-xs font-bold text-green-600">✓</span>
      )}
      {!summary.isComplete && summary.treatedCount > 0 && (
        <span className="text-xs text-blue-600">
          {summary.treatedCount}/{summary.totalActions}
        </span>
      )}
    </Link>
  );
}

// ─── Reprise view (all modules sorted by progress) ────────────────────────────

function RepriseView({ summaries }: { summaries: Record<string, ModuleSummary> }) {
  const sorted = [...sgModules].sort((a, b) => {
    const sa = summaries[a.id];
    const sb = summaries[b.id];
    // In-progress first, then not started, then complete
    const scoreOf = (s: ModuleSummary) =>
      s.isComplete ? 2 : s.treatedCount > 0 ? 0 : 1;
    return scoreOf(sa) - scoreOf(sb);
  });

  const inProgress = sorted.filter(
    (m) => summaries[m.id].treatedCount > 0 && !summaries[m.id].isComplete
  );
  const notStarted = sorted.filter((m) => summaries[m.id].treatedCount === 0);
  const done = sorted.filter((m) => summaries[m.id].isComplete);

  return (
    <div className="space-y-6 px-4 pb-8">
      {inProgress.length > 0 && (
        <section>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-blue-500">
            En cours
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {inProgress.map((m) => (
              <PriorityCard
                key={m.id}
                module={m}
                summary={summaries[m.id]}
                index={0}
              />
            ))}
          </div>
        </section>
      )}

      {notStarted.length > 0 && (
        <section>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
            Pas encore démarré
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {notStarted.map((m) => (
              <SecondaryCard key={m.id} module={m} summary={summaries[m.id]} />
            ))}
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
            Terminés
          </p>
          <div className="flex flex-col gap-1.5">
            {done.map((m) => (
              <MiniCard key={m.id} module={m} summary={summaries[m.id]} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Context picker (initial screen) ─────────────────────────────────────────

function ContextPicker({ onSelect }: { onSelect: (id: ContextId) => void }) {
  return (
    <div className="px-4 pb-8">
      <div className="mb-6 rounded-2xl border border-slate-700 bg-[#1e293b] p-5">
        <p className="flex items-center gap-2 text-sm font-bold text-[#f1f5f9]">
          <HelpCircle size={16} className="text-[#3b82f6]" />
          Où en es-tu ?
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[#94a3b8]">
          Déclare ta situation. L'application met en avant ce qui est pertinent
          maintenant — tout reste accessible à tout moment.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CONTEXTS.map((ctx) => (
          <button
            key={ctx.id}
            onClick={() => onSelect(ctx.id)}
            className="flex items-start gap-4 rounded-2xl bg-[#1e293b] p-4 text-left transition hover:bg-[#283548] active:scale-[0.98]"
          >
            <span className="mt-0.5 text-2xl leading-none">{ctx.emoji}</span>
            <div>
              <p className="text-sm font-bold text-[#f1f5f9]">{ctx.label}</p>
              <p className="mt-0.5 text-xs leading-snug text-[#94a3b8]">
                {ctx.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main context view ────────────────────────────────────────────────────────

function ContextView({
  ctx,
  summaries,
}: {
  ctx: ContextDef;
  summaries: Record<string, ModuleSummary>;
}) {
  if (ctx.id === 'reprise') {
    return <RepriseView summaries={summaries} />;
  }

  const priorityModules = ctx.priority
    .map(getModuleById)
    .filter(Boolean) as SGModule[];

  const secondaryModules = ctx.secondary
    .map(getModuleById)
    .filter(Boolean) as SGModule[];

  const usedIds = new Set([...ctx.priority, ...ctx.secondary]);
  const restModules = sgModules.filter((m) => !usedIds.has(m.id));

  return (
    <div className="space-y-6 px-4 pb-8">
      {/* Priority — Maintenant */}
      {priorityModules.length > 0 && (
        <section>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#3b82f6]">
            Maintenant
          </p>
          <div
            className={`grid gap-3 ${
              priorityModules.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'
            }`}
          >
            {priorityModules.map((m, i) => (
              <PriorityCard
                key={m.id}
                module={m}
                summary={summaries[m.id] ?? { treatedCount: 0, totalActions: 0, isComplete: false }}
                index={i}
              />
            ))}
          </div>
        </section>
      )}

      {/* Secondary — Disponible */}
      {secondaryModules.length > 0 && (
        <section>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
            Disponible
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {secondaryModules.map((m) => (
              <SecondaryCard
                key={m.id}
                module={m}
                summary={summaries[m.id] ?? { treatedCount: 0, totalActions: 0, isComplete: false }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Rest — Tous les modules */}
      {restModules.length > 0 && (
        <section>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-700">
            Tous les modules
          </p>
          <div className="flex flex-col gap-1.5">
            {restModules.map((m) => (
              <MiniCard
                key={m.id}
                module={m}
                summary={summaries[m.id] ?? { treatedCount: 0, totalActions: 0, isComplete: false }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── ShiftGuideHome ───────────────────────────────────────────────────────────

export function ShiftGuideHome() {
  const navigate = useNavigate();
  const [contextId, setContextId] = useState<ContextId | null>(() => {
    return (localStorage.getItem('shiftguide_context') as ContextId) ?? null;
  });
  const [summaries, setSummaries] = useState<Record<string, ModuleSummary>>({});

  useEffect(() => {
    setSummaries(getAllSummaries());
  }, []);

  const activeCtx = CONTEXTS.find((c) => c.id === contextId) ?? null;

  const handleContextSelect = (id: ContextId) => {
    setContextId(id);
    localStorage.setItem('shiftguide_context', id);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-[#f1f5f9]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-[#0f172a]/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
          >
            <ChevronLeft size={18} />
            Toolkit
          </button>
          <span className="text-sm font-bold text-[#f1f5f9]">ShiftGuide</span>
          <div className="flex items-center gap-2">
            <Link
              to="/shiftguide"
              className="flex items-center gap-1.5 rounded-lg bg-[#3b82f6]/20 px-3 py-1.5 text-xs font-bold text-[#3b82f6] transition hover:bg-[#3b82f6]/30"
            >
              <MessageSquare size={13} />
              Céline
            </Link>
            <Link
              to="/shiftguide/urgences"
              className="flex items-center gap-1.5 rounded-lg bg-red-700/80 px-3 py-1.5 text-xs font-bold text-red-100 transition hover:bg-red-600"
            >
              <AlertTriangle size={13} />
              Urgences
            </Link>
          </div>
        </div>

        {/* Context selector chips */}
        <div
          className="flex gap-2 overflow-x-auto px-4 pb-3 pt-1"
          style={{ scrollbarWidth: 'none' }}
        >
          {CONTEXTS.map((ctx) => (
            <button
              key={ctx.id}
              onClick={() => handleContextSelect(ctx.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                contextId === ctx.id
                  ? 'bg-[#3b82f6] text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              <span>{ctx.emoji}</span>
              {ctx.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main content */}
      <main className="pt-4">
        {!activeCtx ? (
          <ContextPicker onSelect={handleContextSelect} />
        ) : (
          <ContextView ctx={activeCtx} summaries={summaries} />
        )}

        {/* Quick access */}
        <div className="mx-4 mb-8 mt-4 flex gap-2">
          <Link
            to="/shiftguide/lexique"
            className="flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-400 transition hover:bg-slate-700 hover:text-slate-200"
          >
            <BookOpen size={13} />
            Lexique
          </Link>
          <Link
            to="/shiftguide/urgences"
            className="flex items-center gap-1.5 rounded-full bg-red-900/30 px-3 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-900/50"
          >
            <AlertTriangle size={13} />
            Urgences
          </Link>
        </div>
      </main>
    </div>
  );
}
