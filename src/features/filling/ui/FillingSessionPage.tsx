import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Eye,
  Gauge,
  History,
  MinusCircle,
  Plus,
  RotateCcw,
  Save,
  Scale,
  StopCircle,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useFillingGold } from '../application/FillingGoldContext';
import {
  abandonSession,
  activateSession,
  addMeasurement,
  analyzeCurrentIteration,
  beginCorrectionIteration,
  recordIterationNote,
  removeLastMeasurement,
  reopenCurrentIteration,
  setMeasurementExclusion,
  stopSession,
} from '../application/sessionService';
import { decimal, quantizeDecimal } from '../domain/decimal';
import { parseDecimalInput } from '../domain/inputParser';
import type {
  MeasurementInput,
  MachineSetpoint,
  SetupIteration,
  SetupSession,
} from '../domain/models';
import { calculateMachineSetpoint } from '../domain/targets';
import { assessHistoryCompatibility, buildHistoryCompatibilityKey } from '../domain/compatibility';
import { DecimalField, PageIntro, StatusNotice, ValueCard } from './components';

function display(value: string | undefined, digits = 5): string {
  if (value === undefined) return '—';
  const [integer, fraction] = value.split('.');
  return fraction ? `${integer},${fraction.slice(0, digits)}` : integer;
}

function currentIteration(session: SetupSession): SetupIteration {
  return session.iterations[session.iterations.length - 1];
}

function criterionUnit(session: SetupSession): string {
  return session.profiles.controlPlan.startCriterion.basis === 'volume_ml' ? 'mL' : 'g';
}

function defaultNextSetting(session: SetupSession): string {
  const iteration = currentIteration(session);
  const recommendation = iteration.recommendation;
  if (!recommendation) return '';
  if (recommendation.mechanicalEstimate) return recommendation.mechanicalEstimate.quantizedSetting;
  if (!iteration.appliedSetting) return '';
  const machine = session.profiles.machine;
  if (machine.setpointType === 'mechanical') return '';
  const change = machine.setpointType === 'volume'
    ? recommendation.recommendedChangeMl
    : recommendation.recommendedChangeG;
  const signed = machine.increaseDirection === 'lower_value'
    ? decimal(iteration.appliedSetting).minus(change)
    : decimal(iteration.appliedSetting).plus(change);
  return quantizeDecimal(signed, machine.resolution, machine.roundingPolicy);
}

function parseWorkshopValue(
  raw: string,
  options: { allowZero?: boolean; minimum?: string; maximum?: string } = {},
): string {
  const result = parseDecimalInput(raw, {
    allowZero: options.allowZero,
    minimum: options.minimum,
    maximum: options.maximum,
    detectFactorThousand: true,
  });
  if (result.status !== 'valid') throw new Error(result.message);
  if (result.warnings.length > 0) throw new Error(result.warnings[0].message);
  return result.value;
}

