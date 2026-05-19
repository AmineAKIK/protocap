import {
  AlertTriangle,
  Ban,
  ChevronDown,
  ChevronUp,
  Clock,
  History,
  Plus,
  RefreshCcw,
  Route,
  ShieldCheck,
  X
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { StatCard } from '../components/StatCard';
import { initialChangeHistory, initialConditioningLines } from '../data/expiryData';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { ChangeHistoryEntry, ConditioningLine } from '../types/expiry';
import { addDays, formatDateTime, hoursUntil } from '../utils/date';
import { getElementStatus, getLineStatus, statusLabel } from '../utils/expiry';

const statusTone = {
  ok: 'green',
  warning: 'amber',
  expired: 'red',
  conform: 'green',
  watch: 'amber',
  nonConform: 'red'
} as const;

function getBlockStatus(line: ConditioningLine) {
  const statuses = line.elements.map((el) => getElementStatus(el));
  if (statuses.includes('expired')) return 'expired';
  if (statuses.includes('warning')) return 'warning';
  return 'ok';
}

function earliestExpiry(line: ConditioningLine) {
  return line.elements.reduce((min, el) =>
    new Date(el.expiresAt) < new Date(min) ? el.expiresAt : min,
    line.elements[0].expiresAt
  );
}

function latestChange(line: ConditioningLine) {
  return line.elements.reduce((max, el) =>
    new Date(el.lastChangedAt) > new Date(max) ? el.lastChangedAt : max,
    line.elements[0].lastChangedAt
  );
}

function remainingLabel(line: ConditioningLine) {
  const remaining = hoursUntil(earliestExpiry(line));
  if (remaining <= 0) return 'À remplacer';
  const totalHours = Math.ceil(remaining);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days <= 0) return `${hours} h restantes`;
  if (hours === 0) return `${days} j restants`;
  return `${days} j ${hours} h restantes`;
}

function formatDateOnly(dateIso: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(dateIso));
}

function formatTimeOnly(dateIso: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(dateIso));
}

function isBlockHistoryEntry(entry: ChangeHistoryEntry) {
  return entry.elementLabel.toLowerCase().includes('bloc');
}

function isVatHistoryEntry(entry: ChangeHistoryEntry) {
  return entry.elementLabel.toLowerCase().includes('cuve');
}

function BlockValidityBar({ line }: { line: ConditioningLine }) {
  const validityDays = line.elements[0]?.validityDays ?? 5;
  const changedAt = latestChange(line);
  const expiresAt = earliestExpiry(line);
  const remaining = hoursUntil(expiresAt);
  const pct = Math.min(100, Math.max(0, (remaining / (validityDays * 24)) * 100));
  const blockStatus = getBlockStatus(line);

  const barColor = blockStatus === 'expired' ? 'bg-rose-500' : blockStatus === 'warning' ? 'bg-amber-400' : 'bg-emerald-500';
  const label = remainingLabel(line);

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
        <span>Validité restante ({validityDays} j max)</span>
        <span className={
          blockStatus === 'expired' ? 'font-bold text-rose-600' :
          blockStatus === 'warning' ? 'font-bold text-amber-700' :
          'font-medium text-emerald-700'
        }>
          {label}
        </span>
      </div>
      <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-3 rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex flex-wrap justify-between gap-x-2 text-xs text-slate-500 mt-1">
        <span>Posé le {formatDateTime(changedAt)}</span>
        <span>Limite {formatDateTime(expiresAt)}</span>
      </div>
    </div>
  );
}

