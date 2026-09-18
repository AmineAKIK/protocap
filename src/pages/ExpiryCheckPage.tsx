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
  ShieldCheck
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { initialChangeHistory, initialConditioningLines } from '../data/expiryData';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useNow } from '../hooks/useNow';
import type { ChangeHistoryEntry, ConditioningLine } from '../types/expiry';
import { hoursUntil } from '../utils/date';
import { DeclarationForm } from '../features/expiry/DeclarationForm';
import { prepareDeclaration, type DeclarationDraft, type DeclarationError, type DeclarationKind } from '../features/expiry/declaration';
import { formatStoredTime as formatDateTime, instantMilliseconds } from '../features/expiry/time';
import { getBlockStatus as getTemporalBlockStatus, getLineStatus, statusLabel, earliestExpiry, latestChange, remainingValidityPercent } from '../utils/expiry';

const statusTone = {
  ok: 'green',
  warning: 'amber',
  expired: 'red',
  conform: 'green',
  watch: 'amber',
  nonConform: 'red',
  unknown: 'slate'
} as const;

function getBlockStatus(line: ConditioningLine, now: Date) {
  return getLineStatus(line, now) === 'unknown' ? 'unknown' : getTemporalBlockStatus(line, now);
}

function canGroupHistoryEntry(entry: ChangeHistoryEntry, now: Date) {
  const changedAt = instantMilliseconds(entry.changedAt);
  const expiresAt = instantMilliseconds(entry.newExpiresAt);
  return changedAt !== null && expiresAt !== null && changedAt <= now.getTime() && expiresAt > changedAt;
}

function remainingLabel(line: ConditioningLine, now: Date) {
  if (getBlockStatus(line, now) === 'unknown') return 'État à vérifier';
  const remaining = hoursUntil(earliestExpiry(line), now);
  if (remaining <= 0) return 'À remplacer';
  const totalHours = Math.ceil(remaining);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days <= 0) return `${hours} h restantes`;
  if (hours === 0) return `${days} j restants`;
  return `${days} j ${hours} h restantes`;
}

function formatDateOnly(dateIso: string) {
  if (instantMilliseconds(dateIso) === null) return 'Date à vérifier';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(dateIso));
}

