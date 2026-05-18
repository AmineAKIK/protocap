import { AlertTriangle, CheckCircle2, Clock, History, Plus, RefreshCcw } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { StatCard } from '../components/StatCard';
import { initialChangeHistory, initialProductionLines } from '../data/expiryData';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { ChangeHistoryEntry, ContactElementType, ProductionLine } from '../types/expiry';
import { addDays, formatDateTime } from '../utils/date';
import { getElementStatus, getLineStatus, statusLabel } from '../utils/expiry';

type ChangeTarget = ContactElementType | 'all';

const statusTone = {
  ok: 'green',
  warning: 'amber',
  expired: 'red',
  conform: 'green',
  watch: 'amber',
  nonConform: 'red',
  actionRequired: 'amber'
} as const;

export function ExpiryCheckPage() {
  const [lines, setLines] = useLocalStorage<ProductionLine[]>('lineops.expiry.lines', initialProductionLines);
  const [history, setHistory] = useLocalStorage<ChangeHistoryEntry[]>('lineops.expiry.history', initialChangeHistory);
  const [selectedLineId, setSelectedLineId] = useState(lines[0]?.id ?? '');
  const [changeTarget, setChangeTarget] = useState<ChangeTarget>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const selectedLine = lines.find((line) => line.id === selectedLineId) ?? lines[0];

  const stats = useMemo(() => {
    const statuses = lines.map((line) => getLineStatus(line));
    return {
      conform: statuses.filter((status) => status === 'conform').length,
      watch: statuses.filter((status) => status === 'watch').length,
      blocked: statuses.filter((status) => status === 'nonConform' || status === 'actionRequired').length
    };
  }, [lines]);

  function declareMaterialChange() {
    setLines((current) =>
      current.map((line) => (line.id === selectedLine.id ? { ...line, materialChangePending: true } : line))
    );
  }

  function handleChangeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const changedAt = String(data.get('changedAt'));
    const operator = String(data.get('operator') || 'Opérateur démo');
    const comment = String(data.get('comment') || '');

    setLines((current) =>
      current.map((line) => {
        if (line.id !== selectedLine.id) return line;
        const updatedElements = line.elements.map((element) => {
          if (changeTarget !== 'all' && element.type !== changeTarget) return element;
          return {
            ...element,
            lastChangedAt: new Date(changedAt).toISOString(),
            expiresAt: addDays(new Date(changedAt).toISOString(), element.validityDays),
            operator,
            comment
          };
        });
        return { ...line, materialChangePending: false, elements: updatedElements };
      })
    );

    const touched = selectedLine.elements.filter((element) => changeTarget === 'all' || element.type === changeTarget);
    const newEntries = touched.map((element) => ({
      id: `hist-${Date.now()}-${element.type}`,
      lineId: selectedLine.id,
      lineName: selectedLine.name,
      elementLabel: changeTarget === 'all' ? 'Tuyaux produit + tête' : element.label,
      changedAt: new Date(changedAt).toISOString(),
      operator,
      comment,
      previousExpiresAt: element.expiresAt,
      newExpiresAt: addDays(new Date(changedAt).toISOString(), element.validityDays)
    }));
    setHistory((current) => [...newEntries, ...current]);
    setModalOpen(false);
  }

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-6">
        <p className="label">Prototype 1</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">Expiry Check</h1>
        <p className="mt-2 max-w-3xl text-slate-600">Suivi de validité des éléments en contact produit.</p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Postes conformes" value={stats.conform} />
        <StatCard label="Vigilance" value={stats.watch} />
        <StatCard label="Actions bloquantes" value={stats.blocked} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="space-y-4">
          {lines.map((line) => {
            const status = getLineStatus(line);
            return (
              <button
                key={line.id}
                type="button"
                onClick={() => setSelectedLineId(line.id)}
                className={`panel w-full p-4 text-left transition hover:border-teal-300 ${line.id === selectedLine.id ? 'ring-2 ring-teal-600' : ''}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-bold text-slate-950">{line.name}</h2>
                    <p className="mt-1 text-sm text-slate-600">{line.vat} · {line.product}</p>
                  </div>
                  <Badge tone={statusTone[status]}>{statusLabel(status)}</Badge>
                </div>
                <p className="mt-3 text-xs text-slate-500">Début production : {formatDateTime(line.productionStartedAt)}</p>
              </button>
            );
          })}
        </section>

        <section className="space-y-5">
          <div className="panel p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="label">Éléments en contact produit</p>
                <h2 className="mt-1 text-lg font-bold text-slate-950 sm:text-xl">{selectedLine.name}</h2>
                <p className="mt-1 text-sm text-slate-600">{selectedLine.vat} · {selectedLine.product}</p>
              </div>
              <div className="grid w-full gap-2 min-[520px]:w-auto min-[520px]:grid-cols-2">
                <Button className="w-full" variant="ghost" icon={<RefreshCcw size={17} />} onClick={declareMaterialChange}>Changement de matière</Button>
                <Button className="w-full" icon={<Plus size={17} />} onClick={() => { setChangeTarget('all'); setModalOpen(true); }}>Déclarer un changement</Button>
              </div>
            </div>

            {selectedLine.materialChangePending ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
                Un changement de matière impose le remplacement des éléments en contact produit avant redémarrage.
              </div>
            ) : null}

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {selectedLine.elements.map((element) => {
                const status = getElementStatus(element);
                return (
                  <div key={element.type} className="min-w-0 rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="font-bold text-slate-950">{element.label}</h3>
                      <Badge tone={statusTone[status]}>{statusLabel(status)}</Badge>
                    </div>
                    <dl className="mt-4 space-y-2 text-sm">
                      <div className="grid gap-1 min-[420px]:grid-cols-[1fr_auto] min-[420px]:gap-4"><dt className="text-slate-500">Dernier changement</dt><dd className="font-medium text-slate-800 min-[420px]:text-right">{formatDateTime(element.lastChangedAt)}</dd></div>
                      <div className="grid gap-1 min-[420px]:grid-cols-[1fr_auto] min-[420px]:gap-4"><dt className="text-slate-500">Expiration</dt><dd className="font-medium text-slate-800 min-[420px]:text-right">{formatDateTime(element.expiresAt)}</dd></div>
                      <div className="grid gap-1 min-[420px]:grid-cols-[1fr_auto] min-[420px]:gap-4"><dt className="text-slate-500">Validité</dt><dd className="font-medium text-slate-800 min-[420px]:text-right">{element.validityDays} jours</dd></div>
                      <div className="grid gap-1 min-[420px]:grid-cols-[1fr_auto] min-[420px]:gap-4"><dt className="text-slate-500">Déclaré par</dt><dd className="font-medium text-slate-800 min-[420px]:text-right">{element.operator}</dd></div>
                    </dl>
                    <Button className="mt-4 w-full" variant="ghost" onClick={() => { setChangeTarget(element.type); setModalOpen(true); }}>Déclarer cet élément</Button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="panel p-4 sm:p-5">
            <p className="label">Contrôle avant démarrage</p>
            <div className="mt-4 flex items-start gap-3 rounded-lg bg-slate-50 p-4">
              {getLineStatus(selectedLine) === 'conform' ? <CheckCircle2 className="shrink-0 text-emerald-600" /> : <AlertTriangle className="shrink-0 text-amber-600" />}
              <div className="min-w-0">
                <h3 className="font-bold text-slate-950">Synthèse : {statusLabel(getLineStatus(selectedLine))}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {getLineStatus(selectedLine) === 'nonConform'
                    ? 'Démarrage non conforme : un ou plusieurs éléments en contact produit ont dépassé leur période d’utilisation.'
                    : selectedLine.materialChangePending
                      ? 'Changement de matière détecté : remplacement requis avant démarrage.'
                      : 'Les éléments suivis permettent une poursuite conforme dans cette démonstration.'}
                </p>
              </div>
            </div>
          </div>

          <div className="panel p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <History size={18} className="shrink-0 text-slate-500" />
              <h2 className="font-bold text-slate-950">Historique des changements</h2>
            </div>
            <div className="mt-4 max-h-72 space-y-3 overflow-y-auto overflow-x-hidden pr-1">
              {history.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-slate-950">{entry.elementLabel}</strong>
                    <span className="text-slate-500"><Clock size={14} className="mr-1 inline" />{formatDateTime(entry.changedAt)}</span>
                  </div>
                  <p className="mt-1 text-slate-600">{entry.lineName} · {entry.operator}</p>
                  <p className="mt-1 text-xs text-slate-500">Nouvelle limite : {formatDateTime(entry.newExpiresAt)}</p>
                  {entry.comment ? <p className="mt-2 text-slate-600">{entry.comment}</p> : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {modalOpen ? (
        <Modal title="Déclarer un changement" onClose={() => setModalOpen(false)}>
          <form className="space-y-4" onSubmit={handleChangeSubmit}>
            <label className="block">
              <span className="label">Élément concerné</span>
              <select className="field mt-1" value={changeTarget} onChange={(event) => setChangeTarget(event.target.value as ChangeTarget)}>
                <option value="all">Ensemble tuyaux + tête</option>
                <option value="hoses">Tuyaux produit</option>
                <option value="fillingHead">Tête de remplissage</option>
              </select>
            </label>
            <label className="block">
              <span className="label">Date/heure du changement</span>
              <input className="field mt-1" name="changedAt" type="datetime-local" defaultValue={new Date().toISOString().slice(0, 16)} required />
            </label>
            <label className="block">
              <span className="label">Opérateur</span>
              <input className="field mt-1" name="operator" defaultValue="Opérateur démo" required />
            </label>
            <label className="block">
              <span className="label">Commentaire facultatif</span>
              <textarea className="field mt-1 min-h-24" name="comment" placeholder="Exemple : remplacement avant redémarrage" />
            </label>
            <div className="grid gap-2 min-[420px]:flex min-[420px]:justify-end">
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Annuler</Button>
              <Button type="submit">Valider</Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
