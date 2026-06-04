import {
  AlertTriangle,
  BadgeCheck,
  BookOpen,
  Bot,
  ChevronLeft,
  ClipboardCheck,
  Clock3,
  Factory,
  Flag,
  GitBranch,
  History,
  IdCard,
  Layers3,
  ListChecks,
  MessageSquare,
  PackageCheck,
  PlayCircle,
  RotateCcw,
  ShieldCheck,
  Waves,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { SGModule } from '../../data/shiftguideModules';
import { sgModules } from '../../data/shiftguideModules';
import { getModuleProgressSummary } from '../../hooks/useModuleProgress';

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
  short: string;
  icon: LucideIcon;
  description: string;
  priority: string[];
  secondary: string[];
}

interface ModuleSummary {
  treatedCount: number;
  totalActions: number;
  isComplete: boolean;
}

const EMPTY_SUMMARY: ModuleSummary = { treatedCount: 0, totalActions: 0, isComplete: false };

const CONTEXTS: ContextDef[] = [
  {
    id: 'debut_equipe',
    label: "Début d'équipe",
    short: 'Poste',
    icon: Clock3,
    description: 'Badgeage, contrôles initiaux, préparation de la ligne.',
    priority: ['badgeage', 'debut_poste'],
    secondary: ['debut_oc'],
  },
  {
    id: 'debut_oc',
    label: 'Lancement OC',
    short: 'OC',
    icon: PlayCircle,
    description: 'Préparation, vide de ligne, contrôles et lancement.',
    priority: ['debut_oc'],
    secondary: ['debut_cuve', 'production'],
  },
  {
    id: 'production',
    label: 'En production',
    short: 'Prod',
    icon: Factory,
    description: 'Contrôles récurrents, réassort, arrêts et suivi qualité.',
    priority: ['production'],
    secondary: ['debut_cuve', 'fin_cuve', 'changement_oc', 'fin_oc'],
  },
  {
    id: 'evenement',
    label: 'Événement',
    short: 'Aléa',
    icon: GitBranch,
    description: 'Cuve, changement, fin de cuve ou transition sensible.',
    priority: ['debut_cuve', 'fin_cuve', 'changement_oc'],
    secondary: ['production', 'fin_oc'],
  },
  {
    id: 'cloture',
    label: 'Clôture',
    short: 'Clôture',
    icon: Flag,
    description: 'Fin d’OC, fin de poste, passage de consigne.',
    priority: ['fin_oc', 'fin_poste', 'badgeage'],
    secondary: ['production'],
  },
  {
    id: 'tri',
    label: 'Tri',
    short: 'Tri',
    icon: Layers3,
    description: 'Mission de tri, identification et restitution de zone.',
    priority: ['tri'],
    secondary: [],
  },
  {
    id: 'reprise',
    label: 'Reprise',
    short: 'Reprise',
    icon: History,
    description: 'Reprendre les modules commencés dans l’ordre utile.',
    priority: [],
    secondary: [],
  },
];

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

function getModuleIcon(module: SGModule): LucideIcon {
  return moduleIconMap[module.id] ?? ListChecks;
}

function getAllSummaries(): Record<string, ModuleSummary> {
  const result: Record<string, ModuleSummary> = {};

  for (const module of sgModules) {
    if (module.type === 'choice' && module.subModules) {
      const subSummaries = module.subModules.map((sub) =>
        getModuleProgressSummary(
          sub.id,
          sub.actions.map((action) => action.id)
        )
      );
      const treatedCount = subSummaries.reduce((sum, item) => sum + item.treatedCount, 0);
      const totalActions = subSummaries.reduce((sum, item) => sum + item.totalActions, 0);
      result[module.id] = {
        treatedCount,
        totalActions,
        isComplete: totalActions > 0 && treatedCount === totalActions,
      };
      continue;
    }

    if (!module.actions) {
      result[module.id] = EMPTY_SUMMARY;
      continue;
    }

    result[module.id] = getModuleProgressSummary(
      module.id,
      module.actions.map((action) => action.id)
    );
  }

  return result;
}

function getSummary(module: SGModule, summaries: Record<string, ModuleSummary>) {
  return summaries[module.id] ?? EMPTY_SUMMARY;
}