function ReviewStep({
  session,
  historySetting,
  onActivate,
  saving,
}: {
  session: SetupSession;
  historySetting?: string;
  onActivate: (setting: string | undefined) => Promise<void>;
  saving: boolean;
}) {
  const setpoint = useMemo<MachineSetpoint | null>(() => {
    try {
      return calculateMachineSetpoint(
        session.targets,
        session.profiles.machine,
        session.profiles.calibration,
      );
    } catch {
      return null;
    }
  }, [session]);
  const defaultSetting = setpoint?.kind === 'direct'
    ? setpoint.value.quantized
    : setpoint?.kind === 'mechanical_estimate'
      ? setpoint.value.quantized
      : historySetting ?? '';
  const [appliedSetting, setAppliedSetting] = useState(defaultSetting);
  const [error, setError] = useState<string | null>(null);
  const mechanical = session.profiles.machine.setpointType === 'mechanical';

  const primary = setpoint?.kind === 'direct'
    ? { label: `Consigne ${setpoint.label}`, value: setpoint.value.quantized, unit: setpoint.unit }
    : setpoint?.kind === 'mechanical_estimate'
      ? { label: 'Position mécanique estimée', value: setpoint.value.quantized, unit: setpoint.unit }
      : { label: 'Cible physique NETTE', value: session.targets.netMassG, unit: 'g NET' };

  return (
    <div className="space-y-5">
      <StatusNotice tone={session.mode === 'real' ? 'warning' : 'info'} title={session.mode === 'real' ? 'Réglage réel' : session.mode === 'shadow' ? 'Shadow mode — recommandation masquée après échantillon' : 'Simulation'}>
        Confirme les sources et le contexte avant d’appliquer la première valeur. Le statut final ne libère jamais le lot.
      </StatusNotice>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-black">Contexte figé</h2>
          <dl className="mt-4 divide-y divide-slate-100 text-sm">
            {[
              ['Machine', `${session.profiles.machine.name} · ${session.profiles.machine.unit}`],
              ['Produit', `${session.profiles.product.sku} · ${session.profiles.product.designation}`],
              ['Tube', `${session.profiles.packaging.formatCode} · ${session.profiles.packaging.weighingState}`],
              ['Masse volumique', `${session.profiles.product.density.valueGPerMl} g/mL à ${session.profiles.product.density.referenceTemperatureC} °C`],
              ['Tare', session.profiles.packaging.tareMode === 'fixed' ? `${session.profiles.packaging.fixedTare?.meanG} g · moyenne` : session.profiles.packaging.tareMode],
              ['Plan', `${session.profiles.controlPlan.sampleSize} tubes · ${session.profiles.controlPlan.source.label}`],
              ['Balance', `${session.profiles.instrument.name} · résolution ${session.profiles.instrument.resolutionG} g`],
              ['Ordre / OC', session.context.workOrder || 'Non renseigné'],
              ['Lot', session.context.batch || 'Non renseigné'],
              ['Température produit', session.context.productTemperatureC ? `${session.context.productTemperatureC} °C` : 'Non requise / non renseignée'],
            ].map(([term, value]) => (
              <div key={term} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr]"><dt className="font-black text-slate-500">{term}</dt><dd className="font-bold text-slate-950">{value}</dd></div>
            ))}
          </dl>
        </section>
        <section className="space-y-3">
          <ValueCard label={primary.label} value={display(primary.value)} unit={primary.unit} primary />
          <div className="grid grid-cols-2 gap-3"><ValueCard label="Volume cible" value={display(session.targets.volumeMl)} unit="mL" /><ValueCard label="Masse NETTE" value={display(session.targets.netMassG)} unit="g NET" /></div>
          {session.targets.grossMassG ? <ValueCard label="Référence tube plein" value={display(session.targets.grossMassG)} unit="g BRUT" /> : null}
          {mechanical && !session.profiles.calibration ? <StatusNotice tone="warning" title="Aucune position exacte">L’outil donne une cible physique, le sens de correction et l’historique. Toute nouvelle valeur devra être confirmée par une pesée complète.</StatusNotice> : null}
        </section>
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-black">Réglage réellement appliqué</h2>
        {historySetting ? <p className="mt-1 text-sm font-semibold text-teal-800">Dernier réglage comparable ayant atteint le critère : {historySetting} {session.profiles.machine.unit}</p> : <p className="mt-1 text-sm text-slate-500">Aucun historique comparable disponible.</p>}
        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <DecimalField label={mechanical ? 'Position / graduation appliquée' : 'Consigne appliquée'} unit={session.profiles.machine.unit} value={appliedSetting} onChange={(event) => { setAppliedSetting(event.target.value); setError(null); }} hint="Cette valeur est distincte de la proposition de l’application." error={error ?? undefined} />
          <button type="button" disabled={saving || (mechanical && !appliedSetting.trim())} onClick={async () => {
            try {
              const setting = appliedSetting.trim()
                ? parseWorkshopValue(appliedSetting, {
                    allowZero: true,
                    minimum: session.profiles.machine.minimum,
                    maximum: session.profiles.machine.maximum,
                  })
                : undefined;
              await onActivate(setting);
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Réglage invalide.');
            }
          }} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-teal-700 px-6 text-sm font-black text-white disabled:opacity-40">
            <ClipboardCheck size={19} /> J’ai appliqué ce réglage
          </button>
        </div>
      </section>
    </div>
  );
}

