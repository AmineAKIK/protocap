import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Boxes,
  Check,
  CheckCircle2,
  Clock3,
  Database,
  Factory,
  Flag,
  Info,
  Microscope,
  RefreshCcw,
  ShieldCheck,
  Target,
  WifiOff,
  Workflow,
} from 'lucide-react';

const TOTAL_PAGES = 8;
const pageClass =
  'mx-auto w-full max-w-[1120px] overflow-hidden bg-white shadow-[0_18px_60px_rgba(15,23,42,0.10)] ring-1 ring-slate-200';

function DocumentHeader({ page }: { page: number }) {
  return (
    <>
      <div className="flex items-center justify-between gap-4 text-[10px] font-semibold text-slate-500 sm:text-xs">
        <span>S.P.I. | Proposition d’essai pilote</span>
        <span>Version 0.4 - 25 août 2026 | Page {page} / {TOTAL_PAGES}</span>
      </div>
      <div className="mt-3 h-px bg-slate-200" />
    </>
  );
}

function DocumentFooter({ page }: { page: number }) {
  return (
    <div className="mt-auto pt-8 text-center text-[9px] text-slate-400 sm:text-[10px]">
      Proposition d’essai pilote &nbsp; | &nbsp; Page {page} / {TOTAL_PAGES}
    </div>
  );
}

function PageShell({ page, children }: { page: number; children: React.ReactNode }) {
  return (
    <section className={`${pageClass} flex min-h-[1385px] flex-col px-5 py-5 sm:px-10 sm:py-7 lg:px-14`}>
      <DocumentHeader page={page} />
      {children}
      <DocumentFooter page={page} />
    </section>
  );
}

function PageTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mt-6 max-w-4xl">
      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#117b80] sm:text-xs">{eyebrow}</div>
      <h2 className="mt-2 text-3xl font-black leading-tight tracking-tight text-[#163f5b] sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">{subtitle}</p>}
    </div>
  );
}

function OutcomeCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
      <div className="text-sm font-black text-[#163f5b] sm:text-base">{title}</div>
      <p className="mt-2 text-xs leading-5 text-slate-600 sm:text-sm sm:leading-6">{text}</p>
    </div>
  );
}

function FlowStep({
  number,
  title,
  text,
  icon,
}: {
  number: number;
  title: string;
  text: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="relative flex gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0f274b] text-white">{icon}</div>
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#117b80]">Étape {number}</div>
        <div className="mt-1 text-base font-black text-[#0f274b]">{title}</div>
        <p className="mt-1 text-xs leading-5 text-slate-600 sm:text-sm sm:leading-6">{text}</p>
      </div>
    </div>
  );
}

type ReminderScreenProps = {
  title: string;
  subtitle?: string;
  tone?: 'critical' | 'warning' | 'success';
  event?: string;
  time?: string;
  restored?: boolean;
  queue?: string;
  children: React.ReactNode;
  footer?: string;
};