function getProgressPct(summary: ModuleSummary) {
  return summary.totalActions > 0 ? (summary.treatedCount / summary.totalActions) * 100 : 0;
}

function getModuleById(id: string): SGModule | undefined {
  return sgModules.find((module) => module.id === id);
}

function StatusPill({ summary, idle = 'Prêt' }: { summary: ModuleSummary; idle?: string }) {
  if (summary.isComplete) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-black uppercase text-emerald-800">
        <ShieldCheck size={11} />
        Terminé
      </span>
    );
  }

  if (summary.treatedCount > 0) {
    return (
      <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-black uppercase text-cyan-800">
        {Math.round(getProgressPct(summary))}%
      </span>
    );
  }

  return (
    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-black uppercase text-zinc-500">
      {idle}
    </span>
  );
}

function ProgressTrack({ summary, compact = false }: { summary: ModuleSummary; compact?: boolean }) {
  const pct = getProgressPct(summary);

  return (
    <div className={compact ? 'h-1 overflow-hidden rounded-full bg-zinc-200' : 'h-1.5 overflow-hidden rounded-full bg-zinc-200'}>
      <div
        className={`h-full rounded-full transition-all ${summary.isComplete ? 'bg-emerald-500' : 'bg-teal-600'}`}
        style={{ width: `${Math.max(pct, pct > 0 ? 6 : 0)}%` }}
      />
    </div>
  );
}

function PriorityModuleCard({
  module,
  summary,
  index,
}: {
  module: SGModule;
  summary: ModuleSummary;
  index: number;
}) {
  const Icon = getModuleIcon(module);

  return (
    <Link
      to={`/shiftguide/module/${module.id}`}
      className="group overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-lg"
    >
      <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-950 px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-teal-500/15 text-teal-200 ring-1 ring-teal-400/20">
            <Icon size={18} />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-teal-200">
              Priorité {String(index + 1).padStart(2, '0')}
            </p>
            <p className="text-base font-black">{module.title}</p>
          </div>
        </div>
        <StatusPill summary={summary} idle={index === 0 ? 'Now' : 'Suite'} />
      </div>

      <div className="p-4">
        <p className="min-h-10 text-sm leading-5 text-zinc-600">{module.description}</p>
        <div className="mt-5 grid grid-cols-[1fr_auto] items-end gap-4">
          <div>
            <p className="mb-2 text-xs font-bold text-zinc-500">
              {summary.treatedCount} / {summary.totalActions} actions
            </p>
            <ProgressTrack summary={summary} />
          </div>
          <span className="text-2xl font-black tabular-nums text-zinc-950">
            {Math.round(getProgressPct(summary))}%
          </span>
        </div>
      </div>
    </Link>
  );
}

function CompactModuleCard({ module, summary }: { module: SGModule; summary: ModuleSummary }) {
  const Icon = getModuleIcon(module);

  return (
    <Link
      to={`/shiftguide/module/${module.id}`}
      className="group rounded-xl border border-zinc-200 bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200 transition group-hover:bg-teal-50 group-hover:text-teal-700">
          <Icon size={17} />
        </span>
        <StatusPill summary={summary} />
      </div>
      <p className="mt-3 text-sm font-black text-zinc-950">{module.title}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">{module.description}</p>
      <div className="mt-3">
        <ProgressTrack summary={summary} compact />
      </div>
    </Link>
  );
}

