import {
  ArrowRight,
  ChevronLeft,
  Eye,
  Flame,
  Footprints,
  Hand,
  HardHat,
  Leaf,
  LockKeyhole,
  Megaphone,
  Route,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSgUrgences } from '../../data/shiftguideModules';

const goldenRuleIcons: Record<string, LucideIcon> = {
  loto: LockKeyhole,
  coupure: Hand,
  equipement: ShieldCheck,
  ergonomie: Footprints,
  choc: Sparkles,
  coactivite: Eye,
  chimique: HardHat,
  environnement: Leaf,
};

const accidentIcons: Record<string, LucideIcon> = {
  proteger: ShieldAlert,
  alerter: Megaphone,
  secourir: Hand,
};

const accidentTones: Record<string, string> = {
  proteger: 'bg-orange-50 text-orange-700 ring-orange-200',
  alerter: 'bg-red-50 text-red-700 ring-red-200',
  secourir: 'bg-teal-50 text-teal-700 ring-teal-200',
};

export function UrgencesPage() {
  const navigate = useNavigate();
  const urgences = getSgUrgences();

  if (!urgences) {
    return (
      <main className="grid min-h-[70dvh] place-items-center bg-[#f3f5f7] px-5 py-10">
        <section className="w-full max-w-lg rounded-3xl border border-red-200 bg-white p-7 text-center shadow-xl shadow-zinc-200/50">
          <ShieldAlert className="mx-auto text-red-700" size={28} />
          <h1 className="mt-3 text-2xl font-black text-zinc-950">Consignes d'urgence indisponibles</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-zinc-500">
            La configuration ShiftGuide active ne fournit pas de contenu d'urgence valide.
          </p>
          <button
            type="button"
            onClick={() => navigate('/shiftguide')}
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-950 px-4 text-sm font-black text-white"
          >
            Retour à ShiftGuide
          </button>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f5f7] text-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto grid h-14 max-w-[1500px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 sm:h-16 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => navigate('/shiftguide')}
            className="inline-flex h-10 items-center gap-1 rounded-full px-2 text-sm font-bold text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950 sm:gap-2 sm:px-3"
          >
            <ChevronLeft size={17} />
            <span className="hidden min-[380px]:inline">Accueil</span>
          </button>

          <div className="flex min-w-0 items-center justify-center gap-2 sm:gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-700 text-white shadow-lg shadow-red-900/10 sm:h-10 sm:w-10">
              <ShieldAlert size={19} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-zinc-950">Urgences</p>
              <p className="hidden text-[11px] font-black uppercase tracking-[0.18em] text-red-500 sm:block">
                Safety command
              </p>
            </div>
          </div>

          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-xs font-black text-red-700 ring-1 ring-red-100 sm:w-auto sm:px-3">
            <span className="sm:hidden">!</span>
            <span className="hidden sm:inline">Priorité personne</span>
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-2xl border border-red-900/20 bg-zinc-950 text-white shadow-2xl shadow-zinc-950/10">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="px-4 py-5 sm:px-6">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-red-300">Fiche réflexe</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight leading-tight sm:text-4xl">Urgences & Règles d’Or</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">
                Une lecture immédiate : signal, conduite à tenir, gestes accident et standards sécurité.
              </p>
            </div>

            <div className="border-t border-white/10 bg-red-700 px-5 py-5 lg:border-l lg:border-t-0">
              <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-red-100">
                <Siren size={14} /> Signal critique
              </p>
              <p className="mt-4 text-2xl font-black">{urgences.generalAlarm.signal}</p>
              <p className="mt-1 text-sm font-bold text-red-50">{urgences.generalAlarm.instruction}</p>
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
          <section className="overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-red-100 bg-red-50 px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-black text-red-800">
                <Siren size={17} /> Évacuation générale
              </p>
              <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black uppercase text-red-700 ring-1 ring-red-100">Aller dehors</span>
            </div>
            <div className="grid gap-0 sm:grid-cols-5">
              {urgences.generalAlarm.steps.map((step, index) => (
                <div key={step} className="border-b border-zinc-100 px-4 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-red-700 text-xs font-black text-white">{index + 1}</span>
                  <p className="mt-3 text-sm font-black leading-5 text-zinc-900">{step}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-5 md:grid-cols-2 lg:grid-cols-1">
            <article className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
              <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">
                <TriangleAlert size={14} /> Essai sirène
              </p>
              <div className="mt-3 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xl font-black text-zinc-950">{urgences.drill.schedule}</p>
                </div>
                <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-amber-800 ring-1 ring-amber-200">
                  {urgences.drill.instruction}
                </span>
              </div>
            </article>

            <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-white shadow-sm">
              <p className="flex items-center gap-2 text-sm font-black">
                <Flame size={17} className="text-red-300" /> {urgences.priorityMessage}
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">{urgences.priorityDescription}</p>
            </article>
          </section>
        </div>

        <section className="mt-5">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Accident</p>
              <h2 className="text-xl font-black tracking-tight text-zinc-950">Gestes à suivre dans l’ordre</h2>
            </div>
            <p className="text-sm font-semibold text-zinc-500">
              Numéros d’urgence : {urgences.emergencyNumbers.join(' ou ')}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {urgences.accidentSteps.map((step, index) => {
              const Icon = accidentIcons[step.id] ?? ShieldAlert;
              const tone = accidentTones[step.id] ?? 'bg-slate-50 text-slate-700 ring-slate-200';
              return (
                <article key={step.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className={`grid h-11 w-11 place-items-center rounded-xl ring-1 ${tone}`}><Icon size={20} /></span>
                    <span className="text-sm font-black text-zinc-300">{String(index + 1).padStart(2, '0')}</span>
                  </div>
                  <p className="mt-4 text-lg font-black uppercase text-zinc-950">{step.label}</p>
                  <p className="mt-1 text-sm leading-6 text-zinc-500">{step.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-5">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Standards</p>
              <h2 className="text-xl font-black tracking-tight text-zinc-950">Règles d’Or</h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-3 py-2 text-xs font-black text-white">
              <Route size={14} /> Suivre le flux terrain <ArrowRight size={14} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {urgences.goldenRules.map((rule) => {
              const Icon = goldenRuleIcons[rule.id] ?? ShieldCheck;
              return (
                <article key={rule.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200"><Icon size={18} /></span>
                  <p className="mt-4 text-xs font-black uppercase tracking-wide text-teal-700">{rule.label}</p>
                  <p className="mt-2 text-sm font-medium leading-6 text-zinc-500">{rule.description}</p>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