function SampleStep({
  session,
  onSave,
  saving,
}: {
  session: SetupSession;
  onSave: (session: SetupSession) => Promise<void>;
  saving: boolean;
}) {
  const iteration = currentIteration(session);
  const packaging = session.profiles.packaging;
  const instrument = session.profiles.instrument;
  const required = session.profiles.controlPlan.sampleSize;
  const included = iteration.measurements.filter((measurement) => !measurement.excluded).length;
  const [gross, setGross] = useState('');
  const [tare, setTare] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    try {
      const grossValue = parseWorkshopValue(gross, {
        minimum: instrument.minimumG,
        maximum: instrument.maximumG,
      });
      let input: MeasurementInput;
      if (packaging.tareMode === 'fixed') {
        input = { id: crypto.randomUUID(), mode: 'fixed', grossMassG: grossValue };
      } else {
        const tareValue = parseWorkshopValue(tare, {
          allowZero: true,
          minimum: '0',
          maximum: instrument.maximumG,
        });
        input = packaging.tareMode === 'paired'
          ? { id: crypto.randomUUID(), mode: 'paired', grossMassG: grossValue, tareMassG: tareValue }
          : { id: crypto.randomUUID(), mode: 'destructive', grossBeforeEmptyingG: grossValue, cleanedPackagingMassG: tareValue };
      }
      await onSave(addMeasurement(session, input));
      setGross('');
      setTare('');
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Mesure invalide.');
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-black uppercase tracking-wider text-teal-700">Itération {iteration.index}</p><h2 className="mt-1 text-xl font-black">Saisir l’échantillon</h2></div>
          <span className={`rounded-full px-3 py-1 text-sm font-black ${included >= required ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{included}/{required}</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-500">Mode de tare : <strong>{packaging.tareMode === 'fixed' ? 'fixe / moyenne' : packaging.tareMode === 'paired' ? 'appariée' : 'destructive'}</strong>. Aucune recommandation avant l’échantillon complet.</p>
        {error ? <div className="mt-4"><StatusNotice tone="danger" title="Mesure refusée">{error}</StatusNotice></div> : null}
        <div className="mt-5 space-y-4">
          <DecimalField label={packaging.tareMode === 'destructive' ? 'Masse BRUTE avant vidage' : 'Masse BRUTE du tube'} unit="g BRUT" value={gross} onChange={(event) => setGross(event.target.value)} autoFocus />
          {packaging.tareMode !== 'fixed' ? <DecimalField label={packaging.tareMode === 'paired' ? 'Tare du même tube' : 'Emballage nettoyé'} unit="g TARE" value={tare} onChange={(event) => setTare(event.target.value)} /> : null}
          {packaging.tareMode === 'fixed' ? <div className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700">Tare appliquée : {packaging.fixedTare?.meanG} g</div> : null}
          <button type="button" disabled={saving || included >= required || !gross.trim() || (packaging.tareMode !== 'fixed' && !tare.trim())} onClick={add} className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white disabled:opacity-40"><Plus size={19} /> Enregistrer le tube</button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between"><h2 className="text-lg font-black">Mesures enregistrées</h2><span className="text-xs font-bold text-slate-500">Sauvegarde locale après chaque action</span></div>
        {iteration.measurements.length === 0 ? <div className="py-12 text-center"><Scale size={32} className="mx-auto text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-500">La première mesure apparaîtra ici.</p></div> : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="bg-slate-100 text-xs font-black uppercase text-slate-500"><tr><th className="px-3 py-3">#</th><th className="px-3 py-3">BRUT</th><th className="px-3 py-3">TARE</th><th className="px-3 py-3">NET</th><th className="px-3 py-3">État</th><th className="px-3 py-3 text-right">Action</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {iteration.measurements.map((measurement, index) => <tr key={measurement.id} className={measurement.excluded ? 'bg-amber-50 text-slate-500 line-through' : ''}><td className="px-3 py-3 font-black">{index + 1}</td><td className="px-3 py-3 tabular-nums">{display(measurement.grossMassG)} g</td><td className="px-3 py-3 tabular-nums">{display(measurement.tareMassG)} g</td><td className="px-3 py-3 font-black tabular-nums">{display(measurement.netMassG)} g</td><td className="px-3 py-3 text-xs font-bold">{measurement.excluded ? `Exclue · ${measurement.exclusionReason}` : 'Incluse'}</td><td className="px-3 py-2 text-right"><button type="button" disabled={saving} onClick={async () => { const reason = measurement.excluded ? undefined : window.prompt("Motif obligatoire de l’exclusion :") ?? undefined; if (!measurement.excluded && !reason) return; await onSave(setMeasurementExclusion(session, measurement.id, !measurement.excluded, reason)); }} className="min-h-11 rounded-lg px-3 text-xs font-black text-amber-800 hover:bg-amber-100">{measurement.excluded ? 'Réinclure' : 'Exclure'}</button></td></tr>)}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-between">
          <button type="button" disabled={saving || iteration.measurements.length === 0} onClick={() => onSave(removeLastMeasurement(session))} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-black text-slate-700 disabled:opacity-40"><Trash2 size={16} /> Annuler la dernière</button>
          <button type="button" disabled={saving || included < required} onClick={() => onSave(analyzeCurrentIteration(session))} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-teal-700 px-6 text-sm font-black text-white disabled:opacity-40"><Gauge size={18} /> Analyser {required}/{required}</button>
        </div>
      </section>
    </div>
  );
}

function ShadowCapture({ session, onSave }: { session: SetupSession; onSave: (session: SetupSession) => Promise<void> }) {
  const [choice, setChoice] = useState('');
  const [setting, setSetting] = useState('');
  return (
    <section className="mx-auto max-w-2xl rounded-2xl border-2 border-violet-300 bg-white p-5 shadow-lg sm:p-6">
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-violet-100 text-violet-800"><Eye size={22} /></span>
      <h2 className="mt-4 text-xl font-black">Proposition Gold figée et masquée</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">Enregistre d’abord la décision que tu aurais prise avec ta méthode habituelle. La Gold révélera ensuite son résultat sans l’avoir influencée.</p>
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[['augmenter', 'Augmenter'], ['diminuer', 'Diminuer'], ['atteint', 'Critère atteint'], ['investiguer', 'Investiguer']].map(([value, label]) => <button key={value} type="button" onClick={() => setChoice(value)} className={`min-h-14 rounded-xl border px-2 text-sm font-black ${choice === value ? 'border-violet-700 bg-violet-700 text-white' : 'border-slate-300'}`}>{label}</button>)}
      </div>
      <div className="mt-4"><DecimalField label="Réglage que tu appliquerais (facultatif)" unit={session.profiles.machine.unit} value={setting} onChange={(event) => setSetting(event.target.value)} /></div>
      <button type="button" disabled={!choice} onClick={() => onSave(recordIterationNote(session, `shadow-observation:${choice}|${setting.trim()}`))} className="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-6 text-sm font-black text-white disabled:opacity-40"><Eye size={18} /> Figer ma décision et révéler la Gold</button>
    </section>
  );
}

function AnalysisStep({ session, onSave, saving }: { session: SetupSession; onSave: (session: SetupSession) => Promise<void>; saving: boolean }) {
  const iteration = currentIteration(session);
  const decision = iteration.decision;
  const [nextSetting, setNextSetting] = useState(() => defaultNextSetting(session));
  if (!decision || !iteration.statistics) return null;
  if (session.mode === 'shadow' && !iteration.operatorNote?.startsWith('shadow-observation:')) return <ShadowCapture session={session} onSave={onSave} />;

  const tone = decision.status === 'achieved' ? 'success' : decision.status === 'correct' ? 'warning' : 'danger';
  const title = decision.status === 'achieved' ? 'Critère de démarrage atteint' : decision.status === 'correct' ? 'Correction proposée' : decision.status === 'investigate' ? 'Investiguer avant de corriger' : 'Arrêter et appeler le référent';
  return (
    <div className="space-y-5">
      {session.mode === 'shadow' ? <StatusNotice tone="info" title="Résultat du shadow mode révélé">Ta décision enregistrée : {iteration.operatorNote?.replace('shadow-observation:', '').replace('|', ' · réglage ')}</StatusNotice> : null}
      <StatusNotice tone={tone} title={title}>{decision.reasons.map((reason) => reason.message).join(' ')}</StatusNotice>
      <div className="grid gap-3 sm:grid-cols-4"><ValueCard label="Moyenne" value={display(iteration.statistics.mean)} unit={criterionUnit(session)} /><ValueCard label="Minimum" value={display(iteration.statistics.minimum)} unit={criterionUnit(session)} /><ValueCard label="Maximum" value={display(iteration.statistics.maximum)} unit={criterionUnit(session)} /><ValueCard label="Écart-type" value={display(iteration.statistics.standardDeviation)} unit={criterionUnit(session)} /></div>

      {decision.status === 'correct' && iteration.recommendation ? (
        <section className="rounded-2xl border border-amber-300 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800">{iteration.recommendation.direction === 'increase_fill' ? <Plus size={22} /> : <MinusCircle size={22} />}</span><div><p className="text-xs font-black uppercase tracking-wide text-amber-700">Action recommandée</p><h2 className="mt-1 text-xl font-black">{iteration.recommendation.direction === 'increase_fill' ? 'Augmenter le remplissage' : 'Diminuer le remplissage'}</h2><p className="mt-2 text-sm font-semibold text-slate-600">{iteration.recommendation.explanation}</p></div></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2"><ValueCard label="Correction NETTE" value={display(iteration.recommendation.recommendedChangeG)} unit="g" /><ValueCard label="Équivalent volume" value={display(iteration.recommendation.recommendedChangeMl)} unit="mL" /></div>
          {iteration.recommendation.capped ? <div className="mt-3"><StatusNotice tone="warning" title="Correction plafonnée">L’écart complet est supérieur à la correction maximale autorisée par le profil.</StatusNotice></div> : null}
          {!iteration.recommendation.mechanicalEstimate && session.profiles.machine.setpointType === 'mechanical' ? <div className="mt-3"><StatusNotice tone="warning" title="Direction seulement">Aucune position mécanique exacte n’est proposée sans calibration valide.</StatusNotice></div> : null}
          <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end"><DecimalField label="Nouveau réglage réellement appliqué" unit={session.profiles.machine.unit} value={nextSetting} onChange={(event) => setNextSetting(event.target.value)} /><button type="button" disabled={saving || !nextSetting.trim()} onClick={() => onSave(beginCorrectionIteration(session, parseWorkshopValue(nextSetting, { allowZero: true, minimum: session.profiles.machine.minimum, maximum: session.profiles.machine.maximum })))} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-amber-700 px-6 text-sm font-black text-white disabled:opacity-40"><RotateCcw size={18} /> Appliquer et repeser</button></div>
        </section>
      ) : null}

      {decision.status === 'investigate' ? (
        <div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => onSave(reopenCurrentIteration(session))} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black"><ArrowLeft size={18} /> Revoir l’échantillon</button><button type="button" onClick={() => { const reason = window.prompt("Motif de l’arrêt :"); if (reason) void onSave(stopSession(session, reason)); }} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-rose-700 px-5 text-sm font-black text-white"><StopCircle size={18} /> Arrêter cette session</button></div>
      ) : null}
    </div>
  );
}

function ResultStep({ session }: { session: SetupSession }) {
  const success = session.status === 'criterion_achieved';
  const abandoned = session.status === 'abandoned';
  const last = currentIteration(session);
  return (
    <div className="space-y-5">
      <div className={`rounded-3xl border-2 p-6 text-center shadow-lg ${success ? 'border-emerald-400 bg-emerald-50' : 'border-rose-400 bg-rose-50'}`}>
        {success ? <CheckCircle2 size={48} className="mx-auto text-emerald-700" /> : <Ban size={48} className="mx-auto text-rose-700" />}
        <h2 className="mt-4 text-2xl font-black">{success ? 'Critère de démarrage atteint' : abandoned ? 'Session abandonnée' : 'Session arrêtée'}</h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-700">{success ? 'Poursuivre le contrôle prévu par la procédure. Ce résultat ne constitue ni une conformité ni une libération du lot.' : last.operatorNote ?? last.decision?.reasons.map((reason) => reason.message).join(' ')}</p>
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-lg font-black">Résumé figé</h3><div className="mt-4 grid gap-3 sm:grid-cols-3"><ValueCard label="Itérations" value={String(session.iterations.length)} unit="cycles" /><ValueCard label="Réglage final" value={display(last.appliedSetting)} unit={last.appliedSettingUnit ?? session.profiles.machine.unit} /><ValueCard label="Moyenne finale" value={display(last.statistics?.mean)} unit={criterionUnit(session)} /></div><p className="mt-4 text-xs font-bold text-slate-500">Moteur {session.engineVersion} · profils version {session.profiles.product.version} · clôture {session.completedAt ? new Date(session.completedAt).toLocaleString('fr-FR') : '—'}</p></section>
      <div className="flex flex-col gap-2 sm:flex-row"><Link to="/shiftguide/remplissage" className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 text-sm font-black text-white"><Gauge size={18} /> Retour au cockpit</Link><Link to="/shiftguide/remplissage/historique" className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 text-sm font-black text-slate-700"><History size={18} /> Voir l’historique</Link></div>
    </div>
  );
}

export function FillingSessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { sessions, saveSession } = useFillingGold();
  const entry = sessions.find((item) => item.value.id === sessionId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const session = entry?.value;

  const comparableHistory = session
    ? sessions.find(({ value }) => {
        if (value.id === session.id || value.status !== 'criterion_achieved') return false;
        return assessHistoryCompatibility(
          buildHistoryCompatibilityKey({
            machine: session.profiles.machine,
            product: session.profiles.product,
            packaging: session.profiles.packaging,
            headId: session.context.headId,
            calibrationId: session.context.calibrationId,
            conditions: session.context.conditions,
          }),
          buildHistoryCompatibilityKey({
            machine: value.profiles.machine,
            product: value.profiles.product,
            packaging: value.profiles.packaging,
            headId: value.context.headId,
            calibrationId: value.context.calibrationId,
            conditions: value.context.conditions,
          }),
          { requireExactProfileVersions: true },
        ).compatible;
      })
    : undefined;
  const historySetting = comparableHistory?.value.iterations[comparableHistory.value.iterations.length - 1]?.appliedSetting;

  if (!session) return <div className="mx-auto max-w-3xl px-4 py-12"><StatusNotice tone="danger" title="Session introuvable">La session n’existe pas dans le coffre local ou celui-ci vient d’être restauré.</StatusNotice><Link to="/shiftguide/remplissage" className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white"><ArrowLeft size={17} /> Retour</Link></div>;

  const persist = async (next: SetupSession) => {
    setSaving(true); setError(null);
    try { await saveSession(next); setSavedAt(new Date().toLocaleTimeString('fr-FR')); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Sauvegarde impossible.'); }
    finally { setSaving(false); }
  };
  const iteration = currentIteration(session);
  const terminal = session.status === 'criterion_achieved' || session.status === 'stopped' || session.status === 'abandoned';
  const analyzed = Boolean(iteration.decision);
  const shadowDecisionPending = session.mode === 'shadow'
    && analyzed
    && !iteration.operatorNote?.startsWith('shadow-observation:');

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
      <PageIntro eyebrow={`Session ${session.mode === 'real' ? 'réelle' : session.mode === 'shadow' ? 'shadow' : 'simulation'}`} title={`${session.profiles.product.designation} · ${session.profiles.machine.name}`} description={`Tube ${session.profiles.packaging.formatCode} · moteur ${session.engineVersion} · données figées au ${new Date(session.createdAt).toLocaleString('fr-FR')}`} actions={!terminal ? <button type="button" onClick={async () => { if (!window.confirm('Abandonner cette session ? Elle restera dans l’historique.')) return; await persist(abandonSession(session, 'Session abandonnée par l’utilisateur.')); navigate('/shiftguide/remplissage'); }} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-rose-300 bg-white px-4 text-sm font-black text-rose-700"><StopCircle size={17} /> Abandonner</button> : undefined} />
      {error ? <StatusNotice tone="danger" title="Écriture locale impossible">{error} La poursuite est bloquée tant que la sauvegarde n’est pas rétablie.</StatusNotice> : null}
      {savedAt ? <p className="mb-4 mt-2 text-right text-xs font-bold text-slate-500"><Save size={12} className="mr-1 inline" />Enregistré à {savedAt}</p> : null}
      {shadowDecisionPending ? <AnalysisStep session={session} saving={saving} onSave={persist} /> : terminal ? <ResultStep session={session} /> : session.status === 'draft' ? <ReviewStep session={session} historySetting={historySetting} saving={saving} onActivate={(setting) => persist(activateSession(session, setting))} /> : analyzed ? <AnalysisStep session={session} saving={saving} onSave={persist} /> : <SampleStep session={session} saving={saving} onSave={persist} />}
      <details className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-3"><summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-black"><ChevronDown size={16} /> Détail exact et traçabilité locale</summary><pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify({ targets: session.targets, context: session.context, profileVersions: { machine: session.profiles.machine.version, product: session.profiles.product.version, packaging: session.profiles.packaging.version, controlPlan: session.profiles.controlPlan.version, instrument: session.profiles.instrument.version } }, null, 2)}</pre></details>
    </div>
  );
}