function formatTimeOnly(dateIso: string) {
  if (instantMilliseconds(dateIso) === null) return 'Date à vérifier';
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

function BlockValidityBar({ line, now }: { line: ConditioningLine; now: Date }) {
  const validityDays = line.elements[0]?.validityDays ?? 5;
  const changedAt = latestChange(line);
  const expiresAt = earliestExpiry(line);
  const pct = remainingValidityPercent(line, now);
  const blockStatus = getBlockStatus(line, now);

  const barColor = blockStatus === 'unknown' ? 'bg-slate-500' : blockStatus === 'expired' ? 'bg-rose-500' : blockStatus === 'warning' ? 'bg-amber-400' : 'bg-emerald-500';
  const label = remainingLabel(line, now);

  if (pct === null) return <p className="break-normal text-sm font-semibold text-slate-700">Validité indéterminée — données à vérifier.</p>;

  return (
    <div className="min-w-0">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-1 text-xs text-slate-500">
        <span className="break-normal">Validité estimée restante ({validityDays} jours calendaires)</span>
        <span className={
          blockStatus === 'unknown' ? 'font-bold text-slate-700' :
          blockStatus === 'expired' ? 'font-bold text-rose-700' :
          blockStatus === 'warning' ? 'font-bold text-amber-700' :
          'font-medium text-emerald-700'
        }>
          {label}
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-3 rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 flex flex-wrap justify-between gap-x-2 text-xs text-slate-600">
        <span>Posé le {formatDateTime(changedAt)}</span>
        <span>Limite {formatDateTime(expiresAt)}</span>
      </div>
      <p className="mt-2 break-normal text-xs text-slate-600">Calcul local · validité estimée à partir de la dernière déclaration enregistrée.</p>
    </div>
  );
}

function BlockedModal({ line, now, onClose, onDeclare }: {
  line: ConditioningLine;
  now: Date;
  onClose: () => void;
  onDeclare: () => void;
}) {
  return (
    <Modal title="Bloc de remplissage expiré — démarrage bloqué" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex min-w-0 items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900">
          <Ban size={22} className="mt-0.5 shrink-0 text-rose-600" />
          <p className="min-w-0 break-normal leading-6">
            Sur <strong>{line.name}</strong>, le bloc de remplissage a dépassé sa période d'utilisation de {line.elements[0]?.validityDays ?? 5} jours.
          </p>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4">
          <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
            <p className="min-w-0 break-normal font-bold text-rose-900">Bloc de remplissage</p>
            <Badge tone="red">Expiré</Badge>
          </div>
          <BlockValidityBar line={line} now={now} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Déclarez le remplacement du bloc pour débloquer le démarrage.
        </div>

        <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
          <Button className="w-full sm:w-auto" variant="ghost" onClick={onClose}>Voir quand même</Button>
          <Button className="w-full sm:w-auto" variant="danger" icon={<Plus size={15} />} onClick={onDeclare}>
            Déclarer le remplacement
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function ExpiryCheckPage() {
  const [lines, setLines] = useLocalStorage<ConditioningLine[]>('lineops.expiry.lines', initialConditioningLines);
  const [history, setHistory] = useLocalStorage<ChangeHistoryEntry[]>('lineops.expiry.history', initialChangeHistory);
  const now = useNow();
  const [selectedLineId, setSelectedLineId] = useState(lines[0]?.id ?? '');
  const [declareModalOpen, setDeclareModalOpen] = useState(false);
  const [blockedModalOpen, setBlockedModalOpen] = useState(() =>
    lines[0] ? getLineStatus(lines[0], now) === 'nonConform' : false
  );
  const [vatModalOpen, setVatModalOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mobileView, setMobileView] = useState<'tour' | 'line'>('line');

  const selectedLine = lines.find((l) => l.id === selectedLineId) ?? lines[0];
  const lineStatus = getLineStatus(selectedLine, now);
  const isBlocked = lineStatus === 'nonConform';
  const isUnknown = lineStatus === 'unknown';

  function handleLineSelect(line: ConditioningLine) {
    setSelectedLineId(line.id);
    setBlockedModalOpen(getLineStatus(line, now) === 'nonConform');
  }

  const stats = useMemo(() => {
    const statuses = lines.map((l) => getLineStatus(l, now));
    return {
      conform: statuses.filter((s) => s === 'conform').length,
      watch: statuses.filter((s) => s === 'watch').length,
      blocked: statuses.filter((s) => s === 'nonConform').length,
      unknown: statuses.filter((s) => s === 'unknown').length
    };
  }, [lines, now]);

  function handleDeclaration(kind: DeclarationKind, draft: DeclarationDraft): DeclarationError | null {
    // All validation and date calculations finish before either legacy storage setter.
    // Atomic persistence and failed-write recovery remain PR-05/06, not a claim of this preflight.
    if (!selectedLine) return { field: 'form', message: 'La ligne sélectionnée n’existe plus.' };
    let id: string;
    try { id = crypto.randomUUID(); }
    catch { return { field: 'form', message: 'Identifiant indisponible. Aucune donnée n’a été modifiée.' }; }
    const result = prepareDeclaration(lines, selectedLine.id, kind, draft, new Date(), id);
    if (!result.ok) return result.error;
    setLines(result.lines);
    setHistory((current) => [result.entry, ...current]);
    if (kind === 'replacement') setDeclareModalOpen(false);
    else setVatModalOpen(false);
    return null;
  }

  function openDeclareFromBlockedModal() {
    setBlockedModalOpen(false);
    setDeclareModalOpen(true);
  }

  if (!selectedLine) return (
    <div className="mx-auto min-w-0 max-w-7xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
      <h1 className="break-normal text-xl font-bold">Expiry Check</h1>
      <p className="mt-4 break-normal">Aucune ligne exploitable. Les données existantes restent conservées ; aucune conformité ne peut être établie.</p>
    </div>
  );

  const blockStatus = getBlockStatus(selectedLine, now);
  const selectedLineHistory = history.filter((entry) => entry.lineId === selectedLine.id);
  const currentBlockChangedAt = new Date(latestChange(selectedLine)).getTime();
  const blockHistory = selectedLineHistory.filter(isBlockHistoryEntry).filter((entry) => canGroupHistoryEntry(entry, now));
  const hasCurrentBlockHistory = blockHistory.some(
    (entry) => Math.abs(new Date(entry.changedAt).getTime() - currentBlockChangedAt) < 1000
  );
  const currentBlockHistory: ChangeHistoryEntry = {
    id: `current-block-${selectedLine.id}-${latestChange(selectedLine)}`,
    lineId: selectedLine.id,
    lineName: selectedLine.name,
    elementLabel: 'État courant du bloc — sans déclaration enregistrée',
    changedAt: latestChange(selectedLine),
    operator: selectedLine.elements[0]?.operator ?? 'Opérateur non renseigné',
    comment: selectedLine.elements[0]?.comment,
    newExpiresAt: earliestExpiry(selectedLine)
  };
  const blockInstances = (hasCurrentBlockHistory || isUnknown ? blockHistory : [currentBlockHistory, ...blockHistory])
    .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
  const vatEntries = selectedLineHistory
    .filter(isVatHistoryEntry)
    .filter((entry) => canGroupHistoryEntry(entry, now))
    .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
  const blockHistoryGroups = blockInstances.map((block, index) => {
    const blockStartedAt = new Date(block.changedAt).getTime();
    const nextBlockStartedAt = index > 0 ? new Date(blockInstances[index - 1].changedAt).getTime() : Number.POSITIVE_INFINITY;
    return {
      block,
      isCurrent: !isUnknown && blockStartedAt === currentBlockChangedAt,
      vatEntries: vatEntries.filter((entry) => {
        const changedAt = new Date(entry.changedAt).getTime();
        return changedAt >= blockStartedAt && changedAt < nextBlockStartedAt;
      })
    };
  });
  const vatHistory = blockHistoryGroups.find((group) => group.isCurrent)?.vatEntries ?? [];
  const registerEntryCount = blockHistoryGroups.reduce((count, group) => count + 1 + group.vatEntries.length, 0);
  const washerBoard = lines;
  const groupedIds = new Set(blockHistoryGroups.flatMap((group) => [group.block.id, ...group.vatEntries.map((entry) => entry.id)]));
  const unclassifiedEntries = selectedLineHistory.filter((entry) => !groupedIds.has(entry.id));

  return (
    <div className="mx-auto min-w-0 max-w-7xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-4 min-w-0 sm:mb-6">
        <p className="label">Module qualité</p>
        <h1 className="mt-1 break-normal text-xl font-bold text-slate-950 sm:mt-2 sm:text-3xl">Expiry Check</h1>
        <p className="mt-1 hidden max-w-3xl break-normal text-slate-600 sm:mt-2 sm:block">
          Validité du bloc de remplissage, recharges de cuves et registre de traçabilité par ligne de conditionnement.
        </p>
        <p className="mt-1 hidden max-w-3xl break-normal text-sm font-semibold text-teal-800 sm:mt-2 sm:block">
          Échéances visibles. Remplacements priorisés. Trace exploitable en cas d'investigation.
        </p>
      </div>

      {unclassifiedEntries.length > 0 && <section className="mb-4 min-w-0 rounded-xl border border-amber-300 bg-amber-50 p-3">
        <h2 className="break-normal font-bold">Traces non rattachables — à vérifier</h2>
        <p className="break-normal text-sm">Ces traces sont conservées sans inventer de date ni les attribuer à un bloc.</p>
        {unclassifiedEntries.map((entry, index) => <div key={index} className="mt-2 min-w-0 text-sm">
          <p className="break-normal">{entry.elementLabel} · {entry.operator}</p>
          <div className="max-w-full overflow-x-auto"><code>{entry.changedAt}</code></div>
          {entry.comment && <p className="break-normal">{entry.comment}</p>}
        </div>)}
      </section>}

      <div
        className="sticky top-[var(--app-header-height)] z-30 -mx-3 mb-4 border-y border-slate-200 bg-slate-50/95 px-3 py-2 backdrop-blur lg:hidden"
        role="group"
        aria-label="Vue Expiry Check"
      >
        <div className="grid grid-cols-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            className={`min-h-11 min-w-0 rounded-lg px-3 text-sm font-semibold transition ${mobileView === 'line' ? 'bg-teal-700 text-white shadow' : 'text-slate-600'}`}
            onClick={() => setMobileView('line')}
          >
            Ligne
          </button>
          <button
            type="button"
            className={`min-h-11 min-w-0 rounded-lg px-3 text-sm font-semibold transition ${mobileView === 'tour' ? 'bg-teal-700 text-white shadow' : 'text-slate-600'}`}
            onClick={() => setMobileView('tour')}
          >
            Tournée
          </button>
        </div>
      </div>

      <section className={`${mobileView === 'line' ? 'block' : 'hidden'} min-w-0 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:p-4 lg:block`}>
        <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-3 rounded-xl bg-slate-900 px-3 py-3 text-white sm:px-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-300">Écran conducteur</p>
            <h2 className="break-normal text-lg font-black sm:mt-1 sm:text-xl">Dashboard ligne</h2>
          </div>
          <p className="hidden max-w-xl break-normal text-sm font-medium leading-6 text-slate-200 sm:block">
            Utilisé sur la ligne concernée pour déclarer le bloc de remplissage, tracer les recharges de cuves et alimenter le board laveur.
          </p>
        </div>

        <div className="min-w-0 space-y-3 sm:space-y-4">
          <section className="panel min-w-0 p-2 sm:p-3 lg:p-4">
            <p className="label hidden sm:block">Navigation entre lignes</p>
            <p className="mt-1 hidden break-normal text-sm leading-6 text-slate-600 sm:block">
              Dans un usage terrain, chaque ligne dispose de son propre dashboard. Le sélecteur affiche plusieurs lignes uniquement pour parcourir les états de la maquette : conforme, vigilance et non conforme.
            </p>
            <div className="-mx-2 mt-1 max-w-full overflow-x-auto px-2 pb-1 sm:mt-3">
              <div className="flex w-max min-w-full gap-2">
                {lines.map((line) => {
                  const status = getLineStatus(line, now);
                  const isSelected = line.id === selectedLine.id;
                  const selectorTone =
                    status === 'unknown' ? 'border-slate-400 bg-slate-100 text-slate-900' :
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
                      onClick={() => handleLineSelect(line)}
                      className={`min-h-11 shrink-0 whitespace-nowrap rounded-lg border px-3 py-2 text-left text-sm font-semibold transition ${selectorTone}`}
                    >
                      {line.name.replace('Ligne de conditionnement ', 'Ligne ')}
                      <span className={`ml-2 hidden font-normal sm:inline ${isSelected && status !== 'unknown' ? 'text-white/90' : ''}`}>{statusLabel(status)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="min-w-0 space-y-4">
            {isUnknown ? (
              <div className="min-w-0 rounded-xl border-2 border-slate-400 bg-slate-50 p-3 sm:p-4">
                <p className="break-normal font-bold">État à vérifier</p>
                <p className="break-normal text-sm">Bloc : état temporel incohérent ou incomplet. Aucune autorisation de démarrage ne peut être établie. Les données restent conservées pour vérification.</p>
              </div>
            ) : isBlocked ? (
              <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-xl border-2 border-rose-400 bg-rose-50 p-3 sm:p-4">
                <Ban size={20} className="shrink-0 text-rose-600" />
                <p className="min-w-0 flex-1 break-normal text-sm font-semibold text-rose-900">
                  Bloc de remplissage expiré — démarrage non conforme.
                </p>
                <button
                  type="button"
                  onClick={() => setBlockedModalOpen(true)}
                  className="min-h-11 shrink-0 rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-700"
                >
                  Voir
                </button>
              </div>
            ) : lineStatus === 'conform' ? (
              <div className="flex min-w-0 items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 sm:p-4">
                <ShieldCheck size={20} className="shrink-0 text-emerald-600" />
                <p className="min-w-0 break-normal text-sm font-semibold text-emerald-900">Démarrage de la ligne autorisé — bloc de remplissage dans sa période de validité.</p>
              </div>
            ) : (
              <div className="flex min-w-0 items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 sm:p-4">
                <AlertTriangle size={20} className="shrink-0 text-amber-600" />
                <p className="min-w-0 break-normal text-sm font-semibold text-amber-900">Vigilance — bloc de remplissage en fin de validité. Prévoir le remplacement.</p>
              </div>
            )}

            <div className="panel min-w-0 p-3 sm:p-5">
              <div className="flex min-w-0 flex-col gap-1 sm:gap-3">
                <div className="min-w-0">
                  <p className="label">Ligne sélectionnée</p>
                  <h2 className="mt-0.5 break-normal text-base font-bold text-slate-950 sm:mt-1 sm:text-lg">{selectedLine.name}</h2>
                  <p className="break-normal text-sm text-slate-600">{selectedLine.vat} · {selectedLine.product}</p>
                </div>
              </div>

              <div className="mt-3 grid min-w-0 gap-3 sm:mt-5 sm:gap-4 xl:grid-cols-2">
                <div className={`min-w-0 rounded-xl border-2 p-3 sm:p-5 ${
                  blockStatus === 'unknown' ? 'border-slate-300 bg-slate-50' :
                  blockStatus === 'expired' ? 'border-rose-300 bg-rose-50' :
                  blockStatus === 'warning' ? 'border-amber-200 bg-amber-50/40' :
                  'border-slate-200 bg-white'
                }`}>
                  <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
                    <h3 className="min-w-0 break-normal text-sm font-bold text-slate-950 sm:text-base">Bloc de remplissage</h3>
                    <Badge tone={statusTone[blockStatus]}>{statusLabel(blockStatus)}</Badge>
                  </div>

                  <div className="grid min-w-0 grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:gap-3">
                    <div className="min-w-0 rounded-xl bg-white p-2.5 ring-1 ring-slate-200 sm:p-4">
                      <p className="label text-[10px] sm:text-xs">Bloc changé le</p>
                      <p className="mt-1 break-normal text-base font-black tabular-nums text-slate-950 sm:mt-2 sm:text-xl">{formatDateOnly(latestChange(selectedLine))}</p>
                      <p className="text-sm font-bold tabular-nums text-slate-700 sm:text-lg">{formatTimeOnly(latestChange(selectedLine))}</p>
                    </div>
                    <div className={`min-w-0 rounded-xl p-2.5 ring-1 sm:p-4 ${blockStatus === 'unknown' ? 'bg-slate-100 ring-slate-300' : blockStatus === 'expired' ? 'bg-rose-100 ring-rose-200' : blockStatus === 'warning' ? 'bg-amber-100 ring-amber-200' : 'bg-emerald-50 ring-emerald-200'}`}>
                      <p className="label text-[10px] sm:text-xs">Péremption bloc</p>
                      <p className={`mt-1 break-normal text-base font-black tabular-nums sm:mt-2 sm:text-xl ${blockStatus === 'unknown' ? 'text-slate-800' : blockStatus === 'expired' ? 'text-rose-800' : blockStatus === 'warning' ? 'text-amber-900' : 'text-emerald-900'}`}>{formatDateOnly(earliestExpiry(selectedLine))}</p>
                      <p className={`text-sm font-bold tabular-nums sm:text-lg ${blockStatus === 'unknown' ? 'text-slate-700' : blockStatus === 'expired' ? 'text-rose-700' : blockStatus === 'warning' ? 'text-amber-800' : 'text-emerald-800'}`}>{formatTimeOnly(earliestExpiry(selectedLine))}</p>
                    </div>
                  </div>

                  <div className="my-3 sm:my-5">
                    <BlockValidityBar line={selectedLine} now={now} />
                  </div>

                  <dl className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 text-sm sm:gap-y-2">
                    <dt className="min-w-0 break-normal text-slate-600">Temps restant</dt>
                    <dd className={`text-right font-black ${blockStatus === 'unknown' ? 'text-slate-700' : blockStatus === 'expired' ? 'text-rose-700' : blockStatus === 'warning' ? 'text-amber-800' : 'text-emerald-700'}`}>
                      {remainingLabel(selectedLine, now)}
                    </dd>
                    <dt className="min-w-0 break-normal text-slate-600">Validité</dt>
                    <dd className="text-right font-medium text-slate-800">{isUnknown ? 'À vérifier' : `${selectedLine.elements[0].validityDays} jours calendaires`}</dd>
                    <dt className="min-w-0 break-normal text-slate-600">Déclaré par</dt>
                    <dd className="max-w-[12rem] break-normal text-right font-medium text-slate-800">{selectedLine.elements[0]?.operator}</dd>
                  </dl>

                  <Button
                    className="mt-3 w-full py-3 text-base shadow-sm sm:mt-5"
                    variant={isBlocked ? 'danger' : 'primary'}
                    disabled={isUnknown}
                    onClick={() => setDeclareModalOpen(true)}
                  >
                    {isBlocked ? 'Remplacer le bloc de remplissage' : 'Déclarer un remplacement'}
                  </Button>
                </div>

                <div className="min-w-0 rounded-xl border-2 border-slate-200 bg-white p-3 sm:p-5">
                  <div className="mb-4 flex min-w-0 items-center justify-between gap-3">
                    <h3 className="min-w-0 break-normal text-base font-bold text-slate-950">Recharges de cuves</h3>
                    <Badge tone="slate">{vatHistory.length}</Badge>
                  </div>
                  <p className="break-normal text-sm leading-6 text-slate-600">
                    Recharges tracées pendant la durée de vie du bloc de remplissage courant.
                  </p>
                  <div className="mt-4 space-y-3">
                    {vatHistory.length > 0 ? vatHistory.map((entry) => (
                      <div key={entry.id} className="min-w-0 rounded-xl bg-slate-50 p-3 text-sm">
                        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                          <strong className="min-w-0 break-normal text-slate-950">{entry.elementLabel}</strong>
                          <span className="text-xs text-slate-500">{formatDateTime(entry.changedAt)}</span>
                        </div>
                        <p className="mt-1 break-normal text-slate-600">{entry.operator}</p>
                        {entry.comment ? <p className="mt-1 break-normal text-xs text-slate-500">{entry.comment}</p> : null}
                      </div>
                    )) : (
                      <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                        Aucune recharge tracée sur ce bloc.
                      </div>
                    )}
                  </div>
                  <Button className="mt-5 w-full py-3 text-base shadow-sm" variant="secondary" disabled={isUnknown || isBlocked} icon={<RefreshCcw size={15} />} onClick={() => setVatModalOpen(true)}>
                    Ajouter une recharge de cuve
                  </Button>
                </div>
              </div>
            </div>

            <div className="panel min-w-0 overflow-hidden">
              <button
                type="button"
                className="flex min-h-14 w-full min-w-0 items-center justify-between gap-3 p-3 transition hover:bg-slate-50 sm:p-5"
                onClick={() => setHistoryOpen((v) => !v)}
              >
                <div className="flex min-w-0 items-center gap-2 text-left">
                  <History size={17} className="shrink-0 text-slate-500" />
                  <span className="min-w-0 break-normal font-bold text-slate-950">Registre complet de la ligne</span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{registerEntryCount}</span>
                </div>
                {historyOpen ? <ChevronUp size={17} className="shrink-0 text-slate-400" /> : <ChevronDown size={17} className="shrink-0 text-slate-400" />}
              </button>
              {historyOpen && (
                <div className="border-t border-slate-100 p-4 sm:p-5">
                  <div className="space-y-3">
                    {blockHistoryGroups.map((group) => (
                      <div key={group.block.id} className="min-w-0 rounded-xl border border-slate-200 p-3 text-sm">
                        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <strong className="min-w-0 break-normal text-slate-950">{group.block.elementLabel}</strong>
                            {group.isCurrent ? <Badge tone="teal">Bloc courant</Badge> : null}
                            <Badge tone="slate">{group.vatEntries.length} recharge{group.vatEntries.length > 1 ? 's' : ''}</Badge>
                          </div>
                          <span className="text-slate-500"><Clock size={13} className="mr-1 inline" />{formatDateTime(group.block.changedAt)}</span>
                        </div>
                        <p className="mt-1 break-normal text-slate-600">{group.block.lineName} · {group.block.operator}</p>
                        <p className="mt-1 break-normal text-xs text-slate-500">Limite bloc : {formatDateTime(group.block.newExpiresAt)}</p>
                        {group.block.comment ? <p className="mt-2 break-normal text-slate-600">{group.block.comment}</p> : null}

                        <div className="mt-3 space-y-2 border-l-2 border-teal-100 pl-3">
                          {group.vatEntries.length > 0 ? group.vatEntries.map((entry) => (
                            <div key={entry.id} className="min-w-0 rounded-xl bg-slate-50 p-3">
                              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                                <strong className="min-w-0 break-normal text-slate-800">{entry.elementLabel}</strong>
                                <span className="text-xs text-slate-500">{formatDateTime(entry.changedAt)}</span>
                              </div>
                              <p className="mt-1 break-normal text-slate-600">{entry.operator}</p>
                              {entry.comment ? <p className="mt-1 break-normal text-xs text-slate-500">{entry.comment}</p> : null}
                            </div>
                          )) : (
                            <p className="rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500">
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

      <section className={`${mobileView === 'tour' ? 'block' : 'hidden'} mb-6 mt-3 min-w-0 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:mt-6 sm:p-4 lg:block`}>
        <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-3 rounded-xl bg-teal-700 px-3 py-3 text-white sm:px-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-teal-100">Écran laveur</p>
            <h2 className="break-normal text-lg font-black sm:mt-1 sm:text-xl">Board de tournée</h2>
          </div>
          <p className="hidden max-w-xl break-normal text-sm font-medium leading-6 text-teal-50 sm:block">
            Affiché côté laveur. Chaque carte signale clairement l'état du bloc pour repérer les remplacements à prendre en charge.
          </p>
        </div>
        <div className="min-w-0 rounded-xl border border-teal-200 bg-white p-2 sm:p-5">
          <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2 sm:mb-4 sm:gap-3">
            <div className="min-w-0">
              <p className="label hidden sm:block">Vue consolidée des lignes</p>
              <h2 className="break-normal text-base font-bold text-slate-950 sm:mt-1 sm:text-lg">Blocs à surveiller ou remplacer</h2>
            </div>
            <Route className="shrink-0 text-teal-700" size={20} />
          </div>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:mb-4 sm:grid-cols-4 sm:gap-3">
            <div className="min-w-0 rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-center sm:p-4">
              <p className="text-[10px] font-semibold text-emerald-700 sm:text-xs sm:uppercase sm:tracking-wide">OK</p>
              <p className="mt-1 text-2xl font-bold text-slate-950">{stats.conform}</p>
            </div>
            <div className="min-w-0 rounded-xl border border-amber-200 bg-amber-50 p-2 text-center sm:p-4">
              <p className="text-[10px] font-semibold text-amber-700 sm:text-xs sm:uppercase sm:tracking-wide">Vigilance</p>
              <p className="mt-1 text-2xl font-bold text-slate-950">{stats.watch}</p>
            </div>
            <div className="min-w-0 rounded-xl border border-rose-200 bg-rose-50 p-2 text-center sm:p-4">
              <p className="text-[10px] font-semibold text-rose-700 sm:text-xs sm:uppercase sm:tracking-wide">Bloqués</p>
              <p className="mt-1 text-2xl font-bold text-slate-950">{stats.blocked}</p>
            </div>
            <div className="min-w-0 rounded-xl border border-slate-300 bg-slate-50 p-2 text-center sm:p-4">
              <p className="text-[10px] font-semibold text-slate-700 sm:text-xs">À vérifier</p>
              <p className="mt-1 text-2xl font-bold text-slate-950">{stats.unknown}</p>
            </div>
          </div>
          <div className="grid min-w-0 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
            {washerBoard.map((line) => {
              const status = getBlockStatus(line, now);
              const expiry = earliestExpiry(line);
              return (
                <button
                  key={line.id}
                  type="button"
                  onClick={() => { handleLineSelect(line); setMobileView('line'); }}
                  className={`min-w-0 rounded-xl border p-3 text-left transition hover:border-teal-300 sm:p-4 ${
                    status === 'unknown' ? 'border-slate-300 bg-slate-50' : status === 'expired' ? 'border-rose-300 bg-rose-50' : status === 'warning' ? 'border-amber-200 bg-amber-50/50' : 'border-emerald-200 bg-emerald-50/60'
                  }`}
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="break-normal text-sm font-bold text-slate-950">{line.name.replace('Ligne de conditionnement ', 'Ligne ')}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-600">{line.vat} · {line.product}</p>
                    </div>
                    <Badge tone={statusTone[status]}>{statusLabel(status)}</Badge>
                  </div>
                  <p className={`mt-2 break-normal text-sm font-bold sm:mt-3 sm:text-base ${status === 'unknown' ? 'text-slate-700' : status === 'expired' ? 'text-rose-700' : status === 'warning' ? 'text-amber-800' : 'text-emerald-700'}`}>
                    {remainingLabel(line, now)}
                  </p>
                  <div className="mt-2 min-w-0 rounded-xl bg-white/85 p-2 ring-1 ring-slate-200 sm:mt-3 sm:p-3">
                    <p className="label text-[10px] sm:text-xs">Péremption bloc</p>
                    <p className="mt-1 break-normal text-base font-black tabular-nums text-slate-950 sm:text-lg">{formatDateOnly(expiry)}</p>
                    <p className="text-sm font-bold tabular-nums text-slate-700 sm:text-base">{formatTimeOnly(expiry)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {blockedModalOpen && isBlocked && (
        <BlockedModal
          line={selectedLine}
          now={now}
          onClose={() => setBlockedModalOpen(false)}
          onDeclare={openDeclareFromBlockedModal}
        />
      )}

      {vatModalOpen && (
        <Modal title="Tracer une recharge de cuve" onClose={() => setVatModalOpen(false)}>
          <DeclarationForm key={selectedLine.id} line={selectedLine} kind="refill" onCancel={() => setVatModalOpen(false)} onDeclare={(draft) => handleDeclaration('refill', draft)} />
        </Modal>
      )}
      {declareModalOpen && (
        <Modal title="Déclarer un remplacement" onClose={() => setDeclareModalOpen(false)}>
          <DeclarationForm key={selectedLine.id} line={selectedLine} kind="replacement" onCancel={() => setDeclareModalOpen(false)} onDeclare={(draft) => handleDeclaration('replacement', draft)} />
        </Modal>
      )}
    </div>
  );
}
