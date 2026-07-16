import {
  Archive,
  ChevronDown,
  ExternalLink,
  FileDown,
  FlaskConical,
  Search,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useFillingGold } from '../application/FillingGoldContext';
import type {
  DecisionStatus,
  SessionMode,
  SessionStatus,
  SetupIteration,
  SetupSession,
} from '../domain/models';
import { PageIntro, StatusNotice } from './components';

type ModeFilter = SessionMode | 'all';
type StatusFilter = SessionStatus | 'all';

const MODE_LABELS: Record<SessionMode, string> = {
  real: 'Réglage réel',
  shadow: 'Shadow mode',
  simulation: 'Simulation',
};

const STATUS_LABELS: Record<SessionStatus, string> = {
  draft: 'Préparation',
  active: 'En cours',
  criterion_achieved: 'Critère atteint',
  stopped: 'Arrêtée',
  abandoned: 'Abandonnée',
};

const DECISION_LABELS: Record<DecisionStatus, string> = {
  collect_more: 'Échantillon incomplet',
  stop: 'Arrêter',
  investigate: 'Investiguer',
  correct: 'Corriger',
  achieved: 'Critère atteint',
};

const STATUS_STYLES: Record<SessionStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  active: 'bg-cyan-100 text-cyan-900',
  criterion_achieved: 'bg-emerald-100 text-emerald-900',
  stopped: 'bg-rose-100 text-rose-900',
  abandoned: 'bg-amber-100 text-amber-900',
};

const MODE_STYLES: Record<SessionMode, string> = {
  real: 'border-teal-300 bg-teal-50 text-teal-900',
  shadow: 'border-violet-300 bg-violet-50 text-violet-900',
  simulation: 'border-blue-300 bg-blue-50 text-blue-900',
};

const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateTimeFormatter.format(date);
}

function displayDecimal(value?: string): string {
  return value === undefined ? '—' : value.replace('.', ',');
}

function criterionUnit(session: SetupSession): string {
  switch (session.profiles.controlPlan.startCriterion.basis) {
    case 'net_mass_g':
      return 'g NET';
    case 'gross_mass_g':
      return 'g BRUT';
    case 'volume_ml':
      return 'mL';
  }
}

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR');
}

function searchableSession(session: SetupSession): string {
  return normalizeSearch(
    [
      session.id,
      session.profiles.product.sku,
      session.profiles.product.designation,
      session.profiles.machine.name,
      session.profiles.machine.line,
      session.profiles.packaging.name,
      session.profiles.packaging.formatCode,
      session.context.workOrder,
      session.context.batch,
      ...session.iterations.map((iteration) => iteration.operatorNote),
    ]
      .filter((value): value is string => Boolean(value))
      .join(' '),
  );
}

function includedMeasurementCount(iteration: SetupIteration): number {
  return iteration.measurements.filter((measurement) => !measurement.excluded).length;
}

function sessionMeasurementCounts(session: SetupSession): { included: number; excluded: number } {
  return session.iterations.reduce(
    (counts, iteration) => ({
      included: counts.included + includedMeasurementCount(iteration),
      excluded:
        counts.excluded + iteration.measurements.filter((measurement) => measurement.excluded).length,
    }),
    { included: 0, excluded: 0 },
  );
}

function lastIteration(session: SetupSession): SetupIteration | undefined {
  return session.iterations[session.iterations.length - 1];
}

function canDeleteSession(session: SetupSession): boolean {
  return session.status === 'abandoned' || session.mode === 'simulation';
}

function protectCsvFormula(value: string): string {
  const firstMeaningfulCharacters = value.trimStart();
  return /^[=+\-@]/.test(firstMeaningfulCharacters) ? `'${value}` : value;
}

function csvCell(value: unknown, trustedNumeric = false): string {
  const text = value === undefined || value === null ? '' : String(value);
  const safe = trustedNumeric ? text : protectCsvFormula(text);
  return `"${safe.replace(/"/g, '""')}"`;
}

const CSV_HEADERS = [
  'ID session',
  'Début session',
  'Fin session',
  'Mode',
  'Statut',
  'Produit',
  'SKU',
  'Machine',
  'Format',
  'Ordre',
  'Lot',
  'Nombre itérations',
  'Itération',
  'Réglage appliqué',
  'Unité réglage',
  'Mesures incluses',
  'Mesures exclues',
  'Moyenne',
  'Minimum',
  'Maximum',
  'Écart-type',
  'Unité résultat',
  'Décision',
  'Correction g',
  'Correction mL',
  'Note',
  'Version moteur',
] as const;

