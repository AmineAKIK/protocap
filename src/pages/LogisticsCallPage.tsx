import { Check, Clock3, Eye, PackageCheck, PlusCircle, XCircle } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { StatCard } from '../components/StatCard';
import { initialLogisticsRequests } from '../data/logisticsData';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { LogisticsRequest, LogisticsStatus, Priority } from '../types/logistics';
import { elapsedLabel, formatDateTime } from '../utils/date';
import { logisticsStatusLabels, nextLogisticsId } from '../utils/logistics';

const statuses: LogisticsStatus[] = ['waiting', 'seen', 'inProgress', 'pickedUp', 'cancelled'];

const statusTone: Record<LogisticsStatus, 'amber' | 'blue' | 'teal' | 'green' | 'slate'> = {
  waiting: 'amber',
  seen: 'blue',
  inProgress: 'teal',
  pickedUp: 'green',
  cancelled: 'slate'
};

export function LogisticsCallPage() {
  const [requests, setRequests] = useLocalStorage<LogisticsRequest[]>('lineops.logistics.requests', initialLogisticsRequests);
  const [mobileTab, setMobileTab] = useState<'line' | 'logistics'>('line');
  const [confirmation, setConfirmation] = useState('');

  const stats = useMemo(() => ({
    waiting: requests.filter((request) => request.status === 'waiting').length,
    inProgress: requests.filter((request) => request.status === 'inProgress').length,
    pickedUp: requests.filter((request) => request.status === 'pickedUp').length
  }), [requests]);

  function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const request: LogisticsRequest = {
      id: nextLogisticsId(requests),
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
    setConfirmation(`Appel ${request.id} envoyé à la logistique`);
    event.currentTarget.reset();
  }

  function updateStatus(id: string, status: LogisticsStatus) {
    setRequests((current) => current.map((request) => (request.id === id ? { ...request, status } : request)));
  }

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-6">
        <p className="label">Prototype 2</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">Logistics Call</h1>
        <p className="mt-2 max-w-3xl text-slate-600">Signalement digital des palettes prêtes à évacuer.</p>
      </div>

      <div className="mb-4 grid grid-cols-2 rounded-lg border border-slate-200 bg-white p-1 lg:hidden">
        <button className={`rounded-md px-3 py-2 text-sm font-semibold ${mobileTab === 'line' ? 'bg-teal-700 text-white' : 'text-slate-600'}`} onClick={() => setMobileTab('line')}>Ligne</button>
        <button className={`rounded-md px-3 py-2 text-sm font-semibold ${mobileTab === 'logistics' ? 'bg-teal-700 text-white' : 'text-slate-600'}`} onClick={() => setMobileTab('logistics')}>Logistique</button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={`${mobileTab === 'line' ? 'block' : 'hidden'} lg:block`}>
          <div className="panel h-full p-4 sm:p-5">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-700">
                <PlusCircle size={23} />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-950 sm:text-xl">Ligne de production</h2>
                <p className="text-sm text-slate-600">Créer une demande claire en quelques secondes.</p>
              </div>
            </div>

            {confirmation ? (
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
                {confirmation}
              </div>
            ) : null}

            <form className="grid gap-4" onSubmit={createRequest}>
              <label>
                <span className="label">Ligne</span>
                <select className="field mt-1" name="line" required>
                  <option>Ligne A</option>
                  <option>Ligne B</option>
                  <option>Ligne C</option>
                </select>
              </label>
              <label>
                <span className="label">Zone / poste</span>
                <input className="field mt-1" name="zone" defaultValue="Sortie conditionnement" required />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="label">Nombre de palettes</span>
                  <input className="field mt-1" name="palletCount" type="number" min="1" defaultValue="1" required />
                </label>
                <label>
                  <span className="label">Priorité</span>
                  <select className="field mt-1" name="priority">
                    <option value="normal">Normale</option>
                    <option value="high">Haute</option>
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
                <textarea className="field mt-1 min-h-24" name="comment" placeholder="Exemple : zone tampon presque pleine" />
              </label>
              <Button className="w-full" type="submit">Envoyer l’appel logistique</Button>
            </form>

            <div className="mt-6">
              <h3 className="font-bold text-slate-950">Mes derniers appels</h3>
              <div className="mt-3 space-y-2">
                {requests.slice(0, 3).map((request) => (
                  <div key={request.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm">
                    <span className="font-semibold text-slate-800">{request.id} · {request.line}</span>
                    <Badge tone={statusTone[request.status]}>{logisticsStatusLabels[request.status]}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className={`${mobileTab === 'logistics' ? 'block' : 'hidden'} lg:block`}>
          <div className="panel h-full p-4 sm:p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-950 sm:text-xl">Board logistique</h2>
                <p className="text-sm text-slate-600">Les appels envoyés côté ligne apparaissent ici immédiatement.</p>
              </div>
              <PackageCheck className="shrink-0 text-teal-700" />
            </div>

            <div className="mb-5 grid gap-3 sm:grid-cols-3">
              <StatCard label="En attente" value={stats.waiting} />
              <StatCard label="En cours" value={stats.inProgress} />
              <StatCard label="Récupérées" value={stats.pickedUp} detail="Aujourd’hui" />
            </div>

            <div className="space-y-3">
              {statuses.map((status) => {
                const statusRequests = requests.filter((request) => request.status === status);

                return (
                  <section key={status} className="rounded-lg bg-slate-50 p-3">
                    <h3 className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-slate-800">
                      {logisticsStatusLabels[status]}
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">{statusRequests.length}</span>
                    </h3>
                    {statusRequests.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500">
                        Aucune demande
                      </div>
                    ) : (
                      <div className="grid gap-3 min-[1380px]:grid-cols-2">
                        {statusRequests.map((request) => (
                          <article key={request.id} className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <strong className="text-sm text-slate-950">{request.id}</strong>
                              <Badge tone={request.priority === 'high' ? 'red' : 'slate'}>{request.priority === 'high' ? 'Haute' : 'Normale'}</Badge>
                            </div>
                            <p className="mt-2 text-sm font-semibold text-slate-800">{request.line} · {request.zone}</p>
                            <p className="mt-1 text-xs text-slate-500">{request.palletCount} palette(s) · {request.nature}</p>
                            {request.comment ? <p className="mt-2 text-xs text-slate-600">{request.comment}</p> : null}
                            <p className="mt-2 text-xs text-slate-500">
                              <Clock3 size={13} className="mr-1 inline" />
                              {formatDateTime(request.createdAt)} · {elapsedLabel(request.createdAt)}
                            </p>
                            <div className="mt-3 grid gap-2 min-[430px]:flex min-[430px]:flex-wrap">
                              {request.status === 'waiting' ? (
                                <Button className="w-full min-[430px]:w-auto" variant="ghost" icon={<Eye size={15} />} onClick={() => updateStatus(request.id, 'seen')}>Vu</Button>
                              ) : null}
                              {request.status !== 'pickedUp' && request.status !== 'cancelled' ? (
                                <Button className="w-full min-[430px]:w-auto" variant="secondary" icon={<Check size={15} />} onClick={() => updateStatus(request.id, 'inProgress')}>Prendre en charge</Button>
                              ) : null}
                              {request.status !== 'pickedUp' && request.status !== 'cancelled' ? (
                                <Button className="w-full min-[430px]:w-auto" icon={<PackageCheck size={15} />} onClick={() => updateStatus(request.id, 'pickedUp')}>Récupéré</Button>
                              ) : null}
                              {request.status !== 'cancelled' && request.status !== 'pickedUp' ? (
                                <Button className="w-full min-[430px]:w-auto" variant="danger" icon={<XCircle size={15} />} onClick={() => updateStatus(request.id, 'cancelled')}>Annuler</Button>
                              ) : null}
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
