import { ArrowRight, Clock3, FlaskConical, Gauge, PlayCircle, Settings2, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFillingGold } from '../application/FillingGoldContext';
import { buildContext, profileReadinessIssues } from '../application/profileBundle';
import { createSetupSession } from '../application/sessionService';
import { parseDecimalInput } from '../domain/inputParser';
import type { SessionMode } from '../domain/models';
import { PageIntro, StatusNotice } from './components';

export function FillingDashboardPage() {
  const { profiles, sessions, saveSession, persistence } = useFillingGold();
  const navigate = useNavigate();
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [mode, setMode] = useState<SessionMode>('shadow');
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [workOrder, setWorkOrder] = useState('');
  const [batch, setBatch] = useState('');
  const [productTemperatureC, setProductTemperatureC] = useState('');

  const active = sessions.find((entry) => {
    if (entry.value.status === 'active' || entry.value.status === 'draft') return true;
    const lastIteration = entry.value.iterations[entry.value.iterations.length - 1];
    return entry.value.mode === 'shadow'
      && Boolean(lastIteration?.decision)
      && !lastIteration?.operatorNote?.startsWith('shadow-observation:');
  });
  const selected = profiles.find((profile) => profile.id === selectedProfileId);
  const selectedIssues = selected ? profileReadinessIssues(selected) : [];
  const recent = sessions.slice(0, 4);
  const availableProfiles = useMemo(
    () => profiles.filter((profile) => profile.status !== 'obsolete'),
    [profiles],
  );

  const start = async () => {
    if (!selected) return;
    if (active) {
      setError('Une session est déjà ouverte. Termine-la ou abandonne-la avant d’en créer une autre.');
      return;
    }
    if (mode === 'real' && selectedIssues.length > 0) {
      setError(selectedIssues.join(' '));
      return;
    }
    setStarting(true);
    try {
      let normalizedTemperature: string | undefined;
      if (productTemperatureC.trim()) {
        const parsed = parseDecimalInput(productTemperatureC, {
          allowNegative: true,
          minimum: '-20',
          maximum: '100',
        });
        if (parsed.status !== 'valid') throw new Error(parsed.message);
        normalizedTemperature = parsed.value;
      }
      const session = createSetupSession(
        mode,
        {
          ...buildContext(selected),
          workOrder: workOrder.trim() || undefined,
          batch: batch.trim() || undefined,
          productTemperatureC: normalizedTemperature,
        },
        selected.profiles,
      );
      await saveSession(session);
      navigate(`/shiftguide/remplissage/session/${session.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La session ne peut pas être créée.');
      setStarting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
      <PageIntro
        eyebrow="Cockpit personnel"
        title="Préparer et converger sans confusion"
        description="Le calcul guide le réglage et l’échantillonnage. La procédure officielle reste la référence pour la suite du contrôle."
      />

      <div className="mb-5 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-bold text-teal-950">
        Données chiffrées sur cet appareil · {persistence === 'granted' || persistence === 'already-persistent' ? 'stockage persistant accordé' : 'vérifier la persistance dans Sauvegarde'} · aucun calcul transmis à l’IA
      </div>
      {error ? <StatusNotice tone="danger" title="Impossible de démarrer">{error}</StatusNotice> : null}

      {active ? (
        <section className="mt-5 overflow-hidden rounded-2xl border-2 border-cyan-400 bg-white shadow-lg">
          <div className="bg-cyan-950 px-5 py-4 text-white">
            <p className="text-xs font-black uppercase tracking-widest text-cyan-200">Session à reprendre</p>
            <h2 className="mt-1 text-xl font-black">{active.value.profiles.product.designation} · {active.value.profiles.machine.name}</h2>
          </div>
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-slate-600">Itération {active.value.iterations.length} · dernière sauvegarde {new Date(active.updatedAt).toLocaleTimeString('fr-FR')}</p>
              <p className="mt-1 text-xs font-black uppercase text-cyan-700">{active.value.mode === 'real' ? 'Réglage réel' : active.value.mode === 'shadow' ? 'Shadow mode' : 'Simulation'}</p>
            </div>
            <Link to={`/shiftguide/remplissage/session/${active.value.id}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-cyan-700 px-6 text-sm font-black text-white">
              Reprendre <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      ) : (
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-teal-100 text-teal-800"><PlayCircle size={24} /></span>
            <div><h2 className="text-xl font-black">Nouveau réglage</h2><p className="mt-1 text-sm text-slate-500">Choisis un profil et le niveau d’usage voulu.</p></div>
          </div>
          {availableProfiles.length === 0 ? (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-black text-amber-950">Aucun profil n’est encore configuré.</p>
              <Link to="/shiftguide/remplissage/profils" className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white"><Settings2 size={17} /> Préparer mes données</Link>
            </div>
          ) : (
            <>
            <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.4fr_auto] lg:items-end">
              <label>
                <span className="text-xs font-black uppercase tracking-wide text-slate-600">Profil</span>
                <select value={selectedProfileId} onChange={(e) => { setSelectedProfileId(e.target.value); setError(null); }} className="mt-1 min-h-14 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100">
                  <option value="">Sélectionner…</option>
                  {availableProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
                </select>
              </label>
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-slate-600">Mode</p>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {([
                    ['shadow', 'Shadow', Clock3],
                    ['simulation', 'Essai', FlaskConical],
                    ['real', 'Réel', ShieldCheck],
                  ] as const).map(([value, label, Icon]) => (
                    <button key={value} type="button" onClick={() => { setMode(value); setError(null); }} className={`min-h-14 rounded-xl border px-2 text-xs font-black ${mode === value ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 bg-white text-slate-600'}`}>
                      <Icon size={16} className="mx-auto mb-1" />{label}
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" disabled={!selected || starting} onClick={start} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 text-sm font-black text-white disabled:opacity-40">
                <Gauge size={18} /> {starting ? 'Création…' : 'Commencer'}
              </button>
            </div>
            <div className="mt-5 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
              <label><span className="text-xs font-black uppercase tracking-wide text-slate-600">Ordre / OC (facultatif)</span><input value={workOrder} onChange={(event) => setWorkOrder(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100" /></label>
              <label><span className="text-xs font-black uppercase tracking-wide text-slate-600">Lot (facultatif)</span><input value={batch} onChange={(event) => setBatch(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100" /></label>
              <label><span className="text-xs font-black uppercase tracking-wide text-slate-600">Température produit (si requise)</span><span className="mt-1 flex min-h-12 overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-teal-600 focus-within:ring-4 focus-within:ring-teal-100"><input inputMode="decimal" value={productTemperatureC} onChange={(event) => setProductTemperatureC(event.target.value)} className="min-w-0 flex-1 px-3 text-sm font-bold outline-none" /><span className="grid min-w-12 place-items-center border-l border-slate-200 bg-white text-sm font-black text-slate-500">°C</span></span></label>
            </div>
            </>
          )}
          {selected && selectedIssues.length > 0 ? (
            <div className="mt-4"><StatusNotice tone={mode === 'real' ? 'danger' : 'warning'} title={mode === 'real' ? 'Mode réel bloqué' : 'Profil utilisable uniquement en essai/shadow'}>{selectedIssues.join(' ')}</StatusNotice></div>
          ) : null}
        </section>
      )}

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-black">Dernières sessions</h2><Link to="/shiftguide/remplissage/historique" className="text-sm font-black text-teal-700">Tout voir</Link></div>
        {recent.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm font-semibold text-slate-500">Aucune session enregistrée.</p> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map(({ value }) => (
              <Link key={value.id} to={`/shiftguide/remplissage/session/${value.id}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-teal-300">
                <p className="truncate font-black">{value.profiles.product.designation}</p><p className="mt-1 truncate text-sm text-slate-500">{value.profiles.machine.name}</p><p className="mt-3 text-xs font-black uppercase text-teal-700">{value.status.replace(/_/g, ' ')}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