function sessionCsvRows(session: SetupSession): string[][] {
  const iterations: Array<SetupIteration | undefined> =
    session.iterations.length > 0 ? session.iterations : [undefined];

  return iterations.map((iteration) => {
    const included = iteration ? includedMeasurementCount(iteration) : 0;
    const excluded = iteration ? iteration.measurements.length - included : 0;
    return [
      csvCell(session.id),
      csvCell(session.createdAt),
      csvCell(session.completedAt),
      csvCell(MODE_LABELS[session.mode]),
      csvCell(STATUS_LABELS[session.status]),
      csvCell(session.profiles.product.designation),
      csvCell(session.profiles.product.sku),
      csvCell(session.profiles.machine.name),
      csvCell(session.profiles.packaging.formatCode),
      csvCell(session.context.workOrder),
      csvCell(session.context.batch),
      csvCell(session.iterations.length, true),
      csvCell(iteration?.index, true),
      csvCell(iteration?.appliedSetting, true),
      csvCell(iteration?.appliedSettingUnit),
      csvCell(included, true),
      csvCell(excluded, true),
      csvCell(iteration?.statistics?.mean, true),
      csvCell(iteration?.statistics?.minimum, true),
      csvCell(iteration?.statistics?.maximum, true),
      csvCell(iteration?.statistics?.standardDeviation, true),
      csvCell(criterionUnit(session)),
      csvCell(iteration?.decision ? DECISION_LABELS[iteration.decision.status] : ''),
      csvCell(iteration?.recommendation?.recommendedChangeG, true),
      csvCell(iteration?.recommendation?.recommendedChangeMl, true),
      csvCell(iteration?.operatorNote),
      csvCell(session.engineVersion),
    ];
  });
}

function exportSessionsCsv(sessions: SetupSession[]): void {
  const rows = sessions.flatMap(sessionCsvRows);
  const csv = [
    'sep=;',
    CSV_HEADERS.map((header) => csvCell(header)).join(';'),
    ...rows.map((row) => row.join(';')),
  ].join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `historique-remplissage-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-black tabular-nums text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{detail}</p>
    </div>
  );
}

function IterationSummary({ session, iteration }: { session: SetupSession; iteration: SetupIteration }) {
  const included = includedMeasurementCount(iteration);
  const excluded = iteration.measurements.length - included;
  const decision = iteration.decision;

  return (
    <li className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-black text-slate-950">Itération {iteration.index}</p>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">
            {formatDateTime(iteration.startedAt)} · {included} incluse{included > 1 ? 's' : ''}
            {excluded > 0 ? ` · ${excluded} exclue${excluded > 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <span className="w-fit rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">
          {decision ? DECISION_LABELS[decision.status] : 'Non analysée'}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
        <div>
          <dt className="font-bold uppercase text-slate-400">Réglage</dt>
          <dd className="mt-0.5 font-black text-slate-800">
            {displayDecimal(iteration.appliedSetting)} {iteration.appliedSettingUnit ?? session.profiles.machine.unit}
          </dd>
        </div>
        <div>
          <dt className="font-bold uppercase text-slate-400">Moyenne</dt>
          <dd className="mt-0.5 font-black text-slate-800">
            {displayDecimal(iteration.statistics?.mean)} {criterionUnit(session)}
          </dd>
        </div>
        <div>
          <dt className="font-bold uppercase text-slate-400">Min / max</dt>
          <dd className="mt-0.5 font-black text-slate-800">
            {displayDecimal(iteration.statistics?.minimum)} / {displayDecimal(iteration.statistics?.maximum)}
          </dd>
        </div>
        <div>
          <dt className="font-bold uppercase text-slate-400">Correction</dt>
          <dd className="mt-0.5 font-black text-slate-800">
            {iteration.recommendation
              ? `${displayDecimal(iteration.recommendation.recommendedChangeG)} g`
              : '—'}
          </dd>
        </div>
      </dl>
      {iteration.operatorNote ? (
        <p className="mt-3 border-t border-slate-200 pt-2 text-xs font-semibold leading-5 text-slate-600">
          Note : {iteration.operatorNote}
        </p>
      ) : null}
    </li>
  );
}

