import { AlertTriangle, BookOpen, ChevronLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sgModules } from '../../data/shiftguideModules';
import { getModuleProgressSummary } from '../../hooks/useModuleProgress';

interface ModuleSummary {
  treatedCount: number;
  totalActions: number;
  isComplete: boolean;
}

function useModuleSummaries() {
  const [summaries, setSummaries] = useState<Record<string, ModuleSummary>>({});

  useEffect(() => {
    const result: Record<string, ModuleSummary> = {};
    for (const m of sgModules) {
      if (m.type === 'choice' || !m.actions) continue;
      result[m.id] = getModuleProgressSummary(m.id, m.actions.map((a) => a.id));
    }
    setSummaries(result);
  }, []);

  return summaries;
}

export function ShiftGuideHome() {
  const navigate = useNavigate();
  const summaries = useModuleSummaries();

  return (
    <div className="min-h-screen bg-[#0f172a] text-[#f1f5f9]">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-700 bg-[#0f172a]/95 px-4 py-3 backdrop-blur-sm">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
        >
          <ChevronLeft size={18} />
          Retour
        </button>
        <h1 className="text-base font-bold text-[#f1f5f9]">ShiftGuide</h1>
        <Link
          to="/shiftguide/urgences"
          className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-500"
        >
          <AlertTriangle size={14} />
          Urgences
        </Link>
      </header>

      {/* Module grid */}
      <main className="mx-auto max-w-2xl px-4 py-6">
        <p className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-500">
          Modules
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {sgModules.map((mod) => {
            const summary = summaries[mod.id];
            const isChoice = mod.type === 'choice';
            const statusClass = summary?.isComplete
              ? 'border-green-700'
              : summary && summary.treatedCount > 0
              ? 'border-blue-600'
              : 'border-transparent';

            return (
              <Link
                key={mod.id}
                to={`/shiftguide/module/${mod.id}`}
                className={`flex flex-col rounded-2xl border bg-[#1e293b] p-4 transition hover:bg-[#334155] active:scale-95 ${statusClass}`}
              >
                <span className="mb-2 text-3xl">{mod.icon}</span>
                <span className="mb-0.5 text-sm font-bold text-[#f1f5f9]">
                  {mod.title}
                </span>
                <span className="mb-3 text-xs leading-snug text-[#94a3b8]">
                  {mod.description}
                </span>

                {summary?.isComplete ? (
                  <span className="mt-auto text-xs font-bold text-green-400">
                    Terminé ✓
                  </span>
                ) : isChoice ? (
                  <span className="mt-auto text-xs text-slate-500">
                    Sélection requise
                  </span>
                ) : summary && summary.totalActions > 0 ? (
                  <div className="mt-auto">
                    <div className="mb-1 flex justify-between text-xs text-slate-400">
                      <span>
                        {summary.treatedCount} / {summary.totalActions}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
                      <div
                        className="h-full rounded-full bg-[#2563eb] transition-all"
                        style={{
                          width: `${(summary.treatedCount / summary.totalActions) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : null}
              </Link>
            );
          })}
        </div>

        {/* Bottom permanent accesses */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Link
            to="/shiftguide/lexique"
            className="flex items-center gap-3 rounded-2xl bg-[#1e293b] p-4 transition hover:bg-[#334155] active:scale-95"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-700 text-slate-300">
              <BookOpen size={20} />
            </span>
            <div>
              <p className="text-sm font-bold text-[#f1f5f9]">Lexique</p>
              <p className="text-xs text-slate-400">Sigles et définitions</p>
            </div>
          </Link>
          <Link
            to="/shiftguide/urgences"
            className="flex items-center gap-3 rounded-2xl border border-red-800 bg-[#1e293b] p-4 transition hover:bg-[#334155] active:scale-95"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-900/50 text-red-400">
              <AlertTriangle size={20} />
            </span>
            <div>
              <p className="text-sm font-bold text-red-400">Urgences</p>
              <p className="text-xs text-slate-400">Règles d'Or · Numéros</p>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