function BlockedModal({ line, onClose, onDeclare }: {
  line: ConditioningLine;
  onClose: () => void;
  onDeclare: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-2 pb-[calc(0.5rem_+_env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[calc(100dvh_-_1rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl animate-slide-in sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 bg-rose-600 px-4 py-4 text-white sm:px-6 sm:py-5">
          <div className="flex items-center gap-3">
            <Ban size={26} className="shrink-0" />
            <h2 className="text-lg font-bold text-white">
              Bloc de remplissage expiré — démarrage bloqué
            </h2>
          </div>
          <button onClick={onClose} className="grid min-h-11 min-w-11 place-items-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white" aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
          <p className="text-slate-700 leading-6">
            Sur <strong>{line.name}</strong>, le bloc de remplissage a dépassé sa période d'utilisation de {line.elements[0]?.validityDays ?? 5} jours.
          </p>

          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-rose-900">Bloc de remplissage</p>
              <Badge tone="red">Expiré</Badge>
            </div>
            <BlockValidityBar line={line} />
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600">
            Déclarez le remplacement du bloc pour débloquer le démarrage.
          </div>

          <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
            <Button className="w-full sm:w-auto" variant="ghost" onClick={onClose}>Voir quand même</Button>
            <Button className="w-full sm:w-auto" variant="danger" icon={<Plus size={15} />} onClick={onDeclare}>
              Déclarer le remplacement
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ExpiryCheckPage() {
  const [lines, setLines] = useLocalStorage<ConditioningLine[]>('lineops.expiry.lines', initialConditioningLines);
  const [history, setHistory] = useLocalStorage<ChangeHistoryEntry[]>('lineops.expiry.history', initialChangeHistory);
  const [selectedLineId, setSelectedLineId] = useState(lines[0]?.id ?? '');
  const [declareModalOpen, setDeclareModalOpen] = useState(false);
  const [blockedModalOpen, setBlockedModalOpen] = useState(false);
  const [vatModalOpen, setVatModalOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mobileView, setMobileView] = useState<'tour' | 'line'>('tour');

  const selectedLine = lines.find((l) => l.id === selectedLineId) ?? lines[0];
  const lineStatus = getLineStatus(selectedLine);
  const isBlocked = lineStatus === 'nonConform';

  useEffect(() => {
    if (isBlocked) setBlockedModalOpen(true);
    else setBlockedModalOpen(false);
  }, [selectedLineId, isBlocked]);

  const stats = useMemo(() => {
    const statuses = lines.map((l) => getLineStatus(l));
    return {
      conform: statuses.filter((s) => s === 'conform').length,
      watch: statuses.filter((s) => s === 'watch').length,
      blocked: statuses.filter((s) => s === 'nonConform').length
    };
  }, [lines]);

  function handleVatSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const vat = String(data.get('vat') || selectedLine.vat);
    const changedAt = String(data.get('changedAt'));
    const operator = String(data.get('operator') || 'Opérateur démo');
    const comment = String(data.get('comment') || '');

    setLines((current) =>
      current.map((l) => (l.id === selectedLine.id ? { ...l, vat } : l))
    );

    const newEntry: ChangeHistoryEntry = {
      id: `hist-vat-${Date.now()}`,
      lineId: selectedLine.id,
      lineName: selectedLine.name,
      elementLabel: 'Recharge de cuve - même matière',
      changedAt: new Date(changedAt).toISOString(),
      operator,
      comment: comment || `${vat} ajoutée sur la ligne. Matière inchangée : ${selectedLine.product}.`,
      newExpiresAt: earliestExpiry(selectedLine)
    };
    setHistory((current) => [newEntry, ...current]);
    setVatModalOpen(false);
  }

  function handleDeclareSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const changedAt = String(data.get('changedAt'));
    const operator = String(data.get('operator') || 'Opérateur démo');
    const comment = String(data.get('comment') || '');

    setLines((current) =>
      current.map((l) => {
        if (l.id !== selectedLine.id) return l;
        return {
          ...l,
          elements: l.elements.map((el) => ({
            ...el,
            lastChangedAt: new Date(changedAt).toISOString(),
            expiresAt: addDays(new Date(changedAt).toISOString(), el.validityDays),
            operator,
            comment
          }))
        };
      })
    );

    const newEntry: ChangeHistoryEntry = {
      id: `hist-${Date.now()}`,
      lineId: selectedLine.id,
      lineName: selectedLine.name,
      elementLabel: 'Bloc de remplissage',
      changedAt: new Date(changedAt).toISOString(),
      operator,
      comment,
      newExpiresAt: addDays(new Date(changedAt).toISOString(), selectedLine.elements[0]?.validityDays ?? 5)
    };
    setHistory((current) => [newEntry, ...current]);
    setDeclareModalOpen(false);
  }

  function openDeclareFromBlockedModal() {
    setBlockedModalOpen(false);
    setDeclareModalOpen(true);
  }

  const blockStatus = getBlockStatus(selectedLine);
  const selectedLineHistory = history.filter((entry) => entry.lineId === selectedLine.id);
  const currentBlockChangedAt = new Date(latestChange(selectedLine)).getTime();
  const blockHistory = selectedLineHistory.filter(isBlockHistoryEntry);
  const hasCurrentBlockHistory = blockHistory.some(
    (entry) => Math.abs(new Date(entry.changedAt).getTime() - currentBlockChangedAt) < 1000
  );
  const currentBlockHistory: ChangeHistoryEntry = {
    id: `current-block-${selectedLine.id}-${latestChange(selectedLine)}`,
    lineId: selectedLine.id,
    lineName: selectedLine.name,
    elementLabel: 'Bloc de remplissage',
    changedAt: latestChange(selectedLine),
    operator: selectedLine.elements[0]?.operator ?? 'Opérateur non renseigné',
    comment: selectedLine.elements[0]?.comment,
    newExpiresAt: earliestExpiry(selectedLine)
  };
  const blockInstances = (hasCurrentBlockHistory ? blockHistory : [currentBlockHistory, ...blockHistory])
    .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
  const vatEntries = selectedLineHistory
    .filter(isVatHistoryEntry)
    .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
  const blockHistoryGroups = blockInstances.map((block, index) => {
    const blockStartedAt = new Date(block.changedAt).getTime();
    const nextBlockStartedAt = index > 0 ? new Date(blockInstances[index - 1].changedAt).getTime() : Number.POSITIVE_INFINITY;
    return {
      block,
      isCurrent: index === 0,
      vatEntries: vatEntries.filter((entry) => {
        const changedAt = new Date(entry.changedAt).getTime();
        return changedAt >= blockStartedAt && changedAt < nextBlockStartedAt;
      })
    };
  });
  const vatHistory = blockHistoryGroups[0]?.vatEntries ?? [];
  const registerEntryCount = blockHistoryGroups.reduce((count, group) => count + 1 + group.vatEntries.length, 0);
  const washerBoard = lines;

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-6">
        <p className="label">Module qualité</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">Expiry Check</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Validité du bloc de remplissage, recharges de cuves et registre de traçabilité par ligne de conditionnement.
        </p>
        <p className="mt-2 max-w-3xl text-sm font-semibold text-teal-800">
          Échéances visibles. Remplacements priorisés. Trace exploitable en cas d'investigation.
        </p>
      </div>

      <div className="sticky top-14 z-30 -mx-3 mb-4 border-y border-slate-200 bg-slate-50/95 px-3 py-2 backdrop-blur lg:hidden">
        <div className="grid grid-cols-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            className={`min-h-11 rounded-lg px-3 text-sm font-semibold transition ${mobileView === 'tour' ? 'bg-teal-700 text-white shadow' : 'text-slate-600'}`}
            onClick={() => setMobileView('tour')}
          >
            Tournée
          </button>
          <button
            type="button"
            className={`min-h-11 rounded-lg px-3 text-sm font-semibold transition ${mobileView === 'line' ? 'bg-teal-700 text-white shadow' : 'text-slate-600'}`}
            onClick={() => setMobileView('line')}
          >
            Ligne
          </button>
        </div>
      </div>

      <section className={`${mobileView === 'tour' ? 'block' : 'hidden'} mb-6 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:p-4 lg:block`}>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3 rounded-xl bg-teal-700 px-4 py-3 text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-teal-100">Écran laveur</p>
            <h2 className="mt-1 text-xl font-black">Board de tournée</h2>
          </div>
          <p className="max-w-xl text-sm font-medium leading-6 text-teal-50">
            Affiché côté laveur. Chaque carte signale clairement l'état du bloc pour repérer les remplacements à prendre en charge.
          </p>
        </div>
        <div className="rounded-xl border border-teal-200 bg-white p-3 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="label">Vue consolidée des lignes</p>
            <h2 className="mt-1 text-lg font-bold text-slate-950">Blocs à surveiller ou remplacer</h2>
          </div>
          <Route className="text-teal-700" size={22} />
        </div>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <StatCard label="Lignes conformes" value={stats.conform} />
          <StatCard label="Vigilance" value={stats.watch} />
          <StatCard label="Bloqués" value={stats.blocked} />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {washerBoard.map((line) => {
            const status = getBlockStatus(line);
            const expiry = earliestExpiry(line);
            return (
              <button
                key={line.id}
                type="button"
                onClick={() => setSelectedLineId(line.id)}
                className={`rounded-xl border p-4 text-left transition hover:border-teal-300 ${
                  status === 'expired' ? 'border-rose-300 bg-rose-50' : status === 'warning' ? 'border-amber-200 bg-amber-50/50' : 'border-emerald-200 bg-emerald-50/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-950">{line.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{line.vat} · {line.product}</p>
                  </div>
                  <Badge tone={statusTone[status]}>{statusLabel(status)}</Badge>
                </div>
                <p className={`mt-3 text-base font-bold ${status === 'expired' ? 'text-rose-700' : status === 'warning' ? 'text-amber-800' : 'text-emerald-700'}`}>
                  {remainingLabel(line)}
                </p>
                <div className="mt-3 rounded-lg bg-white/85 p-3 ring-1 ring-slate-200">
                  <p className="label">Péremption bloc</p>
                  <p className="mt-1 text-lg font-black tabular-nums text-slate-950">{formatDateOnly(expiry)}</p>
                  <p className="text-base font-bold tabular-nums text-slate-700">{formatTimeOnly(expiry)}</p>
                </div>
              </button>
            );
          })}
        </div>
        </div>
      </section>

      <section className={`${mobileView === 'line' ? 'block' : 'hidden'} rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:p-4 lg:block`}>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3 rounded-xl bg-slate-900 px-4 py-3 text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-300">Écran conducteur</p>
            <h2 className="mt-1 text-xl font-black">Dashboard ligne</h2>
          </div>
          <p className="max-w-xl text-sm font-medium leading-6 text-slate-200">
            Utilisé sur la ligne concernée pour déclarer le bloc de remplissage, tracer les recharges de cuves et alimenter le board laveur.
          </p>
        </div>
      <div className="space-y-4">
        <section className="panel sticky top-[7.25rem] z-20 p-3 lg:static lg:p-4">
          <p className="label">Navigation entre lignes</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Dans un usage terrain, chaque ligne dispose de son propre dashboard. Le sélecteur affiche plusieurs lignes uniquement pour parcourir les états de la maquette : conforme, vigilance et non conforme.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {lines.map((line) => {
              const status = getLineStatus(line);
              const isSelected = line.id === selectedLine.id;
              const selectorTone =
                status === 'nonConform'
                  ? isSelected
                    ? 'border-rose-600 bg-rose-600 text-white shadow-sm'
                    : 'border-rose-200 bg-rose-50 text-rose-800 hover:border-rose-400'
                  : status === 'watch'
                    ? isSelected
                      ? 'border-amber-500 bg-amber-500 text-white shadow-sm'
                      : 'border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-400'
                    : isSelected
                      ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-400';
              return (
                <button
                  key={line.id}
                  type="button"
                  onClick={() => setSelectedLineId(line.id)}
                  className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm font-semibold transition ${selectorTone}`}
                >
                  {line.name.replace('Ligne de conditionnement ', 'Ligne ')}
                  <span className={`ml-2 font-normal ${isSelected ? 'text-white/90' : ''}`}>{statusLabel(status)}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          {/* Status banner */}
          {isBlocked ? (
            <div className="flex items-center gap-3 rounded-xl border-2 border-rose-400 bg-rose-50 p-3 sm:p-4">
              <Ban size={20} className="shrink-0 text-rose-600" />
              <p className="text-sm font-semibold text-rose-900 flex-1">
                Bloc de remplissage expiré — démarrage non conforme.
              </p>
              <button
                onClick={() => setBlockedModalOpen(true)}
                className="min-h-11 shrink-0 rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-700"
              >
                Voir
              </button>
            </div>
          ) : lineStatus === 'conform' ? (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 sm:p-4">
              <ShieldCheck size={20} className="shrink-0 text-emerald-600" />
              <p className="text-sm font-semibold text-emerald-900">Démarrage de la ligne autorisé — bloc de remplissage dans sa période de validité.</p>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 sm:p-4">
              <AlertTriangle size={20} className="shrink-0 text-amber-600" />
              <p className="text-sm font-semibold text-amber-900">Vigilance — bloc de remplissage en fin de validité. Prévoir le remplacement.</p>
            </div>
          )}

          {/* Feuille de suivi: bloc + recharges */}
          <div className="panel p-3 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="label">Ligne de conditionnement sélectionnée</p>
                <h2 className="mt-1 text-lg font-bold text-slate-950">{selectedLine.name}</h2>
                <p className="text-sm text-slate-600">{selectedLine.vat} · {selectedLine.product}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className={`rounded-xl border-2 p-3 sm:p-5 ${
              blockStatus === 'expired' ? 'border-rose-300 bg-rose-50' :
              blockStatus === 'warning' ? 'border-amber-200 bg-amber-50/40' :
              'border-slate-200 bg-white'
            }`}>
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="text-base font-bold text-slate-950">Bloc de remplissage</h3>
                <Badge tone={statusTone[blockStatus]}>{statusLabel(blockStatus)}</Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200 sm:p-4">
                  <p className="label">Bloc changé le</p>
                  <p className="mt-2 text-xl font-black tabular-nums text-slate-950">{formatDateOnly(latestChange(selectedLine))}</p>
                  <p className="text-lg font-bold tabular-nums text-slate-700">{formatTimeOnly(latestChange(selectedLine))}</p>
                </div>
                <div className={`rounded-xl p-3 ring-1 sm:p-4 ${blockStatus === 'expired' ? 'bg-rose-100 ring-rose-200' : blockStatus === 'warning' ? 'bg-amber-100 ring-amber-200' : 'bg-emerald-50 ring-emerald-200'}`}>
                  <p className="label">Péremption bloc</p>
                  <p className={`mt-2 text-xl font-black tabular-nums ${blockStatus === 'expired' ? 'text-rose-800' : blockStatus === 'warning' ? 'text-amber-900' : 'text-emerald-900'}`}>{formatDateOnly(earliestExpiry(selectedLine))}</p>
                  <p className={`text-lg font-bold tabular-nums ${blockStatus === 'expired' ? 'text-rose-700' : blockStatus === 'warning' ? 'text-amber-800' : 'text-emerald-800'}`}>{formatTimeOnly(earliestExpiry(selectedLine))}</p>
                </div>
              </div>

              <div className="my-5">
                <BlockValidityBar line={selectedLine} />
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-slate-500">Temps restant</dt>
                <dd className={`font-black text-right ${blockStatus === 'expired' ? 'text-rose-700' : blockStatus === 'warning' ? 'text-amber-800' : 'text-emerald-700'}`}>
                  {remainingLabel(selectedLine)}
                </dd>
                <dt className="text-slate-500">Validité</dt>
                <dd className="font-medium text-slate-800 text-right">{selectedLine.elements[0]?.validityDays ?? 5} jours</dd>
                <dt className="text-slate-500">Déclaré par</dt>
                <dd className="font-medium text-slate-800 text-right">{selectedLine.elements[0]?.operator}</dd>
              </dl>

              <Button
                className="mt-5 w-full py-3 text-base shadow-sm"
                variant={isBlocked ? 'danger' : 'primary'}
                onClick={() => setDeclareModalOpen(true)}
              >
                {isBlocked ? 'Remplacer le bloc de remplissage' : 'Déclarer un remplacement'}
              </Button>
            </div>

            <div className="rounded-xl border-2 border-slate-200 bg-white p-3 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-base font-bold text-slate-950">Recharges de cuves</h3>
                <Badge tone="slate">{vatHistory.length}</Badge>
              </div>
              <p className="text-sm leading-6 text-slate-600">
                Recharges tracées pendant la durée de vie du bloc de remplissage courant.
              </p>
              <div className="mt-4 max-h-56 space-y-3 overflow-y-auto pr-1">
                {vatHistory.length > 0 ? vatHistory.map((entry) => (
                  <div key={entry.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-slate-950">{entry.elementLabel}</strong>
                      <span className="text-xs text-slate-500">{formatDateTime(entry.changedAt)}</span>
                    </div>
                    <p className="mt-1 text-slate-600">{entry.operator}</p>
                    {entry.comment ? <p className="mt-1 text-xs text-slate-500">{entry.comment}</p> : null}
                  </div>
                )) : (
                  <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                    Aucune recharge tracée sur ce bloc.
                  </div>
                )}
              </div>
              <Button className="mt-5 w-full py-3 text-base shadow-sm" variant="secondary" icon={<RefreshCcw size={15} />} onClick={() => setVatModalOpen(true)}>
                Ajouter une recharge de cuve
              </Button>
            </div>
            </div>
          </div>

          {/* History — collapsible */}
          <div className="panel overflow-hidden">
            <button
              type="button"
              className="flex min-h-14 w-full items-center justify-between p-3 transition hover:bg-slate-50 sm:p-5"
              onClick={() => setHistoryOpen((v) => !v)}
            >
              <div className="flex min-w-0 items-center gap-2 text-left">
                <History size={17} className="text-slate-500" />
                <span className="min-w-0 font-bold text-slate-950">Registre complet de la ligne</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{registerEntryCount}</span>
              </div>
              {historyOpen ? <ChevronUp size={17} className="text-slate-400" /> : <ChevronDown size={17} className="text-slate-400" />}
            </button>
            {historyOpen && (
              <div className="border-t border-slate-100 p-4 sm:p-5">
                <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                  {blockHistoryGroups.map((group) => (
                    <div key={group.block.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-slate-950">{group.block.elementLabel}</strong>
                          {group.isCurrent ? <Badge tone="teal">Bloc courant</Badge> : null}
                          <Badge tone="slate">{group.vatEntries.length} recharge{group.vatEntries.length > 1 ? 's' : ''}</Badge>
                        </div>
                        <span className="text-slate-500"><Clock size={13} className="mr-1 inline" />{formatDateTime(group.block.changedAt)}</span>
                      </div>
                      <p className="mt-1 text-slate-600">{group.block.lineName} · {group.block.operator}</p>
                      <p className="mt-1 text-xs text-slate-500">Limite bloc : {formatDateTime(group.block.newExpiresAt)}</p>
                      {group.block.comment ? <p className="mt-2 text-slate-600">{group.block.comment}</p> : null}

                      <div className="mt-3 space-y-2 border-l-2 border-teal-100 pl-3">
                        {group.vatEntries.length > 0 ? group.vatEntries.map((entry) => (
                          <div key={entry.id} className="rounded-lg bg-slate-50 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <strong className="text-slate-800">{entry.elementLabel}</strong>
                              <span className="text-xs text-slate-500">{formatDateTime(entry.changedAt)}</span>
                            </div>
                            <p className="mt-1 text-slate-600">{entry.operator}</p>
                            {entry.comment ? <p className="mt-1 text-xs text-slate-500">{entry.comment}</p> : null}
                          </div>
                        )) : (
                          <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500">
                            Aucune recharge rattachée à cette instance de bloc.
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
      </section>

      {/* Blocked modal — auto on selection */}
      {blockedModalOpen && isBlocked && (
        <BlockedModal
          line={selectedLine}
          onClose={() => setBlockedModalOpen(false)}
          onDeclare={openDeclareFromBlockedModal}
        />
      )}

      {/* Same-material vat traceability */}
      {vatModalOpen && (
        <Modal title="Tracer une recharge de cuve" onClose={() => setVatModalOpen(false)}>
          <form className="space-y-4" onSubmit={handleVatSubmit}>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Matière inchangée : <strong>{selectedLine.product}</strong>. Cette trace n'impacte pas la date de péremption du bloc.
            </div>
            <label className="block">
              <span className="label">Cuve rechargée</span>
              <input className="field mt-1" name="vat" defaultValue={selectedLine.vat} required />
            </label>
            <label className="block">
              <span className="label">Date / heure</span>
              <input className="field mt-1" name="changedAt" type="datetime-local" defaultValue={new Date().toISOString().slice(0, 16)} required />
            </label>
            <label className="block">
              <span className="label">Opérateur</span>
              <input className="field mt-1" name="operator" defaultValue="Opérateur démo" required />
            </label>
            <label className="block">
              <span className="label">Commentaire</span>
              <textarea className="field mt-1 min-h-20" name="comment" placeholder="Ex : recharge de cuve, matière inchangée" />
            </label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button className="w-full sm:w-auto" type="button" variant="ghost" onClick={() => setVatModalOpen(false)}>Annuler</Button>
              <Button className="w-full sm:w-auto" type="submit">Tracer la recharge</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Declare replacement modal */}
      {declareModalOpen && (
        <Modal title="Déclarer un remplacement" onClose={() => setDeclareModalOpen(false)}>
          <form className="space-y-4" onSubmit={handleDeclareSubmit}>
            <div className="rounded-lg bg-teal-50 border border-teal-200 px-4 py-3 text-sm text-teal-800 font-medium">
              Remplacement du bloc de remplissage — {selectedLine.name}
            </div>
            <label className="block">
              <span className="label">Date / heure du remplacement</span>
              <input className="field mt-1" name="changedAt" type="datetime-local" defaultValue={new Date().toISOString().slice(0, 16)} required />
            </label>
            <label className="block">
              <span className="label">Opérateur</span>
              <input className="field mt-1" name="operator" defaultValue="Opérateur démo" required />
            </label>
            <label className="block">
              <span className="label">Commentaire</span>
              <textarea className="field mt-1 min-h-20" name="comment" placeholder="Ex : remplacement avant redémarrage" />
            </label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button className="w-full sm:w-auto" type="button" variant="ghost" onClick={() => setDeclareModalOpen(false)}>Annuler</Button>
              <Button className="w-full sm:w-auto" type="submit">Valider le remplacement</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
