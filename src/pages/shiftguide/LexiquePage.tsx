import { ChevronLeft, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLexiqueEntries } from '../../data/shiftguideModules';

export function LexiquePage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const lexiqueEntries = getLexiqueEntries();
  const q = query.trim().toLowerCase();
  const filtered = q
    ? lexiqueEntries.filter(
        (entry) =>
          entry.sigle.toLowerCase().includes(q) ||
          entry.definition.toLowerCase().includes(q)
      )
    : lexiqueEntries;

  return (
    <div className="min-h-screen min-w-0 bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => navigate('/shiftguide')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
            aria-label="Retour à l'accueil ShiftGuide"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-950">Lexique</p>
            <p className="hidden truncate text-xs font-semibold text-slate-500 sm:block">
              Sigles et définitions utiles au guidage terrain
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full min-w-0 max-w-5xl px-4 py-5 sm:px-6">
        <label className="block rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition focus-within:border-teal-600 focus-within:ring-4 focus-within:ring-teal-600/10">
          <span className="sr-only">Rechercher dans le lexique</span>
          <span className="flex min-w-0 items-center gap-3">
            <Search size={16} className="shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Rechercher un sigle ou une définition…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none"
            />
          </span>
        </label>

        <div className="mt-5 pb-6">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm font-semibold text-slate-500">
              Aucun résultat pour « {query} »
            </p>
          ) : (
            <div className="panel min-w-0 overflow-hidden">
              {filtered.map((entry) => (
                <div
                  key={entry.sigle}
                  className="grid min-w-0 grid-cols-[4rem_minmax(0,1fr)] gap-3 border-b border-slate-100 px-4 py-3.5 last:border-b-0 sm:grid-cols-[5rem_minmax(0,1fr)]"
                >
                  <span className="break-normal text-sm font-black text-teal-700">{entry.sigle}</span>
                  <span className="min-w-0 break-normal text-sm leading-6 text-slate-600">{entry.definition}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