function ReminderScreen({
  title,
  subtitle,
  tone = 'critical',
  event = 'Fin de cuve',
  time = '08:47',
  restored = false,
  queue,
  children,
  footer = 'S.P.I. reste inchangé - Lecture seule',
}: ReminderScreenProps) {
  const headerTone = tone === 'critical' ? 'bg-[#c70b0b]' : tone === 'warning' ? 'bg-[#f59e0b] text-slate-950' : 'bg-[#07843d]';

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_12px_34px_rgba(15,23,42,0.12)]">
      <div className={`${headerTone} flex min-h-[78px] items-center justify-between gap-3 px-5 py-3 text-white`}>
        <div className="flex min-w-0 items-center gap-3">
          {tone === 'success' ? <CheckCircle2 className="h-9 w-9 shrink-0" /> : <AlertTriangle className="h-9 w-9 shrink-0" />}
          <div className="min-w-0">
            <div className="text-lg font-black uppercase leading-tight sm:text-xl">{title}</div>
            {subtitle && <div className="mt-0.5 text-xs font-semibold opacity-90">{subtitle}</div>}
          </div>
        </div>
        {restored && (
          <div className="flex shrink-0 items-center gap-1 rounded-md bg-amber-300 px-2.5 py-1.5 text-[10px] font-black uppercase text-slate-900">
            <RefreshCcw className="h-3.5 w-3.5" /> Rappel restauré
          </div>
        )}
      </div>

      {queue && (
        <div className="mx-5 mt-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-slate-700">
          <Info className="h-4 w-4 shrink-0 text-amber-500" /> {queue}
        </div>
      )}

      {tone !== 'success' && (
        <div className="mx-5 mt-4 grid grid-cols-3 divide-x divide-slate-200 rounded-lg border border-slate-200 bg-white px-2 py-4 text-[#0f274b]">
          <div className="flex items-center gap-2 px-3">
            <Factory className="h-7 w-7 shrink-0" />
            <div><div className="text-[9px] font-black uppercase">Ligne</div><div className="text-lg font-black">L108</div></div>
          </div>
          <div className="flex items-center gap-2 px-3">
            <Flag className="h-7 w-7 shrink-0" />
            <div><div className="text-[9px] font-black uppercase">Événement</div><div className="text-xs font-black leading-4 sm:text-sm">{event}</div></div>
          </div>
          <div className="flex items-center gap-2 px-3">
            <Clock3 className="h-7 w-7 shrink-0" />
            <div><div className="text-[9px] font-black uppercase">Détecté à</div><div className="text-lg font-black">{time}</div><div className="text-[9px] font-semibold">14/05/2025</div></div>
          </div>
        </div>
      )}

      <div className="p-5">{children}</div>
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-2.5 text-[9px] font-medium text-slate-500 sm:text-[10px]">
        <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Assistant de rappel des prélèvements</span>
        <span>{footer}</span>
      </div>
    </div>
  );
}

function SampleCard({ number, quantity, unit, label, icon }: { number: number; quantity: string; unit: string; label: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-red-100 bg-red-50/70 p-4">
      <div className="flex items-end gap-2 text-[#b90e0e]">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#c70b0b] text-xs font-black text-white">{number}</span>
        <span className="text-5xl font-black leading-none">{quantity}</span>
        <span className="pb-1 text-base font-black text-[#0f274b]">{unit}</span>
      </div>
      <div className="mt-4 border-t border-red-200 pt-3 text-base font-black text-[#0f274b]">
        <span className="flex items-center gap-2">{icon}{label}</span>
      </div>
    </div>
  );
}