function ModuleTable({ modules, summaries }: { modules: SGModule[]; summaries: Record<string, ModuleSummary> }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      {modules.map((module) => {
        const summary = getSummary(module, summaries);
        const Icon = getModuleIcon(module);

        return (
          <Link
            key={module.id}
            to={`/shiftguide/module/${module.id}`}
            className="grid grid-cols-[auto_minmax(0,1fr)_7rem] items-center gap-3 border-b border-zinc-100 px-4 py-3 transition last:border-b-0 hover:bg-zinc-50"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200">
              <Icon size={17} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-black text-zinc-950">{module.title}</p>
                <StatusPill summary={summary} />
              </div>
              <p className="mt-0.5 truncate text-xs font-medium text-zinc-500">{module.description}</p>
              <div className="mt-2">
                <ProgressTrack summary={summary} compact />
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-black tabular-nums text-zinc-950">
                {summary.treatedCount}/{summary.totalActions}
              </p>
              <p className="text-[11px] font-bold uppercase text-zinc-400">actions</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function ContextRail({
  activeId,
  onSelect,
}: {
  activeId: ContextId | null;
  onSelect: (id: ContextId) => void;
}) {
  return (
    <aside className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-white shadow-2xl shadow-zinc-950/10">
      <div className="border-b border-white/10 px-2 pb-4 pt-1">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-teal-300">LineOps</p>
        <p className="mt-1 text-xl font-black">ShiftGuide</p>
        <p className="mt-2 text-xs leading-5 text-zinc-400">
          Choisis le moment terrain, le cockpit réordonne le flux.
        </p>
      </div>

      <div className="mt-3 space-y-1.5">
        {CONTEXTS.map((ctx) => {
          const Icon = ctx.icon;
          const active = activeId === ctx.id;

          return (
            <button
              key={ctx.id}
              onClick={() => onSelect(ctx.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition ${
                active
                  ? 'bg-teal-500 text-zinc-950'
                  : 'text-zinc-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon size={16} />
              <span className="flex-1">{ctx.label}</span>
              <span className={`text-[10px] font-black uppercase ${active ? 'text-zinc-800' : 'text-zinc-500'}`}>
                {ctx.short}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function SectionHeader({ label, title, detail }: { label: string; title: string; detail?: string }) {
  return (
    <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">{label}</p>
        <h2 className="text-xl font-black tracking-tight text-zinc-950">{title}</h2>
      </div>
      {detail && <p className="text-sm font-semibold text-zinc-500">{detail}</p>}
    </div>
  );
}

function RepriseView({ summaries }: { summaries: Record<string, ModuleSummary> }) {
  const sorted = [...sgModules].sort((a, b) => {
    const sa = getSummary(a, summaries);
    const sb = getSummary(b, summaries);
    const scoreOf = (summary: ModuleSummary) => (summary.isComplete ? 2 : summary.treatedCount > 0 ? 0 : 1);
    return scoreOf(sa) - scoreOf(sb);
  });
  const inProgress = sorted.filter((module) => {
    const summary = getSummary(module, summaries);
    return summary.treatedCount > 0 && !summary.isComplete;
  });

  return (
    <div className="space-y-6">
      {inProgress.length > 0 && (
        <section>
          <SectionHeader label="Reprise" title="Modules à reprendre" detail="Les flux commencés remontent en premier." />
          <div className="grid gap-4 lg:grid-cols-2">
            {inProgress.map((module, index) => (
              <PriorityModuleCard
                key={module.id}
                module={module}
                summary={getSummary(module, summaries)}
                index={index}
              />
            ))}
          </div>
        </section>
      )}
      <section>
        <SectionHeader label="Bibliothèque" title="Tous les modules" />
        <ModuleTable modules={sorted} summaries={summaries} />
      </section>
    </div>
  );
}

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

  const priorityModules = ctx.priority.map(getModuleById).filter(Boolean) as SGModule[];
  const secondaryModules = ctx.secondary.map(getModuleById).filter(Boolean) as SGModule[];
  const usedIds = new Set([...ctx.priority, ...ctx.secondary]);
  const restModules = sgModules.filter((module) => !usedIds.has(module.id));

  return (
    <div className="space-y-6">
      <section>
        <SectionHeader label="Flux actif" title="Priorités terrain" detail={ctx.description} />
        <div className="grid gap-4 lg:grid-cols-2">
          {priorityModules.map((module, index) => (
            <PriorityModuleCard
              key={module.id}
              module={module}
              summary={getSummary(module, summaries)}
              index={index}
            />
          ))}
        </div>
      </section>

      {secondaryModules.length > 0 && (
        <section>
          <SectionHeader label="Suite logique" title="Modules liés" />
          <div className="grid gap-3 md:grid-cols-3">
            {secondaryModules.map((module) => (
              <CompactModuleCard
                key={module.id}
                module={module}
                summary={getSummary(module, summaries)}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHeader label="Bibliothèque" title="Tous les modules" />
        <ModuleTable modules={restModules} summaries={summaries} />
      </section>
    </div>
  );
}

export function ShiftGuideHome() {
  const navigate = useNavigate();
  const [contextId, setContextId] = useState<ContextId | null>(() => {
    return (localStorage.getItem('shiftguide_context') as ContextId) ?? 'debut_equipe';
  });
  const [summaries, setSummaries] = useState<Record<string, ModuleSummary>>({});

  useEffect(() => {
    setSummaries(getAllSummaries());
  }, []);

  const activeCtx = CONTEXTS.find((ctx) => ctx.id === contextId) ?? CONTEXTS[0];
  const totalActions = useMemo(
    () => Object.values(summaries).reduce((sum, summary) => sum + summary.totalActions, 0),
    [summaries]
  );
  const treatedActions = useMemo(
    () => Object.values(summaries).reduce((sum, summary) => sum + summary.treatedCount, 0),
    [summaries]
  );
  const completionPct = totalActions > 0 ? Math.round((treatedActions / totalActions) * 100) : 0;

  const handleContextSelect = (id: ContextId) => {
    setContextId(id);
    localStorage.setItem('shiftguide_context', id);
  };

  return (
    <div className="min-h-screen bg-[#f3f5f7] text-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
          >
            <ChevronLeft size={17} />
            Retour
          </button>

          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-950 text-teal-300 shadow-lg shadow-zinc-950/10">
              <ListChecks size={19} />
            </span>
            <div>
              <p className="text-sm font-black text-zinc-950">ShiftGuide</p>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">
                Command surface
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/shiftguide"
              className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-2 text-xs font-black text-zinc-700 transition hover:bg-zinc-200"
            >
              <MessageSquare size={13} />
              Céline
            </Link>
            <Link
              to="/shiftguide/urgences"
              className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-2 text-xs font-black text-red-700 ring-1 ring-red-100 transition hover:bg-red-100"
            >
              <AlertTriangle size={13} />
              Urgences
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[18rem_minmax(0,1fr)_19rem] lg:px-8">
        <ContextRail activeId={contextId} onSelect={handleContextSelect} />

        <section className="min-w-0 space-y-5">
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="border-b border-zinc-100 px-5 py-5 md:border-b-0 md:border-r">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-teal-700">
                  {activeCtx.label}
                </p>
                <h1 className="mt-1 text-3xl font-black tracking-tight text-zinc-950">
                  Cockpit conducteur
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
                  Une surface dense pour suivre ce qui compte maintenant, avec accès immédiat
                  aux modules, urgences et reprise.
                </p>
              </div>
              <div className="bg-zinc-950 p-5 text-white">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-teal-300">
                  Avancement global
                </p>
                <div className="mt-4 flex items-end justify-between gap-4">
                  <p className="text-5xl font-black tracking-tight">{completionPct}%</p>
                  <p className="pb-1 text-right text-xs font-bold text-zinc-400">
                    {treatedActions}/{totalActions}
                    <br />
                    actions traitées
                  </p>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-teal-400" style={{ width: `${completionPct}%` }} />
                </div>
              </div>
            </div>
          </div>

          <ContextView ctx={activeCtx} summaries={summaries} />
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">
              Accès rapide
            </p>
            <div className="mt-3 grid gap-2">
              <Link
                to="/shiftguide"
                className="flex items-center gap-3 rounded-xl bg-teal-50 px-3 py-3 text-sm font-black text-teal-800 ring-1 ring-teal-100 transition hover:bg-teal-100"
              >
                <Bot size={16} />
                Ouvrir Céline
              </Link>
              <Link
                to="/shiftguide/lexique"
                className="flex items-center gap-3 rounded-xl bg-zinc-100 px-3 py-3 text-sm font-black text-zinc-700 transition hover:bg-zinc-200"
              >
                <BookOpen size={16} />
                Lexique
              </Link>
              <button
                onClick={() => handleContextSelect('reprise')}
                className="flex items-center gap-3 rounded-xl bg-zinc-100 px-3 py-3 text-left text-sm font-black text-zinc-700 transition hover:bg-zinc-200"
              >
                <RotateCcw size={16} />
                Reprise
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">
              Principe
            </p>
            <p className="mt-2 text-sm font-bold leading-6 text-amber-950">
              Céline guide, l’opérateur décide. Les modules restent la source structurée.
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}
