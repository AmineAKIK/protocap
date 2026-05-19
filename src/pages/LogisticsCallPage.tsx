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
import { StatCard } from '../components/StatCard';
import { initialLogisticsRequests } from '../data/logisticsData';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useNow } from '../hooks/useNow';
import type { LogisticsRequest, LogisticsStatus, Priority } from '../types/logistics';
import { formatDateTime } from '../utils/date';
import { logisticsStatusLabels, nextLogisticsId } from '../utils/logistics';

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

function urgencyClass(request: LogisticsRequest, now: Date): string {
  if (request.status !== 'waiting') return '';
  const minutes = (now.getTime() - new Date(request.createdAt).getTime()) / 60000;
  if (request.priority === 'high' || minutes > 15) return 'border-rose-400 bg-rose-50';
  return '';
}

interface RequestCardProps {
  request: LogisticsRequest;
  onUpdate: (id: string, status: LogisticsStatus) => void;
  isNew: boolean;
  now: Date;
}

function RequestCard({ request, onUpdate, isNew, now }: RequestCardProps) {
  const isHigh = request.priority === 'high';
  const isWaiting = request.status === 'waiting';
  const isDone = doneStatuses.includes(request.status);
  const isUrgent = isHigh || (isWaiting && (now.getTime() - new Date(request.createdAt).getTime()) / 60000 > 15);
  const elapsedEndAt = isDone ? new Date(request.completedAt ?? request.createdAt) : now;

  return (
    <article
      className={`min-w-0 rounded-xl border-2 bg-white p-4 shadow-sm transition-all duration-300 ${
        isNew ? 'animate-slide-in' : ''
      } ${isUrgent && isWaiting ? 'border-rose-400' : 'border-slate-200'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isHigh && isWaiting ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-1 text-xs font-bold text-white animate-pulse">
              <Siren size={11} /> URGENT
            </span>
          ) : null}
          <strong className="text-sm font-bold text-slate-950">{request.id}</strong>
        </div>
        <Badge tone={statusTone[request.status]}>{logisticsStatusLabels[request.status]}</Badge>
      </div>

      <p className="mt-2 text-sm font-semibold text-slate-800">{request.line} · {request.zone}</p>
      <p className="mt-1 text-xs text-slate-500">
        {request.palletCount} palette{request.palletCount > 1 ? 's' : ''} · {request.nature}
      </p>
      {request.comment ? (
        <p className="mt-2 text-xs text-slate-600 italic">"{request.comment}"</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <Clock3 size={13} className={`shrink-0 ${isUrgent && isWaiting ? 'text-rose-500' : 'text-slate-400'}`} />
        <span className="text-slate-500">{formatDateTime(request.createdAt)}</span>
        <span className={`ml-auto font-semibold tabular-nums ${isUrgent && isWaiting ? 'text-rose-600' : 'text-slate-600'}`}>
          {elapsedLabel(request.createdAt, elapsedEndAt)}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
        {isWaiting ? (
          <Button className="w-full" variant="ghost" icon={<Eye size={14} />} onClick={() => onUpdate(request.id, 'seen')}>Vu</Button>
        ) : null}
        {request.status !== 'pickedUp' && request.status !== 'cancelled' ? (
          <Button className="w-full" variant="secondary" icon={<Truck size={14} />} onClick={() => onUpdate(request.id, 'inProgress')}>
            En route
          </Button>
        ) : null}
        {request.status !== 'pickedUp' && request.status !== 'cancelled' ? (
          <Button className="w-full" icon={<PackageCheck size={14} />} onClick={() => onUpdate(request.id, 'pickedUp')}>
            Récupéré
          </Button>
        ) : null}
        {request.status !== 'cancelled' && request.status !== 'pickedUp' ? (
          <Button className="w-full" variant="danger" icon={<XCircle size={14} />} onClick={() => onUpdate(request.id, 'cancelled')}>
            Annuler
          </Button>
        ) : null}
      </div>
    </article>
  );
}

export function LogisticsCallPage() {
  const [requests, setRequests] = useLocalStorage<LogisticsRequest[]>('lineops.logistics.requests', initialLogisticsRequests);
  const [mobileTab, setMobileTab] = useState<'line' | 'logistics'>('line');
  const [confirmation, setConfirmation] = useState('');
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const now = useNow(1000);

  const stats = useMemo(() => ({
    waiting: requests.filter((r) => r.status === 'waiting').length,
    inProgress: requests.filter((r) => r.status === 'inProgress').length,
    pickedUp: requests.filter((r) => r.status === 'pickedUp').length
  }), [requests]);

  const activeRequests = requests.filter((r) => activeStatuses.includes(r.status));
  const doneRequests = requests.filter((r) => doneStatuses.includes(r.status));

  useEffect(() => {
    setRequests((current) => {
      let changed = false;
      const migrated = current.map((request) => {
        if (!doneStatuses.includes(request.status) || request.completedAt) return request;
        changed = true;
        return { ...request, completedAt: new Date().toISOString() };
      });
      return changed ? migrated : current;
    });
  }, [setRequests]);

  function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const id = nextLogisticsId(requests);
    const request: LogisticsRequest = {
      id,
      line: String(data.get('line')),
      zone: String(data.get('zone')),
      palletCount: Number(data.get('palletCount')),
      priority: String(data.get('priority')) as Priority,
      nature: String(data.get('nature')),
      comment: String(data.get('comment') || ''),
      createdAt: new Date().toISOString(),
      status: 'waiting'
    };
    setRequests((current) => [request, ...current]);
    setNewIds((prev) => new Set(prev).add(id));
    setTimeout(() => setNewIds((prev) => { const next = new Set(prev); next.delete(id); return next; }), 1500);

    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirmation(`Appel ${id} envoyé — ${request.palletCount} palette${request.palletCount > 1 ? 's' : ''} · ${request.line}`);
    confirmTimerRef.current = setTimeout(() => setConfirmation(''), 5000);
    event.currentTarget.reset();

    setMobileTab('logistics');
  }

  function updateStatus(id: string, status: LogisticsStatus) {
    setRequests((current) => current.map((r) => {
      if (r.id !== id) return r;
      if (doneStatuses.includes(status)) {
        return { ...r, status, completedAt: r.completedAt ?? new Date().toISOString() };
      }
      return { ...r, status, completedAt: undefined };
    }));
  }

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-6">
        <p className="label">Module logistique</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">Logistics Call</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Appels palettes côté ligne, priorités, statuts de traitement et board logistique synchronisé.
        </p>
        <p className="mt-2 max-w-3xl text-sm font-semibold text-teal-800">
          Demandes visibles, suivies et priorisées sans perte d'information.
        </p>
      </div>

      {/* Mobile tab switcher */}
      <div className="sticky top-14 z-30 -mx-3 mb-4 border-y border-slate-200 bg-slate-50/95 p-2 backdrop-blur lg:hidden">
        <div className="grid grid-cols-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <button
            className={`min-h-11 rounded-lg px-3 text-sm font-semibold transition ${mobileTab === 'line' ? 'bg-teal-700 text-white shadow' : 'text-slate-600'}`}
            onClick={() => setMobileTab('line')}
          >
            Ligne cond.
          </button>
          <button
            className={`relative min-h-11 rounded-lg px-3 text-sm font-semibold transition ${mobileTab === 'logistics' ? 'bg-teal-700 text-white shadow' : 'text-slate-600'}`}
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

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <section className={`${mobileTab === 'line' ? 'block' : 'hidden'} rounded-2xl border-2 border-teal-500 bg-teal-50 p-2 shadow-md sm:p-4 lg:block`}>
          <div className="mb-3 rounded-xl bg-teal-700 px-4 py-3 text-white">
            <p className="text-xs font-bold uppercase tracking-wide text-teal-100">Écran conducteur</p>
            <h2 className="mt-1 text-xl font-black">Appel depuis la ligne</h2>
            <p className="mt-2 text-sm font-medium leading-6 text-teal-50">
              Utilisé côté ligne de conditionnement pour signaler une palette prête, une palette vide à fournir ou une zone à libérer.
            </p>
          </div>
          <div className="panel p-4 sm:p-5">
            <div className="mb-5 flex items-start gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700">
                <Bell size={24} />
              </div>
              <div className="min-w-0">
                  <h3 className="text-lg font-bold text-slate-950">Formulaire ligne</h3>
                  <p className="text-sm text-slate-500">L'appel est horodaté et envoyé au board logistique.</p>
              </div>
            </div>

            {confirmation ? (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 animate-slide-in">
                <Check size={18} className="shrink-0 text-emerald-600" />
                {confirmation}
              </div>
            ) : null}

            <form className="grid gap-4" onSubmit={createRequest}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="label">Ligne de conditionnement</span>
                  <select className="field mt-1" name="line" required>
                    <option>Ligne de conditionnement A</option>
                    <option>Ligne de conditionnement B</option>
                    <option>Ligne de conditionnement C</option>
                  </select>
                </label>
                <label>
                  <span className="label">Zone de ligne</span>
                  <input className="field mt-1" name="zone" defaultValue="Sortie conditionnement" required />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="label">Palettes</span>
                  <input className="field mt-1" name="palletCount" type="number" min="1" max="20" defaultValue="1" required />
                </label>
                <label>
                  <span className="label">Priorité</span>
                  <select className="field mt-1" name="priority">
                    <option value="normal">Normale</option>
                    <option value="high">Haute — urgent</option>
                  </select>
                </label>
              </div>
              <label>
                <span className="label">Nature</span>
                <select className="field mt-1" name="nature">
                  <option>Palette pleine à évacuer</option>
                  <option>Palette vide à fournir</option>
                  <option>Palette à contrôler</option>
                </select>
              </label>
              <label>
                <span className="label">Commentaire</span>
                <textarea className="field mt-1 min-h-20" name="comment" placeholder="Ex : zone tampon presque pleine" />
              </label>
              <Button className="w-full py-3 text-base" type="submit" icon={<Zap size={18} />}>
                Envoyer l'appel logistique
              </Button>
            </form>

            {requests.slice(0, 3).length > 0 ? (
              <div className="mt-6">
                <p className="label mb-3">Mes derniers appels</p>
                <div className="space-y-2">
                  {requests.slice(0, 3).map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
                      <span className="min-w-0 font-semibold text-slate-800">{r.id} · {r.line}</span>
                      <Badge tone={statusTone[r.status]}>{logisticsStatusLabels[r.status]}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className={`${mobileTab === 'logistics' ? 'block' : 'hidden'} rounded-2xl border-2 border-slate-500 bg-white p-2 shadow-md sm:p-4 lg:block`}>
          <div className="mb-3 rounded-xl bg-slate-900 px-4 py-3 text-white">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-300">Écran logistique</p>
            <h2 className="mt-1 text-xl font-black">Board de traitement</h2>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-200">
              Les demandes envoyées depuis les lignes apparaissent ici pour être vues, prises en charge, récupérées ou annulées.
            </p>
          </div>
          <div className="panel p-4 sm:p-5">
            <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-900 text-white">
                  <Truck size={22} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-slate-950">Demandes actives</h3>
                  <p className="text-sm text-slate-500">Statuts, priorités et temps écoulé restent visibles.</p>
                </div>
              </div>
              {stats.waiting > 0 ? (
                <div className="flex min-h-11 items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-white shadow-lg">
                  <Bell size={16} className="animate-bounce" />
                  <span className="text-sm font-bold">{stats.waiting} en attente</span>
                </div>
              ) : null}
            </div>

            <div className="mb-5 grid gap-3 sm:grid-cols-3">
              <StatCard label="En attente" value={stats.waiting} />
              <StatCard label="En cours" value={stats.inProgress} />
              <StatCard label="Récupérées" value={stats.pickedUp} detail="Aujourd'hui" />
            </div>

            {activeRequests.length > 0 ? (
              <div className="space-y-3">
                {activeRequests.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    onUpdate={updateStatus}
                    isNew={newIds.has(request.id)}
                    now={now}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-slate-200 py-12 text-center text-slate-500">
                <PackageCheck size={32} className="mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-medium">Aucune demande active</p>
                <p className="text-xs mt-1">Créez un appel côté ligne de conditionnement pour voir une carte apparaître ici.</p>
              </div>
            )}

            {doneRequests.length > 0 ? (
              <details className="mt-4">
                <summary className="cursor-pointer rounded-lg bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition">
                  Terminées / Annulées ({doneRequests.length})
                </summary>
                <div className="mt-3 space-y-3">
                  {doneRequests.map((request) => (
                    <RequestCard key={request.id} request={request} onUpdate={updateStatus} isNew={false} now={now} />
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
