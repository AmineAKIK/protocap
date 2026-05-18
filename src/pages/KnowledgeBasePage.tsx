import { Bookmark, BookmarkCheck, Clock, FileText, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { knowledgeCategories, procedureDocs } from '../data/knowledgeData';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { Criticality, Difficulty } from '../types/knowledge';
import { formatDate } from '../utils/date';

const criticalityTone: Record<Criticality, 'slate' | 'amber' | 'red'> = {
  standard: 'slate',
  important: 'amber',
  critical: 'red'
};

const difficultyLabel: Record<Difficulty, string> = {
  simple: 'Simple',
  intermediate: 'Intermédiaire',
  advanced: 'Avancé'
};

const criticalityLabel: Record<Criticality, string> = {
  standard: 'Standard',
  important: 'Important',
  critical: 'Critique'
};

export function KnowledgeBasePage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Toutes');
  const [selectedId, setSelectedId] = useState(procedureDocs[0].id);
  const [favorites, setFavorites] = useLocalStorage<string[]>('lineops.knowledge.favorites', []);

  const filteredDocs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return procedureDocs.filter((doc) => {
      const inCategory = category === 'Toutes' || doc.category === category;
      const inSearch =
        !normalized ||
        [doc.title, doc.summary, doc.category, ...doc.tags].some((value) => value.toLowerCase().includes(normalized));
      return inCategory && inSearch;
    });
  }, [category, query]);

  const selectedDoc = procedureDocs.find((doc) => doc.id === selectedId) ?? filteredDocs[0] ?? procedureDocs[0];

  function toggleFavorite(id: string) {
    setFavorites((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="label">Prototype 3</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Knowledge Base</h1>
        <p className="mt-2 max-w-3xl text-slate-600">Base documentaire plus claire, plus rapide, plus accessible.</p>
      </div>

      <div className="mb-5 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-900">
        Cette maquette illustre comment une base documentaire plus moderne peut améliorer l’accès à l’information terrain grâce à une navigation plus claire, une recherche plus rapide et des contenus structurés.
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="panel p-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              className="field pl-10"
              placeholder="Rechercher une procédure, un tag, une catégorie..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {knowledgeCategories.map((item) => (
              <button
                key={item}
                className={`shrink-0 rounded-full px-3 py-2 text-sm font-semibold transition ${
                  category === item ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-3">
            {filteredDocs.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => setSelectedId(doc.id)}
                className={`rounded-lg border p-4 text-left transition hover:border-teal-300 hover:bg-teal-50/40 ${
                  selectedDoc.id === doc.id ? 'border-teal-500 bg-teal-50/60' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-slate-950">{doc.title}</h2>
                    <p className="mt-1 text-sm text-slate-600">{doc.summary}</p>
                  </div>
                  {favorites.includes(doc.id) ? <BookmarkCheck className="shrink-0 text-teal-700" size={18} /> : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone="teal">{doc.category}</Badge>
                  <Badge tone={criticalityTone[doc.criticality]}>{criticalityLabel[doc.criticality]}</Badge>
                  <Badge>{doc.estimatedMinutes} min</Badge>
                </div>
              </button>
            ))}
            {filteredDocs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                Aucune fiche ne correspond à cette recherche fictive.
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-900 p-5 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-100">{selectedDoc.category}</p>
                <h2 className="mt-2 text-2xl font-bold">{selectedDoc.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-200">{selectedDoc.summary}</p>
              </div>
              <button
                className="rounded-lg bg-white/10 p-2 text-white transition hover:bg-white/20"
                onClick={() => toggleFavorite(selectedDoc.id)}
                aria-label="Favori"
              >
                {favorites.includes(selectedDoc.id) ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone={criticalityTone[selectedDoc.criticality]}>{criticalityLabel[selectedDoc.criticality]}</Badge>
              <Badge tone="blue">{difficultyLabel[selectedDoc.difficulty]}</Badge>
              <Badge tone="slate"><Clock size={13} className="mr-1" />{selectedDoc.estimatedMinutes} min</Badge>
            </div>
          </div>

          <div className="grid gap-5 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-4 text-sm">
                <p className="label">Auteur / validateur</p>
                <p className="mt-2 font-semibold text-slate-800">{selectedDoc.author}</p>
                <p className="text-slate-500">Validé par {selectedDoc.validator}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4 text-sm">
                <p className="label">Mise à jour</p>
                <p className="mt-2 font-semibold text-slate-800">{formatDate(selectedDoc.updatedAt)}</p>
                <p className="text-slate-500">Version de démonstration</p>
              </div>
            </div>

            <div>
              <h3 className="flex items-center gap-2 font-bold text-slate-950"><FileText size={18} />Étapes</h3>
              <ol className="mt-3 space-y-3">
                {selectedDoc.steps.map((step, index) => (
                  <li key={step} className="flex gap-3 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-teal-700 text-xs font-bold text-white">{index + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <h3 className="font-bold text-slate-950">Points de vigilance</h3>
              <div className="mt-3 grid gap-2">
                {selectedDoc.watchPoints.map((point) => (
                  <div key={point} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">{point}</div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="font-bold text-slate-950">Documents liés</h3>
                <div className="mt-3 space-y-2">
                  {selectedDoc.relatedDocs.map((doc) => (
                    <div key={doc} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{doc}</div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-950">Tags</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedDoc.tags.map((tag) => <Badge key={tag} tone="slate">{tag}</Badge>)}
                </div>
              </div>
            </div>

            <Button variant="ghost" onClick={() => toggleFavorite(selectedDoc.id)}>
              {favorites.includes(selectedDoc.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
