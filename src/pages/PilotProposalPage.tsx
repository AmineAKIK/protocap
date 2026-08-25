import {
  AlertTriangle,
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
  WifiOff,
  Workflow,
} from 'lucide-react';

const TOTAL_PAGES = 6;
const pageClass =
  'mx-auto w-full max-w-[1120px] overflow-hidden bg-white shadow-[0_18px_60px_rgba(15,23,42,0.10)] ring-1 ring-slate-200';

function DocumentHeader({ page }: { page: number }) {
  return (
    <>
      <div className="flex items-center justify-between gap-4 text-[10px] font-semibold text-slate-500 sm:text-xs">
        <span>S.P.I. | Proposition d’essai pilote</span>
        <span>Version 0.3 - 25 août 2026 | Page {page} / {TOTAL_PAGES}</span>
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

function SectionBand({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-[#bfd3dc] bg-[#eaf3f6] px-4 py-1.5 text-center text-[11px] font-black uppercase tracking-wide text-[#174b67] sm:text-xs">
      {children}
    </div>
  );
}

function NumberedTitle({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <h2 className="mt-3 text-xl font-black tracking-tight text-[#163f5b] sm:text-2xl">
      {number}. {children}
    </h2>
  );
}

function StepRow({ number, label, children, tone = 'teal' }: { number: number; label: string; children: React.ReactNode; tone?: 'teal' | 'navy' }) {
  return (
    <div className="grid grid-cols-[7.8rem_minmax(0,1fr)] border-x border-b border-slate-200 text-[11px] leading-5 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:text-sm">
      <div className={`${tone === 'navy' ? 'bg-[#183f68]' : 'bg-[#117b80]'} px-3 py-2 text-center font-black text-white`}>
        {number}&nbsp; {label}
      </div>
      <div className="bg-[#f8fafc] px-3 py-2 text-slate-700">{children}</div>
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
      <div className={`${headerTone} flex min-h-[74px] items-center justify-between gap-3 px-4 py-3 text-white`}>
        <div className="flex min-w-0 items-center gap-3">
          {tone === 'success' ? <CheckCircle2 className="h-9 w-9 shrink-0" /> : <AlertTriangle className="h-9 w-9 shrink-0" />}
          <div className="min-w-0">
            <div className="text-base font-black uppercase leading-tight sm:text-lg">{title}</div>
            {subtitle && <div className="mt-0.5 text-[11px] font-semibold opacity-90 sm:text-xs">{subtitle}</div>}
          </div>
        </div>
        {restored && (
          <div className="flex shrink-0 items-center gap-1 rounded-md bg-amber-300 px-2 py-1 text-[10px] font-black uppercase text-slate-900">
            <RefreshCcw className="h-3.5 w-3.5" /> Rappel restauré
          </div>
        )}
      </div>

      {queue && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-semibold text-slate-700 sm:text-xs">
          <Info className="h-4 w-4 shrink-0 text-amber-500" /> {queue}
        </div>
      )}

      {tone !== 'success' && (
        <div className="mx-4 mt-3 grid grid-cols-3 divide-x divide-slate-200 rounded-lg border border-slate-200 bg-white px-2 py-3 text-[#0f274b]">
          <div className="flex items-center gap-2 px-2">
            <Factory className="h-6 w-6 shrink-0" />
            <div><div className="text-[9px] font-black uppercase">Ligne</div><div className="text-base font-black">L108</div></div>
          </div>
          <div className="flex items-center gap-2 px-2">
            <Flag className="h-6 w-6 shrink-0" />
            <div><div className="text-[9px] font-black uppercase">Événement</div><div className="text-[11px] font-black leading-4 sm:text-xs">{event}</div></div>
          </div>
          <div className="flex items-center gap-2 px-2">
            <Clock3 className="h-6 w-6 shrink-0" />
            <div><div className="text-[9px] font-black uppercase">Détecté à</div><div className="text-base font-black">{time}</div><div className="text-[9px] font-semibold">14/05/2025</div></div>
          </div>
        </div>
      )}

      <div className="p-4">{children}</div>
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2 text-[9px] font-medium text-slate-500 sm:text-[10px]">
        <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Assistant de rappel des prélèvements</span>
        <span>{footer}</span>
      </div>
    </div>
  );
}

function SampleCard({ number, quantity, unit, label, icon }: { number: number; quantity: string; unit: string; label: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-red-100 bg-red-50/70 p-3">
      <div className="flex items-end gap-2 text-[#b90e0e]">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#c70b0b] text-xs font-black text-white">{number}</span>
        <span className="text-4xl font-black leading-none">{quantity}</span>
        <span className="pb-1 text-sm font-black text-[#0f274b]">{unit}</span>
      </div>
      <div className="mt-3 border-t border-red-200 pt-2 text-sm font-black text-[#0f274b]">
        <span className="flex items-center gap-2">{icon}{label}</span>
      </div>
    </div>
  );
}

function SuccessButton({ plural = true }: { plural?: boolean }) {
  return (
    <div className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-[#079447] px-4 py-3 text-sm font-black uppercase text-white shadow-inner sm:text-base">
      <CheckCircle2 className="h-6 w-6" /> {plural ? 'Prélèvements effectués' : 'Prélèvement effectué'}
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

export function PilotProposalPage() {
  return (
    <div className="bg-[#eef2f5] px-3 py-6 sm:px-6 sm:py-10 lg:px-8">
      <div className="space-y-6 sm:space-y-10">
        <PageShell page={1}>
          <SectionBand>PROPOSITION D’AMÉLIORATION - PÉRIMÈTRE PILOTE</SectionBand>
          <div className="mt-4">
            <h1 className="max-w-4xl text-3xl font-black leading-[1.03] tracking-tight text-[#163f5b] sm:text-5xl">
              Assistant de rappel des prélèvements en production
            </h1>
            <p className="mt-4 max-w-4xl text-sm font-medium leading-6 text-slate-700 sm:text-lg sm:leading-8">
              Utiliser les événements déjà déclarés dans S.P.I. pour afficher le bon prélèvement, au bon moment, sans modifier S.P.I.
            </p>
            <p className="mt-3 text-[11px] font-bold text-slate-500 sm:text-sm">
              Proposition élaborée par : AKIK Mohamed Amine • Hugo JULIEN
            </p>
            <div className="mt-5 bg-[#173f68] px-4 py-2.5 text-center text-xs font-black uppercase tracking-wide text-white sm:text-sm">
              OBJECTIF : obtenir l’autorisation d’un essai contrôlé sur une ligne pilote.
            </div>
          </div>

          <NumberedTitle number={1}>Constat opérationnel</NumberedTitle>
          <p className="mt-2 text-[12px] leading-5 text-slate-700 sm:text-[15px] sm:leading-6">
            Certains événements de production déclenchent des prélèvements définis par les règles métier. Aujourd’hui, l’événement est déjà déclaré dans S.P.I., mais le lien entre cet événement et le prélèvement attendu repose encore largement sur la vigilance de l’opérateur.
          </p>
          <ul className="mt-3 space-y-1.5 pl-5 text-[12px] leading-5 text-slate-700 marker:text-[#117b80] sm:text-[15px] sm:leading-6">
            <li>Des oublis de prélèvements sont observés en production.</li>
            <li>Les événements déclencheurs sont déjà signalés dans S.P.I. : changement, début/fin de séquence, arrêt prolongé, etc.</li>
            <li>Les prélèvements à réaliser peuvent varier selon la ligne : la règle doit donc être configurable par ligne.</li>
          </ul>
          <p className="mt-3 text-[12px] font-semibold leading-5 text-slate-800 sm:text-[15px] sm:leading-6">
            Le principe proposé consiste à exploiter un signal déjà présent pour rappeler automatiquement l’action attendue.
          </p>

          <NumberedTitle number={2}>Principe proposé</NumberedTitle>
          <div className="mt-3 grid overflow-hidden border border-slate-200 md:grid-cols-2">
            <div className="border-b border-slate-200 md:border-b-0 md:border-r">
              <div className="bg-[#f1f3f5] px-4 py-2 text-center text-xs font-black uppercase tracking-wide text-slate-600">AUJOURD’HUI</div>
              <div className="flex min-h-36 items-center justify-center px-5 py-4 text-center text-sm font-semibold leading-7 text-slate-700 sm:text-base">
                Événement déclaré dans S.P.I.<br />
                &gt; l’opérateur identifie la règle applicable<br />
                &gt; prélèvement
              </div>
            </div>
            <div>
              <div className="bg-[#dff2f1] px-4 py-2 text-center text-xs font-black uppercase tracking-wide text-[#117b80]">AVEC LE PILOTE</div>
              <div className="flex min-h-36 items-center justify-center px-5 py-4 text-center text-sm font-semibold leading-7 text-slate-700 sm:text-base">
                Événement déclaré dans S.P.I.<br />
                &gt; règle de la ligne identifiée automatiquement<br />
                &gt; rappel persistant<br />
                &gt; validation opérateur
              </div>
            </div>
          </div>

          <NumberedTitle number={3}>Valeur attendue</NumberedTitle>
          <div className="mt-3 grid border-l border-t border-slate-200 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Moins d’oublis', 'Rappel déclenché à partir de l’événement déjà signalé.'],
              ['Instruction claire', 'La fenêtre indique le prélèvement attendu pour la ligne concernée.'],
              ['S.P.I. inchangé', 'Le dispositif fonctionne en complément, sans écriture dans S.P.I.'],
              ['Déploiement progressif', 'Un moteur commun avec des règles configurables ligne par ligne.'],
            ].map(([title, text]) => (
              <div key={title} className="border-b border-r border-slate-200 px-4 py-4">
                <h3 className="text-sm font-black text-[#163f5b]">{title}</h3>
                <p className="mt-1.5 text-xs leading-5 text-slate-600 sm:text-sm">{text}</p>
              </div>
            ))}
          </div>
        </PageShell>

        <PageShell page={2}>
          <SectionBand>FONCTIONNEMENT DU PILOTE</SectionBand>
          <NumberedTitle number={4}>Fonctionnement proposé</NumberedTitle>
          <p className="mt-2 text-[12px] leading-5 text-slate-700 sm:text-[15px] sm:leading-6">
            Le pilote suit une boucle simple : détecter un événement pertinent, identifier la règle associée à la ligne, afficher le rappel et maintenir ce rappel jusqu’à une action explicite de l’opérateur.
          </p>

          <div className="mt-3 border-t border-slate-200">
            <StepRow number={1} label="S.P.I." tone="navy">Source de l’événement - S.P.I. reste inchangé.</StepRow>
            <StepRow number={2} label="Détection">Lecture des informations utiles : ligne, type d’événement, horaire et durée selon le cas.</StepRow>
            <StepRow number={3} label="Règle">Le moteur consulte le référentiel configuré pour la ligne.</StepRow>
            <StepRow number={4} label="Rappel">Une fenêtre persistante affiche l’événement et le prélèvement à réaliser.</StepRow>
            <StepRow number={5} label="Validation" tone="navy">L’opérateur confirme « Prélèvement effectué ». Le rappel est alors acquitté.</StepRow>
          </div>

          <NumberedTitle number={5}>Robustesse et garde-fous</NumberedTitle>
          <div className="mt-3 grid border-l border-t border-slate-200 sm:grid-cols-2">
            {[
              ['S.P.I. protégé', 'Aucune modification ni écriture dans S.P.I.'],
              ['Défaillance isolée', 'Une indisponibilité du dispositif de rappel n’interrompt ni S.P.I. ni la ligne.'],
              ['Persistance des rappels', 'Un rappel actif reste présent après redémarrage jusqu’à son acquittement.'],
              ['Pas de doublons', 'Un même événement ne génère pas plusieurs rappels identiques.'],
              ['Référentiel maîtrisé', 'Les règles sont configurées par ligne et validées avant activation.'],
              ['Validation opérateur', 'Le clic confirme que l’opérateur déclare le prélèvement réalisé.'],
            ].map(([title, text]) => (
              <div key={title} className="border-b border-r border-slate-200 bg-[#f8fafc] px-4 py-3">
                <h3 className="text-xs font-black text-[#163f5b] sm:text-sm">{title}</h3>
                <p className="mt-1 text-[11px] leading-5 text-slate-600 sm:text-[13px]">{text}</p>
              </div>
            ))}
          </div>
          <div className="border-x border-b border-[#bfd3dc] bg-[#eaf3f6] px-4 py-2 text-[11px] leading-5 text-[#24556f] sm:text-[13px]">
            Le raccordement à S.P.I. sera défini avec l’IT selon les droits d’accès, les contraintes réseau et l’environnement du poste pilote.
          </div>

          <NumberedTitle number={6}>Périmètre du premier essai</NumberedTitle>
          <div className="mt-3 grid border border-slate-200 md:grid-cols-2">
            <div className="border-b border-slate-200 bg-[#eef8e8] p-4 md:border-b-0 md:border-r">
              <h3 className="text-center text-xs font-black uppercase tracking-wide text-[#527d48] sm:text-sm">INCLUS DANS LE PILOTE</h3>
              <ul className="mt-3 space-y-1.5 pl-5 text-xs leading-5 text-slate-700 sm:text-sm">
                <li>Une ligne pilote et des événements validés</li>
                <li>Règles configurables propres à la ligne</li>
                <li>Fenêtre persistante et file d’attente</li>
                <li>Validation explicite par l’opérateur</li>
                <li>Reprise après redémarrage</li>
              </ul>
            </div>
            <div className="bg-[#f7f8fa] p-4">
              <h3 className="text-center text-xs font-black uppercase tracking-wide text-slate-600 sm:text-sm">HORS PÉRIMÈTRE INITIAL</h3>
              <ul className="mt-3 space-y-1.5 pl-5 text-xs leading-5 text-slate-700 sm:text-sm">
                <li>Écriture dans S.P.I.</li>
                <li>Historique qualité complet</li>
                <li>Tableau de bord multi-lignes</li>
                <li>Escalades hiérarchiques avancées</li>
                <li>Réconciliation avec les systèmes qualité</li>
              </ul>
            </div>
          </div>
        </PageShell>

        <PageShell page={3}>
          <SectionBand>PILOTE CONTRÔLÉ ET DÉCISION</SectionBand>
          <NumberedTitle number={7}>Déroulement recommandé de l’essai</NumberedTitle>
          <div className="mt-3 border-t border-slate-200">
            <StepRow number={1} label="Cadrer" tone="navy">Production et Qualité valident les événements, seuils et prélèvements. L’IT valide le mode d’accès et les contraintes poste/réseau.</StepRow>
            <StepRow number={2} label="Valider">Tester les scénarios retenus avec des événements simulés avant raccordement.</StepRow>
            <StepRow number={3} label="Essayer">Installer le dispositif sur une seule ligne, sur une durée courte à convenir.</StepRow>
            <StepRow number={4} label="Décider" tone="navy">Faire une revue conjointe des résultats et décider de la suite.</StepRow>
          </div>

          <h3 className="mt-4 text-sm font-black text-[#117b80] sm:text-base">Critères de réussite proposés</h3>
          <div className="mt-2 grid border-l border-t border-slate-200 sm:grid-cols-2">
            {[
              '✓ Chaque scénario validé déclenche le bon rappel.',
              '✓ Aucun rappel en double pour un même événement.',
              '✓ Un rappel non acquitté réapparaît après redémarrage.',
              '✓ Aucune dégradation du fonctionnement de S.P.I. ou de la ligne.',
              '✓ Le message est compris rapidement par les opérateurs.',
              '✓ La revue du pilote permet de décider : poursuivre, ajuster ou arrêter.',
            ].map((item) => (
              <div key={item} className="border-b border-r border-slate-200 px-3 py-2 text-[11px] leading-5 text-slate-700 sm:text-[13px]">{item}</div>
            ))}
          </div>

          <NumberedTitle number={8}>Évolutions possibles après validation du pilote</NumberedTitle>
          <p className="mt-2 text-[11px] leading-5 text-slate-700 sm:text-[13px]">
            Selon les résultats, le dispositif pourra être enrichi avec la traçabilité des acquittements, l’historique, les délais de réalisation, les relances, les tableaux de bord, la centralisation multi-lignes et les interfaces avec les systèmes qualité.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ['Opérateur', 'Une consigne immédiatement compréhensible, sans recherche de règle.'],
              ['Qualité', 'Des règles explicites, configurables et validées avant activation.'],
              ['IT / Production', 'Un dispositif complémentaire, en lecture seule vis-à-vis de S.P.I.'],
            ].map(([title, text]) => (
              <div key={title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-black text-[#163f5b]">{title}</div>
                <div className="mt-2 text-xs leading-5 text-slate-600">{text}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 bg-[#173f68] px-5 py-5 text-center text-white">
            <p className="text-xs font-black uppercase tracking-wide sm:text-sm">DÉCISION DEMANDÉE</p>
            <p className="mt-1 text-sm font-black leading-5 sm:text-lg sm:leading-7">
              Autoriser une étude courte avec l’IT, Production et Qualité puis, si les conditions sont validées, un essai contrôlé sur une ligne pilote.
            </p>
            <p className="mt-2 text-[11px] text-slate-200 sm:text-xs">
              Toute extension au-delà du périmètre pilote fera l’objet d’une validation distincte.
            </p>
          </div>
        </PageShell>

        <PageShell page={4}>
          <div className="flex items-center gap-3 text-[#0f274b]">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0f274b] text-white"><Bell className="h-6 w-6" /></div>
            <div>
              <h2 className="text-2xl font-black sm:text-3xl">Parcours opérateur — écrans clés du pilote</h2>
              <p className="mt-1 text-xs font-medium text-slate-600 sm:text-sm">Les écrans présentent les actions attendues et les principaux états rencontrés pendant l’exploitation.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_0.7fr]">
            <div className="space-y-4">
              <ReminderScreen title="Prélèvements requis" subtitle="Action opérateur requise" event="Fin de cuve" time="08:47">
                <div className="text-xs font-black uppercase text-[#b90e0e]">À réaliser</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <SampleCard number={1} quantity="4" unit="BOÎTES" label="Pack / Physico" icon={<Boxes className="h-4 w-4" />} />
                  <SampleCard number={2} quantity="5" unit="PF" label="Microbiologie" icon={<Microscope className="h-4 w-4" />} />
                </div>
                <div className="mt-2 flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-[10px] text-slate-700"><Info className="h-4 w-4 text-blue-600" />La validation confirme que l’ensemble des prélèvements indiqués a été réalisé.</div>
                <SuccessButton />
              </ReminderScreen>
              <div className="rounded-lg border-l-4 border-[#0f274b] bg-slate-50 px-4 py-3">
                <div className="text-sm font-black text-[#0f274b]">1. Détection et rappel</div>
                <div className="mt-1 text-xs leading-5 text-slate-600">Le dispositif détecte l’événement S.P.I. et présente les prélèvements attendus.</div>
              </div>
            </div>

            <div className="space-y-4">
              <ReminderScreen title="2 rappels en attente" subtitle="Action opérateur requise" event="Fin de cuve" time="08:47" queue="1 autre rappel est en attente et sera présenté après validation de celui-ci.">
                <div className="text-xs font-black uppercase text-[#b90e0e]">À réaliser</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <SampleCard number={1} quantity="4" unit="BOÎTES" label="Pack / Physico" icon={<Boxes className="h-4 w-4" />} />
                  <SampleCard number={2} quantity="5" unit="PF" label="Microbiologie" icon={<Microscope className="h-4 w-4" />} />
                </div>
                <SuccessButton />
              </ReminderScreen>
              <div className="rounded-lg border-l-4 border-[#0f274b] bg-slate-50 px-4 py-3">
                <div className="text-sm font-black text-[#0f274b]">2. Gestion de file d’attente</div>
                <div className="mt-1 text-xs leading-5 text-slate-600">Plusieurs rappels peuvent être en attente ; ils sont traités successivement.</div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-[#f8fbff] p-4">
              <h3 className="text-base font-black text-[#0f274b]">Bénéfices opérateurs</h3>
              {[
                [Bell, 'Persistant jusqu’à validation', 'Le rappel reste actif jusqu’à son acquittement, y compris après redémarrage.'],
                [ShieldCheck, 'Sans écriture dans S.P.I.', 'Le dispositif fonctionne en lecture seule vis-à-vis de S.P.I.'],
                [WifiOff, 'Continuité en cas de coupure', 'Les rappels déjà actifs sont conservés pendant une indisponibilité de communication.'],
                [CheckCircle2, 'Action claire', 'Le prélèvement attendu et l’action de validation sont visibles immédiatement.'],
              ].map(([Icon, title, text]) => {
                const IconComponent = Icon as typeof Bell;
                return (
                  <div key={String(title)} className="mt-4 border-t border-slate-200 pt-4 first:mt-3 first:border-t-0 first:pt-0">
                    <div className="flex gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#0f274b]"><IconComponent className="h-5 w-5" /></div>
                      <div><div className="text-xs font-black text-[#0f274b]">{title as string}</div><div className="mt-1 text-[11px] leading-5 text-slate-600">{text as string}</div></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ReminderScreen title="Surveillance S.P.I. temporairement indisponible" tone="warning" subtitle="Le dispositif ne reçoit plus les événements de S.P.I." event="Communication S.P.I." time="09:16">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center gap-2 text-sm font-black text-amber-800"><WifiOff className="h-5 w-5" />S.P.I. et la production ne sont pas affectés.</div>
                <div className="mt-2 text-xs text-slate-700">Les rappels déjà actifs restent conservés et la reconnexion est tentée automatiquement.</div>
              </div>
            </ReminderScreen>

            <ReminderScreen title="Prélèvement confirmé" tone="success" footer="Fermeture automatique dans quelques secondes">
              <div className="flex flex-col items-center py-5 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-green-600 text-green-700"><Check className="h-11 w-11" /></div>
                <div className="mt-5 text-xl font-black text-[#0f274b]">Le rappel a été acquitté.</div>
                <div className="mt-3 max-w-md text-xs leading-5 text-slate-600">Le dispositif poursuit la surveillance et affichera un nouveau rappel si une action est requise.</div>
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-green-100 bg-green-50 px-4 py-3 text-xs font-black text-green-800"><ShieldCheck className="h-5 w-5" />S.P.I. et la production ne sont pas affectés.</div>
              </div>
            </ReminderScreen>
          </div>
        </PageShell>

        <PageShell page={5}>
          <div className="flex items-center gap-3 text-[#0f274b]">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0f274b] text-white"><ShieldCheck className="h-6 w-6" /></div>
            <div>
              <h2 className="text-2xl font-black sm:text-3xl">Gestion des situations particulières</h2>
              <p className="mt-1 text-xs font-medium text-slate-600 sm:text-sm">Le dispositif informe l’opérateur et conserve les rappels actifs lorsque la situation sort du fonctionnement nominal.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div>
              <ReminderScreen title="Prélèvement requis" subtitle="Action opérateur requise" event="Arrêt supérieur à 4 heures" time="09:24" restored>
                <div className="text-xs font-black uppercase text-[#b90e0e]">À réaliser</div>
                <div className="mt-2 grid grid-cols-2 gap-2"><SampleCard number={1} quantity="4" unit="BOÎTES" label="Pack / Physico" icon={<Boxes className="h-4 w-4" />} /><SampleCard number={2} quantity="5" unit="PF" label="Microbiologie" icon={<Microscope className="h-4 w-4" />} /></div>
                <SuccessButton />
              </ReminderScreen>
              <div className="mt-3 px-2"><div className="text-sm font-black text-[#0f274b]">1. Reprise après redémarrage</div><div className="mt-1 text-xs leading-5 text-slate-600">Les rappels précédemment actifs sont restaurés après le redémarrage du poste.</div></div>
            </div>

            <div>
              <ReminderScreen title="Surveillance S.P.I. temporairement indisponible" tone="warning" subtitle="Communication S.P.I. indisponible" event="Communication S.P.I." time="09:16">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3"><div className="text-sm font-black text-amber-800">S.P.I. et la production ne sont pas affectés.</div><div className="mt-2 text-xs leading-5 text-slate-700">Les rappels déjà actifs restent conservés. Le dispositif tente de rétablir la communication.</div></div>
              </ReminderScreen>
              <div className="mt-3 px-2"><div className="text-sm font-black text-[#0f274b]">2. Perte de communication</div><div className="mt-1 text-xs leading-5 text-slate-600">La perte de communication ne bloque pas la production et ne supprime pas les rappels en cours.</div></div>
            </div>

            <div>
              <ReminderScreen title="Assistance non disponible pour cet événement" tone="warning" subtitle="Aucune règle de prélèvement applicable" event="Changement kit / cuve débranchée" time="09:32">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-slate-800"><div className="text-sm font-black">Aucune règle validée n’est disponible pour cette situation.</div><div className="mt-2 text-xs leading-5">Le dispositif ne génère aucun prélèvement. Appliquer la procédure habituelle et contacter Qualité si nécessaire.</div></div>
                <div className="mt-3 rounded-lg border border-amber-300 px-4 py-3 text-center text-sm font-black uppercase text-amber-700">J’ai pris connaissance</div>
              </ReminderScreen>
              <div className="mt-3 px-2"><div className="text-sm font-black text-[#0f274b]">3. Événement sans règle applicable</div><div className="mt-1 text-xs leading-5 text-slate-600">L’opérateur est orienté vers la procédure Qualité en vigueur.</div></div>
            </div>
          </div>

          <div className="mt-8 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [RefreshCcw, 'Persistance', 'Restauration des rappels après redémarrage.'],
              [WifiOff, 'Continuité', 'Conservation des rappels en cas de perte réseau.'],
              [ShieldCheck, 'Lecture seule', 'Aucune écriture dans S.P.I.'],
              [Info, 'Cas non couverts', 'Retour à la procédure Qualité.'],
            ].map(([Icon, title, text]) => {
              const IconComponent = Icon as typeof Bell;
              return <div key={String(title)} className="flex gap-3"><IconComponent className="h-6 w-6 shrink-0 text-[#0f274b]" /><div><div className="text-xs font-black text-[#0f274b]">{title as string}</div><div className="mt-1 text-[11px] leading-5 text-slate-600">{text as string}</div></div></div>;
            })}
          </div>
        </PageShell>

        <PageShell page={6}>
          <div className="flex items-center gap-3 text-[#0f274b]">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0f274b] text-white"><Database className="h-6 w-6" /></div>
            <div>
              <h2 className="text-2xl font-black sm:text-3xl">Référentiel métier et architecture du pilote</h2>
              <p className="mt-1 text-xs font-medium text-slate-600 sm:text-sm">Règles configurables par ligne et lecture seule des événements S.P.I.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="flex items-center justify-between bg-[#0f274b] px-4 py-3 text-white"><div><div className="text-sm font-black uppercase">Référentiel des règles de prélèvements</div><div className="text-[10px] text-slate-200">Règles configurées et validées par ligne</div></div><Database className="h-6 w-6" /></div>
              <div className="p-3">
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-700">Chaque ligne dispose de ses règles de prélèvement. Une évolution de règle peut être appliquée dans le référentiel sans modifier le fonctionnement général du dispositif.</div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[620px] border-collapse text-[10px] text-slate-700">
                    <thead><tr className="bg-[#124578] text-white"><th className="p-2 text-left">LIGNE</th><th className="p-2 text-left">ÉVÉNEMENT S.P.I.</th><th className="p-2 text-left">CONDITION</th><th className="p-2 text-left">PRÉLÈVEMENT(S)</th><th className="p-2 text-left">VERSION</th></tr></thead>
                    <tbody>
                      {[
                        ['L108', 'Arrêt production', 'Durée > 4 h', '5 PF · Microbiologie', '1.0'],
                        ['L108', 'Fin de cuve', '—', '4 boîtes · Pack / Physico + 5 PF · Microbiologie', '1.1'],
                        ['L108', 'Début de cuve', '—', 'Règle validée L108', '1.0'],
                        ['L108', 'Changement kit / cuve débranchée', '—', '5 PF · Microbiologie', '1.0'],
                        ['L109', 'Fin de cuve', '—', '4 boîtes + 5 PF', '1.0'],
                      ].map((row) => <tr key={row.join('-')} className="border-b border-slate-200">{row.map((cell, index) => <td key={cell} className={`p-2 align-top ${index === 0 ? 'font-black text-green-700' : ''}`}>{cell}</td>)}</tr>)}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-[11px] font-semibold text-green-800"><ShieldCheck className="h-5 w-5" />Les règles sont gérées dans le référentiel de la ligne.</div>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="flex items-center justify-between bg-[#0f274b] px-4 py-3 text-white"><div><div className="text-sm font-black uppercase">Architecture fonctionnelle du pilote</div><div className="text-[10px] text-slate-200">Assistant de rappel des prélèvements</div></div><Workflow className="h-6 w-6" /></div>
              <div className="p-4">
                <div className="mx-auto flex max-w-sm flex-col items-center gap-2 text-center text-[11px]">
                  {[
                    ['S.P.I.', 'Lecture autorisée des événements', 'blue'],
                    ['Détection des événements', 'Ligne, type, horaire, durée', 'blue'],
                    ['Ligne + événement', 'Ex. L108 — arrêt > 4 h', 'amber'],
                    ['Référentiel de la ligne', 'Règles métier validées', 'green'],
                    ['Moteur de règles', 'Évaluation des conditions', 'blue'],
                  ].map(([title, sub, tone]) => (
                    <div key={title} className={`w-full rounded-lg border px-3 py-2 ${tone === 'amber' ? 'border-amber-200 bg-amber-50' : tone === 'green' ? 'border-green-200 bg-green-50' : 'border-blue-200 bg-blue-50'}`}>
                      <div className="font-black text-[#0f274b]">{title}</div><div className="text-[10px] text-slate-600">{sub}</div>
                    </div>
                  ))}
                  <div className="text-lg text-slate-400">↓</div>
                  <div className="grid w-full grid-cols-2 gap-2">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="font-black text-slate-700">NON</div><div className="mt-1">Aucun rappel</div></div>
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3"><div className="font-black text-green-800">OUI</div><div className="mt-1">Rappel actif</div></div>
                  </div>
                  <div className="w-full rounded-lg border border-green-200 bg-green-50 px-3 py-2"><div className="font-black text-green-800">Validation opérateur</div><div className="text-[10px] text-slate-600">Prélèvement déclaré réalisé</div></div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-[10px] leading-4 text-slate-700"><div className="font-black text-[#0f274b]">S.P.I. reste inchangé</div>Aucune modification, aucune écriture.</div>
                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-[10px] leading-4 text-slate-700"><div className="font-black text-[#0f274b]">Traitement indépendant</div>Le dispositif applique les règles en dehors de S.P.I.</div>
                  <div className="rounded-lg border border-green-100 bg-green-50 p-3 text-[10px] leading-4 text-slate-700"><div className="font-black text-green-800">Persiste jusqu’à validation</div>Redémarrage, perte temporaire de communication, file d’attente.</div>
                  <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-[10px] leading-4 text-slate-700"><div className="font-black text-amber-800">Défaillance isolée</div>Le dispositif ne bloque ni S.P.I. ni la production.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [Database, 'Règles par ligne', 'Chaque ligne dispose de son référentiel validé.'],
              [ShieldCheck, 'Règles centralisées', 'Les évolutions métier sont appliquées dans le référentiel.'],
              [Workflow, 'Lecture seule de S.P.I.', 'Aucune écriture n’est réalisée dans S.P.I.'],
              [AlertTriangle, 'Défaillance isolée', 'Une indisponibilité du pilote n’interrompt pas la production.'],
            ].map(([Icon, title, text]) => {
              const IconComponent = Icon as typeof Bell;
              return <div key={String(title)} className="rounded-lg border border-slate-200 bg-slate-50 p-3"><IconComponent className="h-5 w-5 text-[#0f274b]" /><div className="mt-2 text-xs font-black text-[#0f274b]">{title as string}</div><div className="mt-1 text-[10px] leading-4 text-slate-600">{text as string}</div></div>;
            })}
          </div>

          <div className="mt-5 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-black text-[#0f274b]"><CheckCircle2 className="h-6 w-6 shrink-0" />Le pilote combine des règles configurables par ligne, une lecture seule de S.P.I. et une validation explicite par l’opérateur.</div>
        </PageShell>
      </div>
    </div>
  );
}
