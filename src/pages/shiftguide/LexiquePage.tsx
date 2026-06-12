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
    <div className="flex h-[100dvh] flex-col bg-slate-50 text-slate-950">
      <header className="flex-none border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <button
            onClick={() => navigate('/shiftguide/modules')}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <p className="text-sm font-bold text-slate-950">Lexique</p>
            <p className="hidden text-xs font-semibold text-slate-500 sm:block">
              Sigles et définitions utiles au guidage terrain
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-4 py-5 sm:px-6">
        <div className="flex-none rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition focus-within:border-teal-600 focus-within:ring-4 focus-within:ring-teal-600/10">
          <div className="flex items-center gap-3">
            <Search size={16} className="shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Rechercher un sigle ou une définition…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none"
            />
          </div>
        </div>

        <div className="mt-5 min-h-0 flex-1 overflow-y-auto pb-6">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm font-semibold text-slate-500">
              Aucun résultat pour « {query} »
            </p>
          ) : (
            <div className="panel overflow-hidden">
              {filtered.map((entry) => (
                <div
                  key={entry.sigle}
                  className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 border-b border-slate-100 px-4 py-3.5 last:border-b-0"
                >
                  <span className="text-sm font-black text-teal-700">{entry.sigle}</span>
                  <span className="text-sm leading-6 text-slate-600">{entry.definition}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
