import { ChevronLeft, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { lexiqueEntries } from '../../data/shiftguideModules';

export function LexiquePage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? lexiqueEntries.filter(
        (e) =>
          e.sigle.toLowerCase().includes(q) ||
          e.definition.toLowerCase().includes(q)
      )
    : lexiqueEntries;

  return (
    <div className="flex h-[100dvh] flex-col bg-[#0f172a] text-[#f1f5f9]">
      {/* Header */}
      <header className="flex-none flex items-center gap-2 border-b border-slate-800 px-3 py-3">
        <button
          onClick={() => navigate('/shiftguide/modules')}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="flex-1 text-base font-bold text-[#f1f5f9]">Lexique</h1>
      </header>

      {/* Search */}
      <div className="flex-none px-4 py-3">
        <div className="flex items-center gap-3 rounded-xl bg-[#1e293b] px-4 py-3">
          <Search size={16} className="shrink-0 text-slate-500" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Rechercher un sigle ou une définition…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[#f1f5f9] placeholder-slate-500 outline-none"
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">
            Aucun résultat pour « {query} »
          </p>
        ) : (
          <div className="divide-y divide-slate-800 rounded-xl bg-[#1e293b] overflow-hidden">
            {filtered.map((entry, i) => (
              <div key={i} className="flex items-baseline gap-3 px-4 py-3.5">
                <span className="w-16 shrink-0 text-sm font-bold text-[#3b82f6]">
                  {entry.sigle}
                </span>
                <span className="text-sm leading-snug text-[#94a3b8]">
                  {entry.definition}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
