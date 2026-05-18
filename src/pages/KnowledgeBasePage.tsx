import {
  AlertTriangle,
  ArrowLeft,
  CheckSquare,
  ChevronRight,
  Circle,
  FileText,
  ListChecks,
  Search,
  Zap
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { Badge } from '../components/Badge';
import { knowledgeCategories, procedureDocs } from '../data/knowledgeData';
import type { ProcedureDoc, StandardStatus, StandardType } from '../types/knowledge';
import { formatDate } from '../utils/date';

const typeLabel: Record<StandardType, string> = {
  SOP: 'Mode opératoire',
  OPL: 'Leçon ponctuelle',
  CHECK: 'Check-list',
  REACT: 'Fiche réaction'
};

const typeTone: Record<StandardType, 'teal' | 'blue' | 'amber' | 'red'> = {
  SOP: 'teal',
  OPL: 'blue',
  CHECK: 'amber',
  REACT: 'red'
};

const typeIcon: Record<StandardType, typeof FileText> = {
  SOP: FileText,
  OPL: Circle,
  CHECK: CheckSquare,
  REACT: Zap
};

const statusLabel: Record<StandardStatus, string> = {
  active: 'En vigueur',
  review: 'En révision',
  draft: 'Brouillon'
};

const statusTone: Record<StandardStatus, 'green' | 'amber' | 'slate'> = {
  active: 'green',
  review: 'amber',
  draft: 'slate'
};

function DocList() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Tous');
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return procedureDocs.filter((doc) => {
      const inCat = category === 'Tous' || doc.category === category;
      const inSearch = !q || [doc.code, doc.title, doc.category, doc.lineArea, doc.summary].some((v) =>
        v.toLowerCase().includes(q)
      );
      return inCat && inSearch;
    });
  }, [query, category]);

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-6">
        <p className="label">Module documentation</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">Standards terrain</h1>
        <p className="mt-2 text-slate-600">Modes opératoires, check-lists et fiches réaction des lignes de conditionnement.</p>
      </div>

      {/* Search + filters */}
      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
          <input
            className="field pl-10 py-2.5"
            placeholder="Rechercher par code, titre, zone..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {knowledgeCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                category === cat ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <p className="mb-3 text-xs text-slate-400 font-medium uppercase tracking-wide">
        {filtered.length} document{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* Dense list */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">
            <Search size={28} className="mx-auto mb-3 text-slate-300" />
            Aucun document trouvé.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((doc) => {
              const Icon = typeIcon[doc.type];
              return (
                <li key={doc.id}>
                  <button
                    type="button"
                    onClick={() => navigate(doc.id)}
                    className="group flex w-full items-center gap-4 px-4 py-3.5 text-left transition hover:bg-slate-50 sm:px-5"
                  >
                    {/* Type icon */}
                    <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                      doc.type === 'SOP' ? 'bg-teal-50 text-teal-700' :
                      doc.type === 'CHECK' ? 'bg-amber-50 text-amber-700' :
                      doc.type === 'REACT' ? 'bg-rose-50 text-rose-700' :
                      'bg-sky-50 text-sky-700'
                    }`}>
                      <Icon size={18} />
                    </div>

                    {/* Main info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-400">{doc.code}</span>
                        <Badge tone={typeTone[doc.type]}>{typeLabel[doc.type]}</Badge>
                        <Badge tone={statusTone[doc.status]}>{statusLabel[doc.status]}</Badge>
                      </div>
                      <p className="mt-0.5 font-semibold text-slate-950 group-hover:text-teal-700 transition">{doc.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{doc.lineArea} · {doc.version} · Validé le {formatDate(doc.updatedAt)}</p>
                    </div>

                    {/* Key checks preview */}
                    <div className="hidden xl:flex flex-col gap-1 w-56 shrink-0">
                      {doc.keyChecks.slice(0, 2).map((c) => (
                        <p key={c} className="flex items-start gap-1.5 text-xs text-slate-500">
                          <ListChecks size={12} className="mt-0.5 shrink-0 text-teal-500" />
                          <span className="truncate">{c}</span>
                        </p>
                      ))}
                    </div>

                    <ChevronRight size={16} className="shrink-0 text-slate-300 group-hover:text-teal-600 transition" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function DocDetail() {
  const { id } = useParams<{ id: string }>();
  const doc = procedureDocs.find((d) => d.id === id);

  if (!doc) {
    return (
      <div className="mx-auto max-w-7xl px-3 py-16 text-center sm:px-6 lg:px-8">
        <p className="text-slate-500">Document introuvable.</p>
        <Link to="/knowledge-base" className="mt-4 inline-block text-teal-700 underline">Retour</Link>
      </div>
    );
  }

  const Icon = typeIcon[doc.type];

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Link
        to="/knowledge-base"
        className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition"
      >
        <ArrowLeft size={15} />
        Standards terrain
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="font-mono text-sm font-bold text-slate-500">{doc.code}</span>
            <Badge tone={typeTone[doc.type]}>{typeLabel[doc.type]}</Badge>
            <Badge tone={statusTone[doc.status]}>{statusLabel[doc.status]}</Badge>
          </div>
          <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">{doc.title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{doc.summary}</p>
        </div>

        {/* Meta row */}
        <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100 sm:grid-cols-4">
          {[
            { label: 'Version', value: doc.version },
            { label: 'Zone', value: doc.lineArea },
            { label: 'Validé le', value: formatDate(doc.updatedAt) },
            { label: 'Révision', value: formatDate(doc.nextReviewAt) }
          ].map((item) => (
            <div key={item.label} className="px-4 py-3">
              <p className="label">{item.label}</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="grid divide-y divide-slate-100 sm:divide-y-0 sm:divide-x sm:grid-cols-2">
          {/* Key checks */}
          <div className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500 mb-4">
              <ListChecks size={15} className="text-teal-600" />Points de contrôle clés
            </h2>
            <ul className="space-y-2">
              {doc.keyChecks.map((check) => (
                <li key={check} className="flex items-start gap-3 rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800">
                  <CheckSquare size={15} className="mt-0.5 shrink-0 text-teal-600" />
                  {check}
                </li>
              ))}
            </ul>
          </div>

          {/* Watch points */}
          <div className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500 mb-4">
              <AlertTriangle size={15} className="text-amber-500" />Points de vigilance
            </h2>
            <ul className="space-y-2">
              {doc.watchPoints.map((point) => (
                <li key={point} className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-900">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="mt-5 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Séquence opératoire</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {doc.steps.map((step, idx) => (
            <div key={idx} className="flex gap-4 px-5 py-4">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-950">{step.action}</p>
                <p className="mt-1 text-sm text-slate-500">
                  <span className="font-medium text-teal-700">Résultat attendu : </span>
                  {step.expected}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer meta */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-500">
        <span>Rédigé par <strong className="text-slate-700">{doc.author}</strong></span>
        <span>Validé par <strong className="text-slate-700">{doc.validator}</strong></span>
        {doc.relatedDocs.length > 0 && (
          <span>Voir aussi : <strong className="text-slate-700">{doc.relatedDocs.join(', ')}</strong></span>
        )}
      </div>
    </div>
  );
}

export function KnowledgeBasePage() {
  return (
    <Routes>
      <Route index element={<DocList />} />
      <Route path=":id" element={<DocDetail />} />
    </Routes>
  );
}