function SessionCard({
  session,
  updatedAt,
  deleting,
  onDelete,
}: {
  session: SetupSession;
  updatedAt: string;
  deleting: boolean;
  onDelete: (session: SetupSession) => Promise<void>;
}) {
  const finalIteration = lastIteration(session);
  const counts = sessionMeasurementCounts(session);
  const deletable = canDeleteSession(session);

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-black text-slate-950">
              {session.profiles.product.designation} · {session.profiles.machine.name}
            </h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Début {formatDateTime(session.createdAt)} · mise à jour {formatDateTime(updatedAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-black uppercase ${MODE_STYLES[session.mode]}`}
            >
              {MODE_LABELS[session.mode]}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${STATUS_STYLES[session.status]}`}
            >
              {STATUS_LABELS[session.status]}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <dl className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
          <div>
            <dt className="text-xs font-black uppercase text-slate-400">Contexte</dt>
            <dd className="mt-1 font-bold text-slate-800">
              {session.profiles.packaging.formatCode}
              {session.context.batch ? ` · lot ${session.context.batch}` : ''}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-black uppercase text-slate-400">Itérations</dt>
            <dd className="mt-1 font-black tabular-nums text-slate-800">{session.iterations.length}</dd>
          </div>
          <div>
            <dt className="text-xs font-black uppercase text-slate-400">Mesures</dt>
            <dd className="mt-1 font-black tabular-nums text-slate-800">
              {counts.included} incluse{counts.included > 1 ? 's' : ''}
              {counts.excluded > 0 ? ` · ${counts.excluded} exclue${counts.excluded > 1 ? 's' : ''}` : ''}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-black uppercase text-slate-400">Dernier résultat</dt>
            <dd className="mt-1 font-black text-slate-800">
              {finalIteration?.decision
                ? DECISION_LABELS[finalIteration.decision.status]
                : session.status === 'abandoned'
                  ? 'Session abandonnée'
                  : 'Non analysé'}
            </dd>
          </div>
        </dl>

        {finalIteration?.statistics ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-black uppercase text-slate-400">Moyenne finale enregistrée</p>
            <p className="mt-1 text-xl font-black tabular-nums text-slate-950">
              {displayDecimal(finalIteration.statistics.mean)}{' '}
              <span className="text-sm text-slate-600">{criterionUnit(session)}</span>
            </p>
          </div>
        ) : null}

        <details className="group mt-4 rounded-xl border border-slate-200">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-black text-slate-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-100">
            <span>Détail des {session.iterations.length} itération{session.iterations.length > 1 ? 's' : ''}</span>
            <ChevronDown size={18} className="shrink-0 transition group-open:rotate-180" aria-hidden="true" />
          </summary>
          <ol className="space-y-2 border-t border-slate-200 p-3">
            {session.iterations.map((iteration) => (
              <IterationSummary key={iteration.id} session={session} iteration={iteration} />
            ))}
          </ol>
        </details>
      </div>

      <div className={`grid border-t border-slate-100 ${deletable ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <Link
          to={`/shiftguide/remplissage/session/${session.id}`}
          className="inline-flex min-h-14 items-center justify-center gap-2 px-4 text-sm font-black text-teal-800 transition hover:bg-teal-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-teal-100"
        >
          <ExternalLink size={17} aria-hidden="true" /> Ouvrir la session
        </Link>
        {deletable ? (
          <button
            type="button"
            disabled={deleting}
            onClick={() => void onDelete(session)}
            className="inline-flex min-h-14 items-center justify-center gap-2 border-l border-slate-100 px-4 text-sm font-black text-rose-700 transition hover:bg-rose-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-rose-100 disabled:cursor-wait disabled:opacity-50"
          >
            <Trash2 size={17} aria-hidden="true" /> {deleting ? 'Suppression…' : 'Supprimer'}
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function FillingHistoryPage() {
  const { sessions, deleteSession } = useFillingGold();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<ModeFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const normalizedQuery = normalizeSearch(query.trim());
    return sessions
      .filter(({ value }) => mode === 'all' || value.mode === mode)
      .filter(({ value }) => status === 'all' || value.status === status)
      .filter(({ value }) => normalizedQuery.length === 0 || searchableSession(value).includes(normalizedQuery))
      .slice()
      .sort((left, right) => right.value.createdAt.localeCompare(left.value.createdAt));
  }, [mode, query, sessions, status]);

  const summary = useMemo(() => {
    return filtered.reduce(
      (result, entry) => ({
        sessions: result.sessions + 1,
        iterations: result.iterations + entry.value.iterations.length,
        achieved: result.achieved + (entry.value.status === 'criterion_achieved' ? 1 : 0),
        measurements:
          result.measurements + sessionMeasurementCounts(entry.value).included,
      }),
      { sessions: 0, iterations: 0, achieved: 0, measurements: 0 },
    );
  }, [filtered]);

  const filtersActive = query.trim().length > 0 || mode !== 'all' || status !== 'all';

  const remove = async (session: SetupSession) => {
    if (!canDeleteSession(session)) {
      setError('Seules une simulation ou une session abandonnée peuvent être supprimées.');
      return;
    }
    const confirmation = window.confirm(
      `Supprimer définitivement l’enregistrement local « ${session.profiles.product.designation} · ${formatDateTime(session.createdAt)} » ?\n\nCette action efface la session et ses mesures du coffre. Elle ne peut pas être annulée.`,
    );
    if (!confirmation) return;

    setDeletingId(session.id);
    setError(null);
    setMessage(null);
    try {
      await deleteSession(session.id);
      setMessage('Session supprimée du coffre local.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La session ne peut pas être supprimée.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
      <PageIntro
        eyebrow="Capitalisation locale"
        title="Historique des réglages"
        description="Retrouve les contextes, itérations et résultats enregistrés dans ce coffre. Cet écran ne transmet aucune donnée et ne constitue pas un registre de libération Qualité."
        actions={
          <button
            type="button"
            disabled={filtered.length === 0}
            onClick={() => exportSessionsCsv(filtered.map((entry) => entry.value))}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            <FileDown size={18} aria-hidden="true" /> Exporter la vue CSV
          </button>
        }
      />

      {message ? <StatusNotice tone="success" title={message} /> : null}
      {error ? (
        <div className={message ? 'mt-3' : ''}>
          <StatusNotice tone="danger" title="Action impossible">
            {error}
          </StatusNotice>
        </div>
      ) : null}

      <section aria-label="Synthèse de la vue" className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="Sessions" value={summary.sessions} detail="dans la vue filtrée" />
        <SummaryCard label="Itérations" value={summary.iterations} detail="cycles réglage–mesure" />
        <SummaryCard label="Critères atteints" value={summary.achieved} detail="démarrages, pas conformité lot" />
        <SummaryCard label="Mesures incluses" value={summary.measurements} detail="hors mesures exclues" />
      </section>

      <section
        aria-labelledby="history-filters-title"
        className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="history-filters-title" className="text-lg font-black text-slate-950">
              Rechercher et filtrer
            </h2>
            <p className="mt-1 text-xs font-semibold text-slate-500" aria-live="polite">
              {filtered.length} résultat{filtered.length > 1 ? 's' : ''} sur {sessions.length}
            </p>
          </div>
          {filtersActive ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setMode('all');
                setStatus('all');
              }}
              className="min-h-11 rounded-xl px-3 text-sm font-black text-teal-800 hover:bg-teal-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-100"
            >
              Effacer les filtres
            </button>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1.4fr_0.8fr_0.8fr]">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-slate-600">Recherche</span>
            <span className="mt-1 flex min-h-12 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 focus-within:border-teal-600 focus-within:ring-4 focus-within:ring-teal-100">
              <Search size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Produit, machine, lot, ordre…"
                className="min-w-0 flex-1 bg-transparent py-2 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
              />
            </span>
          </label>

          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-slate-600">Mode</span>
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as ModeFilter)}
              className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
            >
              <option value="all">Tous les modes</option>
              <option value="real">Réglage réel</option>
              <option value="shadow">Shadow mode</option>
              <option value="simulation">Simulation</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-slate-600">Statut</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusFilter)}
              className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
            >
              <option value="all">Tous les statuts</option>
              <option value="draft">Préparation</option>
              <option value="active">En cours</option>
              <option value="criterion_achieved">Critère atteint</option>
              <option value="stopped">Arrêtée</option>
              <option value="abandoned">Abandonnée</option>
            </select>
          </label>
        </div>
      </section>

      {sessions.length === 0 ? (
        <div className="mt-5 rounded-2xl border-2 border-dashed border-slate-300 bg-white px-5 py-12 text-center">
          <Archive size={38} className="mx-auto text-slate-300" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-black text-slate-950">Aucune session enregistrée</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
            Les réglages apparaîtront ici dès la première session, avec leurs snapshots de profils et leurs itérations.
          </p>
          <Link
            to="/shiftguide/remplissage"
            className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-black text-white"
          >
            <FlaskConical size={18} aria-hidden="true" /> Préparer un réglage
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center shadow-sm">
          <Search size={34} className="mx-auto text-slate-300" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-black text-slate-950">Aucune session ne correspond</h2>
          <p className="mt-2 text-sm text-slate-500">Modifie la recherche ou efface les filtres actifs.</p>
        </div>
      ) : (
        <section aria-label="Sessions enregistrées" className="mt-5 grid gap-4 xl:grid-cols-2">
          {filtered.map((entry) => (
            <SessionCard
              key={entry.value.id}
              session={entry.value}
              updatedAt={entry.updatedAt}
              deleting={deletingId === entry.value.id}
              onDelete={remove}
            />
          ))}
        </section>
      )}

      <div className="mt-6 grid gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 sm:grid-cols-[auto_1fr] sm:items-start">
        <ShieldAlert size={22} className="text-blue-700" aria-hidden="true" />
        <div>
          <p className="font-black">Historique personnel, chiffré et local</p>
          <p className="mt-1 leading-6">
            L’export est généré directement sur cet appareil. Les sessions réelles ou shadow ayant produit un résultat restent figées ; seules les simulations et les sessions abandonnées proposent une suppression.
          </p>
        </div>
      </div>
    </div>
  );
}
