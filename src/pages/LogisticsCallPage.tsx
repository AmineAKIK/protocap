import {
  Bell,
  Check,
  Clock3,
  Eye,
  PackageCheck,
  Siren,
  Truck,
  XCircle,
  Zap
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { initialLogisticsRequests } from '../data/logisticsData';
import { useLogisticsWorkspace } from '../features/logistics/useLogisticsWorkspace';
import { useNow } from '../hooks/useNow';
import type { LogisticsRequest, LogisticsStatus, Priority } from '../types/logistics';
import { formatDateTime } from '../utils/date';
import { logisticsStatusLabels, nextLogisticsId } from '../utils/logistics';
import { canTransitionLogisticsStatus } from '../features/logistics/logisticsModel';
import { Modal } from '../components/Modal';

const statusTone: Record<LogisticsStatus, 'amber' | 'blue' | 'teal' | 'green' | 'slate'> = {
  waiting: 'amber',
  seen: 'blue',
  inProgress: 'teal',
  pickedUp: 'green',
  cancelled: 'slate'
};

const activeStatuses: LogisticsStatus[] = ['waiting', 'seen', 'inProgress'];
const doneStatuses: LogisticsStatus[] = ['pickedUp', 'cancelled'];

function elapsedLabel(createdAt: string, endAt: Date): string {
  const seconds = Math.max(0, Math.floor((endAt.getTime() - new Date(createdAt).getTime()) / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ${seconds % 60} s`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours} h ${mins} min` : `${hours} h`;
}

interface RequestCardProps {
  request: LogisticsRequest;
  onUpdate: (id: string, status: LogisticsStatus) => void;
  onCancel: (id: string) => void;
  disabled: boolean;
  isNew: boolean;
  now: Date;
}

function RequestCard({ request, onUpdate, onCancel, disabled, isNew, now }: RequestCardProps) {
  const isHigh = request.priority === 'high';
  const isWaiting = request.status === 'waiting';
  const isDone = doneStatuses.includes(request.status);
  const isUrgent = isHigh || (isWaiting && (now.getTime() - new Date(request.createdAt).getTime()) / 60000 > 15);
  const elapsedEndAt = isDone ? (request.completedAt ? new Date(request.completedAt) : null) : now;

  return (
    <article
      className={`min-w-0 rounded-xl border-2 bg-white p-4 shadow-sm transition-all duration-300 ${
        isNew ? 'animate-slide-in' : ''
      } ${isUrgent && isWaiting ? 'border-rose-400' : 'border-slate-200'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {isHigh && isWaiting ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-1 text-xs font-bold text-white animate-pulse">
              <Siren size={11} /> URGENT
            </span>
          ) : null}
          <strong className="break-normal text-sm font-bold text-slate-950">{request.id}</strong>
        </div>
        <Badge tone={statusTone[request.status]}>{logisticsStatusLabels[request.status]}</Badge>
      </div>

      <p className="mt-2 break-normal text-sm font-semibold text-slate-800">{request.line} · {request.zone}</p>
      <p className="mt-1 break-normal text-xs text-slate-500">
        {request.palletCount} palette{request.palletCount > 1 ? 's' : ''} · {request.nature}
      </p>
      {request.comment ? (
        <p className="mt-2 break-normal text-xs italic text-slate-600">"{request.comment}"</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <Clock3 size={13} className={`shrink-0 ${isUrgent && isWaiting ? 'text-rose-500' : 'text-slate-400'}`} />
        <span className="text-slate-500">{formatDateTime(request.createdAt)}</span>
        <span className={`ml-auto font-semibold tabular-nums ${isUrgent && isWaiting ? 'text-rose-600' : 'text-slate-600'}`}>
          {elapsedEndAt ? elapsedLabel(request.createdAt, elapsedEndAt) : 'Durée inconnue'}
        </span>
      </div>
      {isDone ? (
        <p className="mt-2 break-normal text-xs font-medium text-slate-600">
          Clôture : {request.completedAt ? formatDateTime(request.completedAt) : 'heure inconnue'}
        </p>
      ) : null}

      <div className="mt-3 grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
        {canTransitionLogisticsStatus(request.status, 'seen') ? (
          <Button disabled={disabled} className="w-full" variant="ghost" icon={<Eye size={14} />} onClick={() => onUpdate(request.id, 'seen')}>Vu</Button>
        ) : null}
        {canTransitionLogisticsStatus(request.status, 'inProgress') ? (
          <Button disabled={disabled} className="w-full" variant="secondary" icon={<Truck size={14} />} onClick={() => onUpdate(request.id, 'inProgress')}>
            En route
          </Button>
        ) : null}
        {canTransitionLogisticsStatus(request.status, 'pickedUp') ? (
          <Button disabled={disabled} className="w-full" icon={<PackageCheck size={14} />} onClick={() => onUpdate(request.id, 'pickedUp')}>
            Récupéré
          </Button>
        ) : null}
        {canTransitionLogisticsStatus(request.status, 'cancelled') ? (
          <Button disabled={disabled} className="w-full" variant="danger" icon={<XCircle size={14} />} onClick={() => onCancel(request.id)}>
            Annuler
          </Button>
        ) : null}
      </div>
    </article>
  );
}

export function LogisticsCallPage() {
  const { requests, status: persistenceStatus, futureVersion, createRequest: persistCreate, updateStatus: persistStatusUpdate } = useLogisticsWorkspace(initialLogisticsRequests);
  const [mobileTab, setMobileTab] = useState<'line' | 'logistics'>('line');
  const [confirmation, setConfirmation] = useState('');
  const [persistenceError, setPersistenceError] = useState('');
  const [cancelRequestId, setCancelRequestId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState('');
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCreateRef = useRef<{ fingerprint: string; id: string; createdAt: string } | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const now = useNow(1000);
  const mutationsBlocked = persistenceStatus === 'readonly' || persistenceStatus === 'recovery' || persistenceStatus === 'degraded';

  const stats = useMemo(() => ({
    waiting: requests.filter((r) => r.status === 'waiting').length,
    inProgress: requests.filter((r) => r.status === 'inProgress').length,
    pickedUp: requests.filter((r) => r.status === 'pickedUp').length
  }), [requests]);

  const activeRequests = requests.filter((r) => activeStatuses.includes(r.status));
  const doneRequests = requests.filter((r) => doneStatuses.includes(r.status));

  useEffect(() => {
    if (!persistenceError) return;
    errorRef.current?.focus();
  }, [persistenceError]);

  function writeErrorMessage(reason: string) {
    if (reason === 'quota') return 'Sauvegarde locale impossible : quota du navigateur atteint. L’appel n’est pas confirmé et le formulaire est conservé.';
    if (reason === 'future-version' || reason === 'readonly') return 'Cette version ne peut pas modifier les données Logistics locales. Le formulaire est conservé.';
    if (reason === 'concurrency-unavailable') return 'Protection multi-onglets indisponible : Logistics passe en lecture seule et le formulaire est conservé.';
    if (reason === 'conflict') return 'Les données Logistics ont changé dans un autre onglet. Elles ont été préservées ; réessayez sur l’état actualisé.';
    if (reason === 'verify') return 'Sauvegarde locale non vérifiable. L’appel n’est pas confirmé et le formulaire est conservé.';
    if (reason === 'invalid-transition') return 'Transition Logistics interdite. Aucun changement n’a été enregistré.';
    return 'Sauvegarde locale impossible. Aucun succès n’est confirmé et les données saisies restent disponibles.';
  }

  async function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const fingerprint = JSON.stringify(Array.from(data.entries()));
    const pending = pendingCreateRef.current?.fingerprint === fingerprint
      ? pendingCreateRef.current
      : { fingerprint, id: nextLogisticsId(requests), createdAt: new Date().toISOString() };
    pendingCreateRef.current = pending;
    const id = pending.id;
    const request: LogisticsRequest = {
      id,
      line: String(data.get('line')),
      zone: String(data.get('zone')),
      palletCount: Number(data.get('palletCount')),
      priority: String(data.get('priority')) as Priority,
      nature: String(data.get('nature')),
      comment: String(data.get('comment') || ''),
      createdAt: pending.createdAt,
      status: 'waiting'
    };
    const persisted = await persistCreate(request);
    if (persisted.status === 'degraded') {
      setConfirmation('');
      setPersistenceError(writeErrorMessage(persisted.reason));
      return;
    }

    const persistedId = persisted.requestId ?? id;
    setPersistenceError('');
    setNewIds((prev) => new Set(prev).add(persistedId));
    setTimeout(() => setNewIds((prev) => { const next = new Set(prev); next.delete(persistedId); return next; }), 1500);

    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirmation(`Appel ${persistedId} enregistré localement — ${request.palletCount} palette${request.palletCount > 1 ? 's' : ''} · ${request.line}`);
    confirmTimerRef.current = setTimeout(() => setConfirmation(''), 5000);
    form.reset();
    setMobileTab('logistics');
  }

  async function updateStatus(id: string, status: LogisticsStatus) {
    const result = await persistStatusUpdate(id, status, new Date().toISOString());
    if (result.status === 'degraded') {
      setPersistenceError(writeErrorMessage(result.reason));
      return false;
    }
    setPersistenceError('');
    return true;
  }

  async function confirmCancellation() {
    if (!cancelRequestId) return;
    const result = await persistStatusUpdate(cancelRequestId, 'cancelled', new Date().toISOString());
    if (result.status === 'degraded') {
      setCancelError(writeErrorMessage(result.reason));
      return;
    }
    setCancelError('');
    setCancelRequestId(null);
  }

  return (
    <div className="mx-auto min-w-0 max-w-7xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-4 min-w-0 sm:mb-6">
        <p className="label">Module logistique</p>
        <h1 className="mt-1 break-normal text-xl font-bold text-slate-950 sm:mt-2 sm:text-3xl">Logistics Call</h1>
        <p className="mt-1 hidden max-w-3xl break-normal text-slate-600 sm:mt-2 sm:block">
          Appels palettes côté ligne, priorités, statuts de traitement et board logistique persisté localement dans ce navigateur.
        </p>
        <p className="mt-1 hidden max-w-3xl break-normal text-sm font-semibold text-teal-800 sm:mt-2 sm:block">
          Demandes visibles, suivies et priorisées dans l’état local de ce navigateur.
        </p>
      </div>

      {persistenceStatus !== 'persisted' && persistenceStatus !== 'memory' && persistenceStatus !== 'write-failed' ? (
        <div role={persistenceStatus === 'recovery' || persistenceStatus === 'readonly' ? 'alert' : 'status'} className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          {persistenceStatus === 'readonly'
            ? `Version Logistics plus récente détectée${futureVersion ? ` (v${futureVersion})` : ''}. Lecture seule pour préserver les données.`
            : persistenceStatus === 'recovery'
              ? 'Données Logistics locales invalides : aucune réécriture automatique. Récupération requise.'
              : 'Stockage Logistics local indisponible. Aucune durabilité n’est revendiquée.'}
        </div>
      ) : null}

      {confirmation ? (
        <div role="status" aria-live="polite" className="mb-4 flex min-w-0 items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 animate-slide-in">
          <Check size={18} className="shrink-0 text-emerald-600" />
          <span className="min-w-0 break-normal">{confirmation}</span>
        </div>
      ) : null}
      {persistenceError ? (
        <div ref={errorRef} tabIndex={-1} role="alert" className="mb-4 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">
          {persistenceError}
        </div>
      ) : null}

      <div
        className="sticky top-[var(--app-header-height)] z-30 -mx-3 mb-4 border-y border-slate-200 bg-slate-50/95 p-2 backdrop-blur xl:hidden"
        role="group"
        aria-label="Vue Logistics Call"
      >
        <div className="grid grid-cols-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            className={`min-h-11 min-w-0 rounded-lg px-3 text-sm font-semibold transition ${mobileTab === 'line' ? 'bg-teal-700 text-white shadow' : 'text-slate-600'}`}
            onClick={() => setMobileTab('line')}
          >
            Ligne cond.
          </button>
          <button
            type="button"
            className={`relative min-h-11 min-w-0 rounded-lg px-3 text-sm font-semibold transition ${mobileTab === 'logistics' ? 'bg-teal-700 text-white shadow' : 'text-slate-600'}`}
            onClick={() => setMobileTab('logistics')}
          >
            Board logistique
            {stats.waiting > 0 ? (
              <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-rose-600 text-[10px] font-bold text-white">
                {stats.waiting}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-2">
        <section className={`${mobileTab === 'line' ? 'block' : 'hidden'} min-w-0 rounded-2xl border-2 border-teal-500 bg-teal-50 p-2 shadow-md sm:p-4 xl:block`}>
          <div className="mb-3 rounded-xl bg-teal-700 px-3 py-3 text-white sm:px-4">
            <p className="text-xs font-bold uppercase tracking-wide text-teal-100">Écran conducteur</p>
            <h2 className="break-normal text-lg font-black sm:mt-1 sm:text-xl">Appel depuis la ligne</h2>
            <p className="mt-1 hidden break-normal text-sm font-medium leading-6 text-teal-50 sm:mt-2 sm:block">
              Utilisé côté ligne de conditionnement pour signaler une palette prête, une palette vide à fournir ou une zone à libérer.
            </p>
          </div>
          <div className="panel min-w-0 p-4 sm:p-5">
            <div className="mb-5 flex min-w-0 items-start gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700">
                <Bell size={24} />
              </div>
              <div className="min-w-0">
                <h3 className="break-normal text-lg font-bold text-slate-950">Formulaire ligne</h3>
                <p className="break-normal text-sm text-slate-500">L’appel est horodaté et enregistré dans le board local de ce navigateur.</p>
              </div>
            </div>

            <form className="grid min-w-0 gap-4" onSubmit={createRequest} onInput={() => { pendingCreateRef.current = null; setPersistenceError(''); }}>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <label className="min-w-0">
                  <span className="label">Ligne de conditionnement</span>
                  <select className="field mt-1" name="line" required>
                    <option>Ligne de conditionnement A</option>
                    <option>Ligne de conditionnement B</option>
                    <option>Ligne de conditionnement C</option>
                  </select>
                </label>
                <label className="min-w-0">
                  <span className="label">Zone de ligne</span>
                  <input className="field mt-1" name="zone" defaultValue="Sortie conditionnement" required />
                </label>
              </div>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <label className="min-w-0">
                  <span className="label">Palettes</span>
                  <input className="field mt-1" name="palletCount" type="number" min="1" max="20" defaultValue="1" required />
                </label>
                <label className="min-w-0">
                  <span className="label">Priorité</span>
                  <select className="field mt-1" name="priority">
                    <option value="normal">Normale</option>
                    <option value="high">Haute — urgent</option>
                  </select>
                </label>
              </div>
              <label className="min-w-0">
                <span className="label">Nature</span>
                <select className="field mt-1" name="nature">
                  <option>Palette pleine à évacuer</option>
                  <option>Palette vide à fournir</option>
                  <option>Palette à contrôler</option>
                </select>
              </label>
              <label className="min-w-0">
                <span className="label">Commentaire</span>
                <textarea className="field mt-1 min-h-20" name="comment" placeholder="Ex : zone tampon presque pleine" />
              </label>
              <Button disabled={mutationsBlocked} className="w-full py-3 text-base" type="submit" icon={<Zap size={18} />}>
                Enregistrer l'appel logistique
              </Button>
            </form>

            {requests.slice(0, 3).length > 0 ? (
              <div className="mt-6 min-w-0">
                <p className="label mb-3">Mes derniers appels</p>
                <div className="space-y-2">
                  {requests.slice(0, 3).map((r) => (
                    <div key={r.id} className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
                      <span className="min-w-0 truncate font-semibold text-slate-800">{r.id} · {r.line.replace('Ligne de conditionnement ', 'Ligne ')}</span>
                      <span className="shrink-0"><Badge tone={statusTone[r.status]}>{logisticsStatusLabels[r.status]}</Badge></span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className={`${mobileTab === 'logistics' ? 'block' : 'hidden'} min-w-0 rounded-2xl border-2 border-slate-500 bg-white p-2 shadow-md sm:p-4 xl:block`}>
          <div className="mb-3 rounded-xl bg-slate-900 px-3 py-3 text-white sm:px-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-300">Écran logistique</p>
            <h2 className="break-normal text-lg font-black sm:mt-1 sm:text-xl">Board de traitement</h2>
            <p className="mt-1 hidden break-normal text-sm font-medium leading-6 text-slate-200 sm:mt-2 sm:block">
              Les demandes enregistrées dans ce navigateur apparaissent ici pour être vues, prises en charge, récupérées ou annulées.
            </p>
          </div>
          <div className="panel min-w-0 p-4 sm:p-5">
            <div className="mb-5 flex min-w-0 flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-900 text-white">
                  <Truck size={22} />
                </div>
                <div className="min-w-0">
                  <h3 className="break-normal text-lg font-bold text-slate-950">Demandes actives</h3>
                  <p className="break-normal text-sm text-slate-500">Statuts, priorités et temps écoulé restent visibles.</p>
                </div>
              </div>
              {stats.waiting > 0 ? (
                <div className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-white shadow-lg">
                  <Bell size={16} className="animate-bounce" />
                  <span className="text-sm font-bold">{stats.waiting} en attente</span>
                </div>
              ) : null}
            </div>

            <div className="mb-4 grid grid-cols-3 gap-2 sm:mb-5 sm:gap-3">
              <div className="min-w-0 rounded-xl border border-amber-200 bg-amber-50 p-2 text-center sm:p-4">
                <p className="text-[10px] font-semibold text-amber-700 sm:text-xs sm:uppercase sm:tracking-wide">Attente</p>
                <p className="mt-1 text-2xl font-bold text-slate-950">{stats.waiting}</p>
              </div>
              <div className="min-w-0 rounded-xl border border-teal-200 bg-teal-50 p-2 text-center sm:p-4">
                <p className="text-[10px] font-semibold text-teal-700 sm:text-xs sm:uppercase sm:tracking-wide">En cours</p>
                <p className="mt-1 text-2xl font-bold text-slate-950">{stats.inProgress}</p>
              </div>
              <div className="min-w-0 rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-center sm:p-4">
                <p className="text-[10px] font-semibold text-emerald-700 sm:text-xs sm:uppercase sm:tracking-wide">Récupérés</p>
                <p className="mt-1 text-2xl font-bold text-slate-950">{stats.pickedUp}</p>
              </div>
            </div>

            {activeRequests.length > 0 ? (
              <div className="space-y-3">
                {activeRequests.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    onUpdate={updateStatus}
                    onCancel={(id) => { setCancelError(''); setCancelRequestId(id); }}
                    disabled={mutationsBlocked}
                    isNew={newIds.has(request.id)}
                    now={now}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-slate-200 py-12 text-center text-slate-500">
                <PackageCheck size={32} className="mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-medium">Aucune demande active</p>
                <p className="mt-1 break-normal text-xs">Créez un appel côté ligne de conditionnement pour voir une carte apparaître ici.</p>
              </div>
            )}

            {doneRequests.length > 0 ? (
              <details className="mt-4">
                <summary className="cursor-pointer rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">
                  Terminées / Annulées ({doneRequests.length})
                </summary>
                <div className="mt-3 space-y-3">
                  {doneRequests.map((request) => (
                    <RequestCard key={request.id} request={request} onUpdate={updateStatus} onCancel={(id) => { setCancelError(''); setCancelRequestId(id); }} disabled={mutationsBlocked} isNew={false} now={now} />
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        </section>
      </div>

      {cancelRequestId ? (
        <Modal title="Confirmer l’annulation" onClose={() => { setCancelError(''); setCancelRequestId(null); }}>
          <div className="space-y-4">
            <p className="break-normal text-sm text-slate-700">
              Annuler {cancelRequestId} ? Cette transition est terminale et l’heure de clôture sera celle de cette confirmation.
            </p>
            {cancelError ? <p role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm font-semibold text-rose-900">{cancelError}</p> : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => { setCancelError(''); setCancelRequestId(null); }}>Retour</Button>
              <Button variant="danger" onClick={() => void confirmCancellation()}>Confirmer l’annulation</Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