function SuccessButton({ plural = true }: { plural?: boolean }) {
  return (
    <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-[#079447] px-4 py-3.5 text-base font-black uppercase text-white shadow-inner sm:text-lg">
      <CheckCircle2 className="h-6 w-6" /> {plural ? 'Prélèvements effectués' : 'Prélèvement effectué'}
    </div>
  );
}

export function PilotProposalPage() {
  return (
    <div className="bg-[#eef2f5] px-3 py-6 sm:px-6 sm:py-10 lg:px-8">
      <div className="space-y-6 sm:space-y-10">
        <PageShell page={1}>
          <PageTitle
            eyebrow="Proposition d’amélioration"
            title="Assistant de rappel des prélèvements en production"
            subtitle="Transformer un événement déjà présent dans S.P.I. en consigne opérateur claire, au bon moment, sans écrire dans S.P.I."
          />

          <div className="mt-10 rounded-2xl bg-[#163f5b] px-6 py-7 text-white sm:px-8 sm:py-9">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Enjeu</div>
            <div className="mt-3 max-w-4xl text-2xl font-black leading-tight sm:text-3xl">
              Le signal existe déjà. Le pilote rend immédiatement visible l’action de prélèvement attendue.
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <OutcomeCard title="Signal disponible" text="Les événements déclencheurs sont déjà déclarés dans S.P.I. : fin de cuve, arrêt prolongé, changement, etc." />
            <OutcomeCard title="Règles par ligne" text="Le prélèvement attendu dépend de la ligne et de la situation ; le référentiel doit donc être configurable." />
            <OutcomeCard title="Action opérateur" text="Le rappel reste affiché jusqu’à confirmation, afin de réduire le risque d’oubli et d’ambiguïté." />
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-[1fr_0.9fr]">
            <div className="rounded-xl border border-slate-200 p-6">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Aujourd’hui</div>
              <div className="mt-4 flex items-center gap-4 text-[#0f274b]">
                <div className="rounded-lg bg-slate-100 px-4 py-3 text-center text-sm font-black">Événement S.P.I.</div>
                <ArrowRight className="h-5 w-5 text-slate-400" />
                <div className="rounded-lg bg-slate-100 px-4 py-3 text-center text-sm font-black">Interprétation de la règle</div>
                <ArrowRight className="h-5 w-5 text-slate-400" />
                <div className="rounded-lg bg-slate-100 px-4 py-3 text-center text-sm font-black">Prélèvement</div>
              </div>
            </div>

            <div className="rounded-xl border border-[#b9dfdd] bg-[#edf8f7] p-6">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-[#117b80]">Avec le pilote</div>
              <div className="mt-4 space-y-2 text-sm font-semibold leading-6 text-[#163f5b]">
                <div>1. L’événement est détecté.</div>
                <div>2. La règle de la ligne est appliquée.</div>
                <div>3. Le prélèvement attendu est affiché.</div>
                <div>4. L’opérateur confirme sa réalisation.</div>
              </div>
            </div>
          </div>

          <div className="mt-10 rounded-xl border border-[#b9dfdd] bg-white px-6 py-5 text-center">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-[#117b80]">Objectif de cette proposition</div>
            <div className="mt-2 text-lg font-black text-[#163f5b] sm:text-xl">Obtenir l’autorisation d’un essai contrôlé sur une ligne pilote.</div>
            <div className="mt-2 text-xs text-slate-500">Proposition élaborée par AKIK Mohamed Amine et Hugo JULIEN</div>
          </div>
        </PageShell>

        <PageShell page={2}>
          <PageTitle
            eyebrow="Fonctionnement"
            title="Une boucle simple, lisible et contrôlée"
            subtitle="Le pilote se concentre sur cinq étapes. Chaque étape a un rôle unique et compréhensible."
          />

          <div className="mt-8 grid gap-4">
            <FlowStep number={1} title="Lire l’événement" text="Récupérer la ligne, le type d’événement, l’horaire et la durée utile depuis S.P.I." icon={<Factory className="h-5 w-5" />} />
            <FlowStep number={2} title="Identifier la règle" text="Consulter le référentiel validé pour la ligne concernée." icon={<Database className="h-5 w-5" />} />
            <FlowStep number={3} title="Déterminer l’action" text="Évaluer la condition et déterminer le ou les prélèvements attendus." icon={<Workflow className="h-5 w-5" />} />
            <FlowStep number={4} title="Afficher le rappel" text="Présenter l’événement et l’action attendue dans une fenêtre persistante." icon={<Bell className="h-5 w-5" />} />
            <FlowStep number={5} title="Confirmer" text="L’opérateur confirme la réalisation ; le rappel est alors acquitté." icon={<CheckCircle2 className="h-5 w-5" />} />
          </div>

          <div className="mt-8 rounded-2xl border border-blue-200 bg-blue-50 p-6">
            <div className="flex items-start gap-4">
              <ShieldCheck className="mt-0.5 h-8 w-8 shrink-0 text-[#0f274b]" />
              <div>
                <div className="text-lg font-black text-[#0f274b]">S.P.I. reste inchangé</div>
                <p className="mt-2 text-sm leading-6 text-slate-700">Le pilote lit les informations nécessaires mais ne réalise aucune écriture dans S.P.I. Une indisponibilité du pilote ne doit pas interrompre S.P.I. ni la production.</p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <OutcomeCard title="Persistance" text="Un rappel non acquitté reste actif après redémarrage." />
            <OutcomeCard title="Pas de doublons" text="Un même événement ne génère pas plusieurs rappels identiques." />
            <OutcomeCard title="Règles validées" text="Les règles de prélèvement sont configurées et validées avant activation." />
          </div>
        </PageShell>

        <PageShell page={3}>
          <PageTitle
            eyebrow="Cadre de l’essai"
            title="Un périmètre limité pour décider sur des faits"
            subtitle="Le premier essai doit être suffisamment petit pour rester maîtrisable et suffisamment concret pour mesurer son utilité."
          />

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-green-200 bg-green-50 p-6">
              <div className="text-sm font-black uppercase tracking-[0.14em] text-green-800">Inclus</div>
              <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-700">
                <li>• Une ligne pilote</li>
                <li>• Un nombre limité d’événements validés</li>
                <li>• Des règles propres à la ligne</li>
                <li>• Un rappel persistant avec file d’attente</li>
                <li>• Une confirmation explicite par l’opérateur</li>
                <li>• Une reprise après redémarrage</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <div className="text-sm font-black uppercase tracking-[0.14em] text-slate-600">Hors périmètre du premier essai</div>
              <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-700">
                <li>• Écriture dans S.P.I.</li>
                <li>• Historique qualité complet</li>
                <li>• Tableau de bord multi-lignes</li>
                <li>• Escalades hiérarchiques avancées</li>
                <li>• Réconciliation avec les systèmes qualité</li>
                <li>• Déploiement généralisé</li>
              </ul>
            </div>
          </div>

          <div className="mt-8">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-[#117b80]">Critères de réussite</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                'Chaque scénario validé déclenche le bon rappel.',
                'Aucun rappel en double pour un même événement.',
                'Un rappel non acquitté réapparaît après redémarrage.',
                'S.P.I. et la ligne ne sont pas dégradés par le pilote.',
                'Le message est compris rapidement par les opérateurs.',
                'La revue du pilote permet de décider : poursuivre, ajuster ou arrêter.',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm leading-6 text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#117b80]" /> {item}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 rounded-2xl bg-[#173f68] px-6 py-6 text-white">
            <div className="flex items-start gap-4">
              <Target className="mt-0.5 h-8 w-8 shrink-0" />
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-blue-100">Décision demandée</div>
                <div className="mt-2 text-xl font-black leading-7">Autoriser une étude courte avec l’IT, Production et Qualité puis, si les conditions sont validées, un essai contrôlé sur une ligne pilote.</div>
                <div className="mt-3 text-xs leading-5 text-slate-200">Toute extension au-delà du périmètre pilote fera l’objet d’une validation distincte.</div>
              </div>
            </div>
          </div>
        </PageShell>

        <PageShell page={4}>
          <PageTitle
            eyebrow="Expérience opérateur"
            title="L’alerte doit être comprise en quelques secondes"
            subtitle="L’écran principal concentre uniquement le contexte, le prélèvement attendu et l’action de confirmation."
          />

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.45fr_0.55fr]">
            <ReminderScreen title="Prélèvements requis" subtitle="Action opérateur requise" event="Fin de cuve" time="08:47">
              <div className="text-sm font-black uppercase text-[#b90e0e]">À réaliser</div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <SampleCard number={1} quantity="4" unit="BOÎTES" label="Pack / Physico" icon={<Boxes className="h-5 w-5" />} />
                <SampleCard number={2} quantity="5" unit="PF" label="Microbiologie" icon={<Microscope className="h-5 w-5" />} />
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2.5 text-xs text-slate-700"><Info className="h-4 w-4 shrink-0 text-blue-600" />La validation confirme que l’ensemble des prélèvements indiqués a été réalisé.</div>
              <SuccessButton />
            </ReminderScreen>

            <div className="space-y-4">
              {[
                ['1', 'Pourquoi ?', 'L’événement déclencheur est visible immédiatement.'],
                ['2', 'Quoi faire ?', 'La quantité et le type de prélèvement sont au centre de l’écran.'],
                ['3', 'Comment terminer ?', 'Une seule action de confirmation clôt le rappel.'],
              ].map(([number, title, text]) => (
                <div key={number} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0f274b] text-sm font-black text-white">{number}</div>
                  <div className="mt-4 text-base font-black text-[#0f274b]">{title}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <OutcomeCard title="Une seule priorité" text="L’action attendue domine visuellement le reste de l’écran." />
            <OutcomeCard title="Contexte suffisant" text="Ligne, événement et heure permettent à l’opérateur de situer le rappel." />
            <OutcomeCard title="Validation explicite" text="Le rappel n’est acquitté qu’après une action volontaire de l’opérateur." />
          </div>
        </PageShell>

        <PageShell page={5}>
          <PageTitle
            eyebrow="Parcours opérateur"
            title="Gérer l’attente puis confirmer"
            subtitle="Lorsque plusieurs rappels existent, le dispositif les présente successivement et confirme clairement la clôture du rappel traité."
          />

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0f274b] text-sm font-black text-white">1</div>
                <div className="text-lg font-black text-[#0f274b]">File d’attente</div>
              </div>
              <ReminderScreen title="2 rappels en attente" subtitle="Action opérateur requise" event="Fin de cuve" time="08:47" queue="1 autre rappel est en attente et sera présenté après validation de celui-ci.">
                <div className="text-sm font-black uppercase text-[#b90e0e]">À réaliser</div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <SampleCard number={1} quantity="4" unit="BOÎTES" label="Pack / Physico" icon={<Boxes className="h-5 w-5" />} />
                  <SampleCard number={2} quantity="5" unit="PF" label="Microbiologie" icon={<Microscope className="h-5 w-5" />} />
                </div>
                <SuccessButton />
              </ReminderScreen>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#07843d] text-sm font-black text-white">2</div>
                <div className="text-lg font-black text-[#0f274b]">Confirmation</div>
              </div>
              <ReminderScreen title="Prélèvement confirmé" tone="success" footer="Fermeture automatique dans quelques secondes">
                <div className="flex min-h-[390px] flex-col items-center justify-center text-center">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-green-600 text-green-700"><Check className="h-14 w-14" /></div>
                  <div className="mt-6 text-2xl font-black text-[#0f274b]">Le rappel a été acquitté.</div>
                  <p className="mt-4 max-w-md text-sm leading-6 text-slate-600">Le dispositif poursuit la surveillance et affichera le prochain rappel en attente, ou un nouveau rappel si une action est requise.</p>
                  <div className="mt-5 flex items-center gap-2 rounded-lg border border-green-100 bg-green-50 px-4 py-3 text-sm font-black text-green-800"><ShieldCheck className="h-5 w-5" />S.P.I. et la production ne sont pas affectés.</div>
                </div>
              </ReminderScreen>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-5 py-5 text-center text-sm font-semibold text-slate-700">
            <Bell className="h-5 w-5 text-[#0f274b]" /> Un rappel actif reste visible jusqu’à sa validation ; le suivant apparaît ensuite.
          </div>
        </PageShell>

        <PageShell page={6}>
          <PageTitle
            eyebrow="Robustesse"
            title="Trois situations particulières, trois réponses explicites"
            subtitle="Le pilote ne doit ni masquer une situation dégradée, ni bloquer la production, ni inventer une règle absente."
          />

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div>
              <div className="mb-3 text-base font-black text-[#0f274b]">1. Reprise après redémarrage</div>
              <ReminderScreen title="Prélèvement requis" subtitle="Action opérateur requise" event="Arrêt supérieur à 4 heures" time="09:24" restored>
                <div className="text-sm font-black uppercase text-[#b90e0e]">À réaliser</div>
                <div className="mt-3"><SampleCard number={1} quantity="5" unit="PF" label="Microbiologie" icon={<Microscope className="h-5 w-5" />} /></div>
                <SuccessButton plural={false} />
              </ReminderScreen>
              <p className="mt-3 text-sm leading-6 text-slate-600">Le rappel actif est restauré après redémarrage et conserve son contexte initial.</p>
            </div>

            <div>
              <div className="mb-3 text-base font-black text-[#0f274b]">2. Perte de communication S.P.I.</div>
              <ReminderScreen title="Surveillance S.P.I. temporairement indisponible" tone="warning" subtitle="Communication S.P.I. indisponible" event="Communication S.P.I." time="09:16">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center gap-2 text-base font-black text-amber-800"><WifiOff className="h-5 w-5" />S.P.I. et la production ne sont pas affectés.</div>
                  <div className="mt-3 text-sm leading-6 text-slate-700">Les rappels déjà actifs restent conservés. Le dispositif tente de rétablir la communication.</div>
                </div>
              </ReminderScreen>
              <p className="mt-3 text-sm leading-6 text-slate-600">L’indisponibilité est visible, mais elle n’efface pas les rappels en cours.</p>
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-3 text-base font-black text-[#0f274b]">3. Événement sans règle applicable</div>
            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <ReminderScreen title="Assistance non disponible pour cet événement" tone="warning" subtitle="Aucune règle de prélèvement applicable" event="Changement kit / cuve débranchée" time="09:32">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-slate-800">
                  <div className="text-base font-black">Aucune règle validée n’est disponible pour cette situation.</div>
                  <div className="mt-3 text-sm leading-6">Le dispositif ne génère aucun prélèvement. Appliquer la procédure habituelle et contacter Qualité si nécessaire.</div>
                </div>
                <div className="mt-4 rounded-lg border border-amber-300 px-4 py-3 text-center text-base font-black uppercase text-amber-700">J’ai pris connaissance</div>
              </ReminderScreen>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
                <Info className="h-8 w-8 text-[#0f274b]" />
                <div className="mt-4 text-lg font-black text-[#0f274b]">Principe de sécurité</div>
                <p className="mt-3 text-sm leading-6 text-slate-600">Sans règle validée, le pilote n’indique pas de prélèvement. L’opérateur est renvoyé vers la procédure Qualité en vigueur.</p>
              </div>
            </div>
          </div>
        </PageShell>

        <PageShell page={7}>
          <PageTitle
            eyebrow="Référentiel métier"
            title="Les règles de prélèvement sont gérées par ligne"
            subtitle="La logique générale reste stable ; ce sont les règles validées du référentiel qui déterminent le prélèvement attendu."
          />

          <div className="mt-8 overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center justify-between bg-[#0f274b] px-5 py-4 text-white">
              <div>
                <div className="text-base font-black uppercase">Référentiel des règles de prélèvements</div>
                <div className="mt-1 text-xs text-slate-200">Exemple de configuration par ligne</div>
              </div>
              <Database className="h-7 w-7" />
            </div>
            <div className="overflow-x-auto p-4">
              <table className="w-full min-w-[820px] border-collapse text-xs text-slate-700">
                <thead>
                  <tr className="bg-[#124578] text-white">
                    <th className="p-3 text-left">LIGNE</th>
                    <th className="p-3 text-left">ÉVÉNEMENT S.P.I.</th>
                    <th className="p-3 text-left">CONDITION</th>
                    <th className="p-3 text-left">PRÉLÈVEMENT(S) ATTENDU(S)</th>
                    <th className="p-3 text-left">VERSION</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['L108', 'Arrêt production', 'Durée > 4 h', '5 PF · Microbiologie', '1.0'],
                    ['L108', 'Fin de cuve', '—', '4 boîtes · Pack / Physico + 5 PF · Microbiologie', '1.1'],
                    ['L108', 'Début de cuve', '—', 'Règle validée L108', '1.0'],
                    ['L108', 'Changement kit / cuve débranchée', '—', '5 PF · Microbiologie', '1.0'],
                    ['L109', 'Fin de cuve', '—', '4 boîtes · Pack / Physico + 5 PF · Microbiologie', '1.0'],
                  ].map((row) => (
                    <tr key={row.join('-')} className="border-b border-slate-200 last:border-b-0">
                      {row.map((cell, index) => <td key={`${row[0]}-${index}-${cell}`} className={`p-3 align-top leading-5 ${index === 0 ? 'font-black text-green-700' : ''}`}>{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <OutcomeCard title="Configuré par ligne" text="Chaque ligne peut disposer de règles différentes pour un même type d’événement." />
            <OutcomeCard title="Validé avant activation" text="Les règles utilisées par le pilote sont celles qui ont été approuvées pour le périmètre concerné." />
            <OutcomeCard title="Évolutif" text="Une évolution métier peut être portée dans le référentiel sans modifier la boucle générale du pilote." />
          </div>

          <div className="mt-8 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-sm font-semibold text-green-800">
            <ShieldCheck className="h-6 w-6 shrink-0" /> Le moteur applique les règles du référentiel ; il ne déduit pas lui-même une règle métier absente.
          </div>
        </PageShell>

        <PageShell page={8}>
          <PageTitle
            eyebrow="Architecture"
            title="Un dispositif complémentaire, séparé de S.P.I."
            subtitle="L’architecture vise à isoler le pilote : lecture des événements, application des règles, affichage du rappel, puis validation opérateur."
          />

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <div className="mx-auto flex max-w-xl flex-col items-center gap-3 text-center">
                {[
                  ['S.P.I.', 'Source des événements', 'blue'],
                  ['Détection', 'Lecture de la ligne, de l’événement et du contexte', 'blue'],
                  ['Référentiel de la ligne', 'Règles métier validées', 'green'],
                  ['Moteur de règles', 'Évaluation de la condition', 'blue'],
                  ['Rappel opérateur', 'Action attendue affichée et persistante', 'green'],
                  ['Validation', 'Prélèvement déclaré réalisé', 'green'],
                ].map(([title, sub, tone], index) => (
                  <div key={title} className="w-full">
                    <div className={`rounded-xl border px-4 py-3 ${tone === 'green' ? 'border-green-200 bg-green-50' : 'border-blue-200 bg-blue-50'}`}>
                      <div className="text-base font-black text-[#0f274b]">{title}</div>
                      <div className="mt-1 text-xs text-slate-600">{sub}</div>
                    </div>
                    {index < 5 && <div className="py-1 text-lg text-slate-400">↓</div>}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
                <ShieldCheck className="h-7 w-7 text-[#0f274b]" />
                <div className="mt-3 text-base font-black text-[#0f274b]">Lecture seule de S.P.I.</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">Aucune écriture n’est réalisée dans S.P.I.</p>
              </div>
              <div className="rounded-xl border border-green-200 bg-green-50 p-5">
                <RefreshCcw className="h-7 w-7 text-green-800" />
                <div className="mt-3 text-base font-black text-green-800">Persistance des rappels</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">Un rappel actif reste présent jusqu’à son acquittement, y compris après redémarrage.</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                <AlertTriangle className="h-7 w-7 text-amber-700" />
                <div className="mt-3 text-base font-black text-amber-800">Défaillance isolée</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">Une indisponibilité du pilote n’interrompt pas S.P.I. ni la production.</p>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-2xl bg-[#173f68] p-6 text-white">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-blue-100">Prochaine étape proposée</div>
            <div className="mt-2 text-xl font-black leading-7">Valider avec l’IT le mode d’accès en lecture, puis confirmer avec Production et Qualité les événements et règles du périmètre pilote.</div>
          </div>
        </PageShell>
      </div>
    </div>
  );
}
